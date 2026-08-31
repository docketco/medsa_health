import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Approves or rejects an account recovery request. Approving updates the
// EXISTING patient's phone number - this is the whole point, recovery
// never creates a second account. Moved server-side: anon has no
// UPDATE on account_recovery_requests any more, and this is exactly the
// kind of account-takeover-adjacent write (rewriting a patient's contact
// number) that should never have been reachable with just the anon key
// (see restrict_anon_access_admin_tables).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { requestId, decision, reviewerName, patientId, newPhone } = req.body || {}
  if (!requestId || !['approved', 'rejected'].includes(decision) || !reviewerName?.trim()) {
    return res.status(400).json({ status: 'ERROR', message: 'requestId, a valid decision, and reviewerName are required.' })
  }
  if (decision === 'approved') {
    if (!patientId || !newPhone) return res.status(400).json({ status: 'ERROR', message: 'patientId and newPhone are required to approve.' })
    const { error: phoneErr } = await supabase.from('patients').update({ phone: newPhone }).eq('id', patientId)
    if (phoneErr) return res.status(500).json({ status: 'ERROR', message: phoneErr.message })
  }
  const { error } = await supabase.from('account_recovery_requests').update({
    status: decision, reviewed_by: reviewerName.trim(), reviewed_at: new Date().toISOString(),
  }).eq('id', requestId)
  if (error) return res.status(500).json({ status: 'ERROR', message: error.message })
  return res.status(200).json({ status: 'OK' })
}
