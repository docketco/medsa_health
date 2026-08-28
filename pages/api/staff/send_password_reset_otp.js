import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { sendEmail } from '../../../lib/email'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// "Forgot password" for ClinicOps staff logins - same hash/expiry OTP
// pattern already used for clinic contact verification
// (verified_clinics.contact_otp_*). Sends a real email once
// RESEND_API_KEY is configured; until then, falls back to showing the
// code on-screen (devOnlyCode) same as every other OTP flow in this
// app - this is real generation/hashing/expiry either way, just not
// real delivery until email is wired up.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { medsaId } = req.body
  if (!medsaId) return res.status(400).json({ status: 'ERROR', message: 'medsaId is required.' })

  const { data: staff } = await supabase.from('staff_credentials').select('id, email, status').eq('medsa_id', medsaId).maybeSingle()
  if (!staff || staff.status !== 'active') return res.status(404).json({ status: 'ERROR', message: 'No active account found.' })
  if (!staff.email) return res.status(200).json({ status: 'NO_EMAIL_ON_FILE', message: 'No email on file for this account - ask your Practice Manager to add one in Staff management, then try again.' })

  const code = Math.floor(100000 + Math.random()*900000).toString()
  const codeHash = crypto.createHash('sha256').update(code).digest('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 10*60*1000)

  await supabase.from('staff_credentials').update({
    password_reset_otp_hash: codeHash,
    password_reset_otp_sent_at: now.toISOString(), password_reset_otp_expires_at: expiresAt.toISOString(),
  }).eq('id', staff.id)

  const emailResult = await sendEmail({
    to: staff.email,
    subject: 'Medsa Health - your password reset code',
    html: `<p>Your Medsa Health password reset code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:2px">${code}</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
  })

  const maskedEmail = staff.email.replace(/^(.{2}).*(@.*)$/, '$1***$2')
  return res.status(200).json({
    status: 'SENT', email: maskedEmail, expiresInMinutes: 10,
    // Only shown on-screen when real email sending isn't configured
    // yet (or the send failed) - once RESEND_API_KEY is live, this
    // stays server-side and the code only ever reaches the real inbox.
    ...(emailResult.sent ? {} : { devOnlyCode: code, emailNotSentReason: emailResult.reason }),
  })
}
