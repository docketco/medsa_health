// pages/import-doctors-csv.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Import for CSVs that have BOTH a doctor name and a clinic name column -
// creates a real clinic record AND a real linked doctor record for each
// row, which directory-import.jsx cannot do (it only ever creates clinics).
//
// Built for CSDI's CVS_PrivateDoctorsClinics format specifically, but the
// column matching is flexible enough to handle similarly-shaped files.
//
// Restricted-access rows (university staff-only clinics, verified via
// addresses literally starting with "(For") are shown separately and
// excluded by default, not silently dropped - you can see exactly what's
// being excluded before importing.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
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
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/^\ufeff/, ''))
  return lines.slice(1).map(line => {
    const values = parseLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
}

export default function ImportDoctorsCSVPage() {
  const [fileName, setFileName] = useState(null)
  const [rows, setRows] = useState([])
  const [restrictedRows, setRestrictedRows] = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    const text = await file.text()
    const parsed = parseCSV(text)

    // Verified pattern - every genuine restricted-access row's address
    // literally starts with "(For", checked against the real uploaded
    // data before relying on it (a broader keyword match wrongly caught
    // unrelated clinics with "university" incidentally in their name).
    const isRestricted = (r) => (r.clinic_address_en || r.address || '').trim().startsWith('(For')
    setRows(parsed.filter(r => !isRestricted(r)))
    setRestrictedRows(parsed.filter(isRestricted))
  }

  async function handleImport() {
    setImporting(true)
    setProgress(0)
    let clinicsImported = 0, doctorsImported = 0, skipped = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const clinicName = row.clinic_name_en || row.clinic_name
      const doctorName = row.doctor_name_en || row.doctor_name
      const address = row.clinic_address_en || row.address
      if (!clinicName || !address) { skipped++; setProgress(i+1); continue }

      const { data: clinic, error: clinicErr } = await supabase.from('directory_clinics').upsert({
        partnership_status: 'directory',
        name: clinicName,
        name_tc: row.clinic_name_tc || null,
        address,
        address_tc: row.clinic_address_tc || null,
        district: (row.district_en || '').replace(/ District$/, '') || null,
        contact_phone: row.telephone_en || null,
        ownership_type: 'private',
      }, { onConflict: 'name,address' }).select().maybeSingle()

      if (clinicErr || !clinic) { skipped++; setProgress(i+1); continue }
      clinicsImported++

      if (doctorName) {
        const { error: doctorErr } = await supabase.from('directory_doctors').upsert({
          clinic_id: clinic.id,
          full_name: doctorName,
          full_name_tc: row.doctor_name_tc || null,
          specialties: ['General Practice'],
        }, { onConflict: 'clinic_id,full_name' })
        if (!doctorErr) doctorsImported++
      }
      setProgress(i+1)
    }
    setImporting(false)
    setResult({ clinicsImported, doctorsImported, skipped, total: rows.length })
  }

  return (
    <div style={{background:C.beige,minHeight:'100vh',padding:'24px',maxWidth:560,margin:'0 auto',fontFamily:'system-ui,sans-serif'}}>
      <div style={{fontSize:'20px',fontWeight:700,marginBottom:'4px'}}>Import Doctors + Clinics</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.6}}>
        For CSVs with both a doctor name and a clinic name column - creates a real linked doctor record at each clinic, not just a clinic listing.
      </div>
      <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>Expected columns: doctor_name_en, clinic_name_en, clinic_address_en, district_en, telephone_en (case-insensitive).</div>
        <label style={{display:'block',width:'100%',padding:'12px',border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'13px',color:C.textSub,textAlign:'center',cursor:'pointer',boxSizing:'border-box'}}>
          {fileName || 'Tap to upload CSV'}
          <input type="file" accept=".csv" style={{display:'none'}} onChange={handleFile}/>
        </label>
      </div>

      {restrictedRows.length > 0 && (
        <div style={{background:C.amberLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:C.amber,marginBottom:'6px'}}>{restrictedRows.length} restricted-access rows excluded</div>
          <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>
            Staff/student-only clinics (addresses starting "(For..."), not usable by general patients: {[...new Set(restrictedRows.map(r=>r.clinic_name_en||r.clinic_name))].join(', ')}
          </div>
        </div>
      )}

      {rows.length > 0 && !result && (
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,marginBottom:'8px'}}>{rows.length} importable rows found</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>
            Preview: {rows.slice(0,3).map(r=>`${r.doctor_name_en||'—'} @ ${r.clinic_name_en||'—'}`).join(' · ')}
          </div>
          <button onClick={handleImport} disabled={importing} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
            {importing?`Importing… ${progress}/${rows.length}`:`Import ${rows.length} rows`}
          </button>
        </div>
      )}

      {result && (
        <div style={{background:C.greenLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:600}}>{result.clinicsImported} clinics, {result.doctorsImported} linked doctors, {result.skipped} skipped (of {result.total})</div>
        </div>
      )}
    </div>
  )
}
