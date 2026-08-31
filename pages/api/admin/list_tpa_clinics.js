import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Lists TPA clinics for medsa-admin's TPA Clinics tab. Moved server-side
// because external_clinics.password_hash lives on this same table - the
// browser no longer has table-level SELECT on it at all (see migration
// restrict_anon_access_admin_tables), so this replaces what used to be a
// direct `select('*')` from the client.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { data, error } = await supabase.from('external_clinics')
    .select('id, clinic_name, contact_name, contact_email, contact_phone, business_registration_number, status, onboarded_by, created_at')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ status: 'ERROR', message: error.message })
  return res.status(200).json({ status: 'OK', clinics: data || [] })
}
