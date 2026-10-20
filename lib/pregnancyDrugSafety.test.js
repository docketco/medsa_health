import { describe, it, expect } from 'vitest'
import { PREGNANCY_DRUG_SAFETY_CATEGORIES, searchPregnancyDrugSafety } from './pregnancyDrugSafety'

describe('pregnancyDrugSafety', () => {
  it('every entry has all four columns filled in', () => {
    for (const cat of PREGNANCY_DRUG_SAFETY_CATEGORIES) {
      for (const d of cat.drugs) {
        expect(d.name).toBeTruthy()
        expect(d.trimester1).toBeTruthy()
        expect(d.trimester2and3).toBeTruthy()
        expect(d.breastfeeding).toBeTruthy()
        expect(d.summary).toBeTruthy()
      }
    }
  })

  it('matches by substring, case-insensitively', () => {
    expect(searchPregnancyDrugSafety('albuterol')).toHaveLength(1)
    expect(searchPregnancyDrugSafety('ALBUTEROL')).toHaveLength(1)
    expect(searchPregnancyDrugSafety('paxil')).toHaveLength(1)
  })

  it('matches a combined slash entry by either name', () => {
    expect(searchPregnancyDrugSafety('levofloxacin')).toHaveLength(1)
    expect(searchPregnancyDrugSafety('ciprofloxacin')).toHaveLength(1)
  })

  it('returns empty for an unknown substance and for an empty query', () => {
    expect(searchPregnancyDrugSafety('acetaminophen')).toEqual([])
    expect(searchPregnancyDrugSafety('')).toEqual([])
  })

  it('tags each result with its category', () => {
    const [hit] = searchPregnancyDrugSafety('folic acid')
    expect(hit.category).toBe('Vitamins, Minerals & Dietary Supplements')
  })
})
