// Public insurer API - checks a patient's eligibility/coverage under
// their held plan, by HKID (Medsa resolves which plan) or by a known
// policyNumber (a Medsa insurance_plans.id) directly. No clinic or
// patient app involved - this is Medsa's adjudication engine rented out
// directly to an insurer that has no other relationship with Medsa.
import { authenticateApiClient, logApiUsage } from '../../../lib/apiAuth'
import { getInsuranceAdapter } from '../../../lib/insuranceAdapter'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { client, error: authError } = await authenticateApiClient(req)
  if (authError) return res.status(401).json({ error: authError })

  // A key with no insurer scoping configured can't be trusted to query
  // anyone's policies - see set_partner_checkpoint.js, which sets this on
  // every key issued through the real onboarding flow. Fails closed
  // rather than silently allowing unrestricted access.
  if (!client.insurer_company_name) {
    logApiUsage(client.id, 'eligibility', 403)
    return res.status(403).json({ error: 'This API key has no insurer scoping configured - contact Medsa admin.' })
  }

  const { hkid, policyNumber } = req.body || {}
  if (!hkid && !policyNumber) {
    logApiUsage(client.id, 'eligibility', 400)
    return res.status(400).json({ error: 'hkid or policyNumber is required' })
  }

  const adapter = getInsuranceAdapter()
  const result = await adapter.checkEligibility(
    hkid
      ? { verificationMethod: 'HKID_LOOKUP', verificationPayload: { hkid }, clinicId: client.id, restrictToCompanyName: client.insurer_company_name }
      : { policyNumber, clinicId: client.id, restrictToCompanyName: client.insurer_company_name }
  )

  logApiUsage(client.id, 'eligibility', 200)
  return res.status(200).json(result)
}
