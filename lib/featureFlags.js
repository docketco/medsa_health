// lib/featureFlags.js
// Small on/off switches for features that are fully built but not currently
// active - flip the value here to turn one back on, no need to hunt down
// every place it's wired in.

// Medsa's own cut of an agent's commission when they convert a lead into a
// sold policy (i.e. Medsa acting as an insurance intermediary/broker of
// that sale) - turned off for now since this is IA-regulated activity and
// a real license hasn't been pursued yet. The platform subscription fee
// (insurance_companies.subscription_fee_hkd_monthly) is unaffected - that's
// a separate, non-regulated platform fee. An insurer's own commission rate
// offered to agents (insurance_plans commission field) is also unaffected -
// that's between the insurer and the agent, not a fee Medsa takes.
export const REFERRAL_FEE_ENABLED = false
