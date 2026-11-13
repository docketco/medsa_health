// pages/api/agent/push_policy.js
// ─────────────────────────────────────────────────────────────────────────────
// Manual trigger for the shared pushPolicyToInsurer (lib/pushPolicyToInsurer.js)
// - kept as a real button on Policies for a retry (the insurer's endpoint
// was down, or they only just configured their webhook) even though the
// same push now also fires automatically at submission, underwriter
// decision, and payment confirmation. Medsa never decides anything here -
// underwriting (whether the insurer accepts this applicant) and where the
// money actually lives stay entirely on the insurer's side; this just
// relays what the agent entered, same "flag and route, don't adjudicate"
// boundary as every other insurer-facing route in this app.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { pushPolicyToInsurer } from '../../../lib/pushPolicyToInsurer'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { policyId } = req.body || {}
  if (!policyId) return res.status(400).json({ error: 'policyId is required.' })

  try {
    await pushPolicyToInsurer(supabase, policyId, 'new_policy')
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Could not reach the insurer endpoint.' })
  }
}
