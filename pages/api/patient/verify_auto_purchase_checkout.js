// pages/api/patient/verify_auto_purchase_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Same bug class as verify_subscription_checkout.js/verify_sponsor_checkout.js,
// found live-testing this flow specifically: complete_auto_purchase.js's
// self-serve Stripe path only ever creates the policy from the
// checkout.session.completed webhook, which is confirmed not firing in
// this environment - a real payment completes, redirects back to
// /patient?auto_purchase=1, and nothing is there: no policy, no error,
// the patient just doesn't see the plan they just paid for. Checks the
// real Stripe session directly and runs the same createAutoPurchasePolicy
// the webhook would have, so activation never depends on the webhook
// landing. createAutoPurchasePolicy is itself idempotent (checks
// status==='converted' first), so this is safe even if the webhook also
// eventually fires for the same session.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createAutoPurchasePolicy } from '../../../lib/completeAutoPurchase'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.STRIPE_SECRET_KEY) return res.status(200).json({ status: 'NOT_CONFIGURED' })
  const { sessionId } = req.body || {}
  if (!sessionId) return res.status(400).json({ status: 'ERROR', message: 'sessionId is required.' })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return res.status(200).json({ status: 'NOT_PAID', paymentStatus: session.payment_status })
  }

  const inquiryId = session.metadata?.auto_purchase_inquiry_id
  if (!inquiryId) return res.status(200).json({ status: 'ERROR', message: 'This session has no automated-purchase inquiry on file - contact Medsa.' })

  const result = await createAutoPurchasePolicy(supabase, {
    inquiryId,
    patientId: session.metadata?.auto_purchase_patient_id,
    planId: session.metadata?.auto_purchase_plan_id,
    wardClass: session.metadata?.auto_purchase_ward_class || null,
    paymentFrequency: session.metadata?.auto_purchase_payment_frequency || null,
  })

  if (result.status === 'ERROR') return res.status(200).json(result)
  return res.status(200).json({ status: 'OK', policyId: result.policyId })
}
