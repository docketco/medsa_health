// Stripe webhook - the one moment a sponsor submission is actually
// allowed onto the live home_carousel_items table for a paid slot.
// Needs the raw request body for signature verification, so Next's
// default JSON body parser is disabled below. Configure this URL
// (https://medsa.health/api/webhooks/stripe) as a webhook endpoint in
// the Stripe Dashboard listening for checkout.session.completed, and
// set STRIPE_WEBHOOK_SECRET in Vercel to the signing secret it gives you.
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { matchPlanSuitability } from '../../../lib/planSuitability'

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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const submissionId = session.metadata?.submission_id
    const sponsorPlanId = session.metadata?.plan_id
    const videoConsultInstitutionId = session.metadata?.video_consult_institution_id
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
    const autoPurchaseInquiryId = session.metadata?.auto_purchase_inquiry_id
    if (autoPurchaseInquiryId) {
      // The one and only place the fully-automated purchase path actually
      // creates a held policy - see create_auto_purchase_checkout.js's own
      // comment for why. Re-checks the inquiry hasn't already been
      // converted (Stripe can redeliver this event) before inserting.
      const { data: inquiry } = await supabase.from('plan_inquiries').select('*').eq('id', autoPurchaseInquiryId).maybeSingle()
      if (inquiry && inquiry.status !== 'converted') {
        const patientId = session.metadata.patient_id
        const planId = session.metadata.plan_id
        const wardClass = session.metadata.ward_class || null
        const paymentFrequency = session.metadata.payment_frequency || 'monthly'
        const { data: plan } = await supabase.from('insurance_plans')
          .select('id, plan_name, company_name, contract_template_url, insurance_plan_pricing_tiers(*)')
          .eq('id', planId).maybeSingle()
        const { data: company } = await supabase.from('insurance_companies').select('institution_ref_id').eq('name', plan?.company_name).maybeSingle()
        const { data: patient } = await supabase.from('patients').select('full_name, date_of_birth').eq('id', patientId).maybeSingle()
        const age = patient?.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)) : null
        // Recomputed again here rather than trusting anything carried in
        // Stripe metadata - the premium that ends up on the policy record
        // always comes from the deterministic rule engine, never a stored
        // number that could go stale between checkout and confirmation.
        const { quotedPremium } = matchPlanSuitability({ plan, patientAge: age, conditions: inquiry.declared_conditions || [] })

        const now = new Date()
        const renewalDate = new Date(now)
        renewalDate.setFullYear(renewalDate.getFullYear() + 1)
        const nowIso = now.toISOString()

        await supabase.from('agent_policies').insert({
          agent_id: null, institution_id: company?.institution_ref_id || null,
          patient_id: patientId, patient_name: patient?.full_name || null,
          plan_id: planId, plan_name: plan?.plan_name, inquiry_id: autoPurchaseInquiryId,
          premium: quotedPremium, status: 'active',
          start_date: now.toISOString().slice(0, 10), renewal_date: renewalDate.toISOString().slice(0, 10),
          ward_class: wardClass, payment_frequency: paymentFrequency,
          health_declaration_acknowledged_at: nowIso,
          contract_file_path: plan?.contract_template_url || null,
          contract_ready_at: plan?.contract_template_url ? nowIso : null,
          patient_signed_at: plan?.contract_template_url ? nowIso : null,
          premium_paid_at: nowIso, stripe_checkout_session_id: session.id,
          amount_paid_hkd: (session.amount_total || 0) / 100,
        })

        await supabase.from('plan_inquiries').update({ status: 'converted' }).eq('id', autoPurchaseInquiryId)
      }
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
