// pages/api/insurer/set_self_serve_checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Turns Bowtie-style direct checkout on/off for this insurer's automated-
// purchase plans. Only allowed once their Connect account can actually
// take charges - never lets an insurer flip this on and have a patient's
// "Buy now" silently fail because their account isn't ready yet.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { companyId, enabled } = req.body || {}
  if (!companyId) return res.status(400).json({ status: 'ERROR', message: 'companyId is required.' })

  const { data: company } = await supabase.from('insurance_companies')
    .select('id, stripe_connect_status').eq('id', companyId).maybeSingle()
  if (!company) return res.status(404).json({ status: 'ERROR', message: 'Company not found.' })
  if (enabled && company.stripe_connect_status !== 'active') {
    return res.status(400).json({ status: 'ERROR', message: 'Connect your Stripe account and finish onboarding before enabling self-serve checkout.' })
  }

  const { error } = await supabase.from('insurance_companies').update({ self_serve_checkout_enabled: !!enabled }).eq('id', companyId)
  if (error) return res.status(500).json({ status: 'ERROR', message: error.message })
  return res.status(200).json({ status: 'OK' })
}
