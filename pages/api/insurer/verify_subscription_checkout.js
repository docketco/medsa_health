// pages/api/insurer/verify_subscription_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Same bug class as verify_sponsor_checkout.js, found live-testing this
// flow specifically: start_subscription.js (insurer self-serve card) and
// start_insurer_subscription.js (admin-generated link) both only ever set
// stripe_subscription_id from the webhook - which is confirmed not firing
// (see verify_sponsor_checkout.js's own comment). Worse here: refresh_
// subscription_status.js's own useEffect guard (`if (!stripe_subscription_id)
// return`) never even runs, because that id was never set in the first
// place - a real payment completes, redirects back, and the account still
// shows "Not started" with a "pay again" prompt. This checks the real
// Stripe session directly and writes stripe_subscription_id/status/period
// end itself, so activation never depends on the webhook.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { retrievePaidSession } from '../../../lib/verifyStripeCheckout'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { sessionId } = req.body || {}
  const result = await retrievePaidSession(sessionId, { expand: ['subscription'] })
  if (result.status !== 'PAID') return res.status(result.status === 'ERROR' ? 400 : 200).json(result)
  const { session } = result

  const companyId = session.metadata?.company_id
  if (!companyId) return res.status(200).json({ status: 'ERROR', message: 'This session has no company on file - contact Medsa.' })

  const sub = session.subscription
  if (!sub || typeof sub === 'string') {
    return res.status(200).json({ status: 'ERROR', message: 'Could not read the subscription back from Stripe - contact Medsa.' })
  }

  const subscriptionStatus = sub.status === 'active' || sub.status === 'trialing' ? 'active'
    : sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due' : 'canceled'
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null

  await supabase.from('insurance_companies').update({
    stripe_subscription_id: sub.id,
    subscription_status: subscriptionStatus,
    subscription_current_period_end: periodEnd,
  }).eq('id', companyId)

  return res.status(200).json({ status: 'OK', subscriptionStatus })
}
