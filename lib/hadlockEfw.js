// lib/hadlockEfw.js
// ─────────────────────────────────────────────────────────────────────────────
// Estimated fetal weight (EFW) from ultrasound biometry, using the real
// Hadlock regression equations (Hadlock et al., 1984/1985) - transcribed
// verbatim from the clinical reference table the user supplied. All inputs
// are centimetres, straight off a patient's own ultrasound report (BPD,
// HC, AC, FL) - not something Medsa measures itself.
//
// Picks the best-available model for whichever measurements are present,
// most parameters (most accurate) first. If none of the recognised
// combinations are present, returns null rather than guessing with a
// weaker model than the inputs would actually support, or silently
// falling back to something not in the source table.
//
// Deliberately does NOT attempt a percentile-against-gestational-age
// comparison - that needs the real INTERGROWTH-21st reference tables,
// which aren't in hand (PDF links were given, but this environment can't
// fetch them). This only computes the weight estimate itself, same as a
// real ultrasound machine would from these formulas.
// ─────────────────────────────────────────────────────────────────────────────

function hadlock4(bpd, hc, ac, fl) {
  return 1.3596 - 0.00386*(ac*fl) + 0.0064*hc + 0.00061*(bpd*ac) + 0.0424*ac + 0.174*fl
}
function hadlock3(hc, ac, fl) {
  return 1.326 - 0.00326*(ac*fl) + 0.0107*hc + 0.0438*ac + 0.158*fl
}
function hadlock2(bpd, ac, fl) {
  return 1.335 - 0.0034*(ac*fl) + 0.0316*bpd + 0.0457*ac + 0.1623*fl
}
function hadlock1(ac, fl) {
  return 1.304 + 0.05281*ac + 0.1938*fl - 0.004*(ac*fl)
}
function historicalBpdAc(bpd, ac) {
  return 1.1134 + 0.05845*ac - 0.000604*(ac*ac) - 0.007365*(bpd*bpd) + 0.000595*(bpd*ac) + 0.1694*bpd
}
function historicalAcLn(ac) {
  return 2.695 + 0.253*ac - 0.00275*(ac*ac) // natural log, not log10
}

// Returns { grams, model } for the best-available Hadlock model given
// whichever of {bpd, hc, ac, fl} are present (each a number in cm, or
// null/undefined), or null if none of the known combinations is covered.
export function computeEFWGrams({ bpd, hc, ac, fl } = {}) {
  const has = v => v != null && Number.isFinite(v)
  if (has(bpd) && has(hc) && has(ac) && has(fl)) {
    return { grams: Math.round(10 ** hadlock4(bpd, hc, ac, fl)), model: 'Hadlock 4 (BPD, HC, AC, FL)' }
  }
  if (has(hc) && has(ac) && has(fl)) {
    return { grams: Math.round(10 ** hadlock3(hc, ac, fl)), model: 'Hadlock 3 (HC, AC, FL)' }
  }
  if (has(bpd) && has(ac) && has(fl)) {
    return { grams: Math.round(10 ** hadlock2(bpd, ac, fl)), model: 'Hadlock 2 (BPD, AC, FL)' }
  }
  if (has(ac) && has(fl)) {
    return { grams: Math.round(10 ** hadlock1(ac, fl)), model: 'Hadlock 1 (AC, FL)' }
  }
  if (has(bpd) && has(ac)) {
    return { grams: Math.round(10 ** historicalBpdAc(bpd, ac)), model: 'Historical (BPD, AC) - Hadlock 1984' }
  }
  if (has(ac)) {
    return { grams: Math.round(Math.E ** historicalAcLn(ac)), model: 'Historical (AC only) - Hadlock 1984' }
  }
  return null
}
