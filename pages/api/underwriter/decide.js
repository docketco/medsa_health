// pages/api/underwriter/decide.js
// ─────────────────────────────────────────────────────────────────────────────
// The real actions an underwriter (or delegated Medsa staff) can take on a
// case in their queue - approve, decline, or request a specific doctor's
// report on the ONE flagged item (aq2-07), under a separate release, not a
// blanket request for the full record. Takes EITHER inquiryId (an
// application/self-declare case, plan_inquiries) OR policyId (an agent-
// written policy submitted for sign-off, agent_policies) - same two real
// decisions (approve/decline), different record, so one endpoint instead
// of duplicating the whole actor/audit-log pattern. Every action writes a
// row to underwriting_audit_log (aq2-16) - a real trail, not just app
// state, readable by the underwriter portal and (read-only) the insurer's
// own Insurers tab.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { assignInquiryToNextAgent } from '../../../lib/agentAssignment'
import { sendEmail } from '../../../lib/email'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { inquiryId, policyId, action, underwriterId, underwriterName, reason, reportNote, reportDoctor } = req.body || {}
  if (!inquiryId && !policyId) return res.status(400).json({ status: 'ERROR', message: 'inquiryId or policyId is required.' })
  if (!action) return res.status(400).json({ status: 'ERROR', message: 'action is required.' })
  if (!['approve', 'decline', 'request_report'].includes(action)) return res.status(400).json({ status: 'ERROR', message: 'Invalid action.' })

  const actorType = req.body.medsaStaff ? 'medsa_staff' : 'underwriter'
  const nowIso = new Date().toISOString()

  // ── Policy approval (agent-written policy, submitted for sign-off) ──────
  if (policyId) {
    if (action === 'request_report') return res.status(400).json({ status: 'ERROR', message: 'request_report only applies to an application, not a policy.' })
    const { data: policy } = await supabase.from('agent_policies').select('id, inquiry_id, underwriter_status, patient_name, plan_name').eq('id', policyId).maybeSingle()
    if (!policy) return res.status(404).json({ status: 'ERROR', message: 'Policy not found.' })
    if (policy.underwriter_status !== 'pending') return res.status(400).json({ status: 'ERROR', message: 'This policy is no longer pending review.' })

    if (action === 'approve') {
      // Atomic conditional update - this and decline's own update both
      // require underwriter_status='pending' in the WHERE clause itself,
      // not just an earlier SELECT check, so two colleagues deciding the
      // same case within the same second can't both "win": whichever
      // UPDATE commits first flips the row out of 'pending', and the
      // second one's WHERE clause then matches nothing - caught below by
      // checking the affected row actually came back, not assumed.
      // status flips to 'active' here too, not just underwriter_status -
      // real gap found live-testing: every agent-written policy now
      // starts 'quote' with no way for the agent to set 'active'
      // themselves (create_policy.js), so approval has to be the one
      // place that actually turns it on, or an approved policy would sit
      // 'quote' forever and never surface as "Policy on file" to the
      // patient (PatientApp.jsx's own held-policy query checks both
      // status='active' AND underwriter_status='approved').
      const { data: updated } = await supabase.from('agent_policies').update({
        status: 'active', underwriter_status: 'approved', underwriter_id: underwriterId || null, underwriter_decided_at: nowIso, underwriter_decision_reason: reason || null,
      }).eq('id', policyId).eq('underwriter_status', 'pending').select('id')
      if (!updated || updated.length === 0) return res.status(409).json({ status: 'ERROR', message: 'Someone else already decided this case.' })
      await supabase.from('underwriting_audit_log').insert({
        policy_id: policyId, actor_type: actorType, actor_name: underwriterName || null, action: 'policy_approved', detail: reason || null,
      })
      // Real gap: an approved policy used to just sit there with no
      // signal at all back to the thread both sides already read (see
      // "on file for both agent and patient since it's under the same
      // thread") - this is that signal.
      if (policy.inquiry_id) {
        await supabase.from('inquiry_messages').insert({
          inquiry_id: policy.inquiry_id, sender_type: 'underwriter', sender_name: underwriterName || 'Underwriter',
          body: `✓ Your policy for ${policy.plan_name} has been approved by the underwriter - it's now on file.`,
          read_by_patient: false, read_by_agent: false,
        })
      }
    } else {
      if (!reason?.trim()) return res.status(400).json({ status: 'ERROR', message: 'A decline needs a reason - the agent sees this.' })
      const { data: updated } = await supabase.from('agent_policies').update({
        underwriter_status: 'declined', underwriter_id: underwriterId || null, underwriter_decided_at: nowIso, underwriter_decision_reason: reason.trim(),
      }).eq('id', policyId).eq('underwriter_status', 'pending').select('id')
      if (!updated || updated.length === 0) return res.status(409).json({ status: 'ERROR', message: 'Someone else already decided this case.' })
      await supabase.from('underwriting_audit_log').insert({
        policy_id: policyId, actor_type: actorType, actor_name: underwriterName || null, action: 'policy_declined', detail: reason.trim(),
      })
      if (policy.inquiry_id) {
        await supabase.from('inquiry_messages').insert({
          inquiry_id: policy.inquiry_id, sender_type: 'underwriter', sender_name: underwriterName || 'Underwriter',
          body: `✕ Your policy for ${policy.plan_name} was declined by the underwriter: ${reason.trim()}`,
          read_by_patient: false, read_by_agent: false,
        })
      }
    }
    return res.status(200).json({ status: 'OK' })
  }

  // ── Application / self-declare case (plan_inquiries) ─────────────────────
  const { data: inquiry } = await supabase.from('plan_inquiries').select('id, underwriter_status, mode, plan_id, insurance_plans(company_name, plan_name)').eq('id', inquiryId).maybeSingle()
  if (!inquiry) return res.status(404).json({ status: 'ERROR', message: 'Inquiry not found.' })
  if (inquiry.underwriter_status !== 'pending') return res.status(400).json({ status: 'ERROR', message: 'This case is no longer pending review.' })

  if (action === 'approve') {
    // Same atomic conditional-update guard as the policy branch above.
    const { data: updated } = await supabase.from('plan_inquiries').update({
      underwriter_status: 'approved', underwriter_id: underwriterId || null,
      underwriter_decided_at: nowIso, underwriter_decision_reason: reason || null,
    }).eq('id', inquiryId).eq('underwriter_status', 'pending').select('id')
    if (!updated || updated.length === 0) return res.status(409).json({ status: 'ERROR', message: 'Someone else already decided this case.' })
    await supabase.from('underwriting_audit_log').insert({
      inquiry_id: inquiryId, actor_type: actorType, actor_name: underwriterName || null, action: 'approved', detail: reason || null,
    })
    // Real gap: a self-declare case approved after waiting on review had
    // no prompt telling the patient to come finish buying - they'd only
    // find out by checking back on their own. mode:'agent' never showed a
    // purchase screen in the first place, so this only matters for 'auto'.
    if (inquiry.mode === 'auto') {
      await supabase.from('inquiry_messages').insert({
        inquiry_id: inquiryId, sender_type: 'underwriter', sender_name: underwriterName || 'Underwriter',
        body: `✓ Your application for ${inquiry.insurance_plans?.plan_name || 'this plan'} has been approved - you can now complete your purchase under "My inquiries".`,
        read_by_patient: false, read_by_agent: false,
      })
    }
  } else if (action === 'decline') {
    if (!reason?.trim()) return res.status(400).json({ status: 'ERROR', message: 'A decline needs a reason - the patient sees this.' })
    // Declining after review also flips suitability_verdict, not just
    // underwriter_status - the agent-facing card (aq2-04) reads
    // suitability_verdict to decide what to show, and a case that was
    // 'flagged' needs to actually read 'declined' once decided, the same
    // as a matching-only decline would.
    const { data: updated } = await supabase.from('plan_inquiries').update({
      underwriter_status: 'declined', suitability_verdict: 'declined',
      underwriter_id: underwriterId || null, underwriter_decided_at: nowIso, underwriter_decision_reason: reason.trim(),
    }).eq('id', inquiryId).eq('underwriter_status', 'pending').select('id')
    if (!updated || updated.length === 0) return res.status(409).json({ status: 'ERROR', message: 'Someone else already decided this case.' })
    await supabase.from('underwriting_audit_log').insert({
      inquiry_id: inquiryId, actor_type: actorType, actor_name: underwriterName || null, action: 'declined', detail: reason.trim(),
    })
    // Real gap: a decline used to just dead-end with a generic
    // "declined" screen - the patient's actual next step (talk to a real
    // agent) now happens automatically instead of behind a button they
    // had to notice and tap themselves, same as an automated decline
    // already does in match_plan_suitability.js.
    const companyName = inquiry.insurance_plans?.company_name
    if (companyName) {
      const agent = await assignInquiryToNextAgent(supabase, { inquiryId, companyName })
      if (agent?.email) {
        await sendEmail({
          to: agent.email, subject: `New plan inquiry - ${inquiry.insurance_plans?.plan_name || 'a plan'}`,
          html: `<p>An application the underwriter declined has been assigned to you to help find an alternative.</p><p>Open the agent portal's claimed inquiries to see it.</p>`,
        })
      }
    }
    await supabase.from('inquiry_messages').insert({
      inquiry_id: inquiryId, sender_type: 'underwriter', sender_name: underwriterName || 'Underwriter',
      body: `This application wasn't approved: ${reason.trim()} An agent has been assigned to help you look at other options.`,
      read_by_patient: false, read_by_agent: false,
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
    // Real gap found live-testing: this used to be a one-shot field with
    // no patient-facing surface at all - a patient asked for more detail
    // just saw "Pending" with nothing telling them anything was needed.
    // Seeds the same inquiry_messages thread the agent-mode conversation
    // already uses (PatientInquiryThread/AgentApp.jsx) - same real
    // reply-with-text-or-upload mechanism, not a separate one-way notice.
    // An uploaded file is only ever on file, never auto-validated - an
    // underwriter still reads it and judges it themselves, same as any
    // document a patient hands over in a real application.
    const { error: msgErr } = await supabase.from('inquiry_messages').insert({
      inquiry_id: inquiryId, sender_type: 'underwriter', sender_name: underwriterName || 'Underwriter',
      body: `${reportDoctor?.trim() ? `Requesting a report from ${reportDoctor.trim()}: ` : ''}${reportNote.trim()}`,
      read_by_patient: false, read_by_agent: false,
    })
    // Real bug found live-testing: this insert was failing silently - the
    // table's own check constraint only allowed sender_type 'agent' or
    // 'patient' (now widened), so every request landed in
    // requested_report_note (still shown) but never in the thread itself,
    // and the API kept returning OK regardless since nothing checked the
    // insert's own error.
    if (msgErr) return res.status(500).json({ status: 'ERROR', message: msgErr.message })
  }

  return res.status(200).json({ status: 'OK' })
}
