// pages/api/test/mock_claims_webhook.js
// ─────────────────────────────────────────────────────────────────────────────
// A stand-in for a real insurer's own claims-intake endpoint, so the claims
// plug-in (insurance_companies.claims_plugin_enabled + claims_webhook_url -
// see /api/insurer/push_claim) can be tested end to end without a real
// insurer having built one, same reasoning as mock_insurer_endpoint.js for
// eligibility lookups. Accepts whatever push_claim.js sends and just
// confirms receipt - a real insurer's endpoint would actually file the claim
// into their own system, which isn't something Medsa can simulate on their
// behalf.
//
// To test: in medsa-admin, enable the claims plug-in for a test insurer
// (e.g. Test Insurer Co), then set its webhook URL (insurer portal or
// set_claims_plugin_config) to this route's full URL. Any claim pushed to a
// PENDING_REVIEW outcome for that insurer will show up in this route's logs
// (check Vercel function logs, or query-string-less - nothing is persisted
// here on purpose, this is a receipt-confirmation stub, not a real inbox).
// ─────────────────────────────────────────────────────────────────────────────

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  console.log('[mock_claims_webhook] received claim push:', JSON.stringify(req.body))
  return res.status(200).json({ ok: true, received: true })
}
