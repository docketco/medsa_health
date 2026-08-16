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
 * @property {string} clinicId
 * @property {ClaimItem[]} items
 * @property {number} totalGrossAmount
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
        return { policyNumber: policy?.plan_id || null, error: policy ? null : 'No active policy found for this patient' }
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

    // Mock deductible tracking - a real adapter would query this from the
    // insurer's own system; here it's derived from claims already recorded
    // this policy year, using real data already in insurance_claims.
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
    const { data: priorClaims } = await supabase.from('insurance_claims')
      .select('amount').eq('plan_id', plan.id).gte('submitted_at', yearStart)
    const usedThisYear = (priorClaims||[]).reduce((sum, c) => sum + (c.amount||0), 0)
    const annualDeductible = 500 // illustrative flat mock deductible
    const deductibleRemaining = Math.max(0, annualDeductible - usedThisYear)

    return {
      isEligible: true,
      planName: `${plan.plan_name} (${plan.company_name})`,
      copayRate: plan.copay_rate ?? 0.10, // real, plan-specific - 0 means fully covered
      deductibleRemaining,
    }
  }

  async adjudicateClaim(req) {
    const eligibility = await this.checkEligibility({
      patientId: req.patientId, policyNumber: req.policyNumber,
      insurerCode: '', clinicId: req.clinicId,
    })

    const claimId = `CLM-${Date.now().toString(36).toUpperCase()}`
    const adjudicatedAt = new Date().toISOString()

    if (!eligibility.isEligible) {
      return {
        claimId, status: 'REJECTED', deductibleApplied: 0,
        fees: buildFeeBreakdown(req.totalGrossAmount, 0, req.totalGrossAmount),
        authorizationCode: '', adjudicatedAt,
      }
    }

    const deductibleApplied = Math.min(eligibility.deductibleRemaining, req.totalGrossAmount)
    const afterDeductible = req.totalGrossAmount - deductibleApplied
    const patientCopayAmount = Math.round(afterDeductible * eligibility.copayRate * 100) / 100
    const insurerCoveredAmount = afterDeductible - patientCopayAmount
    const patientPayableTotal = deductibleApplied + patientCopayAmount

    // High-value claims need human review before automatic settlement,
    // regardless of coverage math - checked first, takes priority over the
    // normal approved/partial/rejected outcome below.
    const HIGH_VALUE_REVIEW_THRESHOLD = 1000
    const status = req.totalGrossAmount > HIGH_VALUE_REVIEW_THRESHOLD ? 'PENDING_REVIEW'
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

    const { data: insertedClaim, error: claimInsertErr } = await supabase.from('insurance_claims').insert({
      claim_ref: claimId, patient_id: req.patientId, plan_id: req.policyNumber,
      amount: req.totalGrossAmount, status: finalStatus,
      validated: true, submitted_at: adjudicatedAt,
      insurer_covered_amount: insurerCoveredAmount, patient_copay_amount: patientCopayAmount,
      deductible_applied: deductibleApplied, authorization_code: authorizationCode,
      adjudicated_at: adjudicatedAt, platform_claim_fee: fees.platformClaimFee,
      settled_at: settledAt,
    }).select().maybeSingle()

    // Link this claim back to the visit's medical_records row, if one was
    // passed - this is what lets a receipt later find the diagnosis and
    // prescriptions that go with this specific claim, rather than the
    // claim and the clinical record being two disconnected things.
    if (!claimInsertErr && insertedClaim && req.medicalRecordId) {
      await supabase.from('medical_records').update({ insurance_claim_id: insertedClaim.id })
        .eq('id', req.medicalRecordId)
    }

    return { claimId, status: settlesImmediately ? 'SETTLED' : status, fees, deductibleApplied, authorizationCode, adjudicatedAt }
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
