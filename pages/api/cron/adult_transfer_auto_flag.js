// pages/api/cron/adult_transfer_auto_flag.js
// ─────────────────────────────────────────────────────────────────────────────
// Daily. Per your call: flagging a Kids profile that's aged out used to be
// a manual click on medsa-admin's Adult Transfers tab - that's gone now.
// A profile locks automatically at 19 (a full year past 18, matching the
// reminders cron's own real target - adult_transfer_reminders.js), stamping
// pending_deletion_at the same way the old manual "Flag" button did. The
// 30-day grace window that used to follow a manual flag is gone too (your
// call: it was redundant on top of a whole extra year of advance warning) -
// PatientApp.jsx's own isReadOnly check now goes read-only the moment
// pending_deletion_at is set, no further wait.
//
// medsa-admin's "Flag" button stays, as an early-override for a parent who
// explicitly wants it locked before 19 - this cron just makes the default
// path automatic instead of relying on someone remembering to click it.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const nineteenYearsAgo = new Date(); nineteenYearsAgo.setFullYear(nineteenYearsAgo.getFullYear() - 19)
  const { data: candidates } = await supabase.from('patients')
    .select('id, full_name')
    .eq('account_type', 'kids').or('dependent_relationship.is.null,dependent_relationship.eq.child')
    .is('adult_transfer_choice', null).is('pending_deletion_at', null)
    .lte('date_of_birth', nineteenYearsAgo.toISOString().slice(0,10))
  if (!candidates) return res.status(200).json({ status: 'OK', flagged: 0 })

  const now = new Date().toISOString()
  for (const c of candidates) {
    await supabase.from('patients').update({ pending_deletion_at: now }).eq('id', c.id)
  }

  return res.status(200).json({ status: 'OK', flagged: candidates.length })
}
