// pages/api/sponsor/approve_for_payment.js
// ─────────────────────────────────────────────────────────────────────────────
// Redesigned sponsor flow, per your call: Medsa reviews content first (still
// required - this is a health app, a bad ad going live unreviewed is a real
// risk). The duration/price menu itself (e.g. "2 weeks - HK$500", "1 month -
// HK$900") is now set ONCE, globally, in carousel_ad_pricing_options - not
// re-typed per submission (your call: "price menu should be one for all not
// quote by quote"). Approving just snapshots whatever that menu currently
// holds onto this submission's own pricing_options, so a later change to
// the global menu never retroactively changes what an already-approved
// sponsor was quoted. The sponsor only ever picks one of those options plus
// a start date on /sponsor-pay - never an open rate, never a typed-in
// duration. This only sets the menu and emails the sponsor where to go next
// - /api/sponsor/create_scheduled_checkout.js does the actual charging once
// they've picked an option + start date there.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/email'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { submissionId } = req.body || {}
  if (!submissionId) return res.status(400).json({ status: 'ERROR', message: 'submissionId is required.' })

  const { data: menu } = await supabase.from('carousel_ad_pricing_options').select('label, days, price_hkd').order('sort_order').order('created_at')
  if (!menu || menu.length === 0) {
    return res.status(400).json({ status: 'ERROR', message: "There's no ad pricing menu set up yet - add at least one duration/price option above the pending submissions list first." })
  }
  const cleanOptions = menu.map(o => ({ label: o.label, days: o.days, priceHkd: Number(o.price_hkd) }))

  const { data: sub } = await supabase.from('home_carousel_submissions').select('*').eq('id', submissionId).maybeSingle()
  if (!sub) return res.status(404).json({ status: 'ERROR', message: 'Submission not found.' })

  const { error } = await supabase.from('home_carousel_submissions').update({
    status: 'approved_awaiting_payment', pricing_options: cleanOptions, reviewed_at: new Date().toISOString(),
  }).eq('id', submissionId)
  if (error) return res.status(500).json({ status: 'ERROR', message: error.message })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'
  const payLink = `${siteUrl}/sponsor-pay?id=${submissionId}`
  const optionsList = cleanOptions.map(o => `${o.label} - HK$${o.priceHkd}`).join(', ')

  let emailResult = { sent: false, reason: 'No sponsor email on file.' }
  if (sub.sponsor_contact_email) {
    emailResult = await sendEmail({
      to: sub.sponsor_contact_email,
      subject: 'Medsa Health - your submission is approved, pick your dates',
      html: `<p>Hi ${sub.sponsor_name || 'there'},</p><p>Your submission "${sub.title}" has been approved. Pick one of these and a start date, and pay here:</p><p>${optionsList}</p><p><a href="${payLink}">${payLink}</a></p>`,
    })
  }

  return res.status(200).json({ status: 'OK', payLink, emailSent: emailResult.sent, emailReason: emailResult.reason })
}
