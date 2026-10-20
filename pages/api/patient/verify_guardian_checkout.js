// pages/api/patient/verify_guardian_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Same pattern as insurer/verify_subscription_checkout.js - checks the real
// Stripe session/subscription directly on return rather than trusting the
// webhook, which is confirmed unreliable elsewhere in this app. This only
// fires for a NEW Checkout Session (first signup, or re-subscribing after a
// full lapse) - an automatic annual renewal never creates a new session, so
// cron/guardian_expiry_reminders.js is what keeps expires_at current after
// that, pulling the live subscription straight from Stripe daily.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { retrievePaidSession, subscriptionPeriodEnd } from '../../../lib/verifyStripeCheckout'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { sessionId } = req.body || {}
  const result = await retrievePaidSession(sessionId, { expand: ['subscription'] })
  if (result.status !== 'PAID') return res.status(result.status === 'ERROR' ? 400 : 200).json(result)
  const { session } = result

  const patientId = session.metadata?.guardian_patient_id
  if (!patientId) return res.status(200).json({ status: 'ERROR', message: 'This session has no patient on file - contact Medsa.' })

  const sub = session.subscription
  if (!sub || typeof sub === 'string') {
    return res.status(200).json({ status: 'ERROR', message: 'Could not read the subscription back from Stripe - contact Medsa.' })
  }

  const isActive = sub.status === 'active' || sub.status === 'trialing'
  const periodEnd = subscriptionPeriodEnd(sub)
  const creditApplied = Number(session.metadata?.guardian_loyalty_credit_applied_hkd || 0)

  const update = {
    guardian_stripe_subscription_id: sub.id,
    guardian_subscription_active: isActive,
    guardian_subscription_expires_at: periodEnd,
    guardian_last_reminder_days_threshold: null, // clean slate - a fresh/renewed period hasn't earned any reminder yet
  }
  // This whole handler is otherwise safe to call twice for the same
  // session (it just re-writes the same subscription state) - but
  // blindly deducting the credit again on a second call would double-
  // spend it. Guard specifically on that: only deduct if this sub.id
  // isn't already the one on file, i.e. this patient hasn't already
  // been recorded as having this exact subscription verified before.
  const { data: p } = await supabase.from('patients').select('bump_loyalty_credit_hkd, guardian_stripe_subscription_id').eq('id', patientId).maybeSingle()
  if (creditApplied > 0 && p?.guardian_stripe_subscription_id !== sub.id) {
    update.bump_loyalty_credit_hkd = Math.max(0, (p?.bump_loyalty_credit_hkd||0) - creditApplied)
  }
  await supabase.from('patients').update(update).eq('id', patientId)

  return res.status(200).json({ status: 'OK', isActive })
}
