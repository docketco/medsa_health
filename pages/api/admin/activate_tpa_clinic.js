import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Final step of TPA clinic onboarding - refuses to issue a login until
// the contract, API integration and payment checkpoints (see
// set_partner_checkpoint.js) are all on file. This is the real gate the
// old create_tpa_clinic.js skipped entirely by activating in one click.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { clinicId } = req.body || {}
  if (!clinicId) return res.status(400).json({ status: 'ERROR', message: 'clinicId is required.' })

  const { data: clinic, error: findErr } = await supabase.from('external_clinics').select('*').eq('id', clinicId).maybeSingle()
  if (findErr || !clinic) return res.status(404).json({ status: 'ERROR', message: 'Clinic not found.' })

  const missing = []
  if (!clinic.contract_signed_at) missing.push('signed contract')
  if (!clinic.integration_configured_at) missing.push('API integration')
  if (!clinic.payment_confirmed_at) missing.push('payment terms')
  if (missing.length) return res.status(400).json({ status: 'ERROR', message: `Cannot activate yet - still missing: ${missing.join(', ')}.` })

  const tempPassword = `Temp${Math.floor(1000 + Math.random() * 9000)}!`
  const { error: pwErr } = await supabase.rpc('admin_set_external_clinic_password', { p_clinic_id: clinic.id, p_new_password: tempPassword })
  if (pwErr) return res.status(500).json({ status: 'ERROR', message: `Password could not be set: ${pwErr.message}` })

  const { error: updErr } = await supabase.from('external_clinics').update({ status: 'active' }).eq('id', clinic.id)
  if (updErr) return res.status(500).json({ status: 'ERROR', message: updErr.message })

  return res.status(200).json({ status: 'OK', clinicName: clinic.clinic_name, tempPassword })
}
