// pages/api/v1/decide_claim.js
// ─────────────────────────────────────────────────────────────────────────────
// The real, missing inbound half of the claims flow. push_claim.js already
// sends a claim's data OUT to an insurer's own system (claims_webhook_url);
// this is how their decision comes back IN. Medsa never computes or
// influences the decision itself - this route only records what the
// insurer's own system (or staff, via the manual fallback UI - see
// InsuranceAdminClaimsLog's new Approve/Decline actions) already decided,
// same "flag and relay, don't adjudicate" boundary as everywhere else in
// this codebase. Same auth pattern as every other public insurer API route
// (eligibility.js, adjudicate.js) - a key scoped to one insurer via
// api_clients.insurer_company_name, so an insurer can only ever decide
// claims against their own plans, never another insurer's.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { authenticateApiClient, logApiUsage } from '../../../lib/apiAuth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// 'rejected', not 'declined' - matching the term the existing manual
// decision UI (AgentClaimView, InsuranceAdminClaimsLog) already uses for
// this exact status, so an API-decided and a manually-decided claim read
// identically everywhere else in the app.
const VALID_DECISIONS = ['approved', 'partially_approved', 'rejected']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { client, error: authError } = await authenticateApiClient(req)
  if (authError) return res.status(401).json({ error: authError })
  if (!client.insurer_company_name) {
    logApiUsage(client.id, 'decide_claim', 403)
    return res.status(403).json({ error: 'This API key has no insurer scoping configured - contact Medsa admin.' })
  }

  const { claimRef, decision, approvedAmountHkd, reason, decidedBy } = req.body || {}
  if (!claimRef) {
    logApiUsage(client.id, 'decide_claim', 400)
    return res.status(400).json({ error: 'claimRef is required' })
  }
  if (!VALID_DECISIONS.includes(decision)) {
    logApiUsage(client.id, 'decide_claim', 400)
    return res.status(400).json({ error: `decision must be one of: ${VALID_DECISIONS.join(', ')}` })
  }

  // Scoped to this API key's own insurer the same way push_claim.js and
  // InsuranceAdminClaimsLog already scope a claims view - an insurer's key
  // must never be able to decide another insurer's claim just by guessing
  // its claim_ref.
  const { data: claim } = await supabase.from('insurance_claims')
    .select('id, status, insurance_plans!inner(company_name)')
    .eq('claim_ref', claimRef).eq('insurance_plans.company_name', client.insurer_company_name).maybeSingle()
  if (!claim) {
    logApiUsage(client.id, 'decide_claim', 404)
    return res.status(404).json({ error: 'Claim not found for this insurer.' })
  }
  // A claim already settled is closed - a later decision call (e.g. a
  // retried webhook) should never silently reopen or overwrite it.
  if (claim.status === 'settled') {
    logApiUsage(client.id, 'decide_claim', 409)
    return res.status(409).json({ error: 'This claim has already been settled and can no longer be decided.' })
  }

  const update = {
    status: decision,
    decided_at: new Date().toISOString(),
    decision_by: decidedBy || client.name || 'Insurer API',
  }
  if (decision !== 'rejected' && approvedAmountHkd != null) update.insurer_covered_amount = approvedAmountHkd
  if (decision === 'rejected' && reason) update.rejection_reason = reason

  await supabase.from('insurance_claims').update(update).eq('id', claim.id)

  logApiUsage(client.id, 'decide_claim', 200)
  return res.status(200).json({ ok: true, claimRef, status: decision })
}
