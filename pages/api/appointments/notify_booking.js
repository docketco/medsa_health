// Real appointment-confirmation email + SMS - respects the patient's own
// notification toggles (checked client-side before this is ever
// called). Same safe-no-op pattern as every other email/SMS in this app:
// nothing breaks if RESEND_API_KEY/an SMS provider isn't configured yet.
import { sendEmail } from '../../../lib/email'
import { sendSms } from '../../../lib/sms'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { email, phone, patientName, doctorName, scheduledAt } = req.body || {}
  if (!email && !phone) return res.status(400).json({ error: 'email or phone required' })

  const when = scheduledAt ? new Date(scheduledAt).toLocaleString('en-HK', { dateStyle: 'full', timeStyle: 'short' }) : ''
  const [emailResult, smsResult] = await Promise.all([
    email ? sendEmail({
      to: email,
      subject: 'Medsa Health - appointment confirmed',
      html: `<p>Hi ${patientName || 'there'},</p><p>Your appointment with ${doctorName || 'your doctor'} is confirmed for:</p><p style="font-size:16px;font-weight:700">${when}</p><p>You can manage this booking any time in the Medsa app.</p><p>- Medsa Health</p>`,
    }) : Promise.resolve(null),
    phone ? sendSms({
      to: phone,
      body: `Medsa: Your appointment with ${doctorName || 'your doctor'} is confirmed for ${when}. Manage it any time in the Medsa app.`,
    }) : Promise.resolve(null),
  ])
  return res.status(200).json({ email: emailResult, sms: smsResult })
}
