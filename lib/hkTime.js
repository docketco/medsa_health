// lib/hkTime.js
// ─────────────────────────────────────────────────────────────────────────────
// Hong Kong has one fixed UTC+8 offset year-round (no daylight saving), so
// converting between a Hong Kong wall-clock date/time and the UTC instant
// that represents it is exact arithmetic, not something that needs a
// timezone library. Every place that builds an appointment's scheduled_at
// from a date+time someone picked, or reads one back apart into
// day-of-week/hour/minute to check against a doctor's working hours, has
// to go through here - not through the browser's own local Date methods
// (setHours, getDay, toLocaleTimeString without an explicit timeZone),
// all of which silently use whatever timezone the *device* happens to be
// in. A clinic's hours, and every doctor_availability row, are defined in
// Hong Kong time regardless of where the person clicking the button is -
// this was the real root cause of a patient calendar time bug reported
// three times, and of a switch-doctor availability check that looked
// right in code but compared against a value already corrupted by the
// same bug.
// ─────────────────────────────────────────────────────────────────────────────

const HK_OFFSET_MS = 8 * 60 * 60 * 1000

// The real UTC instant for a specific Hong Kong wall-clock date+time.
export function hkWallTimeToUTC(year, month, day, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - HK_OFFSET_MS)
}

// Decompose any Date/ISO string into its Hong Kong wall-clock parts.
export function hkParts(dateLike) {
  const d = typeof dateLike === 'string' ? new Date(dateLike) : dateLike
  const hk = new Date(d.getTime() + HK_OFFSET_MS)
  return {
    year: hk.getUTCFullYear(), month: hk.getUTCMonth() + 1, day: hk.getUTCDate(),
    hour: hk.getUTCHours(), minute: hk.getUTCMinutes(),
    dayOfWeek: hk.getUTCDay(), // 0=Sunday .. 6=Saturday, same convention as JS getDay()
  }
}

export function hkHHMM(dateLike) {
  const p = hkParts(dateLike)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

// Start/end of the Hong Kong calendar day containing dateLike, as real UTC
// instants - not local midnight, which is a different moment entirely for
// a device outside Hong Kong.
export function hkDayBounds(dateLike) {
  const p = hkParts(dateLike)
  return {
    start: hkWallTimeToUTC(p.year, p.month, p.day, 0, 0, 0),
    end: hkWallTimeToUTC(p.year, p.month, p.day, 23, 59, 59),
  }
}

// True if two Date/ISO values fall on the same Hong Kong calendar day.
export function isSameHkDay(a, b) {
  const pa = hkParts(a), pb = hkParts(b)
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day
}
