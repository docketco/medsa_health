import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Lists insurer API clients (with per-client call counts) for medsa-admin's
// API Clients tab. Moved server-side because api_clients.api_key_hash lives
// on this same table - anon has no table-level access to it at all any
// more (see restrict_anon_access_admin_tables), replacing what used to be
// direct `select('*')` + api_usage_log reads from the client.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { data: clients, error } = await supabase.from('api_clients')
    .select('id, name, contact_email, status, onboarded_by, created_at')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ status: 'ERROR', message: error.message })

  const { data: logs } = await supabase.from('api_usage_log').select('api_client_id')
  const usage = {}
  for (const l of (logs || [])) usage[l.api_client_id] = (usage[l.api_client_id] || 0) + 1

  return res.status(200).json({ status: 'OK', clients: clients || [], usage })
}
