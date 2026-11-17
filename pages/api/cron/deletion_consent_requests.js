// pages/api/cron/deletion_consent_requests.js
// ─────────────────────────────────────────────────────────────────────────────
// Daily. Per your call: once a Kids profile has been permanently read-only
// (pending_deletion_at set by adult_transfer_auto_flag.js, or the manual
// "Flag" override) for 6 more years - age 25, the low end of Hong Kong's
// general 7-10 year clinical-record retention guidance, applied from
// adulthood rather than from last visit since a minor's own record needs
// longer protection than that baseline - this asks the main account holder
// (the parent/guardian whose account the profile sits under) whether they
// want it permanently deleted. Deletion itself never happens here or on any
// other unattended schedule - only an explicit "Yes, delete permanently"
// click from the parent, in-app (AdultTransferBanner), does that. A "Not
// now" or no response at all means the same thing: leave it exactly as it
// is, and ask again in about a year - deletion_consent_asked_at tracks the
// last ask either way, which is what naturally spaces this to once a year
// without a separate decision column.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/email'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const SIX_YEARS_MS = 6 * 365.25 * 86400000
const ONE_YEAR_MS = 365 * 86400000

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data: candidates } = await supabase.from('patients')
    .select('id, full_name, parent_patient_id, pending_deletion_at, deletion_consent_asked_at')
    .eq('account_type', 'kids').or('dependent_relationship.is.null,dependent_relationship.eq.child')
    .is('adult_transfer_choice', null).not('pending_deletion_at', 'is', null)
  if (!candidates) return res.status(200).json({ status: 'OK', asked: 0 })

  const now = Date.now()
  let asked = 0
  for (const p of candidates) {
    if (now - new Date(p.pending_deletion_at).getTime() < SIX_YEARS_MS) continue
    if (p.deletion_consent_asked_at && now - new Date(p.deletion_consent_asked_at).getTime() < ONE_YEAR_MS) continue
    if (!p.parent_patient_id) continue // nobody to ask - leave it, same as a "not now"

    const { data: parentRow } = await supabase.from('patients').select('email, full_name').eq('id', p.parent_patient_id).maybeSingle()
    if (parentRow?.email) {
      await sendEmail({
        to: parentRow.email,
        subject: `A decision on ${p.full_name}'s old Medsa Kids profile`,
        html: `<p>Hi ${parentRow.full_name||''},</p><p>${p.full_name}'s Medsa Kids profile has been read-only for several years with no transfer, conversion, or export ever chosen. Open Medsa to decide whether to permanently delete it - nothing happens unless you confirm. If you do nothing, it stays exactly as it is and we'll ask again next year.</p>`,
      })
    }
    await supabase.from('patients').update({ deletion_consent_asked_at: new Date(now).toISOString() }).eq('id', p.id)
    asked++
  }

  return res.status(200).json({ status: 'OK', checked: candidates.length, asked })
}
