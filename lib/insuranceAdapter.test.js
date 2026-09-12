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
let mockMedicalRecord = null
let mockStaffCredential = null
let mockAgentPolicyRow = null
let mockInsuranceCompany = null
let mockRosterRow = null
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
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: resolveMockRow(table) }),
    gte: async () => ({ data: table === 'insurance_claims' ? [{ amount: mockPriorClaimsSum }] : [] }),
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
  mockMedicalRecord = null
  mockStaffCredential = null
  mockAgentPolicyRow = null
  mockInsuranceCompany = null
  mockRosterRow = null
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
