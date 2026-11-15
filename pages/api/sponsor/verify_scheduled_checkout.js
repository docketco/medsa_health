// pages/api/sponsor/verify_scheduled_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Same reason as verify_sponsor_checkout.js (the insurer-side equivalent):
// the webhook is confirmed unreliable in this environment, so the sponsor's
// own return trip double-checks with Stripe directly instead of trusting a
// webhook that may never fire. Idempotent - if the webhook got there first,
// this just confirms the existing state back rather than double-posting.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { retrievePaidSession } from '../../../lib/verifyStripeCheckout'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { sessionId } = req.body || {}
  const result = await retrievePaidSession(sessionId)
  if (result.status !== 'PAID') return res.status(result.status === 'ERROR' ? 400 : 200).json(result)
  const { session } = result

  const submissionId = session.metadata?.submission_id
  if (!submissionId) return res.status(200).json({ status: 'ERROR', message: 'This session has no submission on file - contact Medsa.' })

  const { data: sub } = await supabase.from('home_carousel_submissions').select('*').eq('id', submissionId).maybeSingle()
  if (!sub) return res.status(404).json({ status: 'ERROR', message: 'Submission not found.' })

  if (sub.payment_status !== 'paid') {
    const startsAt = session.metadata?.starts_at
    const endsAt = session.metadata?.ends_at
    const { data: items } = await supabase.from('home_carousel_items').select('display_order').order('display_order', {ascending:false}).limit(1)
    const maxOrder = items?.[0]?.display_order || 0
    await supabase.from('home_carousel_items').insert({
      item_type: sub.item_type, title: sub.title, subtitle: sub.subtitle,
      image_url: sub.image_url, sponsor_name: sub.sponsor_name,
      link_url: sub.link_url, cta_label: sub.cta_label, content_blocks: sub.content_blocks,
      display_order: maxOrder+1, active: true,
      starts_at: startsAt ? new Date(`${startsAt}T00:00:00`).toISOString() : null,
      ends_at: endsAt ? new Date(`${endsAt}T23:59:59`).toISOString() : null,
    })
    await supabase.from('home_carousel_submissions').update({
      status: 'approved', payment_status: 'paid', paid_at: new Date().toISOString(),
    }).eq('id', submissionId)
  }

  return res.status(200).json({ status: 'OK' })
}
