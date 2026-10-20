// pages/api/v1/register_plans.js
// ─────────────────────────────────────────────────────────────────────────────
// pm-01, rebuilt as an API instead of a CSV upload - your call, since the
// pivot moved plan registration to Medsa-admin and a one-time file upload
// can't reflect a partner's catalog changing after the fact, or let a
// system like BeeFintech push updates on its own schedule. Same shape as
// InsuranceApp.jsx's "Bulk import plans (CSV)" (handleBulkPlanImport) -
// one row per plan, semicolon-list fields become real arrays, "tiers" is
// still "ageMin-ageMax:monthlyPremium:semiPrivatePremium:privatePremium:
// annualLimit" pairs - just JSON over HTTP instead of a parsed file, so a
// partner's own system can call this whenever its catalog actually
// changes instead of someone re-uploading a CSV by hand.
//
// Auth: same authenticateApiClient key issued via medsa-admin's API
// Clients tab as api/v1/eligibility.js and adjudicate.js use - a key is
// scoped to exactly one insurer_company_name, so a partner can only ever
// register plans under their own name, never anyone else's. Medsa admin
// still has to issue the key in the first place; that's the review gate,
// not a per-plan approval step (same trust level the CSV importer always
// had - whoever's typing/pushing rows is already a trusted partner by
// the time they have write access at all).
// ─────────────────────────────────────────────────────────────────────────────

import { authenticateApiClient, logApiUsage, serviceSupabase as supabase } from '../../../lib/apiAuth'

function splitList(raw) {
  if (Array.isArray(raw)) return raw.map(s=>String(s).trim()).filter(Boolean)
  return String(raw||'').split(';').map(s=>s.trim()).filter(Boolean)
}
function parseTiers(raw) {
  if (!raw) return []
  const entries = Array.isArray(raw) ? raw : String(raw).split(';').map(s=>s.trim()).filter(Boolean)
  return entries.map(entry => {
    if (typeof entry === 'object') return entry
    const [ageRange, monthly, semi, priv, limit] = String(entry).split(':')
    const [ageMin, ageMax] = (ageRange||'').split('-')
    return {
      age_min: parseInt(ageMin,10), age_max: parseInt(ageMax,10),
      monthly_premium: parseFloat(monthly),
      semi_private_premium: semi?.trim?.() ? parseFloat(semi) : null,
      private_premium: priv?.trim?.() ? parseFloat(priv) : null,
      annual_limit: limit?.trim?.() ? parseFloat(limit) : null,
    }
  }).filter(t => Number.isFinite(t.age_min) && Number.isFinite(t.age_max) && Number.isFinite(t.monthly_premium))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { client, error: authError } = await authenticateApiClient(req)
  if (authError) return res.status(401).json({ error: authError })
  if (!client.insurer_company_name) {
    logApiUsage(client.id, 'register_plans', 403)
    return res.status(403).json({ error: 'This API key has no insurer scoping configured - contact Medsa admin.' })
  }

  const { plans } = req.body || {}
  if (!Array.isArray(plans) || plans.length === 0) {
    logApiUsage(client.id, 'register_plans', 400)
    return res.status(400).json({ error: 'plans must be a non-empty array.' })
  }
  if (plans.length > 500) {
    logApiUsage(client.id, 'register_plans', 400)
    return res.status(400).json({ error: 'Max 500 plans per call - split into multiple requests.' })
  }

  const results = { total: plans.length, created: 0, updated: 0, errors: [] }

  for (const row of plans) {
    const planName = row.planName?.trim?.() || row.plan_name?.trim?.()
    if (!planName) { results.errors.push({ row, message: 'planName is required.' }); continue }

    const payload = {
      company_name: client.insurer_company_name, status: 'active',
      plan_name: planName, plan_type: row.planType || row.plan_type || null,
      key_benefits: row.keyBenefits || row.key_benefits || null,
      covered_categories: splitList(row.coveredCategories ?? row.covered_categories),
      covered_conditions: splitList(row.coveredConditions ?? row.covered_conditions),
      insurer_flags: splitList(row.insurerFlags ?? row.insurer_flags),
      additional_terms: row.additionalTerms || row.additional_terms || null,
      pre_existing_condition_policy: row.preExistingConditionPolicy || row.pre_existing_condition_policy || null,
      waiting_period_days: (row.waitingPeriodDays ?? row.waiting_period_days) ? parseInt(row.waitingPeriodDays ?? row.waiting_period_days, 10) : null,
      copay_rate: (row.copayRatePct ?? row.copay_rate_pct) ? parseFloat(row.copayRatePct ?? row.copay_rate_pct)/100 : null,
      annual_deductible_hkd: (row.annualDeductibleHkd ?? row.annual_deductible_hkd) ? parseFloat(row.annualDeductibleHkd ?? row.annual_deductible_hkd) : null,
      commission_rate_pct: (row.commissionRatePct ?? row.commission_rate_pct) != null ? parseFloat(row.commissionRatePct ?? row.commission_rate_pct) : null,
      requires_agent: !!(row.requiresAgent ?? row.requires_agent),
      auto_buy_on_clean: !!(row.autoBuyOnClean ?? row.auto_buy_on_clean),
    }
    const tiersParsed = parseTiers(row.tiers)

    // externalPlanRef lets a partner (BeeFintech, an insurer's own
    // system) identify "this is the same plan I already registered" on
    // a later call, so repeated syncs update the existing row instead
    // of creating a duplicate every time the catalog is re-pushed.
    const externalRef = row.externalPlanRef || row.external_plan_ref || null
    let planId = null
    if (externalRef) {
      const { data: existing } = await supabase.from('insurance_plans')
        .select('id').eq('company_name', client.insurer_company_name).eq('external_plan_ref', externalRef).maybeSingle()
      planId = existing?.id || null
    }

    if (planId) {
      const { error } = await supabase.from('insurance_plans').update(payload).eq('id', planId)
      if (error) { results.errors.push({ row: planName, message: error.message }); continue }
      await supabase.from('insurance_plan_pricing_tiers').delete().eq('plan_id', planId)
      results.updated++
    } else {
      const { data: newPlan, error } = await supabase.from('insurance_plans')
        .insert({ ...payload, external_plan_ref: externalRef }).select().maybeSingle()
      if (error || !newPlan) { results.errors.push({ row: planName, message: error?.message || 'Could not be created.' }); continue }
      planId = newPlan.id
      results.created++
    }

    if (tiersParsed.length > 0) {
      const { error: tErr } = await supabase.from('insurance_plan_pricing_tiers')
        .insert(tiersParsed.map(t => ({ ...t, plan_id: planId })))
      if (tErr) results.errors.push({ row: planName, message: `Plan saved, but pricing tiers failed - ${tErr.message}` })
    }
  }

  logApiUsage(client.id, 'register_plans', 200)
  return res.status(200).json({ status: 'OK', ...results })
}
