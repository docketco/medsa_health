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
  async adjudicateClaim(req) { throw new Error('Not implemented') }
  /** @param {string} claimId @returns {Promise<{success: boolean, settledAt: string}>} */
  async settleClaim(claimId) { throw new Error('Not implemented') }
}

// ── MOCK IMPLEMENTATION ──────────────────────────────────────────────────────
// Built against real patient/plan data already in Supabase - eligibility and
// coverage rates reflect the patient's actual linked insurance_plans row, not
// random numbers. What's mocked is specifically the parts that genuinely
// require a real insurer's own system: instant, automatic, cross-institution
// adjudication. Everything else here is real logic on real data.
export class MockInsuranceAdapter extends InsuranceAdapter {
  async checkEligibility(req) {
    const { data: plan } = await supabase.from('insurance_plans').select('*')
      .eq('id', req.policyNumber).maybeSingle()

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
    // here defaults to 0 (cash-equivalent) until PaymentScreen's own charge
    // recalculates it against the real method chosen.
    const fees = buildFeeBreakdown(req.totalGrossAmount, insurerCoveredAmount, patientPayableTotal)
    const authorizationCode = `AUTH-${claimId}`

    await supabase.from('insurance_claims').insert({
      claim_ref: claimId, patient_id: req.patientId, plan_id: req.policyNumber,
      amount: req.totalGrossAmount, status: status.toLowerCase(),
      validated: true, submitted_at: adjudicatedAt,
      insurer_covered_amount: insurerCoveredAmount, patient_copay_amount: patientCopayAmount,
      deductible_applied: deductibleApplied, authorization_code: authorizationCode,
      adjudicated_at: adjudicatedAt, platform_claim_fee: fees.platformClaimFee,
    })

    return { claimId, status, fees, deductibleApplied, authorizationCode, adjudicatedAt }
  }

  async settleClaim(claimId) {
    const settledAt = new Date().toISOString()
    await supabase.from('insurance_claims').update({ status: 'settled', settled_at: settledAt })
      .eq('claim_ref', claimId)
    return { success: true, settledAt }
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
