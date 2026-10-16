// lib/whoGrowth.js
// ─────────────────────────────────────────────────────────────────────────────
// Thin wrapper around who-growth-standards (real WHO Child Growth Standards
// LMS tables, bundled and computed locally - see that package's own NOTICE
// for data provenance). Kept here so PatientApp.jsx doesn't import the raw
// package in more than one place, and so unit/age-math is in one spot.
//
// Deliberately NOT doing preterm correction - that needs a known
// gestational age at birth, which isn't captured anywhere on a Kids
// profile today. Every result here is against full-term WHO norms; a
// premature baby's true percentile would read lower than shown until that
// data exists and correctedAgeInDays() is wired in.
// ─────────────────────────────────────────────────────────────────────────────

import { weightForAge, heightForAge, valueAtPercentile } from 'who-growth-standards'

export const WHO_MAX_AGE_DAYS = 1856 // ~5.08 years - the published WHO Child Growth Standards range

export function ageDaysBetween(fromISODate, toISODate) {
  const from = new Date(fromISODate + 'T00:00:00Z')
  const to = new Date(toISODate + 'T00:00:00Z')
  return Math.round((to - from) / 86400000)
}

// Samples the 3rd/15th/50th/85th/97th percentile curves across [0, maxAgeDays]
// for background reference bands on a chart.
export function percentileBands(indicator, sex, maxAgeDays, steps = 24) {
  const clampedMax = Math.max(1, Math.min(maxAgeDays, WHO_MAX_AGE_DAYS))
  const bands = []
  for (let i = 0; i <= steps; i++) {
    const ageDays = Math.round((clampedMax / steps) * i)
    bands.push({
      ageDays,
      p3: valueAtPercentile(indicator, sex, 3, ageDays),
      p15: valueAtPercentile(indicator, sex, 15, ageDays),
      p50: valueAtPercentile(indicator, sex, 50, ageDays),
      p85: valueAtPercentile(indicator, sex, 85, ageDays),
      p97: valueAtPercentile(indicator, sex, 97, ageDays),
    })
  }
  return bands
}

// Where one measured value lands against the WHO curve.
export function growthPercentile(indicator, value, sex, ageDays) {
  const clamped = Math.max(0, Math.min(ageDays, WHO_MAX_AGE_DAYS))
  const fn = indicator === 'wfa' ? weightForAge : heightForAge
  return fn(value, { sex, ageDays: clamped, clamp: true })
}
