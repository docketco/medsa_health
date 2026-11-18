// pages/api/sponsor/approve_for_payment.js
// ─────────────────────────────────────────────────────────────────────────────
// Redesigned sponsor flow, per your call: Medsa reviews content first (still
// required - this is a health app, a bad ad going live unreviewed is a real
// risk), then sets the real menu of duration/price options here (e.g. "2
// weeks - HK$500", "1 month - HK$900") - never an open rate the sponsor
// multiplies themselves. The sponsor only ever picks one of THESE options
// plus a start date on /sponsor-pay - never a monthly rate, never an
// arbitrary duration. This only sets the menu and emails the sponsor where
// to go next - /api/sponsor/create_scheduled_checkout.js does the actual
// charging once they've picked an option + start date there.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/email'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { submissionId, pricingOptions } = req.body || {}
  if (!submissionId || !Array.isArray(pricingOptions) || pricingOptions.length === 0) {
    return res.status(400).json({ status: 'ERROR', message: 'submissionId and at least one pricing option are required.' })
  }
  for (const opt of pricingOptions) {
    if (!opt.label?.trim() || !(opt.days > 0) || !(opt.priceHkd > 0)) {
      return res.status(400).json({ status: 'ERROR', message: 'Every option needs a label, a positive number of days, and a positive price.' })
    }
  }

  const { data: sub } = await supabase.from('home_carousel_submissions').select('*').eq('id', submissionId).maybeSingle()
  if (!sub) return res.status(404).json({ status: 'ERROR', message: 'Submission not found.' })

  const cleanOptions = pricingOptions.map(o => ({ label: o.label.trim(), days: Math.round(o.days), priceHkd: Math.round(o.priceHkd * 100) / 100 }))
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
