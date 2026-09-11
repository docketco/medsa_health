import { describe, it, expect } from 'vitest'
import { hkWallTimeToUTC, hkParts, hkHHMM, hkDayBounds, isSameHkDay } from './hkTime'

describe('hkWallTimeToUTC', () => {
  it('converts a Hong Kong wall-clock time to the correct UTC instant', () => {
    // 2026-09-11 13:00 HKT = 2026-09-11 05:00 UTC (HKT is UTC+8, no DST)
    const d = hkWallTimeToUTC(2026, 9, 11, 13, 0)
    expect(d.toISOString()).toBe('2026-09-11T05:00:00.000Z')
  })

  it('rolls over correctly for a time near midnight HKT', () => {
    // 2026-09-11 00:30 HKT = 2026-09-10 16:30 UTC (previous UTC day)
    const d = hkWallTimeToUTC(2026, 9, 11, 0, 30)
    expect(d.toISOString()).toBe('2026-09-10T16:30:00.000Z')
  })
})

describe('hkParts / hkHHMM', () => {
  it('reads back the same wall-clock time regardless of how the instant was built', () => {
    const utc = new Date('2026-09-11T05:00:00.000Z')
    const p = hkParts(utc)
    expect(p).toMatchObject({ year: 2026, month: 9, day: 11, hour: 13, minute: 0 })
    expect(hkHHMM(utc)).toBe('13:00')
  })

  it('resolves the correct Hong Kong day-of-week even when the UTC day differs', () => {
    // 2026-09-11 is a Friday in Hong Kong; at 00:30 HKT the UTC instant
    // (2026-09-10T16:30Z) falls on a Thursday in UTC terms - hkParts must
    // still report Friday (5), not Thursday (4), and specifically not
    // whatever the *browser's own* local timezone would derive.
    const d = hkWallTimeToUTC(2026, 9, 11, 0, 30)
    expect(hkParts(d).dayOfWeek).toBe(5) // Friday
  })
})

describe('hkDayBounds', () => {
  it('spans exactly the Hong Kong calendar day', () => {
    const { start, end } = hkDayBounds(new Date('2026-09-11T05:00:00.000Z'))
    expect(start.toISOString()).toBe('2026-09-10T16:00:00.000Z') // 2026-09-11 00:00 HKT
    expect(end.toISOString()).toBe('2026-09-11T15:59:59.000Z')   // 2026-09-11 23:59:59 HKT
  })
})

describe('isSameHkDay', () => {
  it('agrees two instants are the same Hong Kong calendar day even when their raw UTC dates differ', () => {
    const early = hkWallTimeToUTC(2026, 9, 11, 0, 30) // 2026-09-10T16:30Z - UTC date is the 10th
    const late = hkWallTimeToUTC(2026, 9, 11, 23, 30) // 2026-09-11T15:30Z - UTC date is the 11th
    expect(isSameHkDay(early, late)).toBe(true)
  })

  it('disagrees when the Hong Kong calendar day is genuinely different', () => {
    const day1 = hkWallTimeToUTC(2026, 9, 11, 12, 0)
    const day2 = hkWallTimeToUTC(2026, 9, 12, 12, 0)
    expect(isSameHkDay(day1, day2)).toBe(false)
  })
})
