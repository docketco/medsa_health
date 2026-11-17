// pages/api/cron/adult_transfer_reminders.js
// ─────────────────────────────────────────────────────────────────────────────
// Daily. Same tightest-bucket-wins pattern as guardian_expiry_reminders.js,
// just keyed off days until a Kids dependent's 19th birthday instead of a
// subscription's renewal date - UPDATED per your call: the real lock point
// moved from 18 to 19 (a full year past 18, locking at 19 - the extra year
// is deliberate breathing room before the account actually goes read-only,
// on top of the already-building reminder countdown below). Contact at 16
// (now ~3 years out, 1095 days), then every 6 months (913/730/548 days out,
// recomputed relative to 19 instead of 18), then the final countdown at
// 30/7/3 days - so the last warning lands right before the real
// adult_transfer_auto_flag.js lock, not a year early like it used to.
// adult_transfer_last_reminder_threshold tracks the tightest bucket already
// sent so a missed day still catches up without re-sending one twice, and
// the query itself (adult_transfer_choice is null) is what makes reminders
// stop the moment a parent actually picks an option - no separate reset
// logic needed, unlike the Guardian job's renewal case.
//
// Email is real (lib/email.js, Resend). SMS is a stub (lib/sms.js) until
// a provider is wired up - sendSms() always reports {sent:false}, which
// this job treats as "attempted, not delivered" rather than an error, so
// nothing here breaks once a real provider IS wired in; it starts
// delivering on the same call site, unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/email'
import { sendSms } from '../../../lib/sms'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const THRESHOLDS = [1095, 913, 730, 548, 365, 183, 30, 7, 3] // days before 19th birthday, tightest last

function daysBetween(fromISODate, toISODate) {
  return Math.ceil((new Date(toISODate) - new Date(fromISODate)) / (1000*60*60*24))
}

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const today = new Date().toISOString().slice(0,10)
  const { data: patients } = await supabase.from('patients')
    .select('id, full_name, email, phone, notify_email, date_of_birth, parent_patient_id, adult_transfer_choice, adult_transfer_last_reminder_threshold')
    .eq('account_type','kids').or('dependent_relationship.is.null,dependent_relationship.eq.child')
    .is('adult_transfer_choice', null)
    .not('date_of_birth', 'is', null)
  if (!patients) return res.status(200).json({ status: 'OK', checked: 0 })

  let remindersSent = 0
  for (const p of patients) {
    const nineteenth = new Date(p.date_of_birth)
    nineteenth.setFullYear(nineteenth.getFullYear() + 19)
    const nineteenthStr = nineteenth.toISOString().slice(0,10)
    const daysUntil = daysBetween(today, nineteenthStr)
    if (daysUntil > THRESHOLDS[0] || daysUntil < 0) continue // not in the reminder window yet, or already past 19 (adult_transfer_auto_flag.js takes over from there)

    const dueBucket = THRESHOLDS.find(t => daysUntil <= t)
    if (!dueBucket) continue
    const lastThreshold = p.adult_transfer_last_reminder_threshold
    if (lastThreshold != null && lastThreshold <= dueBucket) continue // already sent this bucket or a tighter one

    // Whoever manages this profile - the parent (if this is still a
    // dependent) - is who actually needs to see this, not the kid
    // themselves (no separate login for a Kids profile to read it on).
    let contact = { email: p.email, phone: p.phone, name: p.full_name }
    if (p.parent_patient_id) {
      const { data: parentRow } = await supabase.from('patients').select('email, phone, full_name').eq('id', p.parent_patient_id).maybeSingle()
      if (parentRow) contact = { email: parentRow.email, phone: parentRow.phone, name: parentRow.full_name }
    }

    const label = dueBucket >= 30 ? `${Math.round(dueBucket/30.44)} month${dueBucket>=61?'s':''}` : `${dueBucket} day${dueBucket>1?'s':''}`
    const body = `${p.full_name} turns 19 in about ${label} (on ${nineteenthStr}) - the point their Medsa Kids profile locks to permanent read-only if nothing's been chosen. Before then, open Medsa and either transfer their profile to their own adult account, convert it to a Guardian dependent, or export a keepsake record. Nothing happens automatically - this is just a heads-up.`

    if (contact.email && p.notify_email !== false) {
      await sendEmail({ to: contact.email, subject: `${p.full_name}'s Medsa Kids profile turns 19 in ${label}`, html: `<p>Hi ${contact.name||''},</p><p>${body}</p>` })
    }
    if (contact.phone) {
      await sendSms({ to: contact.phone, body })
    }
    await supabase.from('patients').update({ adult_transfer_last_reminder_threshold: dueBucket }).eq('id', p.id)
    remindersSent++
  }

  return res.status(200).json({ status: 'OK', checked: patients.length, remindersSent })
}
