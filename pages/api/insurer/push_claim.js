// pages/api/insurer/push_claim.js
// ─────────────────────────────────────────────────────────────────────────────
// Server-side bridge that pushes one patient-uploaded, Medsa-unverified claim
// receipt into a paid-tier insurer's own system (their claims_webhook_url),
// so they can run it through their own verification (e.g. MediConCen)
// instead of only seeing it read-only in the Medsa dashboard. Medsa never
// verifies the receipt itself and never calculates a payout for it - this
// route only forwards what the patient submitted plus short-lived signed
// links to the files, exactly the same "flag and route, don't adjudicate"
// boundary already documented for out-of-network claims elsewhere in this
// app. Mirrors verify_policy.js's fail-soft-on-network-error shape, but a
// failure here is surfaced to the insurer's admin (via the returned error)
// rather than silently treated as success, since this is an outbound push
// they explicitly asked for, not an inbound check a real claim is waiting on.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { companyId, claimId } = req.body || {}
  if (!companyId || !claimId) return res.status(400).json({ error: 'companyId and claimId are required.' })

  const { data: company } = await supabase.from('insurance_companies')
    .select('claims_plugin_enabled, claims_webhook_url, claims_webhook_key').eq('id', companyId).maybeSingle()
  if (!company?.claims_plugin_enabled || !company.claims_webhook_url) {
    return res.status(403).json({ error: 'Claims plug-in is not configured on this account.' })
  }

  const { data: company2 } = await supabase.from('insurance_companies').select('name').eq('id', companyId).maybeSingle()
  // Claims are scoped to a company via their plan's company_name, same
  // filter InsuranceAdminClaimsLog already uses to load this insurer's list.
  const { data: realClaim } = await supabase.from('insurance_claims')
    .select('id, claim_ref, amount, submitted_at, patients(full_name, medsa_id), insurance_plans!inner(company_name)')
    .eq('id', claimId).eq('insurance_plans.company_name', company2?.name).maybeSingle()
  if (!realClaim) return res.status(404).json({ error: 'Claim not found.' })

  const { data: attachments } = await supabase.from('medical_record_attachments')
    .select('id, file_name, file_url, verification_status').eq('insurance_claim_id', claimId)

  const documents = []
  for (const att of attachments || []) {
    const { data: signed } = await supabase.storage.from('patient-uploaded-records').createSignedUrl(att.file_url, 900)
    documents.push({ fileName: att.file_name, verificationStatus: att.verification_status, url: signed?.signedUrl || null })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(company.claims_webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(company.claims_webhook_key ? { Authorization: `Bearer ${company.claims_webhook_key}` } : {}),
      },
      body: JSON.stringify({
        claimRef: realClaim.claim_ref,
        patientName: realClaim.patients?.full_name || null,
        medsaId: realClaim.patients?.medsa_id || null,
        amountClaimedHkd: realClaim.amount || null,
        submittedAt: realClaim.submitted_at,
        verified: false,
        source: 'patient_unverified_upload',
        documents, // short-lived (15 min) signed links - re-push to refresh
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!response.ok) return res.status(502).json({ error: `Insurer endpoint returned ${response.status}.` })
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(502).json({ error: 'Could not reach the insurer endpoint (timeout or network error).' })
  }
}
