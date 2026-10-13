// pages/api/patient/create_bump_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Medsa Bump is a one-time payment, charged directly by Medsa (not an
// insurance premium - that's bank transfer between agent/insurer, out of
// scope here). A patient who's used Bump before gets the confirmed loyalty
// discount automatically - no code/coupon step, just a real check against
// their own bump_subscriptions history.
//
// BUMP_PRICE_HKD is intentionally unset until a real price is confirmed -
// same "refuse rather than guess" pattern as STRIPE_SECRET_KEY below. Real
// money, so this never falls back to an invented number.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { grossUpForStripeFee } from '../../../lib/paymentFees'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const BUMP_PRICE_HKD = null // TODO: set the real one-time Medsa Bump price once confirmed
const BUMP_LOYALTY_DISCOUNT_PCT = 0.20 // TODO: confirm the real repeat-use discount rate

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!BUMP_PRICE_HKD) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Medsa Bump pricing is not set up yet - contact Medsa.' })
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Stripe is not connected yet - add STRIPE_SECRET_KEY in Vercel to enable real charging.' })
  }
  const { patientId, predictedDueDate, gestationalWeeksAtSignup, discoveredPregnantAt } = req.body || {}
  if (!patientId) return res.status(400).json({ status: 'ERROR', message: 'patientId is required.' })

  const { data: patient } = await supabase.from('patients').select('id, full_name').eq('id', patientId).maybeSingle()
  if (!patient) return res.status(404).json({ status: 'ERROR', message: 'Patient not found.' })

  // Real loyalty check, not a self-reported flag - any prior Bump row at
  // all (graduated or not) counts as "has used Medsa Bump before."
  const { count: priorCount } = await supabase.from('bump_subscriptions')
    .select('id', { count: 'exact', head: true }).eq('patient_id', patientId)
  const isLoyaltyDiscount = (priorCount || 0) > 0
  const netPriceHKD = isLoyaltyDiscount ? BUMP_PRICE_HKD * (1 - BUMP_LOYALTY_DISCOUNT_PCT) : BUMP_PRICE_HKD

  const { grossAmountHKD } = grossUpForStripeFee(netPriceHKD)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'hkd',
        product_data: { name: `Medsa Bump${isLoyaltyDiscount ? ' (loyalty discount applied)' : ''}` },
        unit_amount: Math.round(grossAmountHKD * 100),
      },
      quantity: 1,
    }],
    success_url: `${siteUrl}/?bump_started=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/?bump_cancelled=1`,
    metadata: {
      bump_patient_id: patientId,
      bump_predicted_due_date: predictedDueDate || '',
      bump_gestational_weeks_at_signup: gestationalWeeksAtSignup != null ? String(gestationalWeeksAtSignup) : '',
      bump_discovered_pregnant_at: discoveredPregnantAt || '',
      bump_is_loyalty_discount: String(isLoyaltyDiscount),
    },
  })

  return res.status(200).json({ status: 'CREATED', paymentUrl: session.url, isLoyaltyDiscount, netPriceHKD })
}
