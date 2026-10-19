// pages/api/insurer/signup.js
// ─────────────────────────────────────────────────────────────────────────────
// Self-serve insurer signup - one tier, one outcome. Plan
// registration/editing is Medsa-admin-only regardless of who signs up
// (see medsa-admin's Plans tab), so there's no bigger-access tier left
// that would justify gating activation behind manual review - every
// signup activates immediately with a temp password, same as
// create_tpa_clinic.js does for out-of-network clinics.
// (A company can still land as status='pending' via medsa-admin's own
// "Onboard a company" flow, when Medsa wants a real signed contract in
// place first - that path is separate and untouched by this route; see
// /api/admin/approve_insurer.js for how those get activated.)
// Runs with the service-role key because insurance_companies' password
// column must never be set by a route the browser can call directly.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/email'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { companyName, contactName, contactEmail, contactPhone } = req.body || {}
  if (!companyName?.trim() || !contactEmail?.trim()) {
    return res.status(400).json({ status: 'ERROR', message: 'companyName and contactEmail are required.' })
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

  const { data: company, error: insErr } = await supabase.from('insurance_companies').insert({
    name: companyName.trim(), contact_name: contactName?.trim() || null,
    contact_email: contactEmail.trim(), contact_phone: contactPhone?.trim() || null,
    self_serve: true, status: 'active', onboarded_by: 'self-serve',
    institution_ref_id: institutionRow.id,
  }).select().maybeSingle()
  if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })

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
