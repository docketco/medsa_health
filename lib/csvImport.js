// lib/csvImport.js
// ─────────────────────────────────────────────────────────────────────────────
// Parses a clinic's exported CSV and maps rows into Medsa's Supabase tables.
// This is the "no extra work" bridge — clinics export what they already can,
// Medsa does the mapping and insertion.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// Expected CSV columns (flexible — clinic can export with these headers in any order):
// patient_medsa_id OR patient_hkid OR patient_name + patient_dob (for matching)
// record_type (visit | lab | imaging | vaccination | procedure)
// title
// department
// notes
// diagnosis
// date_of_record (YYYY-MM-DD)
// institution_name

export function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    // Simple CSV split — handles quoted fields with commas inside
    const values = lines[i].match(/(".*?"|[^",]+)(?=,|$)/g) || []
    const cleaned = values.map(v => v.trim().replace(/^"|"$/g, ''))
    const row = {}
    headers.forEach((h, idx) => { row[h] = cleaned[idx] || '' })
    rows.push(row)
  }
  return { headers, rows }
}

// Matches a CSV row to an existing Medsa patient by Medsa ID, HKID, or name+DOB
async function findPatient(row) {
  if (row.patient_medsa_id) {
    const { data } = await supabase.from('patients').select('id').eq('medsa_id', row.patient_medsa_id).single()
    if (data) return data.id
  }
  if (row.patient_hkid) {
    const { data } = await supabase.from('patients').select('id').eq('hkid', row.patient_hkid).single()
    if (data) return data.id
  }
  if (row.patient_name && row.patient_dob) {
    const { data } = await supabase.from('patients').select('id').eq('full_name', row.patient_name).eq('date_of_birth', row.patient_dob).single()
    if (data) return data.id
  }
  return null
}

// Finds or creates an institution by name so records link correctly
async function findOrCreateInstitution(name) {
  if (!name) return null
  const { data: existing } = await supabase.from('institutions').select('id').eq('name', name).single()
  if (existing) return existing.id
  const { data: created } = await supabase.from('institutions').insert({ name, type: 'clinic', medsa_partner: false }).select('id').single()
  return created?.id || null
}

// Main import function — takes parsed rows, returns a results summary
export async function importRecords(rows) {
  const results = { total: rows.length, imported: 0, skipped: 0, errors: [] }

  for (const row of rows) {
    try {
      const patientId = await findPatient(row)
      if (!patientId) {
        results.skipped++
        results.errors.push(`Row skipped — patient not found: ${row.patient_name || row.patient_medsa_id || row.patient_hkid || 'unknown'}`)
        continue
      }

      const institutionId = await findOrCreateInstitution(row.institution_name)

      const { error } = await supabase.from('medical_records').insert({
        patient_id: patientId,
        institution_id: institutionId,
        record_type: row.record_type || 'visit',
        title: row.title || 'Imported record',
        department: row.department || null,
        notes: row.notes || null,
        diagnosis: row.diagnosis || null,
        date_of_record: row.date_of_record || new Date().toISOString().slice(0, 10),
        source: 'csv_import',
      })

      if (error) {
        results.errors.push(`Row failed: ${row.title || 'unknown'} — ${error.message}`)
      } else {
        results.imported++
      }
    } catch (e) {
      results.errors.push(`Row error: ${e.message}`)
    }
  }

  return results
}
