// pages/claim-clinic.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Real claim submission - a clinic administrator finds their own directory
// listing (e.g. imported from data.gov.hk) and submits real details to
// claim it. An admin then reviews and approves via directory-import.jsx,
// which is what actually flips partnership_status to 'medsa_partnered'.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  green:'#4a7c59', greenLight:'#e8f2ea', beige:'#f0ede8', cream:'#faf8f5',
  text:'#1a1a1a', textSub:'#6b6560', textMuted:'#9c9690', border:'#e5e0d8',
  red:'#c0392b', redLight:'#fbeae8', amber:'#d4a017', amberLight:'#fdf3e0',
}

export default function ClaimClinicPage() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selectedClinic, setSelectedClinic] = useState(null)
  const [searching, setSearching] = useState(false)
  const [form, setForm] = useState({ applicantName:'', applicantRole:'', contactPhone:'', contactEmail:'', mchkRegNo:'', businessRegNo:'' })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null) // 'success' | error message

  async function handleSearch() {
    if (!search.trim()) return
    setSearching(true)
    const { data } = await supabase.from('directory_clinics').select('*')
      .ilike('name', `%${search}%`).eq('partnership_status', 'directory').limit(10)
    setResults(data||[])
    setSearching(false)
  }

  async function handleSubmit() {
    if (!selectedClinic || !form.applicantName || !form.contactEmail) return
    setSubmitting(true)
    const { error } = await supabase.from('clinic_claim_requests').insert({
      clinic_id: selectedClinic.id,
      applicant_name: form.applicantName,
      applicant_role: form.applicantRole || null,
      contact_phone: form.contactPhone || null,
      contact_email: form.contactEmail,
      mchk_registration_no: form.mchkRegNo || null,
      business_registration_no: form.businessRegNo || null,
    })
    setSubmitting(false)
    if (error) {
      // Real duplicate-prevention surfaces here - the database itself
      // rejects a second pending claim on the same clinic, not just a
      // client-side check that could be bypassed.
      if (error.message.includes('idx_one_pending_claim_per_clinic')) {
        setResult('A claim for this clinic is already pending review.')
      } else {
        setResult(error.message)
      }
      return
    }
    setResult('success')
  }

  if (result === 'success') return (
    <div style={{background:C.beige,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
      <div style={{maxWidth:400,textAlign:'center'}}>
        <div style={{fontSize:'32px',marginBottom:'12px'}}>✓</div>
        <div style={{fontSize:'18px',fontWeight:700,marginBottom:'8px'}}>Claim submitted</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Medsa will review your claim for <strong>{selectedClinic.name}</strong> and follow up at {form.contactEmail}.</div>
      </div>
    </div>
  )

  return (
    <div style={{background:C.beige,minHeight:'100vh',padding:'24px',maxWidth:560,margin:'0 auto',fontFamily:'system-ui,sans-serif'}}>
      <div style={{fontSize:'20px',fontWeight:700,marginBottom:'4px'}}>Claim Your Clinic</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.6}}>
        If your clinic already appears in Medsa's directory, claim it here to upgrade to a real Medsa partnership - live booking, real availability, and a verified badge patients can see.
      </div>

      {!selectedClinic && <>
        <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()} placeholder="Search your clinic name…" style={{flex:1,padding:'10px 12px',fontSize:'14px',border:`0.5px solid ${C.border}`,borderRadius:'8px',boxSizing:'border-box'}}/>
          <button onClick={handleSearch} disabled={searching} style={{padding:'10px 16px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{searching?'…':'Search'}</button>
        </div>
        {results.map(c => (
          <div key={c.id} onClick={()=>setSelectedClinic(c)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'8px',cursor:'pointer'}}>
            <div style={{fontSize:'14px',fontWeight:600}}>{c.name}</div>
            <div style={{fontSize:'12px',color:C.textSub}}>{c.address}{c.district?` · ${c.district}`:''}</div>
          </div>
        ))}
        {results.length===0 && search && !searching && <div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'20px'}}>No unclaimed clinic found matching "{search}".</div>}
      </>}

      {selectedClinic && (
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'20px'}}>
          <div onClick={()=>setSelectedClinic(null)} style={{fontSize:'12px',color:C.green,cursor:'pointer',marginBottom:'12px'}}>‹ Back to search</div>
          <div style={{fontSize:'14px',fontWeight:700,marginBottom:'2px'}}>{selectedClinic.name}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>{selectedClinic.address}</div>

          {result && result !== 'success' && <div style={{fontSize:'12px',color:C.red,background:C.redLight,borderRadius:'8px',padding:'10px 12px',marginBottom:'12px'}}>{result}</div>}

          {[['applicantName','Your full name'],['applicantRole','Your role (e.g. Practice Manager)'],['contactPhone','Contact phone'],['contactEmail','Contact email'],['mchkRegNo','MCHK registration number (if applicable)'],['businessRegNo','Business Registration number']].map(([field,ph]) => (
            <input key={field} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph}
              style={{width:'100%',padding:'10px 12px',fontSize:'13px',marginBottom:'10px',border:`0.5px solid ${C.border}`,borderRadius:'8px',boxSizing:'border-box'}}/>
          ))}
          <button onClick={handleSubmit} disabled={submitting||!form.applicantName||!form.contactEmail} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>
            {submitting?'Submitting…':'Submit claim'}
          </button>
        </div>
      )}
    </div>
  )
}
