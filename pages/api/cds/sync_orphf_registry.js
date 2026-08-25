import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Automated re-sync of the ORPHF Small Practice Clinic registry - this
// dataset is a stable government CSV, not a live API (updated "as and
// when necessary" per data.gov.hk, not daily like the Companies Registry
// one), so full automation here means periodically re-fetching this URL
// rather than a live per-request lookup. Triggered by Vercel Cron (see
// vercel.json) - never requires a person to remember to re-import.
const SOURCE_URL = 'https://www.dh.gov.hk/datagovhk/orphf/SPC_data_for_PSI_20260109.csv'

// Same proven character-by-character parser already used in
// directory-import.jsx - the regex this used to use (`[^",]+`, one or
// more characters) silently drops empty fields instead of producing an
// empty string for them, which shifts every column after a blank field
// one position to the left for that row. That's how a phone number
// ended up readable back as a phf_num: a blank category/licence-type
// field earlier in a real government row shifted everything after it.
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
  const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, ''))
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = (values[i] || '').replace(/^"|"$/g, '') })
    return row
  })
}

export default async function handler(req, res) {
  // Vercel Cron sends a real, verifiable secret header - reject anything
  // else so this endpoint can't be triggered by an outside request.
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const csvRes = await fetch(SOURCE_URL)
    const csvText = await csvRes.text()
    const rows = parseCSV(csvText)

    const importedAt = new Date().toISOString()
    // De-duplicated by phf_num - the source CSV has the same clinic
    // listed more than once in places, and a single upsert statement
    // can't apply "DO UPDATE" to the same conflict key twice. Later
    // rows win, same as if they'd been upserted one at a time in order.
    const recordsByPhfNum = new Map()
    for (const row of rows) {
      if (!row.PHF_num) continue
      recordsByPhfNum.set(row.PHF_num, {
        phf_num: row.PHF_num, phf_name: row.PHF_name, phf_address: row.PHF_address,
        phf_category: row.PHF_category, licence_type: row.Licence_type,
        type_practice: row.Type_practice, phone: row.Phone, email: row.Email,
        source_last_update: row.Last_update, imported_at: importedAt,
      })
    }
    const records = [...recordsByPhfNum.values()]

    // Wipe the table before repopulating - it's a pure mirror of the
    // external CSV, not a table anything appends to independently, so
    // there's nothing to lose. This also clears out rows corrupted by
    // the parsing bug above from any earlier sync run, rather than
    // leaving them sitting alongside the now-correct data.
    const { error: clearError } = await supabase.from('hk_small_practice_clinics').delete().neq('phf_num', '__never_matches__')
    if (clearError) throw clearError

    // Batched, not one row at a time - a few hundred sequential round
    // trips to the database was blowing past Vercel's function timeout
    // before the sync could ever finish. A batch of 500 per upsert call
    // stays well under Supabase's request size limits while cutting the
    // round trips from one-per-clinic to one-per-500-clinics.
    const BATCH_SIZE = 500
    let upserted = 0
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('hk_small_practice_clinics').upsert(batch, { onConflict: 'phf_num' })
      if (error) throw error
      upserted += batch.length
    }

    return res.status(200).json({ status: 'OK', rowsProcessed: rows.length, upserted, syncedAt: importedAt })
  } catch (e) {
    return res.status(500).json({ status: 'ERROR', message: e.message })
  }
}
