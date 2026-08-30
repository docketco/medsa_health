import { createClient } from '@supabase/supabase-js'
import { generateApiKey, hashApiKey } from '../../../lib/apiAuth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Issues a new insurer API key from medsa-admin's API Clients tab.
// Covered by middleware.js's Basic Auth matcher, same reasoning as
// set_external_clinic_password.js - the raw key is returned exactly
// once here and never stored anywhere; only its hash persists.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { name, contactEmail } = req.body
  if (!name) return res.status(400).json({ status: 'ERROR', message: 'name is required.' })

  const apiKey = generateApiKey()
  const { data, error } = await supabase.from('api_clients').insert({
    name: name.trim(), contact_email: contactEmail?.trim() || null,
    api_key_hash: hashApiKey(apiKey), onboarded_by: 'medsa-admin', status: 'active',
  }).select().maybeSingle()
  if (error) return res.status(500).json({ status: 'ERROR', message: error.message })

  return res.status(200).json({ status: 'OK', apiClient: data, apiKey })
}
