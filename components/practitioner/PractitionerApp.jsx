import { useState } from 'react'
import MedsaLogo from '../shared/MedsaLogo'
import C from '../shared/colours'

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant='secondary', style:sx={}, disabled }) {
  const base={border:'none',borderRadius:'10px',padding:'10px 16px',fontSize:'13px',fontWeight:500,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:disabled?0.5:1,...sx}
  const V={primary:{background:C.green,color:'#fff'},secondary:{background:C.card,color:C.text,border:`0.5px solid ${C.border}`},danger:{background:C.red,color:'#fff'},amber:{background:C.amber,color:'#fff'},purple:{background:C.purple,color:'#fff'}}
  return <button style={{...base,...V[variant]}} onClick={onClick} disabled={disabled}>{children}</button>
}
function Card({ children, style:sx={}, onClick }) {
  return <div onClick={onClick} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',margin:'0 16px 10px',overflow:'hidden',cursor:onClick?'pointer':'default',...sx}}>{children}</div>
}
function SecLabel({ children }) {
  return <div style={{fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.9px',color:C.textMuted,padding:'16px 16px 8px'}}>{children}</div>
}
function Toggle({ checked=false, onChange }) {
  const [on,setOn]=useState(checked)
  return <div onClick={()=>{setOn(!on);onChange&&onChange(!on)}} style={{width:34,height:18,borderRadius:20,background:on?C.green:C.border,cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}><div style={{position:'absolute',top:2,left:on?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/></div>
}
function InfoRow({ label, value, highlight=false, last=false }) {
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:last?'none':`0.5px solid ${C.border}`,fontSize:'13px'}}><span style={{color:C.textSub,flexShrink:0,marginRight:'12px'}}>{label}</span><span style={{fontWeight:500,color:highlight?C.red:C.text,textAlign:'right',maxWidth:'60%'}}>{value}</span></div>
}

// ── Role definitions ──────────────────────────────────────────────────────────
const ROLES = {
  admin:        {label:'Institution Admin',   color:C.purple, bg:C.purpleLight, icon:'⬡'},
  dept_head:    {label:'Department Head',     color:C.green,  bg:C.greenLight,  icon:'◈'},
  doctor:       {label:'Doctor',              color:C.blue,   bg:C.blueLight,   icon:'◎'},
  nurse:        {label:'Nurse',               color:C.green,  bg:C.greenLight,  icon:'◇'},
  clinic_nurse: {label:'Clinic Nurse',        color:C.green,  bg:C.greenLight,  icon:'◇'},
  receptionist: {label:'Receptionist',        color:C.brown,  bg:C.brownLight,  icon:'▣'},
  pharmacist:   {label:'Pharmacist',          color:C.amber,  bg:C.amberLight,  icon:'◉'},
  therapist:    {label:'Therapist',           color:C.brown,  bg:C.brownLight,  icon:'◌'},
  ems:          {label:'EMS / Emergency',     color:C.red,    bg:C.redLight,    icon:'◈'},
  allied:       {label:'Allied Health',       color:C.textMuted,bg:C.card,      icon:'◫'},
}

const ACCESS = {
  admin:        {identity:true,vitals:true,history:true,medications:true,allergies:true,mental:true,imaging:true,labs:true,prescribe:false,dispense:false,admin_perms:true,admission_reason:true},
  dept_head:    {identity:true,vitals:true,history:true,medications:true,allergies:true,imaging:true,labs:true,prescribe:true,dispense:false,admission_reason:true},
  doctor:       {identity:true,vitals:true,history:true,medications:true,allergies:true,imaging:true,labs:true,prescribe:true,dispense:false,admission_reason:true},
  nurse:        {identity:true,vitals:true,medications:true,allergies:true,tasks:true,prescribe:false,dispense:false,admission_reason:true},
  clinic_nurse: {identity:true,vitals:true,medications:true,allergies:true,tasks:true,prescribe:false,dispense:true,admission_reason:true},
  receptionist: {identity:true,appointments:true,billing:true,prescribe:false,dispense:false,admission_reason:false},
  pharmacist:   {identity:true,medications:true,allergies:true,prescribe:false,dispense:true,admission_reason:false},
  therapist:    {identity:true,vitals:true,musculoskeletal:true,allergies:true,prescribe:false,dispense:false,admission_reason:true},
  ems:          {identity:true,vitals:true,emergency:true,allergies:true,critical_conditions:true,medications:true,prescribe:false,dispense:false,admission_reason:false},
  allied:       {identity:true,specialty_notes:true,allergies:true,prescribe:false,dispense:false,admission_reason:true},
}

// ── CLOCK IN ─────────────────────────────────────────────────────────────────
function ClockInScreen({ onLogin }) {
  const [scanning,setScanning]=useState(false)
  const [scanned,setScanned]=useState(false)
  const [sel,setSel]=useState(null)
  return (
    <div style={{background:C.beige,minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <div style={{background:C.green,padding:'28px 20px 20px'}}>
        <MedsaLogo height={26}/>
        <div style={{fontSize:'10px',color:'rgba(255,255,255,0.5)',marginTop:'6px',letterSpacing:'1.5px',textTransform:'uppercase'}}>practitioner portal</div>
      </div>
      <div style={{flex:1,padding:'24px 20px'}}>
        <div style={{fontSize:'20px',fontWeight:700,color:C.text,marginBottom:'6px'}}>Clock in to your shift</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6,marginBottom:'24px'}}>Scan your Medsa practitioner ID at your institution scanner. Patient data is only accessible during active clock-in hours.</div>
        <div onClick={!scanned?()=>{setScanning(true);setTimeout(()=>{setScanning(false);setScanned(true)},1600)}:undefined}
          style={{background:C.cream,border:`1.5px dashed ${scanned?C.green:C.border}`,borderRadius:'16px',padding:'36px 20px',textAlign:'center',marginBottom:'20px',cursor:scanned?'default':'pointer'}}>
          {scanning?<><div style={{fontSize:'36px',marginBottom:'10px',color:C.green}}>⬡</div><div style={{fontSize:'14px',fontWeight:500,color:C.green}}>Scanning…</div><div style={{fontSize:'12px',color:C.textSub}}>Hold your ID card steady</div></>
          :scanned?<><div style={{fontSize:'32px',marginBottom:'10px',color:C.green}}>✓</div><div style={{fontSize:'14px',fontWeight:600,color:C.green}}>ID verified · QE Hospital</div><div style={{fontSize:'12px',color:C.textSub,marginTop:'4px'}}>Select your role to continue</div></>
          :<><div style={{fontSize:'36px',marginBottom:'10px',color:C.textMuted}}>⬡</div><div style={{fontSize:'14px',fontWeight:500,color:C.textSub}}>Tap to simulate scan</div><div style={{fontSize:'12px',color:C.textMuted,marginTop:'4px'}}>In production: use institution QR scanner</div></>}
        </div>
        {scanned&&<>
          <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px'}}>Select your role</div>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {Object.entries(ROLES).map(([key,r])=>(
              <div key={key} onClick={()=>setSel(key)} style={{background:sel===key?r.bg:C.cream,border:`0.5px solid ${sel===key?r.color:C.border}`,borderRadius:'12px',padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:'12px'}}>
                <span style={{fontSize:'18px',color:r.color}}>{r.icon}</span>
                <span style={{fontSize:'14px',fontWeight:500,color:sel===key?r.color:C.text}}>{r.label}</span>
                {sel===key&&<span style={{marginLeft:'auto',color:r.color,fontWeight:700}}>✓</span>}
              </div>
            ))}
          </div>
          {sel&&<Btn variant="primary" style={{width:'100%',marginTop:'20px',padding:'14px'}} onClick={()=>onLogin(sel)}>Clock in as {ROLES[sel].label} →</Btn>}
        </>}
      </div>
    </div>
  )
}

// ── LIVE OVERVIEW (all roles) ─────────────────────────────────────────────────
function LiveOverview({ role }) {
  const [expanded,setExpanded]=useState(false)
  const depts=[
    {dept:'Internal Medicine',beds:20,occupied:16,waiting:3,avgWait:'22 min',staff:8},
    {dept:'Cardiology',beds:12,occupied:9,waiting:2,avgWait:'35 min',staff:5},
    {dept:'Emergency / A&E',beds:8,occupied:8,waiting:7,avgWait:'48 min',staff:12},
    {dept:'Surgery',beds:10,occupied:5,waiting:0,avgWait:'—',staff:6},
    {dept:'Psychiatry',beds:6,occupied:4,waiting:1,avgWait:'40 min',staff:3},
    {dept:'Pharmacy',beds:null,occupied:null,waiting:14,avgWait:'8 min',staff:4},
  ]
  const totalBeds=depts.filter(d=>d.beds).reduce((a,d)=>a+d.beds,0)
  const totalOcc=depts.filter(d=>d.occupied).reduce((a,d)=>a+d.occupied,0)
  const totalWait=depts.reduce((a,d)=>a+d.waiting,0)
  const contextNote={
    ems:'⚠ A&E is at full capacity. Consider diverting non-critical patients.',
    nurse:'3 patients in Internal Medicine awaiting bed allocation.',
    clinic_nurse:'3 patients in Internal Medicine awaiting bed allocation.',
    doctor:'Discharge 4 patients flagged for today to free up beds.',
    dept_head:'Discharge 4 patients flagged for today to free up beds.',
    admin:'You can manage bed allocation from the Occupancy screen.',
    receptionist:'Emergency is busy — let incoming patients know of wait times.',
    pharmacist:'14 prescriptions pending in pharmacy queue.',
    therapist:'All therapy rooms available. 1 patient waiting.',
    allied:'Normal capacity across all departments.',
  }
  return (
    <div style={{margin:'16px 16px 0'}}>
      <div onClick={()=>setExpanded(!expanded)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:expanded?'14px 14px 0 0':'14px',padding:'12px 16px',cursor:'pointer'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
          <div style={{fontSize:'12px',fontWeight:600,color:C.text}}>◈ Live hospital overview</div>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:C.green,animation:'pulse 2s infinite'}}/>
            <span style={{fontSize:'11px',color:C.green,fontWeight:500}}>Live</span>
            <span style={{fontSize:'14px',color:C.textMuted,marginLeft:'4px'}}>{expanded?'▾':'▸'}</span>
          </div>
        </div>
        <div style={{display:'flex',gap:'12px'}}>
          {[
            {label:'Beds',value:`${totalOcc}/${totalBeds}`,color:totalOcc/totalBeds>0.85?C.red:totalOcc/totalBeds>0.7?C.amber:C.green},
            {label:'Waiting',value:totalWait,color:totalWait>10?C.red:totalWait>5?C.amber:C.green},
            {label:'Busiest',value:'A&E',color:C.amber},
            {label:'Staff on',value:depts.reduce((a,d)=>a+d.staff,0),color:C.text},
          ].map(s=>(
            <div key={s.label} style={{flex:1,textAlign:'center'}}>
              <div style={{fontSize:'16px',fontWeight:700,color:s.color}}>{s.value}</div>
              <div style={{fontSize:'10px',color:C.textMuted}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      {expanded&&(
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderTop:'none',borderRadius:'0 0 14px 14px',overflow:'hidden'}}>
          {depts.map((d,i)=>{
            const pct=d.beds?Math.round(d.occupied/d.beds*100):null
            const barColor=pct>=90?C.red:pct>=70?C.amber:C.green
            return(
              <div key={i} style={{padding:'10px 16px',borderBottom:i<depts.length-1?`0.5px solid ${C.border}`:'none'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                  <span style={{fontSize:'13px',fontWeight:500}}>{d.dept}</span>
                  <div style={{display:'flex',gap:'12px',fontSize:'11px',color:C.textSub}}>
                    {d.beds&&<span>Beds: <strong style={{color:pct>=90?C.red:pct>=70?C.amber:C.green}}>{d.occupied}/{d.beds}</strong></span>}
                    <span>Waiting: <strong style={{color:d.waiting>5?C.red:d.waiting>2?C.amber:C.green}}>{d.waiting}</strong></span>
                    <span>~{d.avgWait}</span>
                  </div>
                </div>
                {pct!==null&&<div style={{height:5,background:C.card,borderRadius:5,overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:barColor,borderRadius:5}}/></div>}
              </div>
            )
          })}
          <div style={{padding:'10px 16px',background:C.greenXLight,borderTop:`0.5px solid ${C.border}`}}>
            <div style={{fontSize:'11px',color:C.green,lineHeight:1.5}}>{contextNote[role]||contextNote.allied}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── EMS EMERGENCY CARD ────────────────────────────────────────────────────────
function EMSCard({ onClose }) {
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:C.red,margin:'16px 16px 0',borderRadius:'16px',padding:'20px',color:'#fff'}}>
        <div style={{fontSize:'10px',opacity:0.7,letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:'6px'}}>⚠ emergency health card — auto-surfaced on scan</div>
        <div style={{fontSize:'20px',fontWeight:700}}>Wong Mei-ling, Lisa</div>
        <div style={{fontSize:'12px',opacity:0.8,marginTop:'2px'}}>DOB 14 Mar 1988 · MDS-84921-HK</div>
        <div style={{marginTop:'14px',display:'flex',gap:'10px'}}>
          <div style={{background:'rgba(255,255,255,0.18)',borderRadius:'10px',padding:'10px 14px',flex:1}}>
            <div style={{fontSize:'10px',opacity:0.7}}>Blood type</div>
            <div style={{fontSize:'26px',fontWeight:800}}>O+</div>
          </div>
          <div style={{background:'rgba(255,255,255,0.18)',borderRadius:'10px',padding:'10px 14px',flex:2}}>
            <div style={{fontSize:'10px',opacity:0.7}}>Emergency contact</div>
            <div style={{fontSize:'13px',fontWeight:600,marginTop:'2px'}}>Wong Tai (Mother)</div>
            <div style={{fontSize:'12px',opacity:0.8}}>+852 9xxx xxxx</div>
          </div>
        </div>
      </div>
      <SecLabel>Critical conditions</SecLabel>
      <Card style={{padding:'12px 16px'}}>
        {['Type 2 Diabetes (insulin-dependent)','Coronary artery disease','Iron deficiency anaemia'].map((c,i,arr)=>(
          <div key={i} style={{padding:'7px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',fontSize:'14px',fontWeight:500,display:'flex',alignItems:'center',gap:'8px'}}>
            <span style={{color:C.red,fontSize:'10px'}}>◎</span> {c}
          </div>
        ))}
      </Card>
      <SecLabel>Severe allergies</SecLabel>
      <Card style={{padding:'12px 16px'}}>
        {['Penicillin — SEVERE ANAPHYLAXIS','Dust mites — moderate'].map((a,i,arr)=>(
          <div key={i} style={{padding:'7px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',fontSize:'14px',fontWeight:700,color:C.red}}>⚠ {a}</div>
        ))}
      </Card>
      <SecLabel>Current medications</SecLabel>
      <Card style={{padding:'12px 16px'}}>
        {['Metformin 500mg — twice daily','Aspirin 100mg — daily','Atorvastatin 20mg — nightly'].map((m,i,arr)=>(
          <div key={i} style={{fontSize:'13px',padding:'5px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>◉ {m}</div>
        ))}
      </Card>
      <div style={{padding:'0 16px 8px'}}><div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'10px',padding:'10px 14px',fontSize:'12px',color:C.green}}>✓ Verified Medsa record · Last updated 12 Jun 2025 · QE Hospital</div></div>
      <div style={{padding:'0 16px 16px'}}><Btn style={{width:'100%'}} onClick={onClose}>← Back to patient search</Btn></div>
    </div>
  )
}

// ── PRACTITIONER ID ───────────────────────────────────────────────────────────
function PractitionerIDScreen({ role }) {
  const r=ROLES[role]
  const access=ACCESS[role]||{}
  const [idTab,setIdTab]=useState('credentials')
  const [lostReported,setLostReported]=useState(false)
  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>Your practitioner ID</SecLabel>
      <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`,margin:'0 0 0 0'}}>
        {[['credentials','Credentials'],['qr','My QR code']].map(([k,l])=>(
          <div key={k} onClick={()=>setIdTab(k)} style={{flex:1,padding:'11px 8px',fontSize:'12px',fontWeight:500,color:idTab===k?C.green:C.textSub,textAlign:'center',borderBottom:`2px solid ${idTab===k?C.green:'transparent'}`,cursor:'pointer'}}>{l}</div>
        ))}
      </div>
      {idTab==='qr'&&<>
        <div style={{margin:'16px 16px 0',background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'16px',padding:'28px 20px',display:'flex',flexDirection:'column',alignItems:'center',gap:'16px'}}>
          <svg width="160" height="160" viewBox="0 0 48 48" fill="none">
            <rect x="2" y="2" width="18" height="18" rx="2" fill={r.color}/><rect x="6" y="6" width="10" height="10" rx="1" fill="white"/>
            <rect x="28" y="2" width="18" height="18" rx="2" fill={r.color}/><rect x="32" y="6" width="10" height="10" rx="1" fill="white"/>
            <rect x="2" y="28" width="18" height="18" rx="2" fill={r.color}/><rect x="6" y="32" width="10" height="10" rx="1" fill="white"/>
            <rect x="28" y="28" width="4" height="4" fill={r.color}/><rect x="34" y="28" width="4" height="4" fill={r.color}/>
            <rect x="40" y="28" width="6" height="4" fill={r.color}/><rect x="28" y="34" width="6" height="4" fill={r.color}/>
            <rect x="36" y="34" width="4" height="4" fill={r.color}/><rect x="28" y="40" width="4" height="6" fill={r.color}/>
            <rect x="34" y="42" width="12" height="4" fill={r.color}/>
          </svg>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'14px',fontWeight:600,color:C.text}}>Chan Siu-ming, David</div>
            <div style={{fontSize:'12px',color:C.textSub,marginTop:'2px'}}>{r.label} · QE Hospital</div>
            <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>HK-MED-48291</div>
          </div>
          <div style={{fontSize:'11px',color:C.textSub,textAlign:'center',lineHeight:1.5}}>This QR is used for clock-in at your institution and patient scanning. It encodes your role and permissions — scanning with different systems shows role-appropriate data.</div>
        </div>
        <div style={{margin:'12px 16px 0',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.brown,lineHeight:1.5}}>
          ◇ Your physical Medsa ID card was issued when your account was created and includes this QR. A replacement is sent automatically if your credentials change. If your card is lost or stolen, report it below.
        </div>
        {!lostReported
          ?<div style={{padding:'12px 16px 16px'}}>
            <div onClick={()=>setLostReported(true)} style={{fontSize:'13px',color:C.red,textAlign:'center',cursor:'pointer',padding:'10px',borderRadius:'10px',border:`0.5px solid ${C.red}`,background:C.redLight}}>
              ◎ Report lost or stolen card
            </div>
          </div>
          :<div style={{margin:'12px 16px 16px',background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'12px',padding:'14px 16px'}}>
            <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'4px'}}>✓ Lost card reported</div>
            <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5}}>Your current card has been deactivated. Medsa will issue a replacement card to your registered address within 3–5 business days. Your QR above remains valid in the meantime.</div>
          </div>
        }
      </>}
      {idTab==='credentials'&&<>
      <div style={{margin:'0 16px 16px',background:`linear-gradient(135deg,${r.color} 0%,${r.color}cc 100%)`,borderRadius:'16px',padding:'24px',color:'#fff',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-20,right:-20,width:100,height:100,borderRadius:'50%',background:'rgba(255,255,255,0.07)'}}/>
        <div style={{fontSize:'10px',opacity:0.6,letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:'4px'}}>medsa practitioner</div>
        <div style={{fontSize:'20px',fontWeight:700,marginBottom:'2px'}}>Dr Chan Siu-ming</div>
        <div style={{fontSize:'13px',opacity:0.85,marginBottom:'16px'}}>{r.label} · Internal Medicine</div>
        <div style={{display:'flex',gap:'20px'}}>
          <div><div style={{fontSize:'10px',opacity:0.6}}>License</div><div style={{fontSize:'13px',fontWeight:600}}>HK-MED-48291</div></div>
          <div><div style={{fontSize:'10px',opacity:0.6}}>Institution</div><div style={{fontSize:'13px',fontWeight:600}}>QE Hospital</div></div>
          <div><div style={{fontSize:'10px',opacity:0.6}}>Dept</div><div style={{fontSize:'13px',fontWeight:600}}>Internal Med.</div></div>
        </div>
        <div style={{position:'absolute',bottom:20,right:20,width:52,height:52,background:'#fff',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect x="1" y="1" width="13" height="13" rx="2" fill={r.color}/><rect x="4" y="4" width="7" height="7" rx="1" fill="white"/>
            <rect x="22" y="1" width="13" height="13" rx="2" fill={r.color}/><rect x="25" y="4" width="7" height="7" rx="1" fill="white"/>
            <rect x="1" y="22" width="13" height="13" rx="2" fill={r.color}/><rect x="4" y="25" width="7" height="7" rx="1" fill="white"/>
            <rect x="22" y="22" width="4" height="4" fill={r.color}/><rect x="28" y="22" width="4" height="4" fill={r.color}/>
            <rect x="22" y="28" width="4" height="6" fill={r.color}/><rect x="28" y="28" width="8" height="4" fill={r.color}/>
          </svg>
        </div>
      </div>
      <SecLabel>Credentials</SecLabel>
      <Card style={{padding:'0 16px'}}>
        {[['Full name','Chan Siu-ming, David'],['License no.','HK-MED-48291'],['Issued by','Medical Council of HK'],['Specialty','Internal Medicine'],['Position',r.label],['Institution','Queen Elizabeth Hospital'],['Valid until','31 Dec 2026']].map(([l,v],i,arr)=>(
          <InfoRow key={l} label={l} value={v} last={i===arr.length-1}/>
        ))}
      </Card>
      <SecLabel>Access permissions</SecLabel>
      <Card>
        {[['Scan patient QR',true],['View patient records',!!access.identity],['View medical history',!!access.history],['View medication records',!!access.medications],['Prescribe medications',!!access.prescribe],['Dispense medications',!!access.dispense],['View mental health records',!!access.mental],['Emergency override',!!access.emergency],['Manage role permissions',!!access.admin_perms]].map(([label,allowed],i,arr)=>(
          <div key={label} style={{padding:'11px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}>
            <span>{label}</span>
            <span style={{fontSize:'11px',fontWeight:600,color:allowed?C.green:C.textMuted}}>{allowed?'✓ Allowed':'— Restricted'}</span>
          </div>
        ))}
      </Card>
      </>}
      <div style={{display:'flex',gap:'8px',padding:'0 16px 16px'}}>
        <button onClick={()=>alert('Add your Medsa Staff ID to Apple Wallet — coming in Phase 3. Use your physical card in the meantime.')} style={{flex:1,border:'none',borderRadius:'10px',padding:'11px',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',background:'#000',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="white"><path d="M11.5 0C9.6 0 8.8 1 7.5 1 6.2 1 5.2 0 3.5 0 1.6 0 0 1.7 0 4.2c0 3.8 3.2 8.8 5.5 8.8.8 0 1.4-.5 2-.5s1.3.5 2 .5C12 13 15 8.5 15 4.2 15 1.7 13.4 0 11.5 0zM7.5 2.5c-.1-1.2.9-2.3 1.5-2.5.1 1.2-.9 2.3-1.5 2.5z"/></svg>
          Staff ID — Apple Wallet
        </button>
        <button onClick={()=>alert('Add your Medsa Staff ID to Google Wallet — coming in Phase 3. Use your physical card in the meantime.')} style={{flex:1,border:'0.5px solid #4285f4',borderRadius:'10px',padding:'11px',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',background:'#fff',color:'#4285f4',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#4285f4" strokeWidth="1.5"/><text x="8" y="12" textAnchor="middle" fontSize="9" fill="#4285f4" fontWeight="bold">G</text></svg>
          Staff ID — Google Wallet
        </button>
      </div>
    </div>
  )
}

// ── PATIENT SEARCH ────────────────────────────────────────────────────────────
function PatientSearchScreen({ role }) {
  const [view,setView]=useState('search')
  const [activeTab,setActiveTab]=useState('overview')
  const [logText,setLogText]=useState('')
  const [logSaved,setLogSaved]=useState(false)
  const access=ACCESS[role]||{}
  const patient={
    name:'Wong Mei-ling, Lisa',id:'MDS-84921-HK',dob:'14 Mar 1988',age:37,
    bloodType:'O+',allergies:['Penicillin (severe)','Dust mites (moderate)'],
    ward:'Ward 3B · Bed 12',status:'Admitted',
    admissionReason:'Diabetic review — elevated glucose levels, persistent fatigue. Referred by Dr Chan for inpatient monitoring and medication adjustment.',
    emergency:{name:'Wong Tai',relation:'Mother',phone:'+852 9xxx xxxx'},
    vitals:{'Blood pressure':'118/76 mmHg','Heart rate':'72 bpm','Temperature':'36.8°C','SpO₂':'98%','Weight':'58 kg','Blood glucose':'5.9 mmol/L'},
    currentMeds:['Metformin 500mg — twice daily','Vitamin D3 1000IU — daily','Aspirin 100mg — daily'],
    criticalConditions:['Type 2 Diabetes (controlled)','Iron deficiency anaemia'],
    institutionRecords:['20 Jun — Admitted, Internal Medicine','21 Jun — Vitals recorded, Nurse Yip','22 Jun — Dr Chan consultation, symptom log updated','23 Jun — Blood panel ordered'],
    consent:{history:true,imaging:true,mental:false,social:false},
  }

  if(view==='ems') return <EMSCard onClose={()=>setView('search')}/>

  if(view==='patient') {
    const tabs=[
      {key:'overview',label:'Overview'},
      access.vitals&&{key:'vitals',label:'Vitals'},
      access.history&&{key:'history',label:'History'},
      access.medications&&{key:'medications',label:'Meds'},
      (access.prescribe||role==='doctor'||role==='dept_head'||role==='admin')&&{key:'log',label:'Log'},
    ].filter(Boolean)
    return (
      <div style={{background:C.beige,flex:1}}>
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,margin:'16px 16px 0',borderRadius:'14px',padding:'16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:'16px',fontWeight:700}}>{patient.name}</div>
              <div style={{fontSize:'12px',color:C.textSub,marginTop:'2px'}}>{patient.id} · DOB {patient.dob} · Age {patient.age}</div>
              <div style={{display:'flex',gap:'6px',marginTop:'8px',flexWrap:'wrap'}}>
                <span style={{fontSize:'10px',background:C.redLight,color:C.red,padding:'2px 8px',borderRadius:'20px',fontWeight:600}}>Blood: {patient.bloodType}</span>
                {patient.allergies.map(a=><span key={a} style={{fontSize:'10px',background:C.amberLight,color:C.amber,padding:'2px 8px',borderRadius:'20px',fontWeight:600}}>⚠ {a}</span>)}
              </div>
            </div>
            <button onClick={()=>setView('search')} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:'20px',padding:'4px 12px',fontSize:'11px',cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>← Back</button>
          </div>
          <div style={{marginTop:'10px',display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <span style={{fontSize:'11px',background:C.greenLight,color:C.green,padding:'3px 10px',borderRadius:'20px',fontWeight:500}}>{patient.ward}</span>
            <span style={{fontSize:'11px',background:C.blueLight,color:C.blue,padding:'3px 10px',borderRadius:'20px',fontWeight:500}}>{patient.status}</span>
          </div>
          {access.admission_reason&&<div style={{marginTop:'10px',background:C.beige,borderRadius:'10px',padding:'10px 12px'}}>
            <div style={{fontSize:'10px',color:C.textMuted,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'4px'}}>Reason for admission</div>
            <div style={{fontSize:'13px',color:C.text,lineHeight:1.5,fontStyle:'italic'}}>"{patient.admissionReason}"</div>
          </div>}
        </div>
        <div style={{margin:'10px 16px 0',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'10px 14px',fontSize:'12px',color:C.brown}}>
          ◇ Showing <strong>QE Hospital records only</strong>. Other institution records hidden unless patient grants access.
        </div>
        <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`,marginTop:'10px',overflowX:'auto'}}>
          {tabs.map(t=><div key={t.key} onClick={()=>setActiveTab(t.key)} style={{flex:1,padding:'10px 8px',fontSize:'12px',fontWeight:500,color:activeTab===t.key?C.green:C.textSub,textAlign:'center',borderBottom:`2px solid ${activeTab===t.key?C.green:'transparent'}`,cursor:'pointer',whiteSpace:'nowrap'}}>{t.label}</div>)}
        </div>

        {activeTab==='overview'&&<>
          <SecLabel>Critical info</SecLabel>
          <Card style={{padding:'0 16px'}}>
            <InfoRow label="Ward / Bed" value={patient.ward}/>
            <InfoRow label="Status" value={patient.status}/>
            <InfoRow label="Emergency contact" value={`${patient.emergency.name} (${patient.emergency.relation}) · ${patient.emergency.phone}`}/>
            {patient.allergies.map((a,i,arr)=><InfoRow key={a} label="Allergy" value={a} highlight last={i===arr.length-1}/>)}
          </Card>
          <SecLabel>This institution's records</SecLabel>
          <Card style={{padding:'12px 16px'}}>
            {patient.institutionRecords.map((r,i,arr)=><div key={i} style={{fontSize:'13px',color:C.textSub,padding:'5px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>{r}</div>)}
          </Card>
          <SecLabel>Patient consent</SecLabel>
          <Card>
            {[['Full medical history',patient.consent.history],['Imaging & scans',patient.consent.imaging],['Mental health records',patient.consent.mental],['Social history',patient.consent.social]].map(([l,v],i,arr)=>(
              <div key={l} style={{padding:'10px 16px',display:'flex',justifyContent:'space-between',fontSize:'13px',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>
                <span>{l}</span><span style={{fontSize:'11px',fontWeight:600,color:v?C.green:C.textMuted}}>{v?'✓ Consented':'— Not consented'}</span>
              </div>
            ))}
          </Card>
        </>}

        {activeTab==='vitals'&&access.vitals&&<>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',padding:'16px 16px 0'}}>
            {Object.entries(patient.vitals).map(([k,v])=>(
              <div key={k} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px'}}>
                <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.5px'}}>{k}</div>
                <div style={{fontSize:'16px',fontWeight:700,marginTop:'4px'}}>{v}</div>
              </div>
            ))}
          </div>
          <SecLabel>Record new vitals</SecLabel>
          <Card style={{padding:'16px'}}>
            {['Blood pressure','Heart rate','Temperature','SpO₂','Blood glucose'].map((v,i,arr)=>(
              <div key={v} style={{marginBottom:i<arr.length-1?'12px':'0'}}>
                <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>{v}</div>
                <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'14px',background:C.beige,outline:'none',fontFamily:'inherit'}} placeholder={`Enter ${v.toLowerCase()}…`}/>
              </div>
            ))}
            <Btn variant="primary" style={{width:'100%',marginTop:'16px'}}>Save vitals</Btn>
          </Card>
        </>}

        {activeTab==='history'&&(access.history&&patient.consent.history?<>
          <div style={{margin:'12px 16px 0',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'10px',padding:'10px 14px',fontSize:'12px',color:C.green}}>
            ✓ Patient has consented to share full history across institutions · Demo view shows complete cross-institution timeline
          </div>
          <SecLabel>Active conditions</SecLabel>
          <Card style={{padding:'12px 16px'}}>
            {[
              {condition:'Type 2 Diabetes (insulin-dependent)',since:'2018',severity:'Controlled',managing:'Dr Chan Siu-ming · QE Hospital'},
              {condition:'Iron deficiency anaemia',since:'2020',severity:'Mild',managing:'Dr Chan Siu-ming · QE Hospital'},
              {condition:'Coronary artery disease',since:'2021',severity:'Stable',managing:'Dr Lam Wai-yee · HK Sanatorium'},
            ].map((c,i,arr)=>(
              <div key={i} style={{padding:'10px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>
                <div style={{fontSize:'13px',fontWeight:500,marginBottom:'3px'}}>◎ {c.condition}</div>
                <div style={{display:'flex',gap:'12px',fontSize:'11px',color:C.textSub}}>
                  <span>Since {c.since}</span>
                  <span style={{color:C.green,fontWeight:500}}>{c.severity}</span>
                  <span>{c.managing}</span>
                </div>
              </div>
            ))}
          </Card>
          <SecLabel>Allergies & alerts</SecLabel>
          <Card style={{padding:'12px 16px'}}>
            {[
              {allergen:'Penicillin',severity:'SEVERE — anaphylaxis risk',type:'Medication'},
              {allergen:'Dust mites',severity:'Moderate — respiratory',type:'Environmental'},
            ].map((a,i,arr)=>(
              <div key={i} style={{padding:'8px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div><div style={{fontSize:'13px',fontWeight:700,color:C.red}}>⚠ {a.allergen}</div><div style={{fontSize:'11px',color:C.textSub}}>{a.type}</div></div>
                <span style={{fontSize:'11px',background:C.redLight,color:C.red,padding:'2px 8px',borderRadius:'20px',fontWeight:600}}>{a.severity}</span>
              </div>
            ))}
          </Card>
          <SecLabel>Full visit timeline — all institutions</SecLabel>
          {[
            {date:'20 Jun 2025',institution:'QE Hospital',type:'Admission',doctor:'Dr Chan Siu-ming',dept:'Internal Medicine',notes:'Admitted for diabetic review. Elevated glucose 5.9 mmol/L. Fatigue reported. Blood panel ordered. Metformin dose reviewed.',icon:'▣',bg:C.blueLight},
            {date:'12 Jun 2025',institution:'QE Hospital',type:'Lab results',doctor:'Dr Chan Siu-ming',dept:'Pathology',notes:'Full CBC. Haemoglobin 13.8 g/dL (normal). WBC 6.2 × 10⁹/L (normal). Glucose 5.9 mmol/L (slightly elevated). Iron 8.2 μmol/L (low).',icon:'◉',bg:C.greenLight},
            {date:'3 May 2025',institution:'Matilda International',type:'Outpatient visit',doctor:'Dr Ho Siu-wai',dept:'General Practice',notes:'Annual check-up. BP 118/76 mmHg. BMI 22.4. Mild iron deficiency noted. Iron supplement prescribed. Flu vaccine recommended.',icon:'◎',bg:C.greenLight},
            {date:'18 Feb 2025',institution:'Ruttonjee Hospital',type:'Imaging',doctor:'Dr Lam Wai-yee',dept:'Radiology',notes:'Chest X-ray. No active TB. Lungs clear. Cardiac silhouette normal. Incidental mild cardiomegaly — noted for cardiology follow-up.',icon:'▣',bg:C.amberLight},
            {date:'9 Jan 2025',institution:'HK Sanatorium',type:'Specialist',doctor:'Dr Lam Wai-yee',dept:'Cardiology',notes:'Coronary artery disease annual review. ECG normal sinus rhythm. Atorvastatin continued. BP well controlled. Next review in 12 months.',icon:'◈',bg:C.blueLight},
            {date:'14 Oct 2024',institution:'QE Hospital',type:'Outpatient visit',doctor:'Dr Chan Siu-ming',dept:'Internal Medicine',notes:'Diabetes 6-month review. HbA1c 6.8% — good control. Metformin 500mg twice daily continued. Diet counselling provided.',icon:'◎',bg:C.greenLight},
            {date:'22 Aug 2024',institution:'Matilda International',type:'Procedure',doctor:'Dr Wong Mei-ling',dept:'Ophthalmology',notes:'Diabetic retinopathy screening. Mild background retinopathy detected in left eye. Patient informed. Annual screening recommended.',icon:'◇',bg:C.brownLight},
            {date:'5 Mar 2024',institution:'QE Hospital',type:'Emergency',doctor:'Dr Fung Ka-wai',dept:'A&E',notes:'Presented with chest pain. ECG showed no acute changes. Troponin negative. Diagnosed as musculoskeletal. Discharged same day.',icon:'◈',bg:C.redLight},
          ].map((v,i)=>(
            <Card key={i} style={{padding:'14px 16px'}}>
              <div style={{display:'flex',gap:'12px',alignItems:'flex-start'}}>
                <div style={{width:38,height:38,borderRadius:'10px',background:v.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',color:C.green,flexShrink:0}}>{v.icon}</div>
                <div style={{flex:1}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'4px'}}>
                    <div><div style={{fontSize:'13px',fontWeight:600}}>{v.type}</div><div style={{fontSize:'11px',color:C.green,fontWeight:500}}>{v.institution} · {v.dept}</div></div>
                    <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:'11px',color:C.textMuted}}>{v.date}</div><div style={{fontSize:'11px',color:C.textSub}}>{v.doctor}</div></div>
                  </div>
                  <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6,fontStyle:'italic',marginTop:'4px'}}>"{v.notes}"</div>
                </div>
              </div>
            </Card>
          ))}
          <SecLabel>Surgical & procedure history</SecLabel>
          <Card style={{padding:'12px 16px'}}>
            {[
              {procedure:'Appendectomy',date:'Mar 2019',institution:'QE Hospital',surgeon:'Dr Ho Ka-fai',notes:'Laparoscopic. Uncomplicated. Full recovery.'},
              {procedure:'Diabetic retinopathy laser treatment',date:'Nov 2021',institution:'HK Eye Hospital',surgeon:'Dr Chan Pui-shan',notes:'Left eye. Two sessions. No complications.'},
            ].map((s,i,arr)=>(
              <div key={i} style={{padding:'8px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>
                <div style={{fontSize:'13px',fontWeight:500}}>{s.procedure}</div>
                <div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>{s.date} · {s.institution} · {s.surgeon}</div>
                <div style={{fontSize:'12px',color:C.textSub,marginTop:'3px',fontStyle:'italic'}}>"{s.notes}"</div>
              </div>
            ))}
          </Card>
          <SecLabel>Family history (patient-declared)</SecLabel>
          <Card style={{padding:'12px 16px'}}>
            {[
              'Father — Type 2 Diabetes, coronary artery disease (deceased age 71)',
              'Mother — Hypertension, osteoporosis',
              'Maternal grandmother — Breast cancer (deceased age 68)',
            ].map((f,i,arr)=>(
              <div key={i} style={{fontSize:'13px',color:C.textSub,padding:'5px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>◇ {f}</div>
            ))}
          </Card>
        </>:<div style={{padding:'40px 24px',textAlign:'center'}}>
          <div style={{fontSize:'24px',marginBottom:'12px',color:C.textMuted}}>◎</div>
          <div style={{fontSize:'14px',color:C.textSub}}>Patient has not consented to share medical history with this institution.</div>
        </div>)}

        {activeTab==='medications'&&access.medications&&<>
          <SecLabel>Current medications</SecLabel>
          {patient.currentMeds.map((m,i)=>(
            <Card key={i} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
              <div style={{width:36,height:36,borderRadius:'10px',background:C.brownLight,display:'flex',alignItems:'center',justifyContent:'center',color:C.brown,fontSize:'18px'}}>◉</div>
              <div style={{flex:1,fontSize:'13px'}}>{m}</div>
              {access.dispense&&<Btn variant="amber" style={{fontSize:'11px',padding:'5px 10px'}}>Dispense</Btn>}
            </Card>
          ))}
          {access.prescribe&&<div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}}>+ Prescribe medication</Btn></div>}
          {!access.prescribe&&!access.dispense&&<div style={{margin:'0 16px 16px',background:C.brownLight,borderRadius:'10px',padding:'10px 14px',fontSize:'12px',color:C.brown}}>◇ Your role can view but not prescribe or dispense medications.</div>}
        </>}

        {activeTab==='log'&&<>
          <SecLabel>Symptom & consultation log</SecLabel>
          <Card style={{padding:'16px'}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>Nurses can log symptoms and observations. Only doctors and dept heads can make diagnoses and prescriptions.</div>
            <textarea value={logText} onChange={e=>setLogText(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,resize:'none',outline:'none',fontFamily:'inherit',marginBottom:'10px'}} rows={4} placeholder="Log symptoms, observations, or clinical notes for this visit…"/>
            {logSaved&&<div style={{fontSize:'12px',color:C.green,marginBottom:'8px'}}>✓ Log saved to patient record</div>}
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1}} onClick={()=>{setLogText('');setLogSaved(false)}}>Clear</Btn>
              <Btn variant="primary" style={{flex:1}} onClick={()=>setLogSaved(true)}>Submit to record</Btn>
            </div>
          </Card>
          {(role==='doctor'||role==='dept_head'||role==='admin')&&<>
            <SecLabel>Bed / Location</SecLabel>
            <Card style={{padding:'0 16px'}}>
              <InfoRow label="Ward" value="Ward 3B"/>
              <InfoRow label="Bed" value="Bed 12"/>
              <InfoRow label="Admitted" value="20 Jun 2025"/>
              <InfoRow label="Expected discharge" value="25 Jun 2025" last/>
            </Card>
            <div style={{padding:'0 16px 16px',display:'flex',gap:'8px'}}>
              <Btn style={{flex:1}}>Transfer ward</Btn>
              <Btn variant="amber" style={{flex:1}}>Discharge</Btn>
            </div>
          </>}
        </>}
      </div>
    )
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>Scan patient QR</SecLabel>
      {/* Role-based scan — what each role sees on scan */}
      <div style={{margin:'0 16px 10px',background:C.cream,border:`1.5px dashed ${C.border}`,borderRadius:'14px',padding:'24px 20px',textAlign:'center',cursor:'pointer'}} onClick={()=>role==='ems'?setView('ems'):setView('patient')}>
        <div style={{fontSize:'32px',color:C.green,marginBottom:'10px'}}>⬡</div>
        <div style={{fontSize:'14px',fontWeight:500,marginBottom:'6px'}}>Scan patient Medsa QR</div>
        <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6,maxWidth:'280px',margin:'0 auto'}}>
          {role==='ems'&&'Emergency card immediately — blood type, allergies, critical conditions, medications, emergency contact'}
          {role==='receptionist'&&'Check-in view — patient identity, appointments, billing only. No clinical data.'}
          {role==='pharmacist'&&'Prescriptions with per-visit diagnosis context, allergies, interaction flags'}
          {(role==='doctor'||role==='dept_head')&&'Full clinical view — history, vitals, labs, imaging, medications. Subject to patient consent per record type.'}
          {(role==='nurse'||role==='clinic_nurse')&&'Vitals, medications, allergies, care tasks. Clinic nurses can dispense.'}
          {role==='therapist'&&'Specialty notes + consented cross-specialty context — e.g. diabetes flag visible to optometrist if relevant to treatment'}
          {role==='allied'&&'Specialty view + relevant consented health context from other providers'}
          {role==='admin'&&'Full administrative and clinical view across all departments'}
        </div>
      </div>
      <SecLabel>Or search manually</SecLabel>
      <div style={{padding:'0 16px 10px'}}>
        <div style={{position:'relative',display:'flex',alignItems:'center'}}>
          <span style={{position:'absolute',left:'12px',fontSize:'16px',color:C.green}}>◎</span>
          <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'11px 12px 11px 36px',fontSize:'14px',background:C.cream,outline:'none',fontFamily:'inherit'}} placeholder="Search by name or Medsa ID…" onKeyDown={e=>{if(e.key==='Enter')role==='ems'?setView('ems'):setView('patient')}}/>
        </div>
      </div>
      <div style={{margin:'0 16px 16px',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',display:'flex',gap:'10px'}}>
        <span style={{color:C.brown}}>◇</span>
        <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5}}><strong style={{color:C.brown}}>One QR, role-based output.</strong> The same patient QR shows each role exactly what their function requires and what the patient has consented to share. No public or unauthenticated access.</div>
      </div>
    </div>
  )
}

// ── SCHEDULE ──────────────────────────────────────────────────────────────────
function ScheduleScreen({ role }) {
  const [view,setView]=useState('mine')
  const isLead=role==='admin'||role==='dept_head'
  const TABS=[{key:'mine',label:'My schedule'},isLead&&{key:'dept',label:'Dept schedule'},isLead&&{key:'requests',label:'Shift requests'},{key:'appts',label:'Appointments'}].filter(Boolean)
  const myShifts=[{day:'Mon 23',time:'08:00 – 17:00',status:'Confirmed'},{day:'Tue 24',time:'08:00 – 17:00',status:'Confirmed'},{day:'Wed 25',time:'13:00 – 22:00',status:'Pending swap'},{day:'Thu 26',time:'OFF',status:'Day off'},{day:'Fri 27',time:'08:00 – 17:00',status:'Confirmed'}]
  const appts=[{time:'09:00',name:'Wong Mei-ling',type:'Follow-up · Blood results',room:'3A'},{time:'10:00',name:'Chan Wai-man',type:'New patient · Chest pain',room:'3A'},{time:'10:30',name:'Lee Siu-fong',type:'Prescription review',room:'3B'},{time:'14:00',name:'Ng Ka-wai',type:'Post-op check',room:'4A'},{time:'15:30',name:'Lam Yee-ting',type:'Diabetes management',room:'3A'}]
  return (
    <div style={{background:C.beige,flex:1}}>
      <LiveOverview role={role}/>
      <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`,marginTop:'10px'}}>
        {TABS.map(t=><div key={t.key} onClick={()=>setView(t.key)} style={{flex:1,padding:'11px 6px',fontSize:'11px',fontWeight:500,color:view===t.key?C.green:C.textSub,textAlign:'center',borderBottom:`2px solid ${view===t.key?C.green:'transparent'}`,cursor:'pointer',whiteSpace:'nowrap'}}>{t.label}</div>)}
      </div>
      {view==='mine'&&<>
        <div style={{margin:'16px 16px 0',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'12px',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{fontSize:'13px',fontWeight:600,color:C.green}}>◎ Clocked in · QE Hospital</div><div style={{fontSize:'11px',color:C.textSub}}>Since 07:52 · Internal Medicine</div></div>
          <Btn variant="danger" style={{fontSize:'12px',padding:'6px 12px'}}>Clock out</Btn>
        </div>
        <SecLabel>This week</SecLabel>
        {myShifts.map((s,i)=>(
          <Card key={i} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
            <div style={{width:40,height:40,borderRadius:'10px',background:s.status==='Day off'?C.card:C.greenLight,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{fontSize:'11px',fontWeight:700,color:s.status==='Day off'?C.textMuted:C.green,textAlign:'center',lineHeight:1.3}}>{s.day.split(' ')[0]}<br/>{s.day.split(' ')[1]}</span>
            </div>
            <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:500}}>{s.time}</div><div style={{fontSize:'11px',color:C.textSub}}>Internal Medicine</div></div>
            <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',fontWeight:500,background:s.status==='Confirmed'?C.greenLight:s.status==='Pending swap'?C.amberLight:C.card,color:s.status==='Confirmed'?C.green:s.status==='Pending swap'?C.amber:C.textMuted}}>{s.status}</span>
          </Card>
        ))}
        <div style={{padding:'0 16px 16px'}}><Btn style={{width:'100%'}}>Request shift change</Btn></div>
      </>}
      {view==='dept'&&isLead&&<>
        <SecLabel>Internal Medicine · Today</SecLabel>
        {['Dr Chan Siu-ming','Dr Ho Ka-fai','Nurse Yip Mei','Nurse Wong Chi','Receptionist Lam'].map((name,i)=>(
          <Card key={i} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
            <div style={{width:36,height:36,borderRadius:'10px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:600}}>{name.split(' ').pop()[0]}</div>
            <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:500}}>{name}</div><div style={{fontSize:'11px',color:C.textSub}}>08:00 – 17:00</div></div>
            <div style={{width:8,height:8,borderRadius:'50%',background:i===3?C.amber:C.green}}/>
          </Card>
        ))}
        <SecLabel>Post announcement</SecLabel>
        <Card style={{padding:'16px'}}>
          <textarea style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,resize:'none',outline:'none',fontFamily:'inherit',marginBottom:'10px'}} rows={3} placeholder="Write announcement to your department…"/>
          <Btn variant="primary" style={{width:'100%'}}>Post to department</Btn>
        </Card>
      </>}
      {view==='requests'&&isLead&&<>
        <SecLabel>Pending shift change requests</SecLabel>
        {[{from:'Nurse Yip Mei',wants:'Wed 25 Jun 13:00–22:00',swap:'Thu 26 Jun 08:00–17:00'},{from:'Dr Ho Ka-fai',wants:'Fri 27 Jun 08:00–17:00',swap:'Sat 28 Jun 08:00–17:00'}].map((r,i)=>(
          <Card key={i} style={{padding:'14px 16px'}}>
            <div style={{fontSize:'13px',fontWeight:600,marginBottom:'4px'}}>{r.from}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'2px'}}>Swap: <strong style={{color:C.text}}>{r.wants}</strong></div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>For: <strong style={{color:C.text}}>{r.swap}</strong></div>
            <div style={{display:'flex',gap:'8px'}}><Btn variant="danger" style={{flex:1,fontSize:'12px'}}>Reject</Btn><Btn variant="primary" style={{flex:1,fontSize:'12px'}}>Approve</Btn></div>
          </Card>
        ))}
      </>}
      {view==='appts'&&<>
        <SecLabel>Today · Tue 24 Jun</SecLabel>
        {appts.map((a,i)=>(
          <Card key={i} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
            <div style={{width:44,textAlign:'center'}}><div style={{fontSize:'14px',fontWeight:700,color:C.green}}>{a.time}</div></div>
            <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:600}}>{a.name}</div><div style={{fontSize:'12px',color:C.textSub}}>{a.type}</div></div>
            <span style={{fontSize:'11px',background:C.greenLight,color:C.green,padding:'3px 9px',borderRadius:'20px'}}>Rm {a.room}</span>
          </Card>
        ))}
        <div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}}>+ New appointment</Btn></div>
      </>}
    </div>
  )
}

// ── MESSAGES ──────────────────────────────────────────────────────────────────
function MessagesScreen() {
  const [composing,setComposing]=useState(false)
  const msgs=[
    {from:'Head of Dept',time:'Today 08:00',text:'New triage protocol effective Monday. See attached guidelines.',unread:true},
    {from:'Admin',time:'Yesterday',text:'System maintenance Sat 02:00–04:00. Medsa will be in read-only mode.',unread:true},
    {from:'Dr Ho Ka-fai',time:'Mon 23 Jun',text:'Can you cover my Friday afternoon slot?',unread:false},
    {from:'Pharmacy',time:'Sun 22 Jun',text:'Metformin stock updated. All prescriptions cleared.',unread:false},
  ]
  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>Messages</SecLabel>
      {msgs.map((m,i)=>(
        <Card key={i} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
          <div style={{width:36,height:36,borderRadius:'10px',background:m.unread?C.greenLight:C.card,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:600,color:m.unread?C.green:C.textMuted,flexShrink:0}}>{m.from[0]}</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:'13px',fontWeight:m.unread?700:500}}>{m.from}</span><span style={{fontSize:'11px',color:C.textMuted}}>{m.time}</span></div>
            <div style={{fontSize:'12px',color:m.unread?C.text:C.textSub,marginTop:'2px',lineHeight:1.4}}>{m.text}</div>
          </div>
          {m.unread&&<div style={{width:8,height:8,borderRadius:'50%',background:C.green,flexShrink:0,marginTop:'4px'}}/>}
        </Card>
      ))}
      {composing&&(
        <Card style={{padding:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>New message</div>
          <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',marginBottom:'8px'}} placeholder="To: name or department…"/>
          <textarea style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginBottom:'10px'}} rows={3} placeholder="Message…"/>
          <div style={{display:'flex',gap:'8px'}}><Btn style={{flex:1}} onClick={()=>setComposing(false)}>Cancel</Btn><Btn variant="primary" style={{flex:1}}>Send</Btn></div>
        </Card>
      )}
      <div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}} onClick={()=>setComposing(true)}>+ Compose message</Btn></div>
    </div>
  )
}

// ── ADMIN PERMISSIONS ─────────────────────────────────────────────────────────
function AdminPermissions() {
  const permLabels={identity:'View patient identity',vitals:'View & record vitals',history:'View medical history',medications:'View medication records',allergies:'View allergy info',mental:'View mental health records',imaging:'View imaging & scans',labs:'View lab results',prescribe:'Prescribe medications',dispense:'Dispense medications',appointments:'Manage appointments',billing:'View billing info',musculoskeletal:'View musculoskeletal notes',specialty_notes:'Log specialty notes',critical_conditions:'View critical conditions (EMS)',emergency:'Emergency override',tasks:'Manage patient tasks'}
  const [perms,setPerms]=useState(Object.fromEntries(Object.entries(ACCESS).map(([r,a])=>[r,{...a}])))
  const [activeRole,setActiveRole]=useState('nurse')
  const toggle=(role,perm)=>setPerms(p=>({...p,[role]:{...p[role],[perm]:!p[role][perm]}}))
  const rolePerms=perms[activeRole]||{}
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:C.purpleLight,border:`0.5px solid ${C.border}`,margin:'16px 16px 0',borderRadius:'12px',padding:'12px 14px',display:'flex',gap:'10px',alignItems:'center'}}>
        <span style={{fontSize:'16px',color:C.purple}}>⬡</span>
        <div style={{fontSize:'12px',color:C.purple,lineHeight:1.5}}><strong>Admin permission control.</strong> Changes apply institution-wide for that role. Patient consent always takes precedence.</div>
      </div>
      <SecLabel>Select role to configure</SecLabel>
      <div style={{display:'flex',gap:'6px',padding:'0 16px 12px',overflowX:'auto'}}>
        {Object.entries(ROLES).filter(([k])=>k!=='admin').map(([key,r])=>(
          <div key={key} onClick={()=>setActiveRole(key)} style={{flexShrink:0,padding:'6px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'12px',fontWeight:500,background:activeRole===key?r.color:C.card,color:activeRole===key?'#fff':C.textSub,border:`0.5px solid ${activeRole===key?r.color:C.border}`}}>{r.label}</div>
        ))}
      </div>
      <div style={{padding:'0 16px 6px'}}>
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',overflow:'hidden'}}>
          <div style={{background:ROLES[activeRole]?.bg,padding:'12px 16px',borderBottom:`0.5px solid ${C.border}`}}>
            <span style={{fontSize:'14px',fontWeight:600,color:ROLES[activeRole]?.color}}>{ROLES[activeRole]?.icon} {ROLES[activeRole]?.label}</span>
          </div>
          {Object.entries(permLabels).map(([perm,label],i,arr)=>(
            <div key={perm} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>
              <div>
                <div style={{fontSize:'13px',color:C.text}}>{label}</div>
                {(perm==='prescribe'||perm==='dispense')&&<div style={{fontSize:'10px',color:C.amber,marginTop:'2px'}}>Regulated — enable only for licensed roles</div>}
                {perm==='mental'&&<div style={{fontSize:'10px',color:C.textMuted,marginTop:'2px'}}>Requires explicit patient consent regardless</div>}
              </div>
              <Toggle checked={!!rolePerms[perm]} onChange={()=>toggle(activeRole,perm)}/>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:'16px'}}><Btn variant="purple" style={{width:'100%'}}>Save permission changes</Btn></div>
    </div>
  )
}

// ── HELP ──────────────────────────────────────────────────────────────────────
function HelpScreen() {
  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>Help & support</SecLabel>
      {[['Report a technical issue','Contact Medsa support team'],['Submit a complaint','About a patient, colleague, or process'],['FAQ','Common questions about the portal'],['Data & privacy','How patient data is protected']].map(([t,s],i)=>(
        <Card key={i} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
          <div><div style={{fontSize:'14px',fontWeight:500}}>{t}</div><div style={{fontSize:'12px',color:C.textSub}}>{s}</div></div>
          <span style={{color:C.textMuted,fontSize:'18px'}}>›</span>
        </Card>
      ))}
    </div>
  )
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
export default function PractitionerApp() {
  const [role,setRole]=useState(null)
  const [screen,setScreen]=useState('id')
  if(!role) return <ClockInScreen onLogin={r=>{setRole(r);setScreen('id')}}/>
  const r=ROLES[role]
  const navItems=[{key:'id',icon:'◈',label:'My ID'},{key:'patients',icon:'◎',label:'Patients'},{key:'schedule',icon:'▣',label:'Schedule'},{key:'messages',icon:'◇',label:'Messages'},role==='admin'&&{key:'permissions',icon:'⬡',label:'Perms'},{key:'help',icon:'◌',label:'Help'}].filter(Boolean)
  return (
    <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',maxWidth:'440px',margin:'0 auto',background:C.beige}}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{background:C.green,padding:'14px 16px',display:'flex',alignItems:'center',gap:'10px',position:'sticky',top:0,zIndex:10}}>
        <MedsaLogo height={20}/>
        <span style={{flex:1,fontSize:'10px',color:'rgba(255,255,255,0.5)',letterSpacing:'1px',textTransform:'uppercase'}}>practitioner</span>
        <button onClick={()=>setRole(null)} style={{background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',fontSize:'11px',padding:'4px 10px',borderRadius:'20px',cursor:'pointer',fontFamily:'inherit'}}>Clock out</button>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {screen==='id'&&<PractitionerIDScreen role={role}/>}
        {screen==='patients'&&<PatientSearchScreen role={role}/>}
        {screen==='schedule'&&<ScheduleScreen role={role}/>}
        {screen==='messages'&&<MessagesScreen/>}
        {screen==='permissions'&&role==='admin'&&<AdminPermissions/>}
        {screen==='help'&&<HelpScreen/>}
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
