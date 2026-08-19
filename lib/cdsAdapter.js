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

export function getCdsAdapter() {
  // Single place to swap in a real adapter later - every caller goes
  // through this function, not a direct `new MockCdsAdapter()`.
  return new MockCdsAdapter()
}
