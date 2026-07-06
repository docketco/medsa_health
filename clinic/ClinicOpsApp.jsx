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

// ── OVERVIEW: everything about running the clinic today, at a glance ────────
function OverviewScreen({ isEn, queue }) {
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

// ── CLAIMS: direct insurance claim submission from the clinic side ──────────
// This is the "seamless middleman" pitch — clinic submits directly, patient
// consent already on file via Medsa, syncs straight to the insurer.
function ClaimsScreen({ isEn }) {
  const [step,setStep]=useState('list') // list | new | submitted
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
          {isEn
            ?'Patient consent is already on file via Medsa. Submit the claim directly — no separate paperwork, no re-entering patient details.'
            :'病人同意已透過Medsa記錄在案。直接提交索賠 — 無需額外文書工作。'}
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
export default function ClinicOpsApp({ liveData={} }) {
  const [screen,setScreen]=useState('overview')
  const [isEn,setIsEn]=useState(true)

  const queue = [
    {ticket:'A12', patientName:'Wong Mei-ling, Lisa', doctor:'Dr Chan', room:'Room 1', status:'in_room'},
    {ticket:'A13', patientName:'Chan Tai-man', doctor:'Dr Lam', room:'Room 2', status:'in_room'},
    {ticket:'A14', patientName:'Lee Siu-fong', doctor:'Dr Chan', room:'—', status:'waiting'},
    {ticket:'A15', patientName:'Ho Ka-yee', doctor:'Dr Lam', room:'—', status:'waiting'},
    {ticket:'A10', patientName:'Yip Wing-sze', doctor:'Dr Chan', room:'—', status:'done'},
  ]

  const navItems=[
    {key:'overview', icon:'▣', en:'Overview', zh:'總覽'},
    {key:'claims', icon:'◈', en:'Claims', zh:'索賠'},
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',maxWidth:'440px',margin:'0 auto',background:C.beige}}>
      <div style={{background:C.green,padding:'14px 16px',display:'flex',alignItems:'center',gap:'10px',position:'sticky',top:0,zIndex:10}}>
        <span style={{fontSize:'17px',fontWeight:600,color:'#fff'}}>{isEn?'Clinic Operations':'診所營運'}</span>
        <div style={{flex:1}}/>
        <button onClick={()=>setIsEn(!isEn)} style={{background:'rgba(255,255,255,0.18)',border:'none',color:'#fff',fontSize:'11px',padding:'4px 10px',borderRadius:'20px',cursor:'pointer'}}>{isEn?'廣東話':'EN'}</button>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        {screen==='overview'&&<OverviewScreen isEn={isEn} queue={queue}/>}
        {screen==='claims'&&<ClaimsScreen isEn={isEn}/>}
      </div>

      <div style={{background:C.cream,borderTop:`0.5px solid ${C.border}`,display:'flex',padding:'8px 0 6px',position:'sticky',bottom:0}}>
        {navItems.map(item=>(
          <div key={item.key} onClick={()=>setScreen(item.key)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',cursor:'pointer',color:screen===item.key?C.green:C.textMuted,fontSize:'10px'}}>
            <span style={{fontSize:'20px',lineHeight:1}}>{item.icon}</span>
            <span>{isEn?item.en:item.zh}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

