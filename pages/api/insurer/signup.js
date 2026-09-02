// pages/api/insurer/signup.js
// ─────────────────────────────────────────────────────────────────────────────
// Self-serve insurer signup - the two relationship tiers get genuinely
// different treatment here, not just a label:
//   - unpartnered: TPA-claims-only, no plan/client management. Low-stakes
//     enough to activate immediately with a temp password, same as
//     create_tpa_clinic.js does for out-of-network clinics.
//   - partnered: gets patient/client profile access and lists real plans -
//     real relationship, real contract. This only records the application
//     as 'pending' and issues no credentials; Medsa admin reaches out and
//     approves it (see /api/admin/approve_insurer.js) once a real
//     relationship is actually in place.
// Runs with the service-role key because insurance_companies' password
// column must never be set by a route the browser can call directly.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { companyName, contactName, contactEmail, contactPhone, relationshipType } = req.body || {}
  if (!companyName?.trim() || !contactEmail?.trim()) {
    return res.status(400).json({ status: 'ERROR', message: 'companyName and contactEmail are required.' })
  }
  if (!['partnered', 'unpartnered'].includes(relationshipType)) {
    return res.status(400).json({ status: 'ERROR', message: 'relationshipType must be partnered or unpartnered.' })
  }

  const { data: existing } = await supabase.from('insurance_companies')
    .select('id, status').ilike('contact_email', contactEmail.trim()).maybeSingle()
  if (existing) {
    return res.status(409).json({ status: 'ERROR', message: 'An application or account already exists for this email.' })
  }

  const isUnpartnered = relationshipType === 'unpartnered'
  const { data: company, error: insErr } = await supabase.from('insurance_companies').insert({
    name: companyName.trim(), contact_name: contactName?.trim() || null,
    contact_email: contactEmail.trim(), contact_phone: contactPhone?.trim() || null,
    relationship_type: relationshipType, self_serve: true,
    status: isUnpartnered ? 'active' : 'pending',
    onboarded_by: isUnpartnered ? 'self-serve' : 'self-serve (pending approval)',
  }).select().maybeSingle()
  if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })

  if (!isUnpartnered) {
    return res.status(200).json({ status: 'PENDING', companyName: company.name })
  }

  const tempPassword = `Temp${Math.floor(1000 + Math.random() * 9000)}!`
  const { error: pwErr } = await supabase.rpc('set_insurance_company_password', { p_company_id: company.id, p_new_password: tempPassword })
  if (pwErr) return res.status(500).json({ status: 'ERROR', message: `Account created but password could not be set: ${pwErr.message}` })

  return res.status(200).json({ status: 'OK', companyName: company.name, tempPassword })
}
