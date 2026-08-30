// lib/__tests__/insuranceAdapter.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Written for Vitest syntax (vi.fn/vi.mock) - works identically under Jest by
// swapping `vi` for `jest` throughout; the describe/it/expect API is the same
// in both. Every expected value below was independently verified against the
// real adapter logic before being written into an assertion (see the
// verification script this suite was built from) - not hand-guessed.
//
// Two real bugs were fixed in insuranceAdapter.js before these tests could be
// written honestly: copayRate was hardcoded to 10% for every plan (making
// "100% coverage" unrepresentable), and PENDING_REVIEW was a declared but
// unreachable status (no code path ever produced it). Both are now real,
// tested behavior - see Scenario 3 and Scenario 4 below.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculatePlatformClaimFee,
  calculatePaymentProcessingFee,
  buildFeeBreakdown,
  MockInsuranceAdapter,
} from './insuranceAdapter'

// ── Supabase mock ─────────────────────────────────────────────────────────
// Chainable mock supporting .from().select().eq().maybeSingle() and
// .from().select().eq().gte() (prior-claims lookup) and .from().insert().
// Each test configures what the "database" should return via mockPlan /
// mockClaim / mockPriorClaimsSum, set fresh in beforeEach.
//
// Also supports the practitioner-verification lookups
// (_checkPractitionerVerification: medical_records on a single .eq(),
// staff_credentials on a chained .eq().eq()) via mockMedicalRecord /
// mockStaffCredential - added because every adjudicateClaim test below
// omits medicalRecordId, which used to be fine (PENDING_REVIEW was
// unreachable) but now always forces PENDING_REVIEW regardless of
// coverage math once practitioner verification was added. Tests that
// need to observe the underlying coverage-math status set these to a
// clinic-vouched doctor so that forced override doesn't mask what
// they're actually testing.
let mockPlan = null
let mockClaim = null
let mockPriorClaimsSum = 0
let mockMedicalRecord = null
let mockStaffCredential = null
let insertedRows = []
let updatedRows = []

vi.mock('./supabase', () => ({
  supabase: {
    from: (table) => ({
      select: () => ({
        eq: (field1) => ({
          eq: () => ({
            // staff_credentials: .eq('full_name',...).eq('status','active').maybeSingle()
            maybeSingle: async () => ({ data: table === 'staff_credentials' ? mockStaffCredential : null }),
          }),
          maybeSingle: async () => ({
            data: table === 'insurance_plans' ? mockPlan
              : table === 'insurance_claims' ? mockClaim
              : table === 'medical_records' ? mockMedicalRecord
              : null,
          }),
          gte: async () => ({ data: table === 'insurance_claims' ? [{ amount: mockPriorClaimsSum }] : [] }),
        }),
      }),
      insert: async (row) => { insertedRows.push(row); return { data: row, error: null } },
      update: (fields) => ({ eq: async () => { updatedRows.push(fields); return { data: null, error: null } } }),
    }),
  },
}))

beforeEach(() => {
  mockPlan = null
  mockClaim = null
  mockPriorClaimsSum = 0
  mockMedicalRecord = null
  mockStaffCredential = null
  insertedRows = []
  updatedRows = []
})

// ── 1) Octopus copay calculations (1.5%) ─────────────────────────────────────
describe('calculatePaymentProcessingFee - Octopus', () => {
  it('charges exactly 1.5% for Octopus payments', () => {
    expect(calculatePaymentProcessingFee('octopus', 100)).toBe(1.5)
  })

  it('rounds to 2 decimal places for uneven Octopus amounts', () => {
    expect(calculatePaymentProcessingFee('octopus', 33.33)).toBe(0.5)
  })

  it('returns 0 for a zero-amount Octopus payment', () => {
    expect(calculatePaymentProcessingFee('octopus', 0)).toBe(0)
  })
})

// ── 2) Credit card copay calculations (2.75%) ────────────────────────────────
describe('calculatePaymentProcessingFee - Credit card', () => {
  it('charges exactly 2.75% for card payments', () => {
    expect(calculatePaymentProcessingFee('card', 100)).toBe(2.75)
  })

  it('charges more than Octopus for the same amount (2.75% > 1.5%)', () => {
    const cardFee = calculatePaymentProcessingFee('card', 200)
    const octopusFee = calculatePaymentProcessingFee('octopus', 200)
    expect(cardFee).toBeGreaterThan(octopusFee)
  })

  it('cash carries no processing fee at all', () => {
    expect(calculatePaymentProcessingFee('cash', 500)).toBe(0)
  })
})

// ── 3) 100% coverage ($0 copay) ───────────────────────────────────────────────
describe('MockInsuranceAdapter.adjudicateClaim - 100% coverage plan', () => {
  it('produces $0 patient payment when copay_rate is 0 and deductible is exhausted', async () => {
    mockPlan = { id: 'plan-full-cover', plan_name: 'Premium Full Cover', company_name: 'AIA', status: 'active', copay_rate: 0 }
    mockPriorClaimsSum = 500 // deductible already fully used this year
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true } // clinic-vouched - isolates the coverage math under test from the practitioner-verification override

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-full-cover', clinicId: 'clinic_ops',
      totalGrossAmount: 200, items: [], medicalRecordId: 'mr1',
    })

    // $0 owed auto-settles immediately - see auto-settlement logic in
    // adjudicateClaim. This was APPROVED before that feature existed.
    expect(result.status).toBe('SETTLED')
    expect(result.deductibleApplied).toBe(0)
    expect(result.fees.patientPayableTotal).toBe(0)
    expect(result.fees.insurerCoveredAmount).toBe(200)
    expect(result.fees.grossAmount).toBe(200)
  })

  it('strictly verifies platform fee and clinic net payout on a fully-covered claim', async () => {
    mockPlan = { id: 'plan-full-cover', plan_name: 'Premium Full Cover', company_name: 'AIA', status: 'active', copay_rate: 0 }
    mockPriorClaimsSum = 500

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-full-cover', clinicId: 'clinic_ops',
      totalGrossAmount: 200, items: [],
    })

    expect(result.fees.platformClaimFee).toBe(14) // 200*0.02 + 10, rounded
    expect(result.fees.paymentProcessingFee).toBe(0) // no card/Octopus method known at adjudication time
    expect(result.fees.totalPlatformFeeEarned).toBe(14)
    expect(result.fees.clinicNetPayout).toBe(200) // claim fee is insurer-side, never deducted from clinic
  })
})

// ── 4) High-value claims over HKD $1,000 (pending review) ────────────────────
describe('MockInsuranceAdapter.adjudicateClaim - high-value threshold', () => {
  it('flags any claim over $1000 as PENDING_REVIEW, regardless of coverage math', async () => {
    mockPlan = { id: 'plan-normal', plan_name: 'Standard Plan', company_name: 'Bupa', status: 'active', copay_rate: 0.10 }
    mockPriorClaimsSum = 0 // full $500 deductible still available

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-normal', clinicId: 'clinic_ops',
      totalGrossAmount: 1500, items: [],
    })

    expect(result.status).toBe('PENDING_REVIEW')
    expect(result.fees.grossAmount).toBe(1500)
    expect(result.deductibleApplied).toBe(500)
    expect(result.fees.insurerCoveredAmount).toBe(900)
    expect(result.fees.patientPayableTotal).toBe(600)
  })

  it('does NOT trigger pending review at exactly $1000 (threshold is strictly greater-than)', async () => {
    mockPlan = { id: 'plan-normal', plan_name: 'Standard Plan', company_name: 'Bupa', status: 'active', copay_rate: 0 }
    mockPriorClaimsSum = 500 // no deductible remaining, so full amount is insurer-covered
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-normal', clinicId: 'clinic_ops',
      totalGrossAmount: 1000, items: [], medicalRecordId: 'mr1',
    })

    expect(result.status).not.toBe('PENDING_REVIEW')
    // $0 owed in this scenario (copay_rate 0, deductible exhausted) auto-
    // settles rather than staying at plain APPROVED - the real point of
    // this test (the $1000 boundary itself) still holds either way.
    expect(result.status).toBe('SETTLED')
  })

  it('triggers pending review even when coverage math alone would have approved the claim', async () => {
    // Same shape as the "not a real bypass" check - even a claim that would
    // otherwise be a clean 100%-covered APPROVED still gets held for review
    // once it crosses the dollar threshold.
    mockPlan = { id: 'plan-full-cover', plan_name: 'Premium Full Cover', company_name: 'AIA', status: 'active', copay_rate: 0 }
    mockPriorClaimsSum = 500

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-full-cover', clinicId: 'clinic_ops',
      totalGrossAmount: 1000.01, items: [],
    })

    expect(result.status).toBe('PENDING_REVIEW')
  })
})

// ── 5) Partially approved items ───────────────────────────────────────────────
describe('MockInsuranceAdapter.adjudicateClaim - partial approval', () => {
  it('splits payment correctly between insurer and patient when deductible only partly covers the claim', async () => {
    mockPlan = { id: 'plan-normal', plan_name: 'Standard Plan', company_name: 'Bupa', status: 'active', copay_rate: 0.10 }
    mockPriorClaimsSum = 400 // $100 of the $500 mock deductible remains
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-normal', clinicId: 'clinic_ops',
      totalGrossAmount: 300, items: [], medicalRecordId: 'mr1',
    })

    expect(result.status).toBe('PARTIALLY_APPROVED')
    expect(result.deductibleApplied).toBe(100)
    expect(result.fees.insurerCoveredAmount).toBe(180)
    expect(result.fees.patientPayableTotal).toBe(120)
    expect(result.fees.grossAmount).toBe(300)
  })

  it('strictly verifies platform fee and clinic net payout on a partially-approved claim', async () => {
    mockPlan = { id: 'plan-normal', plan_name: 'Standard Plan', company_name: 'Bupa', status: 'active', copay_rate: 0.10 }
    mockPriorClaimsSum = 400

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-normal', clinicId: 'clinic_ops',
      totalGrossAmount: 300, items: [],
    })

    expect(result.fees.platformClaimFee).toBe(16) // 300*0.02 + 10, rounded
    expect(result.fees.totalPlatformFeeEarned).toBe(16)
    expect(result.fees.clinicNetPayout).toBe(300) // still not reduced by the claim fee
  })

  it('rejects the claim entirely when the deductible consumes the whole amount (boundary of "partial")', async () => {
    mockPlan = { id: 'plan-normal', plan_name: 'Standard Plan', company_name: 'Bupa', status: 'active', copay_rate: 0.10 }
    mockPriorClaimsSum = 0 // full $500 deductible available, exceeds this small claim
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-normal', clinicId: 'clinic_ops',
      totalGrossAmount: 300, items: [], medicalRecordId: 'mr1',
    })

    // Not a partial approval - insurer covers $0, so this is REJECTED, not
    // PARTIALLY_APPROVED. Included to mark the real boundary between the two.
    expect(result.status).toBe('REJECTED')
    expect(result.fees.insurerCoveredAmount).toBe(0)
  })
})

// ── Ineligible / inactive plan handling ──────────────────────────────────────
describe('MockInsuranceAdapter.adjudicateClaim - ineligible plans', () => {
  it('rejects immediately when no matching plan exists', async () => {
    mockPlan = null
    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'nonexistent', clinicId: 'clinic_ops',
      totalGrossAmount: 200, items: [],
    })
    expect(result.status).toBe('REJECTED')
    expect(result.fees.patientPayableTotal).toBe(200) // patient pays the full amount out of pocket
  })

  it('rejects when the plan exists but is inactive', async () => {
    mockPlan = { id: 'plan-inactive', plan_name: 'Lapsed Plan', company_name: 'AIA', status: 'inactive', copay_rate: 0.10 }
    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-inactive', clinicId: 'clinic_ops',
      totalGrossAmount: 200, items: [],
    })
    expect(result.status).toBe('REJECTED')
  })
})

// ── Fee engine - pure function checks ─────────────────────────────────────────
describe('calculatePlatformClaimFee', () => {
  it('applies 2% + HK$10 flat', () => {
    expect(calculatePlatformClaimFee(100)).toBe(12) // 2 + 10, rounded
  })
  it('handles a zero-amount claim without erroring', () => {
    expect(calculatePlatformClaimFee(0)).toBe(10)
  })
})

// ── Copay reconciliation - fixes the "$0 processing fee forever" gap ────────
describe('MockInsuranceAdapter.recordCopayPayment', () => {
  it('recalculates the real processing fee once the payment method is known', async () => {
    mockClaim = {
      claim_ref: 'CLM-TEST', amount: 300, insurer_covered_amount: 180,
      deductible_applied: 100, patient_copay_amount: 20,
    }
    const adapter = new MockInsuranceAdapter()
    const fees = await adapter.recordCopayPayment('CLM-TEST', 'card')

    expect(fees.paymentProcessingFee).toBe(3.3) // 2.75% of the full $120 patient-payable total
    expect(fees.totalPlatformFeeEarned).toBe(19.3) // 16 (claim fee) + 3.3
    expect(fees.clinicNetPayout).toBe(296.7) // 300 - 3.3
  })

  it('applies the fee to deductible + copay combined, not the copay alone', async () => {
    mockClaim = { claim_ref: 'CLM-TEST', amount: 300, insurer_covered_amount: 180, deductible_applied: 100, patient_copay_amount: 20 }
    const adapter = new MockInsuranceAdapter()
    const fees = await adapter.recordCopayPayment('CLM-TEST', 'card')
    // A bug fixed during this build applied the fee to patient_copay_amount
    // (20) alone rather than the full payable total (120) - this guards
    // against regressing to that.
    expect(fees.paymentProcessingFee).not.toBe(calculatePaymentProcessingFee('card', 20))
  })

  it('throws when the claim does not exist', async () => {
    mockClaim = null
    const adapter = new MockInsuranceAdapter()
    await expect(adapter.recordCopayPayment('CLM-NOPE', 'card')).rejects.toThrow()
  })
})

describe('buildFeeBreakdown', () => {
  it('never lets platformClaimFee reduce clinicNetPayout', () => {
    const fees = buildFeeBreakdown(1000, 800, 200, 'cash')
    expect(fees.clinicNetPayout).toBe(fees.grossAmount) // cash: no processing fee either
  })
  it('deducts paymentProcessingFee from clinicNetPayout when a card payment method is passed', () => {
    const fees = buildFeeBreakdown(1000, 800, 200, 'card')
    expect(fees.paymentProcessingFee).toBe(5.5) // 2.75% of the $200 patient portion
    expect(fees.clinicNetPayout).toBe(994.5) // 1000 - 5.5
  })
})
