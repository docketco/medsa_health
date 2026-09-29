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
    // Real bug found live-testing: stripe.accounts.create is the legacy
    // "Accounts v1" API, which Stripe now rejects outright for any Connect
    // platform that hasn't explicitly kept v1 support on - it throws a 500
    // here with no JSON body, which the frontend's res.json() call then
    // also throws on, so the insurer just saw the button silently reset
    // with no error shown at all ("jumps back to Connect Stripe"). Catching
    // it here at least surfaces the real reason instead of a silent
    // failure - the actual fix is enabling Accounts v1 support for this
    // Stripe account (Settings -> Developers -> API policies), or migrating
    // this call to the v2 Accounts API, which is a larger, untested-from-
    // here change.
    let account
    try {
      account = await stripe.accounts.create({
        type: 'express',
        country: 'HK',
        email: company.contact_email || undefined,
        business_type: 'company',
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { company_id: company.id },
      })
    } catch (err) {
      console.error('create_connect_account_link: stripe.accounts.create failed', err.message)
      return res.status(200).json({ status: 'ERROR', message: `Stripe rejected creating the connected account: ${err.message || 'unknown error'}` })
    }
    accountId = account.id
    await supabase.from('insurance_companies').update({ stripe_connect_account_id: accountId, stripe_connect_status: 'onboarding' }).eq('id', company.id)
  }

  let accountLink
  try {
    accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/insurer-portal?connect_refresh=1`,
      return_url: `${siteUrl}/insurer-portal?connect_return=1`,
      type: 'account_onboarding',
    })
  } catch (err) {
    console.error('create_connect_account_link: stripe.accountLinks.create failed', err.message)
    return res.status(200).json({ status: 'ERROR', message: `Stripe rejected the onboarding link: ${err.message || 'unknown error'}` })
  }

  return res.status(200).json({ status: 'CREATED', onboardingUrl: accountLink.url })
}
