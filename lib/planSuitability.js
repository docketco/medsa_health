// lib/planSuitability.js
// ─────────────────────────────────────────────────────────────────────────────
// Rule-based plan-suitability matching - the deterministic source of truth
// for both the patient's automated quote path and the pre-analysis an agent
// sees on a routed inquiry. Given a plan and the conditions a patient
// declared (or that came from their own visit history, with consent), this
// decides whether the plan looks suitable, computes the real age-matched
// quote, and explains why in plain language - all without needing an AI
// call. An AI layer (see pages/api/patient/match_plan_suitability.js) may
// rewrite the summary into friendlier prose, but it never gets to change
// the verdict or the quote - those stay deterministic and auditable.
// ─────────────────────────────────────────────────────────────────────────────

function normalize(s) {
  return (s || '').toLowerCase().trim()
}

// Consent-shared visit history can carry dozens of free-text diagnosis
// notes - without a cap here, the summary sentence just runs on for as
// long as that history does. Full lists stay on excludedConditions/
// uncoveredConditions for anything that needs them; this only shortens
// what gets spelled out in plain-language prose.
function formatList(items, max = 5) {
  if (items.length <= max) return items.join(', ')
  return `${items.slice(0, max).join(', ')}, and ${items.length - max} more`
}

// A declared condition counts as "covered" if the plan's own
// covered_conditions list contains it (loosely - either string contains
// the other, so "diabetes" matches a plan listing "type 2 diabetes").
function isCovered(condition, coveredConditions) {
  const c = normalize(condition)
  return coveredConditions.some(cc => {
    const n = normalize(cc)
    return n === c || n.includes(c) || c.includes(n)
  })
}

export function matchPlanSuitability({ plan, patientAge, conditions }) {
  const coveredConditions = plan.covered_conditions || []
  const coveredCategories = plan.covered_categories || []
  const insurerFlags = plan.insurer_flags || []
  const declared = [...new Set((conditions || []).map(c => (c || '').trim()).filter(Boolean))]

  const excludedHits = []
  const uncoveredHits = []
  // The insurer's own "always flag this" list - separate from the
  // covered/excluded matching above. An insurer can name anything they
  // want a human to see regardless of how the plan's own coverage terms
  // read (a high-risk activity, an age band, a category they want a
  // second look at) - this isn't about whether it's covered, it's the
  // insurer saying "show this to someone before it goes through."
  const insurerFlaggedHits = []
  for (const condition of declared) {
    const covered = isCovered(condition, coveredConditions)
    if (!covered) {
      // Only a plan that explicitly excludes pre-existing conditions (and
      // doesn't separately list this one as covered) counts as a real
      // exclusion risk - everything else just means "not explicitly listed",
      // which is a softer "confirm before relying on it" note, not a block.
      if (plan.pre_existing_condition_policy === 'excluded') excludedHits.push(condition)
      else if (coveredCategories.length > 0) uncoveredHits.push(condition)
    }
    if (isCovered(condition, insurerFlags)) insurerFlaggedHits.push(condition)
  }

  let verdict = 'suitable'
  if (excludedHits.length > 0) verdict = 'needs_review'
  else if (uncoveredHits.length > 0) verdict = 'suitable_with_notes'
  // An insurer flag always forces at least a closer look, even over an
  // otherwise-clean "suitable" read - it's the insurer's own call, not
  // something the rule engine should soften.
  if (insurerFlaggedHits.length > 0 && verdict !== 'needs_review') verdict = 'needs_review'

  const tiers = plan.insurance_plan_pricing_tiers || []
  const matchedTier = patientAge != null ? tiers.find(t => patientAge >= t.age_min && patientAge <= t.age_max) : null
  const usedTier = matchedTier || tiers[0] || null
  const quotedPremium = usedTier ? usedTier.monthly_premium : null

  const summaryLines = []
  if (excludedHits.length > 0) {
    summaryLines.push(`${formatList(excludedHits)} ${excludedHits.length === 1 ? 'is' : 'are'} excluded under this plan's pre-existing condition policy - an agent should review this before it's relied on.`)
  }
  if (uncoveredHits.length > 0) {
    summaryLines.push(`${formatList(uncoveredHits)} ${uncoveredHits.length === 1 ? "isn't" : "aren't"} explicitly listed as covered by this plan - worth confirming before relying on it.`)
  }
  if (insurerFlaggedHits.length > 0) {
    summaryLines.push(`${plan.company_name || 'The insurer'} asks that ${formatList(insurerFlaggedHits)} always ${insurerFlaggedHits.length === 1 ? 'be' : 'be'} reviewed before this plan is relied on.`)
  }
  if (verdict === 'suitable') {
    summaryLines.push(declared.length > 0 ? "Nothing declared conflicts with this plan's coverage." : 'No conditions were declared to check against this plan.')
  }
  if (plan.waiting_period_days) {
    summaryLines.push(`New conditions have a ${plan.waiting_period_days}-day waiting period before they're covered.`)
  }
  if (quotedPremium != null) {
    summaryLines.push(`Estimated premium: HK$${quotedPremium}/mo${matchedTier ? '' : ' (no age-matched pricing tier on file - showing the base rate)'}.`)
  } else {
    summaryLines.push('No pricing tiers on file for this plan yet - contact the insurer for a quote.')
  }

  return {
    verdict,
    quotedPremium,
    summary: summaryLines.join(' '),
    excludedConditions: excludedHits,
    uncoveredConditions: uncoveredHits,
    insurerFlaggedConditions: insurerFlaggedHits,
  }
}
