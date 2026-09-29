// lib/completeAutoPurchase.js
// ─────────────────────────────────────────────────────────────────────────────
// The actual "turn a converted automated inquiry into a held policy" logic,
// shared between two entry points: the direct path (no Stripe - the
// insurer bills the patient off-platform, same as buying straight from
// the insurer's own site) and the Stripe Connect path (the insurer has
// opted into Bowtie-style self-serve checkout, so this runs from the
// webhook once Stripe confirms the patient's payment actually landed in
// the insurer's own connected account). Same policy row either way -
// Medsa's platform fee is never per-policy any more (see the subscription
// model), so there's nothing fee-related to branch on here.
// ─────────────────────────────────────────────────────────────────────────────

import { matchPlanSuitability } from './planSuitabilityMatch'

const WARD_CLASSES = ['general', 'semi_private', 'private']
const PAYMENT_FREQUENCIES = ['monthly', 'annual']

export async function createAutoPurchasePolicy(supabase, { inquiryId, patientId, planId, wardClass, paymentFrequency }) {
  if (!inquiryId || !patientId || !planId) return { status: 'ERROR', message: 'inquiryId, patientId and planId are required.' }
  if (wardClass && !WARD_CLASSES.includes(wardClass)) return { status: 'ERROR', message: 'Invalid ward class.' }
  if (paymentFrequency && !PAYMENT_FREQUENCIES.includes(paymentFrequency)) return { status: 'ERROR', message: 'Invalid payment frequency.' }

  const { data: inquiry } = await supabase.from('plan_inquiries').select('*').eq('id', inquiryId).eq('patient_id', patientId).eq('plan_id', planId).maybeSingle()
  if (!inquiry) return { status: 'ERROR', message: 'Inquiry not found.' }
  if (inquiry.mode !== 'auto') return { status: 'ERROR', message: 'This inquiry was not an automated quote.' }
  if (inquiry.suitability_verdict === 'declined') return { status: 'ERROR', message: 'This plan was declined for the declared conditions - it cannot be purchased.' }
  // A pending underwriter_status blocks purchase whether it's a real
  // flagged case awaiting review, or just a clean case awaiting the quick
  // sign-off an insurer requires when auto_buy_on_clean is off (aq2-19) -
  // only an explicit 'approved' clears it either way.
  if (inquiry.underwriter_status && inquiry.underwriter_status !== 'approved') {
    return { status: 'ERROR', message: inquiry.suitability_verdict === 'flagged' ? 'This plan needs underwriter review before it can be purchased.' : 'This plan is waiting on a quick sign-off before it can be purchased.' }
  }
  if (inquiry.declaration_expires_at && new Date(inquiry.declaration_expires_at) < new Date()) {
    return { status: 'ERROR', message: 'This quote has expired - please run the declaration again for a current quote.' }
  }
  if (inquiry.status === 'converted') return { status: 'ALREADY_CONVERTED', message: 'This inquiry has already been turned into a policy.' }

  const { data: plan } = await supabase.from('insurance_plans')
    .select('id, plan_name, company_name, requires_agent, insurance_plan_pricing_tiers(*)')
    .eq('id', planId).maybeSingle()
  if (!plan) return { status: 'ERROR', message: 'Plan not found.' }
  if (plan.requires_agent) return { status: 'ERROR', message: 'This plan requires an agent - it cannot be bought automatically.' }

  const { data: company } = await supabase.from('insurance_companies').select('institution_ref_id').eq('name', plan.company_name).maybeSingle()
  const { data: patient } = await supabase.from('patients').select('full_name, date_of_birth').eq('id', patientId).maybeSingle()
  if (!patient) return { status: 'ERROR', message: 'Patient not found.' }
  const age = patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)) : null
  // Recomputed server-side rather than trusting the quote the client
  // already saw - the same reason every other billing-adjacent route in
  // this app never trusts a client-supplied amount.
  const { quotedPremium } = matchPlanSuitability({ plan, patientAge: age, conditions: inquiry.declared_conditions || [] })

  const now = new Date()
  const renewalDate = new Date(now)
  renewalDate.setFullYear(renewalDate.getFullYear() + 1)
  const nowIso = now.toISOString()

  const { data: policy, error: insErr } = await supabase.from('agent_policies').insert({
    agent_id: null, institution_id: company?.institution_ref_id || null,
    patient_id: patientId, patient_name: patient.full_name || null,
    plan_id: planId, plan_name: plan.plan_name, inquiry_id: inquiryId,
    premium: quotedPremium, status: 'active',
    start_date: now.toISOString().slice(0, 10), renewal_date: renewalDate.toISOString().slice(0, 10),
    ward_class: wardClass || null, payment_frequency: paymentFrequency || 'monthly',
    health_declaration_acknowledged_at: nowIso,
  }).select('id').maybeSingle()
  if (insErr) return { status: 'ERROR', message: insErr.message }

  await supabase.from('plan_inquiries').update({ status: 'converted' }).eq('id', inquiryId)

  return { status: 'OK', policyId: policy.id }
}
