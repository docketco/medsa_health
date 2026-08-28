import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// "Forgot password" for ClinicOps staff logins - same hash/expiry OTP
// pattern already used for clinic contact verification
// (verified_clinics.contact_otp_*). No live email provider is
// connected yet, so the code is returned on-screen for now, same
// honest gap as everywhere else in this app that needs OTP delivery -
// this is real generation/hashing/expiry, just not real sending yet.

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

  const maskedEmail = staff.email.replace(/^(.{2}).*(@.*)$/, '$1***$2')
  return res.status(200).json({
    status: 'SENT', email: maskedEmail, expiresInMinutes: 10,
    devOnlyCode: code,
  })
}
