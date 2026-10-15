// lib/verifyStripeCheckout.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared by every "verify a Stripe payment on return" route (sponsorship,
// platform subscription, video consult, automated insurance purchase) -
// each needed the exact same fallback for the same reason: the webhook is
// confirmed unreliable in this environment, so the page a patient/insurer
// lands back on has to double-check with Stripe directly instead of
// trusting a webhook that may never fire. That retrieve-and-check half was
// copy-pasted four times; this is the one place it lives now. What happens
// once a session is confirmed paid is still each route's own job - that
// part genuinely differs per purchase type (idempotency check included).
// ─────────────────────────────────────────────────────────────────────────────

import Stripe from 'stripe'

export async function retrievePaidSession(sessionId, { expand } = {}) {
  if (!process.env.STRIPE_SECRET_KEY) return { status: 'NOT_CONFIGURED' }
  if (!sessionId) return { status: 'ERROR', message: 'sessionId is required.' }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const session = await stripe.checkout.sessions.retrieve(sessionId, expand ? { expand } : undefined)
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return { status: 'NOT_PAID', paymentStatus: session.payment_status }
  }
  return { status: 'PAID', session }
}

// Real bug found live-testing: this installed Stripe SDK (v22, API version
// 2025-03-31.basil and later) moved current_period_end/current_period_start
// off the Subscription object entirely, onto each subscription item
// instead - `sub.current_period_end` is silently `undefined` now, not an
// error, so every caller reading it directly was writing a correct
// `active: true` alongside a wrong `expires_at: null`. Same fix needed
// anywhere a Subscription object's period end is read this way (also
// pages/api/admin/refresh_subscription_status.js and
// pages/api/webhooks/stripe.js, for the insurer platform subscription -
// same latent bug, not yet fixed there).
export function subscriptionPeriodEnd(sub) {
  const ts = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end
  return ts ? new Date(ts * 1000).toISOString().slice(0,10) : null
}
