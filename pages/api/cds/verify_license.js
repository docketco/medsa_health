import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Real verification against imported HK government open data (Small
// Practice Clinics under Cap. 633) - not a live scrape of the ORPHF
// website, since that site's own terms restrict commercial reuse without
// prior written authorization. This is a snapshot as of whenever the
// data was last imported - see source_last_update on the matched row.
//
// KNOWN GAP: this only covers Small Practice Clinics specifically. Full
// licensed clinics, hospitals, day procedure centres (Cap. 633 proper),
// individual doctor MCHK numbers, SMPC-registered labs/allied health,
// and CMCHK Chinese medicine practitioners are NOT covered by this data
// source and are not verified here - matches against this table return
// NOT_FOUND for any of those, which does not mean the registration is
// actually invalid, only that this specific dataset doesn't include it.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { registrationCode } = req.body
  if (!registrationCode?.trim()) return res.status(400).json({ status: 'ERROR', message: 'registrationCode is required' })

  const code = registrationCode.trim().toUpperCase()
  const { data, error } = await supabase.from('hk_small_practice_clinics')
    .select('*').eq('phf_num', code).maybeSingle()

  if (error) return res.status(500).json({ status: 'ERROR', message: error.message })
  if (!data) {
    return res.status(200).json({
      status: 'NOT_FOUND', registrationCode: code,
      message: 'No match in the Small Practice Clinic registry. This does not confirm the registration is invalid - it may be a different facility type (full-licensed clinic, hospital, lab, or individual practitioner) that this specific dataset does not cover.',
    })
  }
  return res.status(200).json({
    status: 'FOUND', registrationCode: code,
    facilityName: data.phf_name, address: data.phf_address,
    category: data.phf_category, licenceType: data.licence_type,
    typeOfPractice: data.type_practice,
    dataAsOf: data.source_last_update,
  })
}
