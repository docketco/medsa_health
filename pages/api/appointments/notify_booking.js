// Real appointment-confirmation email - respects the patient's own
// notification toggle (checked client-side before this is ever
// called). Same safe-no-op pattern as every other email in this app:
// nothing breaks if RESEND_API_KEY isn't configured yet.
import { sendEmail } from '../../../lib/email'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { email, patientName, doctorName, scheduledAt } = req.body || {}
  if (!email) return res.status(400).json({ error: 'email required' })

  const when = scheduledAt ? new Date(scheduledAt).toLocaleString('en-HK', { dateStyle: 'full', timeStyle: 'short' }) : ''
  const result = await sendEmail({
    to: email,
    subject: 'Medsa Health - appointment confirmed',
    html: `<p>Hi ${patientName || 'there'},</p><p>Your appointment with ${doctorName || 'your doctor'} is confirmed for:</p><p style="font-size:16px;font-weight:700">${when}</p><p>You can manage this booking any time in the Medsa app.</p><p>- Medsa Health</p>`,
  })
  return res.status(200).json(result)
}
