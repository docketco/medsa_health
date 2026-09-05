// pages/api/admin/approve_insurer.js
// ─────────────────────────────────────────────────────────────────────────────
// Approves a pending partnered-insurer application (see
// /api/insurer/signup.js) - moves it to active and issues its first
// password in one call. Gated by middleware.js's /api/admin/:path* match,
// same as every other admin route, AND now gated on the real partnership
// checkpoints from set_partner_checkpoint.js: a signed contract, a working
// API integration and confirmed payment terms - a partnered insurer gets
// real plan listings and client-profile access, so it doesn't get
// activated on a single click any more than a TPA clinic does (see
// activate_tpa_clinic.js).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/email'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { companyId } = req.body || {}
  if (!companyId) return res.status(400).json({ status: 'ERROR', message: 'companyId is required.' })

  const { data: pending, error: findErr } = await supabase.from('insurance_companies').select('*').eq('id', companyId).maybeSingle()
  if (findErr || !pending) return res.status(404).json({ status: 'ERROR', message: 'Company not found.' })

  const missing = []
  if (!pending.contract_signed_at) missing.push('signed contract')
  if (!pending.integration_configured_at) missing.push('API integration')
  if (!pending.payment_confirmed_at) missing.push('payment terms')
  if (missing.length) return res.status(400).json({ status: 'ERROR', message: `Cannot activate yet - still missing: ${missing.join(', ')}.` })

  const { data: company, error: updErr } = await supabase.from('insurance_companies')
    .update({ status: 'active' }).eq('id', companyId).select().maybeSingle()
  if (updErr || !company) return res.status(500).json({ status: 'ERROR', message: updErr?.message || 'Company not found.' })

  const tempPassword = `Temp${Math.floor(1000 + Math.random() * 9000)}!`
  const { error: pwErr } = await supabase.rpc('set_insurance_company_password', { p_company_id: company.id, p_new_password: tempPassword })
  if (pwErr) return res.status(500).json({ status: 'ERROR', message: `Approved but password could not be set: ${pwErr.message}` })

  let emailResult = { sent: false, reason: 'No contact email on file.' }
  if (company.contact_email) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'
    emailResult = await sendEmail({
      to: company.contact_email,
      subject: 'Medsa Health - your partnership is approved',
      html: `<p>Hi ${company.contact_name || 'there'},</p><p>${company.name}'s partnership with Medsa is approved and active.</p><p>Sign in at <a href="${siteUrl}/insurer-portal">${siteUrl}/insurer-portal</a> with:</p><p>Email: ${company.contact_email}<br/>Temporary password: <strong>${tempPassword}</strong></p><p>Please change this password once you're in.</p>`,
    })
  }

  return res.status(200).json({ status: 'OK', companyName: company.name, tempPassword, emailSent: emailResult.sent, emailReason: emailResult.reason })
}
