// Stripe webhook - the one moment a sponsor submission is actually
// allowed onto the live home_carousel_items table for a paid slot.
// Needs the raw request body for signature verification, so Next's
// default JSON body parser is disabled below. Configure this URL
// (https://medsa.health/api/webhooks/stripe) as a webhook endpoint in
// the Stripe Dashboard listening for checkout.session.completed, and
// set STRIPE_WEBHOOK_SECRET in Vercel to the signing secret it gives you.
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createAutoPurchasePolicy } from '../../../lib/completeAutoPurchase'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export const config = { api: { bodyParser: false } }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(200).json({ received: false, message: 'Stripe not configured yet.' })
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const sig = req.headers['stripe-signature']
  const rawBody = await readRawBody(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` })
  }

  // Keeps insurance_companies.subscription_status in sync with the real
  // Stripe subscription - this is Medsa's actual revenue now (a flat
  // monthly platform fee), so a lapsed/cancelled card needs to show up
  // here, not just silently stop billing.
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object
    const companyId = sub.metadata?.company_id
    if (companyId) {
      const status = sub.status === 'active' || sub.status === 'trialing' ? 'active'
        : sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due' : 'canceled'
      await supabase.from('insurance_companies').update({ subscription_status: status, stripe_subscription_id: sub.id }).eq('id', companyId)
    }
  }
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    const companyId = sub.metadata?.company_id
    if (companyId) await supabase.from('insurance_companies').update({ subscription_status: 'canceled' }).eq('id', companyId)
  }

  // Keeps stripe_connect_status in sync as an insurer completes (or later
  // loses) the ability to actually take charges on their connected
  // account - this is what gates the self-serve-checkout toggle.
  if (event.type === 'account.updated') {
    const account = event.data.object
    const companyId = account.metadata?.company_id
    if (companyId) {
      const connectStatus = account.charges_enabled ? 'active' : 'onboarding'
      const { data: company } = await supabase.from('insurance_companies').select('name').eq('id', companyId).maybeSingle()
      await supabase.from('insurance_companies').update({ stripe_connect_status: connectStatus }).eq('id', companyId)
      // Self-serve checkout is a per-plan choice - if the account can no
      // longer take charges, every one of this insurer's plans that had
      // it on gets turned back off rather than left pointing at a
      // restricted account.
      if (connectStatus !== 'active' && company?.name) {
        await supabase.from('insurance_plans').update({ self_serve_checkout_enabled: false }).eq('company_name', company.name).eq('self_serve_checkout_enabled', true)
      }
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const submissionId = session.metadata?.submission_id
    const sponsorPlanId = session.metadata?.plan_id
    const videoConsultInstitutionId = session.metadata?.video_consult_institution_id
    const autoPurchaseInquiryId = session.metadata?.auto_purchase_inquiry_id
    // Self-serve automated-purchase path: the patient just paid the
    // insurer's own connected Stripe account directly (Connect transfer,
    // zero application fee - Medsa never touches this money). The policy
    // is only ever created here, after Stripe confirms the charge
    // actually went through, using the same logic the no-Stripe direct
    // path uses.
    if (autoPurchaseInquiryId) {
      await createAutoPurchasePolicy(supabase, {
        inquiryId: autoPurchaseInquiryId,
        patientId: session.metadata?.auto_purchase_patient_id,
        planId: session.metadata?.auto_purchase_plan_id,
        wardClass: session.metadata?.auto_purchase_ward_class || null,
        paymentFrequency: session.metadata?.auto_purchase_payment_frequency || null,
      })
    }
    if (videoConsultInstitutionId) {
      const until = new Date()
      until.setFullYear(until.getFullYear() + 1)
      await supabase.from('institutions').update({
        video_consult_enabled: true, video_consult_expires_at: until.toISOString().slice(0,10),
        video_consult_price_hkd: (session.amount_total || 0) / 100,
      }).eq('id', videoConsultInstitutionId)
    }
    if (sponsorPlanId) {
      const months = parseInt(session.metadata?.months) || 1
      const until = new Date()
      until.setMonth(until.getMonth() + months)
      await supabase.from('insurance_plans').update({
        sponsored: true, sponsored_until: until.toISOString().slice(0,10),
        sponsor_price_hkd: (session.amount_total || 0) / 100,
      }).eq('id', sponsorPlanId)
    }
    if (submissionId) {
      const { data: sub } = await supabase.from('home_carousel_submissions').select('*').eq('id', submissionId).maybeSingle()
      if (sub && sub.payment_status !== 'paid') {
        const { data: items } = await supabase.from('home_carousel_items').select('display_order').order('display_order', {ascending:false}).limit(1)
        const maxOrder = items?.[0]?.display_order || 0
        await supabase.from('home_carousel_items').insert({
          item_type: sub.item_type, title: sub.title, subtitle: sub.subtitle,
          image_url: sub.image_url, sponsor_name: sub.sponsor_name,
          link_url: sub.link_url, cta_label: sub.cta_label, content_blocks: sub.content_blocks,
          display_order: maxOrder+1, active: true,
        })
        await supabase.from('home_carousel_submissions').update({
          status: 'approved', payment_status: 'paid', paid_at: new Date().toISOString(),
        }).eq('id', submissionId)
      }
    }
  }

  return res.status(200).json({ received: true })
}
