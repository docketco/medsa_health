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
  const { patientId, planId, declaredConditions, consentHistoryShared, isSwitchRequest, message, mode: requestedMode } = req.body || {}
  // Replacing a plan already held is never an automated, self-service
  // purchase - the Insurance Authority's own guideline on policy
  // replacement (GL27) exists specifically because a switch can leave a
  // patient worse off (lost benefits, a new waiting period) in a way an
  // agent needs to walk through, not something a rule engine should
  // wave through on its own.
  const mode = isSwitchRequest ? 'agent' : requestedMode
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

  // The verdict/quote that gets shown to the patient (both modes) or
  // acted on automatically is driven ONLY by what was actually declared -
  // a deliberate call after live testing showed visit-history free text
  // (real consultation notes, not a clean conditions list) flooding the
  // automated verdict with noise no patient actually claimed. Consented
  // visit history still gets pulled and matched, but only ever as
  // read-only context attached for an agent to review - it can flag a
  // "talk to an agent" inquiry for a closer look, but it never flips an
  // automated quote on its own.
  const result = matchPlanSuitability({ plan, patientAge: age, conditions: declaredConditions || [] })
  const { summary, usedAI } = await polishSummaryWithAI(result.summary, result.verdict, plan.plan_name)

  // Real gap found live-testing: an agent had no way to actually review a
  // patient's consented visit history for an inquiry - only a computed
  // summary sentence, never the real entries it came from. The patient
  // consented specifically to this (the checkbox says exactly this: let
  // Medsa check visit history against this plan), so the claiming agent
  // gets the real snapshot, not just a derived note.
  let historyContextSummary = null
  let historyRecordsSnapshot = null
  if (consentHistoryShared) {
    const { data: records } = await supabase.from('medical_records')
      .select('diagnosis, date_of_record').eq('patient_id', patientId).not('diagnosis', 'is', null)
      .order('date_of_record', { ascending: false }).limit(15)
    if (records && records.length > 0) {
      historyRecordsSnapshot = records.map(r => ({ diagnosis: r.diagnosis, date: r.date_of_record }))
    }
    const historyConditions = [...new Set((records || []).map(r => r.diagnosis).filter(Boolean))]
    if (historyConditions.length > 0) {
      const historyRead = matchPlanSuitability({ plan, patientAge: age, conditions: historyConditions })
      if (historyRead.excludedConditions.length > 0 || historyRead.uncoveredConditions.length > 0) {
        historyContextSummary = `From the patient's consented visit history (not self-declared, for review only): ${historyRead.summary}`
      }
    }
  }

  const inquiryPayload = {
    patient_id: patientId, plan_id: planId,
    applicant_full_name: patient.full_name || null, applicant_hkid: patient.hkid || null,
    applicant_dob: patient.date_of_birth || null, applicant_phone: patient.phone || null,
    applicant_email: patient.email || null, consent_given: true, consent_given_at: new Date().toISOString(),
    status: 'new', mode, is_switch_request: !!isSwitchRequest,
    consent_history_shared_at: consentHistoryShared ? new Date().toISOString() : null,
    declared_conditions: declaredConditions || [],
    suitability_verdict: result.verdict, suitability_summary: summary,
    quoted_premium_hkd: result.quotedPremium, used_ai: usedAI,
    history_context_summary: historyContextSummary, history_records_snapshot: historyRecordsSnapshot,
  }
  const { data: inquiry, error: insErr } = await supabase.from('plan_inquiries').insert(inquiryPayload).select('id').maybeSingle()
  if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })

  // Seeds the same inquiry_messages thread the agent side (and the
  // patient's own My Inquiries tab) already read/write to, so a
  // question asked up front isn't lost waiting for someone to claim
  // this and start the thread themselves.
  if (message && message.trim()) {
    await supabase.from('inquiry_messages').insert({
      inquiry_id: inquiry.id, sender_type: 'patient', sender_name: patient.full_name || null,
      body: message.trim(),
    })
  }

  return res.status(200).json({
    status: 'OK', inquiryId: inquiry.id,
    verdict: result.verdict, summary, quotedPremium: result.quotedPremium, usedAI,
  })
}
