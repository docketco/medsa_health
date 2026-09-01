import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Onboards a TPA clinic and issues its temp password in one server-side
// call. Previously the client inserted the external_clinics row directly
// with the anon key, then called set_external_clinic_password.js for the
// password - the insert half no longer works from the browser (anon has
// no INSERT on external_clinics; see restrict_anon_access_admin_tables),
// so both steps now happen here together.
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
    onboarded_by: 'medsa-admin', status: 'active',
  }).select().maybeSingle()
  if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })

  const tempPassword = `Temp${Math.floor(1000 + Math.random() * 9000)}!`
  const { error: pwErr } = await supabase.rpc('admin_set_external_clinic_password', { p_clinic_id: clinic.id, p_new_password: tempPassword })
  if (pwErr) return res.status(500).json({ status: 'ERROR', message: `Clinic created but password could not be set: ${pwErr.message}` })

  return res.status(200).json({ status: 'OK', clinicName: clinic.clinic_name, tempPassword })
}
