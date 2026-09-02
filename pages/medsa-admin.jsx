// pages/medsa-admin.jsx (was content-manager.jsx)
// ─────────────────────────────────────────────────────────────────────────────
// The one Medsa-employee admin tool: home carousel (ads/newsletter), the
// community forum (duplicate review, sponsor assignment, reported-post
// moderation), onboarding insurance partners, and admin-assisted clinic
// onboarding (clinic-signup.jsx still exists too, for clinics that want
// to self-serve - this is the same real flow, run on their behalf).
// Password-gated via middleware.js, same as the other admin/data tools.
// All future onboarding tools belong here too, rather than as their own
// standalone pages.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'
import Icon from '../components/shared/Icon'

export default function MedsaAdminPage() {
  const [tab, setTab] = useState('carousel')
  return (
    <div style={{background:C.beige,minHeight:'100vh',padding:'24px',maxWidth:560,margin:'0 auto',fontFamily:'system-ui,sans-serif'}}>
      <div style={{fontSize:'20px',fontWeight:700,marginBottom:'16px'}}>Medsa Admin</div>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px',flexWrap:'wrap'}}>
        {[['carousel','slides','Carousel'],['forum','community','Forum'],['partners','insurance','Insurers'],['clinics','building','Clinics'],['tpa','records','TPA Clinics'],['apiclients','badge','API Clients'],['recovery','badge','Recovery']].map(([k,ic,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,minWidth:70,padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'13px',fontWeight:600,cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.text,display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
            <Icon name={ic} size={18}/>
            {l}
          </div>
        ))}
      </div>
      {tab==='carousel' && <CarouselTab/>}
      {tab==='forum' && <ForumModerationTab/>}
      {tab==='partners' && <PartnersTab/>}
      {tab==='clinics' && <ClinicsTab/>}
      {tab==='tpa' && <TpaClinicsTab/>}
      {tab==='apiclients' && <ApiClientsTab/>}
      {tab==='recovery' && <AccountRecoveryTab/>}
    </div>
  )
}

// Reviews account_recovery_requests - someone resigning up with an HKID
// that already has a real Medsa account (see SelfRegisterFlow in
// PatientApp.jsx). Manual review for now (verification_method stays
// 'manual' either way); a real ID-verification provider can slot in
// ahead of this queue later without changing the table shape.
// Out-of-network claim intake ("Uber Eats" side of the insurance work) -
// a clinic that never adopts ClinicOps as its EMR can still submit
// claims through Medsa's adjudication engine (lib/insuranceAdapter.js),
// same real eligibility/deductible/copay math as a native clinic, for
// the same per-claim fee. Medsa is purely the claim's biller/router
// here, never this clinic's EMR. Onboarding is admin-provisioned (not
// self-serve), same as insurer partners - a real relationship, not an
// open signup form.
function TpaClinicsTab() {
  const [clinics, setClinics] = useState([])
  const [claimStats, setClaimStats] = useState({}) // clinicId -> {count, feesEarned}
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ clinicName:'', contactName:'', contactEmail:'', contactPhone:'', brNumber:'' })
  const [result, setResult] = useState(null)
  const [resettingId, setResettingId] = useState(null)

  async function load() {
    setLoading(true)
    const clinicsRes = await fetch('/api/admin/list_tpa_clinics', { method: 'POST' }).then(r=>r.json())
    setClinics(clinicsRes.clinics||[])
    // Real claim volume + fees earned per clinic - this is the actual
    // monetization visibility for the TPA side, not just a client list.
    // insurance_claims is still directly readable by the browser (unlike
    // external_clinics, it holds no credential material).
    const { data: claims } = await supabase.from('insurance_claims')
      .select('external_clinic_id, platform_claim_fee').eq('source_type','external_clinic')
    const stats = {}
    for (const c of (claims||[])) {
      if (!c.external_clinic_id) continue
      if (!stats[c.external_clinic_id]) stats[c.external_clinic_id] = { count: 0, feesEarned: 0 }
      stats[c.external_clinic_id].count += 1
      stats[c.external_clinic_id].feesEarned += c.platform_claim_fee || 0
    }
    setClaimStats(stats)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleSubmit() {
    if (!form.clinicName.trim() || !form.contactEmail.trim()) return
    setSaving(true)
    setResult(null)
    const res = await fetch('/api/admin/create_tpa_clinic', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        clinicName: form.clinicName.trim(), contactName: form.contactName.trim()||null,
        contactEmail: form.contactEmail.trim(), contactPhone: form.contactPhone.trim()||null,
        brNumber: form.brNumber.trim()||null,
      }),
    })
    const data = await res.json()
    if (data.status !== 'OK') { setResult({ error: data.message || 'Could not onboard this clinic.' }); setSaving(false); return }

    setResult({ clinicName: data.clinicName, tempPassword: data.tempPassword })
    setSaving(false)
    setCreating(false)
    setForm({ clinicName:'', contactName:'', contactEmail:'', contactPhone:'', brNumber:'' })
    load()
  }

  async function handleResetPassword(clinic) {
    setResettingId(clinic.id)
    const tempPassword = `Temp${Math.floor(1000+Math.random()*9000)}!`
    const res = await fetch('/api/admin/set_external_clinic_password', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ clinicId: clinic.id, newPassword: tempPassword }),
    })
    const data = await res.json()
    setResettingId(null)
    if (data.status === 'OK') setResult({ clinicName: clinic.clinic_name, tempPassword })
  }

  async function toggleStatus(clinic) {
    await fetch('/api/admin/toggle_tpa_clinic_status', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ clinicId: clinic.id, newStatus: clinic.status==='active'?'suspended':'active' }),
    })
    load()
  }

  return (
    <div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>
        Clinics that submit claims through Medsa's claim portal without ever adopting ClinicOps as their EMR. Same adjudication engine, same per-claim fee as a native clinic - Medsa is just the biller here. Onboarding is a real relationship you set up on their behalf, same as an insurer partner - not a public signup.
      </div>

      {result&&!result.error&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'14px',marginBottom:'16px'}}>
        <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'6px'}}>✓ Credentials set for {result.clinicName}</div>
        <div style={{fontSize:'12px',color:C.textSub}}>Temp password: <strong>{result.tempPassword}</strong></div>
        <div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>Relay this to the clinic directly - not shown again.</div>
      </div>}
      {result?.error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'16px'}}>{result.error}</div>}

      {!creating&&<button onClick={()=>{setCreating(true);setResult(null)}} style={{width:'100%',padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer',marginBottom:'16px'}}>+ Onboard a TPA clinic</button>}
      {creating&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'14px',marginBottom:'16px'}}>
        {[['clinicName','Clinic name'],['contactName','Contact name'],['contactEmail','Contact email'],['contactPhone','Contact phone'],['brNumber','Business registration number (optional)']].map(([field,ph]) => (
          <input key={field} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph}
            style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        ))}
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setCreating(false)} style={{flex:1,padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving||!form.clinicName.trim()||!form.contactEmail.trim()} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{saving?'Saving…':'Create & issue password'}</button>
        </div>
      </div>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&clinics.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'20px'}}>No TPA clinics onboarded yet.</div>}
      {!loading&&clinics.map(c => {
        const stats = claimStats[c.id] || { count: 0, feesEarned: 0 }
        return (
          <div key={c.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:600}}>{c.clinic_name}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{c.contact_name||'—'} · {c.contact_email}</div>
              </div>
              <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:c.status==='active'?C.greenLight:C.card,color:c.status==='active'?C.green:C.textMuted,fontWeight:600}}>{c.status}</span>
            </div>
            <div style={{fontSize:'12px',color:C.text,marginBottom:'10px'}}>{stats.count} claim{stats.count===1?'':'s'} submitted · <strong>HK${stats.feesEarned.toFixed(0)}</strong> in platform fees earned</div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>toggleStatus(c)} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{c.status==='active'?'Suspend':'Reactivate'}</button>
              <button onClick={()=>handleResetPassword(c)} disabled={resettingId===c.id} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{resettingId===c.id?'…':'Reset password'}</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Infrastructure-as-a-service ("Uber Direct" side of the insurance work) -
// an insurer with no relationship to Medsa's consumer apps or ClinicOps
// pays to call the adjudication engine directly via API. Different
// customer and different pricing from TPA clinics (that's a clinic
// paying indirectly per claim Medsa routes for them); this is an
// insurer paying for the engine itself. See lib/apiAuth.js and
// pages/api/v1/*.
function ApiClientsTab() {
  const [clients, setClients] = useState([])
  const [usage, setUsage] = useState({}) // clientId -> call count
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name:'', contactEmail:'' })
  const [result, setResult] = useState(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/list_api_clients', { method: 'POST' }).then(r=>r.json())
    setClients(res.clients||[])
    setUsage(res.usage||{})
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleSubmit() {
    if (!form.name.trim()) return
    setSaving(true)
    setResult(null)
    const res = await fetch('/api/admin/create_api_client', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name: form.name.trim(), contactEmail: form.contactEmail.trim() }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.status !== 'OK') { setResult({ error: data.message||'Could not create API client.' }); return }
    setResult({ name: data.apiClient.name, apiKey: data.apiKey })
    setCreating(false)
    setForm({ name:'', contactEmail:'' })
    load()
  }

  async function toggleStatus(client) {
    await fetch('/api/admin/toggle_api_client_status', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ clientId: client.id, newStatus: client.status==='active'?'suspended':'active' }),
    })
    load()
  }

  return (
    <div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>
        Insurers who pay to call the adjudication engine (POST /api/v1/eligibility, /api/v1/adjudicate) directly with their own API key - no clinic or patient app involved at all. Real HTTP endpoints, real usage logging, same engine as ClinicOps and the TPA portal.
      </div>

      {result&&!result.error&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'14px',marginBottom:'16px'}}>
        <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'6px'}}>✓ API key issued for {result.name}</div>
        <div style={{fontSize:'12px',color:C.textSub,wordBreak:'break-all'}}>{result.apiKey}</div>
        <div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>Only the hash is stored - this is the only time it's ever shown. Relay it to the insurer directly.</div>
      </div>}
      {result?.error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'16px'}}>{result.error}</div>}

      {!creating&&<button onClick={()=>{setCreating(true);setResult(null)}} style={{width:'100%',padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer',marginBottom:'16px'}}>+ Issue an API key</button>}
      {creating&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'14px',marginBottom:'16px'}}>
        <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Insurer/company name" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        <input value={form.contactEmail} onChange={e=>setForm(f=>({...f,contactEmail:e.target.value}))} placeholder="Contact email (optional)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setCreating(false)} style={{flex:1,padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving||!form.name.trim()} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{saving?'Issuing…':'Issue key'}</button>
        </div>
      </div>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&clients.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'20px'}}>No API clients issued yet.</div>}
      {!loading&&clients.map(c => (
        <div key={c.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
            <div>
              <div style={{fontSize:'14px',fontWeight:600}}>{c.name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{c.contact_email||'—'}</div>
            </div>
            <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:c.status==='active'?C.greenLight:C.card,color:c.status==='active'?C.green:C.textMuted,fontWeight:600}}>{c.status}</span>
          </div>
          <div style={{fontSize:'12px',color:C.text,marginBottom:'10px'}}>{usage[c.id]||0} API call{(usage[c.id]||0)===1?'':'s'} total</div>
          <button onClick={()=>toggleStatus(c)} style={{width:'100%',padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{c.status==='active'?'Suspend':'Reactivate'}</button>
        </div>
      ))}
    </div>
  )
}

function AccountRecoveryTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewerName, setReviewerName] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [imageUrls, setImageUrls] = useState({})

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/list_recovery_requests', { method: 'POST' }).then(r=>r.json())
    setRequests(res.requests || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function viewImage(path) {
    if (!path) return
    if (imageUrls[path]) { window.open(imageUrls[path], '_blank'); return }
    const { data } = await supabase.storage.from('id-verification').createSignedUrl(path, 300)
    if (data?.signedUrl) {
      setImageUrls(prev => ({ ...prev, [path]: data.signedUrl }))
      window.open(data.signedUrl, '_blank')
    }
  }

  async function handleApprove(req) {
    if (!reviewerName.trim()) { alert('Enter your name before reviewing.'); return }
    setBusyId(req.id)
    // Updates the EXISTING account's phone number - this is the whole
    // point, recovery never creates a second account.
    await fetch('/api/admin/review_recovery_request', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ requestId: req.id, decision: 'approved', reviewerName: reviewerName.trim(), patientId: req.patient_id, newPhone: req.new_phone }),
    })
    setBusyId(null)
    load()
  }

  async function handleReject(req) {
    if (!reviewerName.trim()) { alert('Enter your name before reviewing.'); return }
    setBusyId(req.id)
    await fetch('/api/admin/review_recovery_request', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ requestId: req.id, decision: 'rejected', reviewerName: reviewerName.trim() }),
    })
    setBusyId(null)
    load()
  }

  return (
    <div>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'14px',lineHeight:1.5}}>
        Someone tried to register with an HKID that already has a Medsa account. Compare the new ID/selfie against what's on file, then approve (updates the phone number on the existing account) or reject.
      </div>
      <input value={reviewerName} onChange={e=>setReviewerName(e.target.value)} placeholder="Your name (recorded as reviewer)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'16px',border:`1px solid ${C.border}`,borderRadius:'8px',boxSizing:'border-box'}}/>
      {loading && <div style={{fontSize:'13px',color:C.textMuted,textAlign:'center',padding:'20px'}}>Loading…</div>}
      {!loading && requests.length===0 && <div style={{fontSize:'13px',color:C.textMuted,textAlign:'center',padding:'20px'}}>No pending recovery requests.</div>}
      {requests.map(req => (
        <div key={req.id} style={{background:C.card,borderRadius:'10px',padding:'16px',marginBottom:'12px'}}>
          <div style={{fontSize:'14px',fontWeight:700,marginBottom:'2px'}}>{req.patients?.full_name || 'Unknown'}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>{req.patients?.medsa_id} · HKID {req.hkid}</div>
          <div style={{fontSize:'12px',color:C.text,marginBottom:'10px'}}>Phone on file: <strong>{req.patients?.phone || '(none)'}</strong> → requesting: <strong>{req.new_phone}</strong></div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'12px'}}>
            <button onClick={()=>viewImage(req.patients?.id_document_path)} disabled={!req.patients?.id_document_path} style={{padding:'6px 10px',fontSize:'11px',border:`1px solid ${C.border}`,borderRadius:'6px',background:'#fff',cursor:'pointer'}}>View original ID</button>
            <button onClick={()=>viewImage(req.patients?.selfie_verification_path)} disabled={!req.patients?.selfie_verification_path} style={{padding:'6px 10px',fontSize:'11px',border:`1px solid ${C.border}`,borderRadius:'6px',background:'#fff',cursor:'pointer'}}>View original selfie</button>
            <button onClick={()=>viewImage(req.id_document_path)} disabled={!req.id_document_path} style={{padding:'6px 10px',fontSize:'11px',border:`1px solid ${C.green}`,borderRadius:'6px',background:'#fff',color:C.green,cursor:'pointer'}}>View new ID</button>
            <button onClick={()=>viewImage(req.selfie_verification_path)} disabled={!req.selfie_verification_path} style={{padding:'6px 10px',fontSize:'11px',border:`1px solid ${C.green}`,borderRadius:'6px',background:'#fff',color:C.green,cursor:'pointer'}}>View new selfie</button>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>handleReject(req)} disabled={busyId===req.id} style={{flex:1,padding:'8px',background:'#fff',border:`1px solid ${C.red}`,color:C.red,borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{busyId===req.id?'…':'Reject'}</button>
            <button onClick={()=>handleApprove(req)} disabled={busyId===req.id} style={{flex:1,padding:'8px',background:C.green,border:'none',color:'#fff',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{busyId===req.id?'…':'Approve'}</button>
          </div>
        </div>
      ))}
    </div>
  )
}

const PLAN_CATEGORIES = ['Hospitalisation','Outpatient','Specialist','Labs & imaging','Dental (basic)','Surgery','Travel emergency','Mental health','Critical illness lump sum']

function PartnersTab() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ name:'', contact_name:'', contact_email:'', contact_phone:'', contractExpiryDate:'' })
  const [contractDocUrl, setContractDocUrl] = useState(null)
  const [contractDocName, setContractDocName] = useState(null)
  const [managingPlansFor, setManagingPlansFor] = useState(null)
  const [renewingId, setRenewingId] = useState(null)
  const [renewDate, setRenewDate] = useState('')
  const [approvingId, setApprovingId] = useState(null)
  const [approvedPassword, setApprovedPassword] = useState(null)

  const [uploadError, setUploadError] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('insurance_companies').select('*').order('created_at',{ascending:false})
    // New-inquiry counts per company, surfaced right here rather than
    // only visible after drilling into "Manage plans" - that's where
    // "Inquire about plan" on the patient side actually lands, and it
    // was too easy to miss.
    const { data: plans } = await supabase.from('insurance_plans').select('id, company_name')
    const { data: inquiries } = await supabase.from('plan_inquiries').select('plan_id').eq('status', 'new')
    const planToCompany = Object.fromEntries((plans||[]).map(p=>[p.id, p.company_name]))
    const countsByCompany = {}
    for (const inq of (inquiries||[])) {
      const companyName = planToCompany[inq.plan_id]
      if (companyName) countsByCompany[companyName] = (countsByCompany[companyName]||0) + 1
    }
    setCompanies((data||[]).map(c => ({ ...c, newInquiries: countsByCompany[c.name]||0 })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleContractUpload(file) {
    setUploading(true)
    setUploadError(null)
    setContractDocName(file.name)
    // Same pattern as staff registration documents - storing the path,
    // not a public URL, since a signed URL should be generated on
    // demand when a real "view contract" feature is built.
    const path = `insurance_companies/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('partner-contracts').upload(path, file)
    if (error) { setUploadError(error.message); setUploading(false); return }
    setContractDocUrl(path)
    setUploading(false)
  }

  async function handleSubmit() {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('insurance_companies').insert({
      name: form.name.trim(), contact_name: form.contact_name.trim()||null,
      contact_email: form.contact_email.trim()||null, contact_phone: form.contact_phone.trim()||null,
      onboarded_by: 'Medsa admin',
      contract_start_date: new Date().toISOString().slice(0,10),
      contract_expiry_date: form.contractExpiryDate || null,
      contract_doc_url: contractDocUrl || null,
    })
    setSaving(false)
    setCreating(false)
    setForm({ name:'', contact_name:'', contact_email:'', contact_phone:'', contractExpiryDate:'' })
    setContractDocUrl(null); setContractDocName(null)
    load()
  }

  async function toggleStatus(company) {
    await supabase.from('insurance_companies').update({ status: company.status==='active'?'inactive':'active' }).eq('id', company.id)
    load()
  }

  // Self-serve partnered applications (see /insurer-signup) land as
  // status='pending' with no password set yet - approving here is what
  // actually issues their first login, via the same server-side
  // set_insurance_company_password flow create_tpa_clinic.js uses.
  async function approveInsurer(company) {
    setApprovingId(company.id)
    setApprovedPassword(null)
    try {
      const res = await fetch('/api/admin/approve_insurer', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ companyId: company.id }),
      })
      const data = await res.json()
      if (data.status === 'OK') setApprovedPassword({ id: company.id, password: data.tempPassword })
    } finally {
      setApprovingId(null)
      load()
    }
  }

  async function handleRenew(company) {
    if (!renewDate) return
    await supabase.from('insurance_companies').update({
      contract_expiry_date: renewDate, contract_start_date: new Date().toISOString().slice(0,10),
      ...(contractDocUrl ? { contract_doc_url: contractDocUrl } : {}),
    }).eq('id', company.id)
    setRenewingId(null); setRenewDate(''); setContractDocUrl(null); setContractDocName(null)
    load()
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr) - new Date()) / (1000*60*60*24))
  }

  if (managingPlansFor) return <CompanyPlansManager company={managingPlansFor} onBack={()=>setManagingPlansFor(null)}/>

  return (
    <div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>Onboard an insurance partner - same idea as clinic-signup.jsx, but admin-driven rather than self-serve, and no login yet (that's part of the bigger insurance build). Once onboarded, tap "Manage plans" on their card to add their plans - same place, no separate page. Onboarding here means a real contract - set an expiry date and upload the signed contract, and this flags it for renewal as it approaches, same as clinic onboarding.</div>

      {!creating&&<button onClick={()=>setCreating(true)} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer',marginBottom:'20px'}}>+ Onboard a company</button>}

      {creating&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
        <div style={{fontSize:'15px',fontWeight:600,marginBottom:'14px'}}>New insurance partner</div>
        {[['name','Company name (e.g. AIA)'],['contact_name','Contact person'],['contact_email','Contact email'],['contact_phone','Contact phone']].map(([field,ph]) => (
          <input key={field} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph}
            style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        ))}
        <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>Contract expiry date</div>
        <input type="date" value={form.contractExpiryDate} onChange={e=>setForm(f=>({...f,contractExpiryDate:e.target.value}))}
          style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>Signed contract (PDF or image)</div>
        <label style={{display:'block',width:'100%',padding:'10px',border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',color:C.textSub,textAlign:'center',cursor:'pointer',marginBottom:'10px',boxSizing:'border-box'}}>
          {contractDocName || 'Tap to upload'}
          <input type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={e=>e.target.files[0]&&handleContractUpload(e.target.files[0])}/>
        </label>
        {uploading&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>Uploading…</div>}
        {uploadError&&<div style={{fontSize:'11px',color:C.red,marginBottom:'10px'}}>Upload failed: {uploadError}</div>}
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>{setCreating(false);setContractDocUrl(null);setContractDocName(null)}} style={{flex:1,padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving||!form.name.trim()} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{saving?'Saving…':'Onboard'}</button>
        </div>
      </div>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&companies.map(c => {
        const daysLeft = daysUntil(c.contract_expiry_date)
        const expiringSoon = daysLeft!=null && daysLeft<=30
        return (
        <div key={c.id} style={{background:C.cream,border:`0.5px solid ${c.status==='pending'?C.amber:expiringSoon?C.amber:C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
            <div>
              <div style={{fontSize:'14px',fontWeight:600}}>{c.name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{c.contact_name}{c.contact_email?` · ${c.contact_email}`:''}</div>
              <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{c.relationship_type==='unpartnered'?'TPA-only':'Partnered'}{c.self_serve?' · self-serve':''}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'4px'}}>
              <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:c.status==='active'?C.greenLight:c.status==='pending'?C.amberLight:C.card,color:c.status==='active'?C.green:c.status==='pending'?C.amber:C.textMuted,fontWeight:600}}>{c.status}</span>
              {c.newInquiries>0&&<span onClick={()=>setManagingPlansFor(c)} style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:C.amberLight,color:C.amber,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>{c.newInquiries} new inquir{c.newInquiries===1?'y':'ies'}</span>}
            </div>
          </div>
          {c.status==='pending'&&<div style={{marginBottom:'8px'}}>
            {approvedPassword?.id===c.id
              ? <div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'10px 12px',fontSize:'12px'}}>Approved. Temp password: <strong style={{letterSpacing:'0.5px'}}>{approvedPassword.password}</strong> - send this to {c.contact_email}.</div>
              : <button onClick={()=>approveInsurer(c)} disabled={approvingId===c.id} style={{width:'100%',padding:'10px',background:C.amber,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{approvingId===c.id?'Approving…':'Approve & activate - issues login'}</button>}
          </div>}
          {c.contract_expiry_date
            ? <div style={{fontSize:'11px',marginBottom:'8px',color:expiringSoon?C.amber:C.textMuted,fontWeight:expiringSoon?600:400}}>{expiringSoon?`⚠ Contract expires in ${daysLeft} day${daysLeft===1?'':'s'} - send a new one`:`Contract until ${c.contract_expiry_date}`}{c.contract_doc_url?' · signed copy on file':''}</div>
            : <div style={{fontSize:'11px',marginBottom:'8px',color:C.amber}}>⚠ No contract expiry on file</div>}
          {renewingId===c.id
            ? <div style={{marginBottom:'8px'}}>
                <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
                  <input type="date" value={renewDate} onChange={e=>setRenewDate(e.target.value)} style={{flex:1,padding:'8px',fontSize:'12px',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
                  <button onClick={()=>handleRenew(c)} disabled={!renewDate} style={{padding:'8px 12px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>Save</button>
                </div>
                <label style={{display:'block',width:'100%',padding:'10px',border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',color:C.textSub,textAlign:'center',cursor:'pointer',boxSizing:'border-box'}}>
                  {contractDocName || (c.contract_doc_url ? 'Replace signed contract' : 'Upload signed contract (optional)')}
                  <input type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={e=>e.target.files[0]&&handleContractUpload(e.target.files[0])}/>
                </label>
                {uploading&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'6px'}}>Uploading…</div>}
                {uploadError&&<div style={{fontSize:'11px',color:C.red,marginTop:'6px'}}>Upload failed: {uploadError}</div>}
              </div>
            : <button onClick={()=>{setRenewingId(c.id);setRenewDate(c.contract_expiry_date||'')}} style={{width:'100%',marginBottom:'8px',padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>Set / renew contract date, or upload a contract</button>}
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>toggleStatus(c)} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{c.status==='active'?'Deactivate':'Reactivate'}</button>
            <button onClick={()=>setManagingPlansFor(c)} style={{flex:1,padding:'8px',background:C.navy,color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>Manage plans</button>
          </div>
        </div>
        )
      })}
    </div>
  )
}

// Same real plan-management flow that used to live on its own page
// (/insurer-plans) - folded in here so onboarding a company and setting
// up its plans is one place, one tool, not two.
function CompanyPlansManager({ company, onBack }) {
  const [subTab, setSubTab] = useState('plans')
  const [plans, setPlans] = useState([])
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ plan_name:'', plan_type:'', covered_conditions:'', covered_categories:[], key_benefits:'', sponsored:false, requires_doctor_referral_for_allied_health:false })
  const [tiers, setTiers] = useState([{ age_min:'', age_max:'', monthly_premium:'', annual_limit:'' }])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('insurance_plans').select('*, insurance_plan_pricing_tiers(*)').eq('company_name', company.name).order('created_at',{ascending:false})
    setPlans(data||[])
    const planIds = (data||[]).map(p=>p.id)
    if (planIds.length>0) {
      const { data: inq } = await supabase.from('plan_inquiries').select('*, insurance_plans(plan_name), agents:claimed_by_agent_id(name)').in('plan_id', planIds).order('created_at',{ascending:false})
      setInquiries(inq||[])
    } else {
      setInquiries([])
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [company.name])

  async function markContacted(inq) {
    await supabase.from('plan_inquiries').update({ status:'contacted' }).eq('id', inq.id)
    load()
  }

  function updateTier(i, field, value) {
    setTiers(t => t.map((tier,idx) => idx===i ? {...tier, [field]: value} : tier))
  }
  function addTier() {
    setTiers(t => [...t, { age_min:'', age_max:'', monthly_premium:'', annual_limit:'' }])
  }
  function removeTier(i) {
    setTiers(t => t.filter((_,idx)=>idx!==i))
  }
  function toggleCategory(cat) {
    setForm(f => ({ ...f, covered_categories: f.covered_categories.includes(cat) ? f.covered_categories.filter(c=>c!==cat) : [...f.covered_categories, cat] }))
  }

  async function handleSubmit() {
    if (!form.plan_name) return
    const validTiers = tiers.filter(t => t.age_min!=='' && t.age_max!=='' && t.monthly_premium!=='')
    if (validTiers.length===0) return
    setSaving(true)
    const { data: newPlan } = await supabase.from('insurance_plans').insert({
      company_name: company.name,
      plan_name: form.plan_name,
      plan_type: form.plan_type || null,
      covered_conditions: form.covered_conditions.split(',').map(s=>s.trim()).filter(Boolean),
      covered_categories: form.covered_categories,
      key_benefits: form.key_benefits || null,
      sponsored: form.sponsored,
      requires_doctor_referral_for_allied_health: form.requires_doctor_referral_for_allied_health,
      status: 'active',
    }).select().maybeSingle()

    if (newPlan) {
      await supabase.from('insurance_plan_pricing_tiers').insert(
        validTiers.map(t => ({
          plan_id: newPlan.id,
          age_min: parseInt(t.age_min), age_max: parseInt(t.age_max),
          monthly_premium: parseFloat(t.monthly_premium),
          annual_limit: t.annual_limit ? parseFloat(t.annual_limit) : null,
        }))
      )
    }
    setSaving(false)
    setCreating(false)
    setForm({ plan_name:'', plan_type:'', covered_conditions:'', covered_categories:[], key_benefits:'', sponsored:false, requires_doctor_referral_for_allied_health:false })
    setTiers([{ age_min:'', age_max:'', monthly_premium:'', annual_limit:'' }])
    load()
  }

  async function toggleStatus(plan) {
    await supabase.from('insurance_plans').update({ status: plan.status==='active'?'inactive':'active' }).eq('id', plan.id)
    load()
  }

  async function toggleReferralRequirement(plan) {
    await supabase.from('insurance_plans').update({ requires_doctor_referral_for_allied_health: !plan.requires_doctor_referral_for_allied_health }).eq('id', plan.id)
    load()
  }

  return (
    <div>
      <button onClick={onBack} style={{background:'none',border:'none',color:C.textSub,fontSize:'13px',cursor:'pointer',padding:0,marginBottom:'12px'}}>‹ Back to partners</button>
      <div style={{fontSize:'15px',fontWeight:600,marginBottom:'14px'}}>{company.name}</div>

      <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
        {[['plans','Plans'],['inquiries',`Inquiries${inquiries.filter(i=>i.status==='new').length>0?` (${inquiries.filter(i=>i.status==='new').length})`:''}`]].map(([k,l])=>(
          <div key={k} onClick={()=>setSubTab(k)} style={{flex:1,padding:'9px',borderRadius:'8px',textAlign:'center',fontSize:'13px',fontWeight:500,cursor:'pointer',background:subTab===k?C.green:C.card,color:subTab===k?'#fff':C.text}}>{l}</div>
        ))}
      </div>

      {subTab==='inquiries'&&<>
        {/* Real patient inquiries - "Inquire about plan" on the patient
            side used to write here and nothing ever read it back out.
            Medsa relays these to the insurer manually until they have a
            live login of their own. */}
        {inquiries.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'20px'}}>No inquiries yet.</div>}
        {inquiries.map(inq=>(
          <div key={inq.id} style={{background:C.cream,border:`0.5px solid ${inq.status==='new'?C.amber:C.border}`,borderRadius:'12px',padding:'12px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{inq.applicant_full_name||'Unknown applicant'} · {inq.insurance_plans?.plan_name}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginTop:'2px'}}>HKID {inq.applicant_hkid||'—'} · DOB {inq.applicant_dob||'—'}</div>
            <div style={{fontSize:'12px',color:C.textSub}}>{inq.applicant_phone||'no phone on file'}{inq.applicant_email?` · ${inq.applicant_email}`:''}</div>
            <div style={{fontSize:'11px',color:inq.agents?.name?C.green:C.textMuted,marginTop:'2px'}}>{inq.agents?.name?`Claimed by ${inq.agents.name}`:'Not yet claimed by an agent'}{inq.switch_requested_at&&' · patient requested a different agent'}</div>
            {inq.status==='new'
              ? <button onClick={()=>markContacted(inq)} style={{marginTop:'8px',padding:'6px 12px',background:C.card,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Mark as contacted</button>
              : <div style={{marginTop:'6px',fontSize:'11px',color:C.green}}>✓ Contacted</div>}
          </div>
        ))}
      </>}

      {subTab==='plans'&&<>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>Plans added here appear in patient-facing plan matching immediately. Inactive plans stay on file but stop showing to patients.</div>

      {!creating&&<button onClick={()=>setCreating(true)} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer',marginBottom:'20px'}}>+ Add new plan</button>}

      {creating&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
        <div style={{fontSize:'15px',fontWeight:600,marginBottom:'14px'}}>New plan for {company.name}</div>
        {[['plan_name','Plan name'],['plan_type','Plan type (e.g. Comprehensive)']].map(([field,ph]) => (
          <input key={field} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph}
            style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        ))}
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Pricing tiers - real insurance pricing varies by age, so at least one age-banded tier is required</div>
        {tiers.map((tier,i) => (
          <div key={i} style={{background:C.card,borderRadius:'8px',padding:'10px',marginBottom:'8px'}}>
            <div style={{display:'flex',gap:'6px',marginBottom:'6px'}}>
              <input type="number" value={tier.age_min} onChange={e=>updateTier(i,'age_min',e.target.value)} placeholder="Age from"
                style={{flex:1,padding:'8px',fontSize:'12px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
              <input type="number" value={tier.age_max} onChange={e=>updateTier(i,'age_max',e.target.value)} placeholder="Age to (use 120 for +)"
                style={{flex:1,padding:'8px',fontSize:'12px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
            </div>
            <div style={{display:'flex',gap:'6px'}}>
              <input type="number" value={tier.monthly_premium} onChange={e=>updateTier(i,'monthly_premium',e.target.value)} placeholder="Monthly premium (HK$)"
                style={{flex:1,padding:'8px',fontSize:'12px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
              <input type="number" value={tier.annual_limit} onChange={e=>updateTier(i,'annual_limit',e.target.value)} placeholder="Annual limit (HK$, optional)"
                style={{flex:1,padding:'8px',fontSize:'12px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
              {tiers.length>1&&<button onClick={()=>removeTier(i)} style={{padding:'0 10px',background:C.redLight,color:C.red,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>×</button>}
            </div>
          </div>
        ))}
        <button onClick={addTier} style={{width:'100%',padding:'8px',background:C.card,border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',cursor:'pointer',marginBottom:'10px'}}>+ Add another age tier</button>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Covered conditions (comma-separated) - this drives real patient matching</div>
        <input value={form.covered_conditions} onChange={e=>setForm(f=>({...f,covered_conditions:e.target.value}))} placeholder="e.g. diabetes, hypertension, asthma"
          style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Coverage categories</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
          {PLAN_CATEGORIES.map(cat => (
            <div key={cat} onClick={()=>toggleCategory(cat)} style={{padding:'5px 10px',borderRadius:'16px',fontSize:'11px',cursor:'pointer',background:form.covered_categories.includes(cat)?C.green:C.card,color:form.covered_categories.includes(cat)?'#fff':C.textSub}}>{cat}</div>
          ))}
        </div>
        <textarea value={form.key_benefits} onChange={e=>setForm(f=>({...f,key_benefits:e.target.value}))} rows={2} placeholder="Key benefits summary"
          style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px',resize:'none',fontFamily:'inherit'}}/>
        <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',marginBottom:'8px',cursor:'pointer'}}>
          <input type="checkbox" checked={form.sponsored} onChange={e=>setForm(f=>({...f,sponsored:e.target.checked}))}/>
          Sponsored placement
        </label>
        <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',marginBottom:'14px',cursor:'pointer'}}>
          <input type="checkbox" checked={form.requires_doctor_referral_for_allied_health} onChange={e=>setForm(f=>({...f,requires_doctor_referral_for_allied_health:e.target.checked}))}/>
          Requires a doctor referral for out-of-network allied health claims
        </label>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setCreating(false)} style={{flex:1,padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving||!form.plan_name||!tiers.some(t=>t.age_min!==''&&t.age_max!==''&&t.monthly_premium!=='')} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{saving?'Saving…':'Submit plan'}</button>
        </div>
      </div>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&plans.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'20px'}}>No plans listed yet for {company.name}.</div>}
      {!loading&&plans.map(p => (
        <div key={p.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
            <div>
              <div style={{fontSize:'14px',fontWeight:600}}>{p.plan_name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{p.plan_type||'—'}</div>
            </div>
            <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:p.status==='active'?C.greenLight:C.card,color:p.status==='active'?C.green:C.textMuted,fontWeight:600}}>{p.status}</span>
          </div>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Covers: {(p.covered_conditions||[]).join(', ')||'none listed'}</div>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'10px'}}>
            {(p.insurance_plan_pricing_tiers||[]).length===0
              ? <span style={{color:C.red}}>No pricing tiers entered</span>
              : p.insurance_plan_pricing_tiers.sort((a,b)=>a.age_min-b.age_min).map(t=>
                  `Age ${t.age_min}-${t.age_max}: HK$${t.monthly_premium}/mo`
                ).join(' · ')}
          </div>
          <div style={{fontSize:'11px',color:p.requires_doctor_referral_for_allied_health?C.amber:C.textMuted,marginBottom:'8px'}}>
            {p.requires_doctor_referral_for_allied_health ? '⚠ Requires doctor referral for out-of-network allied health' : 'No referral requirement for out-of-network allied health'}
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>toggleStatus(p)} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{p.status==='active'?'Deactivate':'Reactivate'}</button>
            <button onClick={()=>toggleReferralRequirement(p)} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{p.requires_doctor_referral_for_allied_health?'Remove referral requirement':'Require referral'}</button>
          </div>
        </div>
      ))}
      </>}
    </div>
  )
}

// Same real flow as clinic-signup.jsx (real institution + real staff
// login + the same BR/ORPHF check), just run by a Medsa employee on the
// clinic's behalf instead of the clinic filling it in themselves - for
// when onboarding happens over a call, not a link. A temp password is
// generated and shown once, same pattern as the CSV bulk staff import.
function ClinicsTab() {
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState(null)
  const [form, setForm] = useState({ name:'', medicineType:'western', businessRegNumber:'', orphfCode:'', phone:'', address:'', adminName:'', adminEmail:'', contractExpiryDate:'', schemes:[] })
  const [renewingId, setRenewingId] = useState(null)
  const [renewDate, setRenewDate] = useState('')

  async function load() {
    setLoading(true)
    // Named columns, not '*' - institutions.mims_api_key is a real
    // credential (locked down the same way staff_credentials' password
    // columns are) and a wildcard select fails outright the moment any
    // selected column, wildcard included, isn't granted to anon.
    const { data } = await supabase.from('institutions').select('id,name,type,address,district,phone,email,medsa_partner,active,created_at,institution_type,name_tc,onboarding_status,created_by_name,created_by_email,medicine_type,business_registration_number,orphf_code,verification_status,contract_start_date,contract_expiry_date,government_schemes,mims_connected_at,mims_connected_by').order('created_at',{ascending:false}).limit(50)
    setClinics(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleSubmit() {
    if (!form.name.trim() || !form.adminName.trim() || !form.adminEmail.trim()) return
    setSaving(true)
    setResult(null)
    let verification = { status: 'unchecked' }
    if (form.businessRegNumber.trim() || form.orphfCode.trim()) {
      setVerifying(true)
      const res = await fetch('/api/cds/verify_clinic_credentials', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ businessRegistrationNumber: form.businessRegNumber, orphfCode: form.orphfCode, clinicNameDeclared: form.name }),
      })
      verification = await res.json()
      setVerifying(false)
    }
    const { data: institution, error: instErr } = await supabase.from('institutions').insert({
      name: form.name.trim(), medicine_type: form.medicineType,
      onboarding_status: 'pending', created_by_name: form.adminName.trim(), created_by_email: form.adminEmail.trim(),
      business_registration_number: form.businessRegNumber.trim()||null, orphf_code: form.orphfCode.trim()||null,
      phone: form.phone.trim()||null, address: form.address.trim()||null,
      verification_status: verification.overall_status || verification.status || 'unchecked',
      contract_start_date: new Date().toISOString().slice(0,10),
      contract_expiry_date: form.contractExpiryDate || null,
      government_schemes: form.schemes.length ? form.schemes : null,
    }).select('id').maybeSingle()
    if (instErr) { setResult({ error: instErr.message }); setSaving(false); return }

    const medsaId = `MED-${Date.now().toString(36).toUpperCase()}`
    const tempPassword = `Temp${Math.floor(1000+Math.random()*9000)}!`
    await supabase.from('staff_credentials').insert({
      institution_source: 'clinic_ops', institution_id: institution.id, medsa_id: medsaId,
      full_name: form.adminName.trim(), role: 'admin', department: 'All departments',
      onboarded_by: 'medsa-admin', status: 'active', verification_status: 'verified', mchk_declaration_agreed: false,
    })
    await supabase.rpc('set_staff_password', { p_medsa_id: medsaId, p_new_password: tempPassword })

    setResult({ medsaId, tempPassword, verified: verification.overall_status==='verified' })
    setSaving(false)
    setCreating(false)
    setForm({ name:'', medicineType:'western', businessRegNumber:'', orphfCode:'', phone:'', address:'', adminName:'', adminEmail:'', contractExpiryDate:'', schemes:[] })
    load()
  }

  async function handleRenew(clinic) {
    if (!renewDate) return
    await supabase.from('institutions').update({ contract_expiry_date: renewDate, contract_start_date: new Date().toISOString().slice(0,10) }).eq('id', clinic.id)
    setRenewingId(null)
    setRenewDate('')
    load()
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr) - new Date()) / (1000*60*60*24))
  }

  return (
    <div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>Onboard a clinic on their behalf - same real flow as clinic-signup.jsx (real institution, real staff login, same BR/ORPHF check), for when it happens over a call instead of them using the link themselves. Onboarding here means a real contract, not self-serve - set a contract expiry date and this flags it for renewal as it approaches. No auto-email exists yet, so a flagged contract is your cue to send the new one yourself, tracked here once you do.</div>

      {result&&!result.error&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'14px',marginBottom:'16px'}}>
        <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'6px'}}>✓ Clinic created{result.verified?' - registration matched a real registry':' - registration not matched, can be updated later'}</div>
        <div style={{fontSize:'12px',color:C.textSub}}>Medsa ID: <strong>{result.medsaId}</strong> · Temp password: <strong>{result.tempPassword}</strong></div>
        <div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>Relay these to the clinic directly - not shown again.</div>
      </div>}
      {result?.error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'16px'}}>{result.error}</div>}

      {!creating&&<button onClick={()=>setCreating(true)} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer',marginBottom:'20px'}}>+ Onboard a clinic</button>}

      {creating&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
        <div style={{fontSize:'15px',fontWeight:600,marginBottom:'14px'}}>New clinic</div>
        {[['name','Clinic name'],['businessRegNumber','Business Registration Number'],['orphfCode','ORPHF licence/exemption code'],['phone','Clinic phone'],['address','Clinic address'],['adminName','Practice manager full name'],['adminEmail','Practice manager email']].map(([field,ph]) => (
          <input key={field} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph}
            style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        ))}
        <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>Contract expiry date</div>
        <input type="date" value={form.contractExpiryDate} onChange={e=>setForm(f=>({...f,contractExpiryDate:e.target.value}))}
          style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>Government schemes participated in (self-declared)</div>
        <div style={{marginBottom:'10px'}}>
          {[['cdcc','Chronic Disease Co-Care (CDCC)'],['dhc_network','District Health Centre Network'],['ehcv','Elderly Health Care Voucher (EHCV)'],['vaccination_subsidy','Vaccination Subsidy Scheme']].map(([key,label])=>(
            <label key={key} style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:C.textSub,marginBottom:'6px',cursor:'pointer'}}>
              <input type="checkbox" checked={form.schemes.includes(key)} onChange={e=>setForm(f=>({...f,schemes:e.target.checked?[...f.schemes,key]:f.schemes.filter(x=>x!==key)}))}/>
              {label}
            </label>
          ))}
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setCreating(false)} style={{flex:1,padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving||!form.name.trim()||!form.adminName.trim()||!form.adminEmail.trim()} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{saving?(verifying?'Verifying…':'Creating…'):'Onboard'}</button>
        </div>
      </div>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&clinics.map(c => {
        const daysLeft = daysUntil(c.contract_expiry_date)
        const expiringSoon = daysLeft!=null && daysLeft<=30
        return (
          <div key={c.id} style={{background:C.cream,border:`0.5px solid ${expiringSoon?C.amber:C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
            <div style={{fontSize:'14px',fontWeight:600}}>{c.name}</div>
            <div style={{fontSize:'12px',color:C.textSub}}>{c.address||'No address on file'}{c.phone?` · ${c.phone}`:''}</div>
            <div style={{fontSize:'11px',marginTop:'4px',color:c.verification_status==='verified'?C.green:C.amber}}>{c.verification_status==='verified'?'✓ Verified':c.verification_status||'Unchecked'}</div>
            {c.contract_expiry_date
              ? <div style={{fontSize:'11px',marginTop:'2px',color:expiringSoon?C.amber:C.textMuted,fontWeight:expiringSoon?600:400}}>{expiringSoon?`⚠ Contract expires in ${daysLeft} day${daysLeft===1?'':'s'} - send a new one`:`Contract until ${c.contract_expiry_date}`}</div>
              : <div style={{fontSize:'11px',marginTop:'2px',color:C.amber}}>⚠ No contract expiry on file</div>}
            {renewingId===c.id
              ? <div style={{marginTop:'8px',display:'flex',gap:'6px'}}>
                  <input type="date" value={renewDate} onChange={e=>setRenewDate(e.target.value)} style={{flex:1,padding:'8px',fontSize:'12px',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
                  <button onClick={()=>handleRenew(c)} disabled={!renewDate} style={{padding:'8px 12px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>Save</button>
                </div>
              : <button onClick={()=>{setRenewingId(c.id);setRenewDate(c.contract_expiry_date||'')}} style={{width:'100%',marginTop:'8px',padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>Set / renew contract date</button>}
          </div>
        )
      })}
    </div>
  )
}

// Same upload-or-URL choice used on the public sponsor-submit.jsx form -
// duplicated here rather than shared since one's a page and one's a tab.
function AdminImagePicker({ label, value, onChange }) {
  const [mode, setMode] = useState('url')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  async function handleFile(file) {
    setUploading(true)
    setUploadError(null)
    const path = `admin/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('carousel-images').upload(path, file)
    if (error) { setUploadError(error.message); setUploading(false); return }
    const { data } = supabase.storage.from('carousel-images').getPublicUrl(path)
    onChange(data.publicUrl)
    setUploading(false)
  }

  return (
    <div style={{marginBottom:'10px'}}>
      {label&&<div style={{fontSize:'11px',color:C.textSub,marginBottom:'4px'}}>{label}</div>}
      <div style={{display:'flex',gap:'6px',marginBottom:'6px'}}>
        {[['url','Paste a URL'],['upload','Upload a file']].map(([k,l])=>(
          <div key={k} onClick={()=>setMode(k)} style={{flex:1,padding:'6px',borderRadius:'6px',textAlign:'center',fontSize:'11px',cursor:'pointer',background:mode===k?C.green:C.card,color:mode===k?'#fff':C.textSub}}>{l}</div>
        ))}
      </div>
      {mode==='url'&&<input value={value||''} onChange={e=>onChange(e.target.value)} placeholder="https://…" style={{width:'100%',padding:'10px',fontSize:'13px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>}
      {mode==='upload'&&<label style={{display:'block',width:'100%',padding:'10px',border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',color:C.textSub,textAlign:'center',cursor:'pointer',boxSizing:'border-box'}}>
        {uploading?'Uploading…':(value?'Uploaded ✓ - tap to replace':'Tap to upload (JPG/PNG)')}
        <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])}/>
      </label>}
      {uploadError&&<div style={{fontSize:'11px',color:C.red,marginTop:'6px'}}>Upload failed: {uploadError}</div>}
      {value&&<img src={value} alt="" style={{width:'100%',maxHeight:100,objectFit:'cover',borderRadius:'8px',marginTop:'6px'}}/>}
    </div>
  )
}

function CarouselTab() {
  const [items, setItems] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ item_type:'ad', title:'', subtitle:'', image_url:'', sponsor_name:'', link_url:'', content:'', display_order:0 })
  const [approving, setApproving] = useState(null)
  const [priceInputs, setPriceInputs] = useState({}) // submissionId -> string
  const [requestingPaymentId, setRequestingPaymentId] = useState(null)
  const [paymentResults, setPaymentResults] = useState({}) // submissionId -> {paymentUrl, emailSent, ...} | {error}

  async function load() {
    setLoading(true)
    const [{data:i},{data:s}] = await Promise.all([
      supabase.from('home_carousel_items').select('*').order('display_order'),
      supabase.from('home_carousel_submissions').select('*').eq('status','pending').order('submitted_at',{ascending:false}),
    ])
    setItems(i||[])
    setSubmissions(s||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleSubmit() {
    if (!form.title.trim()) return
    if (!form.link_url.trim() && !form.content.trim()) return
    setSaving(true)
    await supabase.from('home_carousel_items').insert({
      item_type: form.item_type, title: form.title.trim(), subtitle: form.subtitle.trim()||null,
      image_url: form.image_url.trim()||null, sponsor_name: form.sponsor_name.trim()||null,
      link_url: form.link_url.trim()||null, content: form.content.trim()||null,
      display_order: parseInt(form.display_order)||0, active: true,
    })
    setSaving(false)
    setCreating(false)
    setForm({ item_type:'ad', title:'', subtitle:'', image_url:'', sponsor_name:'', link_url:'', content:'', display_order:0 })
    load()
  }

  async function toggleActive(item) {
    await supabase.from('home_carousel_items').update({ active: !item.active }).eq('id', item.id)
    load()
  }

  async function handleDelete(item) {
    await supabase.from('home_carousel_items').delete().eq('id', item.id)
    load()
  }

  async function handleApprove(sub) {
    setApproving(sub.id)
    const maxOrder = items.reduce((m,i)=>Math.max(m,i.display_order||0), 0)
    await supabase.from('home_carousel_items').insert({
      item_type: sub.item_type, title: sub.title, subtitle: sub.subtitle,
      image_url: sub.image_url, sponsor_name: sub.sponsor_name,
      link_url: sub.link_url, cta_label: sub.cta_label, content_blocks: sub.content_blocks,
      display_order: maxOrder+1, active: true,
    })
    await supabase.from('home_carousel_submissions').update({ status:'approved', reviewed_at:new Date().toISOString() }).eq('id', sub.id)
    setApproving(null)
    load()
  }

  async function handleReject(sub) {
    await supabase.from('home_carousel_submissions').update({ status:'rejected', reviewed_at:new Date().toISOString() }).eq('id', sub.id)
    load()
  }

  // Sponsor payment - the submission is NOT posted here. This just
  // requests payment (real Stripe Checkout once STRIPE_SECRET_KEY is
  // set in Vercel); the item only goes live once Stripe confirms the
  // charge via the webhook, which is the only thing that actually
  // inserts into home_carousel_items for a paid slot.
  async function handleRequestPayment(sub) {
    const amount = parseFloat(priceInputs[sub.id])
    if (!amount || amount <= 0) return
    setRequestingPaymentId(sub.id)
    const res = await fetch('/api/sponsor/create_checkout_session', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ submissionId: sub.id, amountHKD: amount }),
    })
    const data = await res.json()
    setPaymentResults(prev => ({...prev, [sub.id]: data}))
    setRequestingPaymentId(null)
  }

  return (
    <div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>Ads and newsletter cards shown on the patient home screen, plus articles sponsors submit themselves at <strong>medsa.health/sponsor-submit</strong> - nothing from that form goes live until you approve it below.</div>

      {submissions.length>0&&<>
        <div style={{fontSize:'15px',fontWeight:600,marginBottom:'10px'}}>Pending submissions ({submissions.length})</div>
        {submissions.map(sub=>(
          <div key={sub.id} style={{background:C.cream,border:`0.5px solid ${C.amber}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
            {sub.image_url&&<img src={sub.image_url} alt="" style={{width:'100%',maxHeight:120,objectFit:'cover',borderRadius:'8px',marginBottom:'8px'}}/>}
            <div style={{fontSize:'14px',fontWeight:600}}>{sub.title}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>{sub.item_type} · from {sub.sponsor_name} ({sub.sponsor_contact_email})</div>
            {sub.subtitle&&<div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>{sub.subtitle}</div>}
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>{(sub.content_blocks||[]).length} content block{(sub.content_blocks||[]).length===1?'':'s'}{sub.link_url?' · has a CTA link':''}</div>
            <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
              <button onClick={()=>handleReject(sub)} style={{flex:1,padding:'8px',background:C.redLight,color:C.red,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>Reject</button>
              <button onClick={()=>handleApprove(sub)} disabled={approving===sub.id} style={{flex:1,padding:'8px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{approving===sub.id?'Posting…':'Approve & post free'}</button>
            </div>
            <div style={{background:C.card,borderRadius:'8px',padding:'10px'}}>
              <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>Or charge the sponsor before it goes live - the amount below is what Medsa receives; the sponsor's card is charged slightly more to cover Stripe's processing fee (est. ~3.4% + HK$2.35), so Medsa's cut isn't reduced by it:</div>
              <div style={{display:'flex',gap:'6px'}}>
                <input type="number" step="0.01" value={priceInputs[sub.id]||''} onChange={e=>setPriceInputs(prev=>({...prev,[sub.id]:e.target.value}))} placeholder="Amount Medsa receives (HK$)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'7px 8px',fontSize:'12px',boxSizing:'border-box'}}/>
                <button onClick={()=>handleRequestPayment(sub)} disabled={requestingPaymentId===sub.id||!priceInputs[sub.id]} style={{padding:'7px 12px',background:C.navy,color:'#fff',border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>{requestingPaymentId===sub.id?'Requesting…':'Request payment'}</button>
              </div>
              {paymentResults[sub.id]?.status==='NOT_CONFIGURED'&&<div style={{fontSize:'11px',color:C.amber,marginTop:'6px'}}>{paymentResults[sub.id].message}</div>}
              {paymentResults[sub.id]?.status==='CREATED'&&<div style={{fontSize:'11px',color:C.green,marginTop:'6px'}}>
                Sponsor will be charged HK${paymentResults[sub.id].grossAmountHKD?.toFixed(2)} (includes est. HK${paymentResults[sub.id].estimatedFeeHKD?.toFixed(2)} processing fee) so Medsa nets the full amount. Payment link {paymentResults[sub.id].emailSent?'emailed to the sponsor':'created (email not sent - ' + paymentResults[sub.id].emailReason + ')'}: <a href={paymentResults[sub.id].paymentUrl} target="_blank" rel="noreferrer">{paymentResults[sub.id].paymentUrl}</a>
              </div>}
              {paymentResults[sub.id]?.status==='ERROR'&&<div style={{fontSize:'11px',color:C.red,marginTop:'6px'}}>{paymentResults[sub.id].message}</div>}
            </div>
          </div>
        ))}
      </>}

      <div style={{fontSize:'15px',fontWeight:600,margin:'20px 0 10px'}}>Live cards</div>
      {!creating&&<button onClick={()=>setCreating(true)} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer',marginBottom:'20px'}}>+ Add card yourself</button>}

      {creating&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
        <div style={{fontSize:'15px',fontWeight:600,marginBottom:'14px'}}>New card</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          {['ad','newsletter'].map(t=>(
            <div key={t} onClick={()=>setForm(f=>({...f,item_type:t}))} style={{flex:1,padding:'8px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:form.item_type===t?C.green:C.card,color:form.item_type===t?'#fff':C.text,textTransform:'capitalize'}}>{t}</div>
          ))}
        </div>
        {[['title','Title'],['subtitle','Subtitle'],['sponsor_name','Sponsor / brand name (optional)']].map(([field,ph]) => (
          <input key={field} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph}
            style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        ))}
        <AdminImagePicker label="Image" value={form.image_url} onChange={v=>setForm(f=>({...f,image_url:v}))}/>
        {[['link_url','External link (opens outside the app)'],['display_order','Display order (lower shows first)']].map(([field,ph]) => (
          <input key={field} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph}
            style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        ))}
        <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={4} placeholder="In-app content (for a newsletter article - leave blank if using an external link instead)"
          style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px',resize:'vertical',fontFamily:'inherit'}}/>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setCreating(false)} style={{flex:1,padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving||!form.title.trim()||(!form.link_url.trim()&&!form.content.trim())} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{saving?'Saving…':'Add card'}</button>
        </div>
      </div>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&items.map(item => (
        <div key={item.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
            <div>
              <div style={{fontSize:'14px',fontWeight:600}}>{item.title}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{item.item_type}{item.sponsor_name?` · ${item.sponsor_name}`:''} · order {item.display_order}</div>
            </div>
            <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:item.active?C.greenLight:C.card,color:item.active?C.green:C.textMuted,fontWeight:600}}>{item.active?'active':'inactive'}</span>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>toggleActive(item)} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{item.active?'Deactivate':'Reactivate'}</button>
            <button onClick={()=>handleDelete(item)} style={{flex:1,padding:'8px',background:C.redLight,color:C.red,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h=>h.trim())
  return lines.slice(1).filter(l=>l.trim()).map(line=>{
    const values = (line.match(/(".*?"|[^",]+)(?=,|$)/g)||[]).map(v=>v.trim().replace(/^"|"$/g,''))
    const row = {}
    headers.forEach((h,i)=>row[h]=values[i]||'')
    return row
  })
}

// Same normalization PatientApp.jsx's forum uses for new products -
// kept in sync manually since these are two separate files.
const FORUM_FILLER_WORDS = new Set(['extra','strength','tablets','tablet','capsules','capsule','caps','softgel','softgels','mg','ml','plus','the','a','an'])
function normalizeProductName(name) {
  return (name||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/)
    .filter(w=>w && !FORUM_FILLER_WORDS.has(w) && !/^\d+$/.test(w)).sort().join(' ')
}

// Same scoring PatientApp.jsx's forum uses for new products - kept in
// sync manually since these are two separate files. Word-overlap alone
// misses a typo-duplicate like "panadol" vs "panadoll" (zero shared
// whole words); character-level distance on the full normalized string
// catches that case.
function levenshtein(a, b) {
  const dp = Array.from({length:a.length+1},()=>new Array(b.length+1).fill(0))
  for (let i=0;i<=a.length;i++) dp[i][0]=i
  for (let j=0;j<=b.length;j++) dp[0][j]=j
  for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++)
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1])
  return dp[a.length][b.length]
}
function nameSimilarity(a, b) {
  const wordsA = new Set(a.split(' ').filter(Boolean))
  const wordsB = new Set(b.split(' ').filter(Boolean))
  const jaccard = wordsA.size && wordsB.size ? [...wordsA].filter(w=>wordsB.has(w)).length / new Set([...wordsA,...wordsB]).size : 0
  const dist = levenshtein(a, b)
  const charSim = 1 - dist / Math.max(a.length, b.length, 1)
  return Math.max(jaccard, charSim)
}

function ForumModerationTab() {
  const [flags, setFlags] = useState([])
  const [reportedPosts, setReportedPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sponsorSearch, setSponsorSearch] = useState('')
  const [sponsorResults, setSponsorResults] = useState([])
  const [sponsorName, setSponsorName] = useState('')
  const [rescanning, setRescanning] = useState(false)
  const [rescanResult, setRescanResult] = useState(null)
  const [editingPhotoFor, setEditingPhotoFor] = useState(null)
  const [bulkProductResult, setBulkProductResult] = useState(null)

  // One-off (and repeatable) catch-up scan across every existing
  // product pair - needed because the duplicate check only ever ran
  // once, at the moment the second of a pair was created, using
  // whatever scoring existed then. A product created before a scoring
  // improvement (like the typo fix above) never got re-checked against
  // its actual duplicate.
  async function handleRescan() {
    setRescanning(true)
    setRescanResult(null)
    const { data: allProducts } = await supabase.from('forum_products').select('id, canonical_name, normalized_name')
    const { data: existingFlags } = await supabase.from('forum_duplicate_flags').select('product_id_a, product_id_b')
    const alreadyFlagged = new Set((existingFlags||[]).map(f => [f.product_id_a, f.product_id_b].sort().join('|')))
    let found = 0
    const products = allProducts||[]
    for (let i=0;i<products.length;i++) {
      for (let j=i+1;j<products.length;j++) {
        const a = products[i], b = products[j]
        const pairKey = [a.id, b.id].sort().join('|')
        if (alreadyFlagged.has(pairKey)) continue
        const score = nameSimilarity(a.normalized_name||'', b.normalized_name||'')
        if (score >= 0.5) {
          await supabase.from('forum_duplicate_flags').insert({
            product_id_a: a.id, product_id_b: b.id,
            similarity_reason: `${Math.round(score*100)}% match (re-scan): "${a.canonical_name}" vs "${b.canonical_name}"`,
          })
          alreadyFlagged.add(pairKey)
          found++
        }
      }
    }
    setRescanning(false)
    setRescanResult(found)
    load()
  }

  async function load() {
    setLoading(true)
    const [{data:f},{data:p}] = await Promise.all([
      supabase.from('forum_duplicate_flags').select('*, product_a:product_id_a(canonical_name, post_count), product_b:product_id_b(canonical_name, post_count)').eq('status','pending').order('created_at',{ascending:false}),
      supabase.from('forum_posts').select('*').eq('flagged_for_review', true).order('created_at',{ascending:false}),
    ])
    setFlags(f||[])
    setReportedPosts(p||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Merges B into A - every post moves, B disappears. Never automatic;
  // an employee always makes this call after reading both names.
  async function handleMerge(flag, keepField, mergeField) {
    const keepId = flag[keepField], mergeId = flag[mergeField]
    await supabase.from('forum_posts').update({ product_id: keepId }).eq('product_id', mergeId)
    const { data: keepRow } = await supabase.from('forum_products').select('post_count').eq('id', keepId).maybeSingle()
    const { data: mergeRow } = await supabase.from('forum_products').select('post_count').eq('id', mergeId).maybeSingle()
    await supabase.from('forum_products').update({ post_count: (keepRow?.post_count||0)+(mergeRow?.post_count||0) }).eq('id', keepId)
    await supabase.from('forum_products').delete().eq('id', mergeId)
    await supabase.from('forum_duplicate_flags').update({ status:'merged', resolved_at:new Date().toISOString() }).eq('id', flag.id)
    load()
  }

  async function handleDismiss(flag) {
    await supabase.from('forum_duplicate_flags').update({ status:'dismissed', resolved_at:new Date().toISOString() }).eq('id', flag.id)
    load()
  }

  async function handleClearReport(post) {
    await supabase.from('forum_posts').update({ flagged_for_review: false }).eq('id', post.id)
    load()
  }

  async function handleDeletePost(post) {
    await supabase.from('forum_posts').delete().eq('id', post.id)
    load()
  }

  async function searchProductsForSponsor() {
    if (!sponsorSearch.trim()) { setSponsorResults([]); return }
    const { data } = await supabase.from('forum_products').select('*').ilike('canonical_name', `%${sponsorSearch.trim()}%`)
    setSponsorResults(data||[])
  }

  async function setSponsor(product) {
    await supabase.from('forum_products').update({ sponsored_by: sponsorName.trim()||null }).eq('id', product.id)
    searchProductsForSponsor()
  }

  // Product photos are admin-set only, never patient-uploaded - same
  // reasoning as ads: Medsa doesn't want to be responsible for curating
  // what content ends up representing a product's identity.
  async function setProductImage(product, url) {
    await supabase.from('forum_products').update({ image_url: url||null }).eq('id', product.id)
    setEditingPhotoFor(null)
    searchProductsForSponsor()
  }

  // Seeds starter products so the forum isn't empty on day one - real
  // discussion still only happens when a patient actually posts;
  // this just gives them something to find and rate instead of a
  // blank search box with no examples.
  async function handleBulkProductImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const rows = parseCSV(text)
    let imported = 0
    const skipped = []
    for (const row of rows) {
      if (!row.canonical_name?.trim()) { skipped.push('(blank row)'); continue }
      const normalized = normalizeProductName(row.canonical_name)
      const { data: existing } = await supabase.from('forum_products').select('id').eq('normalized_name', normalized).maybeSingle()
      if (existing) { skipped.push(`${row.canonical_name} - already exists`); continue }
      await supabase.from('forum_products').insert({
        canonical_name: row.canonical_name.trim(), normalized_name: normalized,
        image_url: row.image_url?.trim() || null, sponsored_by: row.sponsored_by?.trim() || null,
      })
      imported++
    }
    setBulkProductResult({ imported, skipped, total: rows.length })
  }

  return (
    <div>
      <div style={{fontSize:'15px',fontWeight:600,marginBottom:'10px'}}>Likely-duplicate threads ({flags.length})</div>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>Flagged automatically by name similarity - nothing merges without your confirmation. New products are checked as they're created; use this to catch up existing ones too (e.g. after a scoring improvement, or just to double-check).</div>
      <button onClick={handleRescan} disabled={rescanning} style={{padding:'8px 14px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',marginBottom:'6px'}}>{rescanning?'Scanning…':'Re-scan all products for duplicates'}</button>
      {rescanResult!==null&&<div style={{fontSize:'12px',color:C.green,marginBottom:'10px'}}>Found {rescanResult} new likely-duplicate pair{rescanResult===1?'':'s'}.</div>}
      {rescanResult===null&&<div style={{marginBottom:'14px'}}/>}
      {loading&&<div style={{textAlign:'center',padding:'16px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&flags.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'20px'}}>Nothing pending.</div>}
      {flags.map(flag=>(
        <div key={flag.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>{flag.similarity_reason}</div>
          <div style={{fontSize:'13px',marginBottom:'4px'}}><strong>{flag.product_a?.canonical_name}</strong> ({flag.product_a?.post_count||0} posts)</div>
          <div style={{fontSize:'13px',marginBottom:'10px'}}><strong>{flag.product_b?.canonical_name}</strong> ({flag.product_b?.post_count||0} posts)</div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <button onClick={()=>handleMerge(flag,'product_id_a','product_id_b')} style={{flex:1,padding:'8px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer'}}>Merge into "{flag.product_a?.canonical_name}"</button>
            <button onClick={()=>handleMerge(flag,'product_id_b','product_id_a')} style={{flex:1,padding:'8px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer'}}>Merge into "{flag.product_b?.canonical_name}"</button>
            <button onClick={()=>handleDismiss(flag)} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer'}}>Not a duplicate</button>
          </div>
        </div>
      ))}

      <div style={{fontSize:'15px',fontWeight:600,marginTop:'24px',marginBottom:'10px'}}>Reported posts ({reportedPosts.length})</div>
      {!loading&&reportedPosts.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'20px'}}>Nothing reported.</div>}
      {reportedPosts.map(post=>(
        <div key={post.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{fontSize:'12px',fontWeight:600,marginBottom:'4px'}}>{post.pseudonym}</div>
          <div style={{fontSize:'13px',marginBottom:'10px'}}>{post.body}</div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>handleClearReport(post)} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>Clear report</button>
            <button onClick={()=>handleDeletePost(post)} style={{flex:1,padding:'8px',background:C.redLight,color:C.red,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>Delete post</button>
          </div>
        </div>
      ))}

      <div style={{fontSize:'15px',fontWeight:600,marginTop:'24px',marginBottom:'10px'}}>Sponsor a product thread & set its photo</div>
      <input value={sponsorSearch} onChange={e=>setSponsorSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchProductsForSponsor()} placeholder="Search a product…" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
      <input value={sponsorName} onChange={e=>setSponsorName(e.target.value)} placeholder="Sponsor / brand name (leave blank to remove sponsorship)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
      <button onClick={searchProductsForSponsor} style={{width:'100%',padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',marginBottom:'12px'}}>Search</button>
      {sponsorResults.map(p=>(
        <div key={p.id} style={{padding:'10px 0',borderBottom:`0.5px solid ${C.border}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px',flex:1}}>
              {p.image_url&&<img src={p.image_url} alt="" style={{width:32,height:32,objectFit:'cover',borderRadius:'6px'}}/>}
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{p.canonical_name}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{p.sponsored_by?`Sponsored by ${p.sponsored_by}`:'Not sponsored'}</div>
              </div>
            </div>
            <div style={{display:'flex',gap:'6px',flexShrink:0}}>
              <button onClick={()=>setEditingPhotoFor(editingPhotoFor===p.id?null:p.id)} style={{padding:'6px 12px',background:C.card,border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer'}}>Photo</button>
              <button onClick={()=>setSponsor(p)} style={{padding:'6px 12px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer'}}>Set sponsor</button>
            </div>
          </div>
          {editingPhotoFor===p.id&&<div style={{marginTop:'10px'}}><AdminImagePicker label="" value={p.image_url} onChange={url=>setProductImage(p, url)}/></div>}
        </div>
      ))}

      <div style={{fontSize:'15px',fontWeight:600,marginTop:'24px',marginBottom:'10px'}}>Bulk-seed starter products</div>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>CSV with canonical_name (required), image_url and sponsored_by (both optional) - gives patients something to find and rate instead of an empty search box on day one. Skips anything that already exists.</div>
      <label style={{display:'inline-block',fontSize:'12px',fontWeight:600,padding:'9px 16px',borderRadius:'10px',cursor:'pointer',background:C.card,color:C.textSub,marginBottom:'12px'}}>
        {'↑'} Bulk import products CSV
        <input type="file" accept=".csv" onChange={handleBulkProductImport} style={{display:'none'}}/>
      </label>
      {bulkProductResult&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:C.green}}>
        Imported {bulkProductResult.imported} of {bulkProductResult.total} rows.
        {bulkProductResult.skipped.length>0&&<div style={{marginTop:'4px'}}>Skipped: {bulkProductResult.skipped.join(', ')}</div>}
      </div>}
    </div>
  )
}
