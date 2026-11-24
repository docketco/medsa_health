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
  // Real gap found live-testing: nothing tracked how many profiles THIS
  // checkout actually paid for, so adding/converting a 5th+ dependent
  // afterward never hit any gate at all - the price was only ever right
  // at the moment of a NEW checkout, never enforced against what's
  // already been paid for. extra_heads is set at checkout time (see
  // create_guardian_checkout.js) from the real dependent count then -
  // GUARDIAN_PACKAGE_SIZE (4) + that many is what this subscription
  // actually covers, checked by guardianCanAddDependent below.
  const extraHeads = parseInt(session.metadata?.extra_heads || sub.metadata?.extra_heads || '0', 10) || 0
  const paidProfileCount = 4 + extraHeads

  await supabase.from('patients').update({
    guardian_stripe_subscription_id: sub.id,
    guardian_subscription_active: isActive,
    guardian_subscription_expires_at: periodEnd,
    guardian_last_reminder_days_threshold: null, // clean slate - a fresh/renewed period hasn't earned any reminder yet
    guardian_paid_profile_count: isActive ? paidProfileCount : null,
  }).eq('id', patientId)

  return res.status(200).json({ status: 'OK', isActive })
}
