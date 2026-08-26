import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Business Registration check for a practitioner who isn't attached to any
// clinic (a home-visit / mobile / independent allied health provider).
// Same real, live Companies Registry lookup already used for clinics in
// verify_clinic_credentials.js - an independent practitioner can't legally
// bill as a sole proprietorship in Hong Kong without a BR number, so this
// is the equivalent of that check at the person level rather than the
// facility level. This does not, by itself, confirm the person is who they
// say they are - see verify_practitioner_registration for that piece.

const REVERIFY_DAYS = 90

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { businessRegistrationNumber, practitionerNameDeclared } = req.body
  const brn = businessRegistrationNumber?.trim()?.toUpperCase()
  if (!brn) return res.status(400).json({ status: 'ERROR', message: 'businessRegistrationNumber is required.' })

  const { data: existing } = await supabase.from('verified_practitioners')
    .select('*').eq('business_registration_number', brn).maybeSingle()
  if (existing && existing.br_status === 'matched' && existing.re_verify_after && new Date(existing.re_verify_after) > new Date()) {
    return res.status(200).json({ status: 'REMEMBERED', ...existing })
  }

  let brStatus = 'unchecked', brMatchedName = null, brRaw = null
  try {
    const url = `https://data.cr.gov.hk/cr/api/api/v1/api_builder/json/local/search?query[0][key1]=Brn&query[0][key2]=equal&query[0][key3]=${encodeURIComponent(brn)}&format=json`
    const brRes = await fetch(url)
    const brData = await brRes.json()
    if (Array.isArray(brData) && brData.length > 0) {
      brStatus = 'matched'
      brMatchedName = brData[0].English_Company_Name || brData[0].Chinese_Company_Name
      brRaw = brData[0]
    } else {
      brStatus = 'no_match'
    }
  } catch (e) {
    brStatus = 'error'
  }

  const now = new Date()
  const record = {
    business_registration_number: brn, practitioner_name_declared: practitionerNameDeclared || null,
    name_matched_br: brMatchedName, br_status: brStatus, raw_br_response: brRaw,
    checked_at: now.toISOString(),
    re_verify_after: new Date(now.getTime() + REVERIFY_DAYS*24*60*60*1000).toISOString(),
  }
  const { data: savedRow } = await supabase.from('verified_practitioners')
    .upsert(record, { onConflict: 'business_registration_number' }).select().maybeSingle()

  return res.status(200).json({ status: 'CHECKED', ...(savedRow || record) })
}
