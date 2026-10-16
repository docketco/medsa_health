import { describe, it, expect } from 'vitest'
import { ageDaysBetween, percentileBands, growthPercentile, WHO_MAX_AGE_DAYS } from './whoGrowth'

describe('ageDaysBetween', () => {
  it('counts whole days between two dates', () => {
    expect(ageDaysBetween('2023-09-13', '2023-09-14')).toBe(1)
    expect(ageDaysBetween('2023-09-13', '2024-09-13')).toBe(366) // 2024 is a leap year
  })
})

describe('percentileBands', () => {
  it('returns ordered bands (p3 < p15 < p50 < p85 < p97) across the range', () => {
    const bands = percentileBands('wfa', 'male', 365, 4)
    expect(bands.length).toBe(5)
    for (const b of bands) {
      expect(b.p3).toBeLessThan(b.p15)
      expect(b.p15).toBeLessThan(b.p50)
      expect(b.p50).toBeLessThan(b.p85)
      expect(b.p85).toBeLessThan(b.p97)
    }
  })

  it('clamps a requested range past the published WHO window', () => {
    const bands = percentileBands('lhfa', 'female', 5000, 2)
    expect(bands[bands.length - 1].ageDays).toBeLessThanOrEqual(WHO_MAX_AGE_DAYS)
  })
})

describe('growthPercentile', () => {
  it('reports the 50th percentile for a value exactly at the median', () => {
    const bands = percentileBands('wfa', 'female', 365, 1)
    const medianAtOneYear = bands[1].p50
    const result = growthPercentile('wfa', medianAtOneYear, 'female', 365)
    expect(result.percentile).toBeGreaterThan(45)
    expect(result.percentile).toBeLessThan(55)
  })

  it('never throws for an age past the WHO window - ageDays is pre-clamped before reaching the library', () => {
    const result = growthPercentile('wfa', 20, 'male', 99999)
    expect(result.x).toBe(WHO_MAX_AGE_DAYS)
    expect(Number.isFinite(result.percentile)).toBe(true)
  })
})
