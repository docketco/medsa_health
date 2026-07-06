import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import C from '../shared/colours'

function Btn({ children, onClick, variant='secondary', style:sx={}, disabled }) {
  const base={border:'none',borderRadius:'10px',padding:'10px 16px',fontSize:'13px',fontWeight:500,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:disabled?0.5:1,...sx}
  const V={primary:{background:C.green,color:'#fff'},secondary:{background:C.card,color:C.text,border:`0.5px solid ${C.border}`},danger:{background:C.red,color:'#fff'},amber:{background:C.amber,color:'#fff'}}
  return <button style={{...base,...V[variant]}} onClick={onClick} disabled={disabled}>{children}</button>
}
function Card({ children, style:sx={}, onClick }) {
  return <div onClick={onClick} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',margin:'0 16px 10px',overflow:'hidden',cursor:onClick?'pointer':'default',...sx}}>{children}</div>
}
function SecLabel({ children }) {
  return <div style={{fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.9px',color:C.textMuted,padding:'16px 16px 8px'}}>{children}</div>
}
function StatCard({ label, value, sub, color=C.green, bg=C.greenLight }) {
  return (
    <div style={{flex:1,background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px'}}>
      <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px',fontWeight:600,textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:'20px',fontWeight:700,color}}>{value}</div>
      {sub&&<div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>{sub}</div>}
    </div>
  )
}
function Badge({ text, type }) {
  const map={ok:[C.greenLight,C.green],due:[C.amberLight,C.amber],full:[C.redLight,C.red],waiting:[C.blueLight,C.blue]}
  const [bg,fg]=map[type]||map.ok
  return <span style={{fontSize:'10px',background:bg,color:fg,padding:'3px 9px',borderRadius:'20px',fontWeight:500,whiteSpace:'nowrap'}}>{text}</span>
}

// ── PATIENT SCAN / CHECK-IN ──────────────────────────────────────────────────
function ScanCheckInScreen({ isEn, onCheckedIn }) {
  const [stage,setStage]=useState('idle')
  const [patient,setPatient]=useState(null)
  const [searchTerm,setSearchTerm]=useState('')

  async function simulateScan() {
    setStage('scanning')
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('medsa_id', 'MDS-84921-HK')
      .single()
    if (error || !data) { setStage('error'); return }
    setPatient(data)
    setStage('found')
  }

  function confirmCheckIn() {
    onCheckedIn(patient)
    setStage('idle')
    setPatient(null)
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      {stage==='idle'&&<>
        <div style={{margin:'24px 16px',background:C.cream,border:`1.5px dashed ${C.border}`,borderRadius:'16px',padding:'40px 20px',textAlign:'center',cursor:'pointer'}} onClick={simulateScan}>
          <div style={{fontSize:'40px',color:C.green,marginBottom:'12px'}}>⬡</div>
          <div style={{fontSize:'15px',fontWeight:600,marginBottom:'4px'}}>{isEn?'Tap to scan patient QR':'點擊掃描病人二維碼'}</div>
          <div style={{fontSize:'12px',color:C.textSub}}>{isEn?'Checks in patient and pulls their Medsa record':'為病人辦理登記並讀取Medsa記錄'}</div>
        </div>
        <SecLabel>{isEn?'Or search manually':'或手動搜尋'}</SecLabel>
        <div style={{padding:'0 16px'}}>
          <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'11px 14px',fontSize:'14px',background:C.cream,outline:'none'}} placeholder={isEn?'Search by name or Medsa ID…':'按姓名或Medsa編號搜尋…'}/>
        </div>
      </>}
      {stage==='scanning'&&<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 24px'}}>
        <div style={{width:40,height:40,border:`3px solid ${C.greenLight}`,borderTop:`3px solid ${C.green}`,borderRadius:'50%',animation:'spin 1s linear infinite',marginBottom:'16px'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{fontSize:'13px',color:C.textSub}}>{isEn?'Reading QR code…':'讀取二維碼中…'}</div>
      </div>}
      {stage==='found'&&patient&&<div style={{padding:'16px'}}>
        <div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'14px',padding:'18px'}}>
          <div style={{fontSize:'11px',color:C.green,fontWeight:600,marginBottom:'8px',textTransform:'uppercase'}}>✓ {isEn?'Patient found':'找到病人'}</div>
          <div style={{fontSize:'17px',fontWeight:700}}>{patient.full_name}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>{patient.medsa_id} · {isEn?'DOB':'出生日期'} {new Date(patient.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
          <div style={{display:'flex',gap:'8px'}}>
            <div style={{flex:1,background:'#fff',borderRadius:'8px',padding:'8px',textAlign:'center'}}>
              <div style={{fontSize:'10px',color:C.textMuted}}>{isEn?'Blood type':'血型'}</div>
              <div style={{fontSize:'16px',fontWeight:700,color:C.red}}>{patient.blood_type||'—'}</div>
            </div>
            <div style={{flex:2,background:'#fff',borderRadius:'8px',padding:'8px'}}>
              <div style={{fontSize:'10px',color:C.textMuted}}>{isEn?'Emergency card':'緊急卡'}</div>
              <div style={{fontSize:'12px',fontWeight:600,color:patient.emergency_card_active?C.green:C.textMuted}}>{patient.emergency_card_active?(isEn?'Active ✓':'已啟用 ✓'):(isEn?'Not set up':'未設置')}</div>
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
          <Btn style={{flex:1}} onClick={()=>setStage('idle')}>{isEn?'Cancel':'取消'}</Btn>
          <Btn variant="primary" style={{flex:1}} onClick={confirmCheckIn}>{isEn?'Check in':'辦理登記'}</Btn>
        </div>
      </div>}
      {stage==='error'&&<div style={{padding:'40px 24px',textAlign:'center'}}>
        <div style={{fontSize:'32px',marginBottom:'12px'}}>◎</div>
        <div style={{fontSize:'14px',color:C.textSub,marginBottom:'16px'}}>{isEn?'Patient not found. Try manual search.':'找不到病人。請嘗試手動搜尋。'}</div>
        <Btn onClick={()=>setStage('idle')}>{isEn?'Try again':'重試'}</Btn>
      </div>}
    </div>
  )
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────
function OverviewScreen({ isEn, queue, onNav }) {
  const waiting = queue.filter(q=>q.status==='waiting').length
  const inRoom = queue.filter(q=>q.status==='in_room').length
  const done = queue.filter(q=>q.status==='done').length

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{padding:'16px 16px 8px',display:'flex',gap:'8px'}}>
        <StatCard label={isEn?'Waiting':'等候中'} value={waiting} sub={isEn?'patients':'位病人'} color={C.amber} bg={C.amberLight}/>
        <StatCard label={isEn?'In room':'診症中'} value={inRoom} sub={isEn?'now':'現在'} color={C.blue} bg={C.blueLight}/>
        <StatCard label={isEn?'Seen today':'今日已看診'} value={done} sub={isEn?'completed':'已完成'} color={C.green} bg={C.greenLight}/>
      </div>

      <SecLabel>{isEn?"Today's revenue":'今日收入'}</SecLabel>
      <Card style={{padding:'16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'10px'}}>
          <div style={{fontSize:'24px',fontWeight:700,color:C.green}}>HK$4,820</div>
          <div style={{fontSize:'11px',color:C.textMuted}}>{isEn?'12 consultations':'12次診症'}</div>
        </div>
        <div style={{display:'flex',gap:'12px',fontSize:'11px',color:C.textSub}}>
          <span>◎ {isEn?'Patient pay: HK$1,920':'病人自付：HK$1,920'}</span>
          <span>◈ {isEn?'Insurance: HK$2,900':'保險：HK$2,900'}</span>
        </div>
      </Card>

      <SecLabel>{isEn?'Quick actions':'快速操作'}</SecLabel>
      <div style={{padding:'0 16px 8px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
        <div onClick={()=>onNav('scan')} style={{background:C.greenLight,borderRadius:'12px',padding:'14px',cursor:'pointer',textAlign:'center'}}>
          <div style={{fontSize:'22px',marginBottom:'4px'}}>⬡</div>
          <div style={{fontSize:'12px',fontWeight:600,color:C.green}}>{isEn?'Scan patient':'掃描病人'}</div>
        </div>
        <div onClick={()=>onNav('schedule')} style={{background:C.blueLight,borderRadius:'12px',padding:'14px',cursor:'pointer',textAlign:'center'}}>
          <div style={{fontSize:'22px',marginBottom:'4px'}}>◇</div>
          <div style={{fontSize:'12px',fontWeight:600,color:C.blue}}>{isEn?'Schedule':'排程'}</div>
        </div>
      </div>

      <SecLabel>{isEn?'Patient queue — all doctors':'病人排隊 — 所有醫生'}</SecLabel>
      {queue.map((q,i)=>(
        <Card key={i} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{width:32,height:32,borderRadius:'8px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,flexShrink:0}}>{q.ticket}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:'13px',fontWeight:500}}>{q.patientName}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{q.doctor} · {q.room}</div>
          </div>
          <Badge text={q.status==='waiting'?(isEn?'Waiting':'等候'):q.status==='in_room'?(isEn?'In room':'診症中'):(isEn?'Done':'完成')} type={q.status==='waiting'?'due':q.status==='in_room'?'waiting':'ok'}/>
        </Card>
      ))}

      <SecLabel>{isEn?'Room status':'診症室狀態'}</SecLabel>
      <div style={{padding:'0 16px 16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
        {[
          {room:'Room 1', doctor:'Dr Chan', status:'occupied'},
          {room:'Room 2', doctor:'Dr Lam', status:'occupied'},
          {room:'Room 3', doctor:'—', status:'free'},
        ].map((r,i)=>(
          <div key={i} style={{background:r.status==='occupied'?C.redLight:C.greenXLight,border:`0.5px solid ${r.status==='occupied'?C.red:C.green}`,borderRadius:'10px',padding:'10px'}}>
            <div style={{fontSize:'12px',fontWeight:600}}>{r.room}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{r.status==='occupied'?r.doctor:(isEn?'Available':'空閒')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SCHEDULE ──────────────────────────────────────────────────────────────
function ScheduleScreen({ isEn }) {
  const [selectedDay,setSelectedDay]=useState(24)
  const [showNewApptForm,setShowNewApptForm]=useState(false)

  const appointments = [
    {time:'09:00', patient:'Wong Mei-ling, Lisa', doctor:'Dr Chan', type:'Follow-up', status:'confirmed'},
    {time:'09:30', patient:'Chan Tai-man', doctor:'Dr Lam', type:'New patient', status:'confirmed'},
    {time:'10:00', patient:'—', doctor:'Dr Chan', type:'Open slot', status:'open'},
    {time:'10:30', patient:'Lee Siu-fong', doctor:'Dr Chan', type:'Vaccination', status:'confirmed'},
    {time:'11:00', patient:'Ho Ka-yee', doctor:'Dr Lam', type:'Consultation', status:'confirmed'},
    {time:'11:30', patient:'—', doctor:'Dr Lam', type:'Open slot', status:'open'},
    {time:'14:00', patient:'Yip Wing-sze', doctor:'Dr Chan', type:'Follow-up', status:'pending'},
  ]

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:C.cream,border:`0.5px solid ${C.border}`,margin:'16px 16px 0',borderRadius:'14px',padding:'14px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
          <span style={{fontSize:'14px',fontWeight:600}}>{isEn?'June 2026':'2026年6月'}</span>
          <div style={{display:'flex',gap:'6px'}}>
            <button style={{background:C.card,border:'none',borderRadius:'50%',width:26,height:26,cursor:'pointer',fontSize:'13px'}}>‹</button>
            <button style={{background:C.card,border:'none',borderRadius:'50%',width:26,height:26,cursor:'pointer',fontSize:'13px'}}>›</button>
          </div>
        </div>
        <div style={{display:'flex',gap:'6px',overflowX:'auto'}}>
          {[22,23,24,25,26,27,28].map(d=>(
            <div key={d} onClick={()=>setSelectedDay(d)} style={{flexShrink:0,textAlign:'center',padding:'8px 12px',borderRadius:'10px',background:d===selectedDay?C.green:C.card,color:d===selectedDay?'#fff':C.text,cursor:'pointer',minWidth:44}}>
              <div style={{fontSize:'16px',fontWeight:600}}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <SecLabel>{isEn?'All doctors — today':'所有醫生 — 今天'}</SecLabel>
      {appointments.map((a,i)=>(
        <Card key={i} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',opacity:a.status==='open'?0.6:1}}>
          <div style={{fontSize:'13px',fontWeight:700,color:C.text,width:44,flexShrink:0}}>{a.time}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:'13px',fontWeight:500}}>{a.patient}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{a.doctor} · {a.type}</div>
          </div>
          {a.status==='open'
            ?<Btn style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>setShowNewApptForm(true)}>{isEn?'+ Book':'+ 預約'}</Btn>
            :<Badge text={a.status==='confirmed'?(isEn?'Confirmed':'已確認'):(isEn?'Pending':'待定')} type={a.status==='confirmed'?'ok':'due'}/>}
        </Card>
      ))}

      <div style={{padding:'8px 16px 16px'}}>
        <Btn variant="primary" style={{width:'100%'}} onClick={()=>setShowNewApptForm(true)}>+ {isEn?'New appointment':'新預約'}</Btn>
      </div>

      {showNewApptForm&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={()=>setShowNewApptForm(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:440,padding:'24px'}}>
          <div style={{fontSize:'16px',fontWeight:700,marginBottom:'16px'}}>{isEn?'New appointment':'新預約'}</div>
          <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'11px',fontSize:'14px',marginBottom:'10px',background:'#fff'}} placeholder={isEn?'Patient name or Medsa ID':'病人姓名或Medsa編號'}/>
          <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
            <input style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'11px',fontSize:'14px',background:'#fff'}} placeholder={isEn?'Time':'時間'}/>
            <select style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'11px',fontSize:'14px',background:'#fff'}}>
              <option>Dr Chan</option>
              <option>Dr Lam</option>
            </select>
          </div>
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>setShowNewApptForm(false)}>{isEn?'Confirm booking':'確認預約'}</Btn>
        </div>
      </div>}
    </div>
  )
}

// ── PAYMENT ───────────────────────────────────────────────────────────────
function PaymentScreen({ isEn }) {
  const [method,setMethod]=useState('card')
  const [paid,setPaid]=useState(false)

  const bill = {patient:'Wong Mei-ling, Lisa', consultFee:380, insurerCovers:300, patientPays:80}

  if (paid) return (
    <div style={{background:C.beige,flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 24px',textAlign:'center'}}>
      <div style={{fontSize:'40px',marginBottom:'12px'}}>✓</div>
      <div style={{fontSize:'16px',fontWeight:700,marginBottom:'6px'}}>{isEn?'Payment received':'已收款'}</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px'}}>HK${bill.patientPays} · {bill.patient}</div>
      <Btn variant="primary" onClick={()=>setPaid(false)}>{isEn?'New payment':'新付款'}</Btn>
    </div>
  )

  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>{isEn?'Collect payment':'收取付款'}</SecLabel>
      <Card style={{padding:'16px'}}>
        <div style={{fontSize:'13px',fontWeight:600,marginBottom:'10px'}}>{bill.patient}</div>
        {[['Consultation fee',`HK$${bill.consultFee}`],['Insurance covers',`−HK$${bill.insurerCovers}`],['Patient pays',`HK$${bill.patientPays}`]].map(([l,v],i)=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:i<2?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}>
            <span style={{color:C.textSub}}>{l}</span>
            <span style={{fontWeight:i===2?700:500,fontSize:i===2?'16px':'13px',color:i===2?C.green:C.text}}>{v}</span>
          </div>
        ))}
      </Card>

      <SecLabel>{isEn?'Payment method':'付款方式'}</SecLabel>
      <div style={{padding:'0 16px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'12px'}}>
        {[['card',isEn?'Card':'卡','◈'],['octopus',isEn?'Octopus':'八達通','◉'],['cash',isEn?'Cash':'現金','◎']].map(([k,l,icon])=>(
          <div key={k} onClick={()=>setMethod(k)} style={{padding:'14px 8px',borderRadius:'10px',textAlign:'center',cursor:'pointer',background:method===k?C.green:C.card,color:method===k?'#fff':C.text}}>
            <div style={{fontSize:'18px',marginBottom:'4px'}}>{icon}</div>
            <div style={{fontSize:'11px',fontWeight:500}}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{padding:'8px 16px 16px'}}>
        <Btn variant="primary" style={{width:'100%',padding:'14px'}} onClick={()=>setPaid(true)}>{isEn?`Charge HK$${bill.patientPays}`:`收取 HK$${bill.patientPays}`}</Btn>
      </div>
    </div>
  )
}

// ── RECORDS ───────────────────────────────────────────────────────────────
function RecordsScreen({ isEn, activePatient }) {
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
      setRecords(r||[])
      setConditions(c||[])
      setAllergies(a||[])
      setLoading(false)
    }
    load()
  }, [activePatient])

  if (!activePatient) return (
    <div style={{background:C.beige,flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 24px',textAlign:'center'}}>
      <div style={{fontSize:'32px',marginBottom:'12px',color:C.textMuted}}>◎</div>
      <div style={{fontSize:'14px',color:C.textSub}}>{isEn?'Scan or check in a patient to view their medical records':'掃描或登記病人以查看其醫療記錄'}</div>
    </div>
  )

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px 0',background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'14px',padding:'14px 16px'}}>
        <div style={{fontSize:'15px',fontWeight:700}}>{activePatient.full_name}</div>
        <div style={{fontSize:'12px',color:C.textSub}}>{activePatient.medsa_id} · {isEn?'Blood type':'血型'} {activePatient.blood_type}</div>
      </div>

      {allergies.length>0&&<>
        <SecLabel>{isEn?'Allergies':'過敏'}</SecLabel>
        <Card style={{padding:'12px 16px'}}>
          {allergies.map((a,i,arr)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>
              <span style={{fontSize:'13px',fontWeight:600,color:a.severity==='severe'?C.red:C.text}}>⚠ {a.allergen}</span>
              <Badge text={a.severity} type={a.severity==='severe'?'full':'due'}/>
            </div>
          ))}
        </Card>
      </>}

      {conditions.length>0&&<>
        <SecLabel>{isEn?'Active conditions':'現有病況'}</SecLabel>
        <Card style={{padding:'12px 16px'}}>
          {conditions.map((c,i,arr)=>(
            <div key={i} style={{padding:'6px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}>◎ {c.condition_name} {c.severity&&<span style={{color:C.textMuted}}>({c.severity})</span>}</div>
          ))}
        </Card>
      </>}

      <SecLabel>{isEn?'Recent records':'最近記錄'}</SecLabel>
      {loading&&<div style={{padding:'20px',textAlign:'center',fontSize:'12px',color:C.textMuted}}>{isEn?'Loading…':'載入中…'}</div>}
      {!loading&&records.length===0&&<div style={{padding:'20px',textAlign:'center',fontSize:'12px',color:C.textMuted}}>{isEn?'No records found':'沒有記錄'}</div>}
      {records.map((r,i)=>(
        <Card key={i} style={{padding:'12px 16px'}}>
          <div style={{fontSize:'13px',fontWeight:600}}>{r.title}</div>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'4px'}}>{r.institutions?.name||'—'} · {new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
          {r.notes&&<div style={{fontSize:'12px',color:C.textSub,fontStyle:'italic'}}>{r.notes}</div>}
        </Card>
      ))}
    </div>
  )
}

// ── CLAIMS ────────────────────────────────────────────────────────────────
function ClaimsScreen({ isEn }) {
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
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px 0',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'14px',padding:'14px 16px'}}>
        <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'4px'}}>◈ {isEn?'Direct-to-insurer submission':'直接向保險公司提交'}</div>
        <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>
          {isEn?'Patient consent is already on file via Medsa. Submit the claim directly — no separate paperwork.':'病人同意已透過Medsa記錄在案。直接提交索賠。'}
        </div>
      </div>
      <SecLabel>{isEn?'Recent claims':'最近索賠'}</SecLabel>
      {existingClaims.map((c,i)=>(
        <Card key={i} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:500}}>{c.ref} · {c.patient}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{c.insurer} · {c.date}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'14px',fontWeight:600,color:C.green}}>HK${c.amount}</div>
            <Badge text={c.status==='approved'?(isEn?'Approved':'已批准'):(isEn?'Pending':'待處理')} type={c.status==='approved'?'ok':'due'}/>
          </div>
        </Card>
      ))}
      <div style={{padding:'8px 16px 16px'}}>
        <Btn variant="primary" style={{width:'100%'}} onClick={()=>setStep('new')}>+ {isEn?'Submit new claim':'提交新索賠'}</Btn>
      </div>
    </div>
  )

  if (step==='new') return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{padding:'12px 16px 4px'}}>
        <div onClick={()=>setStep('list')} style={{fontSize:'12px',color:C.green,cursor:'pointer'}}>← {isEn?'Back':'返回'}</div>
      </div>
      <SecLabel>{isEn?'Select patient':'選擇病人'}</SecLabel>
      {patients.map((p,i)=>(
        <Card key={i} onClick={()=>p.consented&&setSelectedPatient(p)} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',opacity:p.consented?1:0.5,border:selectedPatient?.medsaId===p.medsaId?`1.5px solid ${C.green}`:undefined}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:500}}>{p.name}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{p.medsaId} · {p.plan}</div>
          </div>
          {p.consented
            ?<span style={{fontSize:'11px',color:C.green,fontWeight:600}}>✓ {isEn?'Consented':'已同意'}</span>
            :<span style={{fontSize:'11px',color:C.textMuted}}>{isEn?'No consent on file':'無同意記錄'}</span>}
        </Card>
      ))}
      {selectedPatient&&<>
        <SecLabel>{isEn?'Claim type':'索賠類型'}</SecLabel>
        <div style={{padding:'0 16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px'}}>
          {['outpatient','hospitalisation','specialist','lab'].map(t=>(
            <div key={t} onClick={()=>setClaimType(t)} style={{padding:'10px',borderRadius:'10px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:claimType===t?C.green:C.card,color:claimType===t?'#fff':C.text,textTransform:'capitalize'}}>{t}</div>
          ))}
        </div>
        <SecLabel>{isEn?'Auto-attached from Medsa':'自動附加自Medsa'}</SecLabel>
        <Card style={{padding:'14px 16px'}}>
          {['Consultation record','Diagnosis on file','Patient ID & policy number'].map((item,i,arr)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>
              <span style={{color:C.green,fontSize:'12px'}}>✓</span>
              <span style={{fontSize:'12px'}}>{item}</span>
            </div>
          ))}
        </Card>
        <div style={{padding:'8px 16px 16px'}}>
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>setStep('submitted')}>{isEn?`Submit to ${selectedPatient.plan.split(' ')[0]}`:'提交至保險公司'}</Btn>
        </div>
      </>}
    </div>
  )

  return (
    <div style={{background:C.beige,flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 24px',textAlign:'center'}}>
      <div style={{fontSize:'40px',marginBottom:'12px'}}>✓</div>
      <div style={{fontSize:'16px',fontWeight:700,marginBottom:'6px'}}>{isEn?'Claim submitted':'索賠已提交'}</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px'}}>{isEn?`Sent directly to ${selectedPatient?.plan}. No separate paperwork needed.`:'已直接發送至保險公司。'}</div>
      <Btn variant="primary" onClick={()=>{setStep('list');setSelectedPatient(null)}}>{isEn?'Done':'完成'}</Btn>
    </div>
  )
}

// ── ROOT ──────────────────────────────────────────────────────────────────
export default function ClinicOpsApp() {
  const [screen,setScreen]=useState('overview')
  const [isEn,setIsEn]=useState(true)
  const [activePatient,setActivePatient]=useState(null)

  const queue = [
    {ticket:'A12', patientName:'Wong Mei-ling, Lisa', doctor:'Dr Chan', room:'Room 1', status:'in_room'},
    {ticket:'A13', patientName:'Chan Tai-man', doctor:'Dr Lam', room:'Room 2', status:'in_room'},
    {ticket:'A14', patientName:'Lee Siu-fong', doctor:'Dr Chan', room:'—', status:'waiting'},
    {ticket:'A15', patientName:'Ho Ka-yee', doctor:'Dr Lam', room:'—', status:'waiting'},
    {ticket:'A10', patientName:'Yip Wing-sze', doctor:'Dr Chan', room:'—', status:'done'},
  ]

  const navItems=[
    {key:'overview', icon:'▣', en:'Overview', zh:'總覽'},
    {key:'scan', icon:'⬡', en:'Scan', zh:'掃描'},
    {key:'schedule', icon:'◇', en:'Schedule', zh:'排程'},
    {key:'records', icon:'◎', en:'Records', zh:'記錄'},
    {key:'payment', icon:'◈', en:'Payment', zh:'付款'},
    {key:'claims', icon:'◉', en:'Claims', zh:'索賠'},
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',maxWidth:'440px',margin:'0 auto',background:C.beige}}>
      <div style={{background:C.green,padding:'14px 16px',display:'flex',alignItems:'center',gap:'10px',position:'sticky',top:0,zIndex:10}}>
        <span style={{fontSize:'16px',fontWeight:600,color:'#fff'}}>{isEn?'Clinic Operations':'診所營運'}</span>
        {activePatient&&<span style={{fontSize:'10px',background:'rgba(255,255,255,0.2)',color:'#fff',padding:'3px 8px',borderRadius:'20px'}}>{activePatient.full_name.split(',')[0]}</span>}
        <div style={{flex:1}}/>
        <button onClick={()=>setIsEn(!isEn)} style={{background:'rgba(255,255,255,0.18)',border:'none',color:'#fff',fontSize:'11px',padding:'4px 10px',borderRadius:'20px',cursor:'pointer'}}>{isEn?'廣東話':'EN'}</button>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        {screen==='overview'&&<OverviewScreen isEn={isEn} queue={queue} onNav={setScreen}/>}
        {screen==='scan'&&<ScanCheckInScreen isEn={isEn} onCheckedIn={(p)=>{setActivePatient(p);setScreen('records')}}/>}
        {screen==='schedule'&&<ScheduleScreen isEn={isEn}/>}
        {screen==='records'&&<RecordsScreen isEn={isEn} activePatient={activePatient}/>}
        {screen==='payment'&&<PaymentScreen isEn={isEn}/>}
        {screen==='claims'&&<ClaimsScreen isEn={isEn}/>}
      </div>

      <div style={{background:C.cream,borderTop:`0.5px solid ${C.border}`,display:'flex',padding:'8px 0 6px',position:'sticky',bottom:0,overflowX:'auto'}}>
        {navItems.map(item=>(
          <div key={item.key} onClick={()=>setScreen(item.key)} style={{flex:1,minWidth:56,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',cursor:'pointer',color:screen===item.key?C.green:C.textMuted,fontSize:'9px'}}>
            <span style={{fontSize:'18px',lineHeight:1}}>{item.icon}</span>
            <span>{isEn?item.en:item.zh}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
