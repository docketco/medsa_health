// lib/aiScanQuota.js
// ─────────────────────────────────────────────────────────────────────────────
// Entitlement gate for the patient-facing AI-vision scan features
// (Document Prep's "suggest checklist from this form" OCR, the
// ingredient-label scanner). Originally a 3-free-scans/month cap, then
// simplified to subscriber-only per your own observation: casual,
// one-off use (most people, most of the time) doesn't need AI help -
// the real value is for someone managing multiple people's health or
// a chronic condition, who needs this often enough to be worth paying
// for. No free tier at all now - an active Bump/Guardian subscription
// is the only way in.
// ─────────────────────────────────────────────────────────────────────────────

// Active, non-expired Guardian subscription (checked on this patient's
// own row, or their parent's if they're a dependent riding under it)
// OR a non-graduated Bump pass.
export async function isActiveSubscriber(supabase, patientId) {
  const { data: patient } = await supabase.from('patients').select('id, parent_patient_id, guardian_subscription_active, guardian_subscription_expires_at').eq('id', patientId).maybeSingle()
  if (!patient) return false
  const todayStr = new Date().toISOString().slice(0, 10)
  let guardianOk = !!patient.guardian_subscription_active && (!patient.guardian_subscription_expires_at || patient.guardian_subscription_expires_at >= todayStr)
  if (!guardianOk && patient.parent_patient_id) {
    const { data: parentRow } = await supabase.from('patients').select('guardian_subscription_active, guardian_subscription_expires_at').eq('id', patient.parent_patient_id).maybeSingle()
    guardianOk = !!parentRow?.guardian_subscription_active && (!parentRow?.guardian_subscription_expires_at || parentRow.guardian_subscription_expires_at >= todayStr)
  }
  if (guardianOk) return true
  const { data: bumpRows } = await supabase.from('bump_subscriptions').select('id').eq('patient_id', patientId).is('graduated_at', null).limit(1)
  return !!(bumpRows && bumpRows.length > 0)
}
