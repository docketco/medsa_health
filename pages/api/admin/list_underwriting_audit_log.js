// pages/api/admin/list_underwriting_audit_log.js
// ─────────────────────────────────────────────────────────────────────────────
// Closes the real gap flagged in aq2-16: the audit trail was being
// written correctly (underwriting_audit_log, from both the matching
// engine's auto-flags and every underwriter decision) but nothing ever
// read it back. This is that read-side - scoped to one insurer's own
// cases, for medsa-admin's Insurers tab.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { companyName } = req.body || {}
  if (!companyName) return res.status(400).json({ status: 'ERROR', message: 'companyName is required.' })

  const { data: inquiries } = await supabase.from('plan_inquiries')
    .select('id, applicant_full_name, insurance_plans!inner(plan_name, company_name)')
    .eq('insurance_plans.company_name', companyName)
  const inquiryIds = (inquiries || []).map(i => i.id)
  if (inquiryIds.length === 0) return res.status(200).json({ status: 'OK', entries: [] })
  const inquiryById = Object.fromEntries((inquiries || []).map(i => [i.id, i]))

  const { data: logRows } = await supabase.from('underwriting_audit_log')
    .select('*').in('inquiry_id', inquiryIds).order('created_at', { ascending: false }).limit(50)

  const entries = (logRows || []).map(r => ({
    ...r,
    applicantName: inquiryById[r.inquiry_id]?.applicant_full_name || null,
    planName: inquiryById[r.inquiry_id]?.insurance_plans?.plan_name || null,
  }))

  return res.status(200).json({ status: 'OK', entries })
}
