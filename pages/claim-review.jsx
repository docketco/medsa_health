// ─────────────────────────────────────────────────────────────────────────────
// pages/claim-review.jsx  →  visits medsa.health/claim-review?token=xxx
//
// The AGENT CLAIM REVIEW page.
// This is NOT a portal — it's a single-purpose page that insurance agents
// open when a patient submits a claim. Medsa sends the agent a link
// (via email, SMS, or WhatsApp) that leads here.
//
// The agent reviews the claim details, approves or rejects with a reason,
// and submits. No login required — the link is secured by a one-time token
// in the URL (in production, e.g. ?token=abc123xyz).
//
// Once submitted:
//   → Patient gets notified in their Medsa app
//   → Decision is logged in the insurance admin portal
// ─────────────────────────────────────────────────────────────────────────────

import AgentClaimView from '../components/insurance/AgentClaimView'

export default function ClaimReviewPage() {
  return (
    <div style={{ maxWidth: '440px', margin: '0 auto', minHeight: '100vh', background: '#f0ede8' }}>
      <AgentClaimView />
    </div>
  )
}
