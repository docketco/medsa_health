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
// Generic chainable query builder - supports any number of .eq() calls
// followed by .order()/.limit() (no-ops here) and a terminal .maybeSingle()
// or .gte(). Each test configures what the "database" should return via
// mockPlan / mockClaim / mockPriorClaimsSum / etc., set fresh in beforeEach.
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
//
// mockAgentPolicyRow / mockInsuranceCompany / mockRosterRow back the real
// agent_policies (waiting period + real policy number), insurance_companies
// (verification_mode) and insurer_policy_roster lookups added for policy
// verification - all default null, meaning "not configured", so every
// existing test above is unaffected unless it opts in.
let mockPlan = null
let mockClaim = null
let mockPriorClaimsSum = 0
let mockPriorClaimsCategoryBreakdown = null // fed back as insurance_claims.category_breakdown on the one synthetic "prior claim" row the mock's .gte() returns
let mockMedicalRecord = null
let mockStaffCredential = null
let mockAgentPolicyRow = null
let mockInsuranceCompany = null
let mockRosterRow = null
let mockPreauthRequest = null // backs preauth_requests' gop_code lookup (see the pre-authorization/GOP tests)
let mockCreatedPlanId = 'mock-created-plan-id'
let insertedRows = []
let updatedRows = []
let claimsQuerySecondEqFields = [] // records which field the deductible query's second .eq() (if any) was called with
let rosterPolicyNumbersQueried = [] // records every value insurer_policy_roster's policy_number .eq() was called with
let claimsQueryPolicyNumbersQueried = [] // records every value insurance_claims' own policy_number .eq() was called with (the deductible/limit usage query)

function resolveMockRow(table) {
  if (table === 'insurance_plans') return mockPlan
  if (table === 'insurance_claims') return mockClaim
  if (table === 'medical_records') return mockMedicalRecord
  if (table === 'staff_credentials') return mockStaffCredential
  if (table === 'agent_policies') return mockAgentPolicyRow
  if (table === 'insurance_companies') return mockInsuranceCompany
  if (table === 'insurer_policy_roster') return mockRosterRow
  if (table === 'preauth_requests') return mockPreauthRequest
  return null
}

function makeQueryBuilder(table) {
  let eqCount = 0
  const builder = {
    eq(field, value) {
      eqCount++
      if (table === 'insurance_claims' && eqCount === 2) claimsQuerySecondEqFields.push(field)
      if (table === 'insurance_claims' && field === 'policy_number') claimsQueryPolicyNumbersQueried.push(value)
      if (table === 'insurer_policy_roster' && field === 'policy_number') rosterPolicyNumbersQueried.push(value)
      return builder
    },
    // Case-insensitive company-name lookups (insurance_companies) use
    // ilike instead of eq in the real code - same no-op passthrough here,
    // since resolveMockRow answers by table regardless of filter value.
    ilike: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: resolveMockRow(table) }),
    gte: async () => ({ data: table === 'insurance_claims' ? [{ amount: mockPriorClaimsSum, category_breakdown: mockPriorClaimsCategoryBreakdown }] : [] }),
  }
  return builder
}

vi.mock('./supabase', () => ({
  supabase: {
    from: (table) => ({
      select: () => makeQueryBuilder(table),
      // Insert result is a plain (non-Promise) object with .error/.data
      // directly on it - awaiting a plain object just resolves to itself,
      // so `await supabase.from(t).insert(row)` still destructures
      // {data,error} exactly as before, while `.select().maybeSingle()`/
      // .single() also chains off it for callers that need the row back
      // with its generated id (e.g. _findOrCreateRosterFallbackPlan).
      insert: (row) => {
        insertedRows.push(row)
        const createdRow = { ...row, id: mockCreatedPlanId }
        return {
          data: row, error: null,
          select: () => ({
            maybeSingle: async () => ({ data: createdRow, error: null }),
            single: async () => ({ data: createdRow, error: null }),
          }),
        }
      },
      update: (fields) => ({ eq: async () => { updatedRows.push(fields); return { data: null, error: null } } }),
    }),
  },
}))

beforeEach(() => {
  mockPlan = null
  mockClaim = null
  mockPriorClaimsSum = 0
  mockPriorClaimsCategoryBreakdown = null
  mockMedicalRecord = null
  mockStaffCredential = null
  mockAgentPolicyRow = null
  mockInsuranceCompany = null
  mockRosterRow = null
  mockPreauthRequest = null
  claimsQuerySecondEqFields = []
  rosterPolicyNumbersQueried = []
  claimsQueryPolicyNumbersQueried = []
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

// ── Deductible tracking is per-policyholder, not per-plan-product ───────────
// insurance_plans rows are a shared catalog - multiple different patients
// can each hold their own policy against the same plan_id (e.g. two
// different people both holding "AIA Critical Rider"). Before this fix,
// the deductible-remaining query only filtered by plan_id, so two such
// patients' claims got pooled into one shared deductible bucket instead of
// each policyholder's own consumption being tracked separately.
describe('MockInsuranceAdapter - deductible tracking is scoped per patient', () => {
  it('scopes the prior-claims query by patient_id when a patientId is known', async () => {
    mockPlan = { id: 'shared-plan', plan_name: 'MedSecure Standard', company_name: 'Test Insurer Co', status: 'active', copay_rate: 0.1 }
    mockPriorClaimsSum = 0

    const adapter = new MockInsuranceAdapter()
    await adapter.checkEligibility({ patientId: 'patient-a', policyNumber: 'shared-plan', clinicId: 'clinic_ops' })

    expect(claimsQuerySecondEqFields).toContain('patient_id')
  })

  it('falls back to a plan-wide query (old behavior) only when no patientId can be resolved at all', async () => {
    mockPlan = { id: 'shared-plan', plan_name: 'MedSecure Standard', company_name: 'Test Insurer Co', status: 'active', copay_rate: 0.1 }
    mockPriorClaimsSum = 0

    const adapter = new MockInsuranceAdapter()
    await adapter.checkEligibility({ policyNumber: 'shared-plan', clinicId: 'clinic_ops' })

    expect(claimsQuerySecondEqFields).not.toContain('patient_id')
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

// ── Category vocabulary bridge (per-visit category cap) ──────────────────────
// Real bug this fixes: category_limits is keyed by the insurance benefit
// vocabulary (Outpatient, Specialist, ...) that PLAN_MANAGER_CATEGORIES
// uses, but a real line item's own category comes from a completely
// different, clinic-internal vocabulary (Consultation, procedure,
// prescription, ...). Comparing them as raw strings meant a per-visit cap
// could never actually apply to any real item - "procedure" never equals
// "Outpatient" - so the excess silently ran through deductible/coinsurance
// like a normal covered charge instead of falling entirely to the patient.
describe('MockInsuranceAdapter.adjudicateClaim - category vocabulary bridge', () => {
  it('applies a per-visit category cap to a real line item via its mapped insurance category', async () => {
    mockPlan = {
      id: 'plan-cat', plan_name: 'Test Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0,
      category_limits: { Outpatient: { per_visit_limit_hkd: 100 } },
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true } // isolates the cap math from the practitioner-verification override

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-cat', clinicId: 'clinic_ops',
      totalGrossAmount: 350, items: [{ code: 'procedure', description: 'Basic Blood Test', amount: 350 }],
      medicalRecordId: 'mr1',
    })

    // Only the first $100 (the cap) is insurable; the $250 excess falls
    // entirely to the patient, never touching deductible/coinsurance.
    expect(result.fees.insurerCoveredAmount).toBe(100)
    expect(result.fees.patientPayableTotal).toBe(250)
  })

  // Real bug this test would have caught: a HK$479 "per-visit" cap
  // applied to each line item separately let a Consultation $350 +
  // procedure $350 (both resolving to Outpatient) sail through totally
  // uncapped, since neither $350 item crossed 479 on its own - even
  // though the visit's real Outpatient total, $700, clearly should have.
  it('applies a per-visit category cap to the VISIT TOTAL across multiple items in the same category, not each item alone', async () => {
    mockPlan = {
      id: 'plan-cat', plan_name: 'Test Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0,
      category_limits: { Outpatient: { per_visit_limit_hkd: 479 } },
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-cat', clinicId: 'clinic_ops',
      totalGrossAmount: 700,
      items: [
        { code: 'Consultation', description: 'General Consultation', amount: 350 },
        { code: 'procedure', description: 'Basic Blood Test', amount: 350 },
      ],
      medicalRecordId: 'mr1',
    })

    // Only the first HK$479 of the combined $700 Outpatient total is
    // insurable - the $221 excess falls entirely to the patient.
    expect(result.fees.insurerCoveredAmount).toBe(479)
    expect(result.fees.patientPayableTotal).toBe(221)
  })

  // Real bug this test would have caught, reported as "I set a plan to
  // only cover Dental and billed a normal consultation - it still went
  // through completely": covered_categories (the plan's own "what does
  // this plan actually cover" list, configured on Create Plan) was
  // fetched but never consulted anywhere in adjudicateClaim - only
  // category_limits (caps) was. A plan configured to cover ONLY Dental
  // still fully insured a Consultation item (which resolves to
  // Outpatient/Specialist, nothing to do with Dental), because nothing
  // ever excluded it from the insurable pool in the first place - the
  // "None of this visit's items matched this plan's registered
  // categories" note on the billing screen was purely informational,
  // never an actual gate on the money.
  it('never insures a line item whose category is not in the plan\'s covered_categories', async () => {
    mockPlan = {
      id: 'plan-cov', plan_name: 'Dental Only', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0,
      covered_categories: ['Dental'],
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-cov', clinicId: 'clinic_ops',
      totalGrossAmount: 350,
      items: [{ code: 'Consultation', description: 'General Consultation', amount: 350 }],
      medicalRecordId: 'mr1',
    })

    // A Consultation item resolves to Outpatient/Specialist, neither of
    // which is Dental - nothing about this visit is insurable, and the
    // full amount falls to the patient.
    expect(result.notCoveredOverage).toBe(350)
    expect(result.fees.insurerCoveredAmount).toBe(0)
    expect(result.fees.patientPayableTotal).toBe(350)
  })

  // Real bug this test would have caught: adjudicateClaim returns
  // icd10Codes (deduped from every item's own icd10Codes array) and
  // writes it to insurance_claims - but the ClinicOps billing screen
  // never attached any codes to the items it built, so every real
  // claim saved icd10_codes as null regardless of what the doctor
  // actually coded the visit as, both in dryRun preview and on real
  // submission.
  it('carries real ICD-10 codes onto both the dryRun preview and the real submitted claim', async () => {
    mockPlan = {
      id: 'plan-icd', plan_name: 'Test Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0,
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const req = {
      patientId: 'p1', policyNumber: 'plan-icd', clinicId: 'clinic_ops',
      totalGrossAmount: 350,
      items: [{ code: 'Consultation', description: 'General Consultation', amount: 350, icd10Codes: ['J11.1'] }],
      medicalRecordId: 'mr1',
    }
    const preview = await adapter.adjudicateClaim({ ...req, dryRun: true })
    expect(preview.icd10Codes).toEqual(['J11.1'])

    const real = await adapter.adjudicateClaim(req)
    expect(real.icd10Codes).toEqual(['J11.1'])
    const claimRow = insertedRows.find(r => 'claim_ref' in r)
    expect(claimRow.icd10_codes).toBe('J11.1')
  })

  // Real bug this test would have caught: a real claim still came back
  // with icd10_codes: null even after the fix above, confirmed directly
  // against the database - the older Claims screen (a second, separate
  // call site) builds its own items array and can end up not carrying
  // codes the way the newer billing screen does. Fetching the linked
  // medical record's own icd10_code directly by medicalRecordId - the
  // same id every caller already sends to link the claim to its visit -
  // makes this correct regardless of what any individual caller's items
  // happen to carry.
  it('falls back to the linked medical record\'s own ICD-10 code when the caller\'s items carry none', async () => {
    mockPlan = {
      id: 'plan-icd2', plan_name: 'Test Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0,
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1', icd10_code: 'B34.9, U07.1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-icd2', clinicId: 'clinic_ops',
      totalGrossAmount: 350,
      items: [{ code: 'Consultation', description: 'General Consultation', amount: 350 }],
      medicalRecordId: 'mr1',
    })

    expect(result.icd10Codes).toEqual(['B34.9', 'U07.1'])
  })

  // Real gap this closes: a practice manager pointed out that
  // pre-authorization (a GOP obtained BEFORE treatment) only makes sense
  // for a direct-billing plan - a reimbursement-only plan is submitted
  // AFTER the patient already paid in full, so there's nothing to
  // pre-authorize. A plan flagged billing_model:'reimbursement' must
  // always land on PENDING_REVIEW for its own reason, never because it
  // crossed a preauth threshold or the plan's category preauth checkbox.
  it('sends a reimbursement-only plan to PENDING_REVIEW without ever flagging preauthRequired', async () => {
    mockPlan = {
      id: 'plan-reimb', plan_name: 'Reimbursement Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0, billing_model: 'reimbursement',
      preauth_threshold_hkd: 100000, category_limits: { Outpatient: { requires_preauth: true } },
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-reimb', clinicId: 'clinic_ops',
      totalGrossAmount: 350,
      items: [{ code: 'Consultation', description: 'General Consultation', amount: 350 }],
      medicalRecordId: 'mr1',
    })

    expect(result.isReimbursementOnly).toBe(true)
    expect(result.status).toBe('PENDING_REVIEW')
    expect(result.preauthRequired).toBe(false)
    expect(result.categoryPreauthRequired).toBe(false)
  })

  // Real correction: a reimbursement-only plan used to auto-REJECT here
  // whenever its own coverage math worked out to $0 insurer exposure
  // (e.g. a deductible eating the whole insurable amount) - no reviewer
  // ever saw it, the claim just silently died with "nothing is
  // insurable, patient pays in full." That math is only an estimate from
  // the plan's configured rules; a reimbursement claim's whole point is
  // that a person makes the real payout call after seeing the full
  // consultation record. Always PENDING_REVIEW now, regardless of the
  // computed insurer exposure - REJECTED only ever happens as a genuine
  // reviewer decision from here on.
  it('sends a reimbursement-only plan to PENDING_REVIEW even when its own coverage math computes to $0', async () => {
    mockPlan = {
      id: 'plan-reimb2', plan_name: 'Reimbursement Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 100000, billing_model: 'reimbursement',
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-reimb2', clinicId: 'clinic_ops',
      totalGrossAmount: 350,
      items: [{ code: 'Consultation', description: 'General Consultation', amount: 350 }],
      medicalRecordId: 'mr1',
    })

    expect(result.fees.insurerCoveredAmount).toBe(0)
    expect(result.status).toBe('PENDING_REVIEW')
  })

  // A direct-billing plan (the default) must be unaffected by the new
  // isReimbursementOnly field - it should come back false and not change
  // any existing preauth/status behavior.
  it('leaves a normal direct-billing plan unaffected by isReimbursementOnly', async () => {
    mockPlan = {
      id: 'plan-direct', plan_name: 'Direct Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0,
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-direct', clinicId: 'clinic_ops',
      totalGrossAmount: 350,
      items: [{ code: 'Consultation', description: 'General Consultation', amount: 350 }],
      medicalRecordId: 'mr1',
    })

    expect(result.isReimbursementOnly).toBe(false)
    expect(result.status).toBe('SETTLED')
  })

  // Real gap this closes: "pre-authorization" was only ever an after-
  // the-fact Approve/Reject on the same claim that supposedly needed
  // authorizing before the visit even happened - not a real GOP obtained
  // beforehand. Without a matching gopCode, a claim over the plan's
  // preauth threshold must still land on PENDING_REVIEW exactly as
  // before - this is the baseline the GOP-clearing test below is
  // contrasted against.
  it('still requires review for a claim over the preauth threshold when no gopCode is supplied', async () => {
    mockPlan = {
      id: 'plan-preauth', plan_name: 'Preauth Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0, preauth_threshold_hkd: 300,
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-preauth', clinicId: 'clinic_ops',
      totalGrossAmount: 500,
      items: [{ code: 'Consultation', description: 'General Consultation', amount: 500 }],
      medicalRecordId: 'mr1',
    })

    expect(result.preauthRequired).toBe(true)
    expect(result.status).toBe('PENDING_REVIEW')
    expect(result.preauthCleared).toBe(false)
  })

  // The actual fix: a gopCode that matches a preauth_requests row this
  // patient+plan already got APPROVED for ahead of time clears the
  // preauth gate entirely - the visit settles the same way it would if
  // it had never crossed the threshold, and the GOP gets marked spent
  // (used_at/used_claim_id) so it can't be reused on a second claim.
  it('clears the preauth gate and settles normally when a matching approved GOP is supplied', async () => {
    mockPlan = {
      id: 'plan-preauth2', plan_name: 'Preauth Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0, preauth_threshold_hkd: 300,
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }
    mockPreauthRequest = { id: 'preauth-1', gop_code: 'GOP-ABC123', status: 'approved', used_at: null, expires_at: null }
    mockClaim = { id: 'inserted-claim-id' } // backs the post-insert insertedClaim lookup used to mark the GOP spent

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-preauth2', clinicId: 'clinic_ops',
      totalGrossAmount: 500,
      items: [{ code: 'Consultation', description: 'General Consultation', amount: 500 }],
      medicalRecordId: 'mr1', gopCode: 'GOP-ABC123',
    })

    expect(result.preauthRequired).toBe(false)
    expect(result.preauthCleared).toBe(true)
    expect(result.status).toBe('SETTLED')
    const claimRow = insertedRows.find(r => 'claim_ref' in r)
    expect(claimRow.preauth_gop_code).toBe('GOP-ABC123')
    expect(updatedRows.some(u => u.used_claim_id)).toBe(true)
  })

  // An expired GOP is the same as none at all - it must not silently
  // clear a preauth gate past its own validity window.
  it('does not clear the preauth gate with an expired GOP', async () => {
    mockPlan = {
      id: 'plan-preauth3', plan_name: 'Preauth Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0, preauth_threshold_hkd: 300,
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }
    mockPreauthRequest = { id: 'preauth-2', gop_code: 'GOP-OLD', status: 'approved', used_at: null, expires_at: '2020-01-01T00:00:00Z' }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-preauth3', clinicId: 'clinic_ops',
      totalGrossAmount: 500,
      items: [{ code: 'Consultation', description: 'General Consultation', amount: 500 }],
      medicalRecordId: 'mr1', gopCode: 'GOP-OLD',
    })

    expect(result.preauthRequired).toBe(true)
    expect(result.preauthCleared).toBe(false)
    expect(result.status).toBe('PENDING_REVIEW')
  })

  // Real bug this test would have caught: the "needs human review above
  // HK$1,000" check used to compare the visit's GROSS total against the
  // threshold, not what the insurer would actually pay. A big-ticket
  // visit that's mostly excluded by covered_categories (or a cap) could
  // have a large gross total while the insurer's real exposure was $0 -
  // and still landed on PENDING_REVIEW for no real reason, since a
  // category exclusion is a fixed, deterministic outcome with nothing
  // left for a human to judge.
  it('does not require review for a high-gross-total visit whose insurer exposure is actually $0', async () => {
    mockPlan = {
      id: 'plan-cov2', plan_name: 'Dental Only', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0,
      covered_categories: ['Dental'],
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-cov2', clinicId: 'clinic_ops',
      totalGrossAmount: 1200,
      items: [{ code: 'Consultation', description: 'General Consultation', amount: 1200 }],
      medicalRecordId: 'mr1',
    })

    expect(result.fees.insurerCoveredAmount).toBe(0)
    expect(result.status).toBe('REJECTED')
  })

  // Real gap this closes: "Submit claim" always immediately created a
  // real claim (and marked the visit billed) with no way to see the
  // computed amount first - front desk needs to check a number before
  // committing to it. dryRun runs the exact same calculation but must
  // never write anything.
  it('dryRun computes the same numbers as a real submission but writes nothing', async () => {
    mockPlan = {
      id: 'plan-cat', plan_name: 'Test Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0.1, annual_deductible_hkd: 0,
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const preview = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-cat', clinicId: 'clinic_ops',
      totalGrossAmount: 200, items: [], medicalRecordId: 'mr1', dryRun: true,
    })

    expect(preview.dryRun).toBe(true)
    expect(preview.claimId).toBeNull()
    expect(preview.fees.insurerCoveredAmount).toBe(180)
    expect(preview.fees.patientPayableTotal).toBe(20)
    // No insurance_claims row (or anything else) was actually written.
    expect(insertedRows.filter(r => 'claim_ref' in r)).toHaveLength(0)

    const real = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-cat', clinicId: 'clinic_ops',
      totalGrossAmount: 200, items: [], medicalRecordId: 'mr1',
    })
    expect(real.dryRun).toBe(false)
    expect(real.claimId).not.toBeNull()
    expect(real.fees.insurerCoveredAmount).toBe(180)
    expect(insertedRows.filter(r => 'claim_ref' in r)).toHaveLength(1)
  })

  // Real gap this closes: annual_limit_hkd on a category was a real,
  // saveable field on the Create Plan screen that never did anything -
  // only per_visit_limit_hkd (above) was ever enforced. Two items in the
  // SAME visit, same category, share one running annual bucket.
  it('applies a per-category ANNUAL limit across multiple items in one visit, not just a single item', async () => {
    mockPlan = {
      id: 'plan-cat', plan_name: 'Test Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0,
      category_limits: { Outpatient: { annual_limit_hkd: 100 } },
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-cat', clinicId: 'clinic_ops',
      totalGrossAmount: 120,
      items: [
        { code: 'Consultation', description: 'Visit A', amount: 60 },
        { code: 'Consultation', description: 'Visit B', amount: 60 },
      ],
      medicalRecordId: 'mr1',
    })

    // Both items resolve to Outpatient and share one HK$100 annual bucket -
    // only the first $100 of the combined $120 is insurable.
    expect(result.fees.insurerCoveredAmount).toBe(100)
    expect(result.fees.patientPayableTotal).toBe(20)
  })

  it("counts a category's annual usage from prior claims this year, not just this visit's own items", async () => {
    mockPlan = {
      id: 'plan-cat', plan_name: 'Test Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0,
      category_limits: { Outpatient: { annual_limit_hkd: 100 } },
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }
    mockPriorClaimsCategoryBreakdown = { Outpatient: 80 } // already used $80 of the $100 annual bucket this year

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-cat', clinicId: 'clinic_ops',
      totalGrossAmount: 50, items: [{ code: 'Consultation', description: 'Visit', amount: 50 }],
      medicalRecordId: 'mr1',
    })

    // Only $20 of annual room left ($100 - $80 already used) - the
    // remaining $30 of this $50 visit falls to the patient.
    expect(result.fees.insurerCoveredAmount).toBe(20)
    expect(result.fees.patientPayableTotal).toBe(30)
  })

  // Real gap this closes: "Needs pre-authorization" per category was
  // saved but never read anywhere - only the plan-wide dollar threshold
  // actually forced review, regardless of what a practice manager
  // checked on a specific category.
  it("forces PENDING_REVIEW when a billed item's category requires pre-authorization, regardless of amount", async () => {
    mockPlan = {
      id: 'plan-cat', plan_name: 'Test Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0,
      category_limits: { Outpatient: { requires_preauth: true } },
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-cat', clinicId: 'clinic_ops',
      totalGrossAmount: 50, items: [{ code: 'Consultation', description: 'Visit', amount: 50 }],
      medicalRecordId: 'mr1',
    })

    expect(result.status).toBe('PENDING_REVIEW')
    expect(result.categoryPreauthRequired).toBe(true)
  })

  it('does not force review from a category checkbox that this visit never actually billed against', async () => {
    mockPlan = {
      id: 'plan-cat', plan_name: 'Test Plan', company_name: 'Test Insurer Co', status: 'active',
      copay_rate: 0, annual_deductible_hkd: 0,
      category_limits: { Surgery: { requires_preauth: true } }, // this visit only bills Consultation (Outpatient/Specialist), never Surgery
    }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-cat', clinicId: 'clinic_ops',
      totalGrossAmount: 50, items: [{ code: 'Consultation', description: 'Visit', amount: 50 }],
      medicalRecordId: 'mr1',
    })

    expect(result.status).not.toBe('PENDING_REVIEW')
    expect(result.categoryPreauthRequired).toBe(false)
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

// ── Policy verification against the insurer's own records ───────────────────
// An insurer (partnered or not) can tell Medsa how to check a submitted
// policy number against their real records - see add_insurer_policy_
// verification migration. Roster mode is fully testable here (no live
// fetch); API mode is exercised at the route level, not here.
describe('MockInsuranceAdapter - policy verification against the insurer', () => {
  it('is unaffected when the insurer has not configured verification (mode absent)', async () => {
    mockPlan = { id: 'plan-normal', plan_name: 'Standard Plan', company_name: 'Bupa', status: 'active', copay_rate: 0.10 }
    mockInsuranceCompany = null // no insurance_companies row for "Bupa" at all
    mockAgentPolicyRow = { start_date: '2020-01-01', policy_number: 'BUPA-REAL-001' }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.checkEligibility({ patientId: 'p1', policyNumber: 'plan-normal', clinicId: 'clinic_ops' })

    expect(result.isEligible).toBe(true)
    expect(result.verificationError).toBeUndefined()
  })

  it('rejects with a clear error when roster mode is on and the real policy number is not on the roster', async () => {
    mockPlan = { id: 'plan-roster', plan_name: 'Coverage Rules Plan', company_name: 'EU Insurance', status: 'active', copay_rate: 0.10 }
    mockInsuranceCompany = { id: 'comp-eu', verification_mode: 'roster' }
    mockAgentPolicyRow = { start_date: '2020-01-01', policy_number: 'EU-999' }
    mockRosterRow = null // EU-999 was never uploaded to EU Insurance's roster

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.checkEligibility({ patientId: 'p1', policyNumber: 'plan-roster', clinicId: 'clinic_ops' })

    expect(result.isEligible).toBe(false)
    expect(result.verificationError).toContain('EU Insurance')
  })

  it('proceeds normally when roster mode is on and the real policy number matches an active roster row', async () => {
    mockPlan = { id: 'plan-roster', plan_name: 'Coverage Rules Plan', company_name: 'EU Insurance', status: 'active', copay_rate: 0.10 }
    mockInsuranceCompany = { id: 'comp-eu', verification_mode: 'roster' }
    mockAgentPolicyRow = { start_date: '2020-01-01', policy_number: 'EU-123' }
    mockRosterRow = { status: 'active' }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.checkEligibility({ patientId: 'p1', policyNumber: 'plan-roster', clinicId: 'clinic_ops' })

    expect(result.isEligible).toBe(true)
  })

  it('rejects when roster mode is on but there is no real policy number on file to check at all', async () => {
    mockPlan = { id: 'plan-roster', plan_name: 'Coverage Rules Plan', company_name: 'EU Insurance', status: 'active', copay_rate: 0.10 }
    mockInsuranceCompany = { id: 'comp-eu', verification_mode: 'roster' }
    mockAgentPolicyRow = { start_date: '2020-01-01', policy_number: null } // linked via ClinicOps "add plan not on file", no card number ever entered

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.checkEligibility({ patientId: 'p1', policyNumber: 'plan-roster', clinicId: 'clinic_ops' })

    expect(result.isEligible).toBe(false)
  })

  it("applies a roster row's own coverage terms over the shared plan's defaults (per-policy override)", async () => {
    mockPlan = { id: 'plan-roster', plan_name: 'Coverage Rules Plan', company_name: 'EU Insurance', status: 'active', copay_rate: 0.10, annual_deductible_hkd: 500 }
    mockInsuranceCompany = { id: 'comp-eu', verification_mode: 'roster' }
    mockAgentPolicyRow = { start_date: '2020-01-01', policy_number: 'EU-VIP-1' }
    // This specific policyholder negotiated 100% coverage with no
    // deductible - a real term their own policy carries, not something
    // every EU Insurance policyholder gets.
    mockRosterRow = { status: 'active', copay_rate: 0, annual_deductible_hkd: 0 }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.checkEligibility({ patientId: 'p1', policyNumber: 'plan-roster', clinicId: 'clinic_ops' })

    expect(result.isEligible).toBe(true)
    expect(result.copayRate).toBe(0)
    expect(result.deductibleRemaining).toBe(0)
  })

  it('resolves a claim from a company name + real policy number alone, with no shared plan pre-built (ROSTER_POLICY_NUMBER)', async () => {
    // verification_mode must actually be set here - resolution itself is
    // now mode-aware (see the bug this fixed: it used to hardcode a
    // roster-table lookup regardless of mode, so an API-mode insurer
    // could never resolve a real policy number at all).
    mockInsuranceCompany = { id: 'comp-eu', verification_mode: 'roster' }
    mockRosterRow = { status: 'active' }
    // Simulates the fallback plan _findOrCreateRosterFallbackPlan
    // resolves to (created lazily, reused after) - this is what the
    // adapter's own subsequent insurance_plans lookup finds.
    mockPlan = { id: 'fallback-plan-id', plan_name: 'Roster-based coverage', company_name: 'EU Insurance', status: 'active', copay_rate: 0.15 }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.checkEligibility({
      clinicId: 'clinic_ops',
      verificationMethod: 'ROSTER_POLICY_NUMBER',
      verificationPayload: { companyName: 'EU Insurance', policyNumber: 'EU-NEW-42' },
    })

    expect(result.isEligible).toBe(true)
    expect(result.planName).toContain('EU Insurance')
  })

  it('rejects ROSTER_POLICY_NUMBER when the policy number is not on that insurer\'s roster', async () => {
    mockInsuranceCompany = { id: 'comp-eu', verification_mode: 'roster' }
    mockRosterRow = null

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.checkEligibility({
      clinicId: 'clinic_ops',
      verificationMethod: 'ROSTER_POLICY_NUMBER',
      verificationPayload: { companyName: 'EU Insurance', policyNumber: 'DOES-NOT-EXIST' },
    })

    expect(result.isEligible).toBe(false)
    expect(result.verificationError).toContain('No active policy found')
  })

  // Real bug this test would have caught: the insurance_companies row
  // used here also carries verification_mode (unlike the two tests
  // above, where it's absent and the insurer-verification pass short-
  // circuits as "not configured" before ever touching a policy number) -
  // this is what a real insurer in roster mode actually looks like.
  // Before the fix, the SECOND verification pass re-derived its
  // policyNumber from a not-yet-existing agent_policies row (only ever
  // created *after* this exact call returns eligible - see
  // ClinicOpsApp.jsx's "check by their real policy number"), got null,
  // and rejected every real, roster-active policy number on its very
  // first-ever check.
  it('verifies a roster-active policy number on its first check, before any agent_policies row exists for it yet', async () => {
    mockInsuranceCompany = { id: 'comp-eu', verification_mode: 'roster' }
    mockRosterRow = { status: 'active', copay_rate: 0.2, annual_deductible_hkd: 2000 }
    mockPlan = { id: 'fallback-plan-id', plan_name: 'Roster-based coverage', company_name: 'EU Insurance', status: 'active' }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.checkEligibility({
      clinicId: 'clinic_ops',
      verificationMethod: 'ROSTER_POLICY_NUMBER',
      verificationPayload: { companyName: 'EU Insurance', policyNumber: 'EU-REAL-001' },
    })

    expect(result.isEligible).toBe(true)
    expect(result.verificationError).toBeFalsy()
  })

  // Real bug this test would have caught: once ANY policy number was
  // ever linked for a patient+insurer (they share one fallback plan row
  // per company), a later ROSTER_POLICY_NUMBER check for a *different*
  // real number silently re-verified the OLD stale one instead - e.g.
  // checking a brand-new "TIC-2026-001" actually re-checked an already-
  // linked "LIVE-001" behind the scenes, since policyRow (the stale
  // link) used to be checked before the number just typed in.
  it('checks the policy number just submitted, not a stale one already linked for this patient+insurer', async () => {
    mockInsuranceCompany = { id: 'comp-eu', verification_mode: 'roster' }
    mockPlan = { id: 'fallback-plan-id', plan_name: 'Roster-based coverage', company_name: 'EU Insurance', status: 'active' }
    mockAgentPolicyRow = { start_date: null, policy_number: 'OLD-STALE-001' }
    mockRosterRow = { status: 'active' }

    const adapter = new MockInsuranceAdapter()
    await adapter.checkEligibility({
      patientId: 'p1', clinicId: 'clinic_ops',
      verificationMethod: 'ROSTER_POLICY_NUMBER',
      verificationPayload: { companyName: 'EU Insurance', policyNumber: 'NEW-REAL-002' },
    })

    expect(rosterPolicyNumbersQueried).toContain('NEW-REAL-002')
    expect(rosterPolicyNumbersQueried).not.toContain('OLD-STALE-001')
  })

  // Real bug this test would have caught: every distinct real policy
  // number a patient checks against one insurer shares a single
  // Medsa-internal fallback plan row (see _findOrCreateRosterFallbackPlan)
  // - the deductible/annual-limit usage query used to scope only by
  // plan_id+patientId, which can't tell two different real policies
  // apart. A brand-new policy with its own HK$600 annual limit read as
  // "already used this year" purely from other, unrelated policy
  // numbers' claims pooled under the same shared plan.
  it('scopes deductible/annual-limit usage to the real policy number for a roster-fallback plan, not just the shared plan_id', async () => {
    mockInsuranceCompany = { id: 'comp-eu', verification_mode: 'roster' }
    mockPlan = { id: 'fallback-plan-id', plan_name: 'Roster-based coverage', company_name: 'EU Insurance', status: 'active', created_by: 'roster-fallback' }
    mockAgentPolicyRow = { start_date: null, policy_number: 'POLICY-999' }
    mockRosterRow = { status: 'active', overall_annual_limit_hkd: 600 }

    const adapter = new MockInsuranceAdapter()
    await adapter.checkEligibility({
      patientId: 'p1', clinicId: 'clinic_ops',
      verificationMethod: 'ROSTER_POLICY_NUMBER',
      verificationPayload: { companyName: 'EU Insurance', policyNumber: 'POLICY-999' },
    })

    expect(claimsQueryPolicyNumbersQueried).toContain('POLICY-999')
  })

  // Guards the other direction: a normal registered plan (not a shared
  // roster-fallback row) never gets this extra scoping - patientId alone
  // already isolates one patient's own usage there, and policy_number
  // isn't reliably on file for every such plan.
  it('does not scope deductible usage by policy number for a normal (non-fallback) plan', async () => {
    mockPlan = { id: 'real-plan-id', plan_name: 'AIA Critical Rider', company_name: 'AIA', status: 'active' }

    const adapter = new MockInsuranceAdapter()
    await adapter.checkEligibility({ patientId: 'p1', policyNumber: 'real-plan-id', clinicId: 'clinic_ops' })

    expect(claimsQueryPolicyNumbersQueried).toEqual([])
  })

  // Real gap a practice manager flagged: a policy number by itself only
  // proves SOME policy with that number is active at this insurer - it
  // never confirmed the patient actually being billed is the real person
  // that number belongs to, so the same test policy number would
  // "verify" for literally any patient. The roster's own HKID (when it
  // has one on file) now has to agree with the one supplied.
  it('rejects a real policy number when the supplied HKID does not match this policy\'s own HKID on file', async () => {
    mockInsuranceCompany = { id: 'comp-eu', verification_mode: 'roster' }
    mockRosterRow = { status: 'active', hkid: 'A1234567' }
    mockPlan = { id: 'fallback-plan-id', plan_name: 'Roster-based coverage', company_name: 'EU Insurance', status: 'active' }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.checkEligibility({
      clinicId: 'clinic_ops',
      verificationMethod: 'ROSTER_POLICY_NUMBER',
      verificationPayload: { companyName: 'EU Insurance', policyNumber: 'EU-REAL-001', hkid: 'Z9999999' },
    })

    expect(result.isEligible).toBe(false)
  })

  it('still verifies when the supplied HKID matches, or when neither side has one to compare', async () => {
    mockInsuranceCompany = { id: 'comp-eu', verification_mode: 'roster' }
    mockPlan = { id: 'fallback-plan-id', plan_name: 'Roster-based coverage', company_name: 'EU Insurance', status: 'active' }

    mockRosterRow = { status: 'active', hkid: 'A1234567' }
    const adapter = new MockInsuranceAdapter()
    const matching = await adapter.checkEligibility({
      clinicId: 'clinic_ops', verificationMethod: 'ROSTER_POLICY_NUMBER',
      verificationPayload: { companyName: 'EU Insurance', policyNumber: 'EU-REAL-001', hkid: 'A1234567' },
    })
    expect(matching.isEligible).toBe(true)

    mockRosterRow = { status: 'active' } // insurer's roster export carries no HKID for this policy
    const noHkidOnRoster = await adapter.checkEligibility({
      clinicId: 'clinic_ops', verificationMethod: 'ROSTER_POLICY_NUMBER',
      verificationPayload: { companyName: 'EU Insurance', policyNumber: 'EU-REAL-001', hkid: 'A1234567' },
    })
    expect(noHkidOnRoster.isEligible).toBe(true)
  })

  // Real confusion a practice manager hit while testing their own named
  // plan ("new outpatient", configured with a HK$500 annual deductible):
  // once its linked policy number verified against the insurer's roster,
  // that real policy's own HK$2,000 deductible correctly overrode the
  // plan's $500 default (a genuine policyholder's negotiated terms are
  // supposed to win) - but nothing on the claim result explained why the
  // deductible used didn't match what they'd configured.
  it("surfaces a note when a verified policy's own terms differ from the plan's configured defaults", async () => {
    mockPlan = { id: 'plan-named', plan_name: 'new outpatient', company_name: 'Test Insurer Co', status: 'active', copay_rate: 0.10, annual_deductible_hkd: 500 }
    mockInsuranceCompany = { id: 'comp-tic', verification_mode: 'roster' }
    mockAgentPolicyRow = { start_date: '2020-01-01', policy_number: 'TIC-2026-001' }
    mockRosterRow = { status: 'active', copay_rate: 0.2, annual_deductible_hkd: 2000, overall_annual_limit_hkd: 50000 }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-named', clinicId: 'clinic_ops',
      totalGrossAmount: 3000, items: [], medicalRecordId: 'mr1',
    })

    expect(result.policyTermsOverride).toContain('HK$2000')
    expect(result.policyTermsOverride).toContain('HK$500')
  })

  it('has no override note when the verified policy carries no terms of its own to differ', async () => {
    mockPlan = { id: 'plan-named', plan_name: 'new outpatient', company_name: 'Test Insurer Co', status: 'active', copay_rate: 0.10, annual_deductible_hkd: 500 }
    mockInsuranceCompany = { id: 'comp-tic', verification_mode: 'roster' }
    mockAgentPolicyRow = { start_date: '2020-01-01', policy_number: '1234' }
    mockRosterRow = { status: 'active', copay_rate: null, annual_deductible_hkd: null, overall_annual_limit_hkd: null }
    mockMedicalRecord = { doctor_name: 'Dr. Verified', patient_id: 'p1' }
    mockStaffCredential = { verification_status: 'verified', has_epc: true }

    const adapter = new MockInsuranceAdapter()
    const result = await adapter.adjudicateClaim({
      patientId: 'p1', policyNumber: 'plan-named', clinicId: 'clinic_ops',
      totalGrossAmount: 100, items: [], medicalRecordId: 'mr1',
    })

    expect(result.policyTermsOverride).toBeNull()
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
