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
    {id:1, name:'Dr Chan Siu-ming', role:'doctor', roleLabel:'Doctor', color:C.green},
    {id:2, name:'Dr Lam Wai-yee', role:'doctor', roleLabel:'Doctor', color:C.green},
    {id:3, name:'Yip Mei', role:'frontdesk', roleLabel:'Nurse / Front Desk', color:C.blue},
    {id:4, name:'Wong Siu-fan', role:'frontdesk', roleLabel:'Nurse / Front Desk', color:C.blue},
    {id:5, name:'Chan Ka-yee (Owner)', role:'admin', roleLabel:'Clinic Manager', color:C.purple},
  ]
  const [pin,setPin]=useState('')
  const [selected,setSelected]=useState(null)

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:420}}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{fontSize:'22px',fontWeight:700,color:C.text}}>Medsa Clinic</div>
          <div style={{fontSize:'13px',color:C.textSub,marginTop:'4px'}}>Select your account to sign in</div>
        </div>
        {!selected ? (
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {staff.map(s=>(
              <div key={s.id} onClick={()=>setSelected(s)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer'}}>
                <div style={{width:38,height:38,borderRadius:'10px',background:s.color+'22',color:s.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'14px',flexShrink:0}}>{s.name[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'14px',fontWeight:600}}>{s.name}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{s.roleLabel}</div>
                </div>
                <span style={{color:C.textMuted}}>{'\u203a'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'24px'}}>
            <div style={{textAlign:'center',marginBottom:'18px'}}>
              <div style={{width:52,height:52,borderRadius:'12px',background:selected.color+'22',color:selected.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'18px',margin:'0 auto 10px'}}>{selected.name[0]}</div>
              <div style={{fontSize:'15px',fontWeight:600}}>{selected.name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{selected.roleLabel}</div>
            </div>
            <input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="PIN" maxLength={4}
              style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px',fontSize:'18px',textAlign:'center',letterSpacing:'8px',marginBottom:'14px',boxSizing:'border-box'}}/>
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1}} onClick={()=>{setSelected(null);setPin('')}}>Back</Btn>
              <Btn variant="primary" style={{flex:1}} onClick={()=>onLogin(selected)}>Sign in</Btn>
            </div>
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
            <div style={{fontSize:'11px',color:C.textSub}}>{staffMember.roleLabel}</div>
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

  async function simulateScan() {
    setStage('scanning')
    const { data, error } = await supabase.from('patients').select('*').eq('medsa_id','MDS-84921-HK').single()
    if (error || !data) { setStage('error'); return }
    setPatient(data)
    setStage('found')
  }

  async function handleSearch() {
    if (!searchTerm.trim()) return
    const { data } = await supabase.from('patients').select('*').eq('medsa_id','MDS-84921-HK').single()
    setSearchResult(data || null)
    setRequestSent(false)
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
            <Btn onClick={()=>setStage('idle')}>Cancel</Btn>
            <Btn variant="primary" onClick={()=>onCheckedIn(patient)}>Check in patient</Btn>
          </div>
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
          <div style={{display:'flex',gap:'10px',marginBottom:requestSent?'0':'10px'}}>
            <Btn variant="primary" style={{flex:1}} onClick={onNavSchedule}>Schedule appointment</Btn>
            {!requestSent&&<Btn style={{flex:1}} onClick={()=>setRequestSent(true)}>Request record access</Btn>}
          </div>
          {requestSent&&<div style={{marginTop:'10px',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:C.amber}}>{'\u25c7'} Request sent to patient for approval. Records will be available here once granted, ahead of check-in.</div>}
        </Card>}
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
  const [prescriptions,setPrescriptions]=useState([{drug:'',dosage:'',frequency:''}])
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState(null)

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

  function addPrescriptionLine() { setPrescriptions([...prescriptions, {drug:'',dosage:'',frequency:''}]) }
  function updateRx(i, field, value) {
    setPrescriptions(prescriptions.map((p,idx)=>idx===i?{...p,[field]:value}:p))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const rxRows = prescriptions.filter(p=>p.drug.trim())
      if (rxRows.length>0 && patient) {
        const dbRows = rxRows.map(p=>({
          patient_id: patient.id, medication_name: p.drug, dosage: p.dosage, frequency: p.frequency,
          active: true, on_emergency_card: false, start_date: new Date().toISOString().slice(0,10),
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
            {records.slice(0,3).map((r,i)=>(
              <Card key={i} style={{padding:'10px 14px',marginBottom:'6px'}}>
                <div style={{fontSize:'12px',fontWeight:600}}>{r.title}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short'})}</div>
              </Card>
            ))}
          </div>
        </div>}
      </> : <div style={{background:C.card,borderRadius:'10px',padding:'14px',fontSize:'12px',color:C.textMuted,textAlign:'center',marginBottom:'20px'}}>24-hour record access has expired for this visit. Request renewed access from Check-in / Search.</div>}

      <SecLabel>Diagnosis</SecLabel>
      <input value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} placeholder="e.g. Upper respiratory tract infection" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'18px'}}/>

      <SecLabel>Consultation notes</SecLabel>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} placeholder="Clinical findings, examination notes, follow-up plan..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'18px',fontFamily:'inherit',resize:'vertical'}}/>

      <SecLabel>Prescription</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'10px'}}>
        {prescriptions.map((rx,i)=>(
          <div key={i} style={{display:'flex',gap:'8px'}}>
            <input value={rx.drug} onChange={e=>updateRx(i,'drug',e.target.value)} placeholder="Drug name" style={{flex:2,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
            <input value={rx.dosage} onChange={e=>updateRx(i,'dosage',e.target.value)} placeholder="Dosage" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
            <input value={rx.frequency} onChange={e=>updateRx(i,'frequency',e.target.value)} placeholder="Frequency" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          </div>
        ))}
      </div>
      <Btn style={{marginBottom:'20px'}} onClick={addPrescriptionLine}>+ Add drug</Btn>

      {prescriptions.some(p=>p.drug.trim())&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 14px',fontSize:'12px',color:C.amber,marginBottom:'16px'}}>
        {'\u25c7'} Saving will notify front desk immediately to prepare and label this prescription.
      </div>}

      {error&&<div style={{fontSize:'13px',color:C.red,marginBottom:'12px'}}>{error}</div>}
      <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving?'Saving...':'Save consultation'}</Btn>
    </PageWrap>
  )
}

function PrescriptionsQueueScreen({ pending, onConfirm }) {
  const [printingId,setPrintingId]=useState(null)

  function handleConfirm(id) {
    setPrintingId(id)
    setTimeout(()=>{ onConfirm(id); setPrintingId(null) }, 900)
  }

  const waiting = pending.filter(p=>p.status==='pending')
  const done = pending.filter(p=>p.status==='printed')

  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Prescriptions</h2>
      {waiting.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px',marginBottom:'20px'}}>No pending prescriptions right now.</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'28px'}}>
        {waiting.map(p=>(
          <Card key={p.id} style={{padding:'16px 18px',border:`1.5px solid ${C.amber}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:700}}>{p.patientName}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>Prescribed by {p.doctorName} - {new Date(p.timestamp).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <Badge text="New" type="due"/>
            </div>
            <div style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'12px'}}>
              {p.drugs.map((d,i)=>(<div key={i} style={{fontSize:'13px',padding:'3px 0'}}>{d.drug} {d.dosage&&('- '+d.dosage)} {d.frequency&&('- '+d.frequency)}</div>))}
            </div>
            <Btn variant="primary" style={{width:'100%'}} onClick={()=>handleConfirm(p.id)} disabled={printingId===p.id}>
              {printingId===p.id?'Printing label...':'Confirm & print label'}
            </Btn>
          </Card>
        ))}
      </div>
      {done.length>0&&<>
        <SecLabel>Printed today</SecLabel>
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {done.map(p=>(
            <Card key={p.id} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',opacity:0.7}}>
              <div><div style={{fontSize:'13px',fontWeight:500}}>{p.patientName}</div><div style={{fontSize:'11px',color:C.textSub}}>{p.doctorName}</div></div>
              <Badge text="Printed" type="ok"/>
            </Card>
          ))}
        </div>
      </>}
    </PageWrap>
  )
}

function OverviewScreen({ queue, pendingCount }) {
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
  const [method,setMethod]=useState('card')
  const [paid,setPaid]=useState(false)
  const [receiptSent,setReceiptSent]=useState(false)
  const [printed,setPrinted]=useState(false)
  const bill = {patient:'Wong Mei-ling, Lisa', consultFee:380, insurerCovers:300, patientPays:80}

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
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Collect Payment</h2>
      <Card style={{padding:'18px',marginBottom:'16px'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'12px'}}>{bill.patient}</div>
        {[['Consultation fee',`HK$${bill.consultFee}`],['Insurance covers',`-HK$${bill.insurerCovers}`],['Patient pays',`HK$${bill.patientPays}`]].map(([l,v],i)=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:i<2?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}>
            <span style={{color:C.textSub}}>{l}</span>
            <span style={{fontWeight:i===2?700:500,fontSize:i===2?'17px':'13px',color:i===2?C.green:C.text}}>{v}</span>
          </div>
        ))}
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

function InventoryScreen() {
  const [items,setItems]=useState([
    {name:'Metformin 500mg', stock:340, unit:'tablets', reorderAt:100, supplier:'HK Pharma Distributors'},
    {name:'Amoxicillin 250mg', stock:85, unit:'capsules', reorderAt:100, supplier:'HK Pharma Distributors'},
    {name:'Paracetamol 500mg', stock:620, unit:'tablets', reorderAt:150, supplier:'MedSupply HK'},
    {name:'Surgical masks', stock:45, unit:'boxes', reorderAt:20, supplier:'MedSupply HK'},
    {name:'Syringes 5ml', stock:12, unit:'boxes', reorderAt:15, supplier:'MedSupply HK'},
  ])
  const [showReorderOnly,setShowReorderOnly]=useState(false)
  const displayed = showReorderOnly ? items.filter(i=>i.stock<=i.reorderAt) : items
  const lowStockCount = items.filter(i=>i.stock<=i.reorderAt).length

  function adjustStock(name, delta) {
    setItems(prev=>prev.map(i=>i.name===name?{...i,stock:Math.max(0,i.stock+delta)}:i))
  }

  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Inventory</h2>
      {lowStockCount>0&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px'}}>
        <span style={{fontSize:'13px',fontWeight:600,color:C.amber}}>{'\u26a0'} {lowStockCount} item(s) at or below reorder level</span>
      </div>}
      <div style={{display:'flex',gap:'8px',marginBottom:'16px',justifyContent:'center'}}>
        {[[false,'All items'],[true,'Needs reorder']].map(([v,l])=>(
          <div key={String(v)} onClick={()=>setShowReorderOnly(v)} style={{fontSize:'12px',padding:'7px 14px',borderRadius:'20px',cursor:'pointer',background:showReorderOnly===v?C.green:C.card,color:showReorderOnly===v?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {displayed.map((item,i)=>{
          const low = item.stock <= item.reorderAt
          return (
            <Card key={i} style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:'16px'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:600}}>{item.name}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{item.supplier} - reorder at {item.reorderAt} {item.unit}</div>
              </div>
              {low&&<Badge text="Reorder" type="due"/>}
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <button onClick={()=>adjustStock(item.name,-10)} style={{width:28,height:28,borderRadius:'6px',border:`0.5px solid ${C.border}`,background:'#fff',cursor:'pointer'}}>-</button>
                <div style={{width:70,textAlign:'center'}}>
                  <span style={{fontSize:'15px',fontWeight:700,color:low?C.amber:C.text}}>{item.stock}</span>
                  <span style={{fontSize:'11px',color:C.textMuted}}> {item.unit}</span>
                </div>
                <button onClick={()=>adjustStock(item.name,10)} style={{width:28,height:28,borderRadius:'6px',border:`0.5px solid ${C.border}`,background:'#fff',cursor:'pointer'}}>+</button>
              </div>
            </Card>
          )
        })}
      </div>
      <div style={{textAlign:'center',marginTop:'16px'}}><Btn variant="primary">+ Add item</Btn></div>
    </PageWrap>
  )
}

function ClaimsScreen() {
  const [step,setStep]=useState('list')
  const [claimType,setClaimType]=useState('outpatient')
  const [selectedPatient,setSelectedPatient]=useState(null)
  const patients = [
    {name:'Wong Mei-ling, Lisa', medsaId:'MDS-84921-HK', plan:'AIA Prime Care', consented:true},
    {name:'Chan Tai-man', medsaId:'MDS-77213-HK', plan:'Bupa Gold Cover', consented:true},
    {name:'Lee Siu-fong', medsaId:'MDS-90142-HK', plan:'Blue Cross Hospital Plan', consented:false},
  ]
  const existingClaims = [
    {ref:'CLM-44823', patient:'Wong Mei-ling, Lisa', insurer:'AIA', amount:680, status:'pending', date:'3 Jul'},
    {ref:'CLM-44821', patient:'Chan Tai-man', insurer:'Bupa', amount:1200, status:'approved', date:'28 Jun'},
  ]

  if (step==='list') return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Insurance Claims</h2>
      <div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'12px',padding:'16px',marginBottom:'20px'}}>
        <div style={{fontSize:'14px',fontWeight:600,color:C.green,marginBottom:'4px'}}>Direct-to-insurer submission</div>
        <div style={{fontSize:'13px',color:C.textSub}}>Patient consent is already on file via Medsa. Submit the claim directly - no separate paperwork.</div>
      </div>
      <SecLabel>Recent claims</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
        {existingClaims.map((c,i)=>(
          <Card key={i} style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:'13px',fontWeight:500}}>{c.ref} - {c.patient}</div><div style={{fontSize:'12px',color:C.textSub}}>{c.insurer} - {c.date}</div></div>
            <div style={{textAlign:'right'}}><div style={{fontSize:'15px',fontWeight:600,color:C.green}}>HK${c.amount}</div><Badge text={c.status==='approved'?'Approved':'Pending'} type={c.status==='approved'?'ok':'due'}/></div>
          </Card>
        ))}
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
        {patients.map((p,i)=>(
          <Card key={i} onClick={()=>p.consented&&setSelectedPatient(p)} style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',opacity:p.consented?1:0.5,border:selectedPatient?.medsaId===p.medsaId?`1.5px solid ${C.green}`:undefined}}>
            <div><div style={{fontSize:'13px',fontWeight:500}}>{p.name}</div><div style={{fontSize:'12px',color:C.textSub}}>{p.medsaId} - {p.plan}</div></div>
            {p.consented?<span style={{fontSize:'12px',color:C.green,fontWeight:600}}>Consented</span>:<span style={{fontSize:'12px',color:C.textMuted}}>No consent on file</span>}
          </Card>
        ))}
      </div>
      {selectedPatient&&<>
        <SecLabel>Claim type</SecLabel>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'8px',marginBottom:'20px'}}>
          {['outpatient','hospitalisation','specialist','lab'].map(t=>(
            <div key={t} onClick={()=>setClaimType(t)} style={{padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:claimType===t?C.green:C.card,color:claimType===t?'#fff':C.text,textTransform:'capitalize'}}>{t}</div>
          ))}
        </div>
        <SecLabel>Auto-attached from Medsa</SecLabel>
        <Card style={{padding:'16px',marginBottom:'20px'}}>
          {['Consultation record','Diagnosis on file','Patient ID and policy number'].map((item,i,arr)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>
              <span style={{color:C.green,fontSize:'13px'}}>{'\u2713'}</span><span style={{fontSize:'13px'}}>{item}</span>
            </div>
          ))}
        </Card>
        <div style={{textAlign:'center'}}><Btn variant="primary" onClick={()=>setStep('submitted')}>Submit to {selectedPatient.plan.split(' ')[0]}</Btn></div>
      </>}
    </PageWrap>
  )

  return (
    <PageWrap maxWidth={480}>
      <div style={{textAlign:'center',padding:'60px 20px'}}>
        <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Claim submitted</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px'}}>Sent directly to {selectedPatient?.plan}. No separate paperwork needed.</div>
        <Btn variant="primary" onClick={()=>{setStep('list');setSelectedPatient(null)}}>Done</Btn>
      </div>
    </PageWrap>
  )
}

export default function ClinicOpsApp() {
  const [staffMember,setStaffMember]=useState(null)
  const [screen,setScreen]=useState('overview')
  const [checkedInQueue,setCheckedInQueue]=useState([
    {ticket:'A12', patientName:'Chan Tai-man', doctor:'Dr Lam', room:'Room 2', checkedInAt: Date.now() - 2*60*60*1000},
  ])
  const [pendingPrescriptions,setPendingPrescriptions]=useState([])
  const [selectedQueueEntry,setSelectedQueueEntry]=useState(null)
  const [nextTicket,setNextTicket]=useState(13)

  function handleCheckedIn(patient) {
    const entry = {
      ticket: 'A'+nextTicket,
      patientName: patient.full_name,
      doctor: staffMember?.role==='doctor' ? staffMember.name : 'Unassigned',
      room: '-',
      checkedInAt: Date.now(),
    }
    setCheckedInQueue([...checkedInQueue, entry])
    setNextTicket(nextTicket+1)
    setScreen(staffMember?.role==='admin' ? 'overview' : 'checkin')
  }

  function handlePrescribed(rx) {
    setPendingPrescriptions([...pendingPrescriptions, {...rx, id: Date.now()}])
  }

  function handleConfirmPrescription(id) {
    setPendingPrescriptions(prev=>prev.map(p=>p.id===id?{...p,status:'printed'}:p))
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
        {screen==='overview'&&<OverviewScreen queue={checkedInQueue} pendingCount={pendingCount}/>}
        {screen==='mypatients'&&<MyPatientsScreen queue={checkedInQueue} onSelectPatient={(q)=>{setSelectedQueueEntry(q);setScreen('consultation')}}/>}
        {screen==='consultation'&&selectedQueueEntry&&<ConsultationScreen queueEntry={selectedQueueEntry} staffMember={staffMember} onPrescribed={handlePrescribed}/>}
        {screen==='checkin'&&<CheckInSearchScreen onCheckedIn={handleCheckedIn} onNewPatient={()=>setScreen('newpatient')} onNavSchedule={()=>setScreen('schedule')}/>}
        {screen==='newpatient'&&<NewPatientScreen onBack={()=>setScreen('checkin')}/>}
        {screen==='schedule'&&<ScheduleScreen/>}
        {screen==='prescriptions'&&<PrescriptionsQueueScreen pending={pendingPrescriptions} onConfirm={handleConfirmPrescription}/>}
        {screen==='inventory'&&<InventoryScreen/>}
        {screen==='payment'&&<PaymentScreen/>}
        {screen==='claims'&&<ClaimsScreen/>}
      </div>
    </div>
  )
}
