// pages/api/cron/guardian_expiry_reminders.js
// ─────────────────────────────────────────────────────────────────────────────
// Daily. Two jobs in one pass, because they need the same up-to-date number:
//
// 1. Refresh guardian_subscription_expires_at/active straight from Stripe,
//    same "pull don't wait for a webhook" pattern as refresh_subscription_
//    status.js - an annual subscription renews automatically with no new
//    Checkout Session, so nothing else in this app would ever move that
//    date forward otherwise, and the reminders below would eventually fire
//    on a stale date even after the patient paid.
// 2. Email at 90/60/30/7/3 days out. guardian_last_reminder_days_threshold
//    tracks the tightest bucket already sent so a missed day still catches
//    up to the right bucket without re-sending one twice, and resets to
//    null the moment the refreshed expiry moves back out past 90 days
//    (a real renewal) - which is what actually makes reminders stop once
//    paid, not a special case bolted on separately.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { sendEmail } from '../../../lib/email'
import { subscriptionPeriodEnd } from '../../../lib/verifyStripeCheckout'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const THRESHOLDS = [90, 60, 30, 7, 3] // days out, tightest last

function daysBetween(fromISODate, toISODate) {
  return Math.ceil((new Date(toISODate) - new Date(fromISODate)) / (1000*60*60*24))
}

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (!process.env.STRIPE_SECRET_KEY) return res.status(200).json({ status: 'OK', note: 'Stripe not configured, nothing to refresh.' })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const today = new Date().toISOString().slice(0,10)

  const { data: patients } = await supabase.from('patients')
    .select('id, full_name, email, notify_email, guardian_stripe_subscription_id, guardian_subscription_expires_at, guardian_last_reminder_days_threshold')
    .not('guardian_stripe_subscription_id', 'is', null)
  if (!patients) return res.status(200).json({ status: 'OK', checked: 0 })

  let remindersSent = 0
  for (const p of patients) {
    let expiresAt = p.guardian_subscription_expires_at
    let isActive = true
    try {
      const sub = await stripe.subscriptions.retrieve(p.guardian_stripe_subscription_id)
      isActive = sub.status === 'active' || sub.status === 'trialing'
      expiresAt = subscriptionPeriodEnd(sub) || expiresAt
    } catch {
      continue // can't reach Stripe for this one - leave its stored state alone, try again tomorrow
    }

    const daysUntil = expiresAt ? daysBetween(today, expiresAt) : null
    let lastThreshold = p.guardian_last_reminder_days_threshold

    await supabase.from('patients').update({ guardian_subscription_active: isActive, guardian_subscription_expires_at: expiresAt }).eq('id', p.id)

    if (!isActive || daysUntil == null) continue

    // Renewed past the furthest reminder window - clean slate for next cycle.
    if (daysUntil > THRESHOLDS[0] && lastThreshold != null) {
      await supabase.from('patients').update({ guardian_last_reminder_days_threshold: null }).eq('id', p.id)
      continue
    }

    const dueBucket = THRESHOLDS.find(t => daysUntil <= t)
    if (!dueBucket) continue
    if (lastThreshold != null && lastThreshold <= dueBucket) continue // already sent this bucket or a tighter one

    if (p.email && p.notify_email !== false) {
      const label = dueBucket >= 30 ? `${dueBucket/30} month${dueBucket>30?'s':''}` : `${dueBucket} day${dueBucket>1?'s':''}`
      await sendEmail({
        to: p.email,
        subject: `Medsa Guardian renews in ${label}`,
        html: `<p>Hi ${p.full_name || ''},</p><p>Your Medsa Guardian subscription renews in about ${label} (on ${expiresAt}). If it lapses, you'll lose the ability to manage more than one linked profile under this login until you resubscribe - the profiles themselves stay safe, just locked.</p><p>No action needed if your card on file is current.</p>`,
      })
    }
    await supabase.from('patients').update({ guardian_last_reminder_days_threshold: dueBucket }).eq('id', p.id)
    remindersSent++
  }

  return res.status(200).json({ status: 'OK', checked: patients.length, remindersSent })
}
