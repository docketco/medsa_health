// Stripe webhook - the one moment a sponsor submission is actually
// allowed onto the live home_carousel_items table for a paid slot.
// Needs the raw request body for signature verification, so Next's
// default JSON body parser is disabled below. Configure this URL
// (https://medsa.health/api/webhooks/stripe) as a webhook endpoint in
// the Stripe Dashboard listening for checkout.session.completed, and
// set STRIPE_WEBHOOK_SECRET in Vercel to the signing secret it gives you.
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

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
