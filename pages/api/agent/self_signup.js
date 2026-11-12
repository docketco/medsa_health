// pages/api/agent/self_signup.js
// ─────────────────────────────────────────────────────────────────────────────
// Self-service agent signup - an agent isn't necessarily affiliated with
// any one insurer anymore (see My Insurers, components/agent/AgentApp.jsx),
// so account creation itself no longer needs to start from an insurer/team
// portal onboarding them. A real registry DOES exist to back the claimed
// license number against - the HK Insurance Authority's own public
// Register of Licensed Insurance Intermediaries (iir.ia.org.hk) - but it
// has no public API, so this can't auto-verify; it inserts the account as
// verification_status='pending' and leaves the actual lookup to Medsa
// staff (medsa-admin's Agent Verification tab), same propose-then-review
// shape as every other self-serve submission this build. Starts
// agent_type='independent' with no institution - insurer appointments
// come afterward via My Insurers, approved by that insurer themselves.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function generateMedsaId(prefix) {
  return `${prefix}-${Math.floor(10000 + Math.random() * 89999)}-HK`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { fullName, email, phone, licenseNumber, password, licenseProofPath } = req.body || {}
  if (!fullName?.trim() || !email?.trim() || !licenseNumber?.trim() || !password) {
    return res.status(400).json({ status: 'ERROR', message: 'fullName, email, licenseNumber and password are required.' })
  }

  const { data: existing } = await supabase.from('agents').select('id').ilike('email', email.trim()).maybeSingle()
  if (existing) return res.status(400).json({ status: 'ERROR', message: 'An agent account already exists for this email.' })

  const { data: created, error: insErr } = await supabase.from('agents').insert({
    full_name: fullName.trim(), email: email.trim(), phone: phone?.trim() || null,
    license_number: licenseNumber.trim(), license_proof_path: licenseProofPath || null,
    agent_type: 'independent', institution_id: null,
    verification_status: 'pending',
    medsa_id: generateMedsaId('AGT'),
  }).select('id').maybeSingle()
  if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })

  const { error: pwErr } = await supabase.rpc('set_agent_password', { p_agent_id: created.id, p_new_password: password })
  if (pwErr) return res.status(500).json({ status: 'ERROR', message: `Account created but password could not be set: ${pwErr.message}` })

  return res.status(200).json({ status: 'OK', agentId: created.id })
}
