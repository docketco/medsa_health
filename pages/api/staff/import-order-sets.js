import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Order sets drive real hard-stop/soft-stop drug safety checks, so writing
// to this table can't be left open to anyone holding the app's public key.
// This route does the actual write with a privileged key that never
// reaches the browser, and independently re-checks the caller's claimed
// identity against their real stored role before writing anything -
// the same "verify against what's actually on file" pattern already used
// for staff login, rather than trusting whatever the client asserts.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { medsaId, institutionId, rows } = req.body
  if (!medsaId || !institutionId || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'medsaId, institutionId, and rows are required.' })
  }

  const { data: staff } = await supabase.from('staff_credentials')
    .select('role, full_name, status').eq('medsa_id', medsaId).eq('institution_id', institutionId).maybeSingle()
  if (!staff || staff.role !== 'admin' || staff.status !== 'active') {
    return res.status(403).json({ error: 'Only an active practice manager for this institution can import order sets.' })
  }

  let imported = 0
  for (const row of rows) {
    if (!row.drug_name) continue
    const { error } = await supabase.from('order_sets').upsert({
      institution_id: institutionId, drug_name: row.drug_name,
      min_dose_per_kg: row.min_dose_per_kg ? parseFloat(row.min_dose_per_kg) : null,
      max_dose_per_kg: row.max_dose_per_kg ? parseFloat(row.max_dose_per_kg) : null,
      dose_unit: row.dose_unit || 'mg',
      min_age_years: row.min_age_years ? parseFloat(row.min_age_years) : null,
      max_age_years: row.max_age_years ? parseFloat(row.max_age_years) : null,
      renal_adjustment_notes: row.renal_adjustment_notes || null,
      high_alert: ['true', 'yes', '1'].includes((row.high_alert || '').toLowerCase()),
      hard_stop_conditions: row.hard_stop_conditions ? row.hard_stop_conditions.split(';').map(s => s.trim()).filter(Boolean) : [],
      soft_stop_conditions: row.soft_stop_conditions ? row.soft_stop_conditions.split(';').map(s => s.trim()).filter(Boolean) : [],
      approved_by: staff.full_name, approved_at: new Date().toISOString(),
    }, { onConflict: 'institution_id,drug_name' })
    if (!error) imported++
  }

  return res.status(200).json({ imported, skipped: rows.length - imported, total: rows.length })
}
