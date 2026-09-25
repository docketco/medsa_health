// pages/api/admin/refresh_subscription_status.js
// ─────────────────────────────────────────────────────────────────────────────
// Pulls the real subscription status/period-end straight from Stripe and
// syncs it onto insurance_companies - same reasoning as
// refresh_connect_status.js for Connect accounts. Doesn't rely on the
// customer.subscription.updated webhook alone, so a status check here isn't
// blocked on the webhook destination being configured correctly.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { companyId } = req.body || {}
  if (!companyId) return res.status(400).json({ status: 'ERROR', message: 'companyId is required.' })

  const { data: company } = await supabase.from('insurance_companies')
    .select('id, stripe_subscription_id, subscription_status').eq('id', companyId).maybeSingle()
  if (!company) return res.status(404).json({ status: 'ERROR', message: 'Company not found.' })
  if (!company.stripe_subscription_id) return res.status(200).json({ status: 'OK', subscriptionStatus: company.subscription_status || null })
  if (!process.env.STRIPE_SECRET_KEY) return res.status(200).json({ status: 'OK', subscriptionStatus: company.subscription_status })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const sub = await stripe.subscriptions.retrieve(company.stripe_subscription_id)
  const subscriptionStatus = sub.status === 'active' || sub.status === 'trialing' ? 'active'
    : sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due' : 'canceled'
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
  await supabase.from('insurance_companies').update({ subscription_status: subscriptionStatus, subscription_current_period_end: periodEnd }).eq('id', companyId)

  return res.status(200).json({ status: 'OK', subscriptionStatus, periodEnd })
}
