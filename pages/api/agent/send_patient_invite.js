// pages/api/agent/send_patient_invite.js
// ─────────────────────────────────────────────────────────────────────────────
// The real nudge, per your call: an agent can write a policy for someone
// who isn't a Medsa patient at all (NewPolicyScreen's own "No match yet -
// you can still type the name in manually" already allows this - writing
// the policy was never gated on having an account). This is the other
// half: once saved, offer to send that client a plain link to sign up and
// see their policy, instead of leaving it as something only the agent
// can see. Deliberately lightweight - this does NOT try to auto-link the
// new account back to the policy (that needs a real match step, e.g. by
// phone/HKID, once the client actually signs up - a bigger feature, not
// this one). Reuses lib/email.js, so it no-ops with a clear reason when
// RESEND_API_KEY isn't configured, same as every other email in this app.
// ─────────────────────────────────────────────────────────────────────────────

import { sendEmail } from '../../../lib/email'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { email, patientName, planName, agentName } = req.body || {}
  if (!email?.trim()) return res.status(400).json({ status: 'ERROR', message: 'An email address is required.' })

  const result = await sendEmail({
    to: email.trim(),
    subject: `${agentName || 'Your agent'} set up a Medsa policy for you`,
    html: `<p>Hi${patientName ? ` ${patientName}` : ''},</p><p>${agentName || 'Your agent'} has written${planName ? ` a ${planName} policy` : ' a policy'} for you on Medsa.</p><p>Sign up for a free Medsa account to track it, message your agent, and submit claims: <a href="https://www.medsa.health">www.medsa.health</a></p>`,
  })
  if (!result.sent) return res.status(200).json({ status: 'OK', sent: false, reason: result.reason })
  return res.status(200).json({ status: 'OK', sent: true })
}
