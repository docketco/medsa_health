import { supabase } from './supabase'

// A patient's Medsa QR is one code, read two different ways depending on
// who/what scans it - not two separate codes. A plain phone camera opens
// it as a URL (/emergency?t=<token>) and lands on the public Emergency
// Card page. Medsa's own in-app QrScanner (ClinicOps, /share,
// /referral-portal) reads the same text but pulls the token back out and
// resolves it straight to the real patient instead of following the
// link - this is that second path. Falls back to treating the scanned
// text as a raw medsa_id, for any code that predates this.
export function extractScannedToken(qrData) {
  if (!qrData) return null
  const match = String(qrData).match(/[?&]t=([^&]+)/)
  return match ? decodeURIComponent(match[1]) : String(qrData).trim()
}

export async function resolveScannedPatient(qrData, selectCols = 'id, full_name, medsa_id') {
  const value = extractScannedToken(qrData)
  if (!value) return null
  const { data } = await supabase.from('patients').select(selectCols)
    .or(`medsa_id.eq.${value},emergency_card_token.eq.${value}`)
    .maybeSingle()
  return data
}
