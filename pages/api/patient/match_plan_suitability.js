// pages/api/patient/match_plan_suitability.js
// ─────────────────────────────────────────────────────────────────────────────
// Runs the same suitability/quote analysis for BOTH inquiry modes:
//   - mode:'auto'  - the patient's own "get details automatically" path,
//     no agent involved at all. The verdict/quote/summary this returns is
//     shown to the patient directly.
//   - mode:'agent' - the patient chose "talk to an agent" instead, but this
//     still runs so the agent who eventually claims the inquiry sees a
//     ready-made read instead of a blank lead (real workload reduction,
//     not just a label).
// The verdict and quote are always the deterministic rule engine in
// lib/planSuitability.js - AI (when ANTHROPIC_API_KEY is configured) only
// rewrites the summary into friendlier prose, exactly the same tiered
// pattern as suggest_icd10.js: real analysis first and always, AI as an
// optional polish layer that can never change the underlying answer.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { matchPlanSuitability } from '../../../lib/planSuitability'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function polishSummaryWithAI(ruleSummary, verdict, planName) {
  if (!process.env.ANTHROPIC_API_KEY) return { summary: ruleSummary, usedAI: false }
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 300,
      output_config: { effort: 'low' },
      system: 'Rewrite this insurance-plan suitability note for a patient in 2-3 short, warm, plain-language sentences. Do not change any fact, number, or the verdict - only make the wording clearer and friendlier. Do not add any information that is not already present.',
      messages: [{ role: 'user', content: `Verdict: ${verdict}\nPlan: ${planName}\nNote to rewrite:\n"""${ruleSummary}"""` }],
    })
    const text = response.content.find(b => b.type === 'text')?.text?.trim()
    if (!text) return { summary: ruleSummary, usedAI: false }
    return { summary: text, usedAI: true }
  } catch (e) {
    return { summary: ruleSummary, usedAI: false }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { patientId, planId, declaredConditions, consentHistoryShared, mode } = req.body || {}
  if (!patientId || !planId) return res.status(400).json({ status: 'ERROR', message: 'patientId and planId are required.' })
  if (!['auto', 'agent'].includes(mode)) return res.status(400).json({ status: 'ERROR', message: "mode must be 'auto' or 'agent'." })

  const { data: plan } = await supabase.from('insurance_plans')
    .select('id, plan_name, company_name, covered_conditions, covered_categories, pre_existing_condition_policy, waiting_period_days, requires_agent, insurance_plan_pricing_tiers(*)')
    .eq('id', planId).maybeSingle()
  if (!plan) return res.status(404).json({ status: 'ERROR', message: 'Plan not found.' })
  if (mode === 'auto' && plan.requires_agent) {
    return res.status(400).json({ status: 'ERROR', message: 'This plan is agent-only - the insurer has not enabled automated quotes for it.' })
  }

  const { data: patient } = await supabase.from('patients')
    .select('full_name, hkid, date_of_birth, phone, email').eq('id', patientId).maybeSingle()
  if (!patient) return res.status(404).json({ status: 'ERROR', message: 'Patient not found.' })
  const age = patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)) : null

  // Consent-gated: only ever reads this patient's own diagnosis history when
  // they explicitly opted in for this specific inquiry - declared conditions
  // alone are always used regardless of consent.
  let historyConditions = []
  if (consentHistoryShared) {
    const { data: records } = await supabase.from('medical_records')
      .select('diagnosis').eq('patient_id', patientId).not('diagnosis', 'is', null)
      .order('created_at', { ascending: false }).limit(15)
    historyConditions = [...new Set((records || []).map(r => r.diagnosis).filter(Boolean))]
  }
  const allConditions = [...new Set([...(declaredConditions || []), ...historyConditions])]

  const result = matchPlanSuitability({ plan, patientAge: age, conditions: allConditions })
  const { summary, usedAI } = await polishSummaryWithAI(result.summary, result.verdict, plan.plan_name)

  const inquiryPayload = {
    patient_id: patientId, plan_id: planId,
    applicant_full_name: patient.full_name || null, applicant_hkid: patient.hkid || null,
    applicant_dob: patient.date_of_birth || null, applicant_phone: patient.phone || null,
    applicant_email: patient.email || null, consent_given: true, consent_given_at: new Date().toISOString(),
    status: 'new', mode,
    consent_history_shared_at: consentHistoryShared ? new Date().toISOString() : null,
    declared_conditions: declaredConditions || [],
    suitability_verdict: result.verdict, suitability_summary: summary,
    quoted_premium_hkd: result.quotedPremium, used_ai: usedAI,
  }
  const { data: inquiry, error: insErr } = await supabase.from('plan_inquiries').insert(inquiryPayload).select('id').maybeSingle()
  if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })

  return res.status(200).json({
    status: 'OK', inquiryId: inquiry.id,
    verdict: result.verdict, summary, quotedPremium: result.quotedPremium, usedAI,
  })
}
