import { describe, it, expect } from 'vitest'
import { matchPlanSuitability } from './planSuitability'

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
  it('is suitable with no declared conditions', () => {
    const r = matchPlanSuitability({ plan: basePlan, patientAge: 30, conditions: [] })
    expect(r.verdict).toBe('suitable')
    expect(r.quotedPremium).toBe(300)
  })

  it('matches an age-tier premium for an older patient', () => {
    const r = matchPlanSuitability({ plan: basePlan, patientAge: 45, conditions: [] })
    expect(r.quotedPremium).toBe(500)
  })

  it('is suitable when a declared condition is explicitly covered', () => {
    const r = matchPlanSuitability({ plan: basePlan, patientAge: 30, conditions: ['diabetes'] })
    expect(r.verdict).toBe('suitable')
    expect(r.excludedConditions).toEqual([])
    expect(r.uncoveredConditions).toEqual([])
  })

  it('flags needs_review when the plan excludes pre-existing conditions and one is declared that is not listed as covered', () => {
    const plan = { ...basePlan, pre_existing_condition_policy: 'excluded' }
    const r = matchPlanSuitability({ plan, patientAge: 30, conditions: ['asthma'] })
    expect(r.verdict).toBe('needs_review')
    expect(r.excludedConditions).toEqual(['asthma'])
  })

  it('does not flag a condition as excluded when the plan does not exclude pre-existing conditions', () => {
    const r = matchPlanSuitability({ plan: basePlan, patientAge: 30, conditions: ['asthma'] })
    expect(r.verdict).toBe('suitable_with_notes')
    expect(r.uncoveredConditions).toEqual(['asthma'])
  })

  it('an explicitly covered condition is never flagged, even when the plan excludes pre-existing conditions generally', () => {
    const plan = { ...basePlan, pre_existing_condition_policy: 'excluded' }
    const r = matchPlanSuitability({ plan, patientAge: 30, conditions: ['hypertension'] })
    expect(r.verdict).toBe('suitable')
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
    expect(r.excludedConditions).toEqual(['asthma', 'Asthma'])
  })

  it('forces needs_review when an insurer flag matches, even on an otherwise clean read', () => {
    const plan = { ...basePlan, insurer_flags: ['extreme sports'] }
    const r = matchPlanSuitability({ plan, patientAge: 30, conditions: ['extreme sports'] })
    expect(r.verdict).toBe('needs_review')
    expect(r.insurerFlaggedConditions).toEqual(['extreme sports'])
  })

  it('an insurer flag does not fire when nothing declared matches it', () => {
    const plan = { ...basePlan, insurer_flags: ['extreme sports'] }
    const r = matchPlanSuitability({ plan, patientAge: 30, conditions: ['diabetes'] })
    expect(r.verdict).toBe('suitable')
    expect(r.insurerFlaggedConditions).toEqual([])
  })
})
