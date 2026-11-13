// pages/api/claims-approver/list_queue.js
// ─────────────────────────────────────────────────────────────────────────────
// Real bug found live-testing: this used to scope by insurance_claims.
// institution_id directly - but that column means something else entirely
// now (lib/insuranceAdapter.js's own header comment: it's the SUBMITTING
// CLINIC's institution, written so the patient app can show "this claim
// came from Clinic X" - a genuinely different FK than "which insurer owns
// this claim" that happened to share a column name). A normal claim has
// no reason to ever carry the insurer's own institution_id there, so this
// queue silently matched almost nothing. Scoped by plan_id now instead -
// the same company_name -> plan ids route the Overview stat (InsuranceApp
// .jsx's InsuranceDashboard) already uses correctly, so this queue and
// that stat finally agree on what "pending" means. Also fixed: only
// status='pending' was ever queried, never 'pending_review' - the second
// real pending state the Overview stat already counts.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { approverId } = req.body || {}
  if (!approverId) return res.status(400).json({ status: 'ERROR', message: 'approverId is required.' })

  const { data: approver } = await supabase.from('insurance_claims_approvers').select('institution_id, institutions(name)').eq('id', approverId).maybeSingle()
  if (!approver) return res.status(404).json({ status: 'ERROR', message: 'Claims approver not found.' })
  if (!approver.institution_id || !approver.institutions?.name) return res.status(200).json({ status: 'OK', claims: [] })

  const { data: plans } = await supabase.from('insurance_plans').select('id').eq('company_name', approver.institutions.name)
  const planIds = (plans || []).map(p => p.id)
  if (planIds.length === 0) return res.status(200).json({ status: 'OK', claims: [] })

  const { data: claims } = await supabase.from('insurance_claims')
    .select('id, claim_ref, claim_type, amount, insurer_covered_amount, patient_copay_amount, deductible_applied, submitted_at, verification_flag, patients(full_name, medsa_id), insurance_plans(plan_name, company_name)')
    .in('plan_id', planIds).in('status', ['pending', 'pending_review'])
    .order('submitted_at', { ascending: true })

  return res.status(200).json({ status: 'OK', claims: claims || [] })
}
