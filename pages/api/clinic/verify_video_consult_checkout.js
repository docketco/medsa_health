// pages/api/clinic/verify_video_consult_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Same bug class as verify_sponsor_checkout.js and verify_subscription_
// checkout.js, found live-testing this specific flow: activation only ever
// happened in the webhook's checkout.session.completed handler, which is
// confirmed not firing (see verify_sponsor_checkout.js's own comment) - a
// clinic paid for video consultations and it never actually enabled.
// Checks the real Stripe session directly and applies the same update the
// webhook was supposed to make.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.STRIPE_SECRET_KEY) return res.status(200).json({ status: 'NOT_CONFIGURED' })
  const { sessionId } = req.body || {}
  if (!sessionId) return res.status(400).json({ status: 'ERROR', message: 'sessionId is required.' })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.payment_status !== 'paid') {
    return res.status(200).json({ status: 'NOT_PAID', paymentStatus: session.payment_status })
  }

  const institutionId = session.metadata?.video_consult_institution_id
  if (!institutionId) return res.status(200).json({ status: 'ERROR', message: 'This session has no clinic on file - contact Medsa.' })

  const { data: institution } = await supabase.from('institutions').select('id, video_consult_expires_at').eq('id', institutionId).maybeSingle()
  if (!institution) return res.status(404).json({ status: 'ERROR', message: 'Clinic not found.' })

  const today = new Date().toISOString().slice(0,10)
  const alreadyApplied = institution.video_consult_expires_at && institution.video_consult_expires_at >= today
  if (!alreadyApplied) {
    const until = new Date()
    until.setFullYear(until.getFullYear() + 1)
    await supabase.from('institutions').update({
      video_consult_enabled: true,
      video_consult_expires_at: until.toISOString().slice(0,10),
      video_consult_price_hkd: (session.amount_total || 0) / 100,
    }).eq('id', institutionId)
  }

  return res.status(200).json({ status: 'OK' })
}
