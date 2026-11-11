// pages/api/claims-approver/list_queue.js
// ─────────────────────────────────────────────────────────────────────────────
// A claims approver's own queue - scoped to their institution directly
// (insurance_claims.institution_id), not by company name the way the
// underwriter queue has to be (plan_inquiries only carries a company_name
// text field). Separate role, separate identity, from pages/api/underwriter/
// list_queue.js - see onboard_claims_approver.js's own header comment for why.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { approverId } = req.body || {}
  if (!approverId) return res.status(400).json({ status: 'ERROR', message: 'approverId is required.' })

  const { data: approver } = await supabase.from('insurance_claims_approvers').select('institution_id').eq('id', approverId).maybeSingle()
  if (!approver) return res.status(404).json({ status: 'ERROR', message: 'Claims approver not found.' })
  if (!approver.institution_id) return res.status(200).json({ status: 'OK', claims: [] })

  const { data: claims } = await supabase.from('insurance_claims')
    .select('id, claim_ref, claim_type, amount, insurer_covered_amount, patient_copay_amount, deductible_applied, submitted_at, verification_flag, patients(full_name, medsa_id), insurance_plans(plan_name, company_name)')
    .eq('institution_id', approver.institution_id).eq('status', 'pending')
    .order('submitted_at', { ascending: true })

  return res.status(200).json({ status: 'OK', claims: claims || [] })
}
