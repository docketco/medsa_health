import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Same idea as sync_orphf_registry.js, for the other half of the Cap. 633
// registry - this file is a single combined export covering Hospitals,
// Day Procedure Centres, and Scheduled Nursing Homes together (confirmed
// from a real download: 285 rows, phone+email present for all of them).
//
// URL inferred from the same dh.gov.hk/datagovhk/orphf/ hosting pattern
// used by the already-working Small Practice Clinic sync, using the exact
// filename of the file that was manually downloaded and verified. If the
// government renames this file on their next update, this fetch will fail
// with a clear error (not silently) - see the try/catch below.
const SOURCE_URL = 'https://www.dh.gov.hk/datagovhk/orphf/PH_Cap.633_20251217_eng.csv'

// Same proven character-by-character parser used in directory-import.jsx
// and sync_orphf_registry.js.
function parseCSV(text) {
  const lines = text.trim().split('\n')
  function parseLine(line) {
    const fields = []
    let cur = '', inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQuotes = !inQuotes }
      else if (c === ',' && !inQuotes) { fields.push(cur); cur = '' }
      else { cur += c }
    }
    fields.push(cur)
    return fields.map(f => f.trim())
  }
  const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, '').replace(/^﻿/, ''))
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = (values[i] || '').replace(/^"|"$/g, '') })
    return row
  })
}

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const csvRes = await fetch(SOURCE_URL)
    if (!csvRes.ok) throw new Error(`Source fetch failed: ${csvRes.status} ${csvRes.statusText}`)
    const csvText = await csvRes.text()
    const rows = parseCSV(csvText)

    const importedAt = new Date().toISOString()
    const recordsByPhfNum = new Map()
    for (const row of rows) {
      if (!row.PHF_num) continue
      recordsByPhfNum.set(row.PHF_num, {
        phf_num: row.PHF_num, phf_name: row.PHF_name, phf_address: row.PHF_address,
        phf_category: row.PHF_category, licence_type: row.Licence_type,
        type_practice: row.Type_practice, phone: row.Phone, email: row.Email,
        imported_at: importedAt,
      })
    }
    const records = [...recordsByPhfNum.values()]

    const { error: clearError } = await supabase.from('hk_licensed_facilities').delete().neq('phf_num', '__never_matches__')
    if (clearError) throw clearError

    const BATCH_SIZE = 500
    let upserted = 0
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('hk_licensed_facilities').upsert(batch, { onConflict: 'phf_num' })
      if (error) throw error
      upserted += batch.length
    }

    return res.status(200).json({ status: 'OK', rowsProcessed: rows.length, upserted, syncedAt: importedAt })
  } catch (e) {
    return res.status(500).json({ status: 'ERROR', message: e.message })
  }
}
