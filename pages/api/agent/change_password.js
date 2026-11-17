// pages/api/agent/change_password.js
// ─────────────────────────────────────────────────────────────────────────────
// Server-side password write, same pattern as onboard.js/self_signup.js's
// own set_agent_password calls - the agent portal never calls that RPC
// directly from the browser for any password write. Used by AgentLogin's
// forced-change screen (must_change_password) and could be reused for a
// real "change my password" settings screen later, if one gets built.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { agentId, currentPassword, newPassword } = req.body || {}
  if (!agentId || !currentPassword || !newPassword) {
    return res.status(400).json({ status: 'ERROR', message: 'agentId, currentPassword, and newPassword are required.' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ status: 'ERROR', message: 'New password must be at least 8 characters.' })
  }

  const { data: ok } = await supabase.rpc('verify_agent_password', { p_agent_id: agentId, p_password: currentPassword })
  if (!ok) return res.status(400).json({ status: 'ERROR', message: 'Current password is incorrect.' })

  const { error: pwErr } = await supabase.rpc('set_agent_password', { p_agent_id: agentId, p_new_password: newPassword })
  if (pwErr) return res.status(500).json({ status: 'ERROR', message: pwErr.message })

  await supabase.from('agents').update({ must_change_password: false }).eq('id', agentId)
  return res.status(200).json({ status: 'OK' })
}
