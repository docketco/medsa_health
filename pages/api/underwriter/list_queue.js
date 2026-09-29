// pages/api/underwriter/list_queue.js
// ─────────────────────────────────────────────────────────────────────────────
// The underwriter's own queue - the ONE place that sees the full picture
// (raw declared conditions, the plan-specific reasoning) an agent never
// gets (see aq2-04/aq2-11). Two real buckets, both waiting on a human
// decision before a purchase can go through:
//   - flagged: a genuinely ambiguous case (lib/planSuitabilityMatch.js
//     couldn't confidently approve or decline it).
//   - clean sign-off: a clean verdict, but the insurer hasn't turned on
//     auto_buy_on_clean, so even an unambiguous "approved" still waits for
//     a quick human look (aq2-19) - shown separately since it's a much
//     faster read than a real flagged case.
// Scoped to the underwriter's own institution unless the insurer has
// explicitly delegated to Medsa staff (underwriting_delegated_to_medsa) -
// Medsa staff querying this endpoint pass medsaStaff:true and see every
// delegated insurer's queue instead of one institution's.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { underwriterId, medsaStaff } = req.body || {}

  let companyNames = []
  if (medsaStaff) {
    const { data: delegated } = await supabase.from('insurance_companies').select('name').eq('underwriting_delegated_to_medsa', true)
    companyNames = (delegated || []).map(c => c.name)
  } else {
    if (!underwriterId) return res.status(400).json({ status: 'ERROR', message: 'underwriterId is required.' })
    const { data: underwriter } = await supabase.from('insurance_underwriters').select('institution_id').eq('id', underwriterId).maybeSingle()
    if (!underwriter) return res.status(404).json({ status: 'ERROR', message: 'Underwriter not found.' })
    const { data: companies } = await supabase.from('insurance_companies').select('name').eq('institution_ref_id', underwriter.institution_id)
    companyNames = (companies || []).map(c => c.name)
  }
  if (companyNames.length === 0) return res.status(200).json({ status: 'OK', flagged: [], cleanSignoff: [] })

  const { data: inquiries } = await supabase.from('plan_inquiries')
    .select('id, applicant_full_name, applicant_hkid, declared_conditions, suitability_verdict, suitability_summary, flag_category, quoted_premium_hkd, created_at, requested_report_note, requested_report_doctor, requested_report_at, insurance_plans!inner(plan_name, company_name)')
    .eq('underwriter_status', 'pending').in('insurance_plans.company_name', companyNames)
    .order('created_at', { ascending: true })

  const flagged = (inquiries || []).filter(i => i.suitability_verdict === 'flagged')
  const cleanSignoff = (inquiries || []).filter(i => i.suitability_verdict === 'approved')

  return res.status(200).json({ status: 'OK', flagged, cleanSignoff })
}
