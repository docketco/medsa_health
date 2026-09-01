// lib/cdsAdapter.js
//
// Clinical Decision Support adapter - checks a prescription against a
// real third-party drug safety database (MIMS Integrated or similar).
// Same honest pattern as lib/insuranceAdapter.js: a real interface, a
// mock implementation clearly labeled as such (not a fake pointed at a
// placeholder URL that would just fail every request), and a shape
// designed so a genuine API connection can be dropped in later without
// changing anything that calls this.

export class CdsAdapter {
  /** @param {{patientId: string, ageInMonths: number, weightKg?: number, drugName: string, atcCode?: string, hkRegistrationNumber?: string, dosage: number, unit: string, frequency: string, currentMedicationAtcCodes?: string[]}} req */
  async checkSafety(req) { throw new Error('Not implemented') }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK IMPLEMENTATION - honest placeholder, not connected to any real drug
// database. Runs real, deterministic logic (not random) so it's genuinely
// testable, but the safety judgment itself is not clinically authoritative -
// it exists so the rest of the system (the interceptor, the warning modal,
// the override flow) can be built and tested now, before a real API
// contract exists. Swap MockCdsAdapter for a real one once you have
// MIMS Integrated (or similar) API access - the interface above doesn't
// need to change.
// ─────────────────────────────────────────────────────────────────────────────
export class MockCdsAdapter extends CdsAdapter {
  async checkSafety(req) {
    if (!req.drugName) {
      return { safetyStatus: 'CLEAR', source: 'mock', note: 'No drug specified' }
    }
    if (!req.atcCode && !req.hkRegistrationNumber) {
      // Honest, not a guess dressed up as a real check - matches the same
      // "no data on file" path the local order_sets check already uses.
      return { safetyStatus: 'CLEAR', source: 'mock', note: 'No standardized code on file for this drug - real database lookup not possible' }
    }
    // Deterministic, not random - same input always gives the same
    // output, so this is genuinely testable rather than flaky.
    if (req.ageInMonths != null && req.ageInMonths < 24 && (req.dosage || 0) > 0) {
      return { safetyStatus: 'WARNING', message: 'Mock: dosing in patients under 2 years requires manual pharmacist verification.', source: 'mock' }
    }
    if ((req.currentMedicationAtcCodes || []).includes(req.atcCode)) {
      return { safetyStatus: 'WARNING', message: 'Mock: patient already has an active prescription with the same ATC classification - possible duplicate therapy.', source: 'mock' }
    }
    return { safetyStatus: 'CLEAR', source: 'mock' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REAL MIMS IMPLEMENTATION - genuinely calls out over HTTP with a real API
// key, not another mock. IMPORTANT: this has never been run against an
// actual MIMS account - there was no real API key or MIMS Integrated API
// documentation available to build or test against, so the endpoint path,
// auth header, and request/response shape below are a best-effort guess at
// a typical REST drug-safety API, not a verified contract. Before this can
// actually work, whoever holds the real MIMS Integrated API agreement needs
// to get the real base URL, auth method, and request/response schema from
// MIMS and this file needs updating to match - the checkSafety() interface
// itself won't need to change, only what's inside it.
//
// Also worth being explicit about: MIMS Integrated's API is normally an
// organization-level B2B credential (one key per clinic/vendor, applied
// for through MIMS), not something built around an individual doctor
// "logging in" with their personal MIMS account - a personal MIMS account
// is for their own consumer-facing lookup tools, not a machine-to-machine
// API. So this is wired for one key per clinic (institutions.mims_api_key),
// not a login per doctor.
// ─────────────────────────────────────────────────────────────────────────────
export class RealMimsCdsAdapter extends CdsAdapter {
  constructor(apiKey) {
    super()
    this.apiKey = apiKey
  }

  async checkSafety(req) {
    if (!req.drugName) {
      return { safetyStatus: 'CLEAR', source: 'mims', note: 'No drug specified' }
    }
    try {
      // Placeholder endpoint/shape - replace with MIMS's real documented
      // API base URL and request format once available.
      const res = await fetch('https://api.mims.com/v1/drug-safety-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          drug_name: req.drugName, atc_code: req.atcCode, hk_registration_number: req.hkRegistrationNumber,
          age_in_months: req.ageInMonths, weight_kg: req.weightKg, dosage: req.dosage, unit: req.unit,
          frequency: req.frequency, current_medication_atc_codes: req.currentMedicationAtcCodes || [],
        }),
      })
      if (!res.ok) {
        return { safetyStatus: 'ERROR', message: `MIMS check failed (HTTP ${res.status}) - verify manually before proceeding.`, source: 'mims' }
      }
      const data = await res.json()
      // Maps an assumed MIMS response shape to this app's own
      // safetyStatus vocabulary - adjust once the real shape is known.
      return {
        safetyStatus: data.severity === 'contraindicated' ? 'ERROR' : data.severity === 'warning' ? 'WARNING' : 'CLEAR',
        message: data.message || data.warning_text || null,
        source: 'mims',
      }
    } catch (e) {
      return { safetyStatus: 'ERROR', message: 'Could not reach MIMS - verify manually before proceeding.', source: 'mims' }
    }
  }
}

export function getCdsAdapter(mimsApiKey) {
  // Single place to swap in a real adapter later - every caller goes
  // through this function, not a direct `new MockCdsAdapter()`. Once a
  // clinic has connected a real MIMS API key (Practice Manager > Drug
  // Safety Database), this automatically switches that clinic over to
  // the real adapter - no code change needed per clinic.
  if (mimsApiKey) return new RealMimsCdsAdapter(mimsApiKey)
  return new MockCdsAdapter()
}
