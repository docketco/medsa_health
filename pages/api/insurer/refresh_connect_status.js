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
    .select('id, name, stripe_connect_account_id, stripe_connect_status').eq('id', companyId).maybeSingle()
  if (!company) return res.status(404).json({ status: 'ERROR', message: 'Company not found.' })
  if (!company.stripe_connect_account_id) return res.status(200).json({ status: 'OK', connectStatus: 'not_connected' })
  if (!process.env.STRIPE_SECRET_KEY) return res.status(200).json({ status: 'OK', connectStatus: company.stripe_connect_status })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const account = await stripe.accounts.retrieve(company.stripe_connect_account_id)
  const connectStatus = account.charges_enabled ? 'active' : 'onboarding'
  await supabase.from('insurance_companies').update({ stripe_connect_status: connectStatus }).eq('id', companyId)
  // Self-serve checkout is a per-plan choice, but it can only ever
  // actually run while the account can take a charge - if Stripe later
  // restricts the account, this turns every one of this insurer's plans'
  // toggles back off rather than leaving them pointing at an account
  // that can't be paid.
  if (connectStatus !== 'active') await supabase.from('insurance_plans').update({ self_serve_checkout_enabled: false }).eq('company_name', company.name).eq('self_serve_checkout_enabled', true)

  return res.status(200).json({ status: 'OK', connectStatus, chargesEnabled: account.charges_enabled, detailsSubmitted: account.details_submitted })
}
