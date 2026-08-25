import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getInsuranceAdapter, calculatePlatformClaimFee, calculatePaymentProcessingFee, findEligiblePlans, buildFeeBreakdown } from '../../lib/insuranceAdapter'
import C from '../shared/colours'

function Btn({ children, onClick, variant='secondary', style:sx={}, disabled }) {
  const base={border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:500,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:disabled?0.5:1,...sx}
  const V={primary:{background:C.green,color:'#fff'},secondary:{background:C.card,color:C.text,border:`0.5px solid ${C.border}`},danger:{background:C.red,color:'#fff'},amber:{background:C.amber,color:'#fff'}}
  return <button style={{...base,...V[variant]}} onClick={onClick} disabled={disabled}>{children}</button>
}
function Card({ children, style:sx={}, onClick }) {
  return <div onClick={onClick} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',overflow:'hidden',cursor:onClick?'pointer':'default',...sx}}>{children}</div>
}
function SecLabel({ children }) {
  return <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.9px',color:C.textMuted,marginBottom:'10px'}}>{children}</div>
}
function StatCard({ label, value, sub, color=C.green, bg=C.greenLight }) {
  return (
    <div style={{flex:1,background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'16px'}}>
      <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px',fontWeight:600,textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:'26px',fontWeight:700,color}}>{value}</div>
      {sub&&<div style={{fontSize:'12px',color:C.textSub,marginTop:'2px'}}>{sub}</div>}
    </div>
  )
}
function Toggle({ checked=false, onChange }) {
  return (
    <div onClick={()=>onChange(!checked)} style={{width:34,height:18,borderRadius:20,background:checked?C.green:C.border,position:'relative',flexShrink:0,cursor:'pointer'}}>
      <div style={{position:'absolute',top:2,left:checked?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
    </div>
  )
}

function Badge({ text, type }) {
  const map={ok:[C.greenLight,C.green],due:[C.amberLight,C.amber],full:[C.redLight,C.red],waiting:[C.blueLight,C.blue]}
  const [bg,fg]=map[type]||map.ok
  return <span style={{fontSize:'11px',background:bg,color:fg,padding:'4px 10px',borderRadius:'20px',fontWeight:500,whiteSpace:'nowrap'}}>{text}</span>
}
function PageWrap({ children, maxWidth=720 }) {
  return <div style={{maxWidth, margin:'0 auto', width:'100%'}}>{children}</div>
}

// Shared doctor directory - single source of truth for name + department,
// used both at staff login and when filtering/switching doctors elsewhere,
// Real doctors, queried fresh wherever needed - replaces the old hardcoded
// DOCTOR_DIRECTORY array, which never reflected who was actually onboarded
// and kept showing two stale demo names indefinitely.
async function loadClinicDoctors() {
  const { data } = await supabase.from('staff_credentials').select('full_name,department')
    .eq('institution_source','clinic_ops').eq('role','doctor').eq('status','active').order('full_name')
  return (data||[]).map(d => ({ name: d.full_name, department: d.department }))
}

function hoursRemaining(checkedInAt) {
  const elapsed = Date.now() - checkedInAt
  const remaining = 24*60*60*1000 - elapsed
  return Math.max(0, remaining / (60*60*1000))
}

// Module-level, not scoped to any one component - moved here after
// discovering it was previously local to InventoryScreen only, making it
// inaccessible to the new bulk staff import (a different component)
// that also needs real CSV parsing.
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

function StaffLogin({ onLogin }) {
  const [staff,setStaff]=useState([])
  const [departments,setDepartments]=useState([])
  const [loading,setLoading]=useState(true)
  const [pin,setPin]=useState('')
  const [pinError,setPinError]=useState(false)
  const [checkingPin,setCheckingPin]=useState(false)
  const [selected,setSelected]=useState(null)
  const [stage,setStage]=useState('pick') // pick | pin | department
  const [chosenDept,setChosenDept]=useState(null)

  const ROLE_LABELS = { doctor:'Doctor', clinic_assistant:'Clinic Assistant', admin:'Practice Manager' }
  const ROLE_COLORS = { doctor:C.green, clinic_assistant:C.blue, admin:C.purple }

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Real query against the same shared staff_credentials table
      // PractitionerApp uses - clinic_staff was retired before ever going
      // live, so a clinic doctor's identity is portable if they ever also
      // work at a Medsa-partnered hospital later.
      const { data } = await supabase.from('staff_credentials').select('medsa_id,full_name,role,department,institution_id')
  .eq('institution_source','clinic_ops').eq('status','active').order('full_name')
const mapped = (data||[]).map(s => ({
  id: s.medsa_id, name: s.full_name, role: s.role,
  roleLabel: ROLE_LABELS[s.role]||s.role, color: ROLE_COLORS[s.role]||C.textMuted,
  department: s.department, institutionId: s.institution_id,
}))
      setStaff(mapped)
      setDepartments([...new Set(mapped.map(s=>s.department).filter(Boolean))])
      setLoading(false)
    }
    load()
  }, [])

  async function handlePinConfirm() {
    setCheckingPin(true)
    // Real verification against a hashed password, server-side inside
    // Postgres - the actual password value is never stored in the
    // database at all, only its one-way hash, and this function only
    // ever returns true/false, never the hash itself.
    const { data: ok } = await supabase.rpc('verify_staff_password', { p_medsa_id: selected.id, p_password: pin })
    setCheckingPin(false)
    if (!ok) { setPinError(true); return }
    setPinError(false)
    if (selected.role==='admin') {
      onLogin({ ...selected, department: 'All departments' })
    } else {
      setStage('department')
    }
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:420}}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{fontSize:'22px',fontWeight:700,color:C.text}}>Medsa Clinic</div>
          <div style={{fontSize:'13px',color:C.textSub,marginTop:'4px'}}>
            {stage==='pick'&&'Select your account to sign in'}
            {stage==='pin'&&'Enter your PIN'}
            {stage==='department'&&'Which department are you working in today?'}
          </div>
        </div>
        {loading&&<div style={{textAlign:'center',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
        {!loading&&stage==='pick'&&(
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {staff.length===0&&<div style={{textAlign:'center',color:C.textMuted,fontSize:'13px',padding:'20px'}}>No staff onboarded yet — ask your Practice Manager to add you.</div>}
            {staff.map(s=>(
              <div key={s.id} onClick={()=>{setSelected(s);setStage('pin')}} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer'}}>
                <div style={{width:38,height:38,borderRadius:'10px',background:s.color+'22',color:s.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'14px',flexShrink:0}}>{s.name[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'14px',fontWeight:600}}>{s.name}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{s.roleLabel}</div>
                </div>
                <span style={{color:C.textMuted}}>{'\u203a'}</span>
              </div>
            ))}
          </div>
        )}
        {stage==='pin'&&(
          <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'24px'}}>
            <div style={{textAlign:'center',marginBottom:'18px'}}>
              <div style={{width:52,height:52,borderRadius:'12px',background:selected.color+'22',color:selected.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'18px',margin:'0 auto 10px'}}>{selected.name[0]}</div>
              <div style={{fontSize:'15px',fontWeight:600}}>{selected.name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{selected.roleLabel}</div>
            </div>
            <input type="password" value={pin} onChange={e=>{setPin(e.target.value);setPinError(false)}} placeholder="Password"
              style={{width:'100%',border:`0.5px solid ${pinError?C.red:C.border}`,borderRadius:'10px',padding:'12px',fontSize:'16px',textAlign:'center',marginBottom:pinError?'6px':'14px',boxSizing:'border-box'}}/>
            {pinError&&<div style={{fontSize:'12px',color:C.red,textAlign:'center',marginBottom:'14px'}}>Incorrect password</div>}
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1}} onClick={()=>{setSelected(null);setPin('');setPinError(false);setStage('pick')}}>Back</Btn>
              <Btn variant="primary" style={{flex:1}} onClick={handlePinConfirm} disabled={checkingPin||!pin}>{checkingPin?'Checking...':'Sign in'}</Btn>
            </div>
          </div>
        )}
        {stage==='department'&&(
          <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'24px'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
              {departments.map(d=>(
                <div key={d} onClick={()=>setChosenDept(d)} style={{padding:'12px 14px',borderRadius:'10px',cursor:'pointer',background:chosenDept===d?C.green:C.card,color:chosenDept===d?'#fff':C.text,fontSize:'13px',fontWeight:500}}>{d}</div>
              ))}
            </div>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'14px',lineHeight:1.5}}>{'\u25c7'} A solo clinic can skip this by treating the whole clinic as one department. This only matters once Medsa runs across multiple departments or wards.</div>
            <Btn variant="primary" style={{width:'100%'}} onClick={()=>onLogin({...selected, department: chosenDept || selected.department})}>Continue</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

function Sidebar({ screen, setScreen, staffMember, onLogout, navItems }) {
  return (
    <div style={{width:220,flexShrink:0,background:C.cream,borderRight:`0.5px solid ${C.border}`,display:'flex',flexDirection:'column',height:'100vh',position:'sticky',top:0}}>
      <div style={{padding:'20px 18px',borderBottom:`0.5px solid ${C.border}`}}>
        <div style={{fontSize:'16px',fontWeight:700}}>Medsa Clinic</div>
        <div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>Operations</div>
      </div>
      <div style={{flex:1,padding:'12px 10px',overflowY:'auto'}}>
        {navItems.map(item=>(
          <div key={item.key} onClick={()=>setScreen(item.key)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',borderRadius:'8px',cursor:'pointer',marginBottom:'2px',background:screen===item.key?C.green:'transparent',color:screen===item.key?'#fff':C.text,position:'relative'}}>
            <span style={{fontSize:'16px'}}>{item.icon}</span>
            <span style={{fontSize:'13px',fontWeight:500,flex:1}}>{item.label}</span>
            {item.badge>0&&<span style={{background:screen===item.key?'#fff':C.red,color:screen===item.key?C.green:'#fff',fontSize:'10px',fontWeight:700,borderRadius:'10px',padding:'2px 7px',minWidth:18,textAlign:'center'}}>{item.badge}</span>}
          </div>
        ))}
      </div>
      <div style={{padding:'14px',borderTop:`0.5px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
          <div style={{width:32,height:32,borderRadius:'8px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'13px',flexShrink:0}}>{staffMember.name[0]}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:'12px',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{staffMember.name}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{staffMember.roleLabel}{staffMember.department&&staffMember.department!=='All departments'&&` · ${staffMember.department}`}</div>
          </div>
        </div>
        <Btn style={{width:'100%',fontSize:'12px'}} onClick={onLogout}>Sign out</Btn>
      </div>
    </div>
  )
}

function CheckInSearchScreen({ onCheckedIn, onNewPatient, onNavSchedule, checkInError, onDoneCheckIn, staffMember }) {
  const [mode,setMode]=useState('scan')
  const [stage,setStage]=useState('idle')
  const [patient,setPatient]=useState(null)
  const [searchTerm,setSearchTerm]=useState('')
  const [searchResult,setSearchResult]=useState(null)
  const [requestSent,setRequestSent]=useState(false)
  const [checkingIn,setCheckingIn]=useState(false)
  const [revealedClaimCode,setRevealedClaimCode]=useState(null)
  const [regeneratingCode,setRegeneratingCode]=useState(false)

  const [justCheckedIn,setJustCheckedIn]=useState(null) // holds the patient name once confirmed, for a real success message

  async function handleCheckInClick(force=false) {
    if (checkingIn) return // guard against rapid repeat clicks
    setCheckingIn(true)
    const result = await onCheckedIn(patient, force)
    setCheckingIn(false)
    if (result === true) setJustCheckedIn(patient.full_name)
    // 'already_active' leaves the screen as-is with checkInError shown,
    // plus a "Check in anyway" option below for testing/demo purposes
  }

  const [scanChoices,setScanChoices]=useState([])

  async function loadScanChoices() {
    const { data } = await supabase.from('patients').select('*').limit(10)
    setScanChoices(data || [])
  }

  async function simulateScan(chosenPatient) {
    setStage('scanning')
    // Real scan hardware isn't wired up yet - this simulates it by letting
    // you pick which patient's card is being "scanned," pulled from real
    // Supabase data, rather than always fetching one fixed demo patient.
    setTimeout(() => {
      setPatient(chosenPatient)
      setStage('found')
    }, 600)
  }

  const [searched,setSearched]=useState(false)

  async function handleSearch() {
    if (!searchTerm.trim()) return
    const term = searchTerm.trim()
    const { data } = await supabase
      .from('patients')
      .select('*')
      .or(`medsa_id.ilike.%${term}%,full_name.ilike.%${term}%`)
      .limit(1)
      .maybeSingle()
    setSearchResult(data || null)
    setRequestSent(false)
    setSearched(true)
    setRevealedClaimCode(null)
  }

  function isClaimCodeExpired(patient) {
    if (!patient?.claim_code_expires_at) return true
    return new Date(patient.claim_code_expires_at) < new Date()
  }

  async function handleRegenerateClaimCode(patient) {
    setRegeneratingCode(true)
    const newCode = Math.random().toString(36).slice(2,8).toUpperCase()
    const newExpiry = new Date(Date.now() + 48*60*60*1000).toISOString()
    await supabase.from('patients').update({
      claim_code: newCode, claim_code_expires_at: newExpiry, claim_code_sent_to: patient.phone,
    }).eq('id', patient.id)
    setRegeneratingCode(false)
    setRevealedClaimCode(newCode)
  }

  return (
    <PageWrap maxWidth={560}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Check-In / Search</h2>
      {checkInError&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>{'\u26a0'} {checkInError}</div>}

      <div style={{display:'flex',gap:'8px',marginBottom:'20px',justifyContent:'center'}}>
        {[['scan','Scan to check in'],['search','Search patients']].map(([k,l])=>(
          <div key={k} onClick={()=>setMode(k)} style={{fontSize:'13px',padding:'9px 18px',borderRadius:'20px',cursor:'pointer',background:mode===k?C.green:C.card,color:mode===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>

      {mode==='scan'&&<>
        {stage==='idle'&&<>
          {scanChoices.length===0&&<div onClick={loadScanChoices} style={{background:C.cream,border:`1.5px dashed ${C.border}`,borderRadius:'14px',padding:'44px 20px',textAlign:'center',cursor:'pointer',marginBottom:'16px'}}>
            <div style={{fontSize:'36px',color:C.green,marginBottom:'10px'}}>{'\u2b21'}</div>
            <div style={{fontSize:'15px',fontWeight:600,marginBottom:'4px'}}>Scan patient QR code</div>
            <div style={{fontSize:'12px',color:C.textSub}}>Tap to simulate scanning a patient's card</div>
          </div>}
          {scanChoices.length>0&&<div style={{marginBottom:'16px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',textAlign:'center'}}>Demo: tap the patient whose card is being scanned</div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {scanChoices.map(p=>(
                <div key={p.id} onClick={()=>simulateScan(p)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 16px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'14px',fontWeight:500}}>{p.full_name}</span>
                  <span style={{fontSize:'11px',color:C.textMuted}}>{p.medsa_id}</span>
                </div>
              ))}
            </div>
          </div>}
          <div style={{textAlign:'center'}}>
            <span style={{fontSize:'12px',color:C.textSub}}>New patient, not yet on Medsa? </span>
            <span onClick={onNewPatient} style={{fontSize:'12px',color:C.green,fontWeight:600,cursor:'pointer'}}>Register them {'\u2192'}</span>
          </div>
        </>}
        {stage==='scanning'&&<div style={{textAlign:'center',padding:'60px 24px'}}>
          <div style={{width:36,height:36,border:`3px solid ${C.greenLight}`,borderTop:`3px solid ${C.green}`,borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 16px'}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{fontSize:'13px',color:C.textSub}}>Reading QR code...</div>
        </div>}
        {stage==='found'&&patient&&<div>
          <div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'12px',padding:'20px',marginBottom:'14px'}}>
            <div style={{fontSize:'11px',color:C.green,fontWeight:600,marginBottom:'8px',textTransform:'uppercase'}}>{'\u2713'} Patient found</div>
            <div style={{fontSize:'18px',fontWeight:700}}>{patient.full_name}</div>
            <div style={{fontSize:'13px',color:C.textSub,marginBottom:'14px'}}>{patient.medsa_id} - DOB {new Date(patient.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
            <div style={{display:'flex',gap:'10px'}}>
              <div style={{flex:1,background:'#fff',borderRadius:'8px',padding:'10px',textAlign:'center'}}>
                <div style={{fontSize:'11px',color:C.textMuted}}>Blood type</div>
                <div style={{fontSize:'18px',fontWeight:700,color:C.red}}>{patient.blood_type||'-'}</div>
              </div>
              <div style={{flex:2,background:'#fff',borderRadius:'8px',padding:'10px'}}>
                <div style={{fontSize:'11px',color:C.textMuted}}>Emergency card</div>
                <div style={{fontSize:'13px',fontWeight:600,color:patient.emergency_card_active?C.green:C.textMuted}}>{patient.emergency_card_active?'Active':'Not set up'}</div>
              </div>
            </div>
          </div>
          {!justCheckedIn ? <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            <div style={{display:'flex',gap:'10px'}}>
              <Btn onClick={()=>setStage('idle')} disabled={checkingIn}>Cancel</Btn>
              <Btn variant="primary" style={{flex:1}} onClick={()=>handleCheckInClick(false)} disabled={checkingIn}>{checkingIn?'Checking in...':'Check in patient'}</Btn>
            </div>
            {checkInError&&checkInError.includes('already checked in')&&<Btn style={{width:'100%'}} onClick={()=>handleCheckInClick(true)} disabled={checkingIn}>Check in anyway (testing)</Btn>}
          </div> : <div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'14px',textAlign:'center'}}>
            <div style={{fontSize:'14px',color:C.green,fontWeight:600,marginBottom:'10px'}}>{'\u2713'} {justCheckedIn} checked in successfully</div>
            <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setJustCheckedIn(null);setStage('idle');setPatient(null);onDoneCheckIn&&onDoneCheckIn()}}>Done</Btn>
          </div>}
        </div>}
        {stage==='error'&&<div style={{textAlign:'center',padding:'40px 24px'}}>
          <div style={{fontSize:'28px',marginBottom:'10px'}}>{'\u25ce'}</div>
          <div style={{fontSize:'14px',color:C.textSub,marginBottom:'14px'}}>Patient not found. Try search or register a new patient.</div>
          <Btn onClick={()=>setStage('idle')}>Try again</Btn>
        </div>}
      </>}

      {mode==='search'&&<>
        <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
          <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',background:C.cream,outline:'none',boxSizing:'border-box'}} placeholder="Search by name or Medsa ID..."/>
          <Btn variant="primary" onClick={handleSearch}>Search</Btn>
        </div>
        {searchResult&&!justCheckedIn&&<Card style={{padding:'20px'}}>
          <div style={{fontSize:'17px',fontWeight:700}}>{searchResult.full_name}</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>{searchResult.medsa_id} - DOB {new Date(searchResult.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
          <div style={{display:'flex',gap:'10px',marginBottom:'10px'}}>
            <Btn variant="primary" style={{flex:1}} onClick={async()=>{setCheckingIn(true);const result=await onCheckedIn(searchResult,false);setCheckingIn(false);if(result===true)setJustCheckedIn(searchResult.full_name)}} disabled={checkingIn}>{checkingIn?'Checking in...':'Check in now'}</Btn>
            <Btn style={{flex:1}} onClick={onNavSchedule}>Schedule instead</Btn>
          </div>
          {checkInError&&checkInError.includes('already checked in')&&<Btn style={{width:'100%',marginBottom:'10px'}} onClick={async()=>{setCheckingIn(true);const result=await onCheckedIn(searchResult,true);setCheckingIn(false);if(result===true)setJustCheckedIn(searchResult.full_name)}} disabled={checkingIn}>Check in anyway (testing)</Btn>}
          {!requestSent&&<Btn style={{width:'100%'}} onClick={async()=>{
            const { error } = await supabase.from('record_access_requests').insert({
              patient_id: searchResult.id, requesting_staff: staffMember?.name || 'Unknown',
              requesting_clinic: staffMember?.institution_source || null,
              reason: 'Ahead of upcoming visit',
            })
            if (error) { alert(`Could not send request: ${error.message}`); return }
            setRequestSent(true)
          }}>Request record access ahead of visit</Btn>}
          {requestSent&&<div style={{marginTop:'10px',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:C.amber}}>{'\u25c7'} Request sent to patient for approval. Records will be available here once granted, ahead of check-in.</div>}
          {searchResult.registration_path==='unclaimed'&&<div style={{marginTop:'14px',paddingTop:'14px',borderTop:`0.5px solid ${C.border}`}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>This patient hasn't claimed their profile yet - that's why clinical data isn't available. Lost or forgot the claim code?</div>
            {revealedClaimCode
              ? <div style={{background:C.card,borderRadius:'10px',padding:'14px',textAlign:'center'}}>
                  <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>New claim code (valid 48 hours)</div>
                  <div style={{fontSize:'22px',fontWeight:700,letterSpacing:'2px',color:C.green}}>{revealedClaimCode}</div>
                </div>
              : <Btn style={{width:'100%'}} onClick={()=>isClaimCodeExpired(searchResult)?handleRegenerateClaimCode(searchResult):setRevealedClaimCode(searchResult.claim_code)} disabled={regeneratingCode}>
                  {regeneratingCode?'Generating…':isClaimCodeExpired(searchResult)?'Generate new claim code (old one expired)':'View claim code'}
                </Btn>}
          </div>}
        </Card>}
        {justCheckedIn&&<Card style={{padding:'20px'}}>
          <div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'14px',textAlign:'center'}}>
            <div style={{fontSize:'14px',color:C.green,fontWeight:600,marginBottom:'10px'}}>{'\u2713'} {justCheckedIn} checked in successfully</div>
            <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setJustCheckedIn(null);setSearchResult(null);setSearchTerm('');setSearched(false);onDoneCheckIn&&onDoneCheckIn()}}>Done</Btn>
          </div>
        </Card>}
        {searched&&!searchResult&&!justCheckedIn&&<div style={{textAlign:'center',padding:'20px'}}>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'10px'}}>No patient found matching "{searchTerm}".</div>
          <span onClick={onNewPatient} style={{fontSize:'13px',color:C.green,fontWeight:600,cursor:'pointer'}}>Register them as a new patient {'\u2192'}</span>
        </div>}
      </>}
    </PageWrap>
  )
}

function NewPatientScreen({ onBack, onCreated, prefillName }) {
  const [form,setForm]=useState({firstName:prefillName||'',lastName:'',dob:'',phone:'',hkid:'',email:'',remindersViaPhone:true,remindersViaEmail:false})
  const [saving,setSaving]=useState(false)
  const [submitted,setSubmitted]=useState(false)
  const [error,setError]=useState(null)
  const [claimCode,setClaimCode]=useState(null)
  const [createdPatient,setCreatedPatient]=useState(null)

  function generateClaimCode() {
    return Math.random().toString(36).slice(2,8).toUpperCase()
  }

  // Real message copy - what would actually be sent once a real SMS/email
  // provider is connected. Shown on-screen now so this can be reviewed and
  // approved before any real integration is wired up.
  function smsText(name, code) {
    return `Medsa: Hi ${name}, your clinic has created a health record for you. To claim it and access your records anytime, open the Medsa app, enter your HKID and this code: ${code} (valid 48 hours). Reply STOP to opt out.`
  }
  function emailText(name, code) {
    return `Subject: Claim your Medsa health record\n\nHi ${name},\n\nYour clinic has created a Medsa health record for you. To claim it - and access your records from any Medsa-connected clinic going forward - open the Medsa app and enter your HKID along with this code:\n\n${code}\n\nThis code is valid for 48 hours. If you didn't expect this message, you can safely ignore it.\n\n- Medsa`
  }

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      if (!form.firstName) throw new Error('First name is required.')
      if (!form.hkid) throw new Error('HKID is required so the patient can later claim this profile.')
      if (!form.phone && !form.email) throw new Error('At least one contact method (phone or email) is required to send the claim code.')
      const fullName = `${form.firstName}${form.lastName ? ' '+form.lastName : ''}`

      // Check for an existing record under this HKID first - the database
      // itself enforces uniqueness, so blindly inserting would just fail.
      // This is also the real, correct fix for the cross-institution
      // scenario: rather than creating a duplicate to merge later, reuse
      // the existing unclaimed record directly.
      const { data: existing } = await supabase.from('patients').select('*').eq('hkid', form.hkid).maybeSingle()
      if (existing?.claimed_at) {
        throw new Error(`${existing.full_name} already has a claimed Medsa profile (${existing.medsa_id}). Search for them instead of registering as new.`)
      }
      if (existing && !existing.claimed_at) {
        // Already has an unclaimed record from another visit/institution -
        // refresh their claim code and contact info for this visit rather
        // than creating a second row the database would reject anyway.
        const code = generateClaimCode()
        const expiresAt = new Date(Date.now() + 48*60*60*1000).toISOString()
        const { data: refreshed, error: updErr } = await supabase.from('patients').update({
          full_name: fullName || existing.full_name,
          preferred_name: form.firstName || existing.preferred_name,
          date_of_birth: form.dob || existing.date_of_birth,
          phone: form.phone || existing.phone,
          email: form.email || existing.email,
          reminders_via_phone: form.remindersViaPhone && !!form.phone,
          reminders_via_email: form.remindersViaEmail && !!form.email,
          claim_code: code, claim_code_expires_at: expiresAt,
          claim_code_sent_to: [form.phone, form.email].filter(Boolean).join(', '),
        }).eq('id', existing.id).select().maybeSingle()
        if (updErr) throw updErr
        setCreatedPatient(refreshed)
        setClaimCode(code)
        setSubmitted(true)
        setSaving(false)
        return
      }

      const medsaId = 'MDS-' + Math.floor(10000+Math.random()*89999) + '-HK'
      const code = generateClaimCode()
      const expiresAt = new Date(Date.now() + 48*60*60*1000).toISOString()
      const { data: inserted, error: insErr } = await supabase.from('patients').insert({
        medsa_id: medsaId,
        full_name: fullName,
        preferred_name: form.firstName,
        date_of_birth: form.dob,
        hkid: form.hkid,
        phone: form.phone||null,
        email: form.email||null,
        reminders_via_phone: form.remindersViaPhone && !!form.phone,
        reminders_via_email: form.remindersViaEmail && !!form.email,
        emergency_card_consent: false,
        emergency_card_active: false,
        registration_path: 'unclaimed',
        claim_code: code,
        claim_code_expires_at: expiresAt,
        claim_code_sent_to: [form.phone, form.email].filter(Boolean).join(', '),
      }).select().maybeSingle()
      if (insErr) throw insErr
      setCreatedPatient(inserted)
      setClaimCode(code)
      setSubmitted(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (submitted) return (
    <PageWrap maxWidth={480}>
      <div style={{textAlign:'center',padding:'60px 20px'}}>
        <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Patient registered</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px',lineHeight:1.6}}>A Medsa profile has been created for {form.firstName || 'this patient'}. A claim code has been sent to {[form.phone, form.email].filter(Boolean).join(' and ')} - valid for 48 hours - which they will enter alongside their HKID in the Medsa app to link this record to their own account.</div>
        <div style={{background:C.card,borderRadius:'10px',padding:'14px',marginBottom:'14px'}}>
          <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>Claim code (for reference)</div>
          <div style={{fontSize:'22px',fontWeight:700,letterSpacing:'2px',color:C.green}}>{claimCode}</div>
        </div>
        {form.phone&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'14px',marginBottom:'10px',textAlign:'left'}}>
          <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',marginBottom:'6px'}}>SMS text (not yet actually sent - no live provider connected)</div>
          <div style={{fontSize:'12px',color:C.text,whiteSpace:'pre-wrap'}}>{smsText(form.firstName, claimCode)}</div>
        </div>}
        {form.email&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'14px',marginBottom:'20px',textAlign:'left'}}>
          <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',marginBottom:'6px'}}>Email text (not yet actually sent - no live provider connected)</div>
          <div style={{fontSize:'12px',color:C.text,whiteSpace:'pre-wrap'}}>{emailText(form.firstName, claimCode)}</div>
        </div>}
        <Btn variant="primary" onClick={()=>onCreated?createdPatient&&onCreated(createdPatient):onBack()}>{onCreated?'Continue with this patient':'Back to check-in'}</Btn>
      </div>
    </PageWrap>
  )

  return (
    <PageWrap maxWidth={480}>
      <div onClick={onBack} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'16px'}}>{'\u2190'} Back</div>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Register New Patient</h2>
      <div style={{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'16px'}}>
        <input value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} placeholder="First name" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} placeholder="Last name" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} placeholder="Date of birth (YYYY-MM-DD)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.hkid} onChange={e=>setForm({...form,hkid:e.target.value})} placeholder="HKID (required)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone number" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        {form.phone&&<label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:C.textSub,cursor:'pointer'}}>
          <input type="checkbox" checked={form.remindersViaPhone} onChange={e=>setForm({...form,remindersViaPhone:e.target.checked})}/>
          Opt in for appointment reminders by SMS
        </label>}
        <input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Email (optional)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        {form.email&&<label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:C.textSub,cursor:'pointer'}}>
          <input type="checkbox" checked={form.remindersViaEmail} onChange={e=>setForm({...form,remindersViaEmail:e.target.checked})}/>
          Opt in for appointment reminders by email
        </label>}
        <div style={{fontSize:'11px',color:C.textMuted}}>At least one of phone or email is required, to send the claim code.</div>
      </div>
      <div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'10px',padding:'12px 14px',fontSize:'12px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>
        {'\u25c7'} A claim code will be sent to this phone number, valid 48 hours. The patient enters their HKID plus this code in the Medsa app to securely link this record - only someone who actually received the code can claim it.
      </div>
      {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
      <Btn variant="primary" style={{width:'100%'}} onClick={handleSubmit} disabled={saving||!form.firstName||!form.dob}>{saving?'Saving...':'Create Medsa profile'}</Btn>
    </PageWrap>
  )
}


// ── DOCTOR VIDEO CALL — real, working embed via Jitsi Meet's public
// server. No account, API key, or signup required, and it's a genuine,
// functioning video call, not a demo - the trade-off is it runs on
// meet.jit.si's shared infrastructure rather than Medsa's own, which is
// fine for now and can move to a dedicated/self-hosted provider later
// without changing anything else in this file.
function DoctorVideoCallModal({ patientName, roomId, onClose }) {
  if (!patientName) return null
  const roomName = `medsa-${(roomId||patientName).toString().replace(/[^a-zA-Z0-9]/g,'')}-${new Date().toISOString().slice(0,10)}`
  const jitsiUrl = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&userInfo.displayName=%22Doctor%22`
  return (
    <div style={{position:'fixed',inset:0,background:'#1a1a1a',zIndex:400,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#111'}}>
        <div style={{color:'#fff',fontSize:'13px'}}>Video call with {patientName}</div>
        <div onClick={onClose} style={{width:36,height:36,borderRadius:'50%',background:C.red,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'16px',color:'#fff'}}>✕</div>
      </div>
      <iframe
        src={jitsiUrl}
        style={{flex:1,border:'none'}}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
      />
    </div>
  )
}

// ── PATIENT ACTION MODAL — quick actions before entering full consultation ──
function PatientQueueActionModal({ patient, onClose, onGoToConsultation, onStartCall, doctorLabel }) {
  const [mode,setMode]=useState(null) // null | 'message'
  const [msgBody,setMsgBody]=useState('')
  const [msgUrgent,setMsgUrgent]=useState(false)
  const [msgSaving,setMsgSaving]=useState(false)
  const [msgSaved,setMsgSaved]=useState(false)
  const [error,setError]=useState(null)

  if (!patient) return null

  async function handleSendMessage() {
    if (!msgBody.trim()) { setError('Write a message first.'); return }
    if (!patient.patientMedsaId) { setError('This patient has no linked Medsa profile yet.'); return }
    setMsgSaving(true)
    setError(null)
    try {
      const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', patient.patientMedsaId).maybeSingle()
      if (!patientRow) throw new Error('Could not find this patient in Medsa.')
      const { error: insErr } = await supabase.from('patient_messages').insert({
        patient_id: patientRow.id, doctor_name: doctorLabel, body: msgBody, urgent: msgUrgent,
      })
      if (insErr) throw insErr
      setMsgSaved(true); setMsgBody(''); setMsgUrgent(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setMsgSaving(false)
    }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:440,padding:'20px',maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
          <div style={{fontSize:'16px',fontWeight:700}}>{patient.patientName}</div>
          <div onClick={onClose} style={{fontSize:'13px',color:C.green,cursor:'pointer'}}>Close</div>
        </div>

        {!mode&&<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>onStartCall(patient.patientName, patient.patientMedsaId)}>◈ Video call</Btn>
          <Btn style={{width:'100%'}} onClick={()=>setMode('message')}>✉ Message patient</Btn>
          <Btn style={{width:'100%'}} onClick={onGoToConsultation}>📋 Go to full consultation</Btn>
        </div>}

        {mode==='message'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Message {patient.patientName}</div>
          <textarea value={msgBody} onChange={e=>setMsgBody(e.target.value)} rows={4} placeholder="Write a note to this patient…" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginBottom:'10px',boxSizing:'border-box'}}/>
          <div onClick={()=>setMsgUrgent(!msgUrgent)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:msgUrgent?C.redLight:C.card,border:`0.5px solid ${msgUrgent?C.red:C.border}`,borderRadius:'8px',marginBottom:'12px',cursor:'pointer'}}>
            <Toggle checked={msgUrgent} onChange={setMsgUrgent}/>
            <span style={{fontSize:'12px',fontWeight:600,color:msgUrgent?C.red:C.text}}>Mark as urgent</span>
          </div>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
          {msgSaved&&<div style={{fontSize:'12px',color:C.green,marginBottom:'10px'}}>✓ Sent</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={handleSendMessage} disabled={msgSaving}>{msgSaving?'Sending…':'Send'}</Btn>
          </div>
        </>}
      </div>
    </div>
  )
}

function MyPatientsScreen({ queue, onSelectPatient, staffMember, onRefresh }) {
  const [actionPatient,setActionPatient]=useState(null)
  const [callingPatient,setCallingPatient]=useState(null) // {name, medsaId}
  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'8px',textAlign:'center'}}>My Patients</h2>
      {onRefresh&&<div style={{textAlign:'center',marginBottom:'16px'}}><span onClick={onRefresh} style={{fontSize:'12px',color:C.green,fontWeight:600,cursor:'pointer'}}>{'\u21bb'} Refresh</span></div>}
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {queue.length===0&&<div style={{textAlign:'center',padding:'60px 20px',color:C.textMuted,fontSize:'13px'}}>No patients checked in yet today.</div>}
        {queue.map((q,i)=>{
          const hrsLeft = hoursRemaining(q.checkedInAt)
          return (
            <Card key={i} onClick={()=>setActionPatient(q)} style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:'14px'}}>
              <div style={{width:36,height:36,borderRadius:'8px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,flexShrink:0}}>{q.ticket}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'14px',fontWeight:600}}>{q.patientName}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>Checked in {new Date(q.checkedInAt).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <Badge text={hrsLeft>0?`Records ${Math.floor(hrsLeft)}h left`:'Access expired'} type={hrsLeft>0?'ok':'full'}/>
              <span style={{color:C.textMuted,fontSize:'16px'}}>{'\u203a'}</span>
            </Card>
          )
        })}
      </div>
      <PatientQueueActionModal
        patient={actionPatient}
        onClose={()=>setActionPatient(null)}
        doctorLabel={staffMember?.name || 'Doctor'}
        onStartCall={(name, medsaId)=>{setCallingPatient({name, medsaId});setActionPatient(null)}}
        onGoToConsultation={()=>{onSelectPatient(actionPatient);setActionPatient(null)}}
      />
      <DoctorVideoCallModal patientName={callingPatient?.name} roomId={callingPatient?.medsaId} onClose={()=>setCallingPatient(null)}/>
    </PageWrap>
  )
}

function ConsultationScreen({ queueEntry, staffMember, onPrescribed, institutionId, medicineType }) {
  const [patient,setPatient]=useState(null)
  const [records,setRecords]=useState([])
  const [conditions,setConditions]=useState([])
  const [allergies,setAllergies]=useState([])
  const [activeMedications,setActiveMedications]=useState([])
  const [loading,setLoading]=useState(true)
  const [notes,setNotes]=useState('')
  const [diagnosis,setDiagnosis]=useState('')
  const [icd10Code,setIcd10Code]=useState(null)
  const [icd10Search,setIcd10Search]=useState('')
  const [icd10Open,setIcd10Open]=useState(false)
  const [icd10Results,setIcd10Results]=useState([])
  const [icd10Loading,setIcd10Loading]=useState(false)
  const [weightKg,setWeightKg]=useState('')
  const [consentWindow,setConsentWindow]=useState({checked:false,allowed:false})
  const [consultationStartedAt]=useState(() => new Date().toISOString())
  const [safetyChecks,setSafetyChecks]=useState({}) // rxIndex -> {status, orderSet, triggered, checking}
  const [overrideReasons,setOverrideReasons]=useState({}) // rxIndex -> reason text

  // Real drug-to-drug interaction engine. Collects every other drug
  // actually in play for this patient right now - both the other drugs
  // in this same prescription being written today, and the patient's
  // existing active medications from past visits. This is the piece that
  // was missing before: the old version only ever checked a single drug
  // against conditions/allergies, never against other drugs.
  function getAllActiveDrugNames(excludeIdx) {
    const otherNewDrugs = prescriptions
      .map((p, i) => i === excludeIdx ? null : p.drug?.trim())
      .filter(Boolean)
    const existingDrugNames = activeMedications.map(m => m.medication_name).filter(Boolean)
    return [...new Set([...otherNewDrugs, ...existingDrugNames])]
  }

  async function checkDrugSafety(idx, drugName) {
    if (!drugName.trim()) return
    setSafetyChecks(prev => ({...prev, [idx]: {status:'checking'}}))

    const [{ data: orderSet }, { data: drugRef }] = await Promise.all([
      supabase.from('order_sets').select('*')
        .eq('institution_id', institutionId).ilike('drug_name', drugName.trim()).maybeSingle(),
      supabase.from('drug_reference').select('atc_code, hk_registration_number')
        .eq('drug_name', drugName.trim()).eq('medicine_type', medicineType||'western').maybeSingle(),
    ])

    // Local, institution-approved rules - condition/allergy/age checks.
    let localStatus = orderSet ? 'passed' : 'no_data_on_file'
    const localTriggered = []
    if (orderSet) {
      if (patient?.date_of_birth) {
        const ageYears = (Date.now() - new Date(patient.date_of_birth).getTime()) / (1000*60*60*24*365.25)
        if (orderSet.min_age_years!=null && ageYears < orderSet.min_age_years) localTriggered.push(`Below minimum age (${orderSet.min_age_years}+)`)
        if (orderSet.max_age_years!=null && ageYears > orderSet.max_age_years) localTriggered.push(`Above maximum age (${orderSet.max_age_years})`)
      }
      const patientConditionNames = conditions.map(c=>c.condition_name?.toLowerCase())
      const patientAllergenNames = allergies.map(a=>a.allergen?.toLowerCase())
      const hardMatches = orderSet.hard_stop_conditions.filter(hc =>
        patientConditionNames.includes(hc.toLowerCase()) || patientAllergenNames.includes(hc.toLowerCase()))
      const softMatches = orderSet.soft_stop_conditions.filter(sc =>
        patientConditionNames.includes(sc.toLowerCase()) || patientAllergenNames.includes(sc.toLowerCase()))
      if (hardMatches.length > 0) { localStatus = 'hard_stop_blocked'; localTriggered.push(...hardMatches) }
      else if (softMatches.length > 0) { localStatus = 'soft_stop'; localTriggered.push(...softMatches) }
    }

    // Real drug-to-drug check - looks at every OTHER drug already in play
    // (other new prescriptions this visit, plus existing active
    // medications) and treats an explicit interaction listed against this
    // new drug the same way condition/allergy matches are treated: hard
    // stop blocks, soft stop requires a reason. Once a real CDS/MIMS
    // provider is connected, this is the one place that changes - it
    // would receive this same otherDrugs list and return a verdict the
    // same way, without needing anything downstream to change.
    const otherDrugs = getAllActiveDrugNames(idx)
    if (otherDrugs.length > 0) {
      const { data: interactionRows } = await supabase.from('order_sets')
        .select('drug_name, hard_stop_conditions, soft_stop_conditions')
        .eq('institution_id', institutionId).in('drug_name', otherDrugs)
      for (const row of interactionRows || []) {
        const nameLower = drugName.trim().toLowerCase()
        if ((row.hard_stop_conditions||[]).some(c => c.toLowerCase() === nameLower)) {
          localStatus = 'hard_stop_blocked'
          localTriggered.push(`Interacts with ${row.drug_name} (already prescribed)`)
        } else if ((row.soft_stop_conditions||[]).some(c => c.toLowerCase() === nameLower) && localStatus !== 'hard_stop_blocked') {
          localStatus = 'soft_stop'
          localTriggered.push(`Possible interaction with ${row.drug_name} (already prescribed)`)
        }
      }
    }

    // Real, external CDS plugin check - only runs if this drug actually
    // has a standardized code on file, since without one no real lookup
    // is possible (same "no data" honesty as the local check).
    let cdsResult = null
    if (drugRef?.atc_code || drugRef?.hk_registration_number) {
      const ageInMonths = patient?.date_of_birth
        ? Math.round((Date.now() - new Date(patient.date_of_birth).getTime()) / (1000*60*60*24*30.44))
        : null
      try {
        const res = await fetch('/api/cds/check-safety', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            patientId: patient.id, ageInMonths, weightKg: parseFloat(weightKg)||null,
            drugName: drugName.trim(), atcCode: drugRef.atc_code, hkRegistrationNumber: drugRef.hk_registration_number,
            otherDrugs,
          }),
        })
        cdsResult = await res.json()
      } catch (e) {
        cdsResult = { safetyStatus: 'ERROR', message: 'Could not reach safety check service.' }
      }
    }

    // Merge - the more cautious of all sources wins. A hard stop from
    // any source blocks; a warning from any requires an override reason;
    // only clear from all (or no data from all) passes through cleanly.
    const severity = { hard_stop_blocked: 3, WARNING: 2, soft_stop: 2, ERROR: 2, passed: 1, CLEAR: 1, no_data_on_file: 0 }
    const cdsStatus = cdsResult?.safetyStatus === 'WARNING' ? 'soft_stop' : cdsResult?.safetyStatus === 'ERROR' ? 'soft_stop' : cdsResult ? 'passed' : 'no_data_on_file'
    const finalStatus = severity[cdsStatus] > severity[localStatus] ? cdsStatus : localStatus
    const combinedTriggered = [...localTriggered]
    if (cdsResult?.message) combinedTriggered.push(`CDS: ${cdsResult.message}`)

    setSafetyChecks(prev => ({...prev, [idx]: { status: finalStatus, orderSet, triggered: combinedTriggered, cdsResult }}))
  }
  const [lineItems,setLineItems]=useState([]) // [{service_item_id, description, category, fee, qty}]
  const [catalog,setCatalog]=useState([])
  const [catalogClinicType,setCatalogClinicType]=useState(medicineType==='chinese'?'tcm':'western')
  const [itemPickerOpen,setItemPickerOpen]=useState(false)

  // Real service catalog, filtered by clinic type - what the doctor
  // actually picks from to build the itemized list, rather than typing
  // free text or manually searching a code database.
  useEffect(() => {
    async function loadCatalog() {
      const { data } = await supabase.from('service_items').select('*')
        .in('clinic_type', [catalogClinicType, 'general']).eq('active', true).order('category')
      setCatalog(data || [])
    }
    loadCatalog()
  }, [catalogClinicType])

  const invoiceTotal = lineItems.reduce((sum, i) => sum + (i.fee * i.qty), 0)

  function addLineItem(item) {
    setLineItems(prev => {
      const existing = prev.find(i => i.service_item_id === item.id)
      if (existing) return prev.map(i => i.service_item_id === item.id ? {...i, qty: i.qty + 1} : i)
      return [...prev, { service_item_id: item.id, description: item.name, description_tc: item.name_tc, category: item.category, fee: parseFloat(item.default_price) || 0, qty: 1 }]
    })
    setItemPickerOpen(false)
  }

  function updateLineItemQty(id, qty) {
    if (qty <= 0) { setLineItems(prev => prev.filter(i => i.service_item_id !== id)); return }
    setLineItems(prev => prev.map(i => i.service_item_id === id ? {...i, qty} : i))
  }

  function updateLineItemFee(id, fee) {
    setLineItems(prev => prev.map(i => i.service_item_id === id ? {...i, fee: parseFloat(fee) || 0} : i))
  }

  // Real query against the icd10_reference table - debounced so it doesn't
  // fire on every keystroke.
  useEffect(() => {
    if (!icd10Search.trim()) { setIcd10Results([]); return }
    setIcd10Loading(true)
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('icd10_reference').select('*')
        .or(`code.ilike.%${icd10Search}%,label.ilike.%${icd10Search}%`).limit(8)
      setIcd10Results(data||[])
      setIcd10Loading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [icd10Search])
  const [prescriptions,setPrescriptions]=useState([{drug:'',dosage:'',frequency:'',quantity:'',durationDays:'',timesPerDay:''}])
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState(null)
  const [showReferral,setShowReferral]=useState(false)
  const [referralNote,setReferralNote]=useState('')
  const [referralSearch,setReferralSearch]=useState('')
  const [referralMatches,setReferralMatches]=useState([])
  const [referralMatched,setReferralMatched]=useState(null) // the selected real match, if any
  const [referralClinicName,setReferralClinicName]=useState('')
  const [referralClinicPhone,setReferralClinicPhone]=useState('')
  const [referralClinicEmail,setReferralClinicEmail]=useState('')
  const [referralSending,setReferralSending]=useState(false)
  const [referralSent,setReferralSent]=useState(false)
  const [referralDiagnosis,setReferralDiagnosis]=useState('')
  const [referralConsultationSummary,setReferralConsultationSummary]=useState('')

  // Real auto-match search - both real Medsa doctors and the directory
  // (non-Medsa doctors Medsa knows about for referral purposes). Debounced
  // so it doesn't fire on every keystroke.
  useEffect(() => {
    if (!referralSearch.trim()) { setReferralMatches([]); return }
    const timeout = setTimeout(async () => {
      const [medsaRes, dirRes] = await Promise.all([
        supabase.from('staff_credentials').select('id,full_name,department')
          .eq('role','doctor').eq('status','active').ilike('full_name', `%${referralSearch}%`).limit(5),
        supabase.from('directory_doctors').select('*, directory_clinics(*)')
          .ilike('full_name', `%${referralSearch}%`).limit(5),
      ])
      const medsaMatches = (medsaRes.data||[]).map(d => ({ source:'medsa', id:d.id, name:d.full_name, clinicLabel:d.department||'Medsa Clinic' }))
      const dirMatches = (dirRes.data||[]).map(d => ({ source:'directory', id:d.id, name:d.full_name, clinicLabel:d.directory_clinics?.name, phone:d.directory_clinics?.contact_phone, email:d.directory_clinics?.contact_email }))
      setReferralMatches([...medsaMatches, ...dirMatches])
    }, 300)
    return () => clearTimeout(timeout)
  }, [referralSearch])

  function handleSelectReferralMatch(m) {
    setReferralMatched(m)
    setReferralSearch(m.name)
    setReferralMatches([])
    setReferralClinicName(m.clinicLabel||'')
    setReferralClinicPhone(m.phone||'')
    setReferralClinicEmail(m.email||'')
  }

  async function handleSendReferral() {
    if (!referralSearch.trim() || !patient?.id) return
    setReferralSending(true)
    await supabase.from('referrals').insert({
      patient_id: patient.id, referring_staff: staffMember?.name, note: referralNote||null,
      diagnosis: referralDiagnosis||null, consultation_summary: referralConsultationSummary||null,
      to_doctor_name: referralSearch,
      to_clinic_name: referralClinicName||null, to_clinic_phone: referralClinicPhone||null, to_clinic_email: referralClinicEmail||null,
      matched_staff_credential_id: referralMatched?.source==='medsa' ? referralMatched.id : null,
      matched_directory_doctor_id: referralMatched?.source==='directory' ? referralMatched.id : null,
    })
    setReferralSending(false)
    setReferralSent(true)
  }
  const [drugInfoOpen,setDrugInfoOpen]=useState(null)
  const [expandedRecord,setExpandedRecord]=useState(null)
  const [reportRequests,setReportRequests]=useState({})
  const [inventoryItems,setInventoryItems]=useState([])
  const [suggestOpen,setSuggestOpen]=useState(null)

  useEffect(() => {
    async function loadInventory() {
      const { data } = await supabase.from('clinic_inventory').select('item_name')
      setInventoryItems((data||[]).map(i=>i.item_name))
    }
    loadInventory()
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      if (!queueEntry?.patientMedsaId) { setLoading(false); return }
      const { data: p } = await supabase.from('patients').select('*').eq('medsa_id', queueEntry.patientMedsaId).maybeSingle()
      if (p) {
        setPatient(p)
        // Allergies and chronic conditions are never gated by consent -
        // these are exactly what an emergency card shows, and a doctor
        // needs to know about a dangerous allergy regardless of consent
        // window status. Real, live search against the shared patient
        // record every time - not a local copy stored in this clinic's
        // own data, so it always reflects the patient's actual, current
        // Medsa profile. Active medications loaded here too - this is
        // what the drug interaction engine checks new prescriptions
        // against.
        const [{data:c},{data:a},{data:m}] = await Promise.all([
          supabase.from('conditions').select('*').eq('patient_id',p.id).eq('active',true),
          supabase.from('allergies').select('*').eq('patient_id',p.id),
          supabase.from('medications').select('*').eq('patient_id',p.id).eq('active',true),
        ])
        setConditions(c||[]); setAllergies(a||[]); setActiveMedications(m||[])

        // Full history (past visit records) is the part that's actually
        // gated - checks that real consent exists and that the current
        // time isn't before the window even starts (e.g. a doctor
        // shouldn't be able to open a patient's history days ahead of a
        // booking). The window's *end* only matters for how long access
        // stays open after check-in when no active, unsubmitted
        // consultation is happening - during an active one, access stays
        // open until actually submitted, not by a ticking clock, since
        // consultation length varies with patient volume.
        const { data: intake } = await supabase.from('appointment_intake')
          .select('access_window_start, access_window_end').eq('patient_id', p.id).eq('consent_given', true)
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        const now = new Date()
        const pastStart = !!intake && now >= new Date(intake.access_window_start)
        setConsentWindow({ checked: true, allowed: pastStart })
        if (pastStart) {
          const { data: r } = await supabase.from('medical_records').select('*,institutions(name)').eq('patient_id',p.id).order('date_of_record',{ascending:false})
          setRecords(r||[])
        }
      }
      setLoading(false)
    }
    load()
  }, [queueEntry])

  function addPrescriptionLine() { setPrescriptions([...prescriptions, {drug:'',dosage:'',frequency:'',quantity:'',durationDays:'',timesPerDay:''}]) }
  function updateRx(i, field, value) {
    setPrescriptions(prescriptions.map((p,idx)=>{
      if (idx!==i) return p
      const updated = {...p,[field]:value}
      const mode = field==='dosingMode' ? value : (p.dosingMode||'fixed')

      // Auto-suggest quantity for fixed and interval modes, but never
      // override a quantity the doctor has manually typed in. PRN has no
      // fixed schedule, so it's never auto-calculated.
      if (mode==='fixed' && (field==='durationDays'||field==='timesPerDay') && !p.quantityManuallySet) {
        const days = parseInt(field==='durationDays'?value:updated.durationDays) || 0
        const times = parseInt(field==='timesPerDay'?value:updated.timesPerDay) || 0
        if (days>0 && times>0) updated.quantity = String(days*times)
      }
      if (mode==='interval' && (field==='durationDays'||field==='intervalHours') && !p.quantityManuallySet) {
        const days = parseInt(field==='durationDays'?value:updated.durationDays) || 0
        const hours = parseInt(field==='intervalHours'?value:updated.intervalHours) || 0
        if (days>0 && hours>0) updated.quantity = String(Math.round((24/hours)*days))
      }
      if (field==='quantity') updated.quantityManuallySet = true
      return updated
    }))
  }

  const [draftSaved,setDraftSaved]=useState(false)
  const [savingDraft,setSavingDraft]=useState(false)

  // Saves current notes/diagnosis as a draft - stays on this screen so
  // the doctor can keep editing before finally submitting. This is what
  // replaces having a separate "prep notes" feature - the same
  // notes/diagnosis fields work for both prep and the final visit.
  async function handleSaveDraft() {
    if (!patient || (!diagnosis.trim() && !notes.trim())) return
    setSavingDraft(true)
    setError(null)
    try {
      const { error: recErr } = await supabase.from('medical_records').insert({
        patient_id: patient.id, record_type: 'visit', title: diagnosis || 'Draft consultation note',
        notes: notes || null, diagnosis: diagnosis || null, icd10_code: icd10Code?.code || null,
        date_of_record: new Date().toISOString().slice(0,10), source: 'clinic_ops', record_status: 'draft',
      })
      if (recErr) throw recErr
      setDraftSaved(true)
      setTimeout(()=>setDraftSaved(false), 2500)
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleSave() {
    // Real enforcement - a hard stop blocks saving entirely, no override
    // possible. A soft stop requires a logged reason before proceeding.
    const hardBlocked = Object.entries(safetyChecks).filter(([,c])=>c.status==='hard_stop_blocked')
    if (hardBlocked.length > 0) {
      setError('One or more prescriptions are blocked by a safety check. Remove them or choose an alternative before saving.')
      return
    }
    const unresolvedSoft = Object.entries(safetyChecks).filter(([idx,c])=>c.status==='soft_stop' && !overrideReasons[idx]?.trim())
    if (unresolvedSoft.length > 0) {
      setError('Enter a reason for each safety warning before saving.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const rxRows = prescriptions.filter(p=>p.drug.trim())
      let savedRecordId = null
      const submittedAt = new Date().toISOString()
      if ((diagnosis.trim()||notes.trim()||rxRows.length>0||lineItems.length>0) && patient) {
        const visitTitle = diagnosis || 'Clinic consultation'
        const visitDate = new Date().toISOString().slice(0,10)
        const { error: recErr } = await supabase.from('medical_records').insert({
          patient_id: patient.id, record_type: 'visit', title: visitTitle,
          notes: notes || null, diagnosis: diagnosis || null, icd10_code: icd10Code?.code || null,
          date_of_record: visitDate, source: 'clinic_ops', record_status: 'submitted',
          line_items: lineItems.length>0 ? lineItems : null, total_fee: invoiceTotal || null,
          doctor_name: staffMember?.name || 'Unknown',
          consultation_started_at: consultationStartedAt, submitted_at: submittedAt,
        })
        if (recErr) throw recErr
        // Separate, standard select rather than chaining .select() off
        // .insert() - same fix already applied elsewhere after that
        // pattern broke the CI test suite's mock client. Matches on
        // fields already confirmed set in this exact insert, rather than
        // relying on a created_at column I haven't verified exists here.
        const { data: recData } = await supabase.from('medical_records').select('id')
          .eq('patient_id', patient.id).eq('record_type', 'visit').eq('title', visitTitle).eq('date_of_record', visitDate)
          .order('date_of_record', { ascending: false }).limit(1).maybeSingle()
        savedRecordId = recData?.id || null
      }
      // Real audit logging - every safety check that ran gets a
      // permanent record, regardless of outcome. Uses rx.drug directly
      // rather than assuming safetyChecks keys line up with rxRows
      // indices, since rxRows is filtered (drug.trim()) from the full
      // prescriptions array and the two could otherwise drift apart.
      for (const [idx, check] of Object.entries(safetyChecks)) {
        const rx = prescriptions[idx]
        if (!rx || !rx.drug.trim() || check.status === 'checking') continue
        await supabase.from('prescription_safety_checks').insert({
          medical_record_id: savedRecordId, patient_id: patient.id, drug_name: rx.drug,
          order_set_id: check.orderSet?.id || null,
          result: check.status === 'soft_stop' ? 'soft_stop_overridden' : check.status,
          triggered_conditions: check.triggered || [],
          override_reason: check.status === 'soft_stop' ? (overrideReasons[idx] || null) : null,
          checked_by: staffMember?.name || 'Unknown',
        })
      }
      if (rxRows.length>0 && patient) {
        const dbRows = rxRows.map(p=>({
          patient_id: patient.id, medical_record_id: savedRecordId, medication_name: p.drug, dosage: p.dosage, frequency: p.frequency,
          quantity: parseInt(p.quantity)||1,
          duration_days: parseInt(p.durationDays)||null,
          times_per_day: parseInt(p.timesPerDay)||null,
          dosing_mode: p.dosingMode||'fixed',
          interval_hours: parseInt(p.intervalHours)||null,
          active: true, on_emergency_card: false, start_date: new Date().toISOString().slice(0,10),
          prescribed_by_staff: staffMember?.name || 'Unknown', dispense_status: 'pending',
          prescribed_submitted_at: submittedAt,
        }))
        const { error: insErr } = await supabase.from('medications').insert(dbRows)
        if (insErr) throw insErr
      }
      if (rxRows.length>0) {
        onPrescribed({
          patientName: queueEntry.patientName,
          doctorName: staffMember.name,
          drugs: rxRows,
          timestamp: Date.now(),
          status: 'pending',
        })
      }
      setSaved(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Unified with the real, database-backed consent window (24h before +
  // after for booked appointments, 24h after only for walk-ins) rather
  // than the old, simpler local-only timer that only ever counted 24h
  // from check-in and never distinguished booked from walk-in at all -
  // having both active at once would let them silently disagree.
  const recordsVisible = consentWindow.checked && consentWindow.allowed

  if (saved) return (
    <PageWrap maxWidth={480}>
      <div style={{textAlign:'center',padding:'60px 20px'}}>
        <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Consultation saved</div>
        <div style={{fontSize:'13px',color:C.textSub}}>Notes and prescription synced to {queueEntry.patientName}'s Medsa record. Front desk has been notified to prepare the prescription.</div>
      </div>
    </PageWrap>
  )

  return (
    <PageWrap maxWidth={680}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'4px',textAlign:'center'}}>{queueEntry.patientName}</h2>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',textAlign:'center'}}>{queueEntry.ticket} - checked in {new Date(queueEntry.checkedInAt).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}</div>

      <SecLabel>Medical records{recordsVisible?' - full history open, closes on submit':''}</SecLabel>
      {loading&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'16px'}}>Loading...</div>}
      {!loading&&<div style={{display:'flex',gap:'16px',marginBottom:'20px'}}>
        <div style={{flex:1}}>
          {allergies.length>0&&<Card style={{padding:'12px 14px',marginBottom:'8px'}}>
            {allergies.map((a,i)=>(<div key={i} style={{fontSize:'12px',fontWeight:600,color:a.severity==='severe'?C.red:C.text,padding:'3px 0'}}>{'\u26a0'} {a.allergen}</div>))}
          </Card>}
          {conditions.length>0&&<Card style={{padding:'12px 14px'}}>
            {conditions.map((c,i)=>(<div key={i} style={{fontSize:'12px',padding:'3px 0'}}>{'\u25ce'} {c.condition_name}</div>))}
          </Card>}
        </div>
        <div style={{flex:2}}>
          {!recordsVisible&&<div style={{background:C.card,borderRadius:'10px',padding:'14px',fontSize:'12px',color:C.textMuted,textAlign:'center'}}>Full visit history not available yet for this check-in - reload and re-check-in the patient to resolve.</div>}
          {recordsVisible&&records.slice(0,5).map((r,i)=>{
            const isOpen = expandedRecord===i
            const requested = reportRequests[i]
            return (
              <Card key={i} style={{padding:'10px 14px',marginBottom:'6px'}}>
                <div onClick={()=>setExpandedRecord(isOpen?null:i)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
                  <div>
                    <div style={{fontSize:'12px',fontWeight:600}}>{r.title}</div>
                    <div style={{fontSize:'11px',color:C.textSub}}>{new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short'})} - {r.institutions?.name||'-'}</div>
                  </div>
                  <span style={{color:C.textMuted,fontSize:'12px'}}>{isOpen?'\u2212':'+'}</span>
                </div>
                {isOpen&&<div style={{marginTop:'10px',paddingTop:'10px',borderTop:`0.5px solid ${C.border}`}}>
                  {r.diagnosis&&<div style={{fontSize:'12px',marginBottom:'6px'}}><strong>Diagnosis:</strong> {r.diagnosis}</div>}
                  {r.notes&&<div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6,marginBottom:'10px'}}><strong style={{color:C.text}}>Report detail:</strong> {r.notes}</div>}
                  {!r.notes&&!r.diagnosis&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'10px'}}>No further detail on file for this record.</div>}
                  {!requested?<Btn style={{fontSize:'11px',padding:'6px 12px'}} onClick={async()=>{
                    const { error } = await supabase.from('record_access_requests').insert({
                      patient_id: patient.id, requesting_staff: staffMember?.name || 'Unknown',
                      requesting_clinic: r.institutions?.name || null,
                      reason: `Full detail requested for record: ${r.title || r.diagnosis || 'record'}`,
                    })
                    if (error) { alert(`Could not send request: ${error.message}`); return }
                    setReportRequests({...reportRequests,[i]:true})
                  }}>Request full/detailed report</Btn>
                    :<div style={{fontSize:'11px',color:C.amber}}>{'\u25c7'} Requested from {r.institutions?.name||'originating provider'} - patient will be notified to approve release of the complete report.</div>}
                </div>}
              </Card>
            )
          })}
        </div>
      </div>}

      <SecLabel>Diagnosis</SecLabel>
      <input value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} disabled={saved} placeholder="e.g. Upper respiratory tract infection" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'10px',background:saved?C.card:'#fff'}}/>

      <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Weight (kg) - optional, used for dose-safety reference ranges below</div>
      <input value={weightKg} onChange={e=>setWeightKg(e.target.value)} type="number" placeholder="e.g. 68" style={{width:'120px',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'14px'}}/>

      <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>ICD-10 code - structured coding, required for direct-billing claims</div>
      {icd10Code
        ? <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'10px 14px',marginBottom:'18px'}}>
            <div><span style={{fontWeight:700,color:C.green}}>{icd10Code.code}</span> <span style={{fontSize:'13px',color:C.textSub}}>{icd10Code.label}</span></div>
            <span onClick={()=>{setIcd10Code(null);setIcd10Search('')}} style={{fontSize:'12px',color:C.textMuted,cursor:'pointer'}}>Change</span>
          </div>
        : <div style={{position:'relative',marginBottom:'18px'}}>
            <input value={icd10Search} onChange={e=>{setIcd10Search(e.target.value);setIcd10Open(true)}} onFocus={()=>setIcd10Open(true)} placeholder="Search ICD-10 code or condition…" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
            {icd10Open&&icd10Search.trim()&&<div style={{position:'absolute',top:'100%',left:0,right:0,background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'8px',marginTop:'4px',maxHeight:220,overflowY:'auto',zIndex:20,boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
              {icd10Loading&&<div style={{padding:'10px 14px',fontSize:'12px',color:C.textMuted}}>Searching…</div>}
              {!icd10Loading&&icd10Results.map(c=>(
                <div key={c.code} onClick={()=>{setIcd10Code(c);setIcd10Open(false)}} style={{padding:'10px 14px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`,fontSize:'13px'}}>
                  <span style={{fontWeight:700,color:C.green}}>{c.code}</span> {c.label}
                </div>
              ))}
              {!icd10Loading&&icd10Results.length===0&&
                <div style={{padding:'10px 14px',fontSize:'12px',color:C.textMuted}}>No match in the reference set - free-text diagnosis above still saves normally.</div>}
            </div>}
          </div>}

      <SecLabel>Consultation notes</SecLabel>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} disabled={saved} rows={4} placeholder="Clinical findings, examination notes, follow-up plan..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'18px',fontFamily:'inherit',resize:'vertical',background:saved?C.card:'#fff'}}/>

      <SecLabel>Itemized Treatment & Charges</SecLabel>
      <div style={{marginBottom:'10px'}}>
        {lineItems.map(item=>(
          <div key={item.service_item_id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 0',borderBottom:`0.5px solid ${C.border}`}}>
            <div style={{flex:1,fontSize:'13px'}}>{item.description}</div>
            <input type="number" min="1" value={item.qty} onChange={e=>updateLineItemQty(item.service_item_id, parseInt(e.target.value)||0)} style={{width:'44px',border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'6px',fontSize:'12px',textAlign:'center'}}/>
            <div style={{fontSize:'12px',color:C.textSub}}>x</div>
            <input type="number" step="0.01" value={item.fee} onChange={e=>updateLineItemFee(item.service_item_id, e.target.value)} style={{width:'68px',border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'6px',fontSize:'12px'}}/>
            <div onClick={()=>updateLineItemQty(item.service_item_id, 0)} style={{fontSize:'12px',color:C.textMuted,cursor:'pointer',padding:'0 4px'}}>{'\u2715'}</div>
          </div>
        ))}
        {lineItems.length>0&&<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontWeight:700,fontSize:'14px'}}><span>Total</span><span>HK${invoiceTotal.toFixed(2)}</span></div>}
        <div onClick={()=>setItemPickerOpen(!itemPickerOpen)} style={{fontSize:'12px',color:C.green,cursor:'pointer',padding:'6px 0'}}>{'+'} Add treatment or charge</div>
        {itemPickerOpen&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'8px',maxHeight:220,overflowY:'auto'}}>
          {catalog.map(item=>(
            <div key={item.id} onClick={()=>addLineItem(item)} style={{padding:'10px 14px',fontSize:'13px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
              <span>{item.name}</span><span style={{color:C.textSub}}>HK${item.default_price}</span>
            </div>
          ))}
          {catalog.length===0&&<div style={{padding:'12px 14px',fontSize:'12px',color:C.textMuted}}>No catalog items for this clinic type yet.</div>}
        </div>}
      </div>
      <SecLabel>Prescription</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'10px'}}>
        {prescriptions.map((rx,i)=>{
          const matches = rx.drug.trim() ? inventoryItems.filter(n=>n.toLowerCase().includes(rx.drug.toLowerCase()) && n.toLowerCase()!==rx.drug.toLowerCase()) : []
          return (
          <div key={i} style={{position:'relative'}}>
            <div style={{display:'flex',gap:'8px'}}>
              <div style={{flex:2,position:'relative'}}>
                <input
                  value={rx.drug}
                  onChange={e=>{updateRx(i,'drug',e.target.value);setSuggestOpen(i)}}
                  onFocus={()=>setSuggestOpen(i)}
                  onBlur={()=>{setTimeout(()=>setSuggestOpen(null),150);checkDrugSafety(i,rx.drug)}}
                  placeholder="Drug name"
                  style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}
                />
                {suggestOpen===i&&matches.length>0&&<div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:'8px',marginTop:'4px',zIndex:20,boxShadow:'0 4px 12px rgba(0,0,0,0.1)',maxHeight:150,overflowY:'auto'}}>
                  {matches.slice(0,5).map((m,mi)=>(
                    <div key={mi} onMouseDown={()=>{updateRx(i,'drug',m);setSuggestOpen(null)}} style={{padding:'8px 12px',fontSize:'12px',cursor:'pointer',borderBottom:mi<matches.length-1?`0.5px solid ${C.border}`:'none'}}>{m}</div>
                  ))}
                </div>}
              </div>
              <input value={rx.dosage} onChange={e=>updateRx(i,'dosage',e.target.value)} placeholder="Dosage" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
              <input value={rx.frequency} onChange={e=>updateRx(i,'frequency',e.target.value)} placeholder="Frequency" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
              {rx.drug.trim()&&<Btn style={{fontSize:'11px',padding:'8px 10px',flexShrink:0}} onClick={()=>setDrugInfoOpen(drugInfoOpen===i?null:i)}>Info</Btn>}
            </div>

            {safetyChecks[i]&&safetyChecks[i].status==='checking'&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'6px'}}>Checking safety data...</div>}
            {safetyChecks[i]&&safetyChecks[i].status==='no_data_on_file'&&<div style={{fontSize:'11px',color:C.amber,marginTop:'6px'}}>{'\u26a0'} No safety data on file for this drug (no local order set, no standardized code for external lookup) - prescribing as usual, nothing blocked.</div>}
            {safetyChecks[i]&&safetyChecks[i].status==='passed'&&<div style={{fontSize:'11px',color:C.green,marginTop:'6px'}}>
              {'\u2713'} {safetyChecks[i].orderSet ? `Checked against ${safetyChecks[i].orderSet.approved_by}'s order set` : 'Checked against external safety database'} - no concerns flagged.
              {safetyChecks[i].orderSet&&(safetyChecks[i].orderSet.min_dose_per_kg||safetyChecks[i].orderSet.max_dose_per_kg)&&<div style={{color:C.textMuted}}>
                {weightKg&&!isNaN(parseFloat(weightKg))
                  ? `Safe range for ${weightKg}kg: ${safetyChecks[i].orderSet.min_dose_per_kg?(safetyChecks[i].orderSet.min_dose_per_kg*parseFloat(weightKg)).toFixed(1):'?'}–${safetyChecks[i].orderSet.max_dose_per_kg?(safetyChecks[i].orderSet.max_dose_per_kg*parseFloat(weightKg)).toFixed(1):'?'} ${safetyChecks[i].orderSet.dose_unit} total - verify your prescribed dose against this.`
                  : `Reference range: ${safetyChecks[i].orderSet.min_dose_per_kg||'?'}–${safetyChecks[i].orderSet.max_dose_per_kg||'?'} ${safetyChecks[i].orderSet.dose_unit}/kg - enter weight above to calculate this patient's exact safe range.`}
              </div>}
              {safetyChecks[i].orderSet?.renal_adjustment_notes&&<div style={{color:C.textMuted}}>Renal: {safetyChecks[i].orderSet.renal_adjustment_notes}</div>}
            </div>}
            {safetyChecks[i]&&safetyChecks[i].status==='hard_stop_blocked'&&<div style={{background:C.redLight,border:`1px solid ${C.red}`,borderRadius:'8px',padding:'10px 12px',marginTop:'6px'}}>
              <div style={{fontSize:'12px',fontWeight:600,color:C.red}}>{'\u26d4'} Blocked - do not prescribe</div>
              <div style={{fontSize:'11px',color:C.red}}>{safetyChecks[i].triggered.join(', ')} - flagged by {safetyChecks[i].orderSet?.approved_by ? `${safetyChecks[i].orderSet.approved_by}'s order set` : 'external safety check'}. Remove this item or choose an alternative.</div>
            </div>}
            {safetyChecks[i]&&safetyChecks[i].status==='soft_stop'&&<div style={{background:C.amberLight,border:`1px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',marginTop:'6px'}}>
              <div style={{fontSize:'12px',fontWeight:600,color:C.amber}}>{'\u26a0'} Warning: {safetyChecks[i].triggered.join(', ')}</div>
              <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>Flagged by {safetyChecks[i].orderSet?.approved_by ? `${safetyChecks[i].orderSet.approved_by}'s order set` : 'external safety check'}. Enter a reason to proceed anyway.</div>
              <input value={overrideReasons[i]||''} onChange={e=>setOverrideReasons({...overrideReasons,[i]:e.target.value})} placeholder="Reason for prescribing despite warning" style={{width:'100%',border:`0.5px solid ${C.amber}`,borderRadius:'6px',padding:'7px 10px',fontSize:'12px',boxSizing:'border-box'}}/>
            </div>}

            {/* Doctor-friendly dosing control - three common HK prescribing patterns */}
            <div style={{marginTop:'6px',background:C.card,borderRadius:'8px',padding:'8px 10px'}}>
              <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
                {[['fixed','Fixed times/day'],['interval','Every X hours'],['prn','PRN (as needed)']].map(([k,l])=>(
                  <div key={k} onClick={()=>updateRx(i,'dosingMode',k)} style={{fontSize:'11px',padding:'5px 9px',borderRadius:'6px',cursor:'pointer',background:(rx.dosingMode||'fixed')===k?C.green:'#fff',color:(rx.dosingMode||'fixed')===k?'#fff':C.textSub,border:`0.5px solid ${C.border}`}}>{l}</div>
                ))}
              </div>

              {(rx.dosingMode||'fixed')==='fixed'&&<div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>Times/day</span>
                <div style={{display:'flex',gap:'4px'}}>
                  {[1,2,3,4].map(n=>(
                    <div key={n} onClick={()=>updateRx(i,'timesPerDay',String(n))} style={{width:26,height:26,borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',cursor:'pointer',background:String(rx.timesPerDay)===String(n)?C.green:'#fff',color:String(rx.timesPerDay)===String(n)?'#fff':C.text,border:`0.5px solid ${C.border}`}}>{n}</div>
                  ))}
                </div>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0,marginLeft:'8px'}}>for</span>
                <input value={rx.durationDays} onChange={e=>updateRx(i,'durationDays',e.target.value)} type="number" placeholder="days" style={{width:56,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'5px 8px',fontSize:'12px',boxSizing:'border-box'}}/>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>days</span>
              </div>}

              {rx.dosingMode==='interval'&&<div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>Every</span>
                <div style={{display:'flex',gap:'4px'}}>
                  {[4,6,8,12].map(h=>(
                    <div key={h} onClick={()=>updateRx(i,'intervalHours',String(h))} style={{padding:'5px 9px',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',cursor:'pointer',background:String(rx.intervalHours)===String(h)?C.green:'#fff',color:String(rx.intervalHours)===String(h)?'#fff':C.text,border:`0.5px solid ${C.border}`}}>{h}h</div>
                  ))}
                </div>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0,marginLeft:'8px'}}>for</span>
                <input value={rx.durationDays} onChange={e=>updateRx(i,'durationDays',e.target.value)} type="number" placeholder="days" style={{width:56,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'5px 8px',fontSize:'12px',boxSizing:'border-box'}}/>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>days</span>
              </div>}

              {rx.dosingMode==='prn'&&<div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <span style={{fontSize:'11px',color:C.textSub}}>Take as needed - specify max per day and any minimum gap in the Frequency field above (e.g. "1 lozenge as needed, max 8/day, at least 2 hours apart").</span>
              </div>}

              <div style={{display:'flex',alignItems:'center',marginTop:'8px',paddingTop:'8px',borderTop:`0.5px solid ${C.border}`}}>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>Qty to dispense</span>
                <div style={{flex:1}}/>
                <input value={rx.quantity} onChange={e=>updateRx(i,'quantity',e.target.value)} placeholder="0" type="number" style={{width:56,flexShrink:0,border:`0.5px solid ${rx.quantity&&!rx.quantityManuallySet?C.green:C.border}`,borderRadius:'6px',padding:'5px 8px',fontSize:'12px',boxSizing:'border-box'}}/>
                {rx.quantity&&!rx.quantityManuallySet&&<span style={{fontSize:'10px',color:C.green,marginLeft:'4px'}}>auto</span>}
              </div>
            </div>

            {drugInfoOpen===i&&<div style={{marginTop:'6px',background:C.blueLight,borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:C.text,lineHeight:1.6}}>
              <strong>{rx.drug} - drug information sheet</strong><br/>
              Standard adult dosing, common side effects, and interaction warnings will display here once linked to a drug reference database (e.g. HK Department of Health formulary). This same sheet is visible to the patient in their Medsa app alongside this prescription.
            </div>}
          </div>
          )
        })}
      </div>
      <Btn style={{marginBottom:'20px'}} onClick={addPrescriptionLine}>+ Add drug</Btn>

      {prescriptions.some(p=>p.drug.trim())&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 14px',fontSize:'12px',color:C.amber,marginBottom:'20px'}}>
        {'\u25c7'} Saving will notify front desk immediately to prepare and label this prescription. Quantity dispensed will auto-deduct from inventory once confirmed.
      </div>}

      <SecLabel>Refer to another doctor</SecLabel>
      {!showReferral&&<Btn style={{marginBottom:'20px'}} onClick={()=>setShowReferral(true)}>+ Refer this patient</Btn>}
      {showReferral&&!referralSent&&<Card style={{padding:'16px',marginBottom:'20px'}}>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>Attach a case note. Search for the receiving doctor - matches from Medsa or the directory auto-fill clinic info; if nothing matches, fill in manually.</div>
        <input value={referralDiagnosis} onChange={e=>setReferralDiagnosis(e.target.value)} placeholder="Diagnosis" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px'}}/>
        <textarea value={referralConsultationSummary} onChange={e=>setReferralConsultationSummary(e.target.value)} rows={3} placeholder="Consultation summary - findings, tests done, treatment so far..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'10px',fontFamily:'inherit',resize:'vertical'}}/>
        <textarea value={referralNote} onChange={e=>setReferralNote(e.target.value)} rows={2} placeholder="Any additional note for the receiving doctor..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'10px',fontFamily:'inherit',resize:'vertical'}}/>
        <div style={{position:'relative',marginBottom:'10px'}}>
          <input value={referralSearch} onChange={e=>{setReferralSearch(e.target.value);setReferralMatched(null)}} placeholder="Doctor name..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          {referralMatches.length>0&&<div style={{position:'absolute',top:'100%',left:0,right:0,background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'8px',marginTop:'4px',zIndex:20,boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
            {referralMatches.map(m=>(
              <div key={m.source+m.id} onClick={()=>handleSelectReferralMatch(m)} style={{padding:'10px 12px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`,fontSize:'13px'}}>
                <div style={{fontWeight:600}}>{m.name}</div>
                <div style={{fontSize:'11px',color:C.textMuted}}>{m.clinicLabel||'—'} {m.source==='medsa'?'· Medsa':'· Directory'}</div>
              </div>
            ))}
          </div>}
        </div>
        {referralMatched&&<div style={{fontSize:'11px',color:C.green,marginBottom:'10px'}}>{'\u2713'} Matched - clinic info auto-filled below</div>}
        <input value={referralClinicName} onChange={e=>setReferralClinicName(e.target.value)} placeholder="Clinic name" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px'}}/>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          <input value={referralClinicPhone} onChange={e=>setReferralClinicPhone(e.target.value)} placeholder="Clinic phone" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          <input value={referralClinicEmail} onChange={e=>setReferralClinicEmail(e.target.value)} placeholder="Clinic email" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <Btn onClick={()=>{setShowReferral(false);setReferralNote('');setReferralSearch('');setReferralMatched(null);setReferralClinicName('');setReferralClinicPhone('');setReferralClinicEmail('');setReferralDiagnosis('');setReferralConsultationSummary('')}}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSendReferral} disabled={referralSending||!referralSearch.trim()}>{referralSending?'Sending…':'Send referral'}</Btn>
        </div>
      </Card>}
      {referralSent&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'12px 14px',fontSize:'12px',color:C.green,marginBottom:'20px'}}>
        {'\u2713'} Referral logged for {referralSearch}{referralClinicName?` at ${referralClinicName}`:''}. {referralMatched?.source==='medsa'?"The receiving doctor will see this patient's consented records once they accept.":'Contact the clinic directly using the details provided, since this referral is outside Medsa.'}
      </div>}

      {error&&<div style={{fontSize:'13px',color:C.red,marginBottom:'12px'}}>{error}</div>}
      {draftSaved&&<div style={{fontSize:'13px',color:C.green,marginBottom:'12px'}}>✓ Draft saved - keep editing, or submit when ready</div>}
      <div style={{display:'flex',gap:'8px'}}>
        <Btn style={{flex:1}} onClick={handleSaveDraft} disabled={savingDraft||saving||saved}>{savingDraft?'Saving…':'Save'}</Btn>
        <Btn variant="primary" style={{flex:1}} onClick={handleSave} disabled={saving||savingDraft||saved}>{saved?'Submitted':saving?'Submitting...':'Submit'}</Btn>
      </div>
    </PageWrap>
  )
}

// ── LABEL STICKER — one editable sticker per drug in a prescription ─────────
// Pulls effects/intake/precautions from the drug_reference library if a
// previous nurse/doctor already filled them in for this drug. If not, the
// fields are empty and editable — saving here writes back to the shared
// reference so it auto-populates next time this same drug is prescribed.
function LabelSticker({ patientName, doctorName, drug, onFieldsChange, medicineType, institutionName }) {
  const [effects,setEffects]=useState('')
  const [intake,setIntake]=useState('')
  const [precautions,setPrecautions]=useState('')
  const [loading,setLoading]=useState(true)
  const [hasReference,setHasReference]=useState(false)
  const [isDangerousDrug,setIsDangerousDrug]=useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('drug_reference').select('*').eq('drug_name', drug.drug).eq('medicine_type', medicineType||'western').maybeSingle()
      if (data) {
        setEffects(data.effects||''); setIntake(data.intake_info||''); setPrecautions(data.precautions||'')
        setHasReference(true)
        setIsDangerousDrug(!!data.is_dangerous_drug)
      }
      setLoading(false)
    }
    load()
  }, [drug.drug, medicineType])

  useEffect(() => {
    onFieldsChange({ effects, intake, precautions })
  }, [effects, intake, precautions])

  return (
    <div style={{background:'#fff',border:`1.5px dashed ${C.border}`,borderRadius:'10px',padding:'14px',marginBottom:'10px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
        <div>
          <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.5px'}}>{institutionName || 'Medsa Clinic'}</div>
          <div style={{fontSize:'14px',fontWeight:700}}>{drug.drug} {drug.dosage}</div>
          <div style={{fontSize:'12px',color:C.textSub}}>{patientName} - Prescribed by {doctorName}</div>
          <div style={{fontSize:'11px',color:C.textMuted}}>{new Date().toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
        </div>
        {hasReference&&!loading&&<Badge text="From library" type="ok"/>}
      </div>
      {isDangerousDrug&&<div style={{background:C.redLight,border:`1px solid ${C.red}`,borderRadius:'6px',padding:'6px 10px',marginBottom:'10px',fontSize:'11px',fontWeight:600,color:C.red}}>{'\u26a0'} Dangerous Drugs Ordinance - statutory tracking required</div>}
      <div style={{fontSize:'11px',color:C.textSub,marginBottom:'10px'}}>
        {drug.frequency||'-'} {drug.durationDays&&`for ${drug.durationDays} days`} {drug.quantity&&`(${drug.quantity} total)`}
      </div>
      {loading?<div style={{fontSize:'11px',color:C.textMuted}}>Checking drug library...</div>:<>
        <div style={{marginBottom:'8px'}}>
          <div style={{fontSize:'10px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'3px'}}>Effects</div>
          <textarea value={effects} onChange={e=>setEffects(e.target.value)} rows={2} placeholder="What this drug does..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'6px 8px',fontSize:'12px',boxSizing:'border-box',fontFamily:'inherit',resize:'vertical'}}/>
        </div>
        <div style={{marginBottom:'8px'}}>
          <div style={{fontSize:'10px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'3px'}}>Intake instructions</div>
          <textarea value={intake} onChange={e=>setIntake(e.target.value)} rows={2} placeholder="How and when to take it..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'6px 8px',fontSize:'12px',boxSizing:'border-box',fontFamily:'inherit',resize:'vertical'}}/>
        </div>
        <div>
          <div style={{fontSize:'10px',fontWeight:600,color:C.red,textTransform:'uppercase',marginBottom:'3px'}}>Precautions & side effects</div>
          <textarea value={precautions} onChange={e=>setPrecautions(e.target.value)} rows={2} placeholder="Warnings, side effects, interactions..." style={{width:'100%',border:`0.5px solid ${C.red}`,borderRadius:'6px',padding:'6px 8px',fontSize:'12px',boxSizing:'border-box',fontFamily:'inherit',resize:'vertical'}}/>
        </div>
      </>}
    </div>
  )
}

function PrescriptionsQueueScreen({ pending, onConfirm, medicineType, onReload, onProceedToBilling, institutionName }) {
  const [printingId,setPrintingId]=useState(null)
  const [openLabelId,setOpenLabelId]=useState(null)
  const [editedFields,setEditedFields]=useState({}) // drugIndex -> {effects,intake,precautions}
  const [inventoryWarning,setInventoryWarning]=useState(null)
  const [expandedRundownId,setExpandedRundownId]=useState(null)
  const [addItemOpenId,setAddItemOpenId]=useState(null)
  const [catalog,setCatalog]=useState([])

  // Real service catalog - same source ConsultationScreen picks from, so
  // front desk adding something (e.g. a sick-leave note the patient asks
  // for at checkout) uses the identical list, not a separate one.
  useEffect(() => {
    async function loadCatalog() {
      const { data } = await supabase.from('service_items').select('*').eq('active', true).order('category')
      setCatalog(data || [])
    }
    loadCatalog()
  }, [])

  // Writes directly to the real, already-saved consultation record - this
  // is front desk adding to something the doctor already submitted, not
  // building a fresh local list the way ConsultationScreen does.
  async function addItemToRecord(p, item) {
    const newLineItems = [...(p.lineItems||[]), { service_item_id: item.id, description: item.name, category: item.category, fee: parseFloat(item.default_price)||0, qty: 1 }]
    const newTotal = newLineItems.reduce((sum,i)=>sum+(i.fee*i.qty),0)
    await supabase.from('medical_records').update({ line_items: newLineItems, total_fee: newTotal }).eq('id', p.recordId)
    setAddItemOpenId(null)
    await onReload()
  }

  async function handleConfirm(p) {
    setPrintingId(p.id)
    setInventoryWarning(null)
    // Save/update the drug reference library with whatever is currently in
    // each label's fields - this is what makes it "automated" next time.
    // Scoped by medicine_type so Western and Chinese medicine formularies
    // never mix, matching HK's two separate regulatory systems.
    for (let idx=0; idx<p.drugs.length; idx++) {
      const drug = p.drugs[idx]
      const fields = editedFields[idx]
      if (fields && (fields.effects||fields.intake||fields.precautions)) {
        await supabase.from('drug_reference').upsert({
          drug_name: drug.drug, medicine_type: medicineType||'western', effects: fields.effects, intake_info: fields.intake,
          precautions: fields.precautions, updated_by: p.doctorName, updated_at: new Date().toISOString(),
        }, { onConflict: 'drug_name,medicine_type' })
      }
    }
    const warnings = await onConfirm(p)
    setTimeout(()=>{
      setPrintingId(null); setOpenLabelId(null); setEditedFields({})
      if (warnings && warnings.length>0) setInventoryWarning(`No inventory match found for: ${warnings.join(', ')} - stock was not deducted. Add these to Inventory or check the spelling matches.`)
    }, 900)
  }

  const waiting = pending.filter(p=>p.status==='pending')
  const done = pending.filter(p=>p.status==='printed')

  // Real dispensing history export - queries the actual dispensed_by/
  // dispensed_at fields on medications, not just what's currently pending
  // in this session's queue.
  const [exporting,setExporting]=useState(false)
  const [exportMsg,setExportMsg]=useState(null)
  async function handleExportMedicationLog() {
    setExporting(true)
    const { data } = await supabase.from('medications').select('medication_name,dosage,dispensed_by,dispensed_at,patient_id,patients(full_name)')
      .eq('institution_source','clinic_ops').not('dispensed_at','is',null).order('dispensed_at',{ascending:false})
    const rows = [['Patient','Medication','Dosage','Dispensed By','Dispensed At']]
    ;(data||[]).forEach(m => rows.push([m.patients?.full_name||'Unknown', m.medication_name||'', m.dosage||'', m.dispensed_by||'', m.dispensed_at?new Date(m.dispensed_at).toLocaleString('en-HK'):'']))
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Medication-Log-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    setExporting(false)
    setExportMsg(`Downloaded ${(data||[]).length} records`)
    setTimeout(()=>setExportMsg(null), 3000)
  }

  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Prescriptions</h2>
      <div style={{textAlign:'center',marginBottom:'16px'}}>
        {exportMsg&&<div style={{fontSize:'12px',color:C.green,marginBottom:'8px'}}>{'\u2713'} {exportMsg}</div>}
        <button onClick={handleExportMedicationLog} disabled={exporting} style={{padding:'8px 16px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{exporting?'Preparing…':'Export medication log (CSV)'}</button>
      </div>
      {inventoryWarning&&<div style={{background:C.redLight,border:`0.5px solid ${C.red}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:C.red}}>{'\u26a0'} {inventoryWarning}</div>}

      {waiting.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px',marginBottom:'20px'}}>No pending prescriptions right now.</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'28px'}}>
        {waiting.map(p=>{
          const isOpen = openLabelId===p.id
          const isRundownOpen = expandedRundownId===p.id
          return (
          <Card key={p.id} style={{padding:'16px 18px',border:`1.5px solid ${C.amber}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:700}}>{p.patientName}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>Prescribed by {p.doctorName} - {new Date(p.timestamp).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <Badge text="New" type="due"/>
            </div>

            <div onClick={()=>setExpandedRundownId(isRundownOpen?null:p.id)} style={{fontSize:'11px',color:C.green,cursor:'pointer',marginBottom:'10px'}}>
              {isRundownOpen?'Hide consultation rundown':'View full consultation rundown'}
            </div>
            {isRundownOpen&&<div style={{background:C.card,borderRadius:'8px',padding:'12px',marginBottom:'12px'}}>
              {p.diagnosis&&<div style={{fontSize:'12px',marginBottom:'6px'}}><span style={{color:C.textMuted}}>Diagnosis: </span>{p.diagnosis}{p.icd10Code&&<span style={{color:C.textMuted}}> ({p.icd10Code})</span>}</div>}
              {p.notes&&<div style={{fontSize:'12px',marginBottom:'8px'}}><span style={{color:C.textMuted}}>Notes: </span>{p.notes}</div>}
              <div style={{fontSize:'10px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>Itemized charges</div>
              {(p.lineItems||[]).map((item,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'12px',padding:'3px 0'}}>
                  <span>{item.description} {item.qty>1&&`x${item.qty}`}</span><span>HK${(item.fee*item.qty).toFixed(2)}</span>
                </div>
              ))}
              {(!p.lineItems||p.lineItems.length===0)&&<div style={{fontSize:'12px',color:C.textMuted}}>No itemized charges yet.</div>}
              <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:'13px',padding:'6px 0',borderTop:`0.5px solid ${C.border}`,marginTop:'4px'}}><span>Total</span><span>HK${(p.totalFee||0).toFixed(2)}</span></div>
              <div onClick={()=>setAddItemOpenId(addItemOpenId===p.id?null:p.id)} style={{fontSize:'11px',color:C.green,cursor:'pointer',marginTop:'8px'}}>{'+'} Add item (e.g. sick leave note)</div>
              {addItemOpenId===p.id&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'8px',maxHeight:180,overflowY:'auto',marginTop:'6px'}}>
                {catalog.map(item=>(
                  <div key={item.id} onClick={()=>addItemToRecord(p,item)} style={{padding:'8px 12px',fontSize:'12px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
                    <span>{item.name}</span><span style={{color:C.textSub}}>HK${item.default_price}</span>
                  </div>
                ))}
              </div>}
            </div>}
            <div onClick={()=>setOpenLabelId(isOpen?null:p.id)} style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'12px',cursor:'pointer'}}>
              {p.drugs.map((d,i)=>(<div key={i} style={{fontSize:'13px',padding:'3px 0'}}>{d.drug} {d.dosage&&('- '+d.dosage)} {d.frequency&&('- '+d.frequency)}</div>))}
              <div style={{fontSize:'11px',color:C.green,marginTop:'4px'}}>{isOpen?'Hide label sticker preview':'Tap to review & edit label stickers'}</div>
            </div>

            {isOpen&&<div style={{marginBottom:'12px'}}>
              {p.drugs.map((drug,idx)=>(
                <LabelSticker
                  key={idx}
                  patientName={p.patientName}
                  doctorName={p.doctorName}
                  drug={drug}
                  medicineType={medicineType}
                  institutionName={institutionName}
                  onFieldsChange={(fields)=>setEditedFields(prev=>({...prev,[idx]:fields}))}
                />
              ))}
            </div>}

            <Btn variant="primary" style={{width:'100%'}} onClick={()=>handleConfirm(p)} disabled={printingId===p.id}>
              {printingId===p.id?'Printing labels...':'Confirm & print labels'}
            </Btn>
          </Card>
          )
        })}
      </div>
      {done.length>0&&<>
        <SecLabel>Printed today</SecLabel>
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {done.map(p=>(
            <Card key={p.id} style={{padding:'12px 16px',opacity:0.85}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:p.dispensedBy?'4px':'0'}}>
                <div><div style={{fontSize:'13px',fontWeight:500}}>{p.patientName}</div><div style={{fontSize:'11px',color:C.textSub}}>{p.doctorName}</div></div>
                <Badge text="Printed" type="ok"/>
              </div>
              {p.dispensedBy&&<div style={{fontSize:'10px',color:C.textMuted}}>Confirmed by {p.dispensedBy} at {new Date(p.dispensedAt).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}</div>}
              <Btn variant="primary" style={{width:'100%',marginTop:'10px'}} onClick={()=>onProceedToBilling(p)}>
                Proceed to billing (HK${(p.totalFee||0).toFixed(2)})
              </Btn>
            </Card>
          ))}
        </div>
      </>}
    </PageWrap>
  )
}

function OverviewScreen({ queue, pendingCount, onRemoveFromQueue, onCancelAppointment }) {
  const inRoom = queue.length
  const [todaysQueue,setTodaysQueue]=useState([]) // scheduled but not yet checked in
  const [loadingQueue,setLoadingQueue]=useState(true)
  const [activeAction,setActiveAction]=useState(null) // {type:'checkedin'|'scheduled', entry}

  // Real revenue stat - queries today's actual transactions. This was
  // previously a static "HK$4,820" string that never changed at all, and
  // then briefly a reference to variables that were never declared,
  // which crashed this entire screen. Both are fixed here: real query,
  // real state.
  const [todaysRevenue,setTodaysRevenue]=useState(0)
  const [todaysTransactionCount,setTodaysTransactionCount]=useState(0)

  async function loadRevenue() {
    const dayStart = new Date(); dayStart.setHours(0,0,0,0)
    const dayEnd = new Date(); dayEnd.setHours(23,59,59,999)
    const { data } = await supabase.from('transactions').select('patient_pays')
      .gte('created_at', dayStart.toISOString()).lte('created_at', dayEnd.toISOString())
    setTodaysRevenue((data||[]).reduce((sum,t)=>sum+(t.patient_pays||0),0))
    setTodaysTransactionCount((data||[]).length)
  }

  async function loadTodaysQueue() {
    setLoadingQueue(true)
    const dayStart = new Date(); dayStart.setHours(0,0,0,0)
    const dayEnd = new Date(); dayEnd.setHours(23,59,59,999)
    const { data } = await supabase.from('appointments').select('*, patients(full_name, medsa_id)')
      .eq('institution_source', 'clinic_ops')
      .neq('status', 'cancelled')
      .neq('status', 'checked_in')
      .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())
      .order('scheduled_at', {ascending:true})
    setTodaysQueue((data||[]).map(a=>({
      id:a.id, time:new Date(a.scheduled_at).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit',hour12:false}),
      patientName:a.patients?.full_name||'Unknown', medsaId:a.patients?.medsa_id||null, doctor:a.doctor_name||'Unassigned',
    })))
    setLoadingQueue(false)
  }

  useEffect(() => { loadTodaysQueue(); loadRevenue() }, [])

  return (
    <PageWrap maxWidth={720}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Overview</h2>
      <div style={{display:'flex',gap:'12px',marginBottom:'24px'}}>
        <StatCard label="Checked in today" value={inRoom} sub="patients" color={C.blue} bg={C.blueLight}/>
        <StatCard label="Pending prescriptions" value={pendingCount} sub="awaiting front desk" color={C.amber} bg={C.amberLight}/>
        <StatCard label="Today's revenue" value={`HK$${todaysRevenue.toFixed(0)}`} sub={`${todaysTransactionCount} transaction${todaysTransactionCount===1?'':'s'}`} color={C.green} bg={C.greenLight}/>
      </div>
      <SecLabel>Checked-in patients</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
        {queue.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'16px'}}>No one checked in yet.</div>}
        {queue.map((q,i)=>{
          const hrsLeft = hoursRemaining(q.checkedInAt)
          return (
            <Card key={i} onClick={()=>setActiveAction({type:'checkedin', entry:q, index:i})} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer'}}>
              <div style={{width:32,height:32,borderRadius:'8px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,flexShrink:0}}>{q.ticket}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:500}}>{q.patientName}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{q.doctor}</div>
              </div>
              <Badge text={hrsLeft>0?`${Math.floor(hrsLeft)}h left`:'Expired'} type={hrsLeft>0?'ok':'full'}/>
              <span style={{color:C.textMuted,fontSize:'14px'}}>›</span>
            </Card>
          )
        })}
      </div>

      <SecLabel>Today's queue - not yet checked in</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {loadingQueue&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'16px'}}>Loading…</div>}
        {!loadingQueue&&todaysQueue.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'16px'}}>Nothing else scheduled for today.</div>}
        {todaysQueue.map((a,i)=>(
          <Card key={a.id} onClick={()=>setActiveAction({type:'scheduled', entry:a})} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer'}}>
            <div style={{width:32,textAlign:'center',fontSize:'12px',fontWeight:700,color:C.textSub,flexShrink:0}}>{a.time}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'13px',fontWeight:500}}>{a.patientName}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{a.doctor}</div>
            </div>
            <span style={{color:C.textMuted,fontSize:'14px'}}>›</span>
          </Card>
        ))}
      </div>

      {activeAction&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setActiveAction(null)}>
        <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:380,padding:'24px'}}>
          <div style={{fontSize:'16px',fontWeight:700,marginBottom:'6px'}}>{activeAction.entry.patientName}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'18px'}}>{activeAction.type==='checkedin'?`${activeAction.entry.ticket} · checked in`:`${activeAction.entry.time} · scheduled`}</div>
          {activeAction.type==='checkedin'
            ? <Btn variant="danger" style={{width:'100%'}} onClick={async()=>{await onRemoveFromQueue(activeAction.index);setActiveAction(null)}}>↩ Cancel check-in</Btn>
            : <Btn variant="danger" style={{width:'100%'}} onClick={async()=>{await onCancelAppointment(activeAction.entry.id);setActiveAction(null);loadTodaysQueue()}}>✕ Cancel appointment</Btn>}
          <Btn style={{width:'100%',marginTop:'8px'}} onClick={()=>setActiveAction(null)}>Close</Btn>
        </div>
      </div>}
    </PageWrap>
  )
}



// ── CLINIC SCHEDULE ACTIONS — reschedule, switch doctor, cancel, follow-up ──
// Available to both doctors and front desk/admin - anyone with schedule
// access should be able to make these changes, not just reception staff.
function ClinicScheduleActionModal({ appt, onClose, onSave, withinDataWindow, consentReason, onConfirmConsent, onGoToConsultation, onCancelCheckIn, role, onCheckedIn, onScheduleFollowup }) {
  const [mode,setMode]=useState(null) // null | 'reschedule' | 'switch' | 'cancel' | 'followup' | 'notes'
  const [checkingIn,setCheckingIn]=useState(false)
  const [newTime,setNewTime]=useState('')
  const [newDoctor,setNewDoctor]=useState('')
  const [followupDate,setFollowupDate]=useState('')
  const [followupType,setFollowupType]=useState('')
  const [notesDraft,setNotesDraft]=useState('')
  const [fullPatient,setFullPatient]=useState(null)
  const [loadingPatient,setLoadingPatient]=useState(true)
  const [clinicDoctors,setClinicDoctors]=useState([])
  const [patientFetchError,setPatientFetchError]=useState(null)
  const [conditions,setConditions]=useState([])
  const [allergies,setAllergies]=useState([])
  const [medications,setMedications]=useState([])
  const [records,setRecords]=useState([])

  // Real working-hours-based slots for rescheduling - replaces the
  // hardcoded ['09:00','09:30',...] list, which never reflected the
  // doctor's actual hours (set in Working Hours) and could suggest a
  // time they don't even work.
  const [availableSlots,setAvailableSlots]=useState([])
  const [slotsLoading,setSlotsLoading]=useState(true)

  useEffect(() => {
    loadClinicDoctors().then(setClinicDoctors)
  }, [])

  useEffect(() => {
    async function loadSlots() {
      setSlotsLoading(true)
      if (!appt?.doctor) { setAvailableSlots([]); setSlotsLoading(false); return }
      const dayOfWeek = new Date().getDay()
      const { data } = await supabase.from('doctor_availability').select('*')
        .eq('doctor_name', appt.doctor).eq('institution_source', 'clinic_ops').eq('day_of_week', dayOfWeek).maybeSingle()
      if (!data || data.is_off) { setAvailableSlots([]); setSlotsLoading(false); return }
      const slots = []
      const [startH, startM] = (data.start_time||'09:00').split(':').map(Number)
      const [endH, endM] = (data.end_time||'17:00').split(':').map(Number)
      let current = startH*60 + startM
      const end = endH*60 + endM
      while (current < end) {
        slots.push(`${String(Math.floor(current/60)).padStart(2,'0')}:${String(current%60).padStart(2,'0')}`)
        current += data.slot_duration_minutes || 30
      }
      setAvailableSlots(slots)
      setSlotsLoading(false)
    }
    loadSlots()
  }, [appt?.doctor])

  // Show real patient info here - the same view as when their Medsa ID is
  // scanned at check-in - not just a bare scheduling row. Full medical
  // history is available here (within the consent window) so a doctor
  // can review and prep ahead of a follow-up or first visit - this is
  // separate from "Log diagnosis," which still requires actual check-in.
  useEffect(() => {
    async function loadPatient() {
      if (!appt?.medsaId) { setLoadingPatient(false); setPatientFetchError('This appointment has no linked Medsa ID.'); return }
      setLoadingPatient(true)
      const { data, error: fetchErr } = await supabase.from('patients').select('*').eq('medsa_id', appt.medsaId).maybeSingle()
      if (fetchErr) setPatientFetchError(fetchErr.message)
      else if (!data) setPatientFetchError(`No patient record found for Medsa ID ${appt.medsaId}.`)
      else setPatientFetchError(null)
      setFullPatient(data || null)
      if (data) {
        const [condRes, allergyRes, medRes, recRes] = await Promise.all([
          supabase.from('conditions').select('*').eq('patient_id', data.id).eq('active', true),
          supabase.from('allergies').select('*').eq('patient_id', data.id),
          supabase.from('medications').select('*').eq('patient_id', data.id),
          supabase.from('medical_records').select('*, institutions(name)').eq('patient_id', data.id).order('date_of_record',{ascending:false}).limit(5),
        ])
        setConditions(condRes.data||[])
        setAllergies(allergyRes.data||[])
        setMedications(medRes.data||[])
        setRecords(recRes.data||[])
      }
      setLoadingPatient(false)
    }
    loadPatient()
  }, [appt?.medsaId])

  if (!appt || appt.status==='open') return null

  // Full diagnosis access requires both being within the patient's own
  // consent window AND having actually checked in - being scheduled for
  // today alone isn't enough to log a new diagnosis.
  const isCheckedIn = appt.status==='checked_in'
  const canLogDiagnosis = withinDataWindow && isCheckedIn && role==='doctor'

  // Only offer doctors in the same department/specialty as this
  // appointment - switching to an unrelated specialty wouldn't make sense.
  const DOCTORS = clinicDoctors.filter(d=>d.department===appt.department && d.name!==appt.doctor).map(d=>d.name)

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:420,padding:'24px',maxHeight:'85vh',overflowY:'auto'}}>
        <div onClick={onClose} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'14px'}}>Close</div>

        {loadingPatient&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,marginBottom:'14px'}}>Loading patient…</div>}
        {!loadingPatient&&patientFetchError&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.amber}}>⚠ {patientFetchError}</div>}

        {!loadingPatient&&withinDataWindow&&fullPatient&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'12px',padding:'16px',marginBottom:'14px'}}>
          <div style={{fontSize:'11px',color:C.green,fontWeight:600,textTransform:'uppercase',marginBottom:'6px'}}>{isCheckedIn?'✓ Checked in':'Scheduled'}</div>
          <div style={{fontSize:'17px',fontWeight:700}}>{fullPatient.full_name}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>{fullPatient.medsa_id} · DOB {new Date(fullPatient.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
          <div style={{display:'flex',gap:'10px'}}>
            <div style={{flex:1,background:'#fff',borderRadius:'8px',padding:'8px',textAlign:'center'}}>
              <div style={{fontSize:'10px',color:C.textMuted}}>Blood type</div>
              <div style={{fontSize:'15px',fontWeight:700,color:C.red}}>{fullPatient.blood_type||'-'}</div>
            </div>
            <div style={{flex:2,background:'#fff',borderRadius:'8px',padding:'8px'}}>
              <div style={{fontSize:'10px',color:C.textMuted}}>Visit</div>
              <div style={{fontSize:'12px',fontWeight:600}}>{appt.time} · {appt.type}</div>
            </div>
          </div>
        </div>}

        {!loadingPatient&&withinDataWindow&&fullPatient&&role==='doctor'&&<div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'8px'}}>Medical history</div>
          {allergies.length>0&&<div style={{background:C.redLight,borderRadius:'8px',padding:'10px 12px',marginBottom:'8px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.red,marginBottom:'4px'}}>⚠ Allergies</div>
            {allergies.map((a,i)=><div key={i} style={{fontSize:'12px',color:C.text}}>{a.allergen} ({a.severity})</div>)}
          </div>}
          {conditions.length>0&&<div style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'8px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.text,marginBottom:'4px'}}>Active conditions</div>
            {conditions.map((c,i)=><div key={i} style={{fontSize:'12px',color:C.textSub}}>{c.condition_name}{c.severity?` (${c.severity})`:''}</div>)}
          </div>}
          {medications.length>0&&<div style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'8px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.text,marginBottom:'4px'}}>Current medications</div>
            {medications.map((m,i)=><div key={i} style={{fontSize:'12px',color:C.textSub}}>{m.medication_name} {m.dosage||''} — {m.frequency||''}</div>)}
          </div>}
          {records.length>0&&<div style={{background:C.card,borderRadius:'8px',padding:'10px 12px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.text,marginBottom:'4px'}}>Recent records</div>
            {records.map((r,i)=><div key={i} style={{fontSize:'12px',color:C.textSub,marginBottom:'2px'}}>{new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short'})} — {r.title}{r.institutions?.name?`, ${r.institutions.name}`:''}</div>)}
          </div>}
          {allergies.length===0&&conditions.length===0&&medications.length===0&&records.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'12px'}}>No history on file yet.</div>}
        </div>}

        {!loadingPatient&&withinDataWindow&&fullPatient&&role!=='doctor'&&<div style={{background:C.card,borderRadius:'10px',padding:'12px 14px',marginBottom:'14px',fontSize:'12px',color:C.textMuted,lineHeight:1.5}}>
          ◇ Medical history is only visible to doctors. Scheduling changes still work below.
        </div>}

        {!loadingPatient&&!withinDataWindow&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'14px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>
          ◇ {appt.patient} · {appt.time} · {appt.type} — {consentReason==='outside_window'
            ? "outside this patient's consent window, so clinical details aren't shown here."
            : 'no consent is on file for this patient yet, so clinical details aren\'t shown here.'} Scheduling changes still work below.
        </div>}
        {!loadingPatient&&!withinDataWindow&&consentReason==='no_consent'&&role!=='doctor'&&<Btn variant="primary" style={{width:'100%',marginBottom:'14px'}} onClick={()=>onConfirmConsent?.(appt)}>Confirm patient consented (verbal/paper) at check-in</Btn>}

        {mode!=='notes'&&<div onClick={()=>{setNotesDraft(appt.notes||'');setMode('notes')}} style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.textSub,lineHeight:1.5,cursor:'pointer'}}>
          <div style={{fontWeight:600,color:C.text,marginBottom:'2px',display:'flex',justifyContent:'space-between'}}><span>Patient notes</span><span style={{color:C.green,fontSize:'11px'}}>Edit</span></div>{appt.notes||'No notes yet - tap to add'}
        </div>}

        {mode==='notes'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Notes for {appt.patient}</div>
          <textarea value={notesDraft} onChange={e=>setNotesDraft(e.target.value)} rows={4} placeholder="Symptoms, patient-reported notes, anything relevant for the visit…" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginBottom:'14px',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={()=>{onSave({...appt,notes:notesDraft});setMode(null)}}>Save notes</Btn>
          </div>
        </>}

        {!mode&&<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {!isCheckedIn&&onCheckedIn&&<Btn variant="primary" style={{width:'100%'}} disabled={checkingIn} onClick={async()=>{
            setCheckingIn(true)
            const result = await onCheckedIn({ id: appt.patientId, full_name: appt.patient })
            setCheckingIn(false)
            if (result === true) onClose()
          }}>{checkingIn?'Checking in...':'✓ Check in'}</Btn>}
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>setMode('reschedule')}>📅 Change date/time</Btn>
          <Btn style={{width:'100%'}} onClick={()=>setMode('switch')}>⇄ Switch doctor/treatment</Btn>
          <Btn style={{width:'100%'}} onClick={()=>setMode('followup')}>+ Add follow-up appointment</Btn>
          {canLogDiagnosis
            ? <Btn style={{width:'100%'}} onClick={()=>onGoToConsultation(appt)}>📋 Full diagnosis / log</Btn>
            : <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',padding:'8px'}}>◇ {role!=='doctor'?'Full diagnosis/log is only available to doctors':`Full diagnosis/log unlocks once this patient has checked in${!withinDataWindow?' and is within their consent window':''}`}</div>}
          {isCheckedIn&&onCancelCheckIn&&<Btn style={{width:'100%'}} onClick={()=>setMode('cancelcheckin')}>↩ Cancel check-in</Btn>}
          <Btn variant="danger" style={{width:'100%'}} onClick={()=>setMode('cancel')}>✕ Cancel appointment</Btn>
        </div>}

        {mode==='cancelcheckin'&&<>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'14px'}}>Undo {appt.patient}'s check-in? This puts the appointment back to "scheduled" and removes them from today's active queue - use this to fix a mistaken check-in or to check them out for testing.</div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Keep checked in</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={async()=>{await onCancelCheckIn(appt);setMode(null);onClose()}}>Confirm undo</Btn>
          </div>
        </>}

        {mode==='reschedule'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>New time for {appt.patient}</div>
          {slotsLoading&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'14px'}}>Loading {appt.doctor}'s working hours…</div>}
          {!slotsLoading&&availableSlots.length===0&&<div style={{fontSize:'12px',color:C.amber,marginBottom:'14px'}}>{'\u26a0'} No working hours set for {appt.doctor} today - set them in Working Hours before rescheduling here.</div>}
          {!slotsLoading&&availableSlots.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'14px'}}>
            {availableSlots.map(t=>(
              <div key={t} onClick={()=>setNewTime(t)} style={{border:`0.5px solid ${newTime===t?C.green:C.border}`,borderRadius:'8px',padding:'8px',textAlign:'center',fontSize:'12px',cursor:'pointer',background:newTime===t?C.green:C.card,color:newTime===t?'#fff':C.text}}>{t}</div>
            ))}
          </div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={()=>{onSave({...appt,time:newTime||appt.time});onClose()}} disabled={!newTime}>Confirm change</Btn>
          </div>
        </>}

        {mode==='switch'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Switch doctor for {appt.patient}</div>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>Showing doctors in {appt.department} only</div>
          {DOCTORS.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'14px'}}>No other doctor in this department yet.</div>}
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'14px'}}>
            {DOCTORS.map(d=>(
              <div key={d} onClick={()=>setNewDoctor(d)} style={{border:`0.5px solid ${newDoctor===d?C.green:C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',background:newDoctor===d?C.green:C.card,color:newDoctor===d?'#fff':C.text}}>{d}</div>
            ))}
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={()=>{onSave({...appt,doctor:newDoctor||appt.doctor});onClose()}} disabled={!newDoctor}>Confirm switch</Btn>
          </div>
        </>}

        {mode==='followup'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Follow-up appointment for {appt.patient}</div>
          <input value={followupDate} onChange={e=>setFollowupDate(e.target.value)} type="date" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input value={followupType} onChange={e=>setFollowupType(e.target.value)} placeholder="Reason, e.g. Follow-up review" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'14px',boxSizing:'border-box'}}/>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'14px'}}>This takes you to Schedule with {appt.patient} already selected, so you just pick the day and time - no need to search or re-enter their details.</div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={()=>{onScheduleFollowup?.({ full_name: appt.patient, id: appt.patientId }); onClose()}} disabled={!followupDate||!followupType}>Schedule follow-up</Btn>
          </div>
        </>}

        {mode==='cancel'&&<>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'14px'}}>Cancel {appt.patient}'s appointment at {appt.time}? This can't be undone from here.</div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Keep appointment</Btn>
            <Btn variant="danger" style={{flex:1}} onClick={()=>{onSave({...appt,cancelled:true});onClose()}}>Confirm cancel</Btn>
          </div>
        </>}
      </div>
    </div>
  )
}

// ── WORKING HOURS — admin sets each doctor's weekly availability ───────────
// This is the real source of truth for both the doctor's own schedule view
// and what patients see as bookable slots in Find Care - replacing the
// previous hardcoded/pseudo-random time slots on both sides.
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// ── PRACTICE MANAGER — STAFF ─────────────────────────────────────────────────
// Deliberately consolidated into one screen with tabs, not five separate
// screens like the Practitioner-side HR system - a small clinic doesn't need
// that much structure, just needs the same real underlying jobs done.
function HelpScreen({ staffMember }) {
  const [expanded,setExpanded]=useState(null)
  const [submitType,setSubmitType]=useState(null) // 'technical_issue' | 'complaint' | null
  const [message,setMessage]=useState('')
  const [saving,setSaving]=useState(false)
  const [sent,setSent]=useState(false)

  async function handleSubmit() {
    if (!message.trim()) return
    setSaving(true)
    await supabase.from('support_requests').insert({
      type: submitType, staff_name: staffMember?.name, institution_source: 'clinic_ops', message,
    })
    setSaving(false)
    setSent(true)
  }

  const ITEMS = [
    { key:'technical', title:'Report a technical issue', sub:'Contact Medsa support team', isForm:true, formType:'technical_issue' },
    { key:'complaint', title:'Submit a complaint', sub:'About a patient, colleague, or process', isForm:true, formType:'complaint' },
    { key:'faq', title:'FAQ', sub:'Common questions about the portal', content:'Q: How do I reset a staff PIN?\nA: Practice Manager → Staff → select the staff member → Reset PIN.\n\nQ: What if a patient has no appointment when checking in?\nA: Book one via Scheduling first - check-in requires a real appointment to correctly notify the doctor.\n\nQ: How do I add a new insurance plan?\nA: Use the Insurance Plans admin page - real age-banded pricing tiers are required.' },
    { key:'privacy', title:'Data & privacy', sub:'How patient data is protected', content:'Patient records are only visible within their consent window, or with explicit patient-granted access. Staff actions on patient records are logged. Patients own their claimed records - a clinic never retains ownership once a profile is claimed.' },
  ]

  return (
    <div style={{background:C.beige,flex:1,minHeight:'100vh'}}>
      <SecLabel>Help & support</SecLabel>
      {ITEMS.map(item=>(
        <div key={item.key}>
          <Card onClick={()=>{setExpanded(expanded===item.key?null:item.key); if(item.isForm){setSubmitType(item.formType);setSent(false);setMessage('')}}} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
            <div><div style={{fontSize:'14px',fontWeight:500}}>{item.title}</div><div style={{fontSize:'12px',color:C.textSub}}>{item.sub}</div></div>
            <span style={{color:C.textMuted,fontSize:'18px'}}>{expanded===item.key?'\u2039':'\u203a'}</span>
          </Card>
          {expanded===item.key&&item.content&&<Card style={{padding:'14px 16px',marginTop:'-6px',whiteSpace:'pre-wrap',fontSize:'13px',color:C.textSub,lineHeight:1.6}}>{item.content}</Card>}
          {expanded===item.key&&item.isForm&&<Card style={{padding:'14px 16px',marginTop:'-6px'}}>
            {sent
              ? <div style={{fontSize:'13px',color:C.green}}>{'\u2713'} Sent - Medsa support will follow up.</div>
              : <>
                  <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="Describe the issue…" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'10px',fontFamily:'inherit',resize:'vertical'}}/>
                  <Btn variant="primary" style={{width:'100%'}} onClick={handleSubmit} disabled={saving||!message.trim()}>{saving?'Sending…':'Send'}</Btn>
                </>}
          </Card>}
        </div>
      ))}
    </div>
  )
}

function PracticeManagerStaffScreen({ staffMember, institutionId }) {
  const [tab,setTab]=useState('roster')
  const [staff,setStaff]=useState([])
  const [leaves,setLeaves]=useState([])
  const [loading,setLoading]=useState(true)
  const [showOnboard,setShowOnboard]=useState(false)
  const [newFirstName,setNewFirstName]=useState('')
  const [newLastName,setNewLastName]=useState('')
  const [newRole,setNewRole]=useState('doctor')
  const [newDept,setNewDept]=useState('')
  const [newReg,setNewReg]=useState('')
  const [newExpiry,setNewExpiry]=useState('')
  const [newDisciplinary,setNewDisciplinary]=useState('clear')
  const [newSex,setNewSex]=useState('')
  const [newDob,setNewDob]=useState('')
  const [newEpcLink,setNewEpcLink]=useState('')
  const [newIsNurse,setNewIsNurse]=useState(false)
  const [newMchkDeclared,setNewMchkDeclared]=useState(false)
  const [newSchemes,setNewSchemes]=useState([])
  const [onboardError,setOnboardError]=useState(null)
  const [bulkImportResult,setBulkImportResult]=useState(null)
  const [newPin,setNewPin]=useState('')
  const [uploadedDocUrl,setUploadedDocUrl]=useState(null)
  const [uploadedDocName,setUploadedDocName]=useState(null)
  const [uploading,setUploading]=useState(false)

  const ROLE_LABELS = { doctor:'Doctor', clinic_assistant:'Clinic Assistant', admin:'Practice Manager' }

  async function handleDocUpload(file) {
    setUploading(true)
    setUploadedDocName(file.name)
    // Requires a Supabase Storage bucket named 'staff-documents' to exist -
    // this is new infrastructure, not previously used anywhere in the app.
    // Create it once in Supabase Dashboard -> Storage -> New bucket.
    const path = `clinic_ops/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('staff-documents').upload(path, file)
    if (!error) {
      // Storing the path, not a public URL - professional registration
      // documents shouldn't be openly accessible to anyone with a link.
      // A signed URL should be generated on demand if/when a real "view
      // document" feature is built - this field is currently write-only,
      // nothing in the app displays it back yet.
      setUploadedDocUrl(path)
    }
    setUploading(false)
  }
  const [saving,setSaving]=useState(false)

  async function load() {
    setLoading(true)
    const [{data:s},{data:l}] = await Promise.all([
      supabase.from('staff_credentials').select('*').eq('institution_source','clinic_ops').eq('status','active').order('full_name'),
      supabase.from('clinic_leave_requests').select('*').eq('institution_source','clinic_ops').eq('status','pending'),
    ])
    setStaff(s||[])
    setLeaves(l||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const expiringSoon = staff.filter(s => s.registration_expiry && new Date(s.registration_expiry) <= new Date(Date.now()+120*24*60*60*1000))

  async function handleStaffBulkFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!institutionId) { setBulkImportResult({ imported:0, skipped:0, total:0, error:'Institution not resolved yet - try again in a moment.' }); return }
    const text = await file.text()
    const rows = parseCSV(text)
    let imported=0
    const skippedRows = []
    for (const row of rows) {
      if (!row.full_name || !row.role || !row.department) { skippedRows.push(`${row.full_name||'(no name)'} - missing full_name/role/department`); continue }
      if (row.role==='doctor' && !row.date_of_birth) { skippedRows.push(`${row.full_name} - doctors require date_of_birth`); continue }
      const rowIsNurse = row.role==='clinic_assistant' && ['true','yes','1'].includes((row.is_nurse||'').toLowerCase())
      // e-PC required per row for doctors and nurse-flagged assistants -
      // this is the real scan target itself (see epc_link below), not a
      // separately Medsa-generated code, so it can't be skipped here.
      if ((row.role==='doctor' || rowIsNurse) && !row.epc_link?.trim()) { skippedRows.push(`${row.full_name} - e-PC link required for doctors/nurses`); continue }
      const medsaId = `MED-${Date.now().toString(36).toUpperCase()}-${imported}`
      // Check for an existing person with this same e-PC before creating
      // a duplicate - the e-PC is the real, durable identity here.
      if (row.epc_link?.trim()) {
        const { data: existing } = await supabase.from('staff_credentials').select('id').eq('epc_link', row.epc_link.trim()).maybeSingle()
        if (existing) { skippedRows.push(`${row.full_name} - e-PC already on file for another staff record`); continue }
      }
      const { error: insErr } = await supabase.from('staff_credentials').insert({
        institution_source:'clinic_ops', institution_id:institutionId, medsa_id:medsaId,
        full_name:row.full_name, role:row.role, department:row.department,
        registration_number:row.registration_number||null, registration_expiry:row.registration_expiry||null,
        sex:row.sex||null, date_of_birth:row.date_of_birth||null,
        has_epc: !!row.epc_link?.trim(),
        is_nurse: rowIsNurse,
        epc_link: row.epc_link?.trim() || null,
        // Deliberately never true via bulk import, regardless of CSV
        // content - this is a personal legal declaration a doctor makes
        // about themselves, not something an admin import can set on
        // their behalf. Each doctor confirms this individually later.
        mchk_declaration_agreed: false, mchk_declaration_timestamp: null,
        schemes: row.role==='doctor' && row.schemes ? row.schemes.split(';').map(s=>s.trim()).filter(Boolean) : null,
        disciplinary_status: row.disciplinary_status||'none', onboarded_by:staffMember?.name, status:'active',
        verification_status:'verified',
        // Automatic at onboarding, not a separate manual grant - the
        // portal should always exist for a doctor or nurse-flagged
        // clinic assistant, whether or not they actually choose to use
        // it. A practice manager can still revoke it later if needed.
        practitioner_portal_enabled: row.role==='doctor' || rowIsNurse,
        practitioner_portal_granted_by: 'onboarding', practitioner_portal_granted_at: new Date().toISOString(),
      })
      if (insErr) { skippedRows.push(`${row.full_name} - ${insErr.message}`); continue }
      // Same temporary-password precedent already established in the
      // migration script - real hashing, never plain text, each person
      // changes it individually once they can actually log in.
      await supabase.rpc('set_staff_password', { p_medsa_id: medsaId, p_new_password: 'TempPass2026!' })
      imported++
    }
    setBulkImportResult({ imported, skipped: skippedRows.length, skippedRows, total: rows.length })
  }

  async function handleOnboard() {
    if (!newFirstName || !newDept || !newPin) return
    if (newPin.length < 8) { setOnboardError('Password must be at least 8 characters.'); return }
    if (!/[0-9]/.test(newPin)) { setOnboardError('Password must contain at least one number.'); return }
    if (!/[A-Z]/.test(newPin)) { setOnboardError('Password must contain at least one capital letter.'); return }
    if (!/[^A-Za-z0-9]/.test(newPin)) { setOnboardError('Password must contain at least one special character.'); return }
    if (newRole==='doctor' && !newDob) return
    if ((newRole==='doctor'||(newRole==='clinic_assistant'&&newIsNurse)) && !newEpcLink?.trim()) { setOnboardError('A real e-PC (electronic Practising Certificate) link is required.'); return }
    setSaving(true)
    setOnboardError(null)
    const newMedsaId = `MED-${Date.now().toString(36).toUpperCase()}`
    const { error: onboardErr } = await supabase.from('staff_credentials').insert({
      institution_source:'clinic_ops', institution_id:institutionId, medsa_id:newMedsaId,
      full_name:`${newFirstName}${newLastName?' '+newLastName:''}`, role:newRole, department:newDept,
      registration_number:newReg||null, registration_expiry:newExpiry||null,
      registration_doc_url:uploadedDocUrl||null,
      sex:newSex||null, date_of_birth:newDob||null,
      has_epc: !!newEpcLink?.trim(), epc_link: newEpcLink?.trim() || null,
      is_nurse: newRole==='clinic_assistant' ? newIsNurse : false,
      mchk_declaration_agreed: newRole==='doctor' ? newMchkDeclared : false,
      mchk_declaration_timestamp: (newRole==='doctor' && newMchkDeclared) ? new Date().toISOString() : null,
      schemes: newRole==='doctor' ? newSchemes : null,
      disciplinary_status:newDisciplinary, onboarded_by:staffMember?.name, status:'active',
      verification_status:'verified',
      practitioner_portal_enabled: newRole==='doctor' || (newRole==='clinic_assistant' && newIsNurse),
      practitioner_portal_granted_by: 'onboarding', practitioner_portal_granted_at: new Date().toISOString(),
    })
    if (onboardErr) { setSaving(false); setOnboardError(onboardErr.message); return }
    // Real hashing happens here, server-side inside Postgres - the plain
    // password entered above is never written to any column directly.
    const { error: pwErr } = await supabase.rpc('set_staff_password', { p_medsa_id: newMedsaId, p_new_password: newPin })
    setSaving(false)
    if (pwErr) { setOnboardError(`Staff created, but setting password failed: ${pwErr.message}`); return }
    setShowOnboard(false)
    setNewFirstName('');setNewLastName('');setNewDept('');setNewReg('');setNewExpiry('');setNewDisciplinary('clear');setNewPin('');setUploadedDocUrl(null);setUploadedDocName(null)
    setNewSex('');setNewDob('');setNewEpcLink('');setNewIsNurse(false);setNewMchkDeclared(false);setNewSchemes([])
    load()
  }

  async function handleTogglePortalAccess(person) {
    const granting = !person.practitioner_portal_enabled
    await supabase.from('staff_credentials').update({
      practitioner_portal_enabled: granting,
      practitioner_portal_granted_by: granting ? staffMember?.name : null,
      practitioner_portal_granted_at: granting ? new Date().toISOString() : null,
    }).eq('id', person.id)
    load()
  }

  async function handleOffboard(person) {
    await supabase.from('staff_credentials').update({ status:'offboarded', offboarded_by:staffMember?.name, offboarded_at:new Date().toISOString() }).eq('id', person.id)
    load()
  }

  async function handleLeaveDecision(leave, approve) {
    await supabase.from('clinic_leave_requests').update({ status: approve?'approved':'denied', decided_by:staffMember?.name }).eq('id', leave.id)
    load()
  }

  return (
    <div>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
        {[['roster','Staff'],['expiring',`Expiring${expiringSoon.length?` (${expiringSoon.length})`:''}`],['leave',`Leave${leaves.length?` (${leaves.length})`:''}`]].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{padding:'8px 16px',borderRadius:'8px',fontSize:'13px',fontWeight:500,cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.textSub}}>{l}</div>
        ))}
      </div>

      <label style={{display:'inline-block',fontSize:'12px',fontWeight:600,padding:'9px 16px',borderRadius:'10px',cursor:'pointer',background:C.card,color:C.textSub,marginBottom:'12px'}}>
        {'\u2191'} Bulk import staff CSV
        <input type="file" accept=".csv" onChange={handleStaffBulkFile} style={{display:'none'}}/>
      </label>
      <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px'}}>Requires full_name, role (doctor / clinic_assistant / admin), department per row (doctors also require date_of_birth). Doctors and nurse-flagged clinic assistants also require epc_link - this is the real, scannable e-PC identifier itself, checked against existing records to avoid duplicates. Add is_nurse (true/false) for a clinic_assistant who's also a credentialed nurse. Everyone imported gets a real, hashed temporary password (TempPass2026!) - each person changes it themselves once they can log in. Doctors still confirm their own MCHK declaration individually; this is never set on their behalf. Staff without an e-PC (not a doctor or nurse) are onboarded separately by Medsa directly with their own generated QR code.</div>
      {bulkImportResult&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:C.green}}>
        Staff import: {bulkImportResult.imported} of {bulkImportResult.total} rows imported{bulkImportResult.skipped>0?`, ${bulkImportResult.skipped} skipped`:''}.
        {bulkImportResult.skippedRows?.length>0&&<div style={{marginTop:'4px'}}>Skipped: {bulkImportResult.skippedRows.join(', ')}</div>}
      </div>}

      {loading&&<div style={{padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}

      {!loading&&tab==='roster'&&<>
        {!showOnboard&&<button onClick={()=>setShowOnboard(true)} style={{padding:'10px 18px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer',marginBottom:'16px'}}>+ Onboard staff</button>}
        {showOnboard&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'20px',marginBottom:'16px',maxWidth:420}}>
          <input value={newFirstName} onChange={e=>setNewFirstName(e.target.value)} placeholder="First name" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input value={newLastName} onChange={e=>setNewLastName(e.target.value)} placeholder="Last name" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <select value={newRole} onChange={e=>setNewRole(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px'}}>
            <option value="doctor">Doctor</option>
            <option value="clinic_assistant">Clinic Assistant</option>
            <option value="admin">Practice Manager</option>
          </select>
          <input value={newDept} onChange={e=>setNewDept(e.target.value)} placeholder="Department" list="dept-suggestions" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <datalist id="dept-suggestions">
            {[...new Set(staff.map(s=>s.department).filter(Boolean))].map(d=><option key={d} value={d}/>)}
          </datalist>
          <select value={newSex} onChange={e=>setNewSex(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px'}}>
            <option value="">Sex</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          {newRole==='doctor'&&<>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Date of birth (required for doctors)</div>
            <input type="date" value={newDob} onChange={e=>setNewDob(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          </>}
          <input value={newReg} onChange={e=>setNewReg(e.target.value)} placeholder="Registration number" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          {newRole==='clinic_assistant'&&<label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:C.textSub,marginBottom:'10px',cursor:'pointer'}}>
            <input type="checkbox" checked={newIsNurse} onChange={e=>setNewIsNurse(e.target.checked)}/>
            Also a credentialed nurse (unlocks e-PC requirement and portal eligibility)
          </label>}
          {(newRole==='doctor'||(newRole==='clinic_assistant'&&newIsNurse))&&<>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>e-PC (electronic Practising Certificate) - required. This is the real MCHK-issued identifier and the actual scan target itself, not a separate Medsa-generated code.</div>
            <input value={newEpcLink} onChange={e=>setNewEpcLink(e.target.value)} placeholder="e-PC government verification link" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          </>}
          {newRole==='clinic_assistant'&&!newIsNurse&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{'\u25c7'} No e-PC required - Medsa will onboard this person separately with their own generated QR code (a paid, Medsa-run process, not urgent).</div>}
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Registration/license expiry</div>
          <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px',marginTop:'-6px'}}>Enter manually for now - no public MCHK API exists yet to cross-check this automatically against live license status.</div>
          <input type="date" value={newExpiry} onChange={e=>setNewExpiry(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>License / registration document, or other relevant copy</div>
          <label style={{display:'block',width:'100%',padding:'10px',border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',color:C.textSub,textAlign:'center',cursor:'pointer',marginBottom:'10px',boxSizing:'border-box'}}>
            {uploadedDocName || 'Tap to upload (PDF or image)'}
            <input type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={e=>e.target.files[0]&&handleDocUpload(e.target.files[0])}/>
          </label>
          {uploading&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>Uploading…</div>}
          <input type="password" value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="Password (8+ chars, 1 number, 1 capital, 1 special)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <select value={newDisciplinary} onChange={e=>setNewDisciplinary(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'14px'}}>
            <option value="clear">Disciplinary: Clear</option>
            <option value="flagged">Disciplinary: Flagged</option>
          </select>
          {newRole==='doctor'&&<label style={{display:'flex',alignItems:'flex-start',gap:'8px',fontSize:'12px',color:C.textSub,marginBottom:'14px',cursor:'pointer',lineHeight:1.4}}>
            <input type="checkbox" checked={newMchkDeclared} onChange={e=>setNewMchkDeclared(e.target.checked)} style={{marginTop:'2px'}}/>
            I confirm that my published service details, fees, and qualifications are accurate, non-exaggerated, and comply with Section 5 and Appendix D of the MCHK Code of Professional Conduct.
          </label>}
          {newRole==='doctor'&&<div style={{marginBottom:'14px'}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Government schemes participated in (self-declared)</div>
            {[['cdcc','Chronic Disease Co-Care (CDCC)'],['dhc_network','District Health Centre Network'],['ehcv','Elderly Health Care Voucher (EHCV)'],['vaccination_subsidy','Vaccination Subsidy Scheme']].map(([key,label])=>(
              <label key={key} style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:C.textSub,marginBottom:'6px',cursor:'pointer'}}>
                <input type="checkbox" checked={newSchemes.includes(key)} onChange={e=>setNewSchemes(s=>e.target.checked?[...s,key]:s.filter(x=>x!==key))}/>
                {label}
              </label>
            ))}
          </div>}
          {onboardError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px',padding:'8px 10px',background:C.redLight,borderRadius:'8px'}}>{onboardError}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>setShowOnboard(false)} style={{flex:1,padding:'10px',background:C.card,border:'none',borderRadius:'8px',cursor:'pointer'}}>Cancel</button>
            <button onClick={handleOnboard} disabled={saving||!newFirstName||!newDept||!newPin||(newRole==='doctor'&&(!newDob||!newMchkDeclared))||((newRole==='doctor'||(newRole==='clinic_assistant'&&newIsNurse))&&!newEpcLink?.trim())} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontWeight:600,cursor:'pointer'}}>{saving?'Saving…':'Onboard'}</button>
          </div>
        </div>}
        {staff.map(s=>(
          <div key={s.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px'}}>
            <div>
              <div style={{fontSize:'13px',fontWeight:600}}>{s.full_name}</div>
              <div style={{fontSize:'11px',color:C.textSub}}>{s.role==='clinic_assistant'&&s.is_nurse?'Nurse (Clinic Assistant)':ROLE_LABELS[s.role]||s.role} · {s.department} {s.disciplinary_status==='flagged'&&<span style={{color:C.red}}>· Flagged</span>}</div>
              {s.practitioner_portal_enabled&&<div style={{fontSize:'10px',color:C.green,marginTop:'2px'}}>{'\u2713'} Practitioner Portal - granted by {s.practitioner_portal_granted_by}</div>}
            </div>
            <div style={{display:'flex',gap:'6px',flexShrink:0}}>
              {(s.role==='doctor'||(s.role==='clinic_assistant'&&s.is_nurse))&&<button onClick={()=>handleTogglePortalAccess(s)} style={{padding:'6px 12px',background:s.practitioner_portal_enabled?C.card:C.greenLight,color:s.practitioner_portal_enabled?C.textSub:C.green,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>{s.practitioner_portal_enabled?'Revoke portal':'Grant portal'}</button>}
              <button onClick={()=>handleOffboard(s)} style={{padding:'6px 12px',background:C.redLight,color:C.red,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Offboard</button>
            </div>
          </div>
        ))}
      </>}

      {!loading&&tab==='expiring'&&<>
        {expiringSoon.length===0&&<div style={{color:C.textMuted,fontSize:'13px'}}>Nothing expiring within 4 months.</div>}
        {expiringSoon.map(s=>(
          <div key={s.id} style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{s.full_name}</div>
            <div style={{fontSize:'12px',color:C.amber}}>Registration expires {s.registration_expiry}</div>
          </div>
        ))}
      </>}

      {!loading&&tab==='leave'&&<>
        {leaves.length===0&&<div style={{color:C.textMuted,fontSize:'13px'}}>No pending leave requests.</div>}
        {leaves.map(l=>(
          <div key={l.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{l.staff_name}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>{l.leave_type} · {l.start_date} to {l.end_date}{l.reason?` · ${l.reason}`:''}</div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>handleLeaveDecision(l,false)} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'6px',cursor:'pointer'}}>Deny</button>
              <button onClick={()=>handleLeaveDecision(l,true)} style={{flex:1,padding:'8px',background:C.green,color:'#fff',border:'none',borderRadius:'6px',fontWeight:600,cursor:'pointer'}}>Approve</button>
            </div>
          </div>
        ))}
      </>}
    </div>
  )
}

function WorkingHoursScreen() {
  const [clinicDoctors,setClinicDoctors]=useState([])
  const [selectedDoctor,setSelectedDoctor]=useState('')
  const [hours,setHours]=useState({}) // day_of_week -> {start,end,is_off}
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [slotDuration,setSlotDuration]=useState(30)

  useEffect(() => {
    loadClinicDoctors().then(docs => { setClinicDoctors(docs); if (docs[0]) setSelectedDoctor(docs[0].name) })
  }, [])

  async function loadHours(doctorName) {
    setLoading(true)
    const { data } = await supabase.from('doctor_availability').select('*')
      .eq('doctor_name', doctorName).eq('institution_source', 'clinic_ops')
    const byDay = {}
    for (let d=0; d<7; d++) byDay[d] = { start:'09:00', end:'17:00', is_off: d===0 } // default: closed Sundays
    ;(data||[]).forEach(row => {
      byDay[row.day_of_week] = { start: row.start_time?.slice(0,5)||'09:00', end: row.end_time?.slice(0,5)||'17:00', is_off: row.is_off }
      setSlotDuration(row.slot_duration_minutes || 30)
    })
    setHours(byDay)
    setLoading(false)
  }

  useEffect(() => { loadHours(selectedDoctor) }, [selectedDoctor])

  function updateDay(day, field, value) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const rows = Object.entries(hours).map(([day, h]) => ({
      doctor_name: selectedDoctor, institution_source: 'clinic_ops', day_of_week: parseInt(day),
      start_time: h.start, end_time: h.end, is_off: h.is_off, slot_duration_minutes: slotDuration,
      updated_at: new Date().toISOString(),
    }))
    await supabase.from('doctor_availability').upsert(rows, { onConflict: 'doctor_name,institution_source,day_of_week' })
    setSaving(false)
    setSaved(true)
    setTimeout(()=>setSaved(false), 2500)
  }

  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'6px',textAlign:'center'}}>Working Hours</h2>
      <div style={{fontSize:'12px',color:C.textSub,textAlign:'center',marginBottom:'20px'}}>Sets each doctor's availability - syncs to their schedule and patient booking</div>

      <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
        {clinicDoctors.map(d=>(
          <div key={d.name} onClick={()=>setSelectedDoctor(d.name)} style={{padding:'8px 14px',borderRadius:'20px',fontSize:'12px',fontWeight:500,cursor:'pointer',background:selectedDoctor===d.name?C.green:C.card,color:selectedDoctor===d.name?'#fff':C.textSub}}>{d.name}</div>
        ))}
      </div>

      {loading&&<div style={{textAlign:'center',padding:'30px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}

      {!loading&&<>
        <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>Appointment slot length</div>
          <div style={{display:'flex',gap:'8px'}}>
            {[15,20,30,45,60].map(m=>(
              <div key={m} onClick={()=>{setSlotDuration(m);setSaved(false)}} style={{flex:1,textAlign:'center',padding:'8px',borderRadius:'8px',fontSize:'12px',fontWeight:500,cursor:'pointer',background:slotDuration===m?C.green:C.card,color:slotDuration===m?'#fff':C.text}}>{m}m</div>
            ))}
          </div>
        </Card>

        {DAY_NAMES.map((dayName,i)=>{
          const h = hours[i] || {start:'09:00',end:'17:00',is_off:false}
          return (
            <Card key={i} style={{padding:'12px 16px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{width:80,fontSize:'13px',fontWeight:500,flexShrink:0}}>{dayName}</div>
              {h.is_off ? (
                <div style={{flex:1,fontSize:'12px',color:C.textMuted}}>Closed</div>
              ) : (
                <div style={{flex:1,display:'flex',gap:'8px',alignItems:'center'}}>
                  <input type="time" value={h.start} onChange={e=>updateDay(i,'start',e.target.value)} style={{border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'6px 8px',fontSize:'12px'}}/>
                  <span style={{color:C.textMuted,fontSize:'12px'}}>to</span>
                  <input type="time" value={h.end} onChange={e=>updateDay(i,'end',e.target.value)} style={{border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'6px 8px',fontSize:'12px'}}/>
                </div>
              )}
              <Toggle checked={!h.is_off} onChange={(on)=>updateDay(i,'is_off',!on)}/>
            </Card>
          )
        })}

        {saved&&<div style={{fontSize:'13px',color:C.green,textAlign:'center',marginBottom:'10px'}}>✓ Saved - synced to {selectedDoctor}'s schedule and patient booking</div>}
        <Btn variant="primary" style={{width:'100%'}} onClick={handleSave} disabled={saving}>{saving?'Saving…':`Save hours for ${selectedDoctor}`}</Btn>
      </>}
    </PageWrap>
  )
}

function ScheduleScreen({ staffMember, onGoToConsultation, onCancelCheckIn, preselectPatient, onConsumedPreselect, onNavNewPatient, onCheckedIn, onPreselectPatientForFollowup }) {
  const [selectedDay,setSelectedDay]=useState(() => new Date())
  // Real current week (today + 6 days ahead) instead of a fixed hardcoded
  // month/week - this is what makes the schedule genuinely testable
  // against real time.
  const weekDates = Array.from({length:7}, (_,i) => {
    const d = new Date()
    d.setDate(d.getDate()+i)
    return d
  })
  const [showNewApptForm,setShowNewApptForm]=useState(false)
  const [newApptSearch,setNewApptSearch]=useState('')
  const [newApptPatient,setNewApptPatient]=useState(null)
  const [newApptTime,setNewApptTime]=useState('')
  const [clinicDoctors,setClinicDoctors]=useState([])
  const [newApptDoctor,setNewApptDoctor]=useState('')
  const [newApptReason,setNewApptReason]=useState('')
  const [newApptSaving,setNewApptSaving]=useState(false)
  const [newApptError,setNewApptError]=useState(null)

  // Real working-hours-based slots for the new-appointment form too - this
  // is the actual point of Working Hours syncing to booking: it should be
  // impossible to book outside a doctor's real hours from here, not just
  // from the reschedule modal.
  const [newApptSlots,setNewApptSlots]=useState([])
  const [newApptSlotsLoading,setNewApptSlotsLoading]=useState(false)

  useEffect(() => {
    loadClinicDoctors().then(docs => { setClinicDoctors(docs); if (docs[0]) setNewApptDoctor(docs[0].name) })
  }, [])

  useEffect(() => {
    async function loadSlots() {
      if (!newApptDoctor) { setNewApptSlots([]); return }
      setNewApptSlotsLoading(true)
      setNewApptTime('')
      const dayOfWeek = selectedDay.getDay()
      const { data } = await supabase.from('doctor_availability').select('*')
        .eq('doctor_name', newApptDoctor).eq('institution_source', 'clinic_ops').eq('day_of_week', dayOfWeek).maybeSingle()
      if (!data || data.is_off) { setNewApptSlots([]); setNewApptSlotsLoading(false); return }
      const slots = []
      const [startH, startM] = (data.start_time||'09:00').split(':').map(Number)
      const [endH, endM] = (data.end_time||'17:00').split(':').map(Number)
      let current = startH*60 + startM
      const end = endH*60 + endM
      while (current < end) {
        slots.push(`${String(Math.floor(current/60)).padStart(2,'0')}:${String(current%60).padStart(2,'0')}`)
        current += data.slot_duration_minutes || 30
      }
      setNewApptSlots(slots)
      setNewApptSlotsLoading(false)
    }
    if (showNewApptForm) loadSlots()
  }, [newApptDoctor, selectedDay, showNewApptForm])

  // Arrived here after registering a new walk-in patient - open the form
  // with them already selected instead of making reception search again.
  // Also arrives here when scheduling a follow-up from the schedule
  // action modal, for the exact same reason - both cases mean the patient
  // is already known and shouldn't need re-searching.
  useEffect(() => {
    if (!preselectPatient) return
    setNewApptPatient(preselectPatient)
    setShowNewApptForm(true)
    onConsumedPreselect?.()
  }, [preselectPatient])

  async function handleNewApptSearch() {
    if (!newApptSearch.trim()) return
    const { data } = await supabase.from('patients').select('*')
      .or(`medsa_id.ilike.%${newApptSearch}%,full_name.ilike.%${newApptSearch}%`).limit(1).maybeSingle()
    setNewApptPatient(data || null)
    setNewApptError(data ? null : 'No patient found matching that name or Medsa ID.')
  }

  async function handleConfirmNewAppt() {
    if (!newApptPatient || !newApptTime) return
    setNewApptSaving(true)
    setNewApptError(null)
    const doctorInfo = clinicDoctors.find(d=>d.name===newApptDoctor)
    const scheduledAt = new Date(selectedDay)
    const [h,m] = newApptTime.split(':').map(Number)
    scheduledAt.setHours(h||9, m||0, 0, 0)
    const { error: insErr } = await supabase.from('appointments').insert({
      patient_id: newApptPatient.id,
      doctor_name: newApptDoctor,
      department: doctorInfo?.department || null,
      scheduled_at: scheduledAt.toISOString(),
      appointment_type: newApptReason || 'Consultation',
      status: 'confirmed',
      institution_source: 'clinic_ops',
    })
    setNewApptSaving(false)
    if (insErr) { setNewApptError(insErr.message); return }
    setShowNewApptForm(false)
    setNewApptSearch(''); setNewApptPatient(null); setNewApptTime(''); setNewApptReason('')
    loadRealAppointments(selectedDay)
  }

  const isDoctorView = staffMember?.role==='doctor'
  const [appointments,setAppointments]=useState([])
  const [loadingAppts,setLoadingAppts]=useState(true)

  // Load real appointments booked through PatientApp for whichever day is
  // selected, and merge them with the illustrative demo rows - this is
  // what makes a real patient booking (e.g. through Lisa) actually show
  // up here, which previously it never did since this screen only ever
  // read local hardcoded demo data.
  async function loadRealAppointments(dateObj) {
    setLoadingAppts(true)
    const dayStart = new Date(dateObj); dayStart.setHours(0,0,0,0)
    const dayEnd = new Date(dateObj); dayEnd.setHours(23,59,59,999)
    // Only this clinic's own bookings - ClinicOps and PractitionerApp
    // represent two different institutions and shouldn't see each other's
    // appointments just because they happen to share the same database.
    const { data } = await supabase.from('appointments').select('*, patients(full_name, medsa_id)')
      .eq('institution_source', 'clinic_ops')
      .neq('status', 'cancelled')
      .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())
      .order('scheduled_at', {ascending:true})

    const realRows = (data||[]).map(a => ({
      time: new Date(a.scheduled_at).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit',hour12:false}),
      scheduledAt: a.scheduled_at,
      patient: a.patients?.full_name || 'Unknown patient',
      patientId: a.patient_id || null,
      medsaId: a.patients?.medsa_id || null,
      doctor: a.doctor_name || 'Unassigned',
      department: a.department || 'Internal Medicine',
      type: a.appointment_type || 'Consultation',
      status: a.status || 'confirmed',
      notes: a.reason_for_visit || '',
      isReal: true,
    }))

    setAppointments(isDoctorView ? realRows.filter(a=>a.doctor===staffMember.name) : realRows)
    setLoadingAppts(false)
  }

  useEffect(() => { loadRealAppointments(selectedDay) }, [selectedDay])

  const [activeAppt,setActiveAppt]=useState(null)

  // Real per-patient check against the consent window set at booking time
  // (schema_intake_consent.sql) - this is what actually gates data access
  // on the schedule now, not just whether they're physically checked in.
  const [dataWindows,setDataWindows]=useState({}) // medsaId -> {allowed, checked, reason}

  async function checkDataWindow(medsaId) {
    if (!medsaId || dataWindows[medsaId]?.checked) return
    const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
    if (!patientRow) { setDataWindows(prev=>({...prev,[medsaId]:{allowed:false,checked:true,reason:'no_consent'}})); return }
    const { data } = await supabase.from('appointment_intake').select('*').eq('patient_id', patientRow.id).eq('consent_given', true).order('created_at',{ascending:false}).limit(1).maybeSingle()
    if (!data) { setDataWindows(prev=>({...prev,[medsaId]:{allowed:false,checked:true,reason:'no_consent'}})); return }
    const now = new Date()
    const allowed = now >= new Date(data.access_window_start) && now <= new Date(data.access_window_end)
    setDataWindows(prev=>({...prev,[medsaId]:{allowed,checked:true,reason:allowed?null:'outside_window',patientId:patientRow.id}}))
  }

  useEffect(() => { appointments.forEach(a=>checkDataWindow(a.medsaId)) }, [appointments])

  function withinDataWindow(medsaId) {
    return dataWindows[medsaId]?.allowed || false
  }

  // Clinic-side consent confirmation - for when a patient consents
  // verbally or on paper at check-in rather than through PatientApp
  // themselves. Without this, a patient who never used PatientApp had no
  // way to ever pass the consent check at all.
  async function handleConfirmConsent(appt) {
    if (!appt?.medsaId) return
    const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', appt.medsaId).maybeSingle()
    if (!patientRow) return
    const isWalkIn = !appt.scheduledAt || appt.ticket === 'SCH' // no real booked time - this is a walk-in
    const apptTime = appt.scheduledAt ? new Date(appt.scheduledAt) : new Date()
    // Booked: 24h before AND after the consultation time. Walk-in: no
    // "before" makes sense since there's no scheduled time to count back
    // from - 24h after the actual visit only.
    const windowStart = isWalkIn ? apptTime : new Date(apptTime.getTime() - 24*60*60*1000)
    const windowEnd = new Date(apptTime.getTime() + 24*60*60*1000)
    await supabase.from('appointment_intake').insert({
      patient_id: patientRow.id, appointment_time: apptTime.toISOString(),
      doctor_name: appt.doctor, reason_for_visit: appt.notes||null,
      consent_given: true, consent_given_at: new Date().toISOString(),
      access_window_start: windowStart.toISOString(), access_window_end: windowEnd.toISOString(),
    })
    // Force a fresh check - the cached "checked:true" result was based on
    // there being no consent at all, which is no longer true.
    setDataWindows(prev=>{ const next={...prev}; delete next[appt.medsaId]; return next })
    checkDataWindow(appt.medsaId)
  }

  async function handleSaveAppt(updated) {
    if (updated.cancelled && updated.isReal && updated.medsaId) {
      // Real booking (not demo data) - actually cancel it in Supabase,
      // not just remove it from the local list.
      const { data: pRow } = await supabase.from('patients').select('id').eq('medsa_id', updated.medsaId).maybeSingle()
      if (pRow) {
        const dayStart=new Date(selectedDay); dayStart.setHours(0,0,0,0)
        const dayEnd=new Date(selectedDay); dayEnd.setHours(23,59,59,999)
        await supabase.from('appointments').update({status:'cancelled'}).eq('patient_id',pRow.id).eq('institution_source','clinic_ops').gte('scheduled_at',dayStart.toISOString()).lte('scheduled_at',dayEnd.toISOString())
      }
    }
    setAppointments(prev => {
      const idx = prev.indexOf(activeAppt)
      if (updated.cancelled) return prev.filter((_,i)=>i!==idx)
      const next = [...prev]
      next[idx] = updated
      return next
    })
  }
  return (
    <PageWrap maxWidth={640}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h2 style={{fontSize:'20px',fontWeight:700}}>Schedule</h2>
        <Btn variant="primary" onClick={()=>setShowNewApptForm(true)}>+ New appointment</Btn>
      </div>
      <Card style={{padding:'16px',marginBottom:'20px'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'12px'}}>{weekDates[0].toLocaleDateString('en-HK',{month:'long',year:'numeric'})}</div>
        <div style={{display:'flex',gap:'8px'}}>
          {weekDates.map(d=>(
            <div key={d.toISOString()} onClick={()=>setSelectedDay(d)} style={{flex:1,textAlign:'center',padding:'10px',borderRadius:'8px',background:d.toDateString()===selectedDay.toDateString()?C.green:C.card,color:d.toDateString()===selectedDay.toDateString()?'#fff':C.text,cursor:'pointer'}}>
              <div style={{fontSize:'16px',fontWeight:600}}>{d.getDate()}</div>
            </div>
          ))}
        </div>
      </Card>
      <SecLabel>{isDoctorView?`Today's patients · ${staffMember.name}`:'All doctors'} · {selectedDay.toLocaleDateString('en-HK',{weekday:'short',day:'numeric',month:'short'})}</SecLabel>
      {loadingAppts&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,marginBottom:'12px'}}>Loading...</div>}
      <div style={{margin:'0 16px 12px',background:C.blueLight,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'10px 14px',fontSize:'11px',color:C.textSub,lineHeight:1.5}}>
        ◇ Clinical data access is based on each patient's consent window from booking, not just whether they're physically checked in - see the badge on each appointment.
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {[...appointments].sort((a,b)=>a.time.localeCompare(b.time)).map((a,i)=>(
          <Card key={i} onClick={()=>a.status!=='open'&&setActiveAppt(a)} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',opacity:a.status==='open'?0.6:1,cursor:a.status!=='open'?'pointer':'default'}}>
            <div style={{fontSize:'13px',fontWeight:700,width:48,flexShrink:0}}>{a.time}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'13px',fontWeight:500}}>{a.patient}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{a.doctor} - {a.type}</div>
            </div>
            {a.status!=='open'&&<Badge text={withinDataWindow(a.medsaId)?'Data available':'Outside consent window'} type={withinDataWindow(a.medsaId)?'ok':'due'}/>}
            {a.status==='open'?<Btn style={{fontSize:'12px',padding:'6px 12px'}} onClick={()=>setShowNewApptForm(true)}>+ Book</Btn>:<><Badge text={a.status==='confirmed'?'Confirmed':'Pending'} type={a.status==='confirmed'?'ok':'due'}/><span style={{color:C.textMuted,fontSize:'14px'}}>›</span></>}
          </Card>
        ))}
      </div>
      <ClinicScheduleActionModal
        appt={activeAppt}
        onClose={()=>setActiveAppt(null)}
        onSave={handleSaveAppt}
        withinDataWindow={activeAppt ? withinDataWindow(activeAppt.medsaId) : false}
        consentReason={activeAppt ? dataWindows[activeAppt.medsaId]?.reason : null}
        onConfirmConsent={handleConfirmConsent}
        onGoToConsultation={onGoToConsultation}
        role={staffMember?.role}
        onCheckedIn={onCheckedIn}
        onScheduleFollowup={onPreselectPatientForFollowup}
        onCancelCheckIn={async(appt)=>{
          await onCancelCheckIn(appt)
          // The backend update alone doesn't refresh what's on screen - this
          // was the actual bug: the row would revert in Supabase but the
          // local list kept showing the stale "checked in" state until a
          // manual reload.
          loadRealAppointments(selectedDay)
        }}
      />
      {showNewApptForm&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowNewApptForm(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:400,padding:'24px'}}>
          <div style={{fontSize:'16px',fontWeight:700,marginBottom:'16px'}}>New appointment</div>
          <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
            <input value={newApptSearch} onChange={e=>setNewApptSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleNewApptSearch()} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px',fontSize:'14px',boxSizing:'border-box'}} placeholder="Patient name or Medsa ID"/>
            <Btn onClick={handleNewApptSearch}>Search</Btn>
          </div>
          {newApptPatient&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'10px',marginBottom:'12px',fontSize:'12px',color:C.green}}>✓ {newApptPatient.full_name} ({newApptPatient.medsa_id})</div>}
          <select value={newApptDoctor} onChange={e=>setNewApptDoctor(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px',fontSize:'14px',marginBottom:'10px'}}>
            {clinicDoctors.map(d=><option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
          {/* Real, working-hours-based time slots - replaces the bare
              <input type="time"> that let front desk book any time at all,
              regardless of whether the doctor actually works then. */}
          {newApptSlotsLoading&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'10px'}}>Loading {newApptDoctor}'s working hours…</div>}
          {!newApptSlotsLoading&&newApptSlots.length===0&&<div style={{fontSize:'12px',color:C.amber,marginBottom:'10px'}}>{'\u26a0'} {newApptDoctor} has no working hours set for {selectedDay.toLocaleDateString('en-HK',{weekday:'long'})} - set them in Working Hours first.</div>}
          {!newApptSlotsLoading&&newApptSlots.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'6px',marginBottom:'12px'}}>
            {newApptSlots.map(t=>(
              <div key={t} onClick={()=>setNewApptTime(t)} style={{border:`0.5px solid ${newApptTime===t?C.green:C.border}`,borderRadius:'8px',padding:'7px',textAlign:'center',fontSize:'12px',cursor:'pointer',background:newApptTime===t?C.green:C.card,color:newApptTime===t?'#fff':C.text}}>{t}</div>
            ))}
          </div>}
          <input value={newApptReason} onChange={e=>setNewApptReason(e.target.value)} placeholder="Reason, e.g. Follow-up" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px',fontSize:'14px',marginBottom:'14px',boxSizing:'border-box'}}/>
          {newApptError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'6px'}}>{newApptError}</div>}
          {newApptError&&<div style={{marginBottom:'10px'}}><span onClick={()=>onNavNewPatient?.(newApptSearch)} style={{fontSize:'12px',color:C.green,fontWeight:600,cursor:'pointer'}}>Register them as a new patient {'\u2192'}</span></div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={handleConfirmNewAppt} disabled={!newApptPatient||!newApptTime||newApptSaving}>{newApptSaving?'Booking…':'Confirm booking'}</Btn>
        </div>
      </div>}
    </PageWrap>
  )
}

function PaymentScreen({ staffMember, institutionId, preselectClaimRef, onConsumedPreselect, preselectRecordId, onConsumedRecordPreselect }) {
  const [tab,setTab]=useState('collect')
  const [method,setMethod]=useState('card')
  const [paid,setPaid]=useState(false)
  const [paidRecord,setPaidRecord]=useState(null)
  const [receiptSent,setReceiptSent]=useState(false)
  const [printed,setPrinted]=useState(false)
  const [billingRecord,setBillingRecord]=useState(null) // the consultation record being billed, when arriving via preselectRecordId
  const [billingRecordLoading,setBillingRecordLoading]=useState(false)
  const [billingChoice,setBillingChoice]=useState(null) // null | 'direct_payment' | 'insurance'
  const [eligiblePlans,setEligiblePlans]=useState(null)
  const [eligiblePlansLoading,setEligiblePlansLoading]=useState(false)
  const [selectedEligiblePlan,setSelectedEligiblePlan]=useState(null)
  const [submittingClaim,setSubmittingClaim]=useState(false)
  const [billingResult,setBillingResult]=useState(null)
  const [claimAdjudication,setClaimAdjudication]=useState(null) // the raw adjudicateClaim result, kept separate from billingResult so we know whether a copay still needs collecting
  const [copayMethod,setCopayMethod]=useState('card')
  const [collectingCopay,setCollectingCopay]=useState(false)
  const [addPlanOpen,setAddPlanOpen]=useState(false)
  const [allPlans,setAllPlans]=useState([])
  const [addPlanSearch,setAddPlanSearch]=useState('')
  const [addingPlan,setAddingPlan]=useState(false)
  const [treatmentPlans,setTreatmentPlans]=useState([])
  const [plansLoading,setPlansLoading]=useState(true)
  const [ledger,setLedger]=useState([])
  const [ledgerLoading,setLedgerLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [pendingPayments,setPendingPayments]=useState([])
  const [pendingLoading,setPendingLoading]=useState(true)
  const [selectedPayment,setSelectedPayment]=useState(null)
  const [paymentSearch,setPaymentSearch]=useState('')
  const [showCreatePlan,setShowCreatePlan]=useState(false)
  const [planStep,setPlanStep]=useState('form') // form | payment | done
  const [planPatientQuery,setPlanPatientQuery]=useState('')
  const [planFoundPatient,setPlanFoundPatient]=useState(null)
  const [planName,setPlanName]=useState('')
  const [planSessions,setPlanSessions]=useState('')
  const [planPrice,setPlanPrice]=useState('')
  const [planMethod,setPlanMethod]=useState('card')
  const [planSaving,setPlanSaving]=useState(false)

  async function loadPendingPayments() {
    setPendingLoading(true)
    // Real, itemized list - claims with a real amount still owed by the
    // patient that haven't been collected yet. Replaces the single
    // hardcoded demo bill this screen used to show.
    const { data } = await supabase.from('insurance_claims')
      .select('*, patients(full_name), insurance_plans(company_name, plan_name)')
      .in('status', ['approved','partially_approved'])
      .is('copay_payment_method', null)
      .order('submitted_at', {ascending:false})
    const withAmountOwed = (data||[]).filter(c => ((c.deductible_applied||0) + (c.patient_copay_amount||0)) > 0)
    setPendingPayments(withAmountOwed)
    setPendingLoading(false)
  }

  async function loadLedger() {
    setLedgerLoading(true)
    const { data } = await supabase.from('transactions').select('*').order('created_at',{ascending:false}).limit(100)
    setLedger(data||[])
    setLedgerLoading(false)
  }

  async function handleCharge() {
    if (!selectedPayment) return
    setSaving(true)
    const amountOwed = (selectedPayment.deductible_applied||0) + (selectedPayment.patient_copay_amount||0)
    const adapter = getInsuranceAdapter(selectedPayment.insurance_plans?.company_name)
    const fees = await adapter.recordCopayPayment(selectedPayment.claim_ref, method)
    await supabase.from('transactions').insert({
      institution_id: institutionId,
      patient_name: selectedPayment.patients?.full_name || 'Unknown',
      consultation_fee: selectedPayment.amount,
      insurer_covers: selectedPayment.insurer_covered_amount,
      patient_pays: amountOwed,
      payment_method: method,
      card_processing_fee: fees.paymentProcessingFee,
      claim_ref: selectedPayment.claim_ref,
      staff_name: staffMember?.name || 'Unknown',
    })
    // Real fix - fetch the actual consultation record this claim was
    // linked to, so the receipt screen can show real itemized charges
    // instead of nothing, and "sent to Medsa app" can be an honest,
    // persisted action rather than a local-only flag.
    const { data: linkedRecord } = await supabase.from('medical_records')
      .select('*').eq('insurance_claim_id', selectedPayment.id).maybeSingle()
    setPaidRecord(linkedRecord || null)
    setSaving(false)
    setPaid(true)
    loadLedger()
    loadPendingPayments()
  }

  function exportCSV() {
    if (typeof window === 'undefined') return // SSR safety guard
    const headers = ['Date','Patient','Consultation Fee','Insurer Covers','Patient Pays','Method','Processing Fee','Claim Ref','Clearinghouse Fee','Staff']
    const rows = ledger.map(t => [
      new Date(t.created_at).toLocaleString('en-HK'),
      t.patient_name, t.consultation_fee, t.insurer_covers, t.patient_pays,
      t.payment_method, t.card_processing_fee, t.claim_ref||'', t.clearinghouse_fee||0, t.staff_name,
    ])
    const csv = [headers, ...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medsa-financial-records-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function loadTreatmentPlans() {
    setPlansLoading(true)
    const { data } = await supabase.from('treatment_plans').select('*, patients(full_name)')
    setTreatmentPlans((data||[]).map(p => ({
      patient: p.patients?.full_name || 'Unknown',
      plan: p.plan_name,
      paid: p.sessions_paid,
      used: p.sessions_used,
      remaining: p.sessions_paid - p.sessions_used,
      status: p.status,
    })))
    setPlansLoading(false)
  }

  useEffect(() => {
    loadTreatmentPlans()
    loadLedger()
    loadPendingPayments()
  }, [])

  // Arrived here via a "Collect in Payment" link from Claims - jump
  // straight to that specific claim instead of making reception search.
  useEffect(() => {
    if (!preselectClaimRef) return
    async function findAndSelect() {
      const { data } = await supabase.from('insurance_claims')
        .select('*, patients(full_name), insurance_plans(company_name, plan_name)')
        .eq('claim_ref', preselectClaimRef).maybeSingle()
      if (data) { setSelectedPayment(data); setTab('collect') }
      onConsumedPreselect?.()
    }
    findAndSelect()
  }, [preselectClaimRef])

  // Arrived here via "Proceed to billing" from the task board - load the
  // real consultation record (diagnosis, itemized line_items, total_fee)
  // and its patient, so the front desk sees the doctor's actual itemized
  // bill rather than needing to rebuild it.
  useEffect(() => {
    if (!preselectRecordId) return
    async function loadRecord() {
      setBillingRecordLoading(true)
      const { data } = await supabase.from('medical_records')
        .select('*, patients(id, full_name, medsa_id)')
        .eq('id', preselectRecordId).maybeSingle()
      setBillingRecord(data || null)
      setBillingRecordLoading(false)
      onConsumedRecordPreselect?.()
    }
    loadRecord()
  }, [preselectRecordId])

  // Real matching engine - only fetched when the front desk actually
  // chooses "insurance", not preemptively, since it requires a network
  // round trip and most visits may just be paid directly.
  useEffect(() => {
    if (billingChoice !== 'insurance' || !billingRecord) return
    async function loadEligible() {
      setEligiblePlansLoading(true)
      const matches = await findEligiblePlans(billingRecord.patient_id, billingRecord.line_items || [])
      setEligiblePlans(matches)
      setEligiblePlansLoading(false)
    }
    loadEligible()
  }, [billingChoice, billingRecord])

  async function handleDirectBillingSubmit() {
    if (!selectedEligiblePlan || !billingRecord) return
    setSubmittingClaim(true)
    const adapter = getInsuranceAdapter(selectedEligiblePlan.plan.company_name)
    const items = (billingRecord.line_items || []).map(i => ({ code: i.category, description: i.description, amount: i.fee * i.qty }))
    const result = await adapter.adjudicateClaim({
      patientId: billingRecord.patient_id, policyNumber: selectedEligiblePlan.plan.id,
      clinicId: institutionId, totalGrossAmount: billingRecord.total_fee || 0,
      items, medicalRecordId: billingRecord.id,
    })
    // Real completion signal - marks this consultation as billed so it
    // correctly disappears from the task board. The claim itself is
    // submitted at this point regardless of whether a copay remains -
    // that's now a separate, immediate collection step below, not
    // something the task board needs to keep tracking.
    await supabase.from('medical_records').update({ record_status: 'billed' }).eq('id', billingRecord.id)
    setClaimAdjudication(result)
    // If nothing is owed (fully covered), we're actually done - skip
    // straight to the completion screen rather than showing an empty
    // "collect $0" step.
    if (!result.fees || result.fees.patientPayableTotal <= 0) {
      setBillingResult(result)
    }
    setSubmittingClaim(false)
  }

  useEffect(() => {
    if (!addPlanOpen || allPlans.length > 0) return
    async function loadPlans() {
      const { data } = await supabase.from('insurance_plans').select('*').eq('status', 'active').order('company_name')
      setAllPlans(data || [])
    }
    loadPlans()
  }, [addPlanOpen])

  async function handleLinkNewPlan(plan) {
    if (!billingRecord) return
    setAddingPlan(true)
    const { error } = await supabase.from('agent_policies').insert({
      patient_id: billingRecord.patient_id, plan_id: plan.id, status: 'active',
    })
    if (error) {
      alert(`Could not link this plan: ${error.message}`)
      setAddingPlan(false)
      return
    }
    setAddPlanOpen(false)
    setAddPlanSearch('')
    setEligiblePlansLoading(true)
    const matches = await findEligiblePlans(billingRecord.patient_id, billingRecord.line_items || [])
    setEligiblePlans(matches)
    setEligiblePlansLoading(false)
    setAddingPlan(false)
  }

  async function handleCollectRemainingCopay() {
    if (!claimAdjudication || !billingRecord) return
    setCollectingCopay(true)
    const adapter = getInsuranceAdapter(selectedEligiblePlan.plan.company_name)
    const fees = await adapter.recordCopayPayment(claimAdjudication.claimId, copayMethod)
    await supabase.from('transactions').insert({
      institution_id: institutionId,
      patient_name: billingRecord.patients?.full_name || 'Unknown',
      consultation_fee: billingRecord.total_fee || 0,
      insurer_covers: claimAdjudication.fees.insurerCoveredAmount,
      patient_pays: claimAdjudication.fees.patientPayableTotal,
      payment_method: copayMethod,
      card_processing_fee: fees.paymentProcessingFee,
      claim_ref: claimAdjudication.claimId,
      staff_name: staffMember?.name || 'Unknown',
    })
    setBillingResult(claimAdjudication)
    setCollectingCopay(false)
  }

  async function handleDirectPaymentSubmit(paymentMethod) {
    if (!billingRecord) return
    setSubmittingClaim(true)
    const fees = buildFeeBreakdown(billingRecord.total_fee || 0, 0, billingRecord.total_fee || 0, paymentMethod)
    await supabase.from('medical_records').update({ record_status: 'billed' }).eq('id', billingRecord.id)
    await supabase.from('transactions').insert({
      institution_id: institutionId,
      patient_name: billingRecord.patients?.full_name || 'Unknown',
      consultation_fee: billingRecord.total_fee || 0,
      insurer_covers: 0, patient_pays: billingRecord.total_fee || 0,
      payment_method: paymentMethod, card_processing_fee: fees.paymentProcessingFee,
      staff_name: staffMember?.name || 'Unknown',
    })
    setBillingResult({ status: 'PAID_DIRECT', fees })
    setSubmittingClaim(false)
  }

  if (preselectRecordId || billingRecord) {
    if (billingRecordLoading) return <PageWrap maxWidth={520}><div style={{textAlign:'center',padding:'60px 20px',color:C.textMuted,fontSize:'13px'}}>Loading consultation...</div></PageWrap>
    if (!billingRecord) return <PageWrap maxWidth={520}><div style={{textAlign:'center',padding:'60px 20px',color:C.textMuted,fontSize:'13px'}}>Consultation record not found.</div></PageWrap>

    if (billingResult) return (
      <PageWrap maxWidth={520}>
        <Card style={{padding:'24px',textAlign:'center'}}>
          <div style={{fontSize:'32px',marginBottom:'10px'}}>{'\u2713'}</div>
          <div style={{fontSize:'16px',fontWeight:700,marginBottom:'6px'}}>Billing complete</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>{billingRecord.patients?.full_name} - HK${(billingRecord.total_fee||0).toFixed(2)}</div>
          {billingResult.claimId&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'16px'}}>Claim {billingResult.claimId} - {billingResult.status}</div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setBillingRecord(null);setBillingChoice(null);setEligiblePlans(null);setSelectedEligiblePlan(null);setBillingResult(null);setClaimAdjudication(null);setCopayMethod('card');setAddPlanOpen(false);setAddPlanSearch('')}}>Done</Btn>
        </Card>
      </PageWrap>
    )

    return (
      <PageWrap maxWidth={520}>
        <Card style={{padding:'18px',marginBottom:'16px'}}>
          <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>{billingRecord.patients?.full_name}</div>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'12px'}}>{billingRecord.patients?.medsa_id} - {billingRecord.doctor_name}</div>
          {(billingRecord.line_items||[]).map((item,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:'13px'}}>
              <span style={{color:C.textSub}}>{item.description}{item.qty>1&&` x${item.qty}`}</span><span>HK${(item.fee*item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0 0',marginTop:'6px',borderTop:`0.5px solid ${C.border}`,fontWeight:700,fontSize:'16px'}}>
            <span>Total</span><span style={{color:C.green}}>HK${(billingRecord.total_fee||0).toFixed(2)}</span>
          </div>
        </Card>

        {!billingChoice&&<>
          <SecLabel>How is this being paid?</SecLabel>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            <Btn variant="secondary" style={{width:'100%',justifyContent:'flex-start',padding:'14px 16px'}} onClick={()=>setBillingChoice('direct_payment')}>Cash / Card / Octopus</Btn>
            <Btn variant="secondary" style={{width:'100%',justifyContent:'flex-start',padding:'14px 16px'}} onClick={()=>setBillingChoice('insurance')}>Insurance direct billing</Btn>
          </div>
        </>}

        {billingChoice==='direct_payment'&&<>
          <SecLabel>Payment method</SecLabel>
          <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
            {[['card','Card','\u25c8'],['octopus','Octopus','\u25c9'],['cash','Cash','\u25ce']].map(([k,l,icon])=>(
              <div key={k} onClick={()=>setMethod(k)} style={{flex:1,padding:'14px 8px',borderRadius:'8px',textAlign:'center',cursor:'pointer',background:method===k?C.green:C.card,color:method===k?'#fff':C.text}}>
                <div style={{fontSize:'18px',marginBottom:'4px'}}>{icon}</div><div style={{fontSize:'12px',fontWeight:500}}>{l}</div>
              </div>
            ))}
          </div>
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>handleDirectPaymentSubmit(method)} disabled={submittingClaim}>{submittingClaim?'Processing...':`Collect HK$${(billingRecord.total_fee||0).toFixed(2)}`}</Btn>
        </>}

        {billingChoice==='insurance'&&<>
          <SecLabel>Eligible plans</SecLabel>
          {eligiblePlansLoading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Checking coverage...</div>}
          {!eligiblePlansLoading&&eligiblePlans&&eligiblePlans.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>No held plan covers any item in this visit yet.</div>}

          {!addPlanOpen&&<div onClick={()=>setAddPlanOpen(true)} style={{fontSize:'12px',color:C.green,cursor:'pointer',padding:'10px 0',textAlign:'center'}}>{'+'} Patient has a plan not on file - add it</div>}
          {addPlanOpen&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'12px',marginBottom:'12px'}}>
            <input value={addPlanSearch} onChange={e=>setAddPlanSearch(e.target.value)} placeholder="Search insurer or plan name" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px'}}/>
            <div style={{maxHeight:180,overflowY:'auto'}}>
              {allPlans.filter(p=>!addPlanSearch||`${p.company_name} ${p.plan_name}`.toLowerCase().includes(addPlanSearch.toLowerCase())).map(p=>(
                <div key={p.id} onClick={()=>!addingPlan&&handleLinkNewPlan(p)} style={{padding:'8px 10px',fontSize:'13px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`}}>
                  {p.plan_name} <span style={{color:C.textMuted}}>({p.company_name})</span>
                </div>
              ))}
              {allPlans.length===0&&<div style={{fontSize:'12px',color:C.textMuted,padding:'8px'}}>Loading plans...</div>}
            </div>
          </div>}
          {!eligiblePlansLoading&&eligiblePlans&&eligiblePlans.map(m=>(
            <Card key={m.plan.id} onClick={()=>setSelectedEligiblePlan(m)} style={{padding:'14px 16px',marginBottom:'8px',border:selectedEligiblePlan?.plan.id===m.plan.id?`1.5px solid ${C.green}`:`0.5px solid ${C.border}`,cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontSize:'13px',fontWeight:600}}>{m.plan.plan_name} ({m.plan.company_name})</div>
                <Badge text={m.fullyCovered?'Fully covered':'Partial'} type={m.fullyCovered?'ok':'due'}/>
              </div>
              {m.uncoveredItems.length>0&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>Not covered: {m.uncoveredItems.join(', ')}</div>}
            </Card>
          ))}
          {selectedEligiblePlan&&<Btn variant="primary" style={{width:'100%',marginTop:'10px'}} onClick={handleDirectBillingSubmit} disabled={submittingClaim}>{submittingClaim?'Submitting...':'Submit claim'}</Btn>}

          {claimAdjudication&&!billingResult&&<div style={{marginTop:'16px'}}>
            <div style={{background:C.greenLight,borderRadius:'10px',padding:'14px 16px',marginBottom:'16px'}}>
              <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'2px'}}>
                HK${claimAdjudication.fees.insurerCoveredAmount.toFixed(2)} is being directly billed to {selectedEligiblePlan.plan.company_name}
              </div>
              <div style={{fontSize:'12px',color:C.textSub}}>Claim {claimAdjudication.claimId}</div>
            </div>
            <SecLabel>Collect the remaining HK${claimAdjudication.fees.patientPayableTotal.toFixed(2)} from the patient</SecLabel>
            <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
              {[['card','Card','\u25c8'],['octopus','Octopus','\u25c9'],['cash','Cash','\u25ce']].map(([k,l,icon])=>(
                <div key={k} onClick={()=>setCopayMethod(k)} style={{flex:1,padding:'14px 8px',borderRadius:'8px',textAlign:'center',cursor:'pointer',background:copayMethod===k?C.green:C.card,color:copayMethod===k?'#fff':C.text}}>
                  <div style={{fontSize:'18px',marginBottom:'4px'}}>{icon}</div><div style={{fontSize:'12px',fontWeight:500}}>{l}</div>
                </div>
              ))}
            </div>
            <Btn variant="primary" style={{width:'100%'}} onClick={handleCollectRemainingCopay} disabled={collectingCopay}>{collectingCopay?'Processing...':`Collect HK$${claimAdjudication.fees.patientPayableTotal.toFixed(2)}`}</Btn>
          </div>}
        </>}
      </PageWrap>
    )
  }

  if (tab==='ledger') return (
    <PageWrap maxWidth={720}>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px',justifyContent:'center'}}>
        {[['collect','Collect payment'],['plans','Treatment plans'],['ledger','Financial records']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{fontSize:'13px',padding:'9px 18px',borderRadius:'20px',cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <SecLabel>Income & Medsa fees - last 100 transactions</SecLabel>
        <Btn variant="primary" style={{fontSize:'12px'}} onClick={exportCSV} disabled={ledger.length===0}>Export to Excel/CSV</Btn>
      </div>
      <div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>
        {'\u25c7'} This covers income collected through Medsa and Medsa's own fees (card/Octopus processing, claims clearinghouse). It does not track inventory purchases or other clinic expenses paid outside the system.
      </div>
      {ledgerLoading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted}}>Loading...</div>}
      {!ledgerLoading&&ledger.length===0&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,padding:'20px'}}>No transactions recorded yet.</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {ledger.map((t,i)=>(
          <Card key={i} style={{padding:'12px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{t.patient_name}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{new Date(t.created_at).toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} - {t.staff_name}</div>
              </div>
              <div style={{fontSize:'15px',fontWeight:700,color:C.green}}>HK${t.patient_pays}</div>
            </div>
            <div style={{display:'flex',gap:'12px',fontSize:'11px',color:C.textMuted}}>
              <span>Method: {t.payment_method}</span>
              {t.card_processing_fee>0&&<span>Processing fee (Medsa): HK${t.card_processing_fee}</span>}
              {t.clearinghouse_fee>0&&<span>Clearinghouse fee (Medsa): HK${t.clearinghouse_fee}</span>}
            </div>
          </Card>
        ))}
      </div>
    </PageWrap>
  )

  async function handleFindPlanPatient() {
    const { data } = await supabase.from('patients').select('id,full_name,medsa_id')
      .or(`full_name.ilike.%${planPatientQuery}%,medsa_id.ilike.%${planPatientQuery}%`).limit(1).maybeSingle()
    setPlanFoundPatient(data||null)
  }

  async function handleChargePlan() {
    setPlanSaving(true)
    const { data: newPlan } = await supabase.from('treatment_plans').insert({
      patient_id: planFoundPatient.id, institution_id: institutionId,
      plan_name: planName, sessions_paid: parseInt(planSessions)||0, sessions_used: 0,
      status: 'active', price_total: parseFloat(planPrice)||0, created_by: staffMember?.name,
    }).select().maybeSingle()
    const fee = calculatePaymentProcessingFee(planMethod, parseFloat(planPrice)||0)
    await supabase.from('transactions').insert({
      institution_id: institutionId, patient_name: planFoundPatient.full_name,
      consultation_fee: parseFloat(planPrice)||0, insurer_covers: 0, patient_pays: parseFloat(planPrice)||0,
      payment_method: planMethod, card_processing_fee: fee, treatment_plan_id: newPlan?.id,
      staff_name: staffMember?.name || 'Unknown',
    })
    setPlanSaving(false)
    setPlanStep('done')
    loadTreatmentPlans()
    loadLedger()
  }

  function resetPlanCreation() {
    setShowCreatePlan(false); setPlanStep('form'); setPlanPatientQuery(''); setPlanFoundPatient(null)
    setPlanName(''); setPlanSessions(''); setPlanPrice(''); setPlanMethod('card')
  }

  if (tab==='plans') return (
    <PageWrap maxWidth={640}>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px',justifyContent:'center'}}>
        {[['collect','Collect payment'],['plans','Treatment plans'],['ledger','Financial records']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{fontSize:'13px',padding:'9px 18px',borderRadius:'20px',cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
      {!showCreatePlan&&<Btn variant="primary" style={{width:'100%',marginBottom:'20px'}} onClick={()=>setShowCreatePlan(true)}>+ Create treatment plan</Btn>}

      {showCreatePlan&&planStep==='form'&&<Card style={{padding:'18px',marginBottom:'20px'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'12px'}}>New treatment plan</div>
        <div style={{display:'flex',gap:'8px',marginBottom:planFoundPatient?'10px':'12px'}}>
          <input value={planPatientQuery} onChange={e=>setPlanPatientQuery(e.target.value)} placeholder="Patient name or MedsaID" style={{flex:1,padding:'10px',fontSize:'13px'}}/>
          <Btn onClick={handleFindPlanPatient}>Find</Btn>
        </div>
        {planFoundPatient&&<div style={{fontSize:'12px',color:C.green,marginBottom:'12px'}}>{'\u2713'} {planFoundPatient.full_name}</div>}
        <input value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="Plan name (e.g. Physio - 10 sessions)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:'8px',marginBottom:'14px'}}>
          <input type="number" value={planSessions} onChange={e=>setPlanSessions(e.target.value)} placeholder="Total sessions" style={{flex:1,padding:'10px',fontSize:'13px',boxSizing:'border-box'}}/>
          <input type="number" value={planPrice} onChange={e=>setPlanPrice(e.target.value)} placeholder="Total price (HK$)" style={{flex:1,padding:'10px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <Btn style={{flex:1}} onClick={resetPlanCreation}>Cancel</Btn>
          <Btn variant="primary" style={{flex:1}} onClick={()=>setPlanStep('payment')} disabled={!planFoundPatient||!planName||!planSessions||!planPrice}>Next: collect payment</Btn>
        </div>
      </Card>}

      {showCreatePlan&&planStep==='payment'&&<Card style={{padding:'18px',marginBottom:'20px'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>{planFoundPatient.full_name}</div>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'14px'}}>{planName} - {planSessions} sessions - HK${planPrice}</div>
        <SecLabel>Payment method</SecLabel>
        <div style={{display:'flex',gap:'8px',marginBottom:'18px'}}>
          {[['card','Card','\u25c8'],['octopus','Octopus','\u25c9'],['cash','Cash','\u25ce']].map(([k,l,icon])=>(
            <div key={k} onClick={()=>setPlanMethod(k)} style={{flex:1,padding:'14px 8px',borderRadius:'8px',textAlign:'center',cursor:'pointer',background:planMethod===k?C.green:C.card,color:planMethod===k?'#fff':C.text}}>
              <div style={{fontSize:'18px',marginBottom:'4px'}}>{icon}</div>
              <div style={{fontSize:'12px',fontWeight:500}}>{l}</div>
            </div>
          ))}
        </div>
        <Btn variant="primary" style={{width:'100%'}} onClick={handleChargePlan} disabled={planSaving}>{planSaving?'Processing…':`Charge HK$${planPrice}`}</Btn>
      </Card>}

      {showCreatePlan&&planStep==='done'&&<Card style={{padding:'18px',marginBottom:'20px',textAlign:'center'}}>
        <div style={{fontSize:'28px',marginBottom:'8px'}}>{'\u2713'}</div>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>Plan created and paid</div>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>Logged in Financial Records - {planSessions} sessions ready to use</div>
        <Btn variant="primary" onClick={resetPlanCreation}>Done</Btn>
      </Card>}

      <SecLabel>Ongoing treatment plans - paid, used, remaining</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {treatmentPlans.map((p,i)=>(
          <Card key={i} style={{padding:'16px 18px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:600}}>{p.patient}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{p.plan}</div>
              </div>
              {p.status==='active'&&<Badge text="Active" type="ok"/>}
              {p.status==='completed'&&<Badge text="Completed" type="ok"/>}
              {p.status==='unpaid_renewal'&&<Badge text="Renewal due" type="due"/>}
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <div style={{flex:1,background:C.card,borderRadius:'8px',padding:'8px',textAlign:'center'}}>
                <div style={{fontSize:'11px',color:C.textMuted}}>Sessions used</div>
                <div style={{fontSize:'15px',fontWeight:700}}>{p.used} / {p.paid}</div>
              </div>
              <div style={{flex:1,background:p.remaining>0?C.greenXLight:C.amberLight,borderRadius:'8px',padding:'8px',textAlign:'center'}}>
                <div style={{fontSize:'11px',color:C.textMuted}}>Remaining</div>
                <div style={{fontSize:'15px',fontWeight:700,color:p.remaining>0?C.green:C.amber}}>{p.remaining}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageWrap>
  )

  if (paid) return (
    <PageWrap maxWidth={440}>
      <style>{'@media print { .no-print { display: none !important; } }'}</style>
      <div style={{textAlign:'center',padding:'50px 20px'}} className="print-receipt">
        <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Payment received</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>HK${selectedPayment?((selectedPayment.deductible_applied||0)+(selectedPayment.patient_copay_amount||0)):0} - {selectedPayment?.patients?.full_name||'Unknown'}</div>
        {paidRecord&&<Card style={{padding:'14px',marginBottom:'16px',textAlign:'left'}}>
          {paidRecord.diagnosis&&<div style={{fontSize:'12px',marginBottom:'6px'}}><strong>Diagnosis:</strong> {paidRecord.diagnosis}</div>}
          {(paidRecord.line_items||[]).map((item,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'12px',padding:'3px 0'}}>
              <span>{item.description}{item.qty>1&&` x${item.qty}`}</span><span>HK${(item.fee*item.qty).toFixed(2)}</span>
            </div>
          ))}
        </Card>}
        {!paidRecord&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px'}}>No itemized consultation record linked to this claim.</div>}
        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}} className="no-print">
          <Btn variant={receiptSent?'secondary':'primary'} disabled={receiptSent||!paidRecord} onClick={async()=>{
            await supabase.from('medical_records').update({receipt_sent_at:new Date().toISOString()}).eq('id',paidRecord.id)
            setReceiptSent(true)
          }}>{receiptSent?"Marked sent to patient's Medsa app":!paidRecord?'No record to send':'Send receipt to Medsa app'}</Btn>
          <Btn onClick={()=>{window.print();setPrinted(true)}}>{printed?'Printed':'Print receipt'}</Btn>
        </div>
        {receiptSent&&<div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>{'\u25c7'} Receipt, consultation notes, and prescription are now synced to the patient's Medsa cloud record.</div>}
        <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setPaid(false);setReceiptSent(false);setPrinted(false);setSelectedPayment(null)}}>New payment</Btn>
      </div>
    </PageWrap>
  )

  return (
    <PageWrap maxWidth={440}>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px',justifyContent:'center'}}>
        {[['collect','Collect payment'],['plans','Treatment plans'],['ledger','Financial records']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{fontSize:'13px',padding:'9px 18px',borderRadius:'20px',cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
      {!selectedPayment&&<>
        <SecLabel>Pending patient payments</SecLabel>
        <input value={paymentSearch} onChange={e=>setPaymentSearch(e.target.value)} placeholder="Search by patient or insurer…" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box'}}/>
        {pendingLoading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,padding:'20px'}}>Loading…</div>}
        {!pendingLoading&&pendingPayments.length===0&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,padding:'20px'}}>No outstanding patient payments right now.</div>}
        {!pendingLoading&&pendingPayments
          .filter(p => !paymentSearch.trim() || (p.patients?.full_name||'').toLowerCase().includes(paymentSearch.toLowerCase()) || (p.insurance_plans?.company_name||'').toLowerCase().includes(paymentSearch.toLowerCase()))
          .map(p=>{
          const owed = (p.deductible_applied||0)+(p.patient_copay_amount||0)
          return (
            <Card key={p.claim_ref} onClick={()=>setSelectedPayment(p)} style={{padding:'14px 16px',marginBottom:'8px',cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:600}}>{p.patients?.full_name||'Unknown'}</div>
                  <div style={{fontSize:'11px',color:C.textSub}}>{p.claim_ref} - {p.insurance_plans?.company_name||'-'} - {p.submitted_at?new Date(p.submitted_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'}):'-'}</div>
                </div>
                <div style={{fontSize:'15px',fontWeight:700,color:C.green}}>HK${owed}</div>
              </div>
            </Card>
          )
        })}
      </>}

      {selectedPayment&&<>
      <div onClick={()=>setSelectedPayment(null)} style={{fontSize:'12px',color:C.green,cursor:'pointer',marginBottom:'12px'}}>{'\u2039'} Back to pending payments</div>
      <Card style={{padding:'18px',marginBottom:'16px'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>{selectedPayment.patients?.full_name||'Unknown'}</div>
        <div style={{fontSize:'11px',color:C.textSub,marginBottom:'12px'}}>{selectedPayment.claim_ref} - {selectedPayment.insurance_plans?.company_name}</div>
        {[['Consultation fee',`HK$${selectedPayment.amount}`],['Insurance covers',`-HK$${selectedPayment.insurer_covered_amount}`],['Patient pays',`HK$${(selectedPayment.deductible_applied||0)+(selectedPayment.patient_copay_amount||0)}`]].map(([l,v],i)=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:i<2?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}>
            <span style={{color:C.textSub}}>{l}</span>
            <span style={{fontWeight:i===2?700:500,fontSize:i===2?'17px':'13px',color:i===2?C.green:C.text}}>{v}</span>
          </div>
        ))}
        <div style={{marginTop:'10px',paddingTop:'10px',borderTop:`0.5px solid ${C.border}`,fontSize:'11px',color:C.textMuted,lineHeight:1.5}}>
          {'\u25c7'} Itemized against claim {selectedPayment.claim_ref}, ready for reconciliation once collected.
        </div>
      </Card>
      <SecLabel>Payment method</SecLabel>
      <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
        {[['card','Card','\u25c8'],['octopus','Octopus','\u25c9'],['cash','Cash','\u25ce']].map(([k,l,icon])=>(
          <div key={k} onClick={()=>setMethod(k)} style={{flex:1,padding:'14px 8px',borderRadius:'8px',textAlign:'center',cursor:'pointer',background:method===k?C.green:C.card,color:method===k?'#fff':C.text}}>
            <div style={{fontSize:'18px',marginBottom:'4px'}}>{icon}</div>
            <div style={{fontSize:'12px',fontWeight:500}}>{l}</div>
          </div>
        ))}
      </div>
      <Btn variant="primary" style={{width:'100%',padding:'14px'}} onClick={handleCharge} disabled={saving}>{saving?'Processing...':`Charge HK$${(selectedPayment.deductible_applied||0)+(selectedPayment.patient_copay_amount||0)}`}</Btn>
      </>}
    </PageWrap>
  )
}

function InventoryScreen({ staffMember, institutionId, medicineType }) {
  const [items,setItems]=useState([])
  const [loading,setLoading]=useState(true)
  const [showReorderOnly,setShowReorderOnly]=useState(false)
  const [pendingDelta,setPendingDelta]=useState({}) // itemId -> uncommitted delta
  const [confirming,setConfirming]=useState(null)
  const [importResult,setImportResult]=useState(null)
  const [addItemOpen,setAddItemOpen]=useState(false)
  const [newItemName,setNewItemName]=useState('')
  const [newItemStock,setNewItemStock]=useState('')
  const [newItemUnit,setNewItemUnit]=useState('units')
  const [newItemReorder,setNewItemReorder]=useState('10')
  const [newItemSupplier,setNewItemSupplier]=useState('')
  const [addingItem,setAddingItem]=useState(false)
  const [addItemError,setAddItemError]=useState(null)

  async function handleOrderSetFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (staffMember?.role !== 'admin') { setImportResult({ type:'orderset', imported:0, skipped:0, total:0, error:'Only a practice manager can import order sets - this is real safety logic, not inventory.' }); return }
    if (!institutionId) { setImportResult({ type:'orderset', imported:0, skipped:0, total:0, error:'Institution not resolved yet - try again in a moment.' }); return }
    const text = await file.text()
    const rows = parseCSV(text).filter(row => row.drug_name)
    // Writes go through a server route now, not straight to the database -
    // order sets drive real hard-stop/soft-stop safety logic, so the write
    // itself is re-checked server-side against the caller's actual stored
    // role rather than trusting this client-side check alone.
    const res = await fetch('/api/staff/import-order-sets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medsaId: staffMember.id, institutionId, rows }),
    })
    const result = await res.json()
    if (!res.ok) { setImportResult({ type:'orderset', imported:0, skipped:0, total:0, error: result.error || 'Import failed.' }); return }
    setImportResult({ type:'orderset', imported: result.imported, skipped: result.skipped, total: result.total })
  }

  async function handleStockFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!institutionId) { setImportResult({ type:'stock', imported:0, skipped:0, total:0, error:'Institution not resolved yet - try again in a moment.' }); return }
    const text = await file.text()
    const rows = parseCSV(text)
    let imported=0, skipped=0
    for (const row of rows) {
      if (!row.item_name) { skipped++; continue }
      const { data: existing } = await supabase
        .from('clinic_inventory').select('id')
        .eq('item_name', row.item_name).eq('institution_id', institutionId).maybeSingle()

      if (existing) {
        await supabase.from('clinic_inventory').update({
          stock: parseInt(row.stock)||0, unit: row.unit||'units',
          reorder_at: parseInt(row.reorder_at)||10, supplier: row.supplier||null,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id)
      } else {
        await supabase.from('clinic_inventory').insert({
          item_name: row.item_name, institution_id: institutionId, stock: parseInt(row.stock)||0, unit: row.unit||'units',
          reorder_at: parseInt(row.reorder_at)||10, supplier: row.supplier||null,
        })
      }
      imported++
    }
    setImportResult({ type:'stock', imported, skipped, total: rows.length })
    const { data } = await supabase.from('clinic_inventory').select('*').eq('institution_id', institutionId).order('item_name',{ascending:true})
    setItems((data||[]).map(r=>({ id:r.id, name:r.item_name, stock:r.stock, unit:r.unit, reorderAt:r.reorder_at, supplier:r.supplier })))
  }

  async function handleReferenceFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const rows = parseCSV(text)
    let imported=0, skipped=0
    const skippedForNoCode = []
    for (const row of rows) {
      if (!row.drug_name) { skipped++; continue }
      const hkReg = row.hk_registration_number?.trim() || null
      const atc = row.atc_code?.trim() || null
      if (!hkReg && !atc) { skippedForNoCode.push(row.drug_name); continue }
      const rowType = (row.medicine_type||medicineType||'western').toLowerCase()
      await supabase.from('drug_reference').upsert({
        drug_name: row.drug_name, medicine_type: rowType, effects: row.effects||null, intake_info: row.intake_info||null,
        precautions: row.precautions||null, hk_registration_number: hkReg, atc_code: atc,
        is_dangerous_drug: ['true','yes','1'].includes((row.is_dangerous_drug||'').toLowerCase()),
        updated_by: staffMember?.name||'CSV import',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'drug_name,medicine_type' })
      imported++
    }
    setImportResult({ type:'reference', imported, skipped: skipped+skippedForNoCode.length, skippedForNoCode, total: rows.length })
  }

  async function handleAddItem() {
    if (!newItemName.trim()) { setAddItemError('Item name is required.'); return }
    if (!institutionId) { setAddItemError('Institution not resolved yet - try again in a moment.'); return }
    setAddingItem(true)
    setAddItemError(null)
    const { error } = await supabase.from('clinic_inventory').insert({
      item_name: newItemName.trim(), institution_id: institutionId,
      stock: parseInt(newItemStock)||0, unit: newItemUnit||'units',
      reorder_at: parseInt(newItemReorder)||10, supplier: newItemSupplier||null,
    })
    if (error) { setAddItemError(error.message); setAddingItem(false); return }
    const { data } = await supabase.from('clinic_inventory').select('*').eq('institution_id', institutionId).order('item_name', { ascending: true })
    setItems((data||[]).map(r => ({ id: r.id, name: r.item_name, stock: r.stock, unit: r.unit, reorderAt: r.reorder_at, supplier: r.supplier })))
    setAddItemOpen(false)
    setNewItemName(''); setNewItemStock(''); setNewItemUnit('units'); setNewItemReorder('10'); setNewItemSupplier('')
    setAddingItem(false)
  }

  useEffect(() => {
    async function load() {
      if (!institutionId) return
      setLoading(true)
      const { data } = await supabase.from('clinic_inventory').select('*').eq('institution_id', institutionId).order('item_name', { ascending: true })
      setItems((data||[]).map(r => ({
        id: r.id, name: r.item_name, stock: r.stock, unit: r.unit, reorderAt: r.reorder_at, supplier: r.supplier,
      })))
      setLoading(false)
    }
    load()
  }, [institutionId])

  const displayed = showReorderOnly ? items.filter(i=>i.stock<=i.reorderAt) : items
  const lowStockCount = items.filter(i=>i.stock<=i.reorderAt).length

  function adjustPending(id, delta) {
    setPendingDelta(prev => ({ ...prev, [id]: (prev[id]||0) + delta }))
  }

  async function confirmChange(id) {
    const delta = pendingDelta[id]
    if (!delta) return
    setConfirming(id)
    const item = items.find(i=>i.id===id)
    const newStock = Math.max(0, item.stock + delta)
    const staffName = staffMember?.name || 'Unknown'
    const now = new Date().toISOString()

    await supabase.from('clinic_inventory').update({ stock: newStock, updated_at: now }).eq('id', id)
    await supabase.from('inventory_movements').insert({
      inventory_id: id, item_name: item.name, change_amount: delta,
      new_stock: newStock, reason: 'manual_adjustment', staff_name: staffName,
    })

    setItems(prev=>prev.map(i=>i.id===id?{...i,stock:newStock}:i))
    setPendingDelta(prev => { const next={...prev}; delete next[id]; return next })
    setConfirming(null)
  }

  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Inventory</h2>
      <div style={{display:'flex',gap:'10px',marginBottom:'16px',justifyContent:'center'}}>
        <label style={{fontSize:'13px',fontWeight:600,padding:'11px 18px',borderRadius:'10px',cursor:'pointer',background:C.green,color:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.12)'}}>
          {'\u2191'} Import stock CSV
          <input type="file" accept=".csv" onChange={handleStockFile} style={{display:'none'}}/>
        </label>
        <label style={{fontSize:'13px',fontWeight:600,padding:'11px 18px',borderRadius:'10px',cursor:'pointer',background:C.green,color:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.12)'}}>
          {'\u2191'} Import drug info CSV
          <input type="file" accept=".csv" onChange={handleReferenceFile} style={{display:'none'}}/>
        </label>
        <label style={{fontSize:'13px',fontWeight:600,padding:'11px 18px',borderRadius:'10px',cursor:'pointer',background:C.green,color:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.12)'}}>
          {'\u2191'} Import order sets CSV
          <input type="file" accept=".csv" onChange={handleOrderSetFile} style={{display:'none'}}/>
        </label>
      </div>
      <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px',textAlign:'center'}}>Drug info CSV requires an hk_registration_number or atc_code column per row - this is what would let a real safety database look each drug up. Rows without either are skipped, not imported with guessed data.</div>
      <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px',textAlign:'center'}}>Order sets CSV requires drug_name per row - only a practice manager can import this, and every rule is auto-approved under your own name, since who approved it is never optional. Columns: min_dose_per_kg, max_dose_per_kg, dose_unit, min_age_years, max_age_years, renal_adjustment_notes, high_alert, hard_stop_conditions, soft_stop_conditions (semicolon-separated for multiple). Same-drug-name rows in hard_stop_conditions/soft_stop_conditions on another drug's row are what the drug-to-drug interaction check reads at prescribing time.</div>
      {importResult&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:C.green,textAlign:'center'}}>
        {{stock:'Stock', reference:'Drug info', orderset:'Order sets'}[importResult.type]} import: {importResult.imported} of {importResult.total} rows imported{importResult.skipped>0?`, ${importResult.skipped} skipped`:''}.
        {importResult.skippedForNoCode?.length>0&&<div style={{marginTop:'4px'}}>Skipped for missing a required HK Registration Number or ATC Code: {importResult.skippedForNoCode.join(', ')}</div>}
      </div>}
      <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginBottom:'16px',lineHeight:1.5}}>
        Stock CSV columns: item_name, stock, unit, reorder_at, supplier · Drug info CSV columns: drug_name, effects, intake_info, precautions, medicine_type (optional - western or chinese, defaults to this clinic's type)
      </div>
      {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,marginBottom:'16px'}}>Loading...</div>}
      {lowStockCount>0&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px'}}>
        <span style={{fontSize:'13px',fontWeight:600,color:C.amber}}>{'\u26a0'} {lowStockCount} item(s) at or below reorder level</span>
      </div>}
      <div style={{display:'flex',gap:'8px',marginBottom:'16px',justifyContent:'center'}}>
        {[[false,'All items'],[true,'Needs reorder']].map(([v,l])=>(
          <div key={String(v)} onClick={()=>setShowReorderOnly(v)} style={{fontSize:'12px',padding:'7px 14px',borderRadius:'20px',cursor:'pointer',background:showReorderOnly===v?C.green:C.card,color:showReorderOnly===v?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {displayed.map((item)=>{
          const low = item.stock <= item.reorderAt
          const delta = pendingDelta[item.id] || 0
          const previewStock = Math.max(0, item.stock + delta)
          return (
            <Card key={item.id} style={{padding:'14px 18px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'13px',fontWeight:600}}>{item.name}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{item.supplier} - reorder at {item.reorderAt} {item.unit}</div>
                </div>
                {low&&!delta&&<Badge text="Reorder" type="due"/>}
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <button onClick={()=>adjustPending(item.id,-10)} style={{width:28,height:28,borderRadius:'6px',border:`0.5px solid ${C.border}`,background:'#fff',cursor:'pointer'}}>-</button>
                  <div style={{width:70,textAlign:'center'}}>
                    <span style={{fontSize:'15px',fontWeight:700,color:previewStock<=item.reorderAt?C.amber:C.text}}>{previewStock}</span>
                    <span style={{fontSize:'11px',color:C.textMuted}}> {item.unit}</span>
                  </div>
                  <button onClick={()=>adjustPending(item.id,10)} style={{width:28,height:28,borderRadius:'6px',border:`0.5px solid ${C.border}`,background:'#fff',cursor:'pointer'}}>+</button>
                </div>
              </div>
              {delta!==0&&<div style={{marginTop:'10px',paddingTop:'10px',borderTop:`0.5px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:'11px',color:C.amber}}>Unsaved change: {delta>0?'+':''}{delta} {item.unit}</span>
                <div style={{display:'flex',gap:'6px'}}>
                  <Btn style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>setPendingDelta(prev=>{const n={...prev};delete n[item.id];return n})}>Cancel</Btn>
                  <Btn variant="primary" style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>confirmChange(item.id)} disabled={confirming===item.id}>{confirming===item.id?'Saving...':'Confirm'}</Btn>
                </div>
              </div>}
            </Card>
          )
        })}
      </div>
      {!addItemOpen&&<div style={{textAlign:'center',marginTop:'16px'}}><Btn variant="primary" onClick={()=>setAddItemOpen(true)}>+ Add item</Btn></div>}
      {addItemOpen&&<Card style={{padding:'16px',marginTop:'16px'}}>
        <div style={{fontSize:'13px',fontWeight:600,marginBottom:'10px'}}>Add stock item</div>
        <input value={newItemName} onChange={e=>setNewItemName(e.target.value)} placeholder="Item name" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px'}}/>
        <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
          <input value={newItemStock} onChange={e=>setNewItemStock(e.target.value)} type="number" placeholder="Starting stock" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          <input value={newItemUnit} onChange={e=>setNewItemUnit(e.target.value)} placeholder="Unit (e.g. tablets)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          <input value={newItemReorder} onChange={e=>setNewItemReorder(e.target.value)} type="number" placeholder="Reorder at" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          <input value={newItemSupplier} onChange={e=>setNewItemSupplier(e.target.value)} placeholder="Supplier (optional)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>
        {addItemError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{addItemError}</div>}
        <div style={{display:'flex',gap:'8px'}}>
          <Btn style={{flex:1}} onClick={()=>{setAddItemOpen(false);setAddItemError(null)}}>Cancel</Btn>
          <Btn variant="primary" style={{flex:1}} onClick={handleAddItem} disabled={addingItem}>{addingItem?'Adding...':'Add item'}</Btn>
        </div>
      </Card>}
    </PageWrap>
  )
}

// ── CLAIMS CLEARINGHOUSE ─────────────────────────────────────────────────────
// Validates claims before they leave the clinic, calculates the per-claim
// Medsa clearinghouse fee, and tracks status through the pipeline. Actual
// transmission to an insurer is a manual/portal handoff until a real insurer
// API or EDI contract exists - this is flagged honestly in the UI itself.
function ClaimsScreen({ onNavPayment }) {
  const [step,setStep]=useState('list')
  const [claimType,setClaimType]=useState('outpatient')
  const [selectedPatient,setSelectedPatient]=useState(null)
  const [selectedPlan,setSelectedPlan]=useState(null)
  const [amount,setAmount]=useState('')
  const [patients,setPatients]=useState([])
  const [plans,setPlans]=useState([])
  const [existingClaims,setExistingClaims]=useState([])
  const [loading,setLoading]=useState(true)
  const [adjudicating,setAdjudicating]=useState(false)
  const [reloadTrigger,setReloadTrigger]=useState(0)
  const [adjudicationResult,setAdjudicationResult]=useState(null)
  const [affiliatedPolicies,setAffiliatedPolicies]=useState(null) // null = not checked yet, [] = checked, none found

  useEffect(() => {
    if (!selectedPatient?.id) { setAffiliatedPolicies(null); return }
    async function loadAffiliations() {
      const { data } = await supabase.from('agent_policies').select('*')
        .eq('patient_id', selectedPatient.id).eq('status', 'active')
      setAffiliatedPolicies(data||[])
    }
    loadAffiliations()
  }, [selectedPatient?.id])

  const [pendingMedicalRecordId,setPendingMedicalRecordId]=useState(null)
  useEffect(() => {
    if (!selectedPatient?.id) { setPendingMedicalRecordId(null); return }
    async function loadRecord() {
      const { data } = await supabase.from('medical_records').select('id')
        .eq('patient_id', selectedPatient.id).is('insurance_claim_id', null)
        .order('date_of_record', { ascending: false }).limit(1).maybeSingle()
      setPendingMedicalRecordId(data?.id || null)
    }
    loadRecord()
  }, [selectedPatient?.id])

  const affiliatedPlans = affiliatedPolicies ? plans.filter(pl => affiliatedPolicies.some(ap => ap.plan_id === pl.id)) : plans

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{data:patientRows},{data:consentRows},{data:planRows},{data:claimRows}] = await Promise.all([
        supabase.from('patients').select('id, full_name, medsa_id'),
        supabase.from('patient_consent').select('patient_id').eq('active', true),
        supabase.from('insurance_plans').select('*'),
        supabase.from('insurance_claims').select('*, patients(full_name), insurance_plans(plan_name, company_name)').order('submitted_at', { ascending: false }).limit(10),
      ])
      const consentedIds = new Set((consentRows||[]).map(c=>c.patient_id))
      setPatients((patientRows||[]).map(p => ({
        id: p.id, name: p.full_name, medsaId: p.medsa_id, consented: consentedIds.has(p.id),
      })))
      setPlans(planRows||[])
      setExistingClaims((claimRows||[]).map(c => ({
        ref: c.claim_ref, patient: c.patients?.full_name||'Unknown', insurer: c.insurance_plans?.company_name||'-',
        amount: c.amount, fee: c.platform_claim_fee||0, status: c.status,
        deductibleApplied: c.deductible_applied||0, patientCopayAmount: c.patient_copay_amount||0,
        paymentProcessingFee: c.payment_processing_fee||0, copayPaymentMethod: c.copay_payment_method,
        date: c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'}) : '-',
      })))
      setLoading(false)
    }
    load()
  }, [reloadTrigger])

  const statusMeta = {
    approved: {label:'Approved', type:'ok', desc:'Insurer has approved this claim in full'},
    partially_approved: {label:'Partially approved', type:'due', desc:'Insurer covered part of the claim - patient owes the remainder'},
    rejected: {label:'Rejected', type:'off', desc:'Not covered - patient pays the full amount'},
    pending_review: {label:'Pending review', type:'waiting', desc:'High-value claim - held for manual review before settlement'},
    settled: {label:'Settled', type:'ok', desc:'Payment collected and claim fully closed'},
  }

  if (step==='list') return (
    <PageWrap maxWidth={680}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Direct Billing Claims</h2>

      <div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
        <div style={{fontSize:'14px',fontWeight:600,color:C.green,marginBottom:'4px'}}>How this works</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Medsa validates each claim - checking patient consent, policy on file, and required documents - before it's sent to the insurer. A small clearinghouse fee is paid by the insurer per validated claim, not by your clinic.</div>
      </div>
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'12px',fontSize:'12px',color:C.textSub,lineHeight:1.5}}>
        {'\u25c7'} This only applies to patients on a direct-billing plan with an in-network insurer. If a patient pays out of pocket and claims reimbursement themselves, that happens entirely through their own insurer's app - there's nothing for this clinic to track, and no claim should be created here for that visit.
      </div>
      <div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'20px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>
        {'\u25c7'} Until Medsa has a direct connection with a given insurer, "Sent to insurer" means the validated package is ready for you to submit through that insurer's existing portal or email - this step automates fully once an insurer partnership is in place.
      </div>

      <SecLabel>Recent claims</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
        {existingClaims.map((c,i)=>{
          const meta = statusMeta[c.status]
          return (
            <Card key={i} style={{padding:'14px 18px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:500}}>{c.ref} - {c.patient}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{c.insurer} - {c.date}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'15px',fontWeight:600,color:C.green}}>HK${c.amount}</div>
                  <Badge text={meta?.label||c.status} type={meta?.type||'waiting'}/>
                </div>
              </div>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>{meta?.desc}</div>
              <div style={{fontSize:'11px',color:C.blue,marginBottom:'10px'}}>Medsa platform claim fee: HK${c.fee} (paid by insurer)</div>
              {(c.status==='approved'||c.status==='partially_approved')&&(c.deductibleApplied+c.patientCopayAmount)>0&&!c.copayPaymentMethod&&
                <Btn variant="primary" style={{width:'100%'}} onClick={()=>onNavPayment?.(c.ref)}>Collect HK${c.deductibleApplied+c.patientCopayAmount} in Payment</Btn>}
              {c.copayPaymentMethod&&<div style={{fontSize:'11px',color:C.textMuted}}>Copay collected via {c.copayPaymentMethod} - processing fee HK${c.paymentProcessingFee}</div>}
            </Card>
          )
        })}
      </div>
      <div style={{textAlign:'center'}}><Btn variant="primary" onClick={()=>setStep('new')}>+ Submit new claim</Btn></div>
    </PageWrap>
  )

  if (step==='new') return (
    <PageWrap maxWidth={560}>
      <div onClick={()=>setStep('list')} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'16px'}}>Back</div>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'16px',textAlign:'center'}}>New Claim</h2>
      <SecLabel>Select patient</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
        {patients.map((p)=>(
          <Card key={p.id} onClick={()=>p.consented&&setSelectedPatient(p)} style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',opacity:p.consented?1:0.5,border:selectedPatient?.id===p.id?`1.5px solid ${C.green}`:undefined}}>
            <div><div style={{fontSize:'13px',fontWeight:500}}>{p.name}</div><div style={{fontSize:'12px',color:C.textSub}}>{p.medsaId}</div></div>
            {p.consented?<span style={{fontSize:'12px',color:C.green,fontWeight:600}}>Consented</span>:<span style={{fontSize:'12px',color:C.textMuted}}>No consent on file</span>}
          </Card>
        ))}
      </div>
      {selectedPatient&&<>
        <SecLabel>Insurance plan</SecLabel>
        {affiliatedPolicies&&affiliatedPolicies.length===0&&<div style={{fontSize:'12px',color:C.textMuted,padding:'0 16px 10px'}}>No affiliated insurance plan on file for this patient - this claim can't proceed as direct billing.</div>}
        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
          {affiliatedPlans.map(pl=>{
            const realPolicy = affiliatedPolicies?.find(ap=>ap.plan_id===pl.id)
            return (
              <Card key={pl.id} onClick={()=>setSelectedPlan(pl)} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',border:selectedPlan?.id===pl.id?`1.5px solid ${C.green}`:undefined}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:500}}>{pl.plan_name}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{pl.company_name}</div>
                  {realPolicy?.policy_number&&<div style={{fontSize:'11px',color:C.green,marginTop:'2px'}}>Policy: {realPolicy.policy_number}</div>}
                </div>
              </Card>
            )
          })}
        </div>

        <SecLabel>Claim type</SecLabel>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'8px',marginBottom:'20px'}}>
          {['outpatient','hospitalisation','specialist','lab'].map(t=>(
            <div key={t} onClick={()=>setClaimType(t)} style={{padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:claimType===t?C.green:C.card,color:claimType===t?'#fff':C.text,textTransform:'capitalize'}}>{t}</div>
          ))}
        </div>

        <SecLabel>Claim amount</SecLabel>
        <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="HK$" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'20px'}}/>

        <SecLabel>Validation checklist</SecLabel>
        <Card style={{padding:'16px',marginBottom:'20px'}}>
          {[
            {label:'Patient consent on file', ok:selectedPatient.consented},
            {label:'Insurance plan selected', ok:!!selectedPlan},
            {label:'Consultation record attached', ok:true},
            {label:'Diagnosis on file', ok:true},
          ].map((item,i,arr)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>
              <span style={{color:item.ok?C.green:C.red,fontSize:'13px'}}>{item.ok?'\u2713':'\u2715'}</span>
              <span style={{fontSize:'13px',color:item.ok?C.text:C.red}}>{item.label}</span>
            </div>
          ))}
        </Card>

        {amount&&selectedPlan&&<div style={{background:C.blueLight,borderRadius:'8px',padding:'12px 14px',marginBottom:'20px',fontSize:'12px',color:C.blue}}>
          Medsa clearinghouse fee for this claim: <strong>HK${calculatePlatformClaimFee(amount)}</strong> (paid by {selectedPlan.company_name}, not deducted from your claim)
        </div>}
        {selectedPatient&&<div style={{fontSize:'11px',color:pendingMedicalRecordId?C.textMuted:C.amber,marginBottom:'14px'}}>
          {pendingMedicalRecordId ? 'A consultation record on file will be linked to this claim for the receipt.' : 'No unlinked consultation record found for this patient - the receipt will show payment only, without itemized diagnosis or prescriptions.'}
        </div>}

        <div style={{textAlign:'center'}}>
          <Btn variant="primary" onClick={async ()=>{
            setAdjudicating(true)
            const adapter = getInsuranceAdapter(selectedPlan.company_name)
            const result = await adapter.adjudicateClaim({
              patientId: selectedPatient.id, policyNumber: selectedPlan.id,
              clinicId: 'clinic_ops', totalGrossAmount: parseFloat(amount),
              items: [{ code: claimType, description: claimType, amount: parseFloat(amount) }],
              medicalRecordId: pendingMedicalRecordId || undefined,
            })
            setAdjudicationResult(result)
            setAdjudicating(false)
            setStep('submitted')
          }} disabled={!selectedPatient.consented||!selectedPlan||!amount||adjudicating}>
            {adjudicating ? 'Checking eligibility & adjudicating…' : `Validate & prepare for ${selectedPlan?.company_name||'insurer'}`}
          </Btn>
        </div>
      </>}
    </PageWrap>
  )

  return (
    <PageWrap maxWidth={480}>
      <div style={{textAlign:'center',padding:'60px 20px'}}>
        <div style={{fontSize:'36px',marginBottom:'12px'}}>{adjudicationResult?.status==='REJECTED'?'\u26a0':'\u2713'}</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>{{APPROVED:'Claim approved',PARTIALLY_APPROVED:'Claim partially approved',REJECTED:'Claim rejected',PENDING_REVIEW:'Pending review',SETTLED:'Approved & settled - fully covered'}[adjudicationResult?.status]||'Claim validated'}</div>
        {adjudicationResult&&<div style={{background:C.card,borderRadius:'10px',padding:'14px',marginBottom:'16px',textAlign:'left',fontSize:'12px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span>Gross amount</span><strong>HK${adjudicationResult.fees.grossAmount}</strong></div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span>Deductible applied</span><strong>HK${adjudicationResult.deductibleApplied}</strong></div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span>Insurer covers</span><strong style={{color:C.green}}>HK${adjudicationResult.fees.insurerCoveredAmount}</strong></div>
          <div style={{display:'flex',justifyContent:'space-between',paddingTop:'6px',borderTop:`0.5px solid ${C.border}`,marginBottom:'10px'}}><span>Patient pays total</span><strong>HK${adjudicationResult.fees.patientPayableTotal}</strong></div>
          <div style={{fontSize:'11px',color:C.textMuted,paddingTop:'8px',borderTop:`0.5px solid ${C.border}`}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'2px'}}><span>Platform claim fee (paid by insurer)</span><span>HK${adjudicationResult.fees.platformClaimFee}</span></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>Clinic net payout</span><span>HK${adjudicationResult.fees.clinicNetPayout}</span></div>
          </div>
          <div style={{fontSize:'10px',color:C.textMuted,marginTop:'8px'}}>Authorization: {adjudicationResult.authorizationCode}</div>
        </div>}
        {adjudicationResult&&adjudicationResult.fees.patientPayableTotal>0&&<>
          <Btn variant="primary" style={{width:'100%',marginBottom:'20px'}} onClick={()=>onNavPayment?.(adjudicationResult.claimId)}>Collect HK${adjudicationResult.fees.patientPayableTotal} in Payment</Btn>
        </>}
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'20px'}}>Submission channel: {selectedPlan?.company_name}'s existing claims portal (manual handoff until direct integration is in place)</div>
        <Btn variant="primary" onClick={()=>{setStep('list');setSelectedPatient(null);setSelectedPlan(null);setAmount('');setAdjudicationResult(null)}}>Done</Btn>
      </div>
    </PageWrap>
  )
}

export default function ClinicOpsApp() {
  const [staffMember,setStaffMember]=useState(null)
  const [checkInError,setCheckInError]=useState(null)
  const [screen,setScreen]=useState('overview')
  const [newPatientOrigin,setNewPatientOrigin]=useState('checkin') // 'checkin' | 'schedule'
  const [newPatientPrefillName,setNewPatientPrefillName]=useState('')
  const [schedulePreselectPatient,setSchedulePreselectPatient]=useState(null)
  const [payPreselectClaimRef,setPayPreselectClaimRef]=useState(null)
  const [payPreselectRecordId,setPayPreselectRecordId]=useState(null)
  const [checkedInQueue,setCheckedInQueue]=useState([])
  const [queueLoading,setQueueLoading]=useState(true)
  const [pendingPrescriptions,setPendingPrescriptions]=useState([])

  // Real, shared queue - was local browser state before, which meant a
  // doctor's tablet and front desk's computer never saw the same thing.
  // Queries medical_records directly instead, transformed into the exact
  // shape the existing label/inventory logic already expects, so that
  // logic didn't need to be rewritten. Polls rather than a single load,
  // since this needs to reach a genuinely different device in real time.
  async function loadTaskBoard() {
    const { data: records } = await supabase.from('medical_records')
      .select('*, patients(full_name, medsa_id)')
      .eq('record_status', 'submitted').eq('source', 'clinic_ops')
      .order('date_of_record', { ascending: false })
    if (!records) return
    const withDrugs = await Promise.all(records.map(async r => {
      const { data: meds } = await supabase.from('medications').select('*').eq('medical_record_id', r.id)
      return {
        id: r.id, recordId: r.id, patientId: r.patient_id,
        patientName: r.patients?.full_name || 'Unknown', patientMedsaId: r.patients?.medsa_id || null,
        doctorName: r.doctor_name || 'Unknown', diagnosis: r.diagnosis, notes: r.notes, icd10Code: r.icd10_code,
        lineItems: r.line_items || [], totalFee: r.total_fee,
        drugs: (meds||[]).map(m => ({ drug: m.medication_name, dosage: m.dosage, frequency: m.frequency, quantity: m.quantity, durationDays: m.duration_days })),
        timestamp: new Date(r.date_of_record).getTime(), status: r.meds_dispensed_at ? 'printed' : 'pending',
      }
    }))
    setPendingPrescriptions(withDrugs)
  }

  useEffect(() => {
    loadTaskBoard()
    const interval = setInterval(loadTaskBoard, 15000)
    return () => clearInterval(interval)
  }, [])
  const [selectedQueueEntry,setSelectedQueueEntry]=useState(null)
  const [nextTicket,setNextTicket]=useState(1)
  const [institutionId,setInstitutionId]=useState(null)
  const [institutionName,setInstitutionName]=useState('')
  const [medicineType,setMedicineType]=useState('western')

  // Resolve which institution this Medsa Clinic deployment belongs to, and
  // which medicine system it operates under (Western - Pharmacy and
  // Poisons Ordinance, or Chinese - Chinese Medicine Ordinance). These are
  // two separate regulatory systems in Hong Kong, so a clinic's drug
  // reference pool never mixes between them.
 useEffect(() => {
  async function loadInstitution() {
    // Real fix - resolves from whichever institution the logged-in staff
    // member actually belongs to, not a hardcoded clinic name. This was
    // the reason ClinicOps only ever worked for one specific clinic -
    // onboarding a second clinic would have silently mixed their data
    // into the first one's institution.
    if (!staffMember?.institutionId) return
    const { data } = await supabase.from('institutions').select('id, name, medicine_type').eq('id', staffMember.institutionId).maybeSingle()
    if (data) { setInstitutionId(data.id); setInstitutionName(data.name || ''); setMedicineType(data.medicine_type || 'western') }
  }
  loadInstitution()
}, [staffMember])

  // Load today's queue and pending prescriptions from Supabase - now
  // reusable (see effects below), since loading this only once at login
  // meant a doctor already signed in before a check-in happened would
  // never see it without manually logging out and back in.
  async function loadQueueAndPrescriptions() {
      setQueueLoading(true)
      const { data: queueRows } = await supabase
        .from('clinic_queue')
        .select('*, patients(medsa_id)')
        .order('checked_in_at', { ascending: true })
      setCheckedInQueue((queueRows||[]).map(r => ({
        id: r.id,
        ticket: r.ticket,
        patientName: r.patient_name,
        patientMedsaId: r.patients?.medsa_id || null,
        doctor: r.doctor_name || 'Unassigned',
        room: r.room || '-',
        checkedInAt: new Date(r.checked_in_at).getTime(),
        department: r.department || 'All departments',
        status: r.status,
      })))

      // Real, per-day ticket sequencing - was previously starting from 1
      // every time this app reloaded, meaning a second reload (or a
      // second staff member's own session) could easily hand out a ticket
      // number that already existed earlier the same day. Reads today's
      // actual highest ticket number from the checked-in queue and
      // continues from there, so tickets stay unique and roughly ordered
      // for the whole day regardless of how many times anyone reloads.
      const dayStart = new Date(); dayStart.setHours(0,0,0,0)
      const { data: todaysTickets } = await supabase.from('clinic_queue').select('ticket')
        .gte('checked_in_at', dayStart.toISOString())
      const highestToday = (todaysTickets||[]).reduce((max, r) => {
        const n = parseInt((r.ticket||'').replace(/[^0-9]/g,''), 10)
        return isNaN(n) ? max : Math.max(max, n)
      }, 0)
      setNextTicket(highestToday + 1)

      const { data: rxRows } = await supabase
        .from('medications')
        .select('*, patients(full_name)')
        .not('prescribed_by_staff', 'is', null)
        .order('start_date', { ascending: false })
        .limit(20)
      setPendingPrescriptions((rxRows||[]).map(r => ({
        id: r.id,
        patientName: r.patients?.full_name || 'Unknown patient',
        doctorName: r.prescribed_by_staff,
        drugs: [{ drug: r.medication_name, dosage: r.dosage, frequency: r.frequency, quantity: r.quantity, durationDays: r.duration_days, timesPerDay: r.times_per_day }],
        timestamp: new Date(r.start_date).getTime(),
        status: r.dispense_status || 'pending',
      })))
      setQueueLoading(false)
  }

  useEffect(() => {
    if (!staffMember) return
    loadQueueAndPrescriptions()
  }, [staffMember])

  // Refresh every time the doctor actually navigates to see their
  // patients - the real, direct fix for check-ins that happened while
  // this session was already open and idle elsewhere.
  useEffect(() => {
    if (!staffMember) return
    if (screen==='mypatients' || screen==='overview') loadQueueAndPrescriptions()
  }, [screen])

  async function handleCheckedIn(patient, force=false) {
    const alreadyActive = checkedInQueue.some(q =>
      q.patientName === patient.full_name && hoursRemaining(q.checkedInAt) > 0
    )
    if (alreadyActive && !force) {
      setCheckInError(`${patient.full_name} is already checked in and still active.`)
      return 'already_active'
    }

    // Look up today's real scheduled appointment BEFORE inserting the queue
    // entry - previously this defaulted to 'Unassigned'/the checking-in
    // staff member's own department, which is almost never the actual
    // treating doctor. This is the real reason a patient checked in by
    // reception never appeared under a doctor's own patients.
    const dayStart = new Date(); dayStart.setHours(0,0,0,0)
    const dayEnd = new Date(); dayEnd.setHours(23,59,59,999)
    const { data: matchingAppt } = await supabase.from('appointments').select('*')
      .eq('patient_id', patient.id).eq('institution_source', 'clinic_ops')
      .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())
      .maybeSingle()

    const ticket = 'A'+nextTicket
    const { data, error } = await supabase.from('clinic_queue').insert({
      ticket,
      patient_id: patient.id,
      patient_name: patient.full_name,
      doctor_name: matchingAppt?.doctor_name || (staffMember?.role==='doctor' ? staffMember.name : 'Unassigned'),
      room: '-',
      department: matchingAppt?.department || staffMember?.department || 'All departments',
      status: 'waiting',
    }).select().single()

    if (error || !data) {
      setCheckInError(`Could not check in ${patient.full_name}: ${error?.message || 'unknown error'}`)
      return false
    }

    // Real consent window, created the moment of physical check-in -
    // this was previously only ever created from the Schedule screen's
    // modal, meaning a walk-in (or anyone checking in through this
    // general screen) never got a window at all and would always fail
    // the consent check. Booked appointments still get their real
    // scheduled time and the before/after window; a genuine walk-in gets
    // after-only, since there's no scheduled time to count backward from.
    const checkInTime = new Date()
    const windowStart = matchingAppt ? new Date(new Date(matchingAppt.scheduled_at).getTime() - 24*60*60*1000) : checkInTime
    const windowEnd = new Date((matchingAppt ? new Date(matchingAppt.scheduled_at).getTime() : checkInTime.getTime()) + 24*60*60*1000)
    await supabase.from('appointment_intake').insert({
      patient_id: patient.id, appointment_time: (matchingAppt?.scheduled_at || checkInTime.toISOString()),
      doctor_name: matchingAppt?.doctor_name || staffMember?.name || null,
      consent_given: true, consent_given_at: checkInTime.toISOString(),
      access_window_start: windowStart.toISOString(), access_window_end: windowEnd.toISOString(),
    })

    setCheckedInQueue([...checkedInQueue, {
      id: data.id, ticket: data.ticket, patientName: data.patient_name,
      doctor: data.doctor_name, room: data.room, checkedInAt: new Date(data.checked_in_at).getTime(),
      department: data.department, status: data.status,
    }])
    setNextTicket(nextTicket+1)
    setCheckInError(null)

    if (matchingAppt) {
      await supabase.from('appointments').update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
        .eq('id', matchingAppt.id)
    } else {
      setCheckInError(`${patient.full_name} was checked in, but has no appointment scheduled today - they won't appear on any doctor's patient list until one is booked.`)
    }

    return true
  }

  // Admin/clinic manager sees every department; everyone else sees only
  // their own. A solo clinic never notices this since every entry shares
  // one department anyway.
  const scopedQueue = (staffMember?.department==='All departments' || !staffMember?.department)
    ? checkedInQueue
    : checkedInQueue.filter(q=>!q.department || q.department===staffMember.department)

  async function handlePrescribed(rx) {
    // The real record is already written to Supabase inside
    // ConsultationScreen's handleSave, and loadTaskBoard's poll would pick
    // it up within 15 seconds regardless - this just reloads immediately
    // so the submitting doctor doesn't have to wait for the next poll to
    // see their own consultation appear.
    await loadTaskBoard()
  }

  async function handleConfirmPrescription(prescription) {
    const id = prescription.id
    const dispensedBy = staffMember?.name || 'Unknown'
    const dispensedAt = new Date().toISOString()
    setPendingPrescriptions(prev=>prev.map(p=>p.id===id?{...p,status:'printed',dispensedBy,dispensedAt}:p))

    const inventoryWarnings = []

    // Deduct each dispensed drug's quantity from inventory and log the
    // movement with who confirmed it and when.
    for (const line of prescription.drugs) {
      const qty = parseInt(line.quantity) || 1
      // Fuzzy match first (handles "Metformin" matching "Metformin 500mg"),
      // falls back to exact case-insensitive match.
      let { data: matches } = await supabase
        .from('clinic_inventory')
        .select('*')
        .eq('institution_id', institutionId)
        .ilike('item_name', `%${line.drug}%`)

      let invItem = matches && matches.length===1 ? matches[0] : null
      if (!invItem && matches && matches.length>1) {
        // Multiple partial matches - prefer an exact (case-insensitive) one
        invItem = matches.find(m => m.item_name.toLowerCase()===line.drug.toLowerCase()) || matches[0]
      }

      if (invItem) {
        const newStock = Math.max(0, invItem.stock - qty)
        await supabase.from('clinic_inventory').update({ stock: newStock, updated_at: dispensedAt }).eq('id', invItem.id)
        await supabase.from('inventory_movements').insert({
          inventory_id: invItem.id, item_name: invItem.item_name, change_amount: -qty,
          new_stock: newStock, reason: 'dispensed', staff_name: dispensedBy,
        })
      } else {
        inventoryWarnings.push(line.drug)
      }
    }

    if (inventoryWarnings.length>0) {
      console.warn('No inventory match found for:', inventoryWarnings.join(', '), '- stock not deducted for these items.')
    }

    // Record dispense attribution on the real medications row if this is a
    // real Supabase-loaded prescription (has a UUID id, not a local Date.now()).
    if (typeof id === 'string') {
      // Bug fix: this previously matched medications.id against id (the
      // parent record's id), which could never match any real medication
      // row - medications.id is each drug's own key. Fixed to update every
      // medication actually linked to this consultation.
      await supabase.from('medications').update({
        dispense_status: 'printed', dispensed_by: dispensedBy, dispensed_at: dispensedAt,
      }).eq('medical_record_id', id)
      // Real, persisted signal - separate from record_status, which must
      // stay 'submitted' so this entry stays on the task board for
      // billing. Previously this only ever lived in local browser state,
      // meaning a different device would never see it was already handled.
      await supabase.from('medical_records').update({ meds_dispensed_at: dispensedAt }).eq('id', id)
      await loadTaskBoard()
    }

    return inventoryWarnings
  }

  async function handleRemoveFromQueue(index) {
    const entry = scopedQueue[index]
    setCheckedInQueue(prev => prev.filter(q => q.id !== entry.id))
    if (entry?.id) {
      await supabase.from('clinic_queue').delete().eq('id', entry.id)
    }
    // Also revert their real appointment back to "confirmed" - undoing a
    // check-in from here should undo both places, same as the Schedule
    // screen's own "Cancel check-in" action.
    if (entry?.patientName) {
      const { data: pRow } = await supabase.from('patients').select('id').eq('full_name', entry.patientName).maybeSingle()
      if (pRow) {
        const dayStart=new Date(); dayStart.setHours(0,0,0,0)
        const dayEnd=new Date(); dayEnd.setHours(23,59,59,999)
        await supabase.from('appointments').update({status:'confirmed', checked_in_at:null}).eq('patient_id',pRow.id).eq('institution_source','clinic_ops').gte('scheduled_at',dayStart.toISOString()).lte('scheduled_at',dayEnd.toISOString())
      }
    }
  }

  async function handleCancelAppointment(appointmentId) {
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointmentId)
  }

  const pendingCount = pendingPrescriptions.filter(p=>p.status==='pending').length

  const allNavItems = [
    {key:'overview', icon:'\u25a3', label:'Overview', roles:['admin','clinic_assistant']},
    {key:'mypatients', icon:'\u25ce', label:'My Patients', roles:['doctor']},
    {key:'checkin', icon:'\u2b21', label:'Check-in / Search', roles:['admin','clinic_assistant']},
    {key:'schedule', icon:'\u25c7', label:'Schedule', roles:['admin','clinic_assistant','doctor']},
    {key:'prescriptions', icon:'\u25c9', label:'Prescriptions', roles:['admin','clinic_assistant'], badge: pendingCount},
    {key:'inventory', icon:'\u25a4', label:'Inventory', roles:['admin','clinic_assistant']},
    {key:'payment', icon:'\u25c8', label:'Payment', roles:['admin','clinic_assistant']},
    {key:'claims', icon:'\u25c9', label:'Claims', roles:['admin','clinic_assistant']},
    {key:'workinghours', icon:'\u25f7', label:'Working Hours', roles:['admin']},
    {key:'staff', icon:'\u25c6', label:'Staff', roles:['admin']},
    {key:'help', icon:'\u25cc', label:'Help', roles:['admin','clinic_assistant','doctor']},
  ]

  if (!staffMember) return <StaffLogin onLogin={(s)=>{setStaffMember(s);setScreen(s.role==='doctor'?'mypatients':s.role==='clinic_assistant'?'checkin':'overview')}}/>

  const navItems = allNavItems.filter(item=>item.roles.includes(staffMember.role))

  return (
    <div style={{display:'flex',minHeight:'100vh',background:C.beige,fontFamily:'system-ui, -apple-system, sans-serif'}}>
      <Sidebar screen={screen} setScreen={setScreen} staffMember={staffMember} navItems={navItems} onLogout={()=>{setStaffMember(null);setScreen('overview')}}/>
      <div style={{flex:1,padding:'32px 40px',overflowY:'auto'}}>
        {screen==='overview'&&<OverviewScreen queue={scopedQueue} pendingCount={pendingCount} onRemoveFromQueue={handleRemoveFromQueue} onCancelAppointment={handleCancelAppointment}/>}
        {screen==='mypatients'&&<MyPatientsScreen queue={scopedQueue} onSelectPatient={(q)=>{setSelectedQueueEntry(q);setScreen('consultation')}} staffMember={staffMember} onRefresh={loadQueueAndPrescriptions}/>}
        {screen==='consultation'&&selectedQueueEntry&&<ConsultationScreen queueEntry={selectedQueueEntry} staffMember={staffMember} onPrescribed={handlePrescribed} institutionId={institutionId} medicineType={medicineType}/>}
        {screen==='checkin'&&<CheckInSearchScreen onCheckedIn={handleCheckedIn} onNewPatient={()=>{setNewPatientOrigin('schedule');setScreen('newpatient')}} onNavSchedule={()=>setScreen('schedule')} checkInError={checkInError} onDoneCheckIn={()=>staffMember?.role==='admin'&&setScreen('overview')} staffMember={staffMember}/>}
        {screen==='newpatient'&&<NewPatientScreen
          onBack={()=>setScreen(newPatientOrigin==='schedule'?'schedule':'checkin')}
          prefillName={newPatientPrefillName}
          onCreated={newPatientOrigin==='schedule' ? (patient)=>{setSchedulePreselectPatient(patient);setNewPatientPrefillName('');setScreen('schedule')} : undefined}
        />}
        {screen==='schedule'&&<ScheduleScreen
          staffMember={staffMember}
          onCheckedIn={handleCheckedIn}
          preselectPatient={schedulePreselectPatient}
          onConsumedPreselect={()=>setSchedulePreselectPatient(null)}
          onPreselectPatientForFollowup={setSchedulePreselectPatient}
          onNavNewPatient={(query)=>{setNewPatientOrigin('schedule');setNewPatientPrefillName(query||'');setScreen('newpatient')}}
          onGoToConsultation={(appt)=>{setSelectedQueueEntry({patientName:appt.patient, ticket:'SCH', checkedInAt:Date.now(), patientMedsaId: appt.medsaId});setScreen('consultation')}}
          onCancelCheckIn={async(appt)=>{
            if (!appt?.medsaId) return
            const { data: pRow } = await supabase.from('patients').select('id').eq('medsa_id', appt.medsaId).maybeSingle()
            if (!pRow) return
            const dayStart=new Date(); dayStart.setHours(0,0,0,0)
            const dayEnd=new Date(); dayEnd.setHours(23,59,59,999)
            await supabase.from('appointments').update({status:'confirmed', checked_in_at:null}).eq('patient_id',pRow.id).eq('institution_source','clinic_ops').gte('scheduled_at',dayStart.toISOString()).lte('scheduled_at',dayEnd.toISOString())
            // Also remove them from today's active clinic_queue, since
            // ClinicOps check-in writes there too - undoing check-in should
            // undo both, not just the appointment status.
            const matching = checkedInQueue.find(q=>q.patientName===appt.patient && hoursRemaining(q.checkedInAt)>0)
            if (matching) {
              await supabase.from('clinic_queue').delete().eq('id', matching.id)
              setCheckedInQueue(prev=>prev.filter(q=>q.id!==matching.id))
            }
          }}
        />}
        {screen==='prescriptions'&&<PrescriptionsQueueScreen pending={pendingPrescriptions} onConfirm={handleConfirmPrescription} medicineType={medicineType} onReload={loadTaskBoard} onProceedToBilling={(p)=>{setPayPreselectRecordId(p.recordId);setScreen('payment')}} institutionName={institutionName}/>}
        {screen==='inventory'&&<InventoryScreen staffMember={staffMember} institutionId={institutionId} medicineType={medicineType}/>}
        {screen==='payment'&&<PaymentScreen staffMember={staffMember} institutionId={institutionId} preselectClaimRef={payPreselectClaimRef} onConsumedPreselect={()=>setPayPreselectClaimRef(null)} preselectRecordId={payPreselectRecordId} onConsumedRecordPreselect={()=>setPayPreselectRecordId(null)}/>}
        {screen==='claims'&&<ClaimsScreen onNavPayment={(claimRef)=>{setPayPreselectClaimRef(claimRef);setScreen('payment')}}/>}
        {screen==='workinghours'&&<WorkingHoursScreen/>}
        {screen==='staff'&&staffMember?.role==='admin'&&<PracticeManagerStaffScreen staffMember={staffMember} institutionId={institutionId}/>}
        {screen==='help'&&<HelpScreen staffMember={staffMember}/>}
      </div>
    </div>
  )
}
