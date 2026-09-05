import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Starts a TPA clinic's onboarding - just records the application as
// status='onboarding'. No login is issued here any more: a real partner
// relationship needs a signed contract, a working API connection and
// confirmed payment terms first (see set_partner_checkpoint.js and
// activate_tpa_clinic.js), same real gate the insurer partnership flow
// already has via insurance_companies.status='pending'.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { clinicName, contactName, contactEmail, contactPhone, brNumber } = req.body || {}
  if (!clinicName?.trim() || !contactEmail?.trim()) {
    return res.status(400).json({ status: 'ERROR', message: 'clinicName and contactEmail are required.' })
  }

  const { data: clinic, error: insErr } = await supabase.from('external_clinics').insert({
    clinic_name: clinicName.trim(), contact_name: contactName?.trim() || null,
    contact_email: contactEmail.trim(), contact_phone: contactPhone?.trim() || null,
    business_registration_number: brNumber?.trim() || null,
    onboarded_by: 'medsa-admin', status: 'onboarding',
  }).select().maybeSingle()
  if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })

  return res.status(200).json({ status: 'OK', clinic })
}
