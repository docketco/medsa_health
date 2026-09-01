// pages/api/cds/check-safety.js
//
// Real backend proxy for the drug safety check. The frontend never talks
// to a third-party drug database directly - it always goes through this
// endpoint, so a real API key (once one exists) stays server-side and is
// never shipped to the browser. Currently backed by the mock adapter;
// swapping getCdsAdapter() for a real implementation in lib/cdsAdapter.js
// is the only change needed to go live with a genuine connection.

import { createClient } from '@supabase/supabase-js'
import { getCdsAdapter } from '../../../lib/cdsAdapter'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { patientId, ageInMonths, weightKg, drugName, atcCode, hkRegistrationNumber, dosage, unit, frequency, currentMedicationAtcCodes, institutionId } = req.body

  if (!patientId || !drugName) {
    return res.status(400).json({ error: 'patientId and drugName are required' })
  }

  try {
    // institutions.mims_api_key is locked down from anon (never reaches
    // the browser) - looked up here with the service role key so the
    // real adapter can be used automatically once a clinic has connected
    // one, with no client-side change needed.
    let mimsApiKey = null
    if (institutionId) {
      const { data: inst } = await supabase.from('institutions').select('mims_api_key').eq('id', institutionId).maybeSingle()
      mimsApiKey = inst?.mims_api_key || null
    }
    const adapter = getCdsAdapter(mimsApiKey)
    const result = await adapter.checkSafety({
      patientId, ageInMonths, weightKg, drugName, atcCode, hkRegistrationNumber,
      dosage, unit, frequency, currentMedicationAtcCodes,
    })
    return res.status(200).json(result)
  } catch (err) {
    // Fail safe, not fail silent - a real error here means the safety
    // check itself couldn't run, which the caller needs to know clearly
    // rather than assume CLEAR by default.
    return res.status(502).json({ safetyStatus: 'ERROR', message: 'Safety check service unavailable - verify manually before proceeding.' })
  }
}
