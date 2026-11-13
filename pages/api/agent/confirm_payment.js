// pages/api/agent/confirm_payment.js
// ─────────────────────────────────────────────────────────────────────────────
// The real third step in the quote → underwriter → active lifecycle, per
// your call: in real life the agent is the one who delivers the
// underwriting outcome to the client AND collects the premium (the
// insurer never deals with the client directly at this stage) - so this
// is the agent's own action, not an automatic flip the moment the
// underwriter approves. A policy sits status='quote' with
// underwriter_status='approved' ("approved, awaiting payment") until this
// runs - this is the ONLY place status ever becomes 'active'.
// Reuses premium_paid_at (already on agent_policies, previously only set
// by the self-serve Stripe auto-purchase path in lib/completeAutoPurchase.js)
// rather than adding a new column - same real meaning, different payment
// method (agent-collected, not card-on-file).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { pushPolicyToInsurer } from '../../../lib/pushPolicyToInsurer'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { policyId, agentId } = req.body || {}
  if (!policyId || !agentId) return res.status(400).json({ status: 'ERROR', message: 'policyId and agentId are required.' })

  const { data: policy } = await supabase.from('agent_policies')
    .select('id, agent_id, inquiry_id, plan_name, status, underwriter_status').eq('id', policyId).maybeSingle()
  if (!policy) return res.status(404).json({ status: 'ERROR', message: 'Policy not found.' })
  if (policy.agent_id !== agentId) return res.status(403).json({ status: 'ERROR', message: "This isn't your policy to confirm." })
  if (policy.underwriter_status !== 'approved') return res.status(400).json({ status: 'ERROR', message: 'This policy needs underwriter approval before payment can be confirmed.' })
  if (policy.status === 'active') return res.status(400).json({ status: 'ERROR', message: 'Already active.' })

  const nowIso = new Date().toISOString()
  const { data: updated } = await supabase.from('agent_policies').update({
    status: 'active', premium_paid_at: nowIso,
  }).eq('id', policyId).eq('status', 'quote').select('id')
  if (!updated || updated.length === 0) return res.status(409).json({ status: 'ERROR', message: 'Someone else already confirmed this.' })

  if (policy.inquiry_id) {
    await supabase.from('inquiry_messages').insert({
      inquiry_id: policy.inquiry_id, sender_type: 'agent', sender_name: 'System',
      body: `✓ Payment received - your policy for ${policy.plan_name} is now active.`,
      read_by_patient: false, read_by_agent: false,
    })
  }
  await pushPolicyToInsurer(supabase, policyId, 'payment_confirmed').catch(()=>{})

  return res.status(200).json({ status: 'OK' })
}
