// pages/api/admin/start_insurer_subscription.js
// ─────────────────────────────────────────────────────────────────────────────
// Creates the Checkout link for an insurer's platform SUBSCRIPTION fee -
// this is Medsa's actual revenue model now, replacing the per-policy
// platform_fee_hkd charged on each automated sale. A flat monthly fee for
// using the platform (quoting engine, claims processing, patient app
// listing) reads as paying for software, not as a commission/referral fee
// tied to a specific policy sale - the thing that needs an Insurance
// Authority intermediary license. Admin sets the monthly rate on the
// company's card, then this creates a Stripe Checkout session in
// subscription mode; the link is shown here to send to the insurer's own
// billing contact to complete (their card, their subscription).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Stripe is not connected yet - add STRIPE_SECRET_KEY in Vercel to enable real subscription billing.' })
  }
  const { companyId } = req.body || {}
  if (!companyId) return res.status(400).json({ status: 'ERROR', message: 'companyId is required.' })

  const { data: company } = await supabase.from('insurance_companies')
    .select('id, name, contact_email, subscription_fee_hkd_monthly, stripe_customer_id').eq('id', companyId).maybeSingle()
  if (!company) return res.status(404).json({ status: 'ERROR', message: 'Company not found.' })
  if (!company.subscription_fee_hkd_monthly || company.subscription_fee_hkd_monthly <= 0) {
    return res.status(400).json({ status: 'ERROR', message: 'Set a monthly subscription fee for this insurer first.' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'

  // Reuse an existing Stripe Customer for this insurer rather than minting
  // a new one on every "start subscription" click.
  let customerId = company.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: company.name, email: company.contact_email || undefined,
      metadata: { company_id: company.id },
    })
    customerId = customer.id
    await supabase.from('insurance_companies').update({ stripe_customer_id: customerId }).eq('id', company.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{
      price_data: {
        currency: 'hkd',
        product_data: { name: `Medsa Health platform subscription - ${company.name}` },
        unit_amount: Math.round(company.subscription_fee_hkd_monthly * 100),
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    success_url: `${siteUrl}/insurer-portal?subscription=1`,
    cancel_url: `${siteUrl}/insurer-portal?subscription_cancelled=1`,
    metadata: { company_id: company.id },
    subscription_data: { metadata: { company_id: company.id } },
  })

  return res.status(200).json({ status: 'CREATED', checkoutUrl: session.url })
}
