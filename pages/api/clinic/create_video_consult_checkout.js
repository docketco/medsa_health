// pages/api/clinic/create_video_consult_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Video consultation is a paid, annual, per-clinic feature - a clinic pays
// once a year to unlock the option for every one of its doctors, rather
// than it being free/always-on or billed per call. Same self-serve Stripe
// Checkout + gross-up pattern as /api/insurer/create_sponsor_checkout.js -
// no Medsa approval step. Actually flipping institutions.video_consult_enabled
// happens in the webhook once Stripe confirms payment, not here.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { grossUpForStripeFee } from '../../../lib/paymentFees'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const RATE_HKD_PER_YEAR = 6000

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Stripe is not connected yet - add STRIPE_SECRET_KEY in Vercel to enable real charging.' })
  }
  const { institutionId } = req.body || {}
  if (!institutionId) return res.status(400).json({ status: 'ERROR', message: 'institutionId is required.' })

  const { data: institution } = await supabase.from('institutions').select('id, name, active').eq('id', institutionId).maybeSingle()
  if (!institution || !institution.active) return res.status(403).json({ status: 'ERROR', message: 'Clinic not found or inactive.' })

  const { grossAmountHKD } = grossUpForStripeFee(RATE_HKD_PER_YEAR)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'hkd',
        product_data: { name: `Medsa Health video consultations - ${institution.name} (1 year)` },
        unit_amount: Math.round(grossAmountHKD * 100),
      },
      quantity: 1,
    }],
    success_url: `${siteUrl}/clinic-ops?video_consult_enabled=1`,
    cancel_url: `${siteUrl}/clinic-ops?video_consult_cancelled=1`,
    metadata: { video_consult_institution_id: institutionId },
  })

  return res.status(200).json({ status: 'CREATED', paymentUrl: session.url, grossAmountHKD })
}
