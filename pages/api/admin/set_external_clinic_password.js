import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Sets or resets an out-of-network clinic's TPA-portal password. Called
// from medsa-admin's TPA Clinics tab, which is already gated by
// middleware.js Basic Auth - this route is covered by the same gate
// (see middleware.js's matcher) rather than trusting the browser alone,
// since an API route's URL is guessable even if the page it's meant to
// be called from isn't. Locked to admin_set_external_clinic_password,
// which is itself locked to service_role - never callable directly from
// the browser with the anon key.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { clinicId, newPassword } = req.body
  if (!clinicId || !newPassword) return res.status(400).json({ status: 'ERROR', message: 'clinicId and newPassword are required.' })

  const { error } = await supabase.rpc('admin_set_external_clinic_password', { p_clinic_id: clinicId, p_new_password: newPassword })
  if (error) return res.status(500).json({ status: 'ERROR', message: error.message })

  return res.status(200).json({ status: 'OK' })
}
