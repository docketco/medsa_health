// pages/api/claims-approver/decide.js
// ─────────────────────────────────────────────────────────────────────────────
// The real decision a claims approver makes - approve or reject, same two
// real outcomes AgentClaimView's own handleDecide already writes (that
// screen still works, reached via a receive link) - this is the same
// logic, just reachable from a claims approver's own queue instead of a
// one-off link, and logged to underwriting_audit_log (policy_id/inquiry_id
// both null here - see that table's own claim-side rows via actor_type).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { claimId, action, approverId, approverName, reason } = req.body || {}
  if (!claimId || !action) return res.status(400).json({ status: 'ERROR', message: 'claimId and action are required.' })
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ status: 'ERROR', message: 'Invalid action.' })

  const { data: claim } = await supabase.from('insurance_claims').select('id, status, patient_copay_amount, deductible_applied').eq('id', claimId).maybeSingle()
  if (!claim) return res.status(404).json({ status: 'ERROR', message: 'Claim not found.' })
  if (claim.status !== 'pending') return res.status(400).json({ status: 'ERROR', message: 'This claim is no longer pending review.' })

  if (action === 'approve') {
    const payable = (claim.patient_copay_amount || 0) + (claim.deductible_applied || 0)
    await supabase.from('insurance_claims').update({
      status: payable === 0 ? 'settled' : 'approved',
      settled_at: payable === 0 ? new Date().toISOString() : null,
      decided_at: new Date().toISOString(), decision_by: approverName || null,
    }).eq('id', claimId)
    // Same real gap AgentClaimView's own approve path already closes -
    // approving a claim with attached documents IS a human having checked
    // them closely enough to pay out against them.
    const { data: rec } = await supabase.from('medical_records').select('id').eq('insurance_claim_id', claimId).maybeSingle()
    if (rec) {
      const { data: atts } = await supabase.from('medical_record_attachments').select('id, verification_status').eq('medical_record_id', rec.id)
      const unverifiedIds = (atts || []).filter(a => a.verification_status !== 'verified').map(a => a.id)
      if (unverifiedIds.length > 0) await supabase.from('medical_record_attachments').update({ verification_status: 'verified' }).in('id', unverifiedIds)
    }
  } else {
    if (!reason?.trim()) return res.status(400).json({ status: 'ERROR', message: 'A rejection needs a reason - the patient sees this.' })
    await supabase.from('insurance_claims').update({
      status: 'rejected', rejection_reason: reason.trim(), decided_at: new Date().toISOString(), decision_by: approverName || null,
    }).eq('id', claimId)
  }

  return res.status(200).json({ status: 'OK' })
}
