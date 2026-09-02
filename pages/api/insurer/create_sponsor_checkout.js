// pages/api/insurer/create_sponsor_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Self-serve sponsorship for partnered insurers - pick a plan they already
// own, pick a duration, pay, done - no Medsa approval step, unlike the
// carousel/newsletter sponsor flow. Same Stripe Checkout + gross-up
// pattern as /api/sponsor/create_checkout_session.js (Medsa still
// receives the full quoted price; the insurer's card absorbs the fee).
// Actually marking the plan sponsored happens in the webhook once Stripe
// confirms payment, not here - this only ever starts the payment request.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { grossUpForStripeFee } from '../../../lib/paymentFees'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const RATE_HKD_PER_MONTH = 3000

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Stripe is not connected yet - add STRIPE_SECRET_KEY in Vercel to enable real charging.' })
  }
  const { planId, companyId, months } = req.body || {}
  if (!planId || !companyId || ![1,3,6].includes(months)) {
    return res.status(400).json({ status: 'ERROR', message: 'planId, companyId, and months (1, 3, or 6) are required.' })
  }

  // Only a plan the requesting company actually owns can be sponsored on
  // its behalf - companyId comes from the client's logged-in session, so
  // this is what stops one insurer paying to sponsor another's plan.
  const { data: company } = await supabase.from('insurance_companies').select('name, contact_email, status').eq('id', companyId).maybeSingle()
  if (!company || company.status !== 'active') return res.status(403).json({ status: 'ERROR', message: 'Company not found or inactive.' })
  const { data: plan } = await supabase.from('insurance_plans').select('id, plan_name, company_name').eq('id', planId).maybeSingle()
  if (!plan || plan.company_name !== company.name) return res.status(403).json({ status: 'ERROR', message: 'That plan does not belong to your company.' })

  const netAmountHKD = RATE_HKD_PER_MONTH * months
  const { grossAmountHKD } = grossUpForStripeFee(netAmountHKD)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'hkd',
        product_data: { name: `Medsa Health sponsored placement: ${plan.plan_name} (${months} month${months>1?'s':''})` },
        unit_amount: Math.round(grossAmountHKD * 100),
      },
      quantity: 1,
    }],
    customer_email: company.contact_email || undefined,
    success_url: `${siteUrl}/insurer-portal?sponsored=1`,
    cancel_url: `${siteUrl}/insurer-portal?sponsor_cancelled=1`,
    metadata: { plan_id: planId, months: String(months) },
  })

  return res.status(200).json({ status: 'CREATED', paymentUrl: session.url, grossAmountHKD })
}
