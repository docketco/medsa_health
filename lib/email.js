// Thin wrapper around Resend - server-side only (uses RESEND_API_KEY,
// never exposed to the browser). No key configured yet means every
// call below is a safe no-op that reports back so the caller can keep
// using its existing on-screen fallback (devOnlyCode, on-screen
// payment link, etc) instead of crashing or pretending it sent.
import { Resend } from 'resend'

export async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: 'Email sending is not configured yet (no RESEND_API_KEY).' }
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Medsa Health <noreply@medsa.health>',
      to, subject, html,
    })
    if (error) return { sent: false, reason: error.message || String(error) }
    return { sent: true }
  } catch (e) {
    return { sent: false, reason: e.message }
  }
}
