// pages/api/insurer/onboard_underwriter.js
// ─────────────────────────────────────────────────────────────────────────────
// Lets an insurer add their own underwriter staff - a real role distinct
// from a sales agent (insurance_underwriters is a separate identity
// system, see the aq2_underwriting_rebuild_foundation migration). Modelled
// on agent/onboard.js's new-account pattern but simpler: no team/appointment
// concept, an underwriter belongs to exactly one institution.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/email'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function generateMedsaId(prefix) {
  return `${prefix}-${Math.floor(10000 + Math.random() * 89999)}-HK`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { fullName, email, institutionId } = req.body || {}
  if (!fullName?.trim() || !email?.trim() || !institutionId) {
    return res.status(400).json({ status: 'ERROR', message: 'fullName, email and institutionId are required.' })
  }

  const { data: existing } = await supabase.from('insurance_underwriters').select('id').ilike('email', email.trim()).maybeSingle()
  if (existing) return res.status(400).json({ status: 'ERROR', message: 'An underwriter account already exists for this email.' })

  const { data: created, error: insErr } = await supabase.from('insurance_underwriters').insert({
    full_name: fullName.trim(), email: email.trim(), institution_id: institutionId, medsa_id: generateMedsaId('UW'),
  }).select('id').maybeSingle()
  if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })

  const tempPassword = `Temp${Math.floor(1000 + Math.random() * 9000)}!`
  const { error: pwErr } = await supabase.rpc('set_underwriter_password', { p_underwriter_id: created.id, p_new_password: tempPassword })
  if (pwErr) return res.status(500).json({ status: 'ERROR', message: `Underwriter created but password could not be set: ${pwErr.message}` })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'
  const emailResult = await sendEmail({
    to: email.trim(),
    subject: 'Medsa Health - your Underwriter Portal login',
    html: `<p>Hi ${fullName.trim()},</p><p>You've been added as an underwriter on Medsa.</p><p>Sign in at <a href="${siteUrl}/underwriter-portal">${siteUrl}/underwriter-portal</a> with:</p><p>Email: ${email.trim()}<br/>Temporary password: <strong>${tempPassword}</strong></p><p>Please change this password once you're in.</p>`,
  })

  return res.status(200).json({ status: 'OK', underwriterId: created.id, tempPassword, emailSent: emailResult.sent, emailReason: emailResult.reason })
}
