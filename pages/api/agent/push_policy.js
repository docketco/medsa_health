// pages/api/agent/push_policy.js
// ─────────────────────────────────────────────────────────────────────────────
// Write-back half of the policy-issuance flow, mirroring push_claim.js
// exactly: an agent issues a policy in Medsa, this pushes it to the
// insurer's own system (same claims_webhook_url/claims_webhook_key/
// claims_plugin_enabled config an insurer already sets up for claims -
// reused rather than adding a second webhook config to manage, even
// though the field names still say "claims" from when that was the only
// event type). Medsa never decides anything here - underwriting
// (whether the insurer accepts this applicant) and where the money
// actually lives stay entirely on the insurer's side; this just relays
// what the agent entered, same "flag and route, don't adjudicate"
// boundary as every other insurer-facing route in this app.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { policyId } = req.body || {}
  if (!policyId) return res.status(400).json({ error: 'policyId is required.' })

  const { data: policy } = await supabase.from('agent_policies')
    .select('id, patient_name, plan_name, plan_id, policy_number, premium, start_date, renewal_date, ward_class, payment_frequency, status, patients(full_name, medsa_id), payer_bank_name, payer_account_number, payer_account_holder_name, insurance_plans(company_name)')
    .eq('id', policyId).maybeSingle()
  if (!policy) return res.status(404).json({ error: 'Policy not found.' })

  const companyName = policy.insurance_plans?.company_name
  if (!companyName) return res.status(400).json({ error: "This policy's plan has no linked insurer to push to." })

  const { data: company } = await supabase.from('insurance_companies')
    .select('id, claims_plugin_enabled, claims_webhook_url, claims_webhook_key').ilike('name', companyName).maybeSingle()
  if (!company?.claims_plugin_enabled || !company.claims_webhook_url) {
    return res.status(403).json({ error: `${companyName} hasn't configured a webhook to receive this yet.` })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(company.claims_webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(company.claims_webhook_key ? { Authorization: `Bearer ${company.claims_webhook_key}` } : {}),
      },
      body: JSON.stringify({
        eventType: 'new_policy',
        patientName: policy.patients?.full_name || policy.patient_name || null,
        medsaId: policy.patients?.medsa_id || null,
        planName: policy.plan_name,
        policyNumber: policy.policy_number || null,
        premiumHkd: policy.premium || null,
        wardClass: policy.ward_class || null,
        paymentFrequency: policy.payment_frequency || null,
        startDate: policy.start_date || null,
        renewalDate: policy.renewal_date || null,
        status: policy.status,
        // As the agent entered it at issuance - kept on Medsa's side only
        // as a record of what was submitted (see create_policy.js), never
        // read or acted on here beyond relaying it onward.
        payment: {
          bankName: policy.payer_bank_name || null,
          accountNumber: policy.payer_account_number || null,
          accountHolderName: policy.payer_account_holder_name || null,
        },
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!response.ok) return res.status(502).json({ error: `Insurer endpoint returned ${response.status}.` })
    await supabase.from('agent_policies').update({ pushed_to_insurer_at: new Date().toISOString() }).eq('id', policyId)
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(502).json({ error: 'Could not reach the insurer endpoint (timeout or network error).' })
  }
}
