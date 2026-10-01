// pages/api/patient/match_plan_suitability.js
// ─────────────────────────────────────────────────────────────────────────────
// Runs the same suitability/quote analysis for BOTH inquiry modes:
//   - mode:'auto'  - the patient's own "quote immediately" path.
//   - mode:'agent' - the patient chose "talk to an agent" instead, but this
//     still runs FIRST, before the agent ever sees the inquiry - the agent
//     works from the same verdict the automated path would produce, never
//     collects raw history directly.
// The verdict is always the deterministic 3-way matching engine in
// lib/planSuitabilityMatch.js (approved / declined / flagged) - no AI
// anywhere in this flow, on either path, regardless of whether an AI key
// is configured. Only the FLAGGED bucket ever needs a human, and that
// human is the insurer's own underwriter, not the agent (see
// pages/api/underwriter/*.js) - an agent only ever sees the verdict and,
// if flagged, a generic category label, never the raw declared answers or
// the consented visit history behind them.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { matchPlanSuitability } from '../../../lib/planSuitabilityMatch'
import { resolveManyIcd10, codeMapToObject } from '../../../lib/icd10Match'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const DECLARATION_VALIDITY_DAYS = 30

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { patientId, planId, declaredConditions, consentHistoryShared, isSwitchRequest, message, mode: requestedMode, wardClass, paymentFrequency } = req.body || {}
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
    .select('id, plan_name, company_name, covered_conditions, covered_categories, pre_existing_condition_policy, waiting_period_days, requires_agent, insurer_flags, additional_terms, auto_buy_on_clean, insurance_plan_pricing_tiers(*)')
    .eq('id', planId).maybeSingle()
  if (!plan) return res.status(404).json({ status: 'ERROR', message: 'Plan not found.' })
  if (mode === 'auto' && plan.requires_agent) {
    return res.status(400).json({ status: 'ERROR', message: 'This plan is agent-only - the insurer has not enabled automated quotes for it.' })
  }

  const { data: patient } = await supabase.from('patients')
    .select('full_name, hkid, date_of_birth, phone, email').eq('id', patientId).maybeSingle()
  if (!patient) return res.status(404).json({ status: 'ERROR', message: 'Patient not found.' })
  const age = patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)) : null

  // Declared answers are the primary signal. Consented visit history (if
  // shared) is folded into the SAME deterministic screen, not shown as a
  // separate text blob anywhere - a condition that turns up in real
  // consultation history is checked against the plan exactly the same way
  // a self-declared one is, and can only ever make the verdict more
  // cautious (approved -> flagged/declined), never less.
  let historyConditions = []
  let directCodes = {}
  if (consentHistoryShared) {
    const { data: records } = await supabase.from('medical_records')
      .select('diagnosis, icd10_code').eq('patient_id', patientId).not('diagnosis', 'is', null)
      .order('date_of_record', { ascending: false }).limit(15)
    historyConditions = [...new Set((records || []).map(r => r.diagnosis).filter(Boolean))]
    // A real consultation's own assigned code (when a doctor added one) is
    // more trustworthy than a keyword guess - takes priority below.
    for (const r of records || []) {
      if (r.diagnosis && r.icd10_code) directCodes[r.diagnosis.trim().toLowerCase()] = r.icd10_code
    }
  }

  // Dual mechanism (aq2-03): resolve every term that could plausibly need
  // an ICD-10 comparison - declared conditions, history, and the plan's
  // own covered_conditions/insurer_flags - in one batch, real assigned
  // codes from medical_records taking priority over a keyword guess. Not
  // every term will resolve (a plan's free-text list often won't) - that's
  // expected, matchPlanSuitability falls back to text matching per term.
  const allTerms = [...(declaredConditions || []), ...historyConditions, ...(plan.covered_conditions || []), ...(plan.insurer_flags || [])]
  const resolved = codeMapToObject(await resolveManyIcd10(supabase, allTerms))
  const codes = { ...resolved, ...directCodes }

  // One call handles both sources - matchPlanSuitability itself only
  // lets a DECLARED condition auto-decline; a history-pulled one (not
  // something the patient affirmatively claimed applies here) can only
  // ever flag, so a clean declared-only read still can't hide something
  // consented history turns up, without letting old/irrelevant visit
  // history auto-decline someone on its own.
  const result = matchPlanSuitability({ plan, patientAge: age, conditions: declaredConditions || [], historyConditions, declaredCodes: codes, coveredCodes: codes, flagCodes: codes })

  const expiresAt = new Date(Date.now() + DECLARATION_VALIDITY_DAYS * 24 * 3600 * 1000).toISOString()

  const inquiryPayload = {
    patient_id: patientId, plan_id: planId,
    applicant_full_name: patient.full_name || null, applicant_hkid: patient.hkid || null,
    applicant_dob: patient.date_of_birth || null, applicant_phone: patient.phone || null,
    applicant_email: patient.email || null, consent_given: true, consent_given_at: new Date().toISOString(),
    status: 'new', mode, is_switch_request: !!isSwitchRequest,
    consent_history_shared_at: consentHistoryShared ? new Date().toISOString() : null,
    declared_conditions: declaredConditions || [],
    suitability_verdict: result.verdict, suitability_summary: result.summary,
    flag_category: result.flagCategory,
    quoted_premium_hkd: result.quotedPremium, used_ai: false,
    declaration_expires_at: expiresAt,
    // A clean verdict still waits for a quick human sign-off before buying
    // when the insurer hasn't opted into auto-buy (aq2-19) - reuses the
    // same underwriter_status field/queue as a real flagged case, just
    // distinguished by suitability_verdict so the reviewing screen can
    // show "clean, just needs sign-off" separately from a real review.
    underwriter_status: result.verdict === 'flagged' || (result.verdict === 'approved' && !plan.auto_buy_on_clean) ? 'pending' : null,
    // Same ward class / payment frequency the automated-purchase path
    // already collects - carried through here too (agent mode only, see
    // the patient-side form) so NewPolicyScreen can pre-fill them instead
    // of asking the patient again for something they already answered.
    ward_class: wardClass || null, payment_frequency: paymentFrequency || null,
  }
  const { data: inquiry, error: insErr } = await supabase.from('plan_inquiries').insert(inquiryPayload).select('id').maybeSingle()
  if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })

  // Logs every auto-decision, not just flagged ones - an insurer's audit
  // log (medsa-admin, aq2-16) should show what the matching engine
  // actually decided on its own, including the clean approvals/declines
  // it never needed a human for, not only the cases that went to one.
  await supabase.from('underwriting_audit_log').insert({
    inquiry_id: inquiry.id, actor_type: 'system', actor_name: 'Matching engine',
    action: result.verdict, detail: result.verdict === 'flagged' ? result.flagCategory : result.summary,
  })

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
    verdict: result.verdict, flagCategory: result.flagCategory, summary: result.summary,
    quotedPremium: result.quotedPremium, autoBuyOnClean: !!plan.auto_buy_on_clean,
    underwriterPending: inquiryPayload.underwriter_status === 'pending',
    waitingPeriodDays: plan.waiting_period_days, preExistingConditionPolicy: plan.pre_existing_condition_policy,
    additionalTerms: plan.additional_terms, declarationExpiresAt: expiresAt,
  })
}
