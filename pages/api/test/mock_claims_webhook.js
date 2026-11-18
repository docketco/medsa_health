// pages/api/test/mock_claims_webhook.js
// ─────────────────────────────────────────────────────────────────────────────
// A stand-in for a real insurer's own intake endpoint. insurance_companies'
// claims_plugin_enabled + claims_webhook_url is shared by TWO senders, not
// just claims: /api/insurer/push_claim (a claim decision) AND
// lib/pushPolicyToInsurer.js (every policy lifecycle event - new_policy,
// underwriter_decision, payment_confirmed - fired automatically, never
// behind a button, for any insurer that's "partnered" i.e. has this
// configured). Same reasoning as mock_insurer_endpoint.js for eligibility
// lookups - accepts whatever either sender posts and just confirms receipt;
// a real insurer's endpoint would actually file it into their own system,
// which isn't something Medsa can simulate on their behalf.
//
// To test: in medsa-admin, enable the claims plug-in for a test insurer
// (e.g. Test Insurer Co) and set its webhook URL to this route's full URL
// (already done for Test Insurer Co). Any claim pushed to a PENDING_REVIEW
// outcome, or any policy lifecycle event, for that insurer will show up in
// this route's logs (Vercel function logs) - nothing is persisted here on
// purpose, this is a receipt-confirmation stub, not a real inbox. The
// policy side's own real success signal is agent_policies.pushed_to_insurer_at,
// which only ever flips once this endpoint (or a real one) actually
// answers 200 - see AgentApp.jsx's "✓ Pushed to insurer" line.
// ─────────────────────────────────────────────────────────────────────────────

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  console.log('[mock_claims_webhook] received claim push:', JSON.stringify(req.body))
  return res.status(200).json({ ok: true, received: true })
}
