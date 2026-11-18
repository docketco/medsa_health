// lib/adPricingMenu.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared by medsa-admin's "Ad pricing menu" box, sponsor-submit.jsx's
// upfront price note, and approve_for_payment.js. Real feedback: "can it
// auto calculate the days, or can it just be month-wise like 1/3/6 month
// and a year? why would anyone calculate the days?" - durations are now
// exactly these four fixed, calendar-month options, never a typed-in day
// count. An end date is computed with real calendar months (setMonth),
// not day multiplication, so "1 month" from Jan 31 lands on Feb 28/29
// like a person would expect, not 30 days later.
// ─────────────────────────────────────────────────────────────────────────────

export const AD_PRICING_MONTH_OPTIONS = [1, 3, 6, 12]

export function monthsLabel(months) {
  if (months === 12) return '1 year'
  return `${months} month${months === 1 ? '' : 's'}`
}

export function addMonthsToDateString(dateStr, months) {
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return null
  const day = d.getDate()
  // Found live-testing: a naive setMonth() on a day that doesn't exist in
  // the target month overflows into the month AFTER - e.g. 31 Jan + 1
  // month lands on 3 Mar, not 28 Feb, because Feb only has 28 days and JS
  // just keeps counting. Clamp to the target month's real last day
  // instead, which is what a person actually means by "1 month later".
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDayOfTargetMonth))
  return d
}
