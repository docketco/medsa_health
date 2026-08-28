// Fires right after a sponsor submits at /sponsor-submit - a real
// confirmation email if RESEND_API_KEY is configured, otherwise a
// harmless no-op (the on-screen "submitted" confirmation already
// covers that case, this is additive, not required for the submission
// itself to succeed).
import { sendEmail } from '../../../lib/email'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { sponsorEmail, sponsorName, title } = req.body || {}
  if (!sponsorEmail) return res.status(400).json({ error: 'sponsorEmail required' })

  const result = await sendEmail({
    to: sponsorEmail,
    subject: 'Medsa Health - we received your submission',
    html: `<p>Hi ${sponsorName || 'there'},</p><p>Thanks for submitting "${title || 'your item'}" to Medsa Health. Our team will review it shortly and reach out if it's approved (and if payment is required for a sponsored slot).</p><p>- Medsa Health</p>`,
  })
  return res.status(200).json(result)
}
