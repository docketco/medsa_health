// pages/api/insurer/set_claims_plugin_config.js
// ─────────────────────────────────────────────────────────────────────────────
// Lets a paid-tier insurer (partnered or TPA-only) tell Medsa where to push
// patient-uploaded unverified claim receipts, so they land directly in
// whatever system the insurer already uses to check them (their own
// MediConCen connection, in most cases) instead of only being read inside
// the Medsa dashboard. claims_webhook_key is a real credential, locked down
// the same way verification_api_key is - never readable by anon/authenticated,
// so writing it goes through here with the privileged service-role key.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { companyId, claimsWebhookUrl, claimsWebhookKey } = req.body || {}
  if (!companyId) return res.status(400).json({ error: 'companyId is required.' })

  const { data: company } = await supabase.from('insurance_companies')
    .select('id, status, claims_plugin_enabled').eq('id', companyId).maybeSingle()
  if (!company || company.status !== 'active') {
    return res.status(403).json({ error: 'No active insurer account matches this company.' })
  }
  if (!company.claims_plugin_enabled) {
    return res.status(403).json({ error: 'Claims plug-in is not enabled on this account yet.' })
  }
  if (!claimsWebhookUrl?.trim()) return res.status(400).json({ error: 'claimsWebhookUrl is required.' })

  const payload = { claims_webhook_url: claimsWebhookUrl.trim() }
  // Blank key on an update means "keep the existing one" - there's no way
  // to show the current value back, since it's never read out to the browser.
  if (claimsWebhookKey?.trim()) payload.claims_webhook_key = claimsWebhookKey.trim()

  const { error } = await supabase.from('insurance_companies').update(payload).eq('id', companyId)
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
