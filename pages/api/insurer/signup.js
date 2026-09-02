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
import { sendEmail } from '../../../lib/email'

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

  // Every insurance_companies row needs a real institutions counterpart
  // (institution_type='insurer') - that's the table agents.institution_id
  // and agent_policies.institution_id actually point at. Without this,
  // a self-serve-signed-up company would have nowhere real for its
  // future teams/agents to attach to.
  const { data: institutionRow, error: instErr } = await supabase.from('institutions')
    .insert({ name: companyName.trim(), institution_type: 'insurer' }).select().maybeSingle()
  if (instErr) return res.status(500).json({ status: 'ERROR', message: instErr.message })

  const isUnpartnered = relationshipType === 'unpartnered'
  const { data: company, error: insErr } = await supabase.from('insurance_companies').insert({
    name: companyName.trim(), contact_name: contactName?.trim() || null,
    contact_email: contactEmail.trim(), contact_phone: contactPhone?.trim() || null,
    relationship_type: relationshipType, self_serve: true,
    status: isUnpartnered ? 'active' : 'pending',
    onboarded_by: isUnpartnered ? 'self-serve' : 'self-serve (pending approval)',
    institution_ref_id: institutionRow.id,
  }).select().maybeSingle()
  if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })

  if (!isUnpartnered) {
    return res.status(200).json({ status: 'PENDING', companyName: company.name })
  }

  const tempPassword = `Temp${Math.floor(1000 + Math.random() * 9000)}!`
  const { error: pwErr } = await supabase.rpc('set_insurance_company_password', { p_company_id: company.id, p_new_password: tempPassword })
  if (pwErr) return res.status(500).json({ status: 'ERROR', message: `Account created but password could not be set: ${pwErr.message}` })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'
  const emailResult = await sendEmail({
    to: contactEmail.trim(),
    subject: 'Medsa Health - your Insurance Partner Portal login',
    html: `<p>Hi ${contactName?.trim() || 'there'},</p><p>${company.name} is active on Medsa's Insurance Partner Portal.</p><p>Sign in at <a href="${siteUrl}/insurer-portal">${siteUrl}/insurer-portal</a> with:</p><p>Email: ${contactEmail.trim()}<br/>Temporary password: <strong>${tempPassword}</strong></p><p>Please change this password once you're in.</p>`,
  })

  return res.status(200).json({ status: 'OK', companyName: company.name, tempPassword, emailSent: emailResult.sent, emailReason: emailResult.reason })
}
