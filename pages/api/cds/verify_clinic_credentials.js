import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Automated clinic credential verification - no manual review step.
// Business Registration is checked against a real, live, government API
// (data.cr.gov.hk, run by the Companies Registry) - tested and confirmed
// working, updated daily, and data.gov.hk's own terms explicitly permit
// commercial reuse. ORPHF clinic licence is checked against the imported
// government open-data registry (hk_small_practice_clinics) from last
// session - currently covers Small Practice Clinics specifically.
//
// "The system remembers" - once a clinic passes, the result is stored
// in verified_clinics and reused on every future visit without
// re-checking, until the freshness window expires (licenses can lapse,
// so "verified" can't mean "verified forever").

const REVERIFY_DAYS = 90

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { businessRegistrationNumber, orphfCode, clinicNameDeclared, businessRegDocPath, orphfLicenceDocPath } = req.body
  if (!businessRegistrationNumber?.trim() && !orphfCode?.trim()) {
    return res.status(400).json({ status: 'ERROR', message: 'At least one of businessRegistrationNumber or orphfCode is required.' })
  }

  const brn = businessRegistrationNumber?.trim()?.toUpperCase() || null
  const orphf = orphfCode?.trim()?.toUpperCase() || null

  // System remembers - check for an existing, still-fresh verification
  // before doing any real work.
  if (brn) {
    const { data: existing } = await supabase.from('verified_clinics')
      .select('*').eq('business_registration_number', brn).maybeSingle()
    if (existing && existing.overall_status !== 'unverified' && existing.re_verify_after && new Date(existing.re_verify_after) > new Date()) {
      return res.status(200).json({ status: 'REMEMBERED', ...existing })
    }
  }

  // Real, live check against the Companies Registry's actual API.
  let brStatus = 'unchecked', brMatchedName = null, brRaw = null
  if (brn) {
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
  }

  // Real check against the imported ORPHF registry - now covers Small
  // Practice Clinics, hospitals, day procedure centres, and scheduled
  // nursing homes across two tables. "no_match" still doesn't mean
  // invalid - it means not in either of these datasets specifically
  // (e.g. a regular licensed clinic not yet covered by a bulk open-data
  // export of that particular category).
  let orphfStatus = 'unchecked', orphfMatchedName = null
  if (orphf) {
    const { data: spcRow } = await supabase.from('hk_small_practice_clinics')
      .select('phf_name').eq('phf_num', orphf).maybeSingle()
    if (spcRow) {
      orphfStatus = 'matched'; orphfMatchedName = spcRow.phf_name
    } else {
      const { data: licensedRow } = await supabase.from('hk_licensed_facilities')
        .select('phf_name').eq('phf_num', orphf).maybeSingle()
      if (licensedRow) { orphfStatus = 'matched'; orphfMatchedName = licensedRow.phf_name }
      else orphfStatus = 'no_match'
    }
  }

  const overallStatus = (brStatus === 'matched' || orphfStatus === 'matched')
    ? ((brn && brStatus !== 'matched') || (orphf && orphfStatus !== 'matched') ? 'partial' : 'verified')
    : 'unverified'

  const now = new Date()
  const reVerifyAfter = new Date(now.getTime() + REVERIFY_DAYS*24*60*60*1000)

  const record = {
    business_registration_number: brn, orphf_registration_code: orphf,
    clinic_name_declared: clinicNameDeclared || null,
    clinic_name_matched_br: brMatchedName, clinic_name_matched_orphf: orphfMatchedName,
    br_status: brStatus, orphf_status: orphfStatus, overall_status: overallStatus,
    first_verified_at: now.toISOString(), last_checked_at: now.toISOString(),
    re_verify_after: reVerifyAfter.toISOString(), raw_br_response: brRaw,
    business_reg_doc_path: businessRegDocPath || null, orphf_licence_doc_path: orphfLicenceDocPath || null,
  }

  let savedRow = null
  if (brn) {
    const { data } = await supabase.from('verified_clinics').upsert(record, { onConflict: 'business_registration_number' }).select().maybeSingle()
    savedRow = data
  } else {
    const { data } = await supabase.from('verified_clinics').insert(record).select().maybeSingle()
    savedRow = data
  }

  return res.status(200).json({ status: 'CHECKED', ...(savedRow || record) })
}
