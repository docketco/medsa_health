// pages/api/patient/complete_auto_purchase.js
// ─────────────────────────────────────────────────────────────────────────────
// Finishes the fully-automated "get details automatically" path into a real
// policy - previously that path only ever produced a quote card and a
// plan_inquiries row; nothing ever became an actual held policy, so "auto
// buying" wasn't really buying anything yet. Only reachable for a plan that
// doesn't require_agent (checked here again, not just client-side) and only
// after the deterministic suitability read (lib/planSuitability.js) came
// back 'suitable' or 'suitable_with_notes' - a 'needs_review' read is
// exactly the case this route refuses, since that's what routes a patient
// to an agent instead.
// No agent_id on the resulting policy - nobody sold this, so there's no
// commission/referral fee to compute for it either.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { matchPlanSuitability } from '../../../lib/planSuitability'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const WARD_CLASSES = ['general', 'semi_private', 'private']
const PAYMENT_FREQUENCIES = ['monthly', 'annual']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { inquiryId, patientId, planId, wardClass, paymentFrequency, healthDeclarationAcknowledged } = req.body || {}
  if (!inquiryId || !patientId || !planId) return res.status(400).json({ status: 'ERROR', message: 'inquiryId, patientId and planId are required.' })
  if (!healthDeclarationAcknowledged) return res.status(400).json({ status: 'ERROR', message: 'The health declaration must be acknowledged before a policy can be issued.' })
  if (wardClass && !WARD_CLASSES.includes(wardClass)) return res.status(400).json({ status: 'ERROR', message: 'Invalid ward class.' })
  if (paymentFrequency && !PAYMENT_FREQUENCIES.includes(paymentFrequency)) return res.status(400).json({ status: 'ERROR', message: 'Invalid payment frequency.' })

  const { data: inquiry } = await supabase.from('plan_inquiries').select('*').eq('id', inquiryId).eq('patient_id', patientId).eq('plan_id', planId).maybeSingle()
  if (!inquiry) return res.status(404).json({ status: 'ERROR', message: 'Inquiry not found.' })
  if (inquiry.mode !== 'auto') return res.status(400).json({ status: 'ERROR', message: 'This inquiry was not an automated quote.' })
  if (inquiry.suitability_verdict === 'needs_review') return res.status(400).json({ status: 'ERROR', message: 'This plan needs an agent to review it before it can be purchased automatically.' })

  const { data: plan } = await supabase.from('insurance_plans')
    .select('id, plan_name, company_name, requires_agent, contract_template_url, insurance_plan_pricing_tiers(*)')
    .eq('id', planId).maybeSingle()
  if (!plan) return res.status(404).json({ status: 'ERROR', message: 'Plan not found.' })
  if (plan.requires_agent) return res.status(400).json({ status: 'ERROR', message: 'This plan requires an agent - it cannot be bought automatically.' })

  const { data: company } = await supabase.from('insurance_companies').select('institution_ref_id').eq('name', plan.company_name).maybeSingle()
  const { data: patient } = await supabase.from('patients').select('full_name, date_of_birth').eq('id', patientId).maybeSingle()
  if (!patient) return res.status(404).json({ status: 'ERROR', message: 'Patient not found.' })
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
    contract_file_path: plan.contract_template_url || null,
    contract_ready_at: plan.contract_template_url ? nowIso : null,
    patient_signed_at: plan.contract_template_url ? nowIso : null,
  }).select('id').maybeSingle()
  if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })

  await supabase.from('plan_inquiries').update({ status: 'converted' }).eq('id', inquiryId)

  return res.status(200).json({ status: 'OK', policyId: policy.id })
}
