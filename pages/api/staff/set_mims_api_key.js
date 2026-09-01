import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// institutions.mims_api_key is a real credential (locked down the same way
// staff_credentials' password/OTP columns are - anon has no SELECT/INSERT/
// UPDATE on it at all), so writing it goes through here with a privileged
// key that never reaches the browser, and independently re-checks the
// caller's claimed identity against their real stored role before writing
// anything - the same pattern already used for order set imports.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { medsaId, institutionId, apiKey } = req.body
  if (!medsaId || !institutionId) {
    return res.status(400).json({ error: 'medsaId and institutionId are required.' })
  }

  const { data: staff } = await supabase.from('staff_credentials')
    .select('role, full_name, status').eq('medsa_id', medsaId).eq('institution_id', institutionId).maybeSingle()
  if (!staff || staff.role !== 'admin' || staff.status !== 'active') {
    return res.status(403).json({ error: 'Only an active practice manager for this institution can connect a drug safety database.' })
  }

  // Empty/blank apiKey disconnects rather than errors - the practice
  // manager typing nothing and hitting Save is a real, intentional way to
  // remove a key, not a mistake to reject.
  const trimmed = (apiKey || '').trim()
  const { error } = await supabase.from('institutions').update({
    mims_api_key: trimmed || null,
    mims_connected_at: trimmed ? new Date().toISOString() : null,
    mims_connected_by: trimmed ? staff.full_name : null,
  }).eq('id', institutionId)
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ connected: !!trimmed })
}
