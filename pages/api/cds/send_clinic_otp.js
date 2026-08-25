import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Real OTP challenge, targeted only at the contact info the registry
// itself lists for this clinic - never something the uploader typed in.
// This is the piece that actually confirms affiliation, not just that
// the registration number is real (which is public information anyone
// could look up and enter). No skip option - this step is mandatory,
// but the person chooses which registry-listed channel to use.
//
// Call and text both target the registry's phone number - the registry
// only has one phone field, not a separate mobile/voice distinction, so
// this is the same number either way, just a different delivery method.
//
// Same honest gap as NewPatientScreen's claim-code flow elsewhere in
// this app: the OTP is generated, hashed, and stored for real - but
// actual delivery (SMS, voice call, or email) needs a live provider
// connected, which isn't wired up yet. This returns the code on-screen
// for now, exactly like the existing claim-code pattern, rather than
// pretending it was actually sent.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { verifiedClinicId, channel, action } = req.body
  if (!verifiedClinicId) return res.status(400).json({ status: 'ERROR', message: 'verifiedClinicId is required.' })

  const { data: clinic } = await supabase.from('verified_clinics').select('*').eq('id', verifiedClinicId).maybeSingle()
  if (!clinic) return res.status(404).json({ status: 'ERROR', message: 'No verification record found for this clinic.' })

  // Only ever pulled from the ORPHF registry's own data - never from
  // anything the uploader entered on this form. Checks both registry
  // tables, consistent with the credentials endpoint's coverage.
  let registryPhone = null, registryEmail = null
  if (clinic.orphf_registration_code) {
    const { data: spcRow } = await supabase.from('hk_small_practice_clinics')
      .select('phone, email').eq('phf_num', clinic.orphf_registration_code).maybeSingle()
    if (spcRow) {
      registryPhone = spcRow.phone || null
      registryEmail = spcRow.email || null
    } else {
      const { data: licensedRow } = await supabase.from('hk_licensed_facilities')
        .select('phone, email').eq('phf_num', clinic.orphf_registration_code).maybeSingle()
      registryPhone = licensedRow?.phone || null
      registryEmail = licensedRow?.email || null
    }
  }

  // First call: action='list_channels' - report what's actually
  // available so the frontend can offer real choices, not guesses.
  if (action === 'list_channels') {
    const channels = []
    if (registryPhone) {
      channels.push('call')
      // HK mobile numbers start with 5/6/9 (8 digits) - landlines start
      // with 2/3. Registry phone numbers are very often the clinic's
      // office landline, which can't receive SMS at all - offering
      // "text" there would just silently fail. Only offer it when the
      // number actually looks mobile.
      const digitsOnly = registryPhone.replace(/\D/g, '')
      const looksMobile = /^[569]\d{7}$/.test(digitsOnly)
      if (looksMobile) channels.push('text')
    }
    if (registryEmail) channels.push('email')
    return res.status(200).json({ status: 'CHANNELS', channels, hasPhone: !!registryPhone, hasEmail: !!registryEmail })
  }

  // Second call: action='send' with the person's chosen channel.
  if (!channel) return res.status(400).json({ status: 'ERROR', message: 'channel is required.' })
  const target = channel === 'email' ? registryEmail : registryPhone
  if (!target) {
    return res.status(200).json({ status: 'NO_CONTACT_ON_FILE', message: `The registry has no ${channel === 'email' ? 'email' : 'phone number'} on file for this clinic.` })
  }

  const code = Math.floor(100000 + Math.random()*900000).toString()
  const codeHash = crypto.createHash('sha256').update(code).digest('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 10*60*1000)

  await supabase.from('verified_clinics').update({
    contact_otp_target: target, contact_otp_code_hash: codeHash,
    contact_otp_sent_at: now.toISOString(), contact_otp_expires_at: expiresAt.toISOString(),
  }).eq('id', verifiedClinicId)

  return res.status(200).json({
    status: 'SENT', channel, target, expiresInMinutes: 10,
    // Same as the existing claim-code pattern elsewhere in the app -
    // shown here since no live SMS/voice/email provider is connected
    // yet, not because this is meant to be visible in a real flow.
    devOnlyCode: code,
  })
}
