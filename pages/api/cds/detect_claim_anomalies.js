import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Internal version of the pattern real HK insurers run through the HKFI's
// shared IFPCD database - "does the same provider suddenly show an
// implausible number of different patients in a short window". We can't
// join that actual cross-company database (that's a licensed-insurer
// consortium), but the underlying signal doesn't need outside data - it's
// visible in our own consultation and claims records. Runs daily, not
// live-blocking - this only ever adds a flag for staff to review, it never
// stops a record from being saved (same "record always exists, only
// claim-eligibility gets gated" rule used everywhere else in this app).
//
// Reads from medical_records (the consultation system) rather than only
// insurance_claims, so a volume spike gets caught even before any claim is
// filed on the back of it.

const DAILY_PATIENT_THRESHOLD = 25

function yesterday() {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const windowDate = yesterday()
    const { data: records, error } = await supabase.from('medical_records')
      .select('id, patient_id, doctor_name, institution_id, institution_source, date_of_record')
      .eq('date_of_record', windowDate)
    if (error) throw error

    // Group by the practitioner identity we actually have on this table -
    // doctor_name (free text) plus whichever institution field is set, not
    // a clean practitioner_id FK (medical_records doesn't consistently
    // carry one across every screen that writes to it).
    const byDoctor = new Map()
    for (const r of records || []) {
      if (!r.doctor_name) continue
      const key = r.doctor_name
      if (!byDoctor.has(key)) byDoctor.set(key, { patientIds: new Set(), recordIds: [], institutionId: r.institution_id, institutionSource: r.institution_source })
      const entry = byDoctor.get(key)
      entry.patientIds.add(r.patient_id)
      entry.recordIds.push(r.id)
    }

    let flagged = 0
    for (const [doctorName, entry] of byDoctor.entries()) {
      const distinctCount = entry.patientIds.size
      if (distinctCount <= DAILY_PATIENT_THRESHOLD) continue

      const { data: existingFlag } = await supabase.from('claim_anomaly_flags')
        .select('id').eq('flag_type', 'practitioner_daily_volume_spike')
        .eq('doctor_name', doctorName).eq('window_date', windowDate).eq('status', 'active').maybeSingle()
      if (existingFlag) continue

      await supabase.from('claim_anomaly_flags').insert({
        flag_type: 'practitioner_daily_volume_spike', doctor_name: doctorName,
        institution_id: entry.institutionId || null, institution_source: entry.institutionSource || null,
        window_date: windowDate, distinct_patient_count: distinctCount, threshold: DAILY_PATIENT_THRESHOLD,
        related_record_ids: entry.recordIds,
        detail: `${doctorName} has ${distinctCount} distinct patients recorded on ${windowDate}, above the ${DAILY_PATIENT_THRESHOLD}/day review threshold.`,
      })
      flagged++
    }

    return res.status(200).json({ status: 'OK', windowDate, doctorsScanned: byDoctor.size, flagged })
  } catch (e) {
    return res.status(500).json({ status: 'ERROR', message: e.message })
  }
}
