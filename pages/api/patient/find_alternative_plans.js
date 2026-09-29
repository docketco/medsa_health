// pages/api/patient/find_alternative_plans.js
// ─────────────────────────────────────────────────────────────────────────────
// aq2-08 - when a plan is declined (or flagged and later declined), the
// SYSTEM generates alternatives via the same deterministic matching
// engine run against every other active plan - never an agent's
// judgment. Labeled same-insurer vs. cross-insurer so the patient can
// tell whether they're still looking at their original insurer or not.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { matchPlanSuitability } from '../../../lib/planSuitabilityMatch'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { inquiryId } = req.body || {}
  if (!inquiryId) return res.status(400).json({ status: 'ERROR', message: 'inquiryId is required.' })

  const { data: inquiry } = await supabase.from('plan_inquiries')
    .select('id, patient_id, plan_id, declared_conditions, insurance_plans(company_name)').eq('id', inquiryId).maybeSingle()
  if (!inquiry) return res.status(404).json({ status: 'ERROR', message: 'Inquiry not found.' })

  const { data: patient } = await supabase.from('patients').select('date_of_birth').eq('id', inquiry.patient_id).maybeSingle()
  const age = patient?.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)) : null

  const { data: plans } = await supabase.from('insurance_plans')
    .select('id, plan_name, company_name, covered_conditions, covered_categories, pre_existing_condition_policy, insurer_flags, requires_agent, insurance_plan_pricing_tiers(*)')
    .eq('status', 'active').neq('id', inquiry.plan_id)

  const originalCompany = inquiry.insurance_plans?.company_name

  // Only ever surfaces a plan matching would actually approve for this
  // patient - never a partial/flagged match, since the whole point is
  // offering a real alternative, not another dead end.
  const alternatives = (plans || [])
    .filter(p => !p.requires_agent)
    .map(p => ({ plan: p, result: matchPlanSuitability({ plan: p, patientAge: age, conditions: inquiry.declared_conditions || [] }) }))
    .filter(({ result }) => result.verdict === 'approved')
    .map(({ plan, result }) => ({
      planId: plan.id, planName: plan.plan_name, companyName: plan.company_name,
      sameInsurer: plan.company_name === originalCompany,
      quotedPremium: result.quotedPremium,
    }))
    .sort((a, b) => (a.sameInsurer === b.sameInsurer ? 0 : a.sameInsurer ? -1 : 1))

  return res.status(200).json({ status: 'OK', alternatives })
}
