// pages/api/sponsor/create_scheduled_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// The sponsor's own self-serve half of the redesigned carousel flow (see
// approve_for_payment.js) - the sponsor picks ONE of Medsa's own real,
// fixed calendar-month options (1/3/6/12 months, never a typed-in day
// count) plus a start date; the end date is computed with real calendar
// months (setMonth), so "1 month" from Jan 31 lands on Feb 28/29 like a
// person would expect, not a fixed 30-day offset.
// startsAt/endsAt/chosen option travel as Stripe metadata (strings) so the
// webhook (or verify_scheduled_checkout.js, if the webhook never fires) can
// write them straight onto home_carousel_items once payment clears -
// nothing goes live here, this only starts the payment request.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { grossUpForStripeFee } from '../../../lib/paymentFees'
import { addMonthsToDateString } from '../../../lib/adPricingMenu'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Stripe is not connected yet - add STRIPE_SECRET_KEY in Vercel to enable real charging.' })
  }
  const { submissionId, optionIndex, startsAt } = req.body || {}
  if (!submissionId || !(optionIndex >= 0) || !startsAt) {
    return res.status(400).json({ status: 'ERROR', message: 'submissionId, optionIndex, and startsAt are required.' })
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
  const option = (sub.pricing_options || [])[optionIndex]
  if (!option) return res.status(400).json({ status: 'ERROR', message: 'That option is no longer available - reload and pick again.' })

  const endDate = addMonthsToDateString(startsAt, option.months)
  const endsAt = endDate.toISOString().slice(0,10)

  const { grossAmountHKD } = grossUpForStripeFee(option.priceHkd)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'hkd',
        product_data: { name: `Medsa Health sponsored ${sub.item_type}: ${sub.title} (${option.label}, from ${startsAt})` },
        unit_amount: Math.round(grossAmountHKD * 100),
      },
      quantity: 1,
    }],
    customer_email: sub.sponsor_contact_email || undefined,
    success_url: `${siteUrl}/sponsor-pay?id=${submissionId}&paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/sponsor-pay?id=${submissionId}&cancelled=1`,
    metadata: { submission_id: submissionId, option_label: option.label, starts_at: startsAt, ends_at: endsAt },
  })

  // Recorded here (not just carried in Stripe metadata) so the admin
  // review screen can show what the sponsor actually picked even before
  // payment clears.
  await supabase.from('home_carousel_submissions').update({
    chosen_option_label: option.label, chosen_duration_months: option.months, starts_at: startsAt, ends_at: endsAt,
    gross_amount_hkd: grossAmountHKD, processing_fee_hkd: grossAmountHKD - option.priceHkd,
    stripe_checkout_session_id: session.id, stripe_payment_link: session.url,
  }).eq('id', submissionId)

  return res.status(200).json({ status: 'CREATED', paymentUrl: session.url, grossAmountHKD })
}
