// lib/agentAssignment.js
// ─────────────────────────────────────────────────────────────────────────────
// Round-robin lead routing. Replaces the old model (every eligible agent
// sees a shared "Unclaimed" pool and races to tap Claim first) with real
// push assignment - whoever's gone longest without a new lead gets this
// one, not whoever happened to refresh fastest.
//
// The cold-start problem with round robin: on day one (or the moment a
// new agent is appointed), every eligible agent ties on "never assigned."
// Resolved in the query itself, not a separate shuffle step: order by
// last_assigned_at ASC NULLS FIRST (a never-assigned agent always goes
// ahead of one with real history - correct, not just convenient), then
// random() as the tiebreaker. The tiebreak only ever matters within an
// exactly-tied group, so the first lead goes to a random agent among
// everyone tied for "most overdue," the second lead goes to a random
// agent among whoever's still tied after that, and so on until there are
// no more ties left to break - at which point it's pure round robin.
// ─────────────────────────────────────────────────────────────────────────────

// Eligibility mirrors PlanInquiriesScreen's own company-name scoping in
// components/agent/AgentApp.jsx: a captive agent is eligible for their
// one employer's plans; an independent agent is eligible for whichever
// insurers they hold an active appointment with.
async function eligibleAgentIds(supabase, companyName, excludeAgentIds) {
  const { data: institution } = await supabase.from('institutions').select('id').eq('name', companyName).maybeSingle()
  if (!institution) return []

  const { data: captive } = await supabase.from('agents').select('id')
    .eq('agent_type', 'captive').eq('institution_id', institution.id)
  const { data: appts } = await supabase.from('agent_institution_appointments')
    .select('agent_id').eq('institution_id', institution.id).eq('status', 'active')

  const ids = new Set([...(captive || []).map(a => a.id), ...(appts || []).map(a => a.agent_id)])
  for (const id of (excludeAgentIds || [])) ids.delete(id)
  return [...ids]
}

// Pure sort, no I/O - the actual round-robin rule, kept separate from
// the Supabase plumbing around it so it's unit-testable on its own (see
// lib/agentAssignment.test.js). NULLS FIRST, then a random tiebreak
// within whichever group (null, or a shared timestamp) ties for "most
// overdue" - see the file header for why that's the right rule, not
// just a convenient one.
export function rankAgentsForAssignment(candidates) {
  return [...candidates].sort((a, b) => {
    if (!a.last_assigned_at && !b.last_assigned_at) return Math.random() - 0.5
    if (!a.last_assigned_at) return -1
    if (!b.last_assigned_at) return 1
    const diff = new Date(a.last_assigned_at) - new Date(b.last_assigned_at)
    return diff !== 0 ? diff : Math.random() - 0.5
  })
}

// Picks the next agent in the rotation for companyName, excluding
// excludeAgentIds (the current holder, on a reassignment). Returns the
// agent row ({id, email, full_name}) or null if nobody's eligible.
export async function pickNextAgent(supabase, companyName, excludeAgentIds = []) {
  const ids = await eligibleAgentIds(supabase, companyName, excludeAgentIds)
  if (ids.length === 0) return null

  const { data: candidates } = await supabase.from('agents')
    .select('id, email, full_name, last_assigned_at').in('id', ids)
  if (!candidates || candidates.length === 0) return null

  return rankAgentsForAssignment(candidates)[0]
}

// Assigns inquiryId to the next agent in companyName's rotation (per
// pickNextAgent above), stamping response_due_at responseWindowHours out
// so the reassignment cron (api/cron/reassign_stale_plan_inquiries.js)
// knows when to give up waiting. Returns the assigned agent, or null if
// nobody was eligible (the inquiry is left unassigned either way).
export async function assignInquiryToNextAgent(supabase, { inquiryId, companyName, excludeAgentIds = [], responseWindowHours = 48 }) {
  const agent = await pickNextAgent(supabase, companyName, excludeAgentIds)
  if (!agent) return null

  const now = new Date()
  const dueAt = new Date(now.getTime() + responseWindowHours * 3600 * 1000).toISOString()
  await supabase.from('plan_inquiries').update({
    claimed_by_agent_id: agent.id, claimed_at: now.toISOString(), response_due_at: dueAt,
  }).eq('id', inquiryId)
  await supabase.from('agents').update({ last_assigned_at: now.toISOString() }).eq('id', agent.id)
  return agent
}
