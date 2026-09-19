// pages/api/patient/create_auto_purchase_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Real payment gate for the fully-automated "quote immediately" path. This
// route used to BE complete_auto_purchase.js - it handed back an active,
// held policy the instant the health declaration checkbox was ticked, with
// no money changing hands at all ("auto buying" that never actually charged
// anyone). Now it only ever creates a Stripe Checkout session; the policy
// itself is only ever created by the webhook (pages/api/webhooks/stripe.js)
// once Stripe confirms the card actually went through - the same pattern
// every other paid feature in this app already uses (sponsor checkout,
// video consult checkout): never create the thing being paid for from the
// route that merely starts checkout, only from the webhook that confirms
// payment landed.
// Every check this route used to gate the direct insert on is still here,
// gating checkout instead: mode must be 'auto', the deterministic verdict
// must not be 'needs_review', the plan must not require an agent, and the
// premium is always recomputed server-side (never trusts a client quote).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { matchPlanSuitability } from '../../../lib/planSuitability'
import { grossUpForStripeFee } from '../../../lib/paymentFees'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const WARD_CLASSES = ['general', 'semi_private', 'private']
const PAYMENT_FREQUENCIES = ['monthly', 'annual']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Payment is not connected yet - add STRIPE_SECRET_KEY in Vercel so a plan can actually be paid for before it binds.' })
  }
  const { inquiryId, patientId, planId, wardClass, paymentFrequency, healthDeclarationAcknowledged } = req.body || {}
  if (!inquiryId || !patientId || !planId) return res.status(400).json({ status: 'ERROR', message: 'inquiryId, patientId and planId are required.' })
  if (!healthDeclarationAcknowledged) return res.status(400).json({ status: 'ERROR', message: 'The health declaration must be acknowledged before a policy can be issued.' })
  if (wardClass && !WARD_CLASSES.includes(wardClass)) return res.status(400).json({ status: 'ERROR', message: 'Invalid ward class.' })
  if (paymentFrequency && !PAYMENT_FREQUENCIES.includes(paymentFrequency)) return res.status(400).json({ status: 'ERROR', message: 'Invalid payment frequency.' })

  const { data: inquiry } = await supabase.from('plan_inquiries').select('*').eq('id', inquiryId).eq('patient_id', patientId).eq('plan_id', planId).maybeSingle()
  if (!inquiry) return res.status(404).json({ status: 'ERROR', message: 'Inquiry not found.' })
  if (inquiry.mode !== 'auto') return res.status(400).json({ status: 'ERROR', message: 'This inquiry was not an automated quote.' })
  if (inquiry.suitability_verdict === 'needs_review') return res.status(400).json({ status: 'ERROR', message: 'This plan needs an agent to review it before it can be purchased automatically.' })
  if (inquiry.status === 'converted') return res.status(400).json({ status: 'ERROR', message: 'This inquiry has already been turned into a policy.' })

  const { data: plan } = await supabase.from('insurance_plans')
    .select('id, plan_name, company_name, requires_agent, insurance_plan_pricing_tiers(*)')
    .eq('id', planId).maybeSingle()
  if (!plan) return res.status(404).json({ status: 'ERROR', message: 'Plan not found.' })
  if (plan.requires_agent) return res.status(400).json({ status: 'ERROR', message: 'This plan requires an agent - it cannot be bought automatically.' })

  const { data: patient } = await supabase.from('patients').select('full_name, date_of_birth, email').eq('id', patientId).maybeSingle()
  if (!patient) return res.status(404).json({ status: 'ERROR', message: 'Patient not found.' })
  const age = patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)) : null
  const { quotedPremium } = matchPlanSuitability({ plan, patientAge: age, conditions: inquiry.declared_conditions || [] })
  if (!quotedPremium || quotedPremium <= 0) return res.status(400).json({ status: 'ERROR', message: 'Could not price this plan.' })

  const freq = paymentFrequency || 'monthly'
  // The card is charged the full period's premium up front (one month, or
  // one year at 12x the monthly rate) - agent_policies.premium still always
  // stores the monthly rate afterwards, matching how every other held
  // policy is displayed and how renewals already work.
  const netAmountHKD = freq === 'annual' ? quotedPremium * 12 : quotedPremium
  const { grossAmountHKD } = grossUpForStripeFee(netAmountHKD)

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'hkd',
        product_data: { name: `${plan.plan_name} (${plan.company_name}) - ${freq === 'annual' ? '1 year' : '1 month'} premium` },
        unit_amount: Math.round(grossAmountHKD * 100),
      },
      quantity: 1,
    }],
    customer_email: patient.email || undefined,
    success_url: `${siteUrl}/patient?plan_purchased=1`,
    cancel_url: `${siteUrl}/patient?plan_purchase_cancelled=1`,
    // Everything the webhook needs to actually issue the policy once
    // payment clears - Stripe metadata values must be strings.
    metadata: {
      auto_purchase_inquiry_id: inquiryId, patient_id: patientId, plan_id: planId,
      ward_class: wardClass || '', payment_frequency: freq,
    },
  })

  await supabase.from('plan_inquiries').update({ status: 'payment_pending' }).eq('id', inquiryId)

  return res.status(200).json({ status: 'CREATED', paymentUrl: session.url })
}
