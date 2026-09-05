// Thin wrapper for SMS - server-side only. No SMS provider is actually
// connected yet (this would be Twilio or similar), so every call below
// is a safe no-op that reports back, same contract as lib/email.js.
// Wiring in a real provider later is a drop-in change here - nothing
// that calls sendSms needs to change.
export async function sendSms({ to, body }) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) {
    return { sent: false, reason: 'SMS sending is not configured yet (no SMS provider connected).' }
  }
  try {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    await twilio.messages.create({ to, from: process.env.TWILIO_FROM_NUMBER, body })
    return { sent: true }
  } catch (e) {
    return { sent: false, reason: e.message }
  }
}
