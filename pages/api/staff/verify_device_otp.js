import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Verifies the code from send_device_otp.js, then marks this device
// trusted (staff_device_trust) so this same browser isn't challenged
// again next time. deviceId is a random id the browser generates once
// and keeps in localStorage - not a security boundary on its own (it's
// just a cookie-like marker), the OTP is what actually proves the
// person signing in controls the email on file.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { medsaId, code, deviceId, deviceLabel } = req.body
  if (!medsaId || !code || !deviceId) return res.status(400).json({ status: 'ERROR', message: 'medsaId, code, and deviceId are all required.' })

  const { data: staff } = await supabase.from('staff_credentials').select('id, device_otp_hash, device_otp_expires_at').eq('medsa_id', medsaId).maybeSingle()
  if (!staff || !staff.device_otp_hash) return res.status(404).json({ status: 'ERROR', message: 'No pending device verification found - request a new code.' })
  if (new Date(staff.device_otp_expires_at) < new Date()) {
    return res.status(400).json({ status: 'EXPIRED', message: 'That code has expired - request a new one.' })
  }
  const submittedHash = crypto.createHash('sha256').update(code.trim()).digest('hex')
  if (submittedHash !== staff.device_otp_hash) {
    return res.status(400).json({ status: 'INVALID', message: 'Incorrect code.' })
  }

  await supabase.from('staff_device_trust').upsert({
    medsa_id: medsaId, device_id: deviceId, device_label: deviceLabel || null, trusted_at: new Date().toISOString(),
  }, { onConflict: 'medsa_id,device_id' })

  await supabase.from('staff_credentials').update({
    device_otp_hash: null, device_otp_sent_at: null, device_otp_expires_at: null,
  }).eq('id', staff.id)

  return res.status(200).json({ status: 'OK' })
}
