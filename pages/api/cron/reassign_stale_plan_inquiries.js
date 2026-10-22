// pages/api/cron/reassign_stale_plan_inquiries.js
// ─────────────────────────────────────────────────────────────────────────────
// Once daily (10am HKT) - the account this runs on is on Vercel's Hobby
// plan, which rejects any cron scheduled more than once a day at deploy
// time (this is what silently broke every production deploy from PR
// #342 onward until Oct 22, when the user's live testing surfaced it -
// see vercel.json's own history). Originally every 6 hours; once-daily
// is a real degradation (an overdue inquiry can now sit up to ~24h
// before reassignment instead of ~6h) but not a functional break - the
// other half of round-robin lead routing (see
// lib/agentAssignment.js and match_plan_suitability.js's assignment call
// at creation): an agent who's gone quiet on an assigned lead shouldn't
// just sit on it forever - "responded" means they actually sent a
// message on the thread, not just that time passed, so this moves the
// lead to the next agent in the rotation instead.
//
// Never bounces back to an agent who's already had a crack at this
// exact inquiry (reassigned_agent_ids, appended each hop) - if nobody
// else is eligible, it's left with whoever has it rather than cycling
// forever between the same two agents.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { assignInquiryToNextAgent } from '../../../lib/agentAssignment'
import { sendEmail } from '../../../lib/email'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data: overdue } = await supabase.from('plan_inquiries')
    .select('id, claimed_by_agent_id, reassigned_agent_ids, insurance_plans(plan_name, company_name)')
    .eq('mode', 'agent').eq('status', 'new').not('claimed_by_agent_id', 'is', null)
    .lt('response_due_at', new Date().toISOString())
  if (!overdue || overdue.length === 0) return res.status(200).json({ status: 'OK', checked: 0, reassigned: 0 })

  let reassigned = 0
  for (const inq of overdue) {
    const { count: messagesFromAgent } = await supabase.from('inquiry_messages')
      .select('id', { count: 'exact', head: true }).eq('inquiry_id', inq.id).eq('sender_type', 'agent')
    if ((messagesFromAgent || 0) > 0) continue // the agent did respond - just hasn't converted/closed it yet, not stale

    const companyName = inq.insurance_plans?.company_name
    if (!companyName) continue
    const triedAgentIds = [...(inq.reassigned_agent_ids || []), inq.claimed_by_agent_id]
    const newAgent = await assignInquiryToNextAgent(supabase, {
      inquiryId: inq.id, companyName, excludeAgentIds: triedAgentIds,
    })
    if (!newAgent) continue // nobody else eligible - leave it with the current agent rather than loop

    await supabase.from('plan_inquiries').update({ reassigned_agent_ids: triedAgentIds }).eq('id', inq.id)
    reassigned++
    if (newAgent.email) {
      await sendEmail({
        to: newAgent.email, subject: `Plan inquiry reassigned to you - ${inq.insurance_plans?.plan_name || ''}`,
        html: `<p>A plan inquiry for <strong>${inq.insurance_plans?.plan_name || 'a plan'}</strong> went unanswered too long with its previous agent and has been reassigned to you.</p><p>Open the agent portal's New Plan Inquiries tab to see it.</p>`,
      })
    }
  }

  return res.status(200).json({ status: 'OK', checked: overdue.length, reassigned })
}
