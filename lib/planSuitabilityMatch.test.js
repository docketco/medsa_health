import { describe, it, expect } from 'vitest'
import { matchPlanSuitability } from './planSuitabilityMatch'

const basePlan = {
  covered_conditions: ['type 2 diabetes', 'hypertension'],
  covered_categories: ['Hospitalisation', 'Outpatient'],
  pre_existing_condition_policy: null,
  waiting_period_days: null,
  insurance_plan_pricing_tiers: [
    { age_min: 0, age_max: 39, monthly_premium: 300 },
    { age_min: 40, age_max: 120, monthly_premium: 500 },
  ],
}

describe('matchPlanSuitability', () => {
  it('is approved with no declared conditions', () => {
    const r = matchPlanSuitability({ plan: basePlan, patientAge: 30, conditions: [] })
    expect(r.verdict).toBe('approved')
    expect(r.quotedPremium).toBe(300)
  })

  it('matches an age-tier premium for an older patient', () => {
    const r = matchPlanSuitability({ plan: basePlan, patientAge: 45, conditions: [] })
    expect(r.quotedPremium).toBe(500)
  })

  it('is approved when a declared condition is explicitly covered', () => {
    const r = matchPlanSuitability({ plan: basePlan, patientAge: 30, conditions: ['diabetes'] })
    expect(r.verdict).toBe('approved')
    expect(r.declinedConditions).toEqual([])
    expect(r.flaggedConditions).toEqual([])
  })

  it('declines - by matching alone, no human needed - when the plan excludes pre-existing conditions and one is declared that is not listed as covered', () => {
    const plan = { ...basePlan, pre_existing_condition_policy: 'excluded' }
    const r = matchPlanSuitability({ plan, patientAge: 30, conditions: ['asthma'] })
    expect(r.verdict).toBe('declined')
    expect(r.declinedConditions).toEqual(['asthma'])
    expect(r.flagCategory).toBeNull()
  })

  it('flags for human review (not a decline) when the plan does not exclude pre-existing conditions generally', () => {
    const r = matchPlanSuitability({ plan: basePlan, patientAge: 30, conditions: ['asthma'] })
    expect(r.verdict).toBe('flagged')
    expect(r.flaggedConditions).toEqual(['asthma'])
    expect(r.flagCategory).toBe('declared condition not clearly covered')
  })

  it('an explicitly covered condition is never flagged or declined, even when the plan excludes pre-existing conditions generally', () => {
    const plan = { ...basePlan, pre_existing_condition_policy: 'excluded' }
    const r = matchPlanSuitability({ plan, patientAge: 30, conditions: ['hypertension'] })
    expect(r.verdict).toBe('approved')
  })

  it('returns null premium and a note when the plan has no pricing tiers', () => {
    const plan = { ...basePlan, insurance_plan_pricing_tiers: [] }
    const r = matchPlanSuitability({ plan, patientAge: 30, conditions: [] })
    expect(r.quotedPremium).toBeNull()
    expect(r.summary).toContain('No pricing tiers on file')
  })

  it('falls back to the first tier when patient age is unknown', () => {
    const r = matchPlanSuitability({ plan: basePlan, patientAge: null, conditions: [] })
    expect(r.quotedPremium).toBe(300)
  })

  it('dedupes and trims declared conditions', () => {
    const plan = { ...basePlan, pre_existing_condition_policy: 'excluded' }
    const r = matchPlanSuitability({ plan, patientAge: 30, conditions: [' asthma ', 'asthma', 'Asthma'] })
    expect(r.declinedConditions).toEqual(['asthma', 'Asthma'])
  })

  it('flags (never auto-declines) when an insurer flag matches, even on an otherwise clean read', () => {
    const plan = { ...basePlan, insurer_flags: ['extreme sports'] }
    const r = matchPlanSuitability({ plan, patientAge: 30, conditions: ['extreme sports'] })
    expect(r.verdict).toBe('flagged')
    expect(r.insurerFlaggedConditions).toEqual(['extreme sports'])
    expect(r.flagCategory).toBe('insurer-flagged category')
  })

  it('an insurer flag does not fire when nothing declared matches it', () => {
    const plan = { ...basePlan, insurer_flags: ['extreme sports'] }
    const r = matchPlanSuitability({ plan, patientAge: 30, conditions: ['diabetes'] })
    expect(r.verdict).toBe('approved')
    expect(r.insurerFlaggedConditions).toEqual([])
  })

  it('a clear decline takes priority over an ambiguous flag on the same read', () => {
    const plan = { ...basePlan, pre_existing_condition_policy: 'excluded', insurer_flags: ['extreme sports'] }
    const r = matchPlanSuitability({ plan, patientAge: 30, conditions: ['asthma', 'extreme sports'] })
    expect(r.verdict).toBe('declined')
  })

  it('flagCategory never contains the raw condition text - agent-safe by construction', () => {
    const plan = { ...basePlan, insurer_flags: ['a rare named condition'] }
    const r = matchPlanSuitability({ plan, patientAge: 30, conditions: ['a rare named condition'] })
    expect(r.flagCategory).not.toContain('a rare named condition')
  })
})
