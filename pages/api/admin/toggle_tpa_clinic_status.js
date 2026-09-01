import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Suspends/reactivates a TPA clinic - anon has no UPDATE on external_clinics
// any more (see restrict_anon_access_admin_tables), so this moved server-side.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { clinicId, newStatus } = req.body || {}
  if (!clinicId || !['active', 'suspended'].includes(newStatus)) {
    return res.status(400).json({ status: 'ERROR', message: 'clinicId and a valid newStatus are required.' })
  }
  const { error } = await supabase.from('external_clinics').update({ status: newStatus }).eq('id', clinicId)
  if (error) return res.status(500).json({ status: 'ERROR', message: error.message })
  return res.status(200).json({ status: 'OK' })
}
