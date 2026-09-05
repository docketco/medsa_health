import { createClient } from '@supabase/supabase-js'
import { generateApiKey, hashApiKey } from '../../../lib/apiAuth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Real onboarding checkpoints for both partner-relationship paths - an
// out-of-network TPA clinic (external_clinics) and a fully partnered
// insurer (insurance_companies). Neither is a real relationship until all
// three are true, same as any real platform partnership (contract, tech
// integration, payment terms) before it goes live - see
// activate_tpa_clinic.js and approve_insurer.js, which both refuse to
// activate until this endpoint has set all three.
const TABLES = { tpa_clinic: 'external_clinics', insurer: 'insurance_companies' }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { entityType, id, checkpoint } = req.body || {}
  const table = TABLES[entityType]
  if (!table || !id) return res.status(400).json({ status: 'ERROR', message: 'entityType (tpa_clinic|insurer) and id are required.' })

  const { data: entity, error: findErr } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
  if (findErr || !entity) return res.status(404).json({ status: 'ERROR', message: 'Partner not found.' })

  if (checkpoint === 'contract') {
    const { signedByName } = req.body || {}
    if (!signedByName?.trim()) return res.status(400).json({ status: 'ERROR', message: 'signedByName is required.' })
    const { error } = await supabase.from(table).update({
      contract_signed_at: new Date().toISOString(), contract_signed_by: signedByName.trim(),
    }).eq('id', id)
    if (error) return res.status(500).json({ status: 'ERROR', message: error.message })
    return res.status(200).json({ status: 'OK' })
  }

  if (checkpoint === 'integration') {
    // The real "connect to their API" step - issues an actual api_clients
    // credential, same mechanism as an insurer paying to call the
    // adjudication engine directly (create_api_client.js). Whichever
    // system (the TPA clinic's own portal integration, or the insurer's
    // backend) needs to authenticate against Medsa's API gets this key.
    const name = entity.clinic_name || entity.name
    const contactEmail = entity.contact_email
    const apiKey = generateApiKey()
    const { data: apiClient, error: apiErr } = await supabase.from('api_clients').insert({
      name, contact_email: contactEmail || null, api_key_hash: hashApiKey(apiKey),
      onboarded_by: 'medsa-admin', status: 'active',
    }).select().maybeSingle()
    if (apiErr) return res.status(500).json({ status: 'ERROR', message: apiErr.message })
    const { error } = await supabase.from(table).update({
      integration_configured_at: new Date().toISOString(), api_client_id: apiClient.id,
    }).eq('id', id)
    if (error) return res.status(500).json({ status: 'ERROR', message: error.message })
    return res.status(200).json({ status: 'OK', apiKey })
  }

  if (checkpoint === 'payment') {
    const { note } = req.body || {}
    if (!note?.trim()) return res.status(400).json({ status: 'ERROR', message: 'note is required.' })
    const { error } = await supabase.from(table).update({
      payment_confirmed_at: new Date().toISOString(), payment_note: note.trim(),
    }).eq('id', id)
    if (error) return res.status(500).json({ status: 'ERROR', message: error.message })
    return res.status(200).json({ status: 'OK' })
  }

  return res.status(400).json({ status: 'ERROR', message: 'checkpoint must be contract, integration or payment.' })
}
