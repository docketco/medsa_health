// lib/icd10Match.js
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic ICD-10 code resolution - no AI (same posture as the rest of
// the suitability rebuild). Given a batch of free-text terms (a patient's
// declared conditions, a plan's covered_conditions/insurer_flags, a real
// consultation diagnosis), looks each one up against icd10_reference by
// keyword overlap - the same free tier already proven in
// pages/api/cds/suggest_icd10.js, just without ever escalating to AI when
// keyword matching comes up empty (this flow doesn't use AI anywhere).
//
// Real constraint this exists to handle (not every term resolves): a
// plan's covered_conditions list is free text an insurer typed, a
// patient's declaration is free text they typed, and even a real
// consultation's diagnosis isn't always ICD-10 coded (medical_records.
// icd10_code is optional, filled in only when a doctor added one). So
// resolution is best-effort per term - a term that doesn't resolve
// returns null here, and the caller (planSuitabilityMatch.js) falls back
// to its existing text/substring matching for that term, same as always.
// Only when NEITHER mechanism finds a clean answer does a case end up
// ambiguous (flagged for a human) - never a silent gap.
// ─────────────────────────────────────────────────────────────────────────────

function extractKeywords(text) {
  return [...new Set((String(text || '').toLowerCase().match(/[a-z]{4,}/g) || []))]
}

function scoreLabel(labelLower, keywords) {
  return keywords.filter(k => labelLower.includes(k)).length
}

// Same disease-family grouping used for comparison, not exact-code-only -
// e.g. E11.9 (type 2 diabetes without complications) and E11.2 (... with
// kidney complications) share the E11 family. Chapter-level (too broad,
// spans hundreds of unrelated conditions) is deliberately not used.
export function icd10CodePrefix(code) {
  return code ? String(code).trim().slice(0, 3).toUpperCase() : null
}

// Resolves a batch of free-text terms to their best-matching ICD-10 code
// in ONE query (keyword-narrowed candidate pool, then scored per term) -
// not one round trip per term, since callers here can be resolving codes
// for a whole plan catalog's covered_conditions/insurer_flags at once.
// Returns a Map of normalized-term -> {code, label} | null.
export async function resolveManyIcd10(supabase, terms) {
  const uniqueTerms = [...new Set((terms || []).map(t => (t || '').trim().toLowerCase()).filter(Boolean))]
  const result = new Map()
  if (uniqueTerms.length === 0) return result

  const allKeywords = [...new Set(uniqueTerms.flatMap(extractKeywords))].slice(0, 40)
  if (allKeywords.length === 0) { uniqueTerms.forEach(t => result.set(t, null)); return result }

  const orClause = allKeywords.map(k => `label.ilike.%${k}%`).join(',')
  const { data } = await supabase.from('icd10_reference').select('code, label').or(orClause).limit(300)
  const candidates = data || []

  for (const term of uniqueTerms) {
    const keywords = extractKeywords(term)
    if (keywords.length === 0 || candidates.length === 0) { result.set(term, null); continue }
    let best = null, bestScore = 0
    for (const c of candidates) {
      const score = scoreLabel(c.label.toLowerCase(), keywords)
      // Prefer more keyword hits; among ties, the shorter/more specific
      // label (e.g. "Type 2 diabetes mellitus" over a longer compound
      // entry that happens to share the same keywords).
      if (score > 0 && (score > bestScore || (score === bestScore && best && c.label.length < best.label.length))) {
        best = c; bestScore = score
      }
    }
    result.set(term, best ? { code: best.code, label: best.label } : null)
  }
  return result
}

// Converts a resolveManyIcd10 Map into a plain object keyed the same way -
// planSuitabilityMatch.js takes plain objects so it stays a pure,
// synchronous, easily-unit-tested function with no Map/DB coupling.
export function codeMapToObject(map) {
  const obj = {}
  for (const [k, v] of map.entries()) obj[k] = v ? v.code : null
  return obj
}
