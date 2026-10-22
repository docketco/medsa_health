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

// The HK government's "iAM Smart" platform (biometric login + e-ME
// auto-fill of verified name/DOB/gender/contact), as the fast-path option
// in AccountFlow (components/patient/PatientApp.jsx). Integration is a
// real OAuth 2.0 + API encryption build (confirmed free, no per-
// verification fee - see iamsmart.cyberport.hk's own FAQ), but it first
// needs the business-level DPO/Cyberport Sandbox registration only the
// account owner can do (not something built here). Flip true once that's
// granted and the real client ID/endpoints are wired into AccountFlow's
// iAM Smart branch - until then it shows a clear "coming soon" message
// and routes everyone through the manual ID-verification path instead.
export const IAM_SMART_ENABLED = false
