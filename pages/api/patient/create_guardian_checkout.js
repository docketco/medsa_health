// pages/api/patient/create_guardian_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Medsa Guardian - a real Stripe Subscription, direct to Medsa, same "no
// Connect destination" shape as insurer/start_subscription.js since this
// is Medsa's own revenue, not money passing through to anyone else.
// Package covers up to GUARDIAN_PACKAGE_SIZE linked dependents;
// GUARDIAN_ADDON_PER_HEAD_HKD is a placeholder for billing a larger
// package later (not wired into this checkout yet - package only, matching
// what's actually been confirmed).
//
// Switched from monthly to annual billing per the later call - the annual
// price below is the confirmed HK$148/mo figure x12 with NO discount
// applied, since no discount rate was given. If an annual commitment is
// meant to come with one, this is the one number in this file to revisit.
//
// Both price constants are intentionally unset by default - same "refuse
// rather than invent" pattern as Bump's BUMP_PRICE_HKD. Real recurring
// money, so this never falls back to a guessed number.
//
// Corrected back out: an earlier wrong guess routed the Bump loyalty
// credit here. Your call - that stays a discount on the repeat Bump
// purchase itself (see create_bump_checkout.js). Separately raised, not
// built yet: Guardian should never be discounted except when managing a
// disabled dependent (DEPENDENT_RELATIONSHIPS already has 'disabled') -
// needs the actual discount mechanic (full waiver? a %?) before this
// file can do anything with it.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const GUARDIAN_PACKAGE_PRICE_HKD = 148 * 12 // = 1,776/year - straight x12 of the confirmed monthly figure, no annual discount applied
const GUARDIAN_PACKAGE_SIZE = 4
const GUARDIAN_ADDON_PER_HEAD_HKD = null // TODO: set the real per-extra-head add-on price once confirmed (not wired into checkout yet - package only)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!GUARDIAN_PACKAGE_PRICE_HKD) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Medsa Guardian pricing is not set up yet - contact Medsa.' })
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Stripe is not connected yet - add STRIPE_SECRET_KEY in Vercel to enable real charging.' })
  }
  const { patientId } = req.body || {}
  if (!patientId) return res.status(400).json({ status: 'ERROR', message: 'patientId is required.' })

  const { data: patient } = await supabase.from('patients').select('id, full_name, phone, guardian_stripe_customer_id').eq('id', patientId).maybeSingle()
  if (!patient) return res.status(404).json({ status: 'ERROR', message: 'Patient not found.' })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'

  let customerId = patient.guardian_stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({ name: patient.full_name, metadata: { patient_id: patient.id } })
    customerId = customer.id
    await supabase.from('patients').update({ guardian_stripe_customer_id: customerId }).eq('id', patient.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{
      price_data: {
        currency: 'hkd',
        product_data: { name: `Medsa Guardian - up to ${GUARDIAN_PACKAGE_SIZE} managed profiles (annual)` },
        unit_amount: Math.round(GUARDIAN_PACKAGE_PRICE_HKD * 100),
        recurring: { interval: 'year' },
      },
      quantity: 1,
    }],
    success_url: `${siteUrl}/patient?guardian_started=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/patient?guardian_cancelled=1`,
    metadata: { guardian_patient_id: patientId },
    subscription_data: { metadata: { guardian_patient_id: patientId } },
  })

  return res.status(200).json({ status: 'CREATED', paymentUrl: session.url })
}
