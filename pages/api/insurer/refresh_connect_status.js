// pages/api/insurer/refresh_connect_status.js
// ─────────────────────────────────────────────────────────────────────────────
// Pulls the connected account's real status straight from Stripe and syncs
// it onto insurance_companies. Called when the insurer portal's Payments
// tab loads and right after they return from onboarding - doesn't rely on
// the account.updated webhook alone (useful in local/dev environments
// where no webhook is configured yet, and gives the insurer an immediate
// answer instead of waiting on a webhook round-trip).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { companyId } = req.body || {}
  if (!companyId) return res.status(400).json({ status: 'ERROR', message: 'companyId is required.' })

  const { data: company } = await supabase.from('insurance_companies')
    .select('id, stripe_connect_account_id, stripe_connect_status, self_serve_checkout_enabled').eq('id', companyId).maybeSingle()
  if (!company) return res.status(404).json({ status: 'ERROR', message: 'Company not found.' })
  if (!company.stripe_connect_account_id) return res.status(200).json({ status: 'OK', connectStatus: 'not_connected' })
  if (!process.env.STRIPE_SECRET_KEY) return res.status(200).json({ status: 'OK', connectStatus: company.stripe_connect_status })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const account = await stripe.accounts.retrieve(company.stripe_connect_account_id)
  const connectStatus = account.charges_enabled ? 'active' : 'onboarding'
  const patch = { stripe_connect_status: connectStatus }
  // Self-serve checkout can only ever be on while the account can actually
  // take charges - if Stripe later restricts the account, this turns the
  // patient-facing toggle back off automatically rather than leaving a
  // "self-serve enabled" flag pointing at an account that can't be paid.
  if (connectStatus !== 'active' && company.self_serve_checkout_enabled) patch.self_serve_checkout_enabled = false
  await supabase.from('insurance_companies').update(patch).eq('id', companyId)

  return res.status(200).json({ status: 'OK', connectStatus, chargesEnabled: account.charges_enabled, detailsSubmitted: account.details_submitted })
}
