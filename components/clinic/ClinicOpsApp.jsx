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

function StaffLogin({ onLogin }) {
  const staff = [
    {id:1, name:'Dr Chan Siu-ming', role:'doctor', roleLabel:'Doctor', color:C.green},
    {id:2, name:'Dr Lam Wai-yee', role:'doctor', roleLabel:'Doctor', color:C.green},
    {id:3, name:'Yip Mei', role:'nurse', roleLabel:'Nurse', color:C.blue},
    {id:4, name:'Wong Siu-fan', role:'receptionist', roleLabel:'Receptionist', color:C.amber},
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
          <div key={item.key} onClick={()=>setScreen(item.key)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',borderRadius:'8px',cursor:'pointer',marginBottom:'2px',background:screen===item.key?C.green:'transparent',color:screen===item.key?'#fff':C.text}}>
            <span style={{fontSize:'16px'}}>{item.icon}</span>
            <span style={{fontSize:'13px',fontWeight:500}}>{item.label}</span>
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

function ScanCheckInScreen({ onCheckedIn, onNewPatient }) {
  const [stage,setStage]=useState('idle')
  const [patient,setPatient]=useState(null)
  const [searchTerm,setSearchTerm]=useState('')

  async function simulateScan() {
    setStage('scanning')
    const { data, error } = await supabase.from('patients').select('*').eq('medsa_id','MDS-84921-HK').single()
    if (error || !data) { setStage('error'); return }
    setPatient(data)
    setStage('found')
  }

  return (
    <div style={{maxWidth:520}}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px'}}>Patient Check-In</h2>
      {stage==='idle'&&<>
        <div onClick={simulateScan} style={{background:C.cream,border:`1.5px dashed ${C.border}`,borderRadius:'14px',padding:'44px 20px',textAlign:'center',cursor:'pointer',marginBottom:'16px'}}>
          <div style={{fontSize:'36px',color:C.green,marginBottom:'10px'}}>{'\u2b21'}</div>
          <div style={{fontSize:'15px',fontWeight:600,marginBottom:'4px'}}>Scan patient QR code</div>
          <div style={{fontSize:'12px',color:C.textSub}}>Point a connected scanner or webcam at the patient's Medsa QR</div>
        </div>
        <SecLabel>Or search manually</SecLabel>
        <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',background:C.cream,outline:'none',boxSizing:'border-box',marginBottom:'12px'}} placeholder="Search by name or Medsa ID..."/>
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
              <div style={{fontSize:'13px',fontWeight:600,color:patient.emergency_card_active?C.green:C.textMuted}}>{patient.emergency_card_active?'Active check':'Not set up'}</div>
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
        <div style={{fontSize:'14px',color:C.textSub,marginBottom:'14px'}}>Patient not found. Try manual search or register a new patient.</div>
        <Btn onClick={()=>setStage('idle')}>Try again</Btn>
      </div>}
    </div>
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
    <div style={{maxWidth:480,textAlign:'center',padding:'60px 20px'}}>
      <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
      <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Patient registered</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.6}}>A Medsa profile has been created for {form.fullName || 'this patient'}. If they later download the Medsa app and register with matching details, their full record and this visit will sync automatically.</div>
      <Btn variant="primary" onClick={onBack}>Back to check-in</Btn>
    </div>
  )

  return (
    <div style={{maxWidth:480}}>
      <div onClick={onBack} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'16px'}}>{'\u2190'} Back</div>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px'}}>Register New Patient</h2>
      <div style={{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'16px'}}>
        <input value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} placeholder="Full name" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} placeholder="Date of birth (YYYY-MM-DD)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.hkid} onChange={e=>setForm({...form,hkid:e.target.value})} placeholder="HKID (optional)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone number" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
      </div>
      <div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'10px',padding:'12px 14px',fontSize:'12px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>
        {'\u25c7'} This creates a placeholder Medsa profile so today's visit is on record. The patient owns and completes their own profile once they register with Medsa themselves — their record then syncs automatically.
      </div>
      {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
      <Btn variant="primary" onClick={handleSubmit} disabled={saving||!form.fullName||!form.dob}>{saving?'Saving…':'Create Medsa profile'}</Btn>
    </div>
  )
}

function OverviewScreen({ queue, onNav, onSelectQueueEntry }) {
  const waiting = queue.filter(q=>q.status==='waiting').length
  const inRoom = queue.filter(q=>q.status==='in_room').length
  const done = queue.filter(q=>q.status==='done').length

  return (
    <div>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px'}}>Overview</h2>
      <div style={{display:'flex',gap:'12px',marginBottom:'20px'}}>
        <StatCard label="Waiting" value={waiting} sub="patients" color={C.amber} bg={C.amberLight}/>
        <StatCard label="In room" value={inRoom} sub="now" color={C.blue} bg={C.blueLight}/>
        <StatCard label="Seen today" value={done} sub="completed" color={C.green} bg={C.greenLight}/>
        <StatCard label="Today's revenue" value="HK$4,820" sub="12 consultations" color={C.green} bg={C.greenLight}/>
      </div>

      <div style={{display:'flex',gap:'20px'}}>
        <div style={{flex:2}}>
          <SecLabel>Patient queue - all doctors</SecLabel>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {queue.map((q,i)=>(
              <Card key={i} onClick={()=>onSelectQueueEntry(q)} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
                <div style={{width:34,height:34,borderRadius:'8px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,flexShrink:0}}>{q.ticket}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'13px',fontWeight:500}}>{q.patientName}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{q.doctor} - {q.room}</div>
                </div>
                <Badge text={q.status==='waiting'?'Waiting':q.status==='in_room'?'In room':'Done'} type={q.status==='waiting'?'due':q.status==='in_room'?'waiting':'ok'}/>
              </Card>
            ))}
          </div>
        </div>
        <div style={{flex:1}}>
          <SecLabel>Room status</SecLabel>
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
            {[{room:'Room 1',doctor:'Dr Chan',status:'occupied'},{room:'Room 2',doctor:'Dr Lam',status:'occupied'},{room:'Room 3',doctor:'-',status:'free'}].map((r,i)=>(
              <div key={i} style={{background:r.status==='occupied'?C.redLight:C.greenXLight,border:`0.5px solid ${r.status==='occupied'?C.red:C.green}`,borderRadius:'10px',padding:'10px 14px'}}>
                <div style={{fontSize:'13px',fontWeight:600}}>{r.room}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{r.status==='occupied'?r.doctor:'Available'}</div>
              </div>
            ))}
          </div>
          <SecLabel>Quick actions</SecLabel>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            <Btn variant="primary" onClick={()=>onNav('scan')}>{'\u2b21'} Scan patient</Btn>
            <Btn onClick={()=>onNav('schedule')}>{'\u25c7'} View schedule</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

function PatientQueueDetail({ entry, onClose }) {
  const [conditions,setConditions]=useState([])
  const [allergies,setAllergies]=useState([])
  const [loading,setLoading]=useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: patient } = await supabase.from('patients').select('*').eq('medsa_id','MDS-84921-HK').single()
      if (patient) {
        const [{data:c},{data:a}] = await Promise.all([
          supabase.from('conditions').select('*').eq('patient_id',patient.id).eq('active',true),
          supabase.from('allergies').select('*').eq('patient_id',patient.id),
        ])
        setConditions(c||[]); setAllergies(a||[])
      }
      setLoading(false)
    }
    load()
  }, [entry])

  if (!entry) return null
  const recordsVisible = entry.status !== 'done'

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:440,padding:'24px',maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}}>
          <div>
            <div style={{fontSize:'17px',fontWeight:700}}>{entry.patientName}</div>
            <div style={{fontSize:'12px',color:C.textSub}}>{entry.ticket} - {entry.doctor} - {entry.room}</div>
          </div>
          <Badge text={entry.status==='waiting'?'Waiting':entry.status==='in_room'?'In room':'Done'} type={entry.status==='waiting'?'due':entry.status==='in_room'?'waiting':'ok'}/>
        </div>
        {recordsVisible ? <>
          <SecLabel>Medical records - visible during visit</SecLabel>
          {loading&&<div style={{padding:'16px',textAlign:'center',fontSize:'12px',color:C.textMuted}}>Loading...</div>}
          {!loading&&<Card style={{padding:'12px 16px',marginBottom:'12px'}}>
            {allergies.map((a,i)=>(<div key={'a'+i} style={{padding:'5px 0',fontSize:'13px',fontWeight:600,color:a.severity==='severe'?C.red:C.text}}>{'\u26a0'} {a.allergen} ({a.severity})</div>))}
            {conditions.map((c,i)=>(<div key={'c'+i} style={{padding:'5px 0',fontSize:'13px'}}>{'\u25ce'} {c.condition_name}</div>))}
            {allergies.length===0&&conditions.length===0&&<div style={{fontSize:'12px',color:C.textMuted}}>No active conditions or allergies on file</div>}
          </Card>}
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'14px'}}>{'\u25c7'} Access closes automatically once this visit is marked done.</div>
        </> : <div style={{background:C.card,borderRadius:'10px',padding:'14px',fontSize:'12px',color:C.textMuted,textAlign:'center',marginBottom:'14px'}}>Visit complete - record access has closed</div>}
        <Btn variant="primary" style={{width:'100%'}} onClick={onClose}>Close</Btn>
      </div>
    </div>
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
    <div style={{maxWidth:640}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h2 style={{fontSize:'20px',fontWeight:700}}>Schedule</h2>
        <Btn variant="primary" onClick={()=>setShowNewApptForm(true)}>+ New appointment</Btn>
      </div>
      <Card style={{padding:'16px',marginBottom:'20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
          <span style={{fontSize:'14px',fontWeight:600}}>June 2026</span>
        </div>
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
    </div>
  )
}

function ConsultationScreen({ activePatient, staffMember }) {
  const [notes,setNotes]=useState('')
  const [diagnosis,setDiagnosis]=useState('')
  const [prescriptions,setPrescriptions]=useState([{drug:'',dosage:'',frequency:''}])
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState(null)

  function addPrescriptionLine() { setPrescriptions([...prescriptions, {drug:'',dosage:'',frequency:''}]) }
  function updateRx(i, field, value) {
    setPrescriptions(prescriptions.map((p,idx)=>idx===i?{...p,[field]:value}:p))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const rows = prescriptions.filter(p=>p.drug.trim()).map(p=>({
        patient_id: activePatient.id,
        medication_name: p.drug,
        dosage: p.dosage,
        frequency: p.frequency,
        active: true,
        on_emergency_card: false,
        start_date: new Date().toISOString().slice(0,10),
      }))
      if (rows.length>0) {
        const { error: insErr } = await supabase.from('medications').insert(rows)
        if (insErr) throw insErr
      }
      if (diagnosis.trim() || notes.trim()) {
        const { error: recErr } = await supabase.from('medical_records').insert({
          patient_id: activePatient.id,
          record_type: 'visit',
          title: diagnosis || 'Clinic consultation',
          notes: notes || null,
          diagnosis: diagnosis || null,
          date_of_record: new Date().toISOString().slice(0,10),
          source: 'clinic_ops',
        })
        if (recErr) throw recErr
      }
      setSaved(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!activePatient) return (
    <div style={{maxWidth:480,textAlign:'center',padding:'60px 20px'}}>
      <div style={{fontSize:'28px',marginBottom:'12px',color:C.textMuted}}>{'\u25ce'}</div>
      <div style={{fontSize:'14px',color:C.textSub}}>Check in a patient from Overview or Scan to begin a consultation.</div>
    </div>
  )

  if (saved) return (
    <div style={{maxWidth:480,textAlign:'center',padding:'60px 20px'}}>
      <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
      <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Consultation saved</div>
      <div style={{fontSize:'13px',color:C.textSub}}>Notes and prescription logged to {activePatient.full_name}'s Medsa record by {staffMember.name}.</div>
    </div>
  )

  return (
    <div style={{maxWidth:640}}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'6px'}}>Consultation</h2>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px'}}>{activePatient.full_name} - {activePatient.medsa_id}</div>

      <SecLabel>Diagnosis</SecLabel>
      <input value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} placeholder="e.g. Upper respiratory tract infection" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'18px'}}/>

      <SecLabel>Consultation notes</SecLabel>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={5} placeholder="Clinical findings, examination notes, follow-up plan..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'18px',fontFamily:'inherit',resize:'vertical'}}/>

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

      {error&&<div style={{fontSize:'13px',color:C.red,marginBottom:'12px'}}>{error}</div>}
      <div style={{display:'flex',gap:'10px'}}>
        <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save to Medsa record'}</Btn>
        <Btn>Save as draft</Btn>
      </div>
    </div>
  )
}

function PaymentScreen() {
  const [method,setMethod]=useState('card')
  const [paid,setPaid]=useState(false)
  const bill = {patient:'Wong Mei-ling, Lisa', consultFee:380, insurerCovers:300, patientPays:80}

  if (paid) return (
    <div style={{maxWidth:440,textAlign:'center',padding:'60px 20px'}}>
      <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
      <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Payment received</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px'}}>HK${bill.patientPays} - {bill.patient}</div>
      <Btn variant="primary" onClick={()=>setPaid(false)}>New payment</Btn>
    </div>
  )

  return (
    <div style={{maxWidth:440}}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px'}}>Collect Payment</h2>
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
        {[['card','Card','◈'],['octopus','Octopus','◉'],['cash','Cash','◎']].map(([k,l,icon])=>(
          <div key={k} onClick={()=>setMethod(k)} style={{flex:1,padding:'14px 8px',borderRadius:'8px',textAlign:'center',cursor:'pointer',background:method===k?C.green:C.card,color:method===k?'#fff':C.text}}>
            <div style={{fontSize:'18px',marginBottom:'4px'}}>{icon}</div>
            <div style={{fontSize:'12px',fontWeight:500}}>{l}</div>
          </div>
        ))}
      </div>
      <Btn variant="primary" style={{width:'100%',padding:'14px'}} onClick={()=>setPaid(true)}>Charge HK${bill.patientPays}</Btn>
    </div>
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
    <div style={{maxWidth:640}}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px'}}>Inventory</h2>
      {lowStockCount>0&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px'}}>
        <span style={{fontSize:'13px',fontWeight:600,color:C.amber}}>{'\u26a0'} {lowStockCount} item(s) at or below reorder level</span>
      </div>}
      <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
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
      <Btn variant="primary" style={{marginTop:'16px'}}>+ Add item</Btn>
    </div>
  )
}

function RecordsScreen({ activePatient }) {
  const [records,setRecords]=useState([])
  const [conditions,setConditions]=useState([])
  const [allergies,setAllergies]=useState([])
  const [loading,setLoading]=useState(false)

  useEffect(() => {
    async function load() {
      if (!activePatient) return
      setLoading(true)
      const [{data:r},{data:c},{data:a}] = await Promise.all([
        supabase.from('medical_records').select('*,institutions(name)').eq('patient_id',activePatient.id).order('date_of_record',{ascending:false}),
        supabase.from('conditions').select('*').eq('patient_id',activePatient.id).eq('active',true),
        supabase.from('allergies').select('*').eq('patient_id',activePatient.id),
      ])
      setRecords(r||[]); setConditions(c||[]); setAllergies(a||[])
      setLoading(false)
    }
    load()
  }, [activePatient])

  if (!activePatient) return (
    <div style={{maxWidth:480,textAlign:'center',padding:'60px 20px'}}>
      <div style={{fontSize:'28px',marginBottom:'12px',color:C.textMuted}}>{'\u25ce'}</div>
      <div style={{fontSize:'14px',color:C.textSub}}>Scan or check in a patient to view their medical records.</div>
    </div>
  )

  return (
    <div style={{maxWidth:640}}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'16px'}}>Medical Records</h2>
      <Card style={{padding:'16px',marginBottom:'20px',background:C.greenXLight,border:`0.5px solid ${C.green}`}}>
        <div style={{fontSize:'16px',fontWeight:700}}>{activePatient.full_name}</div>
        <div style={{fontSize:'13px',color:C.textSub}}>{activePatient.medsa_id} - Blood type {activePatient.blood_type}</div>
      </Card>

      <div style={{display:'flex',gap:'20px'}}>
        <div style={{flex:1}}>
          {allergies.length>0&&<>
            <SecLabel>Allergies</SecLabel>
            <Card style={{padding:'12px 16px',marginBottom:'16px'}}>
              {allergies.map((a,i,arr)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>
                  <span style={{fontSize:'13px',fontWeight:600,color:a.severity==='severe'?C.red:C.text}}>{'\u26a0'} {a.allergen}</span>
                  <Badge text={a.severity} type={a.severity==='severe'?'full':'due'}/>
                </div>
              ))}
            </Card>
          </>}
          {conditions.length>0&&<>
            <SecLabel>Active conditions</SecLabel>
            <Card style={{padding:'12px 16px'}}>
              {conditions.map((c,i,arr)=>(<div key={i} style={{padding:'6px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}>{'\u25ce'} {c.condition_name}</div>))}
            </Card>
          </>}
        </div>
        <div style={{flex:2}}>
          <SecLabel>Recent records</SecLabel>
          {loading&&<div style={{fontSize:'12px',color:C.textMuted}}>Loading...</div>}
          {!loading&&records.length===0&&<div style={{fontSize:'12px',color:C.textMuted}}>No records found</div>}
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {records.map((r,i)=>(
              <Card key={i} style={{padding:'12px 16px'}}>
                <div style={{fontSize:'13px',fontWeight:600}}>{r.title}</div>
                <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>{r.institutions?.name||'-'} - {new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
                {r.notes&&<div style={{fontSize:'12px',color:C.textSub,fontStyle:'italic'}}>{r.notes}</div>}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
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
    <div style={{maxWidth:640}}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px'}}>Insurance Claims</h2>
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
      <Btn variant="primary" onClick={()=>setStep('new')}>+ Submit new claim</Btn>
    </div>
  )

  if (step==='new') return (
    <div style={{maxWidth:560}}>
      <div onClick={()=>setStep('list')} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'16px'}}>Back</div>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'16px'}}>New Claim</h2>
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
              <span style={{color:C.green,fontSize:'13px'}}>✓</span><span style={{fontSize:'13px'}}>{item}</span>
            </div>
          ))}
        </Card>
        <Btn variant="primary" onClick={()=>setStep('submitted')}>Submit to {selectedPatient.plan.split(' ')[0]}</Btn>
      </>}
    </div>
  )

  return (
    <div style={{maxWidth:480,textAlign:'center',padding:'60px 20px'}}>
      <div style={{fontSize:'36px',marginBottom:'12px'}}>✓</div>
      <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Claim submitted</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px'}}>Sent directly to {selectedPatient?.plan}. No separate paperwork needed.</div>
      <Btn variant="primary" onClick={()=>{setStep('list');setSelectedPatient(null)}}>Done</Btn>
    </div>
  )
}

export default function ClinicOpsApp() {
  const [staffMember,setStaffMember]=useState(null)
  const [screen,setScreen]=useState('overview')
  const [activePatient,setActivePatient]=useState(null)
  const [selectedQueueEntry,setSelectedQueueEntry]=useState(null)

  const queue = [
    {ticket:'A12', patientName:'Wong Mei-ling, Lisa', doctor:'Dr Chan', room:'Room 1', status:'in_room'},
    {ticket:'A13', patientName:'Chan Tai-man', doctor:'Dr Lam', room:'Room 2', status:'in_room'},
    {ticket:'A14', patientName:'Lee Siu-fong', doctor:'Dr Chan', room:'-', status:'waiting'},
    {ticket:'A15', patientName:'Ho Ka-yee', doctor:'Dr Lam', room:'-', status:'waiting'},
    {ticket:'A10', patientName:'Yip Wing-sze', doctor:'Dr Chan', room:'-', status:'done'},
  ]

  const allNavItems = [
    {key:'overview', icon:'▣', label:'Overview', roles:['admin','doctor','nurse','receptionist']},
    {key:'scan', icon:'⬡', label:'Check-in', roles:['admin','receptionist','nurse']},
    {key:'schedule', icon:'◇', label:'Schedule', roles:['admin','receptionist','doctor','nurse']},
    {key:'consultation', icon:'◉', label:'Consultation', roles:['admin','doctor']},
    {key:'records', icon:'◎', label:'Records', roles:['admin','doctor','nurse']},
    {key:'inventory', icon:'▤', label:'Inventory', roles:['admin','nurse']},
    {key:'payment', icon:'◈', label:'Payment', roles:['admin','receptionist']},
    {key:'claims', icon:'◉', label:'Claims', roles:['admin','receptionist']},
  ]

  if (!staffMember) return <StaffLogin onLogin={setStaffMember}/>

  const navItems = allNavItems.filter(item=>item.roles.includes(staffMember.role))

  return (
    <div style={{display:'flex',minHeight:'100vh',background:C.beige,fontFamily:'system-ui, -apple-system, sans-serif'}}>
      <Sidebar screen={screen} setScreen={setScreen} staffMember={staffMember} navItems={navItems} onLogout={()=>{setStaffMember(null);setScreen('overview')}}/>
      <div style={{flex:1,padding:'32px 40px',overflowY:'auto'}}>
        {screen==='overview'&&<OverviewScreen queue={queue} onNav={setScreen} onSelectQueueEntry={setSelectedQueueEntry}/>}
        {screen==='scan'&&<ScanCheckInScreen onCheckedIn={(p)=>{setActivePatient(p);setScreen('records')}} onNewPatient={()=>setScreen('newpatient')}/>}
        {screen==='newpatient'&&<NewPatientScreen onBack={()=>setScreen('scan')}/>}
        {screen==='schedule'&&<ScheduleScreen/>}
        {screen==='consultation'&&<ConsultationScreen activePatient={activePatient} staffMember={staffMember}/>}
        {screen==='records'&&<RecordsScreen activePatient={activePatient}/>}
        {screen==='inventory'&&<InventoryScreen/>}
        {screen==='payment'&&<PaymentScreen/>}
        {screen==='claims'&&<ClaimsScreen/>}
      </div>
      <PatientQueueDetail entry={selectedQueueEntry} onClose={()=>setSelectedQueueEntry(null)}/>
    </div>
  )
}
