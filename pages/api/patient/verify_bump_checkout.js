// pages/api/patient/verify_bump_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Same pattern as verify_video_consult_checkout.js / verify_sponsor_checkout.js
// - the webhook path for checkout.session.completed is confirmed unreliable
// elsewhere in this app, so activation happens by checking the real Stripe
// session directly on return from checkout, not by waiting on a webhook.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { retrievePaidSession } from '../../../lib/verifyStripeCheckout'
import { BUMP_LOYALTY_CREDIT_HKD } from '../../../lib/bumpPricing'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { sessionId } = req.body || {}
  const result = await retrievePaidSession(sessionId)
  if (result.status !== 'PAID') return res.status(result.status === 'ERROR' ? 400 : 200).json(result)
  const { session } = result

  const patientId = session.metadata?.bump_patient_id
  if (!patientId) return res.status(200).json({ status: 'ERROR', message: 'This session has no patient on file - contact Medsa.' })

  const { data: existing } = await supabase.from('bump_subscriptions')
    .select('id').eq('stripe_checkout_session_id', session.id).maybeSingle()
  if (existing) return res.status(200).json({ status: 'OK', alreadyApplied: true })

  const isLoyaltyCredit = session.metadata?.bump_is_loyalty_credit === 'true'
  const { error: insErr } = await supabase.from('bump_subscriptions').insert({
    patient_id: patientId,
    predicted_due_date: session.metadata?.bump_predicted_due_date || null,
    gestational_weeks_at_signup: session.metadata?.bump_gestational_weeks_at_signup ? Number(session.metadata.bump_gestational_weeks_at_signup) : null,
    discovered_pregnant_at: session.metadata?.bump_discovered_pregnant_at || null,
    stripe_checkout_session_id: session.id,
    amount_paid_hkd: (session.amount_total || 0) / 100,
    is_loyalty_discount: isLoyaltyCredit,
  })
  // The select-then-insert above isn't atomic - two calls landing within
  // the same window (e.g. a double effect-fire on return from Stripe) can
  // both pass the select before either insert commits. A real duplicate
  // got created this exact way. The DB now has a unique index on
  // stripe_checkout_session_id backing this up - a 23505 here means the
  // other call already won, so treat it the same as alreadyApplied rather
  // than surfacing a spurious error.
  if (insErr && insErr.code !== '23505') return res.status(200).json({ status: 'ERROR', message: insErr.message })
  const alreadyApplied = insErr?.code === '23505'

  // Loyalty redirect: Bump itself was charged full price (see
  // create_bump_checkout.js) - this is where the same value actually
  // becomes a credit, applied toward Guardian instead of this purchase.
  // Reads the current balance rather than a blind increment so a retry
  // of this same session (already caught by alreadyApplied above) can
  // never double-grant it.
  if (isLoyaltyCredit && !alreadyApplied) {
    const { data: p } = await supabase.from('patients').select('bump_loyalty_credit_hkd').eq('id', patientId).maybeSingle()
    await supabase.from('patients').update({ bump_loyalty_credit_hkd: (p?.bump_loyalty_credit_hkd||0) + BUMP_LOYALTY_CREDIT_HKD }).eq('id', patientId)
  }

  return res.status(200).json({ status: 'OK', alreadyApplied })
}
