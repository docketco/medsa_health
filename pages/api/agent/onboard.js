// pages/api/agent/onboard.js
// ─────────────────────────────────────────────────────────────────────────────
// Institution- or team-driven agent onboarding ("onboard/offboard
// agent/team" from the institution and team portals) - not self-serve.
// Two real outcomes:
//   - email matches an existing agent: this is an *appointment* - the
//     agent already has a login, just gets a new
//     agent_institution_appointments row (optionally under this team).
//     Real-world case: an independent agent who already works with
//     other insurers getting appointed by one more.
//   - no match: a brand new agent account is created (medsa_id, temp
//     password emailed - same pattern as every other onboarding flow
//     this session), plus its appointment row.
// License verification: there's no real HK agent-license registry to
// check against (unlike clinics' BR/ORPHF checks) - license_number is
// recorded as declared, not verified, same posture as before this
// change. Nothing to build there until a real registry exists.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '../../../lib/email'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function generateMedsaId(prefix) {
  return `${prefix}-${Math.floor(10000 + Math.random() * 89999)}-HK`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { fullName, email, phone, licenseNumber, agentType, institutionId, teamId } = req.body || {}
  if (!email?.trim() || !institutionId) {
    return res.status(400).json({ status: 'ERROR', message: 'email and institutionId are required.' })
  }

  // institutionId here is institutions.id (institution_type='insurer') -
  // the same table agents.institution_id/agent_policies.institution_id
  // already point at, not insurance_companies.id. The caller (the
  // institution/team portal) resolves company.institutionRefId first.
  const { data: institution } = await supabase.from('institutions').select('id, name').eq('id', institutionId).maybeSingle()
  if (!institution) return res.status(404).json({ status: 'ERROR', message: 'Institution not found.' })

  const { data: existing } = await supabase.from('agents').select('id, full_name, email').ilike('email', email.trim()).maybeSingle()

  let agentId, isNew, tempPassword = null
  if (existing) {
    agentId = existing.id
    isNew = false
  } else {
    if (!fullName?.trim()) return res.status(400).json({ status: 'ERROR', message: 'fullName is required for a new agent.' })
    // Real gap: license_number was accepted but never required, even
    // though it's the one credential this record exists to carry -
    // enforced here (not just a disabled button client-side) so the bulk
    // CSV path can't slip a licenseless agent through either.
    if (!licenseNumber?.trim()) return res.status(400).json({ status: 'ERROR', message: 'licenseNumber is required for a new agent.' })
    const { data: created, error: insErr } = await supabase.from('agents').insert({
      full_name: fullName.trim(), email: email.trim(), phone: phone?.trim() || null,
      license_number: licenseNumber?.trim() || null,
      agent_type: agentType === 'independent' ? 'independent' : 'captive',
      institution_id: agentType === 'independent' ? null : institutionId,
      team_id: teamId || null,
      medsa_id: generateMedsaId('AGT'),
    }).select().maybeSingle()
    if (insErr) return res.status(500).json({ status: 'ERROR', message: insErr.message })
    agentId = created.id
    isNew = true
    tempPassword = `Temp${Math.floor(1000 + Math.random() * 9000)}!`
    const { error: pwErr } = await supabase.rpc('set_agent_password', { p_agent_id: agentId, p_new_password: tempPassword })
    if (pwErr) return res.status(500).json({ status: 'ERROR', message: `Agent created but password could not be set: ${pwErr.message}` })
  }

  const { error: apptErr } = await supabase.from('agent_institution_appointments')
    .upsert({ agent_id: agentId, institution_id: institutionId, team_id: teamId || null, status: 'active' }, { onConflict: 'agent_id,institution_id' })
  if (apptErr) return res.status(500).json({ status: 'ERROR', message: apptErr.message })

  // Real bug found live-testing: agents.team_id was only ever set once,
  // at creation - moving an existing agent to a different team here
  // updated the appointment (the source the Team screen's own roster
  // reads from) but left this denormalized copy stale, silently
  // disagreeing with the appointment for as long as the agent stayed
  // put after that first move. Anything reading agent.team_id directly
  // (basket loading, team-gating checks, transfer-recipient pickers)
  // kept using the old team. Kept in sync here instead of removed
  // outright, since it's read in many places as a quick agent.team_id
  // rather than joining the appointment every time.
  if (existing) {
    await supabase.from('agents').update({ team_id: teamId || null }).eq('id', agentId)
  }

  let emailResult = { sent: false, reason: 'Existing agent - no new credentials to send.' }
  if (isNew) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medsa.health'
    emailResult = await sendEmail({
      to: email.trim(),
      subject: `Medsa Health - your Agent Portal login (${institution.name})`,
      html: `<p>Hi ${fullName.trim()},</p><p>You've been onboarded as an agent for ${institution.name} on Medsa.</p><p>Sign in at <a href="${siteUrl}/agent-portal">${siteUrl}/agent-portal</a> with:</p><p>Email: ${email.trim()}<br/>Temporary password: <strong>${tempPassword}</strong></p><p>Please change this password once you're in.</p>`,
    })
  }

  return res.status(200).json({ status: 'OK', isNew, agentId, tempPassword, emailSent: emailResult.sent, emailReason: emailResult.reason })
}
