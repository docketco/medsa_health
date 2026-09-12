// pages/api/test/mock_insurer_endpoint.js
// ─────────────────────────────────────────────────────────────────────────────
// A stand-in for a real insurer's own member-eligibility endpoint, so the
// "Live lookup API" verification mode (insurer portal > Verify tab) can
// actually be tested end to end without a real insurer having built one.
// Same request/response contract lib/insuranceAdapter.js's
// _verifyPolicyAgainstInsurer expects from a real one: POST
// { policyNumber, hkid }, respond with { valid, planName?, copayRate?,
// annualDeductibleHkd?, overallAnnualLimitHkd?, categoryLimits? } - a real
// insurer's own endpoint is querying their real policy record, so it can
// hand back that specific policy's own negotiated terms, not just whether
// it's active (exactly like a roster row's own coverage columns).
// Point Test Insurer Co's Verify > Live lookup API endpoint URL at this
// route (any string works as the "API key" - this mock doesn't check it,
// since checking it is the real insurer's own job, not something Medsa
// simulates on their behalf) and test with policy number LIVE-001 (carries
// its own terms) or LIVE-002 (valid, but no terms - falls back to the
// plan's own default, same as before this existed).
// ─────────────────────────────────────────────────────────────────────────────

const TEST_POLICIES = {
  'LIVE-001': { planName: 'Live API Test Plan', copayRate: 0.15, annualDeductibleHkd: 1000, overallAnnualLimitHkd: 60000 },
  'LIVE-002': { planName: 'Live API Test Plan (no own terms)' },
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { policyNumber } = req.body || {}
  const policy = TEST_POLICIES[policyNumber]
  if (!policy) return res.status(200).json({ valid: false })
  return res.status(200).json({ valid: true, ...policy })
}
