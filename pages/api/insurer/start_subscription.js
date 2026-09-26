// pages/api/insurer/start_subscription.js
// ─────────────────────────────────────────────────────────────────────────────
// Insurer-initiated version of start_insurer_subscription.js - the insurer
// pays their own platform subscription themselves, from their own Payments
// tab, instead of medsa-admin generating a link and sending it to them.
// Only reachable once Medsa has flipped stripe_payments_enabled for this
// company (a deliberate step after the contract is signed - see
// PartnerChecklist/contract_signed_at). Card is a real cost to Medsa (Stripe's
// own processing fee), so a flat surcharge is added on top of the base fee -
// bank transfer (handled entirely outside the app, see PaymentsManager)
// carries none.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const CARD_SURCHARGE_PCT = 3.5

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Stripe is not connected yet - contact Medsa.' })
  }
  const { companyId } = req.body || {}
  if (!companyId) return res.status(400).json({ status: 'ERROR', message: 'companyId is required.' })

  const { data: company } = await supabase.from('insurance_companies')
    .select('id, name, contact_email, subscription_fee_hkd_monthly, stripe_customer_id, stripe_payments_enabled').eq('id', companyId).maybeSingle()
  if (!company) return res.status(404).json({ status: 'ERROR', message: 'Company not found.' })
  if (!company.stripe_payments_enabled) return res.status(403).json({ status: 'ERROR', message: 'Stripe payments aren\'t enabled for your account yet - contact Medsa.' })
  if (!company.subscription_fee_hkd_monthly || company.subscription_fee_hkd_monthly <= 0) {
    return res.status(400).json({ status: 'ERROR', message: 'Medsa hasn\'t set your subscription fee yet - contact Medsa.' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'

  let customerId = company.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: company.name, email: company.contact_email || undefined,
      metadata: { company_id: company.id },
    })
    customerId = customer.id
    await supabase.from('insurance_companies').update({ stripe_customer_id: customerId }).eq('id', company.id)
  }

  const surchargedAmount = company.subscription_fee_hkd_monthly * (1 + CARD_SURCHARGE_PCT / 100)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{
      price_data: {
        currency: 'hkd',
        product_data: { name: `Medsa Health platform subscription - ${company.name} (card, incl. ${CARD_SURCHARGE_PCT}% processing surcharge)` },
        unit_amount: Math.round(surchargedAmount * 100),
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    success_url: `${siteUrl}/insurer-portal?subscription=1`,
    cancel_url: `${siteUrl}/insurer-portal?subscription_cancelled=1`,
    metadata: { company_id: company.id },
    subscription_data: { metadata: { company_id: company.id } },
  })

  await supabase.from('insurance_companies').update({ subscription_payment_method: 'card' }).eq('id', companyId)

  return res.status(200).json({ status: 'CREATED', checkoutUrl: session.url, surchargePct: CARD_SURCHARGE_PCT })
}
