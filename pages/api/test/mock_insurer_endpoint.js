// pages/api/test/mock_insurer_endpoint.js
// ─────────────────────────────────────────────────────────────────────────────
// A stand-in for a real insurer's own member-eligibility endpoint, so the
// "Live lookup API" verification mode (insurer portal > Verify tab) can
// actually be tested end to end without a real insurer having built one.
// Same request/response contract lib/insuranceAdapter.js's
// _verifyPolicyAgainstInsurer expects from a real one: POST
// { policyNumber, hkid }, respond with { valid: boolean, planName? }.
// Point Test Insurer Co's Verify > Live lookup API endpoint URL at this
// route (any string works as the "API key" - this mock doesn't check it,
// since checking it is the real insurer's own job, not something Medsa
// simulates on their behalf) and test with policy number LIVE-001.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_ACTIVE_POLICY_NUMBERS = ['LIVE-001']

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { policyNumber } = req.body || {}
  const valid = TEST_ACTIVE_POLICY_NUMBERS.includes(policyNumber)
  return res.status(200).json({ valid, planName: valid ? 'Live API Test Plan' : null })
}
