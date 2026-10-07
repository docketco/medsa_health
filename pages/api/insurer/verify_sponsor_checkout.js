// pages/api/insurer/verify_sponsor_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Real bug found live-testing: sponsorship activation only ever happened in
// the webhook's checkout.session.completed handler - confirmed via Vercel
// runtime logs that /api/webhooks/stripe had zero hits despite real checkout
// sessions being created, so a successful payment never got applied, and
// there was no confirmation/error UI on return either way regardless of
// webhook status. This checks the actual Stripe session directly (same as
// subscription/Connect's own refresh_*_status.js pattern) and applies the
// sponsorship itself if payment succeeded and it hasn't been applied yet -
// works whether or not the webhook is configured correctly.
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

  const planId = session.metadata?.plan_id
  if (!planId) return res.status(200).json({ status: 'ERROR', message: 'This session has no plan on file - contact Medsa.' })

  const { data: plan } = await supabase.from('insurance_plans').select('id, sponsored_until').eq('id', planId).maybeSingle()
  if (!plan) return res.status(404).json({ status: 'ERROR', message: 'Plan not found.' })

  // Idempotent: the webhook may also apply this (if it's ever fixed to
  // actually fire) - re-verifying an already-applied session just confirms
  // the existing state back rather than double-extending it.
  const today = new Date().toISOString().slice(0,10)
  const alreadyApplied = plan.sponsored_until && plan.sponsored_until >= today
  if (!alreadyApplied) {
    const months = parseInt(session.metadata?.months) || 1
    const until = new Date()
    until.setMonth(until.getMonth() + months)
    await supabase.from('insurance_plans').update({
      sponsored: true, sponsored_until: until.toISOString().slice(0,10),
      sponsor_price_hkd: (session.amount_total || 0) / 100,
    }).eq('id', planId)
  }

  return res.status(200).json({ status: 'OK' })
}
