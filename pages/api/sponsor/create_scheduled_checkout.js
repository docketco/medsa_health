// pages/api/sponsor/create_scheduled_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// The sponsor's own self-serve half of the redesigned carousel flow (see
// approve_for_payment.js) - same Stripe Checkout + gross-up pattern as
// Sponsored Listings' create_sponsor_checkout.js, but for an already-
// reviewed carousel/newsletter submission instead of an insurer's plan.
// startsAt/endsAt travel as Stripe metadata (strings, YYYY-MM-DD) so the
// webhook (or verify_scheduled_checkout.js, if the webhook never fires) can
// write them straight onto home_carousel_items once payment clears -
// nothing goes live here, this only starts the payment request.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { grossUpForStripeFee } from '../../../lib/paymentFees'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Stripe is not connected yet - add STRIPE_SECRET_KEY in Vercel to enable real charging.' })
  }
  const { submissionId, months, startsAt } = req.body || {}
  if (!submissionId || ![1,3,6].includes(months) || !startsAt) {
    return res.status(400).json({ status: 'ERROR', message: 'submissionId, months (1, 3, or 6), and startsAt are required.' })
  }
  const startDate = new Date(`${startsAt}T00:00:00`)
  const today = new Date(); today.setHours(0,0,0,0)
  if (isNaN(startDate.getTime()) || startDate < today) {
    return res.status(400).json({ status: 'ERROR', message: 'startsAt must be a real date, today or later.' })
  }

  const { data: sub } = await supabase.from('home_carousel_submissions').select('*').eq('id', submissionId).maybeSingle()
  if (!sub) return res.status(404).json({ status: 'ERROR', message: 'Submission not found.' })
  if (sub.status !== 'approved_awaiting_payment') return res.status(400).json({ status: 'ERROR', message: 'This submission is not awaiting payment (it may already be paid, or not approved yet).' })
  if (sub.payment_status === 'paid') return res.status(400).json({ status: 'ERROR', message: 'This submission is already paid and live.' })
  if (!sub.price_hkd || sub.price_hkd <= 0) return res.status(400).json({ status: 'ERROR', message: 'No rate was set for this submission - contact Medsa.' })

  const endDate = new Date(startDate)
  endDate.setMonth(endDate.getMonth() + months)
  const endsAt = endDate.toISOString().slice(0,10)

  const netAmountHKD = sub.price_hkd * months
  const { grossAmountHKD } = grossUpForStripeFee(netAmountHKD)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'hkd',
        product_data: { name: `Medsa Health sponsored ${sub.item_type}: ${sub.title} (${months} month${months>1?'s':''}, from ${startsAt})` },
        unit_amount: Math.round(grossAmountHKD * 100),
      },
      quantity: 1,
    }],
    customer_email: sub.sponsor_contact_email || undefined,
    success_url: `${siteUrl}/sponsor-pay?id=${submissionId}&paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/sponsor-pay?id=${submissionId}&cancelled=1`,
    metadata: { submission_id: submissionId, months: String(months), starts_at: startsAt, ends_at: endsAt },
  })

  // Recorded here (not just carried in Stripe metadata) so the admin
  // review screen can show what the sponsor actually picked even before
  // payment clears.
  await supabase.from('home_carousel_submissions').update({
    months, starts_at: startsAt, ends_at: endsAt,
    gross_amount_hkd: grossAmountHKD, processing_fee_hkd: grossAmountHKD - netAmountHKD,
    stripe_checkout_session_id: session.id, stripe_payment_link: session.url,
  }).eq('id', submissionId)

  return res.status(200).json({ status: 'CREATED', paymentUrl: session.url, grossAmountHKD })
}
