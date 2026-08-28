// Real Stripe Checkout - created when Medsa Admin approves a sponsor
// submission and sets a price. Scaffolded now so it activates the
// moment STRIPE_SECRET_KEY is set in Vercel; until then it returns a
// clear NOT_CONFIGURED status instead of pretending to charge anyone.
// The submission is only inserted into the live home_carousel_items
// table once Stripe confirms payment (see /api/webhooks/stripe.js) -
// approving here starts the payment request, it doesn't publish yet.
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { sendEmail } from '../../../lib/email'
import { grossUpForStripeFee } from '../../../lib/paymentFees'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ status: 'NOT_CONFIGURED', message: 'Stripe is not connected yet - add STRIPE_SECRET_KEY in Vercel to enable real charging.' })
  }
  const { submissionId, amountHKD } = req.body || {}
  if (!submissionId || !amountHKD || amountHKD <= 0) {
    return res.status(400).json({ status: 'ERROR', message: 'submissionId and a positive amountHKD are required.' })
  }

  const { data: sub } = await supabase.from('home_carousel_submissions').select('*').eq('id', submissionId).maybeSingle()
  if (!sub) return res.status(404).json({ status: 'ERROR', message: 'Submission not found.' })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'

  // amountHKD is the amount Medsa wants to actually receive - the
  // sponsor's card is charged the grossed-up amount so Stripe's cut
  // comes out of that, not out of Medsa's quoted price.
  const { grossAmountHKD, estimatedFeeHKD } = grossUpForStripeFee(amountHKD)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'hkd',
        product_data: { name: `Medsa Health sponsored ${sub.item_type}: ${sub.title}` },
        unit_amount: Math.round(grossAmountHKD * 100),
      },
      quantity: 1,
    }],
    customer_email: sub.sponsor_contact_email || undefined,
    success_url: `${siteUrl}/sponsor-submit?paid=1`,
    cancel_url: `${siteUrl}/sponsor-submit?cancelled=1`,
    metadata: { submission_id: submissionId },
  })

  await supabase.from('home_carousel_submissions').update({
    price_hkd: amountHKD, gross_amount_hkd: grossAmountHKD, processing_fee_hkd: estimatedFeeHKD,
    payment_status: 'pending',
    stripe_checkout_session_id: session.id, stripe_payment_link: session.url,
  }).eq('id', submissionId)

  let emailResult = { sent: false, reason: 'No sponsor email on file.' }
  if (sub.sponsor_contact_email) {
    emailResult = await sendEmail({
      to: sub.sponsor_contact_email,
      subject: 'Medsa Health - complete payment for your sponsored post',
      html: `<p>Hi ${sub.sponsor_name || 'there'},</p><p>Your submission "${sub.title}" has been approved. Complete payment (HK$${grossAmountHKD.toFixed(2)}, includes card processing) to publish it:</p><p><a href="${session.url}">${session.url}</a></p>`,
    })
  }

  return res.status(200).json({ status: 'CREATED', paymentUrl: session.url, grossAmountHKD, estimatedFeeHKD, emailSent: emailResult.sent, emailReason: emailResult.reason })
}
