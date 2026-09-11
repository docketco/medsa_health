// lib/insuranceAdapter.js
// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER PATTERN — Direct Billing & Zero-Touch Claims
//
// This defines the real, production-shaped contract every insurer
// integration will satisfy. Right now only MockInsuranceAdapter exists,
// built against real patient/plan data already in Supabase (not random
// numbers) - but every method signature here is exactly what a real
// insurer's API adapter will need to implement later. When a real insurer
// partnership happens, a new file (e.g. aiaInsuranceAdapter.js) gets
// written against this same interface - checkout, ClaimsScreen, and the
// database layer never need to change.
//
// No TypeScript in this codebase, so the contract is enforced via JSDoc
// instead - same clarity, same editor autocomplete/type-checking, no new
// toolchain.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// ── SINGLE SOURCE OF TRUTH — platform fee rates ──────────────────────────────
// These are Medsa's real, live rates - moved here from ClaimsScreen's old
// calcFee() and PaymentScreen's old processingFee(), which each maintained
// their own separate copy. Both screens now call these instead, so a rate
// change only ever happens in one place.

/**
 * Platform claim processing fee - paid by the insurer per validated claim,
 * never deducted from what the clinic receives on the claim itself.
 * @param {number} amount @returns {number}
 */
export function calculatePlatformClaimFee(amount) {
  const n = parseFloat(amount) || 0
  return Math.round(n * 0.02 + 10) // 2% + HK$10 flat
}

/**
 * Payment gateway processing fee - method-specific, applies to whatever
 * portion is actually collected via card/Octopus at the point of payment.
 * @param {'card'|'octopus'|'cash'} method @param {number} amount @returns {number}
 */
export function calculatePaymentProcessingFee(method, amount) {
  const n = parseFloat(amount) || 0
  if (method === 'card') return Math.round(n * 0.0275 * 100) / 100
  if (method === 'octopus') return Math.round(n * 0.015 * 100) / 100
  return 0 // cash carries no processing fee
}

/**
 * @typedef {Object} FeeBreakdown
 * @property {number} grossAmount
 * @property {number} insurerCoveredAmount
 * @property {number} patientPayableTotal
 * @property {number} platformClaimFee - paid by insurer, not deducted from clinic
 * @property {number} paymentProcessingFee - deducted from whatever's collected via card/Octopus
 * @property {number} totalPlatformFeeEarned - Medsa's total revenue on this transaction
 * @property {number} clinicNetPayout - what the clinic actually receives
 */

/**
 * Builds the full fee breakdown for a claim. clinicNetPayout only ever
 * subtracts paymentProcessingFee, never platformClaimFee - matching the
 * existing, already-communicated design that the claim fee is insurer-side.
 * @param {number} grossAmount @param {number} insurerCoveredAmount
 * @param {number} patientPayableTotal @param {'card'|'octopus'|'cash'} [paymentMethod]
 * @returns {FeeBreakdown}
 */
export function buildFeeBreakdown(grossAmount, insurerCoveredAmount, patientPayableTotal, paymentMethod = 'cash') {
  const platformClaimFee = calculatePlatformClaimFee(grossAmount)
  const paymentProcessingFee = calculatePaymentProcessingFee(paymentMethod, patientPayableTotal)
  return {
    grossAmount, insurerCoveredAmount, patientPayableTotal,
    platformClaimFee, paymentProcessingFee,
    totalPlatformFeeEarned: platformClaimFee + paymentProcessingFee,
    clinicNetPayout: grossAmount - paymentProcessingFee,
  }
}

/**
 * @typedef {Object} EligibilityRequest
 * @property {string} patientId
 * @property {string} policyNumber
 * @property {string} insurerCode
 * @property {string} clinicId
 * @property {string} [restrictToCompanyName] - set only by the direct
 *   insurer API (see pages/api/v1/*) to the calling api_clients row's own
 *   insurer_company_name. When set, a resolved plan belonging to a
 *   different insurer is treated as ineligible rather than answered -
 *   an insurer's own API key must never be able to read or adjudicate
 *   another insurer's policies. ClinicOps/TPA calls never set this, since
 *   they're trusted internal callers with no single-insurer restriction.
 */

/**
 * @typedef {Object} EligibilityResponse
 * @property {boolean} isEligible
 * @property {string} planName
 * @property {number} copayRate - e.g. 0.10 for 10%
 * @property {number} deductibleRemaining
 */

/**
 * @typedef {Object} ClaimItem
 * @property {string} code - e.g. "CONSULT_GEN", "MED_PANADOL"
 * @property {string} description
 * @property {number} amount
 */

/**
 * @typedef {Object} AdjudicationRequest
 * @property {string} patientId
 * @property {string} policyNumber
 * @property {string} clinicId - a native clinic's institution id, OR an external_clinics.id when sourceType is 'external_clinic'
 * @property {ClaimItem[]} items
 * @property {number} totalGrossAmount
 * @property {'clinic_ops'|'external_clinic'|'api_client'} [sourceType] - defaults to 'clinic_ops'
 * @property {string} [apiClientId] - an api_clients.id, required when sourceType is 'api_client'
 * @property {string} [restrictToCompanyName] - see EligibilityRequest; forwarded into the internal checkEligibility call
 */

/**
 * @typedef {Object} AdjudicationResponse
 * @property {string} claimId
 * @property {'APPROVED'|'PARTIALLY_APPROVED'|'REJECTED'|'PENDING_REVIEW'} status
 * @property {FeeBreakdown} fees
 * @property {number} deductibleApplied
 * @property {string} authorizationCode
 * @property {string} adjudicatedAt
 */

/**
 * The interface every insurance adapter must satisfy - real or mock.
 * @interface InsuranceAdapter
 */
export class InsuranceAdapter {
  /** @param {EligibilityRequest} req @returns {Promise<EligibilityResponse>} */
  async checkEligibility(req) { throw new Error('Not implemented') }
  /** @param {AdjudicationRequest} req @returns {Promise<AdjudicationResponse>} */
  /** @param {{patientId: string, policyNumber: string, clinicId: string, totalGrossAmount: number, items: object[], medicalRecordId?: string}} req */
  async adjudicateClaim(req) { throw new Error('Not implemented') }
  /** @param {string} claimId @returns {Promise<{success: boolean, settledAt: string}>} */
  async settleClaim(claimId) { throw new Error('Not implemented') }
  /**
   * Reconciles the claim's real payment processing fee once the patient's
   * actual payment method is known - adjudication happens before the
   * patient checks out, so the fee is a $0 placeholder until this runs.
   * @param {string} claimId @param {'card'|'octopus'|'cash'} paymentMethod
   * @returns {Promise<FeeBreakdown>}
   */
  async recordCopayPayment(claimId, paymentMethod) { throw new Error('Not implemented') }
}

// ── MOCK IMPLEMENTATION ──────────────────────────────────────────────────────
// Built against real patient/plan data already in Supabase - eligibility and
// coverage rates reflect the patient's actual linked insurance_plans row, not
// random numbers. What's mocked is specifically the parts that genuinely
// require a real insurer's own system: instant, automatic, cross-institution
// adjudication. Everything else here is real logic on real data.
// ── MATCHING ENGINE ──────────────────────────────────────────────────────────
// Takes the real itemized line_items from a visit and a patient's held
// plans, and determines which plans would actually cover this specific
// visit - not just which plans the patient happens to hold (that's what
// ClaimsScreen did before this, via agent_policies alone). Matches each
// item's category against covered_categories per plan.
export async function findEligiblePlans(patientId, lineItems) {
  const { data: policies } = await supabase.from('agent_policies')
    .select('*, insurance_plans(*)').eq('patient_id', patientId).eq('status', 'active')

  const itemCategories = [...new Set((lineItems || []).map(i => i.category).filter(Boolean))]

  return (policies || [])
    .map(p => p.insurance_plans)
    .filter(Boolean)
    .map(plan => {
      const covered = plan.covered_categories || []
      const coveredItems = itemCategories.filter(c => covered.includes(c))
      const uncoveredItems = itemCategories.filter(c => !covered.includes(c))
      return {
        plan,
        fullyCovered: uncoveredItems.length === 0 && coveredItems.length > 0,
        partiallyCovered: coveredItems.length > 0 && uncoveredItems.length > 0,
        notCovered: coveredItems.length === 0,
        coveredItems, uncoveredItems,
      }
    })
    // Plans with zero relevant coverage aren't worth showing in a "which
    // plan should I bill this to" picker - they'd never be chosen.
    .filter(m => m.coveredItems.length > 0)
    // Fully-covered plans first, since that's almost always the better choice.
    .sort((a, b) => (b.fullyCovered ? 1 : 0) - (a.fullyCovered ? 1 : 0))
}

export class MockInsuranceAdapter extends InsuranceAdapter {
  /**
   * Checks a real policy number/HKID against the insurer's own records,
   * when they've configured how (see add_insurer_policy_verification
   * migration) - the piece that was missing entirely before: a plan being
   * registered in Medsa's own Coverage Rules never meant anyone checked a
   * claim's policy number against anything real. Company name is matched
   * the same exact way the rest of this codebase already links
   * insurance_plans to insurance_companies (no FK, text match on name).
   *
   * Roster mode returns more than a yes/no when the matched row itself
   * carries coverage terms (copay_rate/annual_deductible_hkd/
   * overall_annual_limit_hkd/category_limits) - a real insurer's
   * individual policy numbers each have their own negotiated terms, not
   * one shared rate card, so this lets Medsa calculate straight off the
   * bulk-uploaded policy itself instead of requiring every policyholder
   * be manually mapped to a hand-built shared plan first. Null on the
   * roster row for any of these just means "use the shared plan's own
   * value" - existing roster rows uploaded for verification-only,
   * before this existed, behave exactly as before.
   * @returns {Promise<{checked: boolean, verified: boolean, coverageOverrides?: object}>}
   *   checked:false means "skip this, nothing configured" - never treated
   *   as a failure.
   */
  async _verifyPolicyAgainstInsurer(companyName, { policyNumber, hkid }) {
    if (!companyName) return { checked: false, verified: true }
    const { data: company } = await supabase.from('insurance_companies')
      .select('id, verification_mode').eq('name', companyName).maybeSingle()
    if (!company || !company.verification_mode || company.verification_mode === 'none') {
      return { checked: false, verified: true }
    }
    // Insurer opted into verification but there's nothing to check it
    // against - a real gap (front desk never recorded the patient's
    // actual card number), not something to silently pass.
    if (!policyNumber && !hkid) return { checked: true, verified: false }

    if (company.verification_mode === 'roster') {
      let query = supabase.from('insurer_policy_roster')
        .select('status, copay_rate, annual_deductible_hkd, overall_annual_limit_hkd, category_limits')
        .eq('insurance_company_id', company.id)
      query = policyNumber ? query.eq('policy_number', policyNumber) : query.eq('hkid', hkid)
      const { data: rosterRow } = await query.maybeSingle()
      if (!rosterRow || rosterRow.status !== 'active') return { checked: true, verified: false }
      return {
        checked: true, verified: true,
        coverageOverrides: {
          copayRate: rosterRow.copay_rate, annualDeductibleHkd: rosterRow.annual_deductible_hkd,
          overallAnnualLimitHkd: rosterRow.overall_annual_limit_hkd, categoryLimits: rosterRow.category_limits,
        },
      }
    }

    if (company.verification_mode === 'api') {
      // Own-origin call, resolved to an absolute URL - this file runs
      // both in the browser (relative fetch works fine) and inside
      // pages/api/v1/*.js (needs an absolute one), since it always talks
      // to the plain anon Supabase client either way and has no service-
      // role access itself to read the insurer's key directly.
      const base = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health')
      try {
        const res = await fetch(`${base}/api/insurer/verify_policy`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: company.id, policyNumber, hkid }),
        })
        const json = await res.json()
        return { checked: !!json.checked, verified: json.verified !== false }
      } catch {
        return { checked: false, verified: true }
      }
    }

    return { checked: false, verified: true }
  }

  /**
   * insurance_claims.plan_id (and every join built on it, e.g. the
   * insurer portal's claims log) expects a real insurance_plans row to
   * exist - a roster-resolved policy still needs one to point at, even
   * though its real terms come from the roster row itself, not this
   * plan's own fields. One fallback row per company, reused across every
   * roster-resolved policy for that insurer, created lazily the first
   * time it's needed rather than requiring the insurer to set anything
   * up first.
   */
  async _findOrCreateRosterFallbackPlan(companyName) {
    const { data: existing } = await supabase.from('insurance_plans')
      .select('id').eq('company_name', companyName).eq('created_by', 'roster-fallback').maybeSingle()
    if (existing) return existing.id
    const { data: created } = await supabase.from('insurance_plans').insert({
      company_name: companyName, plan_name: 'Roster-based coverage', status: 'active',
      self_serve_only: true, created_by: 'roster-fallback',
    }).select('id').maybeSingle()
    return created?.id || null
  }

  /**
   * Resolves a policyNumber from whichever verification method was used.
   * Backward compatible: if req.verificationMethod isn't set, falls back
   * to the original flat req.policyNumber (what ClaimsScreen already
   * calls with) so this doesn't break the existing caller.
   */
  async _resolvePolicyNumber(req) {
    if (!req.verificationMethod) return { policyNumber: req.policyNumber, error: null }

    const payload = req.verificationPayload || {}
    switch (req.verificationMethod) {
      case 'PHYSICAL_CARD':
        return { policyNumber: payload.policyNumber, error: payload.policyNumber ? null : 'policyNumber required for PHYSICAL_CARD' }

      case 'HKID_LOOKUP': {
        if (!payload.hkid) return { policyNumber: null, error: 'hkid required for HKID_LOOKUP' }
        const { data: patient } = await supabase.from('patients').select('id').eq('hkid', payload.hkid).maybeSingle()
        if (!patient) return { policyNumber: null, error: 'No patient found for this HKID' }
        const { data: policy } = await supabase.from('agent_policies').select('plan_id')
          .eq('patient_id', patient.id).eq('status', 'active').limit(1).maybeSingle()
        // patientId flows back out so checkEligibility can scope deductible
        // tracking to this specific policyholder, not just the plan
        // product - see the comment at that usage for why that matters.
        return { policyNumber: policy?.plan_id || null, patientId: patient.id, error: policy ? null : 'No active policy found for this patient' }
      }

      case 'ROSTER_POLICY_NUMBER': {
        // Resolves straight off a bulk-uploaded roster row - no shared
        // insurance_plans row needs to already exist for this company at
        // all (see _findOrCreateRosterFallbackPlan). This is the "just
        // read their policy codes" path: an insurer's real policy number
        // already carries its own terms once uploaded (see
        // add_per_policy_coverage_to_roster), so a claim can be
        // adjudicated off the policy number/HKID alone.
        if (!payload.companyName) return { policyNumber: null, error: 'companyName required for ROSTER_POLICY_NUMBER' }
        if (!payload.policyNumber && !payload.hkid) return { policyNumber: null, error: 'policyNumber or hkid required for ROSTER_POLICY_NUMBER' }
        const { data: company } = await supabase.from('insurance_companies').select('id').eq('name', payload.companyName).maybeSingle()
        if (!company) return { policyNumber: null, error: `No insurer account found named "${payload.companyName}"` }
        let rosterQuery = supabase.from('insurer_policy_roster').select('status').eq('insurance_company_id', company.id)
        rosterQuery = payload.policyNumber ? rosterQuery.eq('policy_number', payload.policyNumber) : rosterQuery.eq('hkid', payload.hkid)
        const { data: rosterRow } = await rosterQuery.maybeSingle()
        if (!rosterRow || rosterRow.status !== 'active') {
          return { policyNumber: null, error: `No active policy found for this ${payload.policyNumber ? 'policy number' : 'HKID'} at ${payload.companyName}` }
        }
        const fallbackPlanId = await this._findOrCreateRosterFallbackPlan(payload.companyName)
        if (!fallbackPlanId) return { policyNumber: null, error: 'Could not resolve a plan record for this policy.' }
        // Resolved only when an HKID was given - a bare policy number
        // alone can't be traced back to a specific Medsa patient, same
        // known edge case as PHYSICAL_CARD/flat policyNumber lookups.
        let patientId = null
        if (payload.hkid) {
          const { data: patient } = await supabase.from('patients').select('id').eq('hkid', payload.hkid).maybeSingle()
          patientId = patient?.id || null
        }
        return { policyNumber: fallbackPlanId, patientId, error: null }
      }

      case 'CORPORATE_STAFF_ID': {
        if (!payload.employeeId) return { policyNumber: null, error: 'employeeId required for CORPORATE_STAFF_ID' }
        // Corporate roster coverage isn't an insurance_plans row - it's
        // verified directly against the roster, so this returns early
        // with its own eligibility shape rather than a policyNumber to
        // resolve through the normal insurance_plans path below.
        return { corporateRoster: true, employeeId: payload.employeeId }
      }

      case 'DYNAMIC_QR':
        // Needs a real QR-token table (token -> policyNumber, with
        // expiry) that doesn't exist yet - not faking this.
        return { policyNumber: null, error: 'DYNAMIC_QR verification not yet implemented - needs a QR token table' }

      case 'GOP_NUMBER':
        // Needs a real Guarantee-of-Payment tracking table that doesn't
        // exist yet - not faking this either.
        return { policyNumber: null, error: 'GOP_NUMBER verification not yet implemented - needs GOP tracking' }

      default:
        return { policyNumber: null, error: `Unknown verificationMethod: ${req.verificationMethod}` }
    }
  }

  async checkEligibility(req) {
    const resolved = await this._resolvePolicyNumber(req)

    if (resolved.corporateRoster) {
      // Note: the EligibilityRequest payload for CORPORATE_STAFF_ID only
      // has employeeId, not companyId - employee IDs aren't guaranteed
      // unique across different companies' rosters, so a match here can
      // genuinely be ambiguous. Surfacing that rather than silently
      // picking one - this is a real gap in the interface as specified,
      // worth adding companyId to the payload to resolve properly.
      const { data: matches } = await supabase.from('corporate_roster').select('*, companies(name)')
        .eq('employee_id', resolved.employeeId)
      if (!matches || matches.length === 0) {
        return { isEligible: false, planName: '', copayRate: 0, deductibleRemaining: 0, verificationError: 'No roster entry found for this employeeId' }
      }
      if (matches.length > 1) {
        return { isEligible: false, planName: '', copayRate: 0, deductibleRemaining: 0, verificationError: 'employeeId matches multiple companies - companyId needed to disambiguate' }
      }
      const roster = matches[0]
      const today = new Date().toISOString().slice(0,10)
      const isActive = roster.status === 'ACTIVE' && (!roster.expiry_date || roster.expiry_date >= today)
      return {
        isEligible: isActive,
        planName: `${roster.companies?.name || 'Corporate'} - ${roster.benefit_tier_code || 'Standard'}`,
        copayRate: 0, deductibleRemaining: 0, // corporate roster coverage doesn't use the deductible model below
      }
    }

    if (resolved.error) {
      return { isEligible: false, planName: '', copayRate: 0, deductibleRemaining: 0, verificationError: resolved.error }
    }

    const { data: plan } = await supabase.from('insurance_plans').select('*')
      .eq('id', resolved.policyNumber).maybeSingle()

    if (!plan || plan.status !== 'active') {
      return { isEligible: false, planName: '', copayRate: 0, deductibleRemaining: 0 }
    }

    if (req.restrictToCompanyName && plan.company_name?.trim().toLowerCase() !== req.restrictToCompanyName.trim().toLowerCase()) {
      return { isEligible: false, planName: '', copayRate: 0, deductibleRemaining: 0, verificationError: `This API key is not authorized for ${plan.company_name}'s plans.` }
    }

    // Mock deductible tracking - a real adapter would query this from the
    // insurer's own system; here it's derived from claims already recorded
    // this policy year, using real data already in insurance_claims.
    // Scoped to this specific policyholder, not just the plan product -
    // insurance_plans rows are a shared catalog (e.g. many different
    // patients can each hold their own "AIA Critical Rider" policy under
    // the same plan_id), so filtering by plan_id alone would pool every
    // one of those patients' claims into a single shared deductible
    // bucket instead of tracking each policyholder's own consumption.
    // patientId is only unknown for a bare policyNumber lookup with no
    // HKID and no caller-supplied patientId - an edge case no real
    // caller should hit (every real path resolves a specific patient
    // first), so it falls back to the old plan-wide number rather than
    // erroring outright.
    const patientId = resolved.patientId || req.patientId

    // Real agent_policies row for this specific policyholder, read once
    // and reused below - carries both the real card/policy number a human
    // typed in (never the same as resolved.policyNumber, which is this
    // plan's own catalog id/UUID) and the cover start date.
    const policyRow = patientId ? (await supabase.from('agent_policies')
      .select('start_date, policy_number').eq('patient_id', patientId).eq('plan_id', plan.id).eq('status', 'active')
      .order('start_date', { ascending: false }).limit(1).maybeSingle()).data : null

    // Waiting period - a plan can require N days on cover before it pays
    // anything at all. Only checkable when there's a real agent_policies
    // row to read a start_date from (a bare policyNumber lookup with no
    // known patient has nothing to check this against, same edge case
    // noted above for the deductible bucket).
    if (plan.waiting_period_days && policyRow?.start_date) {
      const waitingPeriodEnds = new Date(policyRow.start_date)
      waitingPeriodEnds.setDate(waitingPeriodEnds.getDate() + plan.waiting_period_days)
      if (new Date() < waitingPeriodEnds) {
        return { isEligible: false, planName: '', copayRate: 0, deductibleRemaining: 0, verificationError: `This plan's ${plan.waiting_period_days}-day waiting period doesn't end until ${waitingPeriodEnds.toISOString().slice(0,10)}.` }
      }
    }

    // Verify the real policy number against the insurer's own records,
    // when they've told Medsa how to (see add_insurer_policy_verification
    // migration) - a self-serve/TPA-tier insurer can do this without a
    // full adjudication partnership, by uploading a roster or handing us
    // a lookup key. Skips (never blocks) when the insurer hasn't
    // configured this, or when there's no real policy number on file to
    // check in the first place and verification wasn't requested.
    const { checked: insurerChecked, verified: insurerVerified, coverageOverrides } = await this._verifyPolicyAgainstInsurer(
      plan.company_name, { policyNumber: policyRow?.policy_number || null, hkid: req.verificationPayload?.hkid || null }
    )
    if (insurerChecked && !insurerVerified) {
      return { isEligible: false, planName: '', copayRate: 0, deductibleRemaining: 0, verificationError: `Could not verify this policy against ${plan.company_name}'s own records.` }
    }

    // A bulk-uploaded roster row can carry its own real terms (a
    // policyholder's individual negotiated rate, not a shared plan
    // everyone gets) - those win over the plan's own defaults wherever
    // set, so an insurer never has to hand-build a matching plan in
    // Medsa's UI for coverage math to be accurate. Null on the roster row
    // for any of these just falls through to the plan's own value,
    // unchanged from before this existed.
    const effectiveCopayRate = coverageOverrides?.copayRate ?? plan.copay_rate
    const effectiveAnnualDeductible = coverageOverrides?.annualDeductibleHkd ?? plan.annual_deductible_hkd
    const effectiveOverallLimit = coverageOverrides?.overallAnnualLimitHkd ?? plan.overall_annual_limit_hkd
    const effectiveCategoryLimits = (coverageOverrides?.categoryLimits && Object.keys(coverageOverrides.categoryLimits).length > 0)
      ? coverageOverrides.categoryLimits : (plan.category_limits || {})

    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
    let deductibleQuery = supabase.from('insurance_claims').select('amount').eq('plan_id', plan.id)
    if (patientId) deductibleQuery = deductibleQuery.eq('patient_id', patientId)
    const { data: priorClaims } = await deductibleQuery.gte('submitted_at', yearStart)
    const usedThisYear = (priorClaims||[]).reduce((sum, c) => sum + (c.amount||0), 0)
    // Real, insurer-configured deductible when one's set (roster override,
    // Plan Manager, or the self-serve Coverage Rules screen) - falls back
    // to the old flat placeholder only for a plan nobody's ever configured.
    const annualDeductible = effectiveAnnualDeductible ?? 500
    const deductibleRemaining = Math.max(0, annualDeductible - usedThisYear)

    // Overall annual plan limit - same claims history already pulled for
    // the deductible, just checked against a second, independent cap when
    // one's set. Absent (null) means uncapped, same as today.
    if (effectiveOverallLimit != null && usedThisYear >= effectiveOverallLimit) {
      return { isEligible: false, planName: '', copayRate: 0, deductibleRemaining: 0, verificationError: `This policy's annual limit of HK$${effectiveOverallLimit.toLocaleString()} has already been used this year.` }
    }
    const overallLimitRemaining = effectiveOverallLimit != null ? Math.max(0, effectiveOverallLimit - usedThisYear) : null

    return {
      isEligible: true,
      planName: `${plan.plan_name} (${plan.company_name})`,
      copayRate: effectiveCopayRate ?? 0.10, // real, policy-specific - 0 means fully covered
      deductibleRemaining,
      overallLimitRemaining,
      categoryLimits: effectiveCategoryLimits,
      preauthThresholdHkd: plan.preauth_threshold_hkd ?? null,
      // The caller (adjudicateClaim) only ever handed in a flat
      // policyNumber before verificationMethod existed - now that
      // resolution can happen in here (e.g. HKID_LOOKUP), the resolved
      // value has to come back out too, or the caller has nothing to
      // write the claim against.
      resolvedPolicyNumber: resolved.policyNumber,
    }
  }

  /**
   * Never blocks a claim from being submitted - a claim always goes
   * through. What this decides is whether the treating practitioner is
   * verified enough to let the claim auto-settle, or whether it has to be
   * flagged and land in front of a person instead.
   *
   * - A practitioner with an active, e-PC-verified staff_credentials row
   *   is clinic-vouched - that's the strong signal, nothing more needed.
   * - Otherwise (a freelance/out-of-network practitioner), a real
   *   Business-Registration match in verified_practitioners is the next
   *   best signal - but if this specific plan requires a doctor referral
   *   for allied health, that match alone still isn't enough without a
   *   matching referral on file.
   * - No medical record to check against at all - still flagged, since
   *   there's nothing to verify against.
   * @returns {Promise<{flag: string|null, referralId: string|null}>}
   */
  async _checkPractitionerVerification(medicalRecordId, plan) {
    if (!medicalRecordId) return { flag: 'unverified_practitioner', referralId: null }
    const { data: record } = await supabase.from('medical_records')
      .select('doctor_name, patient_id').eq('id', medicalRecordId).maybeSingle()
    if (!record?.doctor_name) return { flag: 'unverified_practitioner', referralId: null }

    const { data: staffMatch } = await supabase.from('staff_credentials')
      .select('verification_status, has_epc').eq('full_name', record.doctor_name).eq('status', 'active').maybeSingle()
    if (staffMatch?.verification_status === 'verified' && staffMatch?.has_epc) {
      return { flag: null, referralId: null } // clinic-vouched
    }

    const { data: freelancer } = await supabase.from('verified_practitioners')
      .select('br_status').eq('practitioner_name_declared', record.doctor_name).maybeSingle()
    const brMatched = freelancer?.br_status === 'matched'

    if (plan?.requires_doctor_referral_for_allied_health) {
      const { data: referral } = await supabase.from('referrals')
        .select('id').eq('referred_to_practitioner_name', record.doctor_name)
        .eq('patient_id', record.patient_id).eq('status', 'approved')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!referral) return { flag: 'referral_required', referralId: null }
      if (!brMatched) return { flag: 'unverified_practitioner', referralId: referral.id }
      return { flag: null, referralId: referral.id }
    }

    return { flag: brMatched ? null : 'unverified_practitioner', referralId: null }
  }

  async adjudicateClaim(req) {
    // Forwards verificationMethod/verificationPayload through to
    // checkEligibility when the caller has them (e.g. the TPA portal,
    // which only has a patient's HKID and no plan_id to hand over
    // directly) - existing callers that already resolve a flat
    // policyNumber themselves (ClinicOps's ClaimsScreen) don't set these
    // and are unaffected.
    const eligibility = await this.checkEligibility({
      patientId: req.patientId, policyNumber: req.policyNumber,
      insurerCode: '', clinicId: req.clinicId,
      verificationMethod: req.verificationMethod, verificationPayload: req.verificationPayload,
      restrictToCompanyName: req.restrictToCompanyName,
    })

    const resolvedPolicyNumber = eligibility.resolvedPolicyNumber || req.policyNumber
    const claimId = `CLM-${Date.now().toString(36).toUpperCase()}`
    const adjudicatedAt = new Date().toISOString()

    if (!eligibility.isEligible) {
      // verificationError (e.g. "no patient found for this HKID", "no
      // active policy found") used to get silently dropped here - a
      // caller only ever saw a bare REJECTED with no way to tell "this
      // patient genuinely isn't covered" apart from "we couldn't even
      // identify who this claim is for." That distinction barely
      // mattered when every caller pre-resolved a policyNumber
      // themselves (ClinicOps), but it's the single most common failure
      // for a caller using HKID_LOOKUP (the TPA portal).
      return {
        claimId, status: 'REJECTED', deductibleApplied: 0,
        fees: buildFeeBreakdown(req.totalGrossAmount, 0, req.totalGrossAmount),
        authorizationCode: '', adjudicatedAt,
        verificationError: eligibility.verificationError || null,
      }
    }

    const { data: plan } = await supabase.from('insurance_plans').select('*').eq('id', resolvedPolicyNumber).maybeSingle()
    const { flag: verificationFlag, referralId } = await this._checkPractitionerVerification(req.medicalRecordId, plan)

    // Per-category, per-visit sub-limits (e.g. physiotherapy capped at
    // HK$300/visit even under a plan with an otherwise-generous overall
    // limit) - the portion of any one item above its category's cap is
    // never insurable at all, so it's pulled out of the pool that runs
    // through deductible/coinsurance below rather than being discounted
    // by the plan's copay rate like a normal covered charge. Items carry
    // their category in `code` (see findEligiblePlans' lineItems.category
    // -> ClaimItem.code convention, e.g. ClinicOpsApp's
    // handleDirectBillingSubmit). No category_limits set (every plan
    // before this) means zero overage and identical behavior to before.
    const categoryLimits = eligibility.categoryLimits || {}
    const categoryOverage = (req.items || []).reduce((sum, item) => {
      const limit = categoryLimits[item.code]?.per_visit_limit_hkd
      if (limit == null) return sum
      return sum + Math.max(0, (item.amount || 0) - limit)
    }, 0)
    const insurableAmount = Math.max(0, req.totalGrossAmount - categoryOverage)

    const deductibleApplied = Math.min(eligibility.deductibleRemaining, insurableAmount)
    const afterDeductible = insurableAmount - deductibleApplied
    const patientCopayAmount = Math.round(afterDeductible * eligibility.copayRate * 100) / 100
    let insurerCoveredAmount = afterDeductible - patientCopayAmount
    // Overall annual plan limit - caps total insurer payout regardless of
    // what the copay math above worked out to; any shortfall becomes the
    // patient's own cost, same as a category overage.
    if (eligibility.overallLimitRemaining != null) insurerCoveredAmount = Math.min(insurerCoveredAmount, eligibility.overallLimitRemaining)
    const patientPayableTotal = req.totalGrossAmount - insurerCoveredAmount

    // High-value claims, claims on an unverified/unreferred practitioner,
    // and claims above the plan's own configured pre-authorization
    // threshold all need human review before automatic settlement,
    // regardless of coverage math - checked first, takes priority over the
    // normal approved/partial/rejected outcome below. An unverified/
    // unauthorized claim still goes through - it just never auto-ticks-off.
    const HIGH_VALUE_REVIEW_THRESHOLD = 1000
    const preauthRequired = eligibility.preauthThresholdHkd != null && req.totalGrossAmount > eligibility.preauthThresholdHkd
    const status = verificationFlag ? 'PENDING_REVIEW'
      : preauthRequired ? 'PENDING_REVIEW'
      : req.totalGrossAmount > HIGH_VALUE_REVIEW_THRESHOLD ? 'PENDING_REVIEW'
      : insurerCoveredAmount >= req.totalGrossAmount * 0.99 ? 'APPROVED'
      : insurerCoveredAmount > 0 ? 'PARTIALLY_APPROVED' : 'REJECTED'

    // Payment method for the patient's copay isn't known yet at adjudication
    // time - it's collected separately at checkout, so paymentProcessingFee
    // here defaults to 0 (cash-equivalent) until it's actually collected.
    const fees = buildFeeBreakdown(req.totalGrossAmount, insurerCoveredAmount, patientPayableTotal)
    const authorizationCode = `AUTH-${claimId}`

    // Auto-settle immediately if nothing is owed by the patient - no manual
    // step needed when the claim is already fully resolved. Only applies to
    // real approval outcomes; REJECTED and PENDING_REVIEW never auto-settle.
    const settlesImmediately = (status === 'APPROVED' || status === 'PARTIALLY_APPROVED') && patientPayableTotal === 0
    const finalStatus = settlesImmediately ? 'settled' : status.toLowerCase()
    const settledAt = settlesImmediately ? adjudicatedAt : null

    // Real ICD-10 codes, when the caller supplied them on an item (see
    // ClinicOps's consultation coding and the TPA portal's ICD-10
    // search/AI-suggest) - items used to carry these but nothing ever
    // wrote them to the claim itself. Comma-joined, same convention as
    // medical_records.icd10_code.
    const icd10Codes = [...new Set((req.items||[]).flatMap(i => i.icd10Codes || []))]
    const effectiveVerificationFlag = verificationFlag || (preauthRequired ? 'preauth_required' : null)

    const { error: claimInsertErr } = await supabase.from('insurance_claims').insert({
      claim_ref: claimId, patient_id: req.patientId, plan_id: resolvedPolicyNumber,
      amount: req.totalGrossAmount, status: finalStatus,
      validated: true, submitted_at: adjudicatedAt,
      insurer_covered_amount: insurerCoveredAmount, patient_copay_amount: patientCopayAmount,
      deductible_applied: deductibleApplied, authorization_code: authorizationCode,
      adjudicated_at: adjudicatedAt, platform_claim_fee: fees.platformClaimFee,
      settled_at: settledAt, verification_flag: effectiveVerificationFlag, referral_id: referralId,
      icd10_codes: icd10Codes.length>0 ? icd10Codes.join(', ') : null,
      // Who actually submitted this - defaults to a native ClinicOps
      // clinic (the only source that existed before the TPA portal and
      // the API product). An out-of-network clinic submitting through
      // the TPA portal passes sourceType:'external_clinic' + its own
      // clinicId (an external_clinics.id); an insurer calling the API
      // directly passes sourceType:'api_client' + its own apiClientId
      // (an api_clients.id) - no clinic involved in that case at all.
      // Same adjudication math, same fee either way - just tagged so
      // reporting/billing can tell the three apart.
      source_type: req.sourceType || 'clinic_ops',
      external_clinic_id: req.sourceType === 'external_clinic' ? req.clinicId : null,
      api_client_id: req.sourceType === 'api_client' ? req.apiClientId : null,
    })
    // Separate, standard select rather than chaining .select() directly
    // off .insert() - that chained form isn't supported by every
    // supabase client/mock (broke the test suite's mock specifically),
    // and this is the same claimId already generated above, so a
    // follow-up lookup by claim_ref is just as reliable.
    let insertedClaim = null
    if (!claimInsertErr) {
      const { data } = await supabase.from('insurance_claims').select('id').eq('claim_ref', claimId).maybeSingle()
      insertedClaim = data
    }

    // Link this claim back to the visit's medical_records row, if one was
    // passed - this is what lets a receipt later find the diagnosis and
    // prescriptions that go with this specific claim, rather than the
    // claim and the clinical record being two disconnected things.
    if (!claimInsertErr && insertedClaim && req.medicalRecordId) {
      await supabase.from('medical_records').update({ insurance_claim_id: insertedClaim.id })
        .eq('id', req.medicalRecordId)
    }

    return { claimId, status: settlesImmediately ? 'SETTLED' : status, fees, deductibleApplied, authorizationCode, adjudicatedAt, verificationFlag: effectiveVerificationFlag }
  }

  async settleClaim(claimId) {
    const settledAt = new Date().toISOString()
    await supabase.from('insurance_claims').update({ status: 'settled', settled_at: settledAt })
      .eq('claim_ref', claimId)
    return { success: true, settledAt }
  }

  async recordCopayPayment(claimId, paymentMethod) {
    const { data: claim } = await supabase.from('insurance_claims').select('*')
      .eq('claim_ref', claimId).maybeSingle()
    if (!claim) throw new Error(`Claim ${claimId} not found`)

    // Recalculate with the real payment method now known, replacing the $0
    // placeholder set at adjudication time - same centralized fee function
    // PaymentScreen uses for direct (non-claim) patient payments. The fee
    // applies to the FULL amount collected at checkout (deductible + copay
    // together), not just the copay portion.
    const patientPayableTotal = (claim.deductible_applied ?? 0) + (claim.patient_copay_amount ?? 0)
    const fees = buildFeeBreakdown(claim.amount, claim.insurer_covered_amount, patientPayableTotal, paymentMethod)

    await supabase.from('insurance_claims').update({
      payment_processing_fee: fees.paymentProcessingFee,
      total_platform_fee_earned: fees.totalPlatformFeeEarned,
      clinic_net_payout: fees.clinicNetPayout,
      copay_payment_method: paymentMethod,
      // Collecting the copay is the trigger event that closes the claim -
      // no separate manual "mark settled" step needed.
      status: 'settled', settled_at: new Date().toISOString(),
    }).eq('claim_ref', claimId)

    return fees
  }
}

// ── FACTORY ───────────────────────────────────────────────────────────────
// The single place that decides which adapter to use. Once a real insurer
// is signed, this becomes: return insurerCode === 'AIA' ? new
// AiaInsuranceAdapter() : new MockInsuranceAdapter() - no other file in the
// app needs to change.
export function getInsuranceAdapter(insurerCode) {
  return new MockInsuranceAdapter()
}
