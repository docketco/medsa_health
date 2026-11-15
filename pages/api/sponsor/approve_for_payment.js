// pages/api/sponsor/approve_for_payment.js
// ─────────────────────────────────────────────────────────────────────────────
// Redesigned sponsor flow, per your call: Medsa reviews content first (still
// required - this is a health app, a bad ad going live unreviewed is a real
// risk), but once approved, the SPONSOR picks their own duration and start
// date and pays - same self-serve pattern as Sponsored Listings
// (create_sponsor_checkout.js), not an admin-driven one-off Stripe link.
// This only sets the rate and emails the sponsor where to go next -
// /api/sponsor/create_scheduled_checkout.js does the actual charging once
// they've picked a duration/start date there.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/email'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { submissionId, rateHkdPerMonth } = req.body || {}
  if (!submissionId || !rateHkdPerMonth || rateHkdPerMonth <= 0) {
    return res.status(400).json({ status: 'ERROR', message: 'submissionId and a positive rateHkdPerMonth are required.' })
  }

  const { data: sub } = await supabase.from('home_carousel_submissions').select('*').eq('id', submissionId).maybeSingle()
  if (!sub) return res.status(404).json({ status: 'ERROR', message: 'Submission not found.' })

  const { error } = await supabase.from('home_carousel_submissions').update({
    status: 'approved_awaiting_payment', price_hkd: rateHkdPerMonth, reviewed_at: new Date().toISOString(),
  }).eq('id', submissionId)
  if (error) return res.status(500).json({ status: 'ERROR', message: error.message })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'
  const payLink = `${siteUrl}/sponsor-pay?id=${submissionId}`

  let emailResult = { sent: false, reason: 'No sponsor email on file.' }
  if (sub.sponsor_contact_email) {
    emailResult = await sendEmail({
      to: sub.sponsor_contact_email,
      subject: 'Medsa Health - your submission is approved, pick your dates',
      html: `<p>Hi ${sub.sponsor_name || 'there'},</p><p>Your submission "${sub.title}" has been approved at HK$${rateHkdPerMonth}/month. Choose your duration and start date and pay here:</p><p><a href="${payLink}">${payLink}</a></p>`,
    })
  }

  return res.status(200).json({ status: 'OK', payLink, emailSent: emailResult.sent, emailReason: emailResult.reason })
}
