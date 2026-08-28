import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Verifies the OTP from send_password_reset_otp.js, then calls
// admin_reset_staff_password - NOT set_staff_password, which turned
// out to only ever write a password when pin_hash was still null (a
// one-time onboarding guard), silently doing nothing for an actual
// reset of an already-provisioned account. admin_reset_staff_password
// always overwrites, and is locked to service_role only (this route
// runs with SUPABASE_SERVICE_ROLE_KEY) so it can't be called from a
// browser to take over an arbitrary account.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { medsaId, code, newPassword } = req.body
  if (!medsaId || !code || !newPassword) return res.status(400).json({ status: 'ERROR', message: 'medsaId, code, and newPassword are all required.' })
  if (newPassword.length < 8 || !/[0-9]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
    return res.status(400).json({ status: 'ERROR', message: 'Password must be at least 8 characters, with a number, a capital letter, and a special character.' })
  }

  const { data: staff } = await supabase.from('staff_credentials').select('id, password_reset_otp_hash, password_reset_otp_expires_at').eq('medsa_id', medsaId).maybeSingle()
  if (!staff || !staff.password_reset_otp_hash) return res.status(404).json({ status: 'ERROR', message: 'No pending reset request found - request a new code.' })
  if (new Date(staff.password_reset_otp_expires_at) < new Date()) {
    return res.status(400).json({ status: 'EXPIRED', message: 'That code has expired - request a new one.' })
  }
  const submittedHash = crypto.createHash('sha256').update(code.trim()).digest('hex')
  if (submittedHash !== staff.password_reset_otp_hash) {
    return res.status(400).json({ status: 'INVALID', message: 'Incorrect code.' })
  }

  const { error: pwErr } = await supabase.rpc('admin_reset_staff_password', { p_medsa_id: medsaId, p_new_password: newPassword })
  if (pwErr) return res.status(500).json({ status: 'ERROR', message: pwErr.message })

  await supabase.from('staff_credentials').update({
    password_reset_otp_hash: null, password_reset_otp_sent_at: null, password_reset_otp_expires_at: null,
  }).eq('id', staff.id)

  return res.status(200).json({ status: 'OK' })
}
