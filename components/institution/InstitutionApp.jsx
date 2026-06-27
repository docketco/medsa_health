import { useState } from 'react'
import MedsaLogo from '../shared/MedsaLogo'
import C from '../shared/colours'

function Btn({ children, onClick, variant='secondary', style:sx={}, disabled }) {
  const base={border:'none',borderRadius:'10px',padding:'10px 16px',fontSize:'13px',fontWeight:500,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:disabled?0.5:1,...sx}
  const V={primary:{background:C.green,color:'#fff'},secondary:{background:C.card,color:C.text,border:`0.5px solid ${C.border}`},danger:{background:C.red,color:'#fff'},amber:{background:C.amber,color:'#fff'},navy:{background:C.navy,color:'#fff'},purple:{background:C.purple,color:'#fff'}}
  return <button style={{...base,...V[variant]}} onClick={onClick} disabled={disabled}>{children}</button>
}
function Card({ children, style:sx={}, onClick }) {
  return <div onClick={onClick} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',margin:'0 16px 10px',overflow:'hidden',cursor:onClick?'pointer':'default',...sx}}>{children}</div>
}
function SecLabel({ children }) {
  return <div style={{fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.9px',color:C.textMuted,padding:'16px 16px 8px'}}>{children}</div>
}
function Toggle({ checked=false }) {
  const [on,setOn]=useState(checked)
  return <div onClick={()=>setOn(!on)} style={{width:34,height:18,borderRadius:20,background:on?C.green:C.border,cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}><div style={{position:'absolute',top:2,left:on?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/></div>
}
function InfoRow({ label, value, highlight=false, last=false }) {
  return <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:last?'none':`0.5px solid ${C.border}`,fontSize:'13px'}}><span style={{color:C.textSub}}>{label}</span><span style={{fontWeight:500,color:highlight?C.red:C.text,textAlign:'right',maxWidth:'60%'}}>{value}</span></div>
}
function StatCard({ icon, label, value, sub, color=C.green, bg=C.greenLight }) {
  return (
    <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px',flex:1}}>
      <div style={{width:36,height:36,background:bg,borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',color,marginBottom:'10px'}}>{icon}</div>
      <div style={{fontSize:'22px',fontWeight:700,color:C.text}}>{value}</div>
      <div style={{fontSize:'12px',fontWeight:500,color:C.text,marginTop:'2px'}}>{label}</div>
      {sub&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{sub}</div>}
    </div>
  )
}

const PRACTITIONERS=[
  {name:'Dr Chan Siu-ming',dept:'Internal Medicine',role:'Doctor',tier:2,status:'Active',license:'HK-MED-48291'},
  {name:'Dr Ho Ka-fai',dept:'Internal Medicine',role:'Doctor',tier:2,status:'Active',license:'HK-MED-51033'},
  {name:'Nurse Yip Mei',dept:'Internal Medicine',role:'Nurse',tier:3,status:'Active',license:'HK-NUR-22841'},
  {name:'Nurse Wong Chi',dept:'Emergency',role:'Nurse',tier:3,status:'On leave',license:'HK-NUR-31092'},
  {name:'Dr Lam Wai-yee',dept:'Cardiology',role:'Dept Head',tier:1,status:'Active',license:'HK-MED-39284'},
  {name:'Receptionist Lam',dept:'Admin',role:'Receptionist',tier:4,status:'Active',license:'HK-ADM-10291'},
  {name:'Dr Cheng Ka-wai',dept:'Psychiatry',role:'Psychiatrist',tier:2,status:'Active',license:'HK-MED-44102'},
  {name:'Pharmacist Ho',dept:'Pharmacy',role:'Pharmacist',tier:3,status:'Active',license:'HK-PHA-18833'},
]

const PATIENTS=[
  {name:'Wong Mei-ling, Lisa',id:'MDS-84921-HK',dob:'14 Mar 1988',dept:'Internal Medicine',admitted:'20 Jun 2025',reason:'Diabetic review — elevated glucose, persistent fatigue',status:'Admitted',registered:true,consent:'One-time ✓'},
  {name:'Chan Wai-man',id:'MDS-72310-HK',dob:'5 Jul 1965',dept:'Cardiology',admitted:'21 Jun 2025',reason:'Chest pain, shortness of breath on exertion',status:'Admitted',registered:true,consent:'One-time ✓'},
  {name:'Lee Siu-fong',id:'Unregistered',dob:'12 Nov 1990',dept:'Internal Medicine',admitted:'22 Jun 2025',reason:'Persistent cough, fever for 5 days',status:'Admitted',registered:false,consent:'Session only'},
  {name:'Ng Ka-wai',id:'MDS-55021-HK',dob:'30 Aug 1978',dept:'Surgery',admitted:'18 Jun 2025',reason:'Post-op appendectomy recovery',status:'Recovering',registered:true,consent:'One-time ✓'},
  {name:'Lam Yee-ting',id:'Unregistered',dob:'7 Feb 2001',dept:'Emergency',admitted:'23 Jun 2025',reason:'Ankle fracture from fall injury',status:'Discharged',registered:false,consent:'Session only'},
]

// ── INSTITUTION DASHBOARD ─────────────────────────────────────────────────────
function InstitutionDashboard({ onNav }) {
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px 0',background:`linear-gradient(135deg,${C.green} 0%,${C.greenMid} 100%)`,borderRadius:'16px',padding:'20px',color:'#fff'}}>
        <div style={{fontSize:'11px',opacity:0.65,letterSpacing:'1px',textTransform:'uppercase'}}>Queen Elizabeth Hospital</div>
        <div style={{fontSize:'18px',fontWeight:700,marginTop:'4px'}}>Good morning, Admin</div>
        <div style={{fontSize:'13px',opacity:0.8,marginTop:'2px'}}>Tue 24 Jun · Institution Admin</div>
      </div>
      <SecLabel>Live overview</SecLabel>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',padding:'0 16px'}}>
        <StatCard icon="◎" label="Patients admitted" value="41" sub="↑3 since yesterday"/>
        <StatCard icon="◈" label="Staff on shift" value="28" sub="of 34 scheduled"/>
        <StatCard icon="▣" label="Beds occupied" value="38/50" sub="76% occupancy" color={C.amber} bg={C.amberLight}/>
        <StatCard icon="◇" label="Pending discharges" value="6" sub="expected today" color={C.blue} bg={C.blueLight}/>
      </div>
      <SecLabel>Quick access</SecLabel>
      <div style={{padding:'0 16px'}}>
        {[
          {key:'practitioners',icon:'◈',label:'Practitioner list',sub:'Search, view credentials, departments'},
          {key:'patients',icon:'◎',label:'Patient list',sub:'Records, admission reasons, status'},
          {key:'schedule',icon:'▣',label:'Full schedule',sub:'By department or tier'},
          {key:'occupancy',icon:'◉',label:'Occupancy & busy rate',sub:'Beds, wait times, department load'},
          {key:'portals',icon:'⬡',label:'Portal management',sub:'Create, approve, cancel portals'},
        ].map(item=>(
          <div key={item.key} onClick={()=>onNav(item.key)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px 16px',marginBottom:'10px',cursor:'pointer',display:'flex',alignItems:'center',gap:'14px'}}>
            <div style={{width:40,height:40,background:C.greenLight,borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.green,flexShrink:0}}>{item.icon}</div>
            <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{item.label}</div><div style={{fontSize:'12px',color:C.textSub}}>{item.sub}</div></div>
            <span style={{color:C.textMuted,fontSize:'18px'}}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── PRACTITIONER LIST ─────────────────────────────────────────────────────────
function PractitionerList({ onBack }) {
  const [sel,setSel]=useState(null)
  const [filter,setFilter]=useState('All')
  const depts=['All','Internal Medicine','Cardiology','Emergency','Surgery','Psychiatry','Pharmacy','Admin']
  const filtered=filter==='All'?PRACTITIONERS:PRACTITIONERS.filter(p=>p.dept===filter)
  if(sel!==null) {
    const p=PRACTITIONERS[sel]
    return (
      <div style={{background:C.beige,flex:1}}>
        <div style={{padding:'14px 16px',background:C.cream,borderBottom:`0.5px solid ${C.border}`,display:'flex',alignItems:'center',gap:'10px'}}>
          <button onClick={()=>setSel(null)} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:'20px',padding:'4px 12px',fontSize:'11px',cursor:'pointer',fontFamily:'inherit'}}>← Back</button>
          <span style={{fontSize:'15px',fontWeight:600}}>{p.name}</span>
        </div>
        <SecLabel>Details</SecLabel>
        <Card style={{padding:'0 16px'}}>
          <InfoRow label="Department" value={p.dept}/>
          <InfoRow label="Role" value={p.role}/>
          <InfoRow label="Tier" value={`Tier ${p.tier}`}/>
          <InfoRow label="License" value={p.license}/>
          <InfoRow label="Status" value={p.status} highlight={p.status==='On leave'} last/>
        </Card>
        <SecLabel>Actions</SecLabel>
        <div style={{padding:'0 16px',display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <Btn style={{flex:1}}>View schedule</Btn>
          <Btn variant="amber" style={{flex:1}}>Edit permissions</Btn>
          <Btn variant="danger" style={{flex:1}}>Suspend portal</Btn>
        </div>
      </div>
    )
  }
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{padding:'12px 16px',background:C.cream,borderBottom:`0.5px solid ${C.border}`,position:'relative',display:'flex',alignItems:'center'}}>
        <span style={{position:'absolute',left:'28px',fontSize:'16px',color:C.green}}>◎</span>
        <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'10px 12px 10px 34px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit'}} placeholder="Search by name, role, department…"/>
      </div>
      <div style={{display:'flex',gap:'6px',padding:'10px 16px',overflowX:'auto'}}>
        {depts.map(d=><div key={d} onClick={()=>setFilter(d)} style={{flexShrink:0,padding:'5px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'12px',fontWeight:500,background:filter===d?C.green:C.card,color:filter===d?'#fff':C.textSub,border:`0.5px solid ${filter===d?C.green:C.border}`}}>{d}</div>)}
      </div>
      {filtered.map((p,i)=>(
        <Card key={i} onClick={()=>setSel(i)} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
          <div style={{width:40,height:40,borderRadius:'12px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:600,flexShrink:0}}>{p.name.split(' ').pop()[0]}</div>
          <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:600}}>{p.name}</div><div style={{fontSize:'11px',color:C.textSub}}>{p.role} · {p.dept}</div></div>
          <div style={{textAlign:'right'}}>
            <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',fontWeight:500,background:p.status==='Active'?C.greenLight:C.amberLight,color:p.status==='Active'?C.green:C.amber}}>{p.status}</span>
            <div style={{fontSize:'10px',color:C.textMuted,marginTop:'4px'}}>Tier {p.tier}</div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── PATIENT LIST ──────────────────────────────────────────────────────────────
function PatientList() {
  const [sel,setSel]=useState(null)
  if(sel!==null) {
    const p=PATIENTS[sel]
    return (
      <div style={{background:C.beige,flex:1}}>
        <div style={{padding:'14px 16px',background:C.cream,borderBottom:`0.5px solid ${C.border}`,display:'flex',alignItems:'center',gap:'10px'}}>
          <button onClick={()=>setSel(null)} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:'20px',padding:'4px 12px',fontSize:'11px',cursor:'pointer',fontFamily:'inherit'}}>← Back</button>
          <span style={{fontSize:'15px',fontWeight:600}}>{p.name}</span>
        </div>
        {!p.registered&&<div style={{margin:'16px 16px 0',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.amber}}>◇ Unregistered Medsa user. Records stored locally at this institution. Will sync to patient profile automatically on Medsa registration with govt ID.</div>}
        <SecLabel>Admission info</SecLabel>
        <Card style={{padding:'0 16px'}}>
          <InfoRow label="Medsa ID" value={p.id}/>
          <InfoRow label="DOB" value={p.dob}/>
          <InfoRow label="Department" value={p.dept}/>
          <InfoRow label="Admitted" value={p.admitted}/>
          <InfoRow label="Status" value={p.status}/>
          <InfoRow label="Consent" value={p.consent}/>
          <InfoRow label="Reason for admission" value={p.reason} last/>
        </Card>
        <SecLabel>Institution records (this hospital only)</SecLabel>
        <Card style={{padding:'12px 16px'}}>
          {['Vitals recorded on admission','Symptom log — Dr Chan 21 Jun','Blood panel ordered — results pending','Medication: Metformin continued'].map((r,i,arr)=>(
            <div key={i} style={{fontSize:'13px',color:C.textSub,padding:'5px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>{r}</div>
          ))}
        </Card>
        <SecLabel>Consent management</SecLabel>
        <Card>
          {[['One-time institution consent',true],['Allow full history access',false],['Sync to Medsa profile on registration',true]].map(([l,v],i,arr)=>(
            <div key={l} style={{padding:'11px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}>
              <span>{l}</span><Toggle checked={v}/>
            </div>
          ))}
        </Card>
      </div>
    )
  }
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{padding:'12px 16px',background:C.cream,borderBottom:`0.5px solid ${C.border}`,position:'relative',display:'flex',alignItems:'center'}}>
        <span style={{position:'absolute',left:'28px',fontSize:'16px',color:C.green}}>◎</span>
        <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'10px 12px 10px 34px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit'}} placeholder="Search by name or Medsa ID…"/>
      </div>
      <div style={{display:'flex',gap:'6px',padding:'10px 16px',overflowX:'auto'}}>
        {['All','Admitted','Recovering','Discharged'].map(s=>(
          <div key={s} style={{flexShrink:0,padding:'5px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'12px',fontWeight:500,background:C.card,color:C.textSub,border:`0.5px solid ${C.border}`}}>{s}</div>
        ))}
      </div>
      {PATIENTS.map((p,i)=>(
        <Card key={i} onClick={()=>setSel(i)} style={{padding:'14px 16px'}}>
          <div style={{display:'flex',gap:'12px',alignItems:'flex-start'}}>
            <div style={{width:40,height:40,borderRadius:'12px',background:p.registered?C.greenLight:C.amberLight,color:p.registered?C.green:C.amber,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:600,flexShrink:0}}>{p.name[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'13px',fontWeight:600}}>{p.name}</div>
              <div style={{fontSize:'11px',color:C.textSub}}>{p.dept} · Admitted {p.admitted}</div>
              <div style={{fontSize:'12px',color:C.text,marginTop:'4px',fontStyle:'italic'}}>"{p.reason}"</div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',fontWeight:500,background:p.status==='Admitted'?C.blueLight:p.status==='Recovering'?C.amberLight:C.greenLight,color:p.status==='Admitted'?C.blue:p.status==='Recovering'?C.amber:C.green}}>{p.status}</span>
              {!p.registered&&<div style={{fontSize:'10px',color:C.amber,marginTop:'4px'}}>Unregistered</div>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── FULL SCHEDULE ─────────────────────────────────────────────────────────────
function FullSchedule() {
  const [view,setView]=useState('dept')
  const depts={
    'Internal Medicine':[{name:'Dr Chan Siu-ming',shift:'08:00–17:00',tier:2},{name:'Dr Ho Ka-fai',shift:'13:00–22:00',tier:2},{name:'Nurse Yip Mei',shift:'08:00–17:00',tier:3}],
    'Cardiology':[{name:'Dr Lam Wai-yee',shift:'08:00–17:00',tier:1},{name:'Nurse Wong Chi',shift:'ON LEAVE',tier:3}],
    'Emergency':[{name:'EMS Team A',shift:'00:00–08:00',tier:3},{name:'EMS Team B',shift:'08:00–16:00',tier:3}],
    'Pharmacy':[{name:'Pharmacist Ho',shift:'09:00–18:00',tier:3}],
  }
  const tiers={
    'Tier 1 — Department Heads':PRACTITIONERS.filter(p=>p.tier===1),
    'Tier 2 — Doctors':PRACTITIONERS.filter(p=>p.tier===2),
    'Tier 3 — Nurses & Clinical':PRACTITIONERS.filter(p=>p.tier===3),
    'Tier 4 — Admin & Reception':PRACTITIONERS.filter(p=>p.tier===4),
  }
  const patientAppts=[
    {dept:'Internal Medicine',appts:[{time:'09:00',name:'Wong Mei-ling',type:'Diabetic review'},{time:'10:00',name:'Lee Siu-fong',type:'Cough & fever follow-up'},{time:'14:00',name:'Chan Wai-man',type:'Blood results'}]},
    {dept:'Cardiology',appts:[{time:'10:30',name:'Chan Wai-man',type:'Cardiac review'},{time:'15:00',name:'Leung Pui-shan',type:'ECG + consultation'}]},
  ]
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`}}>
        {[['dept','By department'],['tier','By tier'],['patients','Patient schedule']].map(([k,l])=>(
          <div key={k} onClick={()=>setView(k)} style={{flex:1,padding:'11px 8px',fontSize:'12px',fontWeight:500,color:view===k?C.green:C.textSub,textAlign:'center',borderBottom:`2px solid ${view===k?C.green:'transparent'}`,cursor:'pointer'}}>{l}</div>
        ))}
      </div>
      {view==='dept'&&Object.entries(depts).map(([dept,staff])=>(
        <div key={dept}>
          <SecLabel>{dept}</SecLabel>
          {staff.map((s,i)=>(
            <Card key={i} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontSize:'13px',fontWeight:500}}>{s.name}</div><div style={{fontSize:'11px',color:C.textSub}}>Tier {s.tier}</div></div>
              <span style={{fontSize:'12px',fontWeight:500,color:s.shift==='ON LEAVE'?C.amber:C.green}}>{s.shift}</span>
            </Card>
          ))}
        </div>
      ))}
      {view==='tier'&&Object.entries(tiers).map(([tier,staff])=>(
        <div key={tier}>
          <SecLabel>{tier}</SecLabel>
          {staff.map((p,i)=>(
            <Card key={i} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontSize:'13px',fontWeight:500}}>{p.name}</div><div style={{fontSize:'11px',color:C.textSub}}>{p.dept}</div></div>
              <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',background:p.status==='Active'?C.greenLight:C.amberLight,color:p.status==='Active'?C.green:C.amber,fontWeight:500}}>{p.status}</span>
            </Card>
          ))}
        </div>
      ))}
      {view==='patients'&&patientAppts.map(d=>(
        <div key={d.dept}>
          <SecLabel>{d.dept}</SecLabel>
          {d.appts.map((a,i)=>(
            <Card key={i} style={{padding:'12px 16px',display:'flex',gap:'14px',alignItems:'center'}}>
              <div style={{fontSize:'14px',fontWeight:700,color:C.green,width:50,flexShrink:0}}>{a.time}</div>
              <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:500}}>{a.name}</div><div style={{fontSize:'11px',color:C.textSub}}>{a.type}</div></div>
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── OCCUPANCY ─────────────────────────────────────────────────────────────────
function OccupancyScreen() {
  const deptData=[
    {dept:'Internal Medicine',beds:20,occupied:16,waiting:4,avgWait:'22 min'},
    {dept:'Cardiology',beds:12,occupied:9,waiting:2,avgWait:'35 min'},
    {dept:'Emergency / A&E',beds:8,occupied:8,waiting:6,avgWait:'48 min'},
    {dept:'Surgery',beds:10,occupied:5,waiting:0,avgWait:'—'},
    {dept:'Psychiatry',beds:6,occupied:4,waiting:1,avgWait:'40 min'},
  ]
  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>Hospital-wide · Live</SecLabel>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',padding:'0 16px 6px'}}>
        <StatCard icon="▣" label="Total beds" value="50" sub="across all depts"/>
        <StatCard icon="◎" label="Occupied" value="38" sub="76% occupancy" color={C.amber} bg={C.amberLight}/>
        <StatCard icon="◇" label="Available" value="12" sub="ready for admission" color={C.green} bg={C.greenLight}/>
        <StatCard icon="◈" label="Avg wait time" value="34 min" sub="across all depts" color={C.red} bg={C.redLight}/>
      </div>
      <SecLabel>By department</SecLabel>
      {deptData.map((d,i)=>{
        const pct=Math.round(d.occupied/d.beds*100)
        return (
          <Card key={i} style={{padding:'14px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
              <div style={{fontSize:'14px',fontWeight:500}}>{d.dept}</div>
              <span style={{fontSize:'12px',fontWeight:600,color:pct>=90?C.red:pct>=70?C.amber:C.green}}>{pct}% full</span>
            </div>
            <div style={{height:6,background:C.card,borderRadius:6,marginBottom:'10px',overflow:'hidden'}}>
              <div style={{height:'100%',width:`${pct}%`,background:pct>=90?C.red:pct>=70?C.amber:C.green,borderRadius:6,transition:'width 0.3s'}}/>
            </div>
            <div style={{display:'flex',gap:'16px',fontSize:'12px',color:C.textSub}}>
              <span>Beds: <strong style={{color:C.text}}>{d.occupied}/{d.beds}</strong></span>
              <span>Waiting: <strong style={{color:C.text}}>{d.waiting}</strong></span>
              <span>Avg wait: <strong style={{color:C.text}}>{d.avgWait}</strong></span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ── PORTAL MANAGEMENT ─────────────────────────────────────────────────────────
function PortalManagement() {
  const portals=[
    {name:'Queen Elizabeth Hospital — Main',type:'Institution',status:'Active',created:'Jan 2024'},
    {name:'QE — Cardiology Dept',type:'Department',status:'Active',created:'Mar 2024'},
    {name:'QE — Pharmacy',type:'Department',status:'Active',created:'Mar 2024'},
    {name:'Dr Ho Ka-fai (Personal)',type:'Practitioner',status:'Active',created:'Apr 2024'},
    {name:'Nurse Wong Chi',type:'Practitioner',status:'Suspended',created:'Feb 2024'},
  ]
  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>Active portals</SecLabel>
      {portals.map((p,i)=>(
        <Card key={i} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
          <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:500}}>{p.name}</div><div style={{fontSize:'11px',color:C.textSub}}>{p.type} · Created {p.created}</div></div>
          <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',fontWeight:500,background:p.status==='Active'?C.greenLight:C.redLight,color:p.status==='Active'?C.green:C.red}}>{p.status}</span>
        </Card>
      ))}
      <SecLabel>Credential approvals</SecLabel>
      <Card style={{padding:'14px 16px'}}>
        <div style={{fontSize:'13px',fontWeight:500,marginBottom:'4px'}}>New practitioner request</div>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>Dr Fung Siu-wan · HK-MED-60123 · Oncology</div>
        <div style={{display:'flex',gap:'8px'}}>
          <Btn variant="danger" style={{flex:1,fontSize:'12px'}}>Reject</Btn>
          <Btn variant="primary" style={{flex:1,fontSize:'12px'}}>Approve & create portal</Btn>
        </div>
      </Card>
      <div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}}>+ Create new portal</Btn></div>
    </div>
  )
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
export default function InstitutionApp() {
  const [screen,setScreen]=useState('dashboard')
  const titles={dashboard:'Institution admin',practitioners:'Practitioners',patients:'Patients',schedule:'Schedule',occupancy:'Occupancy',portals:'Portal management'}
  const navItems=[{key:'dashboard',icon:'◈',label:'Overview'},{key:'practitioners',icon:'◎',label:'Staff'},{key:'patients',icon:'◇',label:'Patients'},{key:'schedule',icon:'▣',label:'Schedule'},{key:'occupancy',icon:'◉',label:'Occupancy'}]
  return (
    <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',maxWidth:'440px',margin:'0 auto',background:C.beige}}>
      <div style={{background:C.green,padding:'14px 16px',display:'flex',alignItems:'center',gap:'10px',position:'sticky',top:0,zIndex:10}}>
        {screen!=='dashboard'&&<button onClick={()=>setScreen('dashboard')} style={{background:'rgba(255,255,255,0.18)',border:'none',color:'#fff',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>}
        <MedsaLogo height={20}/>
        <span style={{flex:1,fontSize:'13px',color:'rgba(255,255,255,0.7)',fontWeight:500}}>{titles[screen]}</span>
        <span style={{fontSize:'10px',background:C.greenLight,color:C.green,padding:'3px 9px',borderRadius:'20px',fontWeight:600}}>⬡ Admin</span>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {screen==='dashboard'&&<InstitutionDashboard onNav={setScreen}/>}
        {screen==='practitioners'&&<PractitionerList/>}
        {screen==='patients'&&<PatientList/>}
        {screen==='schedule'&&<FullSchedule/>}
        {screen==='occupancy'&&<OccupancyScreen/>}
        {screen==='portals'&&<PortalManagement/>}
      </div>
      <div style={{background:C.cream,borderTop:`0.5px solid ${C.border}`,display:'flex',padding:'8px 0 6px'}}>
        {navItems.map(item=>(
          <div key={item.key} onClick={()=>setScreen(item.key)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',cursor:'pointer',color:screen===item.key?C.green:C.textMuted,fontSize:'10px'}}>
            <span style={{fontSize:'18px',lineHeight:1}}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
