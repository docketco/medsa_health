// pages/api/insurer/set_verification_config.js
// ─────────────────────────────────────────────────────────────────────────────
// Lets an insurer (partnered or not) tell Medsa how to check a submitted
// policy number against their own real records - without needing a full
// adjudication partnership. See the add_insurer_policy_verification
// migration for the two modes ('roster' upload, or 'api' lookup).
// verification_api_key is a real credential, locked down the same way
// institutions.mims_api_key is - anon has no SELECT/INSERT/UPDATE on it at
// all, so writing it goes through here with a privileged key that never
// reaches the browser.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { companyId, verificationMode, verificationApiUrl, verificationApiKey } = req.body || {}
  if (!companyId) return res.status(400).json({ error: 'companyId is required.' })
  if (!['none', 'roster', 'api'].includes(verificationMode)) {
    return res.status(400).json({ error: 'verificationMode must be none, roster, or api.' })
  }

  const { data: company } = await supabase.from('insurance_companies').select('id, status').eq('id', companyId).maybeSingle()
  if (!company || company.status !== 'active') {
    return res.status(403).json({ error: 'No active insurer account matches this company.' })
  }

  const payload = { verification_mode: verificationMode }
  if (verificationMode === 'api') {
    if (!verificationApiUrl?.trim()) return res.status(400).json({ error: 'verificationApiUrl is required for API mode.' })
    payload.verification_api_url = verificationApiUrl.trim()
    // Blank key on an update means "keep the existing one" - re-typing a
    // real secret every time the insurer just wants to change the URL
    // would be a bad flow, and there's no way to show them the current
    // value back (it's never read out to the browser).
    if (verificationApiKey?.trim()) payload.verification_api_key = verificationApiKey.trim()
  } else {
    payload.verification_api_url = null
    payload.verification_api_key = null
  }

  const { error } = await supabase.from('insurance_companies').update(payload).eq('id', companyId)
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
