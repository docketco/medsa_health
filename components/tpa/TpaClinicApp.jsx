import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import C from '../shared/colours'
import { getInsuranceAdapter, calculatePlatformClaimFee } from '../../lib/insuranceAdapter'

// ── OUT-OF-NETWORK CLAIM INTAKE ("Uber Eats" side of the insurance work) ──
// A clinic that has never adopted ClinicOps as its EMR can still submit a
// claim through Medsa - same real adjudication engine (deductible/copay
// math, eligibility, practitioner verification) as a native ClinicOps
// clinic, for the same per-claim platform fee. Medsa never becomes this
// clinic's EMR - it's purely the biller/router here. Login is
// admin-provisioned (medsa-admin's TPA Clinics tab), not self-serve.

function Btn({ children, onClick, variant='secondary', style:sx={}, disabled }) {
  const base={border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:500,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:disabled?0.5:1,...sx}
  const V={primary:{background:C.green,color:'#fff'},secondary:{background:C.card,color:C.text,border:`0.5px solid ${C.border}`},danger:{background:C.red,color:'#fff'}}
  return <button style={{...base,...V[variant]}} onClick={onClick} disabled={disabled}>{children}</button>
}
function Card({ children, style:sx={} }) {
  return <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'18px',...sx}}>{children}</div>
}
function PageWrap({ children, maxWidth=560 }) {
  return <div style={{maxWidth, margin:'0 auto', width:'100%', padding:'32px 20px'}}>{children}</div>
}
function StatusBadge({ status }) {
  const map = {
    APPROVED: [C.greenLight, C.green, 'Approved'], SETTLED: [C.greenLight, C.green, 'Settled'],
    PARTIALLY_APPROVED: [C.blueLight, C.blue, 'Partially approved'],
    PENDING_REVIEW: [C.amberLight, C.amber, 'Pending review'],
    REJECTED: [C.redLight, C.red, 'Rejected'],
  }
  const [bg,fg,label] = map[status] || [C.card, C.textMuted, status]
  return <span style={{fontSize:'11px',background:bg,color:fg,padding:'4px 10px',borderRadius:'20px',fontWeight:600,whiteSpace:'nowrap'}}>{label}</span>
}

const CLAIM_CATEGORIES = ['Outpatient','Specialist','Hospitalisation','Labs & imaging','Dental (basic)','Surgery','Mental health']

function TpaLogin({ onLogin }) {
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [checking,setChecking]=useState(false)
  const [error,setError]=useState(null)

  async function handleLogin() {
    setChecking(true)
    setError(null)
    const { data: clinic } = await supabase.from('external_clinics').select('id, clinic_name, status')
      .ilike('contact_email', email.trim()).maybeSingle()
    if (!clinic || clinic.status !== 'active') { setChecking(false); setError('No active TPA clinic account matches that email.'); return }
    const { data: ok } = await supabase.rpc('verify_external_clinic_password', { p_clinic_id: clinic.id, p_password: password })
    setChecking(false)
    if (!ok) { setError('Incorrect password.'); return }
    onLogin({ id: clinic.id, name: clinic.clinic_name })
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{fontSize:'22px',fontWeight:700,color:C.text}}>Medsa Claims Portal</div>
          <div style={{fontSize:'13px',color:C.textSub,marginTop:'4px'}}>For clinics submitting claims through Medsa without using ClinicOps</div>
        </div>
        <Card>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Contact email" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'14px',boxSizing:'border-box'}}/>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={handleLogin} disabled={checking||!email||!password}>{checking?'Checking…':'Sign in'}</Btn>
        </Card>
        <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginTop:'16px',lineHeight:1.5}}>Not onboarded yet? This is a real relationship, not self-serve - contact Medsa to get set up.</div>
      </div>
    </div>
  )
}

function SubmitClaimScreen({ clinic }) {
  const [hkid,setHkid]=useState('')
  const [lookingUp,setLookingUp]=useState(false)
  const [patient,setPatient]=useState(null)
  const [patientError,setPatientError]=useState(null)

  const [category,setCategory]=useState(CLAIM_CATEGORIES[0])
  const [description,setDescription]=useState('')
  const [amount,setAmount]=useState('')

  const [submitting,setSubmitting]=useState(false)
  const [result,setResult]=useState(null) // {status, fees, ...} | {error}

  const [recentClaims,setRecentClaims]=useState([])
  const [loadingClaims,setLoadingClaims]=useState(true)

  async function loadRecentClaims() {
    setLoadingClaims(true)
    const { data } = await supabase.from('insurance_claims')
      .select('claim_ref, amount, status, platform_claim_fee, submitted_at, patients(full_name)')
      .eq('source_type','external_clinic').eq('external_clinic_id', clinic.id)
      .order('submitted_at',{ascending:false}).limit(20)
    setRecentClaims(data||[])
    setLoadingClaims(false)
  }
  useEffect(() => { loadRecentClaims() }, [])

  async function handleLookupPatient() {
    setLookingUp(true)
    setPatientError(null)
    setPatient(null)
    const { data } = await supabase.from('patients').select('id, full_name, medsa_id, date_of_birth').eq('hkid', hkid.trim()).maybeSingle()
    setLookingUp(false)
    if (!data) { setPatientError('No Medsa patient matches this HKID. The patient needs a Medsa profile (any registration path) before a claim can be submitted for them.'); return }
    setPatient(data)
  }

  async function handleSubmit() {
    if (!patient || !amount) return
    setSubmitting(true)
    setResult(null)
    const adapter = getInsuranceAdapter()
    const grossAmount = parseFloat(amount)
    const adjudication = await adapter.adjudicateClaim({
      patientId: patient.id,
      clinicId: clinic.id,
      sourceType: 'external_clinic',
      totalGrossAmount: grossAmount,
      items: [{ code: category, description: description || category, amount: grossAmount, category }],
      verificationMethod: 'HKID_LOOKUP',
      verificationPayload: { hkid: hkid.trim() },
    })
    setSubmitting(false)
    setResult(adjudication)
    if (adjudication.status !== 'REJECTED' || adjudication.fees) {
      setAmount(''); setDescription('')
      loadRecentClaims()
    }
  }

  return (
    <PageWrap maxWidth={640}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <div>
          <div style={{fontSize:'20px',fontWeight:700}}>{clinic.name}</div>
          <div style={{fontSize:'12px',color:C.textSub}}>Medsa Claims Portal</div>
        </div>
      </div>

      <Card style={{marginBottom:'20px'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'14px'}}>Submit a claim</div>

        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px',textTransform:'uppercase',fontWeight:600}}>Patient</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'6px'}}>
          <input value={hkid} onChange={e=>{setHkid(e.target.value);setPatient(null)}} placeholder="Patient's HKID" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          <Btn onClick={handleLookupPatient} disabled={lookingUp||!hkid.trim()}>{lookingUp?'Looking up…':'Find patient'}</Btn>
        </div>
        {patientError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{patientError}</div>}
        {patient&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.text}}>
          ✓ {patient.full_name} · {patient.medsa_id} · DOB {new Date(patient.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}
        </div>}

        {patient&&<>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px',textTransform:'uppercase',fontWeight:600}}>Claim details</div>
          <select value={category} onChange={e=>setCategory(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}>
            {CLAIM_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description (optional)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}/>
          <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount (HK$)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box'}}/>
          {amount&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'12px'}}>Medsa's processing fee if approved: <strong>HK${calculatePlatformClaimFee(amount)}</strong> (2% + HK$10), charged to the insurer, never deducted from the clinic.</div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={handleSubmit} disabled={submitting||!amount}>{submitting?'Submitting…':'Submit claim'}</Btn>
        </>}

        {result&&<div style={{marginTop:'16px',paddingTop:'16px',borderTop:`0.5px solid ${C.border}`}}>
          {result.verificationError
            ? <div style={{fontSize:'13px',color:C.red}}>Not eligible: {result.verificationError}</div>
            : <>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                  <StatusBadge status={result.status}/>
                  <span style={{fontSize:'12px',color:C.textSub}}>{result.claimId}</span>
                </div>
                {result.fees&&<div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>
                  Insurer covers: <strong>HK${result.fees.insurerCoveredAmount.toFixed(0)}</strong> · Patient owes: <strong>HK${result.fees.patientPayableTotal.toFixed(0)}</strong> · Medsa's fee: <strong>HK${result.fees.platformClaimFee}</strong>
                </div>}
              </>}
        </div>}
      </Card>

      <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.9px',color:C.textMuted,marginBottom:'10px'}}>Recent claims from {clinic.name}</div>
      {loadingClaims&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'16px'}}>Loading…</div>}
      {!loadingClaims&&recentClaims.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'16px'}}>No claims submitted yet.</div>}
      {recentClaims.map(c=>(
        <Card key={c.claim_ref} style={{padding:'12px 16px',marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:500}}>{c.patients?.full_name||'Unknown patient'}</div>
            <div style={{fontSize:'11px',color:C.textMuted}}>{c.claim_ref} · HK${c.amount} · fee HK${c.platform_claim_fee||0}</div>
          </div>
          <StatusBadge status={(c.status||'').toUpperCase()}/>
        </Card>
      ))}
    </PageWrap>
  )
}

export default function TpaClinicApp() {
  const [clinic,setClinic]=useState(null)
  if (!clinic) return <TpaLogin onLogin={setClinic}/>
  return (
    <div style={{minHeight:'100vh',background:C.beige}}>
      <div style={{maxWidth:640,margin:'0 auto',padding:'16px 20px 0',textAlign:'right'}}>
        <span onClick={()=>setClinic(null)} style={{fontSize:'12px',color:C.textSub,cursor:'pointer'}}>Sign out</span>
      </div>
      <SubmitClaimScreen clinic={clinic}/>
    </div>
  )
}
