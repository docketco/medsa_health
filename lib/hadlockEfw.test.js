import { describe, it, expect } from 'vitest'
import { computeEFWGrams } from './hadlockEfw'

describe('computeEFWGrams', () => {
  it('picks Hadlock 4 when all four measurements are present, matching the formula exactly', () => {
    const bpd = 8.5, hc = 30, ac = 28, fl = 6.2
    const expectedLog10 = 1.3596 - 0.00386*(ac*fl) + 0.0064*hc + 0.00061*(bpd*ac) + 0.0424*ac + 0.174*fl
    const result = computeEFWGrams({ bpd, hc, ac, fl })
    expect(result.model).toMatch(/Hadlock 4/)
    expect(result.grams).toBe(Math.round(10 ** expectedLog10))
  })

  it('falls back to Hadlock 3 (HC, AC, FL) when BPD is missing', () => {
    const hc = 30, ac = 28, fl = 6.2
    const expectedLog10 = 1.326 - 0.00326*(ac*fl) + 0.0107*hc + 0.0438*ac + 0.158*fl
    const result = computeEFWGrams({ hc, ac, fl })
    expect(result.model).toMatch(/Hadlock 3/)
    expect(result.grams).toBe(Math.round(10 ** expectedLog10))
  })

  it('falls back to Hadlock 2 (BPD, AC, FL) when HC is missing', () => {
    const bpd = 8.5, ac = 28, fl = 6.2
    const expectedLog10 = 1.335 - 0.0034*(ac*fl) + 0.0316*bpd + 0.0457*ac + 0.1623*fl
    const result = computeEFWGrams({ bpd, ac, fl })
    expect(result.model).toMatch(/Hadlock 2/)
    expect(result.grams).toBe(Math.round(10 ** expectedLog10))
  })

  it('falls back to Hadlock 1 (AC, FL) with just those two', () => {
    const ac = 28, fl = 6.2
    const expectedLog10 = 1.304 + 0.05281*ac + 0.1938*fl - 0.004*(ac*fl)
    const result = computeEFWGrams({ ac, fl })
    expect(result.model).toMatch(/Hadlock 1/)
    expect(result.grams).toBe(Math.round(10 ** expectedLog10))
  })

  it('falls back to the historical BPD/AC model when FL is missing', () => {
    const bpd = 8.5, ac = 28
    const expectedLog10 = 1.1134 + 0.05845*ac - 0.000604*(ac*ac) - 0.007365*(bpd*bpd) + 0.000595*(bpd*ac) + 0.1694*bpd
    const result = computeEFWGrams({ bpd, ac })
    expect(result.model).toMatch(/Historical \(BPD, AC\)/)
    expect(result.grams).toBe(Math.round(10 ** expectedLog10))
  })

  it('falls back to the historical AC-only model (natural log, not log10) with just AC', () => {
    const ac = 28
    const expectedLn = 2.695 + 0.253*ac - 0.00275*(ac*ac)
    const result = computeEFWGrams({ ac })
    expect(result.model).toMatch(/Historical \(AC only\)/)
    expect(result.grams).toBe(Math.round(Math.E ** expectedLn))
  })

  it('returns null when no recognised combination of measurements is present', () => {
    expect(computeEFWGrams({ fl: 6.2 })).toBeNull()
    expect(computeEFWGrams({})).toBeNull()
  })
})
