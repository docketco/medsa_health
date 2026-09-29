// pages/api/patient/find_me_a_plan.js
// ─────────────────────────────────────────────────────────────────────────────
// The "Find me a plan" guided entry point (aq2-09) - one declaration,
// checked against every plan Medsa actually sells (same self_serve_only/
// sponsored rules the normal browse view uses), matched recommendations
// back. Same deterministic engine as everywhere else in this rebuild, no
// AI, no agent judgment - approved plans only, so a patient never gets
// steered toward something that would just get flagged or declined
// anyway. Labeled same-insurer-as-nothing-yet doesn't apply here (no
// "original" plan), so results are just sorted approved-first by premium.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { matchPlanSuitability } from '../../../lib/planSuitabilityMatch'
import { resolveManyIcd10, codeMapToObject } from '../../../lib/icd10Match'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { patientId, declaredConditions, consentHistoryShared } = req.body || {}
  if (!patientId) return res.status(400).json({ status: 'ERROR', message: 'patientId is required.' })

  const { data: patient } = await supabase.from('patients').select('date_of_birth').eq('id', patientId).maybeSingle()
  if (!patient) return res.status(404).json({ status: 'ERROR', message: 'Patient not found.' })
  const age = patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)) : null

  let conditions = [...(declaredConditions || [])]
  let directCodes = {}
  if (consentHistoryShared) {
    const { data: records } = await supabase.from('medical_records')
      .select('diagnosis, icd10_code').eq('patient_id', patientId).not('diagnosis', 'is', null)
      .order('date_of_record', { ascending: false }).limit(15)
    conditions = [...conditions, ...new Set((records || []).map(r => r.diagnosis).filter(Boolean))]
    for (const r of records || []) {
      if (r.diagnosis && r.icd10_code) directCodes[r.diagnosis.trim().toLowerCase()] = r.icd10_code
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const { data: plans } = await supabase.from('insurance_plans')
    .select('id, plan_name, company_name, covered_conditions, covered_categories, pre_existing_condition_policy, insurer_flags, requires_agent, sponsored, sponsored_until, self_serve_only, insurance_plan_pricing_tiers(*)')
    .eq('status', 'active')

  const eligiblePlans = (plans || []).filter(p => !p.self_serve_only || (p.sponsored && p.sponsored_until && p.sponsored_until >= todayStr))

  // Dual mechanism (aq2-03) - resolved once across every candidate plan's
  // own coverage list, real assigned consultation codes taking priority
  // over a keyword guess.
  const allTerms = [...conditions, ...eligiblePlans.flatMap(p => [...(p.covered_conditions || []), ...(p.insurer_flags || [])])]
  const codes = { ...codeMapToObject(await resolveManyIcd10(supabase, allTerms)), ...directCodes }

  const matches = eligiblePlans
    .map(p => ({ plan: p, result: matchPlanSuitability({ plan: p, patientAge: age, conditions, declaredCodes: codes, coveredCodes: codes, flagCodes: codes }) }))
    .filter(({ result }) => result.verdict === 'approved')
    .map(({ plan, result }) => ({
      planId: plan.id, planName: plan.plan_name, companyName: plan.company_name,
      requiresAgent: !!plan.requires_agent, quotedPremium: result.quotedPremium,
    }))
    .sort((a, b) => (a.quotedPremium ?? Infinity) - (b.quotedPremium ?? Infinity))

  return res.status(200).json({ status: 'OK', matches, checkedCount: eligiblePlans.length })
}
