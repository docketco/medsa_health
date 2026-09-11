// pages/api/insurer/verify_policy.js
// ─────────────────────────────────────────────────────────────────────────────
// Server-side bridge for 'api'-mode policy verification (see
// insuranceAdapter.js's _verifyPolicyAgainstInsurer). Exists because
// verification_api_key is a locked-down credential the browser can never
// read - lib/insuranceAdapter.js runs both client-side (ClinicOps,
// PractitionerApp) and inside pages/api/v1/*.js, always against the plain
// anon Supabase client, so it has no way to read that key itself. This
// route holds the service-role key needed to read it and makes the actual
// outbound call to the insurer's own endpoint.
//
// Contract with the insurer's endpoint: POST { policyNumber, hkid },
// expects back JSON with a `valid` or `eligible` boolean (either name
// accepted, since real insurer APIs won't agree on naming) and optionally
// `planName`. An insurer's endpoint being down or slow never hard-fails a
// real claim - see the try/catch below, same philosophy as every other
// integration in this app (Twilio, Resend, Stripe) failing soft.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { companyId, policyNumber, hkid } = req.body || {}
  if (!companyId) return res.status(400).json({ error: 'companyId is required.' })
  if (!policyNumber && !hkid) return res.status(400).json({ error: 'policyNumber or hkid is required.' })

  const { data: company } = await supabase.from('insurance_companies')
    .select('verification_mode, verification_api_url, verification_api_key').eq('id', companyId).maybeSingle()
  if (!company || company.verification_mode !== 'api' || !company.verification_api_url) {
    // Not configured for API verification - "checked: false" tells the
    // adapter to skip rather than block, same as no company row at all.
    return res.status(200).json({ checked: false, verified: true })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(company.verification_api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(company.verification_api_key ? { Authorization: `Bearer ${company.verification_api_key}` } : {}),
      },
      body: JSON.stringify({ policyNumber: policyNumber || null, hkid: hkid || null }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!response.ok) return res.status(200).json({ checked: false, verified: true })
    const json = await response.json()
    const verified = json.valid === true || json.eligible === true
    return res.status(200).json({ checked: true, verified, planName: json.planName || null })
  } catch (err) {
    // Network failure/timeout on the insurer's side - not something a
    // real claim should get rejected over.
    return res.status(200).json({ checked: false, verified: true })
  }
}
