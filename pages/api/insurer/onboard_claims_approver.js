// pages/api/insurer/onboard_claims_approver.js
// ─────────────────────────────────────────────────────────────────────────────
// Lets an insurer add their own claims-approver staff - deliberately a
// separate role and separate identity system from an underwriter
// (insurance_claims_approvers, own login at /claims-portal), per your call:
// underwriting (whether to accept an applicant) and claims approval
// (whether to pay out on one) are a different real-world distinction, even
// though the same person could hold both accounts. Mirrors
// onboard_underwriter.js exactly.
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

  const { data: existing } = await supabase.from('insurance_claims_approvers').select('id').ilike('email', email.trim()).maybeSingle()
  if (existing) return res.status(400).json({ status: 'ERROR', message: 'A claims approver account already exists for this email.' })

  const { data: created, error: insErr } = await supabase.from('insurance_claims_approvers').insert({
    full_name: fullName.trim(), email: email.trim(), institution_id: institutionId, medsa_id: generateMedsaId('CA'),
  }).select('id').maybeSingle()
  if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })

  const tempPassword = `Temp${Math.floor(1000 + Math.random() * 9000)}!`
  const { error: pwErr } = await supabase.rpc('set_claims_approver_password', { p_approver_id: created.id, p_new_password: tempPassword })
  if (pwErr) return res.status(500).json({ status: 'ERROR', message: `Claims approver created but password could not be set: ${pwErr.message}` })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'
  const emailResult = await sendEmail({
    to: email.trim(),
    subject: 'Medsa Health - your Claims Portal login',
    html: `<p>Hi ${fullName.trim()},</p><p>You've been added as a claims approver on Medsa.</p><p>Sign in at <a href="${siteUrl}/claims-portal">${siteUrl}/claims-portal</a> with:</p><p>Email: ${email.trim()}<br/>Temporary password: <strong>${tempPassword}</strong></p><p>Please change this password once you're in.</p>`,
  })

  return res.status(200).json({ status: 'OK', approverId: created.id, tempPassword, emailSent: emailResult.sent, emailReason: emailResult.reason })
}
