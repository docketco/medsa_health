// pages/api/insurer/create_connect_account_link.js
// ─────────────────────────────────────────────────────────────────────────────
// Lets an insurer plug in their own Stripe account for Bowtie-style
// self-serve checkout - the patient pays the insurer directly, Medsa's
// Stripe integration only ever facilitates the checkout page, never holds
// or takes a cut of the premium. Same reasoning as the removal of Medsa-
// as-merchant-of-record: this is Stripe Connect's actual purpose (a
// platform routing money to its own users' accounts, not its own).
// Creates a Stripe Express connected account for the company the first
// time this is called (reused after), then an Account Link for the
// insurer to complete onboarding themselves in their own browser.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Stripe is not connected yet - add STRIPE_SECRET_KEY in Vercel to enable Connect onboarding.' })
  }
  const { companyId } = req.body || {}
  if (!companyId) return res.status(400).json({ status: 'ERROR', message: 'companyId is required.' })

  const { data: company } = await supabase.from('insurance_companies')
    .select('id, name, contact_email, status, stripe_connect_account_id').eq('id', companyId).maybeSingle()
  if (!company || company.status !== 'active') return res.status(403).json({ status: 'ERROR', message: 'No active insurer account matches this company.' })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'

  let accountId = company.stripe_connect_account_id
  if (!accountId) {
    // Real bug found live-testing, root-caused via server logs: the old
    // stripe.accounts.create call used the legacy "Accounts v1" API, which
    // Stripe rejects outright for this platform, even after enabling
    // "Accounts v1 support" in the Dashboard. Migrated to the v2 Accounts
    // API (POST /v2/core/accounts). First migration attempt requested
    // both merchant + recipient configurations and got "This account
    // configuration is not supported" - the actual charge pattern this
    // app uses (see complete_auto_purchase.js: a Checkout Session created
    // on MEDSA's own account, with transfer_data.destination routing the
    // money to this connected account, no on_behalf_of) is a Destination
    // Charge without on_behalf_of. Per Stripe's own Connect integration
    // design guidance, that pattern only needs the connected account to
    // hold a Recipient configuration - the account never creates its own
    // charge, so Merchant (which requests card_payments capability for
    // charges made ON that account) doesn't apply and was the invalid
    // combination. Recipient-only lets the account receive the transfer
    // into its Stripe balance and pay itself out to a linked bank account.
    let account
    try {
      account = await stripe.v2.core.accounts.create({
        contact_email: company.contact_email || undefined,
        display_name: company.name,
        dashboard: 'express',
        identity: { country: 'HK', entity_type: 'company' },
        configuration: {
          recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
        },
        defaults: {
          currency: 'hkd',
          // Real error from Stripe on the first attempt: for a recipient-
          // only account, both fields can only be 'application' - makes
          // sense given the money is actually processed on MEDSA's own
          // account (a Destination Charge, see the comment above) and
          // only transferred to this account afterward, so Medsa (the
          // platform/"application") is the one Stripe holds responsible
          // for this account's fees and any negative-balance risk, not
          // Stripe itself.
          responsibilities: { fees_collector: 'application', losses_collector: 'application' },
        },
        metadata: { company_id: company.id },
      })
    } catch (err) {
      console.error('create_connect_account_link: stripe.v2.core.accounts.create failed', err.message)
      return res.status(200).json({ status: 'ERROR', message: `Stripe rejected creating the connected account: ${err.message || 'unknown error'}` })
    }
    accountId = account.id
    await supabase.from('insurance_companies').update({ stripe_connect_account_id: accountId, stripe_connect_status: 'onboarding' }).eq('id', company.id)
  }

  let accountLink
  try {
    // v2 Account Links is a separate endpoint from v1's - same reasoning
    // as the account creation migration above.
    accountLink = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['recipient'],
          refresh_url: `${siteUrl}/insurer-portal?connect_refresh=1`,
          return_url: `${siteUrl}/insurer-portal?connect_return=1`,
        },
      },
    })
  } catch (err) {
    console.error('create_connect_account_link: stripe.v2.core.accountLinks.create failed', err.message)
    return res.status(200).json({ status: 'ERROR', message: `Stripe rejected the onboarding link: ${err.message || 'unknown error'}` })
  }

  return res.status(200).json({ status: 'CREATED', onboardingUrl: accountLink.url })
}
