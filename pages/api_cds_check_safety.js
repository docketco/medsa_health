// pages/api/cds/check-safety.js
//
// Real backend proxy for the drug safety check. The frontend never talks
// to a third-party drug database directly - it always goes through this
// endpoint, so a real API key (once one exists) stays server-side and is
// never shipped to the browser. Currently backed by the mock adapter;
// swapping getCdsAdapter() for a real implementation in lib/cdsAdapter.js
// is the only change needed to go live with a genuine connection.

import { getCdsAdapter } from '../../../lib/cdsAdapter'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { patientId, ageInMonths, weightKg, drugName, atcCode, hkRegistrationNumber, dosage, unit, frequency, currentMedicationAtcCodes } = req.body

  if (!patientId || !drugName) {
    return res.status(400).json({ error: 'patientId and drugName are required' })
  }

  try {
    const adapter = getCdsAdapter()
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
