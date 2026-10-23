// pages/api/public/emergency_card.js
// ─────────────────────────────────────────────────────────────────────────────
// Public, unauthenticated by design - this is the whole point of the
// emergency card: EMS/A&E staff scanning a QR on someone who can't speak
// or respond can't be expected to log in first. Uses the service-role
// client because the lookup has to bypass RLS (an anonymous request has
// no patient session to filter by) - the only thing this route trades on
// is that security, so it deliberately returns a hand-picked, minimal
// field set (never the raw patient row) and always re-checks
// emergency_card_active at read time, so a patient deactivating their
// card takes effect immediately even though the token itself is stable.
// A wrong/missing token and a deactivated card return the exact same
// generic response - never confirm or deny that a token used to be valid.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function isMedicationActive(m) {
  if (m.active === false) return false
  const explicitEnd = m.end_date ? new Date(m.end_date) : null
  const computedEnd = (!explicitEnd && m.start_date && m.duration_days != null && m.duration_days > 0)
    ? new Date(new Date(m.start_date).getTime() + m.duration_days * 24 * 60 * 60 * 1000)
    : null
  const effectiveEnd = explicitEnd || computedEnd
  return !(effectiveEnd && effectiveEnd < new Date())
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  const token = (req.query.t || '').trim()
  const NOT_FOUND = { found: false }
  if (!token) return res.status(200).json(NOT_FOUND)

  const { data: patient } = await supabase.from('patients')
    .select('full_name,date_of_birth,medsa_id,blood_type,emergency_contact_name,emergency_contact_rel,emergency_contact_phone,emergency_card_active,id')
    .eq('emergency_card_token', token).maybeSingle()
  if (!patient || !patient.emergency_card_active) return res.status(200).json(NOT_FOUND)

  const [{ data: conditions }, { data: allergies }, { data: medications }, { data: familyHistory }] = await Promise.all([
    supabase.from('conditions').select('condition_name,severity').eq('patient_id', patient.id).eq('active', true),
    supabase.from('allergies').select('allergen,severity,reported_by').eq('patient_id', patient.id),
    supabase.from('medications').select('medication_name,dosage,frequency,active,end_date,start_date,duration_days').eq('patient_id', patient.id),
    supabase.from('family_history').select('relationship,condition_name').eq('patient_id', patient.id),
  ])

  return res.status(200).json({
    found: true,
    full_name: patient.full_name,
    date_of_birth: patient.date_of_birth,
    medsa_id: patient.medsa_id,
    blood_type: patient.blood_type,
    emergency_contact_name: patient.emergency_contact_name,
    emergency_contact_rel: patient.emergency_contact_rel,
    emergency_contact_phone: patient.emergency_contact_phone,
    conditions: conditions || [],
    allergies: allergies || [],
    medications: (medications || []).filter(isMedicationActive),
    familyHistory: familyHistory || [],
  })
}
