// lib/aiScanQuota.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared quota gate for the patient-facing AI-vision scan features
// (Document Prep's "suggest checklist from this form" OCR, the
// ingredient-label scanner) - your call: same treatment for both, a free
// monthly cap, unlimited for an active Bump/Guardian subscriber. Each
// feature's own per-use Anthropic cost is real and ongoing, not a
// one-time build cost, which is exactly why this exists.
// ─────────────────────────────────────────────────────────────────────────────

const FREE_MONTHLY_CAP = 3

// Same entitlement shape as the Health column screen's own check: an
// active, non-expired Guardian subscription (checked on this patient's
// own row, or their parent's if they're a dependent riding under it) OR
// a non-graduated Bump pass.
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

// Checks AND consumes one unit of quota in the same call - a free
// patient's Nth call for a given feature this month either succeeds
// (and counts toward the cap) or is refused before ever calling
// Anthropic, so a refused call never burns real API cost.
export async function checkAndConsumeQuota(supabase, patientId, feature) {
  const subscriber = await isActiveSubscriber(supabase, patientId)
  if (subscriber) return { allowed: true, subscriber: true }

  const period = new Date().toISOString().slice(0, 7) // YYYY-MM
  const { data: row } = await supabase.from('ai_scan_usage').select('*').eq('patient_id', patientId).eq('feature', feature).eq('period', period).maybeSingle()
  const count = row?.count || 0
  if (count >= FREE_MONTHLY_CAP) return { allowed: false, subscriber: false, count, cap: FREE_MONTHLY_CAP }

  if (row) await supabase.from('ai_scan_usage').update({ count: count + 1, updated_at: new Date().toISOString() }).eq('id', row.id)
  else await supabase.from('ai_scan_usage').insert({ patient_id: patientId, feature, period, count: 1 })
  return { allowed: true, subscriber: false, count: count + 1, cap: FREE_MONTHLY_CAP }
}
