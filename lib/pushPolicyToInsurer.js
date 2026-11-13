// lib/pushPolicyToInsurer.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared by the agent's own manual "Push to insurer" button
// (pages/api/agent/push_policy.js) and the automatic calls at every real
// lifecycle event on a policy (submitted to underwriter, underwriter's
// decision, payment confirmed) - per your call, pushing should happen on
// its own at each of those points, not sit behind a button the agent has
// to remember to tap. Each call just relays the policy's CURRENT state
// under a different eventType - never decides anything, same "flag and
// route, don't adjudicate" boundary as every other insurer-facing route.
// Swallows its own "insurer hasn't configured a webhook" case silently
// when called automatically (callers wrap this in .catch(()=>{})) - that's
// expected for most test insurers, not a real failure worth surfacing
// outside the one place (the manual button) where a person is actually
// waiting on the result.
// ─────────────────────────────────────────────────────────────────────────────

export async function pushPolicyToInsurer(supabase, policyId, eventType = 'new_policy') {
  const { data: policy } = await supabase.from('agent_policies')
    .select('id, patient_name, plan_name, plan_id, policy_number, premium, start_date, renewal_date, ward_class, payment_frequency, status, underwriter_status, underwriter_decision_reason, patients(full_name, medsa_id), payer_bank_name, payer_account_number, payer_account_holder_name, insurance_plans(company_name)')
    .eq('id', policyId).maybeSingle()
  if (!policy) throw new Error('Policy not found.')

  const companyName = policy.insurance_plans?.company_name
  if (!companyName) throw new Error("This policy's plan has no linked insurer to push to.")

  const { data: company } = await supabase.from('insurance_companies')
    .select('id, claims_plugin_enabled, claims_webhook_url, claims_webhook_key').ilike('name', companyName).maybeSingle()
  if (!company?.claims_plugin_enabled || !company.claims_webhook_url) {
    throw new Error(`${companyName} hasn't configured a webhook to receive this yet.`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(company.claims_webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(company.claims_webhook_key ? { Authorization: `Bearer ${company.claims_webhook_key}` } : {}),
      },
      body: JSON.stringify({
        eventType,
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
        underwriterStatus: policy.underwriter_status,
        underwriterDecisionReason: policy.underwriter_decision_reason || null,
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
    if (!response.ok) throw new Error(`Insurer endpoint returned ${response.status}.`)
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Could not reach the insurer endpoint (timeout).')
    throw err
  } finally {
    clearTimeout(timeout)
  }
  await supabase.from('agent_policies').update({ pushed_to_insurer_at: new Date().toISOString() }).eq('id', policyId)
}
