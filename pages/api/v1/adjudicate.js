// Public insurer API - adjudicates a claim (deductible/copay math,
// eligibility, practitioner verification) and records it, same engine
// ClinicOps and the TPA portal use. Recorded in insurance_claims tagged
// source_type:'api_client' so it's billable/reportable and so future
// deductible calculations on the same policy stay correct, same as the
// other two sources.
import { authenticateApiClient, logApiUsage, serviceSupabase } from '../../../lib/apiAuth'
import { getInsuranceAdapter } from '../../../lib/insuranceAdapter'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { client, error: authError } = await authenticateApiClient(req)
  if (authError) return res.status(401).json({ error: authError })

  // Same fail-closed insurer scoping as eligibility.js - a key with no
  // insurer_company_name configured can't adjudicate anyone's claims.
  if (!client.insurer_company_name) {
    logApiUsage(client.id, 'adjudicate', 403)
    return res.status(403).json({ error: 'This API key has no insurer scoping configured - contact Medsa admin.' })
  }

  const { hkid, policyNumber, totalGrossAmount, items, medicalRecordId } = req.body || {}
  if (!hkid) {
    logApiUsage(client.id, 'adjudicate', 400)
    return res.status(400).json({ error: 'hkid is required - Medsa needs to identify which patient this claim is for' })
  }
  if (!totalGrossAmount || totalGrossAmount <= 0) {
    logApiUsage(client.id, 'adjudicate', 400)
    return res.status(400).json({ error: 'totalGrossAmount must be a positive number' })
  }

  // Patient identity has to be resolved by Medsa (an insurer calling
  // this API has no concept of a Medsa patient id) - the same HKID also
  // gets forwarded below for policy resolution via HKID_LOOKUP when the
  // insurer doesn't already know the specific policyNumber.
  const { data: patient } = await serviceSupabase.from('patients').select('id').eq('hkid', hkid).maybeSingle()
  if (!patient) {
    logApiUsage(client.id, 'adjudicate', 404)
    return res.status(404).json({ error: 'No Medsa patient found for this HKID' })
  }

  const adapter = getInsuranceAdapter()
  const result = await adapter.adjudicateClaim({
    patientId: patient.id,
    clinicId: client.id,
    sourceType: 'api_client',
    apiClientId: client.id,
    totalGrossAmount: parseFloat(totalGrossAmount),
    items: items || [],
    medicalRecordId: medicalRecordId || null,
    restrictToCompanyName: client.insurer_company_name,
    ...(policyNumber
      ? { policyNumber }
      : { verificationMethod: 'HKID_LOOKUP', verificationPayload: { hkid } }),
  })

  logApiUsage(client.id, 'adjudicate', 200)
  return res.status(200).json(result)
}
