// pages/api/patient/cancel_free_look.js
// ─────────────────────────────────────────────────────────────────────────────
// HK's Insurance Authority guarantees a 21-day cooling-off/free-look period
// during which a policyholder can cancel for a FULL refund, no questions
// asked - this was already correctly explained to the patient (see
// cancellationWindow in PatientApp.jsx), but "Confirm request" inside that
// window still only ever set cancellation_requested_at and waited on an
// agent to manually process a refund with the insurer later. That's right
// for a normal post-free-look cancellation (which genuinely needs 30 days'
// notice and insurer coordination), but a free-look cancellation is the
// policyholder's unconditional right and should be immediate - when the
// premium was actually paid through Medsa's own Stripe integration, this
// refunds it directly and cancels the policy right here, no agent step
// needed. A direct-billed policy (no Stripe charge on file) still just
// records the request, since there's no payment on this platform to refund.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const FREE_LOOK_DAYS = 21

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { policyId, patientId } = req.body || {}
  if (!policyId || !patientId) return res.status(400).json({ status: 'ERROR', message: 'policyId and patientId are required.' })

  const { data: policy } = await supabase.from('agent_policies').select('*').eq('id', policyId).eq('patient_id', patientId).maybeSingle()
  if (!policy) return res.status(404).json({ status: 'ERROR', message: 'Policy not found.' })
  if (policy.status === 'cancelled') return res.status(200).json({ status: 'OK', alreadyCancelled: true })

  const startedAt = policy.start_date || policy.created_at
  const daysInto = Math.floor((Date.now() - new Date(startedAt).getTime()) / (1000 * 60 * 60 * 24))
  if (daysInto > FREE_LOOK_DAYS) {
    return res.status(400).json({ status: 'ERROR', message: `This policy is ${daysInto} days old - past the ${FREE_LOOK_DAYS}-day free-look window, so it needs the normal cancellation request instead of an instant refund.` })
  }

  let refunded = false
  if (process.env.STRIPE_SECRET_KEY && (policy.stripe_subscription_id || policy.stripe_checkout_session_id)) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    try {
      if (policy.stripe_subscription_id) {
        const sub = await stripe.subscriptions.retrieve(policy.stripe_subscription_id, { expand: ['latest_invoice.payment_intent'] })
        const pi = sub.latest_invoice?.payment_intent
        if (pi && pi.status === 'succeeded') await stripe.refunds.create({ payment_intent: pi.id })
        await stripe.subscriptions.cancel(policy.stripe_subscription_id)
      } else if (policy.stripe_checkout_session_id) {
        const session = await stripe.checkout.sessions.retrieve(policy.stripe_checkout_session_id)
        if (session.payment_intent) await stripe.refunds.create({ payment_intent: session.payment_intent })
      }
      refunded = true
    } catch (e) {
      return res.status(200).json({ status: 'ERROR', message: `Could not process the refund automatically: ${e.message}. Contact Medsa to finish this manually.` })
    }
  }

  await supabase.from('agent_policies').update({
    status: 'cancelled', cancellation_requested_at: new Date().toISOString(),
    cancellation_reason: refunded ? 'free_look_refund' : 'free_look_no_payment_on_file',
  }).eq('id', policyId)

  return res.status(200).json({ status: 'OK', refunded })
}
