// pages/api/agent/create_policy.js
// ─────────────────────────────────────────────────────────────────────────────
// team_plan_authorizations enforcement REMOVED, per your call - the
// sales-team/branch feature it belongs to (TeamsAndAgents on the
// insurer-portal side, TeamLeadScreen on the agent side) is already fully
// shelved from both UIs, which left this as an orphaned restriction: old
// test rows (from before the shelve) could still block a real policy
// save with a confusing "your team isn't authorized" error, with no
// screen left anywhere for anyone to see, manage, or lift that
// restriction. Enforcing a gate nobody can administer any more isn't
// safer, it's just stuck. team_plan_authorizations itself stays real
// (frozen, not dropped) in case sales teams come back as a real feature
// later - this endpoint just stops reading it.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const {
    agentId, patientId, patientName, lineItems, bundleDiscountHkd,
    policyNumber, status, startDate, renewalDate, inquiryId,
    brokerCommissionHkd, referralFeeHkd, wardClass, paymentFrequency, healthDeclarationAcknowledged,
    // Real gap: nothing in this form ever collected the client's payment
    // details the insurer actually needs to set up premium collection
    // (direct debit, etc.) - per your call, Medsa stores this the way an
    // agent would keep a copy of a signed contract on file: for the
    // record and to relay to the insurer, never read or acted on by
    // Medsa's own matching/billing logic anywhere.
    payerBankName, payerAccountNumber, payerAccountHolderName,
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
        payer_bank_name: payerBankName || null, payer_account_number: payerAccountNumber || null,
        payer_account_holder_name: payerAccountHolderName || null,
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
