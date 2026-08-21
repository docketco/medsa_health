import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { verifiedClinicId, code } = req.body
  if (!verifiedClinicId || !code) return res.status(400).json({ status: 'ERROR', message: 'verifiedClinicId and code are required.' })

  const { data: clinic } = await supabase.from('verified_clinics').select('*').eq('id', verifiedClinicId).maybeSingle()
  if (!clinic || !clinic.contact_otp_code_hash) return res.status(404).json({ status: 'ERROR', message: 'No pending OTP challenge found - request a new one.' })

  if (new Date(clinic.contact_otp_expires_at) < new Date()) {
    return res.status(200).json({ status: 'EXPIRED', message: 'This code has expired - request a new one.' })
  }

  const submittedHash = crypto.createHash('sha256').update(code.trim()).digest('hex')
  if (submittedHash !== clinic.contact_otp_code_hash) {
    return res.status(200).json({ status: 'INCORRECT', message: 'That code does not match.' })
  }

  const now = new Date().toISOString()
  await supabase.from('verified_clinics').update({
    contact_verified: true, contact_verified_at: now,
    contact_otp_code_hash: null,
  }).eq('id', verifiedClinicId)

  return res.status(200).json({ status: 'VERIFIED', verifiedAt: now })
}
