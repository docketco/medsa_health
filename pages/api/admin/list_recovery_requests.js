import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Lists pending account_recovery_requests for medsa-admin's Recovery tab.
// Moved server-side because approving one of these rewrites an existing
// patient's phone number - anon has no SELECT on this table any more (see
// restrict_anon_access_admin_tables), replacing what used to be a direct
// client-side read.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { data, error } = await supabase.from('account_recovery_requests')
    .select('*, patients(id, full_name, medsa_id, phone, id_document_path, selfie_verification_path)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) return res.status(500).json({ status: 'ERROR', message: error.message })
  return res.status(200).json({ status: 'OK', requests: data || [] })
}
