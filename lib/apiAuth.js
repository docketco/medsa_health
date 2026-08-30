// lib/apiAuth.js
// ─────────────────────────────────────────────────────────────────────────────
// Auth + usage logging for the public insurer API ("Uber Direct" side of
// the insurance work) - an insurer with NO relationship to Medsa's
// consumer apps or ClinicOps pays to call the adjudication engine
// directly. API keys are long random tokens, shown once at issuance
// (medsa-admin's API Clients tab) and stored only as a SHA-256 hash -
// bcrypt's slow-by-design cost exists to slow down guessing a short
// human password, which doesn't apply to a long random secret.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export function generateApiKey() {
  return `medsa_live_${crypto.randomBytes(24).toString('hex')}`
}

/**
 * @param {import('next').NextApiRequest} req
 * @returns {Promise<{client: {id: string, name: string}|null, error: string|null}>}
 */
export async function authenticateApiClient(req) {
  const auth = req.headers.authorization || ''
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!key) return { client: null, error: 'Missing Authorization: Bearer <api_key> header' }

  const { data: client } = await supabase.from('api_clients')
    .select('id, name, status').eq('api_key_hash', hashApiKey(key)).maybeSingle()
  if (!client) return { client: null, error: 'Invalid API key' }
  if (client.status !== 'active') return { client: null, error: 'This API key has been suspended' }
  return { client, error: null }
}

// Fire-and-forget on purpose - a logging failure must never be the
// reason an API call fails for the insurer calling it.
export function logApiUsage(apiClientId, endpoint, statusCode) {
  supabase.from('api_usage_log').insert({ api_client_id: apiClientId, endpoint, status_code: statusCode }).then(()=>{}).catch(()=>{})
}

export { supabase as serviceSupabase }
