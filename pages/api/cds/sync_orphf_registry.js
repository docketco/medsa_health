import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Automated re-sync of the ORPHF Small Practice Clinic registry - this
// dataset is a stable government CSV, not a live API (updated "as and
// when necessary" per data.gov.hk, not daily like the Companies Registry
// one), so full automation here means periodically re-fetching this URL
// rather than a live per-request lookup. Triggered by Vercel Cron (see
// vercel.json) - never requires a person to remember to re-import.
const SOURCE_URL = 'https://www.dh.gov.hk/datagovhk/orphf/SPC_data_for_PSI_20260109.csv'

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''))
  return lines.slice(1).filter(l=>l.trim()).map(line=>{
    const values = (line.match(/(".*?"|[^",]+)(?=,|$)/g)||[]).map(v=>v.trim().replace(/^"|"$/g,''))
    const row = {}
    headers.forEach((h,i)=>row[h]=values[i]||'')
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
    const records = rows.filter(row => row.PHF_num).map(row => ({
      phf_num: row.PHF_num, phf_name: row.PHF_name, phf_address: row.PHF_address,
      phf_category: row.PHF_category, licence_type: row.Licence_type,
      type_practice: row.Type_practice, phone: row.Phone, email: row.Email,
      source_last_update: row.Last_update, imported_at: importedAt,
    }))

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
