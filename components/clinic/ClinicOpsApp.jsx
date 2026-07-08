import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
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
function Badge({ text, type }) {
  const map={ok:[C.greenLight,C.green],due:[C.amberLight,C.amber],full:[C.redLight,C.red],waiting:[C.blueLight,C.blue]}
  const [bg,fg]=map[type]||map.ok
  return <span style={{fontSize:'11px',background:bg,color:fg,padding:'4px 10px',borderRadius:'20px',fontWeight:500,whiteSpace:'nowrap'}}>{text}</span>
}
function PageWrap({ children, maxWidth=720 }) {
  return <div style={{maxWidth, margin:'0 auto', width:'100%'}}>{children}</div>
}

function hoursRemaining(checkedInAt) {
  const elapsed = Date.now() - checkedInAt
  const remaining = 24*60*60*1000 - elapsed
  return Math.max(0, remaining / (60*60*1000))
}

function StaffLogin({ onLogin }) {
  const staff = [
    {id:1, name:'Dr Chan Siu-ming', role:'doctor', roleLabel:'Doctor', color:C.green, department:'Internal Medicine'},
    {id:2, name:'Dr Lam Wai-yee', role:'doctor', roleLabel:'Doctor', color:C.green, department:'Cardiology'},
    {id:3, name:'Yip Mei', role:'frontdesk', roleLabel:'Nurse / Front Desk', color:C.blue, department:'Internal Medicine'},
    {id:4, name:'Wong Siu-fan', role:'frontdesk', roleLabel:'Nurse / Front Desk', color:C.blue, department:'Cardiology'},
    {id:5, name:'Chan Ka-yee (Owner)', role:'admin', roleLabel:'Clinic Manager', color:C.purple, department:'All departments'},
  ]
  // For a solo clinic every staff member effectively shares one department -
  // this list only needs to grow when Medsa is deployed at a multi-department
  // institution. Admin/clinic manager always sees every department.
  const departments = ['Internal Medicine','Cardiology','Paediatrics','Dermatology']
  const [pin,setPin]=useState('')
  const [selected,setSelected]=useState(null)
  const [stage,setStage]=useState('pick') // pick | pin | department
  const [chosenDept,setChosenDept]=useState(null)

  function handlePinConfirm() {
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
        {stage==='pick'&&(
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
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
            <input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="PIN" maxLength={4}
              style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px',fontSize:'18px',textAlign:'center',letterSpacing:'8px',marginBottom:'14px',boxSizing:'border-box'}}/>
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1}} onClick={()=>{setSelected(null);setPin('');setStage('pick')}}>Back</Btn>
              <Btn variant="primary" style={{flex:1}} onClick={handlePinConfirm}>Sign in</Btn>
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

function CheckInSearchScreen({ onCheckedIn, onNewPatient, onNavSchedule }) {
  const [mode,setMode]=useState('scan')
  const [stage,setStage]=useState('idle')
  const [patient,setPatient]=useState(null)
  const [searchTerm,setSearchTerm]=useState('')
  const [searchResult,setSearchResult]=useState(null)
  const [requestSent,setRequestSent]=useState(false)
  const [checkingIn,setCheckingIn]=useState(false)

  function handleCheckInClick() {
    if (checkingIn) return // guard against rapid repeat clicks
    setCheckingIn(true)
    onCheckedIn(patient)
    // stage resets when this component unmounts/remounts on nav away, but
    // guard stays true so a slow double-click can't fire a second check-in
  }

  async function simulateScan() {
    setStage('scanning')
    const { data, error } = await supabase.from('patients').select('*').eq('medsa_id','MDS-84921-HK').single()
    if (error || !data) { setStage('error'); return }
    setPatient(data)
    setStage('found')
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
  }

  return (
    <PageWrap maxWidth={560}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Check-In / Search</h2>

      <div style={{display:'flex',gap:'8px',marginBottom:'20px',justifyContent:'center'}}>
        {[['scan','Scan to check in'],['search','Search patients']].map(([k,l])=>(
          <div key={k} onClick={()=>setMode(k)} style={{fontSize:'13px',padding:'9px 18px',borderRadius:'20px',cursor:'pointer',background:mode===k?C.green:C.card,color:mode===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>

      {mode==='scan'&&<>
        {stage==='idle'&&<>
          <div onClick={simulateScan} style={{background:C.cream,border:`1.5px dashed ${C.border}`,borderRadius:'14px',padding:'44px 20px',textAlign:'center',cursor:'pointer',marginBottom:'16px'}}>
            <div style={{fontSize:'36px',color:C.green,marginBottom:'10px'}}>{'\u2b21'}</div>
            <div style={{fontSize:'15px',fontWeight:600,marginBottom:'4px'}}>Scan patient QR code</div>
            <div style={{fontSize:'12px',color:C.textSub}}>Checks the patient in - their consented records become visible for the next 24 hours</div>
          </div>
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
          <div style={{display:'flex',gap:'10px'}}>
            <Btn onClick={()=>setStage('idle')} disabled={checkingIn}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCheckInClick} disabled={checkingIn}>{checkingIn?'Checking in...':'Check in patient'}</Btn>
          </div>
          {checkingIn&&<div style={{marginTop:'10px',fontSize:'12px',color:C.green,textAlign:'center'}}>{'\u2713'} {patient.full_name} checked in - redirecting...</div>}
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
        {searchResult&&<Card style={{padding:'20px'}}>
          <div style={{fontSize:'17px',fontWeight:700}}>{searchResult.full_name}</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>{searchResult.medsa_id} - DOB {new Date(searchResult.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
          <div style={{display:'flex',gap:'10px',marginBottom:'10px'}}>
            <Btn variant="primary" style={{flex:1}} onClick={()=>onCheckedIn(searchResult)}>Check in now</Btn>
            <Btn style={{flex:1}} onClick={onNavSchedule}>Schedule instead</Btn>
          </div>
          {!requestSent&&<Btn style={{width:'100%'}} onClick={()=>setRequestSent(true)}>Request record access ahead of visit</Btn>}
          {requestSent&&<div style={{marginTop:'10px',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:C.amber}}>{'\u25c7'} Request sent to patient for approval. Records will be available here once granted, ahead of check-in.</div>}
        </Card>}
        {searched&&!searchResult&&<div style={{textAlign:'center',padding:'20px'}}>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'10px'}}>No patient found matching "{searchTerm}".</div>
          <span onClick={onNewPatient} style={{fontSize:'13px',color:C.green,fontWeight:600,cursor:'pointer'}}>Register them as a new patient {'\u2192'}</span>
        </div>}
      </>}
    </PageWrap>
  )
}

function NewPatientScreen({ onBack }) {
  const [form,setForm]=useState({fullName:'',dob:'',phone:'',hkid:''})
  const [saving,setSaving]=useState(false)
  const [submitted,setSubmitted]=useState(false)
  const [error,setError]=useState(null)

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      const medsaId = 'MDS-' + Math.floor(10000+Math.random()*89999) + '-HK'
      const { error: insErr } = await supabase.from('patients').insert({
        medsa_id: medsaId,
        full_name: form.fullName,
        date_of_birth: form.dob,
        hkid: form.hkid || null,
        phone: form.phone || null,
        emergency_card_consent: false,
        emergency_card_active: false,
      })
      if (insErr) throw insErr
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
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.6}}>A Medsa profile has been created for {form.fullName || 'this patient'}. If they later download the Medsa app and register with matching details, their full record and this visit will sync automatically.</div>
        <Btn variant="primary" onClick={onBack}>Back to check-in</Btn>
      </div>
    </PageWrap>
  )

  return (
    <PageWrap maxWidth={480}>
      <div onClick={onBack} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'16px'}}>{'\u2190'} Back</div>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Register New Patient</h2>
      <div style={{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'16px'}}>
        <input value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} placeholder="Full name" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} placeholder="Date of birth (YYYY-MM-DD)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.hkid} onChange={e=>setForm({...form,hkid:e.target.value})} placeholder="HKID (optional)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone number" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
      </div>
      <div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'10px',padding:'12px 14px',fontSize:'12px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>
        {'\u25c7'} This creates a placeholder Medsa profile so today's visit is on record. The patient owns and completes their own profile once they register with Medsa themselves.
      </div>
      {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
      <Btn variant="primary" style={{width:'100%'}} onClick={handleSubmit} disabled={saving||!form.fullName||!form.dob}>{saving?'Saving...':'Create Medsa profile'}</Btn>
    </PageWrap>
  )
}

function MyPatientsScreen({ queue, onSelectPatient }) {
  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>My Patients</h2>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {queue.length===0&&<div style={{textAlign:'center',padding:'60px 20px',color:C.textMuted,fontSize:'13px'}}>No patients checked in yet today.</div>}
        {queue.map((q,i)=>{
          const hrsLeft = hoursRemaining(q.checkedInAt)
          return (
            <Card key={i} onClick={()=>onSelectPatient(q)} style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:'14px'}}>
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
    </PageWrap>
  )
}

function ConsultationScreen({ queueEntry, staffMember, onPrescribed }) {
  const [patient,setPatient]=useState(null)
  const [records,setRecords]=useState([])
  const [conditions,setConditions]=useState([])
  const [allergies,setAllergies]=useState([])
  const [loading,setLoading]=useState(true)
  const [notes,setNotes]=useState('')
  const [diagnosis,setDiagnosis]=useState('')
  const [prescriptions,setPrescriptions]=useState([{drug:'',dosage:'',frequency:'',quantity:'',durationDays:'',timesPerDay:''}])
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState(null)
  const [showReferral,setShowReferral]=useState(false)
  const [referralNote,setReferralNote]=useState('')
  const [referralSearch,setReferralSearch]=useState('')
  const [referralSent,setReferralSent]=useState(false)
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
      const { data: p } = await supabase.from('patients').select('*').eq('medsa_id','MDS-84921-HK').single()
      if (p) {
        setPatient(p)
        const [{data:r},{data:c},{data:a}] = await Promise.all([
          supabase.from('medical_records').select('*,institutions(name)').eq('patient_id',p.id).order('date_of_record',{ascending:false}),
          supabase.from('conditions').select('*').eq('patient_id',p.id).eq('active',true),
          supabase.from('allergies').select('*').eq('patient_id',p.id),
        ])
        setRecords(r||[]); setConditions(c||[]); setAllergies(a||[])
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
      // Auto-suggest quantity whenever duration or times-per-day changes,
      // but never override a quantity the doctor has manually typed in.
      if ((field==='durationDays'||field==='timesPerDay') && !p.quantityManuallySet) {
        const days = parseInt(field==='durationDays'?value:updated.durationDays) || 0
        const times = parseInt(field==='timesPerDay'?value:updated.timesPerDay) || 0
        if (days>0 && times>0) updated.quantity = String(days*times)
      }
      if (field==='quantity') updated.quantityManuallySet = true
      return updated
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const rxRows = prescriptions.filter(p=>p.drug.trim())
      if (rxRows.length>0 && patient) {
        const dbRows = rxRows.map(p=>({
          patient_id: patient.id, medication_name: p.drug, dosage: p.dosage, frequency: p.frequency,
          quantity: parseInt(p.quantity)||1,
          duration_days: parseInt(p.durationDays)||null,
          times_per_day: parseInt(p.timesPerDay)||null,
          active: true, on_emergency_card: false, start_date: new Date().toISOString().slice(0,10),
          prescribed_by_staff: staffMember?.name || 'Unknown', dispense_status: 'pending',
        }))
        const { error: insErr } = await supabase.from('medications').insert(dbRows)
        if (insErr) throw insErr
      }
      if ((diagnosis.trim()||notes.trim()) && patient) {
        const { error: recErr } = await supabase.from('medical_records').insert({
          patient_id: patient.id, record_type: 'visit', title: diagnosis || 'Clinic consultation',
          notes: notes || null, diagnosis: diagnosis || null,
          date_of_record: new Date().toISOString().slice(0,10), source: 'clinic_ops',
        })
        if (recErr) throw recErr
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

  const hrsLeft = hoursRemaining(queueEntry.checkedInAt)
  const recordsVisible = hrsLeft > 0

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

      {recordsVisible ? <>
        <SecLabel>Medical records - available {Math.floor(hrsLeft)}h more</SecLabel>
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
            {records.slice(0,5).map((r,i)=>{
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
                    {!requested?<Btn style={{fontSize:'11px',padding:'6px 12px'}} onClick={()=>setReportRequests({...reportRequests,[i]:true})}>Request full/detailed report</Btn>
                      :<div style={{fontSize:'11px',color:C.amber}}>{'\u25c7'} Requested from {r.institutions?.name||'originating provider'} - patient will be notified to approve release of the complete report.</div>}
                  </div>}
                </Card>
              )
            })}
          </div>
        </div>}
      </> : <div style={{background:C.card,borderRadius:'10px',padding:'14px',fontSize:'12px',color:C.textMuted,textAlign:'center',marginBottom:'20px'}}>24-hour record access has expired for this visit. Request renewed access from Check-in / Search.</div>}

      <SecLabel>Diagnosis</SecLabel>
      <input value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} placeholder="e.g. Upper respiratory tract infection" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'18px'}}/>

      <SecLabel>Consultation notes</SecLabel>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} placeholder="Clinical findings, examination notes, follow-up plan..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'18px',fontFamily:'inherit',resize:'vertical'}}/>

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
                  onBlur={()=>setTimeout(()=>setSuggestOpen(null),150)}
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

            {/* Doctor-friendly duration control - times/day x days auto-suggests quantity */}
            <div style={{display:'flex',gap:'8px',alignItems:'center',marginTop:'6px',background:C.card,borderRadius:'8px',padding:'8px 10px'}}>
              <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>Times/day</span>
              <div style={{display:'flex',gap:'4px'}}>
                {[1,2,3,4].map(n=>(
                  <div key={n} onClick={()=>updateRx(i,'timesPerDay',String(n))} style={{width:26,height:26,borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',cursor:'pointer',background:String(rx.timesPerDay)===String(n)?C.green:'#fff',color:String(rx.timesPerDay)===String(n)?'#fff':C.text,border:`0.5px solid ${C.border}`}}>{n}</div>
                ))}
              </div>
              <span style={{fontSize:'11px',color:C.textSub,flexShrink:0,marginLeft:'8px'}}>for</span>
              <input value={rx.durationDays} onChange={e=>updateRx(i,'durationDays',e.target.value)} type="number" placeholder="days" style={{width:56,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'5px 8px',fontSize:'12px',boxSizing:'border-box'}}/>
              <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>days</span>
              <div style={{flex:1}}/>
              <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>Qty</span>
              <input value={rx.quantity} onChange={e=>updateRx(i,'quantity',e.target.value)} placeholder="0" type="number" style={{width:56,flexShrink:0,border:`0.5px solid ${rx.quantity&&!rx.quantityManuallySet?C.green:C.border}`,borderRadius:'6px',padding:'5px 8px',fontSize:'12px',boxSizing:'border-box'}}/>
              {rx.quantity&&!rx.quantityManuallySet&&<span style={{fontSize:'10px',color:C.green}}>auto</span>}
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
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>Attach a case note and search your affiliated network or Medsa's directory for a specialist to refer to.</div>
        <textarea value={referralNote} onChange={e=>setReferralNote(e.target.value)} rows={3} placeholder="Case summary for the receiving doctor..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'10px',fontFamily:'inherit',resize:'vertical'}}/>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          <input value={referralSearch} onChange={e=>setReferralSearch(e.target.value)} placeholder="Search by name, specialty, or clinic..." style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          <Btn style={{flexShrink:0,fontSize:'12px'}}>Import affiliated doctors (CSV)</Btn>
        </div>
        {referralSearch.trim()&&<div style={{background:C.card,borderRadius:'8px',padding:'10px',marginBottom:'10px'}}>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Nearby on Medsa</div>
          <div style={{fontSize:'13px',padding:'4px 0'}}>Dr Lam Wai-yee - Cardiologist - HK Sanatorium</div>
        </div>}
        <div style={{display:'flex',gap:'8px'}}>
          <Btn onClick={()=>{setShowReferral(false);setReferralNote('');setReferralSearch('')}}>Cancel</Btn>
          <Btn variant="primary" onClick={()=>setReferralSent(true)}>Send referral</Btn>
        </div>
      </Card>}
      {referralSent&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'12px 14px',fontSize:'12px',color:C.green,marginBottom:'20px'}}>
        {'\u2713'} Referral sent with case note attached. The receiving doctor will see this patient's consented records once they accept.
      </div>}

      {error&&<div style={{fontSize:'13px',color:C.red,marginBottom:'12px'}}>{error}</div>}
      <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving?'Saving...':'Save consultation'}</Btn>
    </PageWrap>
  )
}

// ── LABEL STICKER — one editable sticker per drug in a prescription ─────────
// Pulls effects/intake/precautions from the drug_reference library if a
// previous nurse/doctor already filled them in for this drug. If not, the
// fields are empty and editable — saving here writes back to the shared
// reference so it auto-populates next time this same drug is prescribed.
function LabelSticker({ patientName, doctorName, drug, onFieldsChange }) {
  const [effects,setEffects]=useState('')
  const [intake,setIntake]=useState('')
  const [precautions,setPrecautions]=useState('')
  const [loading,setLoading]=useState(true)
  const [hasReference,setHasReference]=useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('drug_reference').select('*').eq('drug_name', drug.drug).maybeSingle()
      if (data) {
        setEffects(data.effects||''); setIntake(data.intake_info||''); setPrecautions(data.precautions||'')
        setHasReference(true)
      }
      setLoading(false)
    }
    load()
  }, [drug.drug])

  useEffect(() => {
    onFieldsChange({ effects, intake, precautions })
  }, [effects, intake, precautions])

  return (
    <div style={{background:'#fff',border:`1.5px dashed ${C.border}`,borderRadius:'10px',padding:'14px',marginBottom:'10px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
        <div>
          <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.5px'}}>Medsa Clinic - Pacific Medical Group</div>
          <div style={{fontSize:'14px',fontWeight:700}}>{drug.drug} {drug.dosage}</div>
          <div style={{fontSize:'12px',color:C.textSub}}>{patientName} - Prescribed by {doctorName}</div>
        </div>
        {hasReference&&!loading&&<Badge text="From library" type="ok"/>}
      </div>
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

function PrescriptionsQueueScreen({ pending, onConfirm }) {
  const [printingId,setPrintingId]=useState(null)
  const [openLabelId,setOpenLabelId]=useState(null)
  const [editedFields,setEditedFields]=useState({}) // drugIndex -> {effects,intake,precautions}
  const [inventoryWarning,setInventoryWarning]=useState(null)

  async function handleConfirm(p) {
    setPrintingId(p.id)
    setInventoryWarning(null)
    // Save/update the drug reference library with whatever is currently in
    // each label's fields - this is what makes it "automated" next time.
    for (let idx=0; idx<p.drugs.length; idx++) {
      const drug = p.drugs[idx]
      const fields = editedFields[idx]
      if (fields && (fields.effects||fields.intake||fields.precautions)) {
        await supabase.from('drug_reference').upsert({
          drug_name: drug.drug, effects: fields.effects, intake_info: fields.intake,
          precautions: fields.precautions, updated_by: p.doctorName, updated_at: new Date().toISOString(),
        }, { onConflict: 'drug_name' })
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

  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Prescriptions</h2>
      {inventoryWarning&&<div style={{background:C.redLight,border:`0.5px solid ${C.red}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:C.red}}>{'\u26a0'} {inventoryWarning}</div>}
      {waiting.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px',marginBottom:'20px'}}>No pending prescriptions right now.</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'28px'}}>
        {waiting.map(p=>{
          const isOpen = openLabelId===p.id
          return (
          <Card key={p.id} style={{padding:'16px 18px',border:`1.5px solid ${C.amber}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:700}}>{p.patientName}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>Prescribed by {p.doctorName} - {new Date(p.timestamp).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <Badge text="New" type="due"/>
            </div>
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
            </Card>
          ))}
        </div>
      </>}
    </PageWrap>
  )
}

function OverviewScreen({ queue, pendingCount, onRemoveFromQueue }) {
  const inRoom = queue.length

  return (
    <PageWrap maxWidth={720}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Overview</h2>
      <div style={{display:'flex',gap:'12px',marginBottom:'24px'}}>
        <StatCard label="Checked in today" value={inRoom} sub="patients" color={C.blue} bg={C.blueLight}/>
        <StatCard label="Pending prescriptions" value={pendingCount} sub="awaiting front desk" color={C.amber} bg={C.amberLight}/>
        <StatCard label="Today's revenue" value="HK$4,820" sub="12 consultations" color={C.green} bg={C.greenLight}/>
      </div>
      <SecLabel>Checked-in patients</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {queue.map((q,i)=>{
          const hrsLeft = hoursRemaining(q.checkedInAt)
          return (
            <Card key={i} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{width:32,height:32,borderRadius:'8px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,flexShrink:0}}>{q.ticket}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:500}}>{q.patientName}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{q.doctor}</div>
              </div>
              <Badge text={hrsLeft>0?`${Math.floor(hrsLeft)}h left`:'Expired'} type={hrsLeft>0?'ok':'full'}/>
              {onRemoveFromQueue&&<span onClick={()=>onRemoveFromQueue(i)} style={{fontSize:'11px',color:C.red,cursor:'pointer',marginLeft:'4px'}}>Remove</span>}
            </Card>
          )
        })}
      </div>
    </PageWrap>
  )
}

function ScheduleScreen() {
  const [selectedDay,setSelectedDay]=useState(24)
  const [showNewApptForm,setShowNewApptForm]=useState(false)
  const appointments = [
    {time:'09:00', patient:'Wong Mei-ling, Lisa', doctor:'Dr Chan', type:'Follow-up', status:'confirmed'},
    {time:'09:30', patient:'Chan Tai-man', doctor:'Dr Lam', type:'New patient', status:'confirmed'},
    {time:'10:00', patient:'-', doctor:'Dr Chan', type:'Open slot', status:'open'},
    {time:'10:30', patient:'Lee Siu-fong', doctor:'Dr Chan', type:'Vaccination', status:'confirmed'},
    {time:'11:00', patient:'Ho Ka-yee', doctor:'Dr Lam', type:'Consultation', status:'confirmed'},
    {time:'14:00', patient:'Yip Wing-sze', doctor:'Dr Chan', type:'Follow-up', status:'pending'},
  ]
  return (
    <PageWrap maxWidth={640}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h2 style={{fontSize:'20px',fontWeight:700}}>Schedule</h2>
        <Btn variant="primary" onClick={()=>setShowNewApptForm(true)}>+ New appointment</Btn>
      </div>
      <Card style={{padding:'16px',marginBottom:'20px'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'12px'}}>June 2026</div>
        <div style={{display:'flex',gap:'8px'}}>
          {[22,23,24,25,26,27,28].map(d=>(
            <div key={d} onClick={()=>setSelectedDay(d)} style={{flex:1,textAlign:'center',padding:'10px',borderRadius:'8px',background:d===selectedDay?C.green:C.card,color:d===selectedDay?'#fff':C.text,cursor:'pointer'}}>
              <div style={{fontSize:'16px',fontWeight:600}}>{d}</div>
            </div>
          ))}
        </div>
      </Card>
      <SecLabel>All doctors - today</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {appointments.map((a,i)=>(
          <Card key={i} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',opacity:a.status==='open'?0.6:1}}>
            <div style={{fontSize:'13px',fontWeight:700,width:48,flexShrink:0}}>{a.time}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'13px',fontWeight:500}}>{a.patient}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{a.doctor} - {a.type}</div>
            </div>
            {a.status==='open'?<Btn style={{fontSize:'12px',padding:'6px 12px'}} onClick={()=>setShowNewApptForm(true)}>+ Book</Btn>:<Badge text={a.status==='confirmed'?'Confirmed':'Pending'} type={a.status==='confirmed'?'ok':'due'}/>}
          </Card>
        ))}
      </div>
      {showNewApptForm&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowNewApptForm(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:400,padding:'24px'}}>
          <div style={{fontSize:'16px',fontWeight:700,marginBottom:'16px'}}>New appointment</div>
          <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px',fontSize:'14px',marginBottom:'10px',boxSizing:'border-box'}} placeholder="Patient name or Medsa ID"/>
          <div style={{display:'flex',gap:'8px',marginBottom:'14px'}}>
            <input style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px',fontSize:'14px',boxSizing:'border-box'}} placeholder="Time"/>
            <select style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px',fontSize:'14px'}}><option>Dr Chan</option><option>Dr Lam</option></select>
          </div>
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>setShowNewApptForm(false)}>Confirm booking</Btn>
        </div>
      </div>}
    </PageWrap>
  )
}

function PaymentScreen() {
  const [tab,setTab]=useState('collect')
  const [method,setMethod]=useState('card')
  const [paid,setPaid]=useState(false)
  const [receiptSent,setReceiptSent]=useState(false)
  const [printed,setPrinted]=useState(false)
  const [treatmentPlans,setTreatmentPlans]=useState([])
  const [plansLoading,setPlansLoading]=useState(true)
  const bill = {patient:'Wong Mei-ling, Lisa', consultFee:380, insurerCovers:300, patientPays:80}

  useEffect(() => {
    async function load() {
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
    load()
  }, [])

  if (tab==='plans') return (
    <PageWrap maxWidth={640}>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px',justifyContent:'center'}}>
        {[['collect','Collect payment'],['plans','Treatment plans']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{fontSize:'13px',padding:'9px 18px',borderRadius:'20px',cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
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
            {p.status==='unpaid_renewal'&&<Btn variant="amber" style={{width:'100%',marginTop:'10px'}}>Send renewal reminder to patient</Btn>}
          </Card>
        ))}
      </div>
    </PageWrap>
  )

  if (paid) return (
    <PageWrap maxWidth={440}>
      <div style={{textAlign:'center',padding:'50px 20px'}}>
        <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Payment received</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'24px'}}>HK${bill.patientPays} - {bill.patient}</div>
        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
          <Btn variant={receiptSent?'secondary':'primary'} onClick={()=>setReceiptSent(true)} disabled={receiptSent}>{receiptSent?"Sent to patient's Medsa app":'Send receipt to Medsa app'}</Btn>
          <Btn onClick={()=>setPrinted(true)} disabled={printed}>{printed?'Printed':'Print receipt'}</Btn>
        </div>
        {receiptSent&&<div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>{'\u25c7'} Receipt, consultation notes, and prescription are now synced to the patient's Medsa cloud record.</div>}
        <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setPaid(false);setReceiptSent(false);setPrinted(false)}}>New payment</Btn>
      </div>
    </PageWrap>
  )

  return (
    <PageWrap maxWidth={440}>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px',justifyContent:'center'}}>
        {[['collect','Collect payment'],['plans','Treatment plans']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{fontSize:'13px',padding:'9px 18px',borderRadius:'20px',cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
      <Card style={{padding:'18px',marginBottom:'16px'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'12px'}}>{bill.patient}</div>
        {[['Consultation fee',`HK$${bill.consultFee}`],['Insurance covers',`-HK$${bill.insurerCovers}`],['Patient pays',`HK$${bill.patientPays}`]].map(([l,v],i)=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:i<2?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}>
            <span style={{color:C.textSub}}>{l}</span>
            <span style={{fontWeight:i===2?700:500,fontSize:i===2?'17px':'13px',color:i===2?C.green:C.text}}>{v}</span>
          </div>
        ))}
        <div style={{marginTop:'10px',paddingTop:'10px',borderTop:`0.5px solid ${C.border}`,fontSize:'11px',color:C.textMuted,lineHeight:1.5}}>
          {'\u25c7'} Direct billing: the insurer-covered portion above is automatically prepared as a claim in Claims once you charge the patient.
        </div>
      </Card>
      <SecLabel>Payment method</SecLabel>
      <div style={{display:'flex',gap:'8px',marginBottom:'18px'}}>
        {[['card','Card','\u25c8'],['octopus','Octopus','\u25c9'],['cash','Cash','\u25ce']].map(([k,l,icon])=>(
          <div key={k} onClick={()=>setMethod(k)} style={{flex:1,padding:'14px 8px',borderRadius:'8px',textAlign:'center',cursor:'pointer',background:method===k?C.green:C.card,color:method===k?'#fff':C.text}}>
            <div style={{fontSize:'18px',marginBottom:'4px'}}>{icon}</div>
            <div style={{fontSize:'12px',fontWeight:500}}>{l}</div>
          </div>
        ))}
      </div>
      <Btn variant="primary" style={{width:'100%',padding:'14px'}} onClick={()=>setPaid(true)}>Charge HK${bill.patientPays}</Btn>
    </PageWrap>
  )
}

function InventoryScreen({ staffMember }) {
  const [items,setItems]=useState([])
  const [loading,setLoading]=useState(true)
  const [showReorderOnly,setShowReorderOnly]=useState(false)
  const [pendingDelta,setPendingDelta]=useState({}) // itemId -> uncommitted delta
  const [confirming,setConfirming]=useState(null)
  const [importResult,setImportResult]=useState(null)

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

  async function handleStockFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const rows = parseCSV(text)
    let imported=0, skipped=0
    for (const row of rows) {
      if (!row.item_name) { skipped++; continue }
      await supabase.from('clinic_inventory').upsert({
        item_name: row.item_name, stock: parseInt(row.stock)||0, unit: row.unit||'units',
        reorder_at: parseInt(row.reorder_at)||10, supplier: row.supplier||null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'item_name' })
      imported++
    }
    setImportResult({ type:'stock', imported, skipped, total: rows.length })
    const { data } = await supabase.from('clinic_inventory').select('*').order('item_name',{ascending:true})
    setItems((data||[]).map(r=>({ id:r.id, name:r.item_name, stock:r.stock, unit:r.unit, reorderAt:r.reorder_at, supplier:r.supplier })))
  }

  async function handleReferenceFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const rows = parseCSV(text)
    let imported=0, skipped=0
    for (const row of rows) {
      if (!row.drug_name) { skipped++; continue }
      await supabase.from('drug_reference').upsert({
        drug_name: row.drug_name, effects: row.effects||null, intake_info: row.intake_info||null,
        precautions: row.precautions||null, updated_by: staffMember?.name||'CSV import',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'drug_name' })
      imported++
    }
    setImportResult({ type:'reference', imported, skipped, total: rows.length })
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('clinic_inventory').select('*').order('item_name', { ascending: true })
      setItems((data||[]).map(r => ({
        id: r.id, name: r.item_name, stock: r.stock, unit: r.unit, reorderAt: r.reorder_at, supplier: r.supplier,
      })))
      setLoading(false)
    }
    load()
  }, [])

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
      <div style={{display:'flex',gap:'8px',marginBottom:'16px',justifyContent:'center'}}>
        <label style={{fontSize:'12px',padding:'8px 14px',borderRadius:'8px',cursor:'pointer',background:C.card,color:C.textSub,fontWeight:500,border:`0.5px solid ${C.border}`}}>
          Import stock CSV
          <input type="file" accept=".csv" onChange={handleStockFile} style={{display:'none'}}/>
        </label>
        <label style={{fontSize:'12px',padding:'8px 14px',borderRadius:'8px',cursor:'pointer',background:C.card,color:C.textSub,fontWeight:500,border:`0.5px solid ${C.border}`}}>
          Import drug info CSV
          <input type="file" accept=".csv" onChange={handleReferenceFile} style={{display:'none'}}/>
        </label>
      </div>
      {importResult&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:C.green,textAlign:'center'}}>
        {importResult.type==='stock'?'Stock':'Drug info'} import: {importResult.imported} of {importResult.total} rows imported{importResult.skipped>0?`, ${importResult.skipped} skipped`:''}.
      </div>}
      <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginBottom:'16px',lineHeight:1.5}}>
        Stock CSV columns: item_name, stock, unit, reorder_at, supplier · Drug info CSV columns: drug_name, effects, intake_info, precautions
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
      <div style={{textAlign:'center',marginTop:'16px'}}><Btn variant="primary">+ Add item</Btn></div>
    </PageWrap>
  )
}

// ── CLAIMS CLEARINGHOUSE ─────────────────────────────────────────────────────
// Validates claims before they leave the clinic, calculates the per-claim
// Medsa clearinghouse fee, and tracks status through the pipeline. Actual
// transmission to an insurer is a manual/portal handoff until a real insurer
// API or EDI contract exists - this is flagged honestly in the UI itself.
function ClaimsScreen() {
  const [step,setStep]=useState('list')
  const [claimType,setClaimType]=useState('outpatient')
  const [selectedPatient,setSelectedPatient]=useState(null)
  const [selectedPlan,setSelectedPlan]=useState(null)
  const [amount,setAmount]=useState('')
  const [patients,setPatients]=useState([])
  const [plans,setPlans]=useState([])
  const [existingClaims,setExistingClaims]=useState([])
  const [loading,setLoading]=useState(true)

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
        amount: c.amount, fee: c.clearinghouse_fee||0,
        status: c.validated ? (c.status==='approved'||c.status==='rejected' ? 'adjudicated' : 'submitted') : 'validated',
        date: c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'}) : '-',
      })))
      setLoading(false)
    }
    load()
  }, [])

  // Medsa's clearinghouse fee - flat + small percentage, paid by the insurer
  // for automated validation, routing, and reconciliation of this claim.
  function calcFee(amt) {
    const n = parseFloat(amt) || 0
    return Math.round(n * 0.02 + 10) // 2% + HK$10 flat, illustrative rate
  }

  const statusMeta = {
    validated: {label:'Validated', type:'waiting', desc:'Checked for completeness and coverage - not yet sent to insurer'},
    submitted: {label:'Sent to insurer', type:'due', desc:'Awaiting adjudication'},
    adjudicated: {label:'Adjudicated', type:'ok', desc:'Insurer has responded'},
  }

  if (step==='list') return (
    <PageWrap maxWidth={680}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Insurance Claims</h2>

      <div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
        <div style={{fontSize:'14px',fontWeight:600,color:C.green,marginBottom:'4px'}}>How this works</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Medsa validates each claim - checking patient consent, policy on file, and required documents - before it's sent to the insurer. A small clearinghouse fee is paid by the insurer per validated claim, not by your clinic.</div>
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
                  <Badge text={meta.label} type={meta.type}/>
                </div>
              </div>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>{meta.desc}</div>
              <div style={{fontSize:'11px',color:C.blue}}>Medsa clearinghouse fee: HK${c.fee} (paid by insurer)</div>
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
        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
          {plans.map(pl=>(
            <Card key={pl.id} onClick={()=>setSelectedPlan(pl)} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',border:selectedPlan?.id===pl.id?`1.5px solid ${C.green}`:undefined}}>
              <div><div style={{fontSize:'13px',fontWeight:500}}>{pl.plan_name}</div><div style={{fontSize:'12px',color:C.textSub}}>{pl.company_name}</div></div>
            </Card>
          ))}
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
          Medsa clearinghouse fee for this claim: <strong>HK${calcFee(amount)}</strong> (paid by {selectedPlan.company_name}, not deducted from your claim)
        </div>}

        <div style={{textAlign:'center'}}>
          <Btn variant="primary" onClick={async ()=>{
            const claimRef = 'CLM-'+Math.floor(10000+Math.random()*89999)
            await supabase.from('insurance_claims').insert({
              claim_ref: claimRef, patient_id: selectedPatient.id, plan_id: selectedPlan.id,
              claim_type: claimType, amount: parseFloat(amount), plan_covers: parseFloat(amount),
              patient_pays: 0, status: 'pending', validated: true,
              clearinghouse_fee: calcFee(amount),
            })
            setStep('submitted')
          }} disabled={!selectedPatient.consented||!selectedPlan||!amount}>
            Validate & prepare for {selectedPlan?.company_name||'insurer'}
          </Btn>
        </div>
      </>}
    </PageWrap>
  )

  return (
    <PageWrap maxWidth={480}>
      <div style={{textAlign:'center',padding:'60px 20px'}}>
        <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Claim validated</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'8px'}}>Ready to send to {selectedPlan?.company_name}. Clearinghouse fee HK${calcFee(amount)} applies once submitted.</div>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'20px'}}>Submission channel: {selectedPlan?.company_name}'s existing claims portal (manual handoff until direct integration is in place)</div>
        <Btn variant="primary" onClick={()=>{setStep('list');setSelectedPatient(null);setSelectedPlan(null);setAmount('')}}>Done</Btn>
      </div>
    </PageWrap>
  )
}

export default function ClinicOpsApp() {
  const [staffMember,setStaffMember]=useState(null)
  const [screen,setScreen]=useState('overview')
  const [checkedInQueue,setCheckedInQueue]=useState([])
  const [queueLoading,setQueueLoading]=useState(true)
  const [pendingPrescriptions,setPendingPrescriptions]=useState([])
  const [selectedQueueEntry,setSelectedQueueEntry]=useState(null)
  const [nextTicket,setNextTicket]=useState(13)

  // Load today's queue and pending prescriptions from Supabase once signed in
  useEffect(() => {
    if (!staffMember) return
    async function load() {
      setQueueLoading(true)
      const { data: queueRows } = await supabase
        .from('clinic_queue')
        .select('*')
        .order('checked_in_at', { ascending: true })
      setCheckedInQueue((queueRows||[]).map(r => ({
        id: r.id,
        ticket: r.ticket,
        patientName: r.patient_name,
        doctor: r.doctor_name || 'Unassigned',
        room: r.room || '-',
        checkedInAt: new Date(r.checked_in_at).getTime(),
        department: r.department || 'All departments',
        status: r.status,
      })))

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
    load()
  }, [staffMember])

  async function handleCheckedIn(patient) {
    const alreadyActive = checkedInQueue.some(q =>
      q.patientName === patient.full_name && hoursRemaining(q.checkedInAt) > 0
    )
    if (alreadyActive) {
      setScreen(staffMember?.role==='admin' ? 'overview' : 'checkin')
      return
    }
    const ticket = 'A'+nextTicket
    const { data, error } = await supabase.from('clinic_queue').insert({
      ticket,
      patient_id: patient.id,
      patient_name: patient.full_name,
      doctor_name: staffMember?.role==='doctor' ? staffMember.name : 'Unassigned',
      room: '-',
      department: staffMember?.department || 'All departments',
      status: 'waiting',
    }).select().single()

    if (!error && data) {
      setCheckedInQueue([...checkedInQueue, {
        id: data.id, ticket: data.ticket, patientName: data.patient_name,
        doctor: data.doctor_name, room: data.room, checkedInAt: new Date(data.checked_in_at).getTime(),
        department: data.department, status: data.status,
      }])
      setNextTicket(nextTicket+1)
    }
    setScreen(staffMember?.role==='admin' ? 'overview' : 'checkin')
  }

  // Admin/clinic manager sees every department; everyone else sees only
  // their own. A solo clinic never notices this since every entry shares
  // one department anyway.
  const scopedQueue = (staffMember?.department==='All departments' || !staffMember?.department)
    ? checkedInQueue
    : checkedInQueue.filter(q=>!q.department || q.department===staffMember.department)

  async function handlePrescribed(rx) {
    // The actual medication rows are already written to Supabase inside
    // ConsultationScreen's handleSave. Here we just reflect it locally so
    // the Prescriptions queue updates immediately without a full reload.
    setPendingPrescriptions([...pendingPrescriptions, {...rx, id: Date.now(), status:'pending'}])
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
      await supabase.from('medications').update({
        dispense_status: 'printed', dispensed_by: dispensedBy, dispensed_at: dispensedAt,
      }).eq('id', id)
    }

    return inventoryWarnings
  }

  async function handleRemoveFromQueue(index) {
    const entry = scopedQueue[index]
    setCheckedInQueue(prev => prev.filter(q => q.id !== entry.id))
    if (entry?.id) {
      await supabase.from('clinic_queue').delete().eq('id', entry.id)
    }
  }

  const pendingCount = pendingPrescriptions.filter(p=>p.status==='pending').length

  const allNavItems = [
    {key:'overview', icon:'\u25a3', label:'Overview', roles:['admin']},
    {key:'mypatients', icon:'\u25ce', label:'My Patients', roles:['doctor']},
    {key:'checkin', icon:'\u2b21', label:'Check-in / Search', roles:['admin','frontdesk']},
    {key:'schedule', icon:'\u25c7', label:'Schedule', roles:['admin','frontdesk','doctor']},
    {key:'prescriptions', icon:'\u25c9', label:'Prescriptions', roles:['admin','frontdesk'], badge: pendingCount},
    {key:'inventory', icon:'\u25a4', label:'Inventory', roles:['admin','frontdesk']},
    {key:'payment', icon:'\u25c8', label:'Payment', roles:['admin','frontdesk']},
    {key:'claims', icon:'\u25c9', label:'Claims', roles:['admin','frontdesk']},
  ]

  if (!staffMember) return <StaffLogin onLogin={(s)=>{setStaffMember(s);setScreen(s.role==='doctor'?'mypatients':s.role==='frontdesk'?'checkin':'overview')}}/>

  const navItems = allNavItems.filter(item=>item.roles.includes(staffMember.role))

  return (
    <div style={{display:'flex',minHeight:'100vh',background:C.beige,fontFamily:'system-ui, -apple-system, sans-serif'}}>
      <Sidebar screen={screen} setScreen={setScreen} staffMember={staffMember} navItems={navItems} onLogout={()=>{setStaffMember(null);setScreen('overview')}}/>
      <div style={{flex:1,padding:'32px 40px',overflowY:'auto'}}>
        {screen==='overview'&&<OverviewScreen queue={scopedQueue} pendingCount={pendingCount} onRemoveFromQueue={handleRemoveFromQueue}/>}
        {screen==='mypatients'&&<MyPatientsScreen queue={scopedQueue} onSelectPatient={(q)=>{setSelectedQueueEntry(q);setScreen('consultation')}}/>}
        {screen==='consultation'&&selectedQueueEntry&&<ConsultationScreen queueEntry={selectedQueueEntry} staffMember={staffMember} onPrescribed={handlePrescribed}/>}
        {screen==='checkin'&&<CheckInSearchScreen onCheckedIn={handleCheckedIn} onNewPatient={()=>setScreen('newpatient')} onNavSchedule={()=>setScreen('schedule')}/>}
        {screen==='newpatient'&&<NewPatientScreen onBack={()=>setScreen('checkin')}/>}
        {screen==='schedule'&&<ScheduleScreen/>}
        {screen==='prescriptions'&&<PrescriptionsQueueScreen pending={pendingPrescriptions} onConfirm={handleConfirmPrescription}/>}
        {screen==='inventory'&&<InventoryScreen staffMember={staffMember}/>}
        {screen==='payment'&&<PaymentScreen/>}
        {screen==='claims'&&<ClaimsScreen/>}
      </div>
    </div>
  )
}
