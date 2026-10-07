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
