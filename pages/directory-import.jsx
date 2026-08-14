// pages/directory-import.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable CSV import for the Find Care directory_clinics table. Handles
// data.gov.hk CSVs directly, or any XLSX converted to CSV first (XLSX can't
// be fetched/parsed programmatically from outside the browser - convert via
// Excel/Google Sheets "Save As CSV" first).
//
// Expected columns (case-insensitive, any order): name, address, district,
// phone, email, hours, latitude, longitude. Missing columns are just left
// blank - only "name" is required.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  green:'#4a7c59', greenLight:'#e8f2ea', beige:'#f0ede8', cream:'#faf8f5',
  text:'#1a1a1a', textSub:'#6b6560', textMuted:'#9c9690', border:'#e5e0d8',
  red:'#c0392b', redLight:'#fbeae8',
}

// Same real CSV parser pattern already proven in Clinic Ops' inventory
// import - handles quoted fields with embedded commas correctly.
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
  const headers = parseLine(lines[0]).map(h => h.toLowerCase())
  return lines.slice(1).map(line => {
    const values = parseLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
}

const DISTRICTS = ['Central','Sheung Wan','Sai Ying Pun','Wan Chai','Causeway Bay','Aberdeen',
  'Yau Ma Tei','Mong Kok','Sham Shui Po','Ho Man Tin','San Po Kong','Kwun Tong','Ngau Tau Kok',
  'Tsz Wan Shan','Hung Hom','Tsuen Wan','Cheung Chau','Sha Tin','Tai Wai','Sheung Shui','Tai Po',
  'Tuen Mun','Yuen Long','Shau Kei Wan','Kowloon City','Wong Tai Sin','Kwai Tsing','Tin Shui Wai',
  'North Point','Quarry Bay','Tai Koo','Mid-Levels','Stanley','Repulse Bay']

function guessDistrict(address) {
  if (!address) return null
  for (const d of DISTRICTS) if (address.includes(d)) return d
  return null
}

export default function DirectoryImportPage() {
  const [fileName, setFileName] = useState(null)
  const [rows, setRows] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [claims, setClaims] = useState([])
  const [claimsLoading, setClaimsLoading] = useState(true)
  const [processingClaim, setProcessingClaim] = useState(null)

  async function loadClaims() {
    setClaimsLoading(true)
    const { data } = await supabase.from('clinic_claim_requests').select('*, directory_clinics(*)')
      .eq('status', 'pending').order('created_at', {ascending:false})
    setClaims(data||[])
    setClaimsLoading(false)
  }
  useEffect(() => { loadClaims() }, [])

  // Real approval - this is what actually flips partnership_status to
  // medsa_partnered, not just marking the claim record itself as approved.
  async function handleApproveClaim(claim) {
    setProcessingClaim(claim.id)
    await supabase.from('directory_clinics').update({
      partnership_status: 'medsa_partnered',
      institution_source: 'clinic_ops', // real institution linkage - adjust if this clinic maps elsewhere
    }).eq('id', claim.clinic_id)
    await supabase.from('clinic_claim_requests').update({
      status: 'approved', reviewed_at: new Date().toISOString(),
    }).eq('id', claim.id)
    setProcessingClaim(null)
    loadClaims()
  }

  async function handleRejectClaim(claim) {
    setProcessingClaim(claim.id)
    await supabase.from('clinic_claim_requests').update({
      status: 'rejected', reviewed_at: new Date().toISOString(),
    }).eq('id', claim.id)
    setProcessingClaim(null)
    loadClaims()
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    const text = await file.text()
    setRows(parseCSV(text))
  }

  async function handleImport() {
    setImporting(true)
    let imported = 0, skipped = 0
    for (const row of rows) {
      const name = row.name || row['clinic name'] || row['centre name']
      if (!name) { skipped++; continue }
      const address = row.address || null
      const { error } = await supabase.from('directory_clinics').upsert({
        partnership_status: 'directory',
        name,
        address,
        district: row.district || guessDistrict(address),
        contact_phone: row.phone || row['telephone no.'] || row.telephone || null,
        contact_email: row.email || null,
        opening_hours_static: row.hours || row['service hours'] || null,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
      }, { onConflict: 'name,address' })
      if (error) skipped++
      else imported++
    }
    setImporting(false)
    setResult({ imported, skipped, total: rows.length })
  }

  return (
    <div style={{background:C.beige,minHeight:'100vh',padding:'24px',maxWidth:560,margin:'0 auto',fontFamily:'system-ui,sans-serif'}}>
      <div style={{fontSize:'20px',fontWeight:700,marginBottom:'4px'}}>Find Care Directory Import</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.6}}>
        Import clinic listings from a CSV file - works directly with most data.gov.hk CSV downloads.
        For XLSX files (Elderly Health Centres, Maternal & Child Health, etc.), open in Excel or
        Google Sheets and "Save As" / "Download as" CSV first - XLSX can't be read directly here.
      </div>
      <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>Expected columns (any order, case-insensitive): name, address, district, phone, email, hours, latitude, longitude. Only "name" is required - district is auto-guessed from the address if left blank.</div>
        <label style={{display:'block',width:'100%',padding:'12px',border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'13px',color:C.textSub,textAlign:'center',cursor:'pointer',boxSizing:'border-box'}}>
          {fileName || 'Tap to upload CSV'}
          <input type="file" accept=".csv" style={{display:'none'}} onChange={handleFile}/>
        </label>
      </div>
      {rows.length > 0 && !result && (
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,marginBottom:'8px'}}>{rows.length} rows found</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>Preview: {rows.slice(0,3).map(r=>r.name||r['clinic name']||r['centre name']||'—').join(', ')}{rows.length>3?'…':''}</div>
          <button onClick={handleImport} disabled={importing} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
            {importing?'Importing…':`Import ${rows.length} clinics`}
          </button>
        </div>
      )}
      {result && (
        <div style={{background:result.skipped>0?'#fbf3e0':C.greenLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:600}}>{result.imported} of {result.total} imported{result.skipped>0?`, ${result.skipped} skipped`:''}</div>
        </div>
      )}

      <div style={{fontSize:'16px',fontWeight:700,marginTop:'32px',marginBottom:'4px'}}>Pending Claims</div>
      <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'16px',lineHeight:1.6}}>
        Approving a claim upgrades the clinic from a directory listing to a real Medsa partnership.
        Note: currently every approved clinic is linked to institution_source 'clinic_ops' - a real
        multi-clinic setup (separate tenants per approved clinic) would need that made dynamic,
        which isn't built yet.
      </div>
      {claimsLoading && <div style={{fontSize:'13px',color:C.textMuted}}>Loading…</div>}
      {!claimsLoading && claims.length===0 && <div style={{fontSize:'13px',color:C.textMuted}}>No pending claims.</div>}
      {claims.map(claim => (
        <div key={claim.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'16px',marginBottom:'10px'}}>
          <div style={{fontSize:'14px',fontWeight:600}}>{claim.directory_clinics?.name}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>{claim.directory_clinics?.address}</div>
          <div style={{fontSize:'12px',color:C.text,lineHeight:1.6,marginBottom:'12px'}}>
            <strong>{claim.applicant_name}</strong>{claim.applicant_role?` · ${claim.applicant_role}`:''}<br/>
            {claim.contact_email}{claim.contact_phone?` · ${claim.contact_phone}`:''}<br/>
            {claim.mchk_registration_no&&`MCHK: ${claim.mchk_registration_no}`}
            {claim.business_registration_no&&` · BR: ${claim.business_registration_no}`}
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>handleRejectClaim(claim)} disabled={processingClaim===claim.id} style={{flex:1,padding:'10px',background:C.redLight,color:C.red,border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Reject</button>
            <button onClick={()=>handleApproveClaim(claim)} disabled={processingClaim===claim.id} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{processingClaim===claim.id?'…':'Approve'}</button>
          </div>
        </div>
      ))}
    </div>
  )
}
