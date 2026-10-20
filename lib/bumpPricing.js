// lib/bumpPricing.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared between create_bump_checkout.js (which charges this price) and
// verify_bump_checkout.js (which grants the loyalty credit on success) -
// one place for both sides to agree on the numbers instead of the
// percentage drifting if one file changes and the other doesn't.
// ─────────────────────────────────────────────────────────────────────────────
export const BUMP_PRICE_HKD = 888
export const BUMP_LOYALTY_CREDIT_PCT = 0.20
export const BUMP_LOYALTY_CREDIT_HKD = Math.round(BUMP_PRICE_HKD * BUMP_LOYALTY_CREDIT_PCT * 100) / 100
