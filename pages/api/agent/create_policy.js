// pages/api/agent/create_policy.js
// ─────────────────────────────────────────────────────────────────────────────
// Real gap found live-testing (ag-02): an agent's own basket already
// filters out plans their team isn't authorized to sell (hi-05), but that
// filter was UI-only - NewPolicyScreen.handleSave inserted straight into
// agent_policies from the browser, and agent_policies' own RLS policy is
// anon_full_access (USING true/WITH CHECK true), the same open posture as
// the rest of this app. The "search any other plan by name" escape hatch
// made this trivially reachable even by accident: typing a team-gated
// plan's exact name there skipped the basket filter entirely, with
// nothing underneath to stop it.
//
// This endpoint is the actual enforcement point - every policy an agent
// issues now has to pass through here, which re-derives the agent's team
// from their own agent_id server-side (never trusts a client-supplied
// team id) and checks each line item's plan against
// team_plan_authorizations exactly the same way the basket/queue screens
// already read it: a plan with no rows there at all is ungated (anyone at
// the company can sell it), a plan WITH rows can only be sold by a member
// of one of those teams. No real Supabase Auth session exists in this
// app (just the custom agents table + an app-layer password check), so
// "server-side" here means "the browser can no longer just skip the
// check by calling a different button" - the same trust boundary every
// other API route in this codebase already draws.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const {
    agentId, patientId, patientName, lineItems, bundleDiscountHkd,
    policyNumber, status, startDate, renewalDate, inquiryId,
    brokerCommissionHkd, referralFeeHkd, wardClass, paymentFrequency, healthDeclarationAcknowledged,
  } = req.body || {}

  if (!agentId) return res.status(400).json({ status: 'ERROR', message: 'agentId is required.' })
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ status: 'ERROR', message: 'Add at least one real plan first - from your basket or by searching.' })
  }

  const { data: agent } = await supabase.from('agents').select('id, team_id').eq('id', agentId).maybeSingle()
  if (!agent) return res.status(404).json({ status: 'ERROR', message: 'Agent not found.' })

  const planIds = [...new Set(lineItems.map(l => l.planId).filter(Boolean))]
  if (planIds.length !== lineItems.length) {
    return res.status(400).json({ status: 'ERROR', message: 'Every line item needs a real plan_id - nothing here can be typed into existence.' })
  }
  const { data: auths } = await supabase.from('team_plan_authorizations').select('plan_id, team_id').in('plan_id', planIds)
  const authTeamsByPlan = {}
  for (const a of (auths || [])) (authTeamsByPlan[a.plan_id] ||= []).push(a.team_id)

  for (const li of lineItems) {
    const authTeams = authTeamsByPlan[li.planId]
    const isTeamGated = authTeams && authTeams.length > 0
    if (isTeamGated && !(agent.team_id && authTeams.includes(agent.team_id))) {
      return res.status(403).json({ status: 'ERROR', message: `"${li.planName}" is restricted to specific teams by its insurer - your team isn't authorized to sell it.` })
    }
  }

  try {
    let bundleId = null
    if (lineItems.length > 1) {
      const { data: bundle, error: bErr } = await supabase.from('policy_bundles').insert({
        agent_id: agentId, patient_id: patientId || null, patient_name: patientName,
        discount_hkd: bundleDiscountHkd || 0, notes: null,
      }).select().maybeSingle()
      if (bErr) throw bErr
      bundleId = bundle.id
    }

    const createdPolicyIds = []
    for (const li of lineItems) {
      const { data: pol, error: pErr } = await supabase.from('agent_policies').insert({
        agent_id: agentId, institution_id: li.institutionId, patient_id: patientId || null,
        patient_name: patientName, plan_name: li.planName, plan_id: li.planId,
        policy_number: policyNumber || null, status, premium: li.premium, deductible_hkd: li.deductibleHkd,
        start_date: startDate || null, renewal_date: renewalDate || null, bundle_id: bundleId,
        inquiry_id: inquiryId || null,
        broker_commission_hkd: inquiryId && brokerCommissionHkd != null ? brokerCommissionHkd : null,
        referral_fee_hkd: inquiryId && referralFeeHkd != null ? referralFeeHkd : null,
        ward_class: wardClass || null, payment_frequency: paymentFrequency,
        health_declaration_acknowledged_at: healthDeclarationAcknowledged ? new Date().toISOString() : null,
      }).select().maybeSingle()
      if (pErr) throw pErr
      createdPolicyIds.push(pol.id)
      if (li.riderIds?.length > 0) {
        await supabase.from('agent_policy_riders').insert(li.riderIds.map(riderId => ({ policy_id: pol.id, rider_id: riderId })))
      }
    }
    return res.status(200).json({ status: 'OK', policyIds: createdPolicyIds, bundleId })
  } catch (e) {
    return res.status(500).json({ status: 'ERROR', message: e.message })
  }
}
