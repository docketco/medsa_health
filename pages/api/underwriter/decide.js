// pages/api/underwriter/decide.js
// ─────────────────────────────────────────────────────────────────────────────
// The three real actions an underwriter (or delegated Medsa staff) can take
// on a case in their queue - approve, decline, or request a specific
// doctor's report on the ONE flagged item (aq2-07), under a separate
// release, not a blanket request for the full record. Every action writes
// a row to underwriting_audit_log (aq2-16) - a real trail, not just app
// state, readable by the underwriter portal and (read-only) the insurer's
// own Insurers tab.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { inquiryId, action, underwriterId, underwriterName, reason, reportNote, reportDoctor } = req.body || {}
  if (!inquiryId || !action) return res.status(400).json({ status: 'ERROR', message: 'inquiryId and action are required.' })
  if (!['approve', 'decline', 'request_report'].includes(action)) return res.status(400).json({ status: 'ERROR', message: 'Invalid action.' })

  const { data: inquiry } = await supabase.from('plan_inquiries').select('id, underwriter_status').eq('id', inquiryId).maybeSingle()
  if (!inquiry) return res.status(404).json({ status: 'ERROR', message: 'Inquiry not found.' })
  if (inquiry.underwriter_status !== 'pending') return res.status(400).json({ status: 'ERROR', message: 'This case is no longer pending review.' })

  const actorType = req.body.medsaStaff ? 'medsa_staff' : 'underwriter'
  const nowIso = new Date().toISOString()

  if (action === 'approve') {
    await supabase.from('plan_inquiries').update({
      underwriter_status: 'approved', underwriter_id: underwriterId || null,
      underwriter_decided_at: nowIso, underwriter_decision_reason: reason || null,
    }).eq('id', inquiryId)
    await supabase.from('underwriting_audit_log').insert({
      inquiry_id: inquiryId, actor_type: actorType, actor_name: underwriterName || null, action: 'approved', detail: reason || null,
    })
  } else if (action === 'decline') {
    if (!reason?.trim()) return res.status(400).json({ status: 'ERROR', message: 'A decline needs a reason - the patient sees this.' })
    // Declining after review also flips suitability_verdict, not just
    // underwriter_status - the agent-facing card (aq2-04) reads
    // suitability_verdict to decide what to show, and a case that was
    // 'flagged' needs to actually read 'declined' once decided, the same
    // as a matching-only decline would.
    await supabase.from('plan_inquiries').update({
      underwriter_status: 'declined', suitability_verdict: 'declined',
      underwriter_id: underwriterId || null, underwriter_decided_at: nowIso, underwriter_decision_reason: reason.trim(),
    }).eq('id', inquiryId)
    await supabase.from('underwriting_audit_log').insert({
      inquiry_id: inquiryId, actor_type: actorType, actor_name: underwriterName || null, action: 'declined', detail: reason.trim(),
    })
  } else if (action === 'request_report') {
    if (!reportNote?.trim()) return res.status(400).json({ status: 'ERROR', message: 'Describe what the report should cover.' })
    // Case stays pending - a requested report doesn't decide anything by
    // itself, it just adds context for the eventual approve/decline.
    await supabase.from('plan_inquiries').update({
      requested_report_note: reportNote.trim(), requested_report_doctor: reportDoctor?.trim() || null, requested_report_at: nowIso,
    }).eq('id', inquiryId)
    await supabase.from('underwriting_audit_log').insert({
      inquiry_id: inquiryId, actor_type: actorType, actor_name: underwriterName || null, action: 'requested_report',
      detail: `${reportDoctor?.trim() ? `From ${reportDoctor.trim()}: ` : ''}${reportNote.trim()}`,
    })
  }

  return res.status(200).json({ status: 'OK' })
}
