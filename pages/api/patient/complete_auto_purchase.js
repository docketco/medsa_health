// pages/api/patient/complete_auto_purchase.js
// ─────────────────────────────────────────────────────────────────────────────
// Finishes the fully-automated "quote immediately" path. Two ways this can
// go, decided per-insurer (insurance_companies.self_serve_checkout_enabled):
//
// 1. Default (no Stripe involvement): the policy is held immediately and
//    the insurer bills the patient directly, off-platform - same as
//    buying straight from the insurer's own site. Real HK insurers bill
//    premiums directly to the patient, never through a broker, and Medsa
//    isn't in the business of collecting insurance premiums or holding
//    client money.
// 2. Self-serve checkout (an insurer that has connected their own Stripe
//    account, Bowtie-style): redirects the patient to a real Stripe
//    Checkout session that pays the INSURER's connected account directly
//    (Connect transfer_data.destination, zero application fee) - Medsa
//    still never touches the premium. The policy itself is only created
//    once Stripe confirms payment, via the webhook.
//
// Either way, Medsa's own revenue is the flat monthly platform
// subscription (insurance_companies.subscription_fee_hkd_monthly), not a
// per-policy fee - that model (referral-fee-shaped, billed per case) is
// exactly what invites being treated as unlicensed insurance intermediary
// activity, which is why it was replaced.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createAutoPurchasePolicy } from '../../../lib/completeAutoPurchase'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { inquiryId, patientId, planId, wardClass, paymentFrequency, healthDeclarationAcknowledged } = req.body || {}
  if (!healthDeclarationAcknowledged) return res.status(400).json({ status: 'ERROR', message: 'The health declaration must be acknowledged before a policy can be issued.' })

  const { data: inquiry } = await supabase.from('plan_inquiries').select('id, plan_id').eq('id', inquiryId).eq('patient_id', patientId).eq('plan_id', planId).maybeSingle()
  if (!inquiry) return res.status(404).json({ status: 'ERROR', message: 'Inquiry not found.' })
  const { data: plan } = await supabase.from('insurance_plans').select('company_name, plan_name').eq('id', planId).maybeSingle()
  const { data: company } = plan
    ? await supabase.from('insurance_companies').select('id, name, self_serve_checkout_enabled, stripe_connect_status, stripe_connect_account_id').eq('name', plan.company_name).maybeSingle()
    : { data: null }

  const selfServeReady = company?.self_serve_checkout_enabled && company.stripe_connect_status === 'active' && company.stripe_connect_account_id && process.env.STRIPE_SECRET_KEY

  if (selfServeReady) {
    // Recompute the same way the direct path would, purely to quote the
    // patient the real premium on the Checkout page - the policy itself
    // isn't created until the webhook confirms payment.
    const { matchPlanSuitability } = await import('../../../lib/planSuitability')
    const { data: fullPlan } = await supabase.from('insurance_plans').select('id, plan_name, company_name, insurance_plan_pricing_tiers(*)').eq('id', planId).maybeSingle()
    const { data: fullInquiry } = await supabase.from('plan_inquiries').select('declared_conditions').eq('id', inquiryId).maybeSingle()
    const { data: patient } = await supabase.from('patients').select('date_of_birth').eq('id', patientId).maybeSingle()
    const age = patient?.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)) : null
    const { quotedPremium } = matchPlanSuitability({ plan: fullPlan, patientAge: age, conditions: fullInquiry?.declared_conditions || [] })

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'hkd',
          product_data: { name: `${plan.plan_name} - ${company.name} (first premium)` },
          unit_amount: Math.round(quotedPremium * 100),
        },
        quantity: 1,
      }],
      payment_intent_data: {
        transfer_data: { destination: company.stripe_connect_account_id },
        application_fee_amount: 0,
      },
      success_url: `${siteUrl}/patient?auto_purchase=1`,
      cancel_url: `${siteUrl}/patient?auto_purchase_cancelled=1`,
      metadata: {
        // Namespaced auto_purchase_* keys - the webhook's sponsor-plan
        // branch already reads a bare "plan_id" key for a different
        // purpose (marking a plan sponsored), so reusing that name here
        // would make this checkout get misread as a sponsorship payment.
        auto_purchase_inquiry_id: inquiryId, auto_purchase_patient_id: patientId, auto_purchase_plan_id: planId,
        auto_purchase_ward_class: wardClass || '', auto_purchase_payment_frequency: paymentFrequency || 'monthly',
      },
    })
    return res.status(200).json({ status: 'REDIRECT', checkoutUrl: session.url })
  }

  const result = await createAutoPurchasePolicy(supabase, { inquiryId, patientId, planId, wardClass, paymentFrequency })
  if (result.status === 'ERROR') return res.status(400).json(result)
  return res.status(200).json(result)
}
