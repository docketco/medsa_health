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
  // Migrated to v2 alongside create_connect_account_link.js - a v2-created
  // account isn't guaranteed readable via the v1 accounts.retrieve call.
  // v2 has no charges_enabled boolean; the equivalent is the merchant
  // configuration's card_payments capability status ('active' once
  // onboarding clears requirements Stripe is waiting on).
  const account = await stripe.v2.core.accounts.retrieve(company.stripe_connect_account_id, { include: ['configuration.merchant'] })
  const cardPaymentsStatus = account.configuration?.merchant?.capabilities?.card_payments?.status
  const chargesEnabled = cardPaymentsStatus === 'active'
  const connectStatus = chargesEnabled ? 'active' : 'onboarding'
  await supabase.from('insurance_companies').update({ stripe_connect_status: connectStatus }).eq('id', companyId)
  // Self-serve checkout is a per-plan choice, but it can only ever
  // actually run while the account can take a charge - if Stripe later
  // restricts the account, this turns every one of this insurer's plans'
  // toggles back off rather than leaving them pointing at an account
  // that can't be paid.
  if (connectStatus !== 'active') await supabase.from('insurance_plans').update({ self_serve_checkout_enabled: false }).eq('company_name', company.name).eq('self_serve_checkout_enabled', true)

  return res.status(200).json({ status: 'OK', connectStatus, chargesEnabled })
}
