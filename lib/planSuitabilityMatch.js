// lib/planSuitabilityMatch.js
// ─────────────────────────────────────────────────────────────────────────────
// The rebuilt suitability engine (aq2-03/aq2-18) - pure deterministic
// matching, no AI anywhere. Every declared condition is checked against a
// plan's own covered_conditions / covered_categories / insurer_flags and
// sorted into exactly one of three buckets:
//
//   - APPROVED - nothing declared conflicts with the plan. Matching alone
//     decides this; no human ever needs to look at a clean case.
//   - DECLINED - a declared condition is a clear, explicit match to the
//     plan's own pre-existing-condition exclusion. Also decided by
//     matching alone, same engine as APPROVED, just the other direction -
//     an unambiguous "no" doesn't need to wait on a human either.
//   - FLAGGED - the declared condition isn't clean, but it also isn't a
//     clear exclusion (not explicitly listed either way, or the insurer's
//     own insurer_flags list names it as "always review"). This is the
//     only bucket that goes to a human underwriter - reserved for cases
//     where the rule genuinely doesn't have a confident answer.
//
// This replaces lib/planSuitability.js's old two-and-a-half-way verdict
// (suitable / suitable_with_notes / needs_review) and drops the AI
// screening/polish layers that used to sit in
// pages/api/patient/match_plan_suitability.js entirely - the whole flow
// runs on this module with or without an AI key configured, always.
// ─────────────────────────────────────────────────────────────────────────────

function normalize(s) {
  return (s || '').toLowerCase().trim()
}

function isListed(condition, list) {
  const c = normalize(condition)
  return (list || []).some(item => {
    const n = normalize(item)
    return n === c || n.includes(c) || c.includes(n)
  })
}

export function matchPlanSuitability({ plan, patientAge, conditions }) {
  const coveredConditions = plan.covered_conditions || []
  const coveredCategories = plan.covered_categories || []
  const insurerFlags = plan.insurer_flags || []
  const declared = [...new Set((conditions || []).map(c => (c || '').trim()).filter(Boolean))]

  const declinedHits = []   // clear exclusion match -> matching alone declines
  const flaggedHits = []    // not clean, not a clear exclusion -> needs a human
  const insurerFlaggedHits = [] // insurer's own "always review" list -> needs a human

  for (const condition of declared) {
    const covered = isListed(condition, coveredConditions)
    if (!covered) {
      // A clean decline needs the plan to explicitly exclude pre-existing
      // conditions AND the condition to genuinely not be listed as
      // covered - that's the only case matching alone can confidently
      // call "no". Anything else uncovered is ambiguous, not declined.
      if (plan.pre_existing_condition_policy === 'excluded') declinedHits.push(condition)
      else if (coveredCategories.length > 0) flaggedHits.push(condition)
    }
    if (isListed(condition, insurerFlags)) insurerFlaggedHits.push(condition)
  }

  let verdict = 'approved'
  let flagCategory = null
  if (declinedHits.length > 0) {
    verdict = 'declined'
  } else if (flaggedHits.length > 0 || insurerFlaggedHits.length > 0) {
    verdict = 'flagged'
    // The one thing an agent is allowed to see (aq2-04) - a category
    // label, never the raw condition text itself.
    flagCategory = insurerFlaggedHits.length > 0 ? 'insurer-flagged category' : 'declared condition not clearly covered'
  }

  const tiers = plan.insurance_plan_pricing_tiers || []
  const matchedTier = patientAge != null ? tiers.find(t => patientAge >= t.age_min && patientAge <= t.age_max) : null
  const usedTier = matchedTier || tiers[0] || null
  const quotedPremium = usedTier ? usedTier.monthly_premium : null

  // Plain-language explanation, always template text - no AI rewrite.
  // This is what the PATIENT sees (aq2-05: they see the flag first, in
  // plain language). The agent only ever gets flagCategory above, never
  // this level of detail, and never the raw declinedHits/flaggedHits
  // lists themselves.
  const summaryLines = []
  if (verdict === 'declined') {
    summaryLines.push(`${declinedHits.length === 1 ? 'This condition is' : 'These conditions are'} excluded under this plan's pre-existing condition policy: ${declinedHits.join(', ')}.`)
  } else if (verdict === 'flagged') {
    if (flaggedHits.length > 0) summaryLines.push(`${flaggedHits.join(', ')} ${flaggedHits.length === 1 ? "isn't" : "aren't"} explicitly listed as covered by this plan, so it needs a quick human review before a decision is made.`)
    if (insurerFlaggedHits.length > 0) summaryLines.push(`${plan.company_name || 'The insurer'} asks that ${insurerFlaggedHits.join(', ')} always be reviewed before this plan is relied on.`)
  } else {
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
    verdict, // 'approved' | 'declined' | 'flagged'
    flagCategory, // agent-safe label, only set when verdict === 'flagged'
    quotedPremium,
    summary: summaryLines.join(' '), // patient-facing only
    declinedConditions: declinedHits, // patient/underwriter-facing only, never agent
    flaggedConditions: flaggedHits, // patient/underwriter-facing only, never agent
    insurerFlaggedConditions: insurerFlaggedHits, // patient/underwriter-facing only, never agent
  }
}

// Alternative-plan matching (aq2-08) - same engine, run against every
// other active plan to find ones that don't decline/flag the same
// condition. Pure matching, no AI, no agent judgment.
export function findAlternativePlans({ plans, excludeePlanId, patientAge, conditions }) {
  return plans
    .filter(p => p.id !== excludeePlanId)
    .map(p => ({ plan: p, result: matchPlanSuitability({ plan: p, patientAge, conditions }) }))
    .filter(({ result }) => result.verdict === 'approved')
    .map(({ plan, result }) => ({
      planId: plan.id,
      planName: plan.plan_name,
      companyName: plan.company_name,
      sameInsurer: false, // set by the caller, which knows the original plan's company_name
      quotedPremium: result.quotedPremium,
    }))
}
