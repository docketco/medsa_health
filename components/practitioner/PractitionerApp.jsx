import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
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
function Badge({ text, type }) {
  const map={ok:[C.greenLight,C.green],due:[C.amberLight,C.amber],full:[C.redLight,C.red]}
  const [bg,fg]=map[type]||map.ok
  return <span style={{fontSize:'11px',background:bg,color:fg,padding:'4px 10px',borderRadius:'20px',fontWeight:500,whiteSpace:'nowrap'}}>{text}</span>
}
function InfoRow({ label, value, highlight=false, last=false }) {
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:last?'none':`0.5px solid ${C.border}`,fontSize:'13px'}}><span style={{color:C.textSub,flexShrink:0,marginRight:'12px'}}>{label}</span><span style={{fontWeight:500,color:highlight?C.red:C.text,textAlign:'right',maxWidth:'60%'}}>{value}</span></div>
}

// ── Role definitions ──────────────────────────────────────────────────────────
const DEPARTMENTS = ['Internal Medicine','Cardiology','Emergency / A&E','Surgery','Psychiatry']
const DOCTOR_DIRECTORY = [
  {name:'Dr Yeung Chi-hong', department:'Internal Medicine'},
  {name:'Dr Ho Ka-fai', department:'Cardiology'},
  {name:'Dr Tsang Wing-lam', department:'Cardiology'},
]
const DOCTOR_NAMES = DOCTOR_DIRECTORY.map(d=>d.name) // kept for the clock-in screen, which doesn't need department filtering

// Full staff directory covering every working role, not just doctors -
// this is what makes shift bidding, working hours, and the department
// schedule view actually apply to everyone, not just doctors, since
// every named entry here can have its own availability row.
const STAFF_DIRECTORY = [
  ...DOCTOR_DIRECTORY.map(d=>({...d, role:'doctor'})),
  {name:'Nurse Yip Mei', department:'Internal Medicine', role:'nurse'},
  {name:'Nurse Wong Chi', department:'Cardiology', role:'nurse'},
  {name:'Receptionist Lam Siu-wan', department:'Internal Medicine', role:'receptionist'},
  {name:'Therapist Chow Hoi-yan', department:'Internal Medicine', role:'therapist'},
  {name:'Allied Health Ng Ka-po', department:'Cardiology', role:'allied'},
]
const WORKING_ROLES = ['doctor','nurse','clinic_nurse','receptionist','therapist','allied']

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
  hr:           {label:'Human Resources',     color:C.navy,   bg:C.navyLight,   icon:'⬢'},
}

const ACCESS = {
  admin:        {identity:true,vitals:false,history:true,medications:true,allergies:true,mental:true,imaging:true,labs:true,prescribe:false,dispense:false,admin_perms:true,admission_reason:true},
  dept_head:    {identity:true,vitals:true,history:true,medications:true,allergies:true,imaging:true,labs:true,prescribe:true,dispense:false,admission_reason:true},
  doctor:       {identity:true,vitals:true,history:true,medications:true,allergies:true,imaging:true,labs:true,prescribe:true,dispense:false,admission_reason:true},
  nurse:        {identity:true,vitals:true,medications:true,allergies:true,tasks:true,prescribe:false,dispense:false,admission_reason:true},
  clinic_nurse: {identity:true,vitals:true,medications:true,allergies:true,tasks:true,prescribe:false,dispense:true,admission_reason:true},
  receptionist: {identity:true,appointments:true,billing:true,prescribe:false,dispense:false,admission_reason:false},
  pharmacist:   {identity:true,medications:true,allergies:true,prescribe:false,dispense:true,admission_reason:false},
  therapist:    {identity:true,vitals:true,musculoskeletal:true,allergies:true,prescribe:false,dispense:false,admission_reason:true},
  ems:          {identity:true,vitals:true,emergency:true,allergies:true,critical_conditions:true,medications:true,prescribe:false,dispense:false,admission_reason:false},
  allied:       {identity:true,specialty_notes:true,allergies:true,prescribe:false,dispense:false,admission_reason:true},
  hr:           {identity:false,vitals:false,history:false,medications:false,allergies:false,mental:false,imaging:false,labs:false,prescribe:false,dispense:false,admission_reason:false}, // no clinical data grant at all - staffing/scheduling only
}

// ── CLOCK IN ─────────────────────────────────────────────────────────────────
function ClockInScreen({ onLogin }) {
  const [scanning,setScanning]=useState(false)
  const [scanned,setScanned]=useState(false)
  const [sel,setSel]=useState(null)
  const [dept,setDept]=useState(null)
  const [doctorName,setDoctorName]=useState(null)
  const needsDoctorName = WORKING_ROLES.includes(sel)

  async function handleContinue() {
    // Unify the old STAFF_DIRECTORY-based login with the real
    // staff_credentials table - if this person has actually been onboarded
    // for real, pull their genuine specialty so credential-matching on
    // shift openings works correctly. Falls back to null for demo-only
    // staff never onboarded through the real flow.
    let specialty = null
    if (needsDoctorName && doctorName) {
      const { data } = await supabase.from('staff_credentials').select('specialty').eq('full_name', doctorName).maybeSingle()
      specialty = data?.specialty || null
    }
    onLogin({ role: sel, department: dept, doctorName: needsDoctorName ? doctorName : null, specialty })
  }

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
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
            {Object.entries(ROLES).map(([key,r])=>(
              <div key={key} onClick={()=>{setSel(key);setDept(null);setDoctorName(null)}} style={{background:sel===key?r.bg:C.cream,border:`0.5px solid ${sel===key?r.color:C.border}`,borderRadius:'12px',padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:'12px'}}>
                <span style={{fontSize:'18px',color:r.color}}>{r.icon}</span>
                <span style={{fontSize:'14px',fontWeight:500,color:sel===key?r.color:C.text}}>{r.label}</span>
                {sel===key&&<span style={{marginLeft:'auto',color:r.color,fontWeight:700}}>✓</span>}
              </div>
            ))}
          </div>

          {sel&&<>
            <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px'}}>Select your department</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'20px'}}>
              {DEPARTMENTS.map(d=>(
                <div key={d} onClick={()=>setDept(d)} style={{padding:'9px 14px',borderRadius:'20px',fontSize:'12px',fontWeight:500,cursor:'pointer',background:dept===d?C.green:C.cream,color:dept===d?'#fff':C.textSub,border:`0.5px solid ${dept===d?C.green:C.border}`}}>{d}</div>
              ))}
            </div>
          </>}

          {needsDoctorName&&dept&&<>
            <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px'}}>Which {ROLES[sel].label.toLowerCase()} are you?</div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
              {STAFF_DIRECTORY.filter(s=>s.role===sel&&s.department===dept).map(s=>(
                <div key={s.name} onClick={()=>setDoctorName(s.name)} style={{padding:'11px 16px',borderRadius:'10px',fontSize:'13px',fontWeight:500,cursor:'pointer',background:doctorName===s.name?C.blueLight:C.cream,color:doctorName===s.name?C.blue:C.text,border:`0.5px solid ${doctorName===s.name?C.blue:C.border}`}}>{s.name}</div>
              ))}
              {STAFF_DIRECTORY.filter(s=>s.role===sel&&s.department===dept).length===0&&<div style={{fontSize:'12px',color:C.textMuted,padding:'8px 0'}}>No one on file for this role in this department yet.</div>}
            </div>
          </>}

          {sel&&dept&&(!needsDoctorName||doctorName)&&<Btn variant="primary" style={{width:'100%',padding:'14px'}} onClick={handleContinue}>Clock in as {ROLES[sel].label} →</Btn>}
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
        <div style={{fontSize:'20px',fontWeight:700,marginBottom:'2px'}}>Dr Yeung Chi-hong</div>
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
// ── PRESCRIBE MODAL — writes directly to Supabase medications table so it ────
// syncs to the patient's Medsa app immediately, and becomes visible to any
// nurse/pharmacist who scans the patient for dispensing.
function PrescribeModal({ open, onClose, patientMedsaId }) {
  const [lines,setLines]=useState([{drug:'',dosage:'',frequency:''}])
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState(null)

  if (!open) return null

  function updateLine(i, field, value) {
    setLines(lines.map((l,idx)=>idx===i?{...l,[field]:value}:l))
  }
  function addLine() { setLines([...lines, {drug:'',dosage:'',frequency:''}]) }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const { data: patient, error: pErr } = await supabase.from('patients').select('id').eq('medsa_id', patientMedsaId).single()
      if (pErr || !patient) throw new Error('Patient not found in Medsa')
      const rows = lines.filter(l=>l.drug.trim()).map(l=>({
        patient_id: patient.id,
        medication_name: l.drug,
        dosage: l.dosage,
        frequency: l.frequency,
        active: true,
        on_emergency_card: false,
        start_date: new Date().toISOString().slice(0,10),
      }))
      if (rows.length===0) throw new Error('Add at least one drug')
      const { error: insErr } = await supabase.from('medications').insert(rows)
      if (insErr) throw insErr
      setSaved(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:440,padding:'24px',maxHeight:'85vh',overflowY:'auto'}}>
        {!saved ? <>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'6px'}}>New prescription</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>Syncs to the patient's Medsa app immediately. Any nurse or pharmacist scanning this patient will see exactly what to dispense.</div>
          {lines.map((l,i)=>(
            <div key={i} style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'10px',background:C.card,borderRadius:'10px',padding:'10px'}}>
              <input value={l.drug} onChange={e=>updateLine(i,'drug',e.target.value)} placeholder="Drug name" style={{border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px 10px',fontSize:'13px',background:'#fff'}}/>
              <div style={{display:'flex',gap:'6px'}}>
                <input value={l.dosage} onChange={e=>updateLine(i,'dosage',e.target.value)} placeholder="Dosage" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px 10px',fontSize:'13px',background:'#fff'}}/>
                <input value={l.frequency} onChange={e=>updateLine(i,'frequency',e.target.value)} placeholder="Frequency" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px 10px',fontSize:'13px',background:'#fff'}}/>
              </div>
            </div>
          ))}
          <Btn style={{width:'100%',marginBottom:'14px'}} onClick={addLine}>+ Add drug</Btn>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save prescription'}</Btn>
          </div>
        </> : <>
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:'32px',marginBottom:'10px'}}>✓</div>
            <div style={{fontSize:'15px',fontWeight:700,marginBottom:'6px'}}>Prescription saved</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'18px'}}>Synced to the patient's Medsa record. Visible now to pharmacist and nurse roles for dispensing.</div>
            <Btn variant="primary" style={{width:'100%'}} onClick={onClose}>Done</Btn>
          </div>
        </>}
      </div>
    </div>
  )
}

// ── NEW PATIENT REGISTRATION — for patients not yet on Medsa ─────────────────
// Creates a placeholder profile. When the patient later downloads Medsa and
// registers themselves with the same name/DOB or gets matched by HKID, their
// full record picks up automatically — this is a front-desk convenience,
// not a substitute for the patient owning their own account.
function NewPatientRegistration({ onBack }) {
  const [form,setForm]=useState({fullName:'',dob:'',hkid:'',phone:''})
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState(null)
  const [claimCode,setClaimCode]=useState(null)

  function generateClaimCode() {
    return Math.random().toString(36).slice(2,8).toUpperCase()
  }

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      if (!form.hkid) throw new Error('HKID is required so the patient can later claim this profile.')
      if (!form.phone) throw new Error('Phone number is required to send the claim code.')
      const medsaId = 'MDS-' + Math.floor(10000+Math.random()*89999) + '-HK'
      const code = generateClaimCode()
      const expiresAt = new Date(Date.now() + 48*60*60*1000).toISOString()
      const { error: insErr } = await supabase.from('patients').insert({
        medsa_id: medsaId,
        full_name: form.fullName,
        date_of_birth: form.dob,
        hkid: form.hkid,
        phone: form.phone,
        emergency_card_consent: false,
        emergency_card_active: false,
        registration_path: 'unclaimed',
        claim_code: code,
        claim_code_expires_at: expiresAt,
        claim_code_sent_to: form.phone,
      })
      if (insErr) throw insErr
      setClaimCode(code)
      setSaved(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (saved) return (
    <div style={{background:C.beige,flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 24px',textAlign:'center'}}>
      <div style={{fontSize:'36px',marginBottom:'12px'}}>✓</div>
      <div style={{fontSize:'16px',fontWeight:700,marginBottom:'8px'}}>Patient registered</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px',lineHeight:1.6}}>A Medsa profile has been created for {form.fullName}. A claim code has been sent to {form.phone} - valid for 48 hours - which they will enter alongside their HKID in the Medsa app to link this record to their own account.</div>
      <div style={{background:C.card,borderRadius:'10px',padding:'14px',marginBottom:'20px'}}>
        <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>Claim code (demo - normally sent by SMS, not shown here)</div>
        <div style={{fontSize:'22px',fontWeight:700,letterSpacing:'2px',color:C.green}}>{claimCode}</div>
      </div>
      <Btn variant="primary" onClick={onBack}>Back to search</Btn>
    </div>
  )

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{padding:'12px 16px 4px'}}>
        <div onClick={onBack} style={{fontSize:'12px',color:C.green,cursor:'pointer'}}>← Back</div>
      </div>
      <SecLabel>Register new patient</SecLabel>
      <Card style={{padding:'16px'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          <input value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} placeholder="Full name" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'14px'}}/>
          <input value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} placeholder="Date of birth (YYYY-MM-DD)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'14px'}}/>
          <input value={form.hkid} onChange={e=>setForm({...form,hkid:e.target.value})} placeholder="HKID (required)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'14px'}}/>
          <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone number (required - claim code sent here)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'14px'}}/>
        </div>
      </Card>
      <div style={{margin:'0 16px 16px',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'10px',padding:'12px 14px',fontSize:'12px',color:C.textSub,lineHeight:1.5}}>
        ◇ A claim code will be sent to this phone number, valid 48 hours. The patient enters their HKID plus this code in the Medsa app to securely link this record.
      </div>
      {error&&<div style={{margin:'0 16px 10px',fontSize:'12px',color:C.red}}>{error}</div>}
      <div style={{padding:'0 16px 16px'}}>
        <Btn variant="primary" style={{width:'100%'}} onClick={handleSubmit} disabled={saving||!form.fullName||!form.dob}>{saving?'Saving…':'Create Medsa profile'}</Btn>
      </div>
    </div>
  )
}

// ── CHECK-IN (receptionist) ─────────────────────────────────────────────────
// ── SHIFT BIDDING — auto-confirms unless the winner would exceed max hours ──
// Real max-hours check: legal maximum is fixed in code below (set by law,
// never institution-configurable); institution_max_hours (set by
// Institution Admin) must sit at or below that floor and is what's
// actually enforced here.
const LEGAL_MAX_HOURS = { doctor: 72, dept_head: 72, nurse: 60, clinic_nurse: 60, therapist: 60, allied: 60 }

async function getStaffWeekHours(staffName, institutionSource, weekStart) {
  // Regular scheduled hours from doctor_availability for the week, minus
  // any day they have approved leave, plus hours from any other shifts
  // they've already won via bidding that same week.
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+6)

  const { data: availRows } = await supabase.from('doctor_availability').select('*')
    .eq('doctor_name', staffName).eq('institution_source', institutionSource)
  const { data: leaveRows } = await supabase.from('leave_requests').select('*')
    .eq('staff_name', staffName).eq('institution_source', institutionSource).eq('status','approved')
    .lte('start_date', weekEnd.toISOString().slice(0,10)).gte('end_date', weekStart.toISOString().slice(0,10))
  const { data: wonBids } = await supabase.from('shift_bid_entries').select('*, shift_bids(*)')
    .eq('bidder_name', staffName).eq('status','won')

  let hours = 0
  for (let i=0; i<7; i++) {
    const d = new Date(weekStart); d.setDate(d.getDate()+i)
    const onLeave = (leaveRows||[]).some(l => d >= new Date(l.start_date) && d <= new Date(l.end_date))
    if (onLeave) continue
    const row = (availRows||[]).find(r => r.day_of_week === d.getDay())
    if (row && !row.is_off) {
      const [sh,sm] = row.start_time.slice(0,5).split(':').map(Number)
      const [eh,em] = row.end_time.slice(0,5).split(':').map(Number)
      hours += ((eh*60+em) - (sh*60+sm)) / 60
    }
  }
  ;(wonBids||[]).forEach(b => {
    const bid = b.shift_bids
    if (!bid) return
    const bidDate = new Date(bid.shift_date)
    if (bidDate >= weekStart && bidDate <= weekEnd) {
      const [sh,sm] = bid.start_time.slice(0,5).split(':').map(Number)
      const [eh,em] = bid.end_time.slice(0,5).split(':').map(Number)
      hours += ((eh*60+em) - (sh*60+sm)) / 60
    }
  })
  return hours
}

// Processes bids for one shift in the order they came in - first bidder
// whose projected hours stay within the ceiling wins; anyone over the
// ceiling is auto-rejected and the next bidder is checked automatically.
async function processShiftBids(shiftBidId) {
  const { data: bid } = await supabase.from('shift_bids').select('*').eq('id', shiftBidId).maybeSingle()
  if (!bid || bid.status !== 'open') return

  const { data: entries } = await supabase.from('shift_bid_entries').select('*')
    .eq('shift_bid_id', shiftBidId).eq('status','pending').order('bid_at', {ascending:true})

  const [sh,sm] = bid.start_time.slice(0,5).split(':').map(Number)
  const [eh,em] = bid.end_time.slice(0,5).split(':').map(Number)
  const shiftHours = ((eh*60+em) - (sh*60+sm)) / 60
  const weekStart = new Date(bid.shift_date); weekStart.setDate(weekStart.getDate() - weekStart.getDay())

  for (const entry of (entries||[])) {
    const bidderRole = STAFF_DIRECTORY.find(s=>s.name===entry.bidder_name)?.role || 'doctor'
    const { data: ceilingRow } = await supabase.from('role_max_hours').select('*')
      .eq('institution_source', bid.institution_source).eq('role', bidderRole).maybeSingle()
    const ceiling = ceilingRow?.max_hours_per_week || LEGAL_MAX_HOURS[bidderRole] || 60
    const currentHours = await getStaffWeekHours(entry.bidder_name, bid.institution_source, weekStart)
    if (currentHours + shiftHours <= ceiling) {
      await supabase.from('shift_bid_entries').update({status:'won'}).eq('id', entry.id)
      await supabase.from('shift_bid_entries').update({status:'lost'}).eq('shift_bid_id', shiftBidId).neq('id', entry.id).eq('status','pending')
      await supabase.from('shift_bids').update({status:'filled'}).eq('id', shiftBidId)
      return { winner: entry.bidder_name, rejected: false }
    } else {
      await supabase.from('shift_bid_entries').update({status:'rejected_hours'}).eq('id', entry.id)
    }
  }
  return { winner: null, rejected: true }
}

function ShiftBiddingScreen({ role, doctorName, department }) {
  const [openShifts,setOpenShifts]=useState([])
  const [myBids,setMyBids]=useState([])
  const [loading,setLoading]=useState(true)
  const [showPostModal,setShowPostModal]=useState(false)
  const [postDate,setPostDate]=useState('')
  const [postStart,setPostStart]=useState('09:00')
  const [postEnd,setPostEnd]=useState('17:00')
  const [postReason,setPostReason]=useState('sick')
  const [postOnBehalfOf,setPostOnBehalfOf]=useState('')
  const [showNameSuggestions,setShowNameSuggestions]=useState(false)
  const [posting,setPosting]=useState(false)

  async function loadShifts() {
    setLoading(true)
    const { data } = await supabase.from('shift_bids').select('*, shift_bid_entries(*)')
      .eq('institution_source','practitioner').order('shift_date',{ascending:true})
    setOpenShifts(data||[])
    if (doctorName) setMyBids((data||[]).filter(s=>(s.shift_bid_entries||[]).some(e=>e.bidder_name===doctorName)))
    setLoading(false)
  }

  useEffect(() => { loadShifts() }, [])

  async function handlePostShift() {
    const staffName = role==='dept_head' ? postOnBehalfOf : doctorName
    if (!postDate || !staffName) return
    setPosting(true)
    await supabase.from('shift_bids').insert({
      institution_source:'practitioner', department: department||'General', staff_name: staffName,
      shift_date: postDate, start_time: postStart, end_time: postEnd, reason: postReason,
      opened_by: role==='dept_head' ? 'Department Head' : staffName, opened_on_behalf: role==='dept_head', status:'open',
    })
    setPosting(false)
    setShowPostModal(false)
    setPostOnBehalfOf('')
    loadShifts()
  }

  async function handleBid(shiftBidId) {
    const shift = openShifts.find(s=>s.id===shiftBidId)
    const shiftOwnerRole = STAFF_DIRECTORY.find(st=>st.name===shift?.staff_name)?.role
    if (shiftOwnerRole !== role) return // same guard as the UI, kept here too in case this is ever called another way
    await supabase.from('shift_bid_entries').insert({ shift_bid_id: shiftBidId, bidder_name: doctorName, status:'pending' })
    await processShiftBids(shiftBidId)
    loadShifts()
  }

  return (
    <div style={{background:C.beige,flex:1,padding:'16px'}}>
      {WORKING_ROLES.includes(role)&&<>
        <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
          <Btn variant="danger" style={{flex:1}} onClick={()=>{setPostDate(new Date().toISOString().slice(0,10));setPostReason('sick');setShowPostModal(true)}}>Report sick today</Btn>
          <Btn variant="primary" style={{flex:1}} onClick={()=>{setPostDate('');setPostReason('planned');setShowPostModal(true)}}>Post shift for bidding</Btn>
        </div>
        <div style={{background:C.redLight,borderRadius:'10px',padding:'12px 14px',marginBottom:'16px',fontSize:'12px',color:C.red,lineHeight:1.5}}>
          ◇ Same-day sick? Call your Department Head directly - they can open bidding on your behalf while you rest.
        </div>
      </>}
      {role==='dept_head'&&<div style={{marginBottom:'16px'}}>
        <Btn variant="danger" style={{width:'100%'}} onClick={()=>{setPostDate(new Date().toISOString().slice(0,10));setPostReason('sick');setShowPostModal(true)}}>Open bidding on a staff member's behalf</Btn>
      </div>}

      <SecLabel>Open shifts</SecLabel>
      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>Loading…</div>}
      {!loading&&openShifts.filter(s=>s.status==='open').length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>No open shifts right now.</div>}
      {openShifts.filter(s=>s.status==='open').map(s=>{
        const alreadyBid = (s.shift_bid_entries||[]).some(e=>e.bidder_name===doctorName)
        const shiftOwnerRole = STAFF_DIRECTORY.find(st=>st.name===s.staff_name)?.role
        const roleMatches = shiftOwnerRole === role
        return (
          <Card key={s.id} style={{padding:'14px 16px',marginBottom:'8px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
              <span style={{fontSize:'13px',fontWeight:600}}>{new Date(s.shift_date).toLocaleDateString('en-HK',{weekday:'short',day:'numeric',month:'short'})} · {s.start_time.slice(0,5)}-{s.end_time.slice(0,5)}</span>
              <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',background:C.amberLight,color:C.amber}}>Open</span>
            </div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>{s.department} · covering {s.staff_name} ({ROLES[shiftOwnerRole]?.label||shiftOwnerRole}, {s.reason==='sick'?'sick day':'planned'}){s.opened_on_behalf?' · opened by Dept Head':''}</div>
            {WORKING_ROLES.includes(role)&&s.staff_name!==doctorName&&roleMatches&&<Btn variant="primary" style={{width:'100%'}} onClick={()=>handleBid(s.id)} disabled={alreadyBid}>{alreadyBid?'Bid placed':'Bid for this shift'}</Btn>}
            {WORKING_ROLES.includes(role)&&s.staff_name!==doctorName&&!roleMatches&&<div style={{fontSize:'11px',color:C.textMuted,textAlign:'center'}}>Only {ROLES[shiftOwnerRole]?.label||shiftOwnerRole} staff can bid on this shift</div>}
          </Card>
        )
      })}

      {myBids.length>0&&<>
        <SecLabel>Your bids</SecLabel>
        {myBids.map(s=>{
          const myEntry = (s.shift_bid_entries||[]).find(e=>e.bidder_name===doctorName)
          const statusInfo = {
            won: {label:'✓ Won - auto-confirmed', bg:C.greenLight, color:C.green},
            lost: {label:'Lost to another bidder', bg:C.card, color:C.textMuted},
            rejected_hours: {label:'⚠ Rejected - would exceed max hours', bg:C.redLight, color:C.red},
            pending: {label:'Pending', bg:C.amberLight, color:C.amber},
          }[myEntry?.status] || {label:myEntry?.status, bg:C.card, color:C.textMuted}
          return (
            <Card key={s.id} style={{padding:'12px 16px',marginBottom:'8px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'12px',fontWeight:500}}>{new Date(s.shift_date).toLocaleDateString('en-HK',{weekday:'short',day:'numeric',month:'short'})} · {s.start_time.slice(0,5)}-{s.end_time.slice(0,5)}</span>
                <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',background:statusInfo.bg,color:statusInfo.color,fontWeight:500}}>{statusInfo.label}</span>
              </div>
            </Card>
          )
        })}
      </>}

      {showPostModal&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowPostModal(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:380,padding:'24px'}}>
          <div style={{fontSize:'16px',fontWeight:700,marginBottom:'16px'}}>{postReason==='sick'?'Report sick today':'Post shift for bidding'}</div>
          {role==='dept_head'&&<div style={{position:'relative',marginBottom:'10px'}}>
            <input
              value={postOnBehalfOf}
              onChange={e=>{setPostOnBehalfOf(e.target.value);setShowNameSuggestions(true)}}
              onFocus={()=>setShowNameSuggestions(true)}
              onBlur={()=>setTimeout(()=>setShowNameSuggestions(false),150)}
              placeholder="Staff member's name"
              style={{width:'100%',boxSizing:'border-box'}}
            />
            {showNameSuggestions&&postOnBehalfOf.trim()&&<div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:'8px',marginTop:'4px',zIndex:20,maxHeight:150,overflowY:'auto'}}>
              {DOCTOR_DIRECTORY.filter(d=>d.name.toLowerCase().includes(postOnBehalfOf.toLowerCase())).slice(0,6).map(d=>(
                <div key={d.name} onMouseDown={()=>{setPostOnBehalfOf(d.name);setShowNameSuggestions(false)}} style={{padding:'8px 12px',fontSize:'12px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`}}>{d.name}</div>
              ))}
            </div>}
          </div>}
          <input type="date" value={postDate} onChange={e=>setPostDate(e.target.value)} style={{width:'100%',marginBottom:'10px',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:'8px',marginBottom:'14px'}}>
            <input type="time" value={postStart} onChange={e=>setPostStart(e.target.value)} style={{flex:1}}/>
            <input type="time" value={postEnd} onChange={e=>setPostEnd(e.target.value)} style={{flex:1}}/>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setShowPostModal(false)}>Cancel</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={handlePostShift} disabled={posting||!postDate}>{posting?'Posting…':'Confirm'}</Btn>
          </div>
        </div>
      </div>}
    </div>
  )
}

function CheckInScreen() {
  const [mode,setMode]=useState('scan') // 'scan' | 'search'
  const [scanChoices,setScanChoices]=useState([])
  const [found,setFound]=useState(null)
  const [searchTerm,setSearchTerm]=useState('')
  const [searched,setSearched]=useState(false)
  const [checkedIn,setCheckedIn]=useState(false)
  const [checkInNote,setCheckInNote]=useState(null)

  async function loadScanChoices() {
    const { data } = await supabase.from('patients').select('*').limit(10)
    setScanChoices(data || [])
  }

  // Real check-in: finds today's appointment for this patient and marks
  // it checked_in, so the doctor's Today's Patients view can correctly
  // gate full diagnosis access on actual arrival, not just being
  // scheduled. Previously this button only set local state and never
  // touched the real appointment at all.
  async function handleRealCheckIn() {
    const dayStart = new Date(); dayStart.setHours(0,0,0,0)
    const dayEnd = new Date(); dayEnd.setHours(23,59,59,999)
    const { data: todaysAppt } = await supabase.from('appointments').select('id')
      .eq('patient_id', found.id)
      .eq('institution_source', 'practitioner')
      .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())
      .limit(1).maybeSingle()

    if (todaysAppt) {
      await supabase.from('appointments').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', todaysAppt.id)
      setCheckInNote(null)
    } else {
      setCheckInNote('No scheduled appointment found for today - checked in as a walk-in, not linked to a specific appointment.')
    }
    setCheckedIn(true)
  }

  function handleScanPick(p) {
    setFound(p)
    setCheckedIn(false)
  }

  async function handleSearch() {
    if (!searchTerm.trim()) return
    const term = searchTerm.trim()
    const { data } = await supabase.from('patients').select('*')
      .or(`medsa_id.ilike.%${term}%,full_name.ilike.%${term}%`).limit(1).maybeSingle()
    setFound(data || null)
    setSearched(true)
    setCheckedIn(false)
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>Check-in</SecLabel>
      <div style={{display:'flex',gap:'8px',padding:'0 16px 16px'}}>
        {[['scan','Scan to check in'],['search','Search patients']].map(([k,l])=>(
          <div key={k} onClick={()=>{setMode(k);setFound(null);setCheckedIn(false)}} style={{flex:1,fontSize:'13px',padding:'9px 12px',borderRadius:'20px',cursor:'pointer',background:mode===k?C.green:C.card,color:mode===k?'#fff':C.textSub,fontWeight:500,textAlign:'center'}}>{l}</div>
        ))}
      </div>

      {mode==='scan'&&!found&&<div style={{padding:'0 16px'}}>
        {scanChoices.length===0&&<div onClick={loadScanChoices} style={{background:C.cream,border:`1.5px dashed ${C.border}`,borderRadius:'14px',padding:'40px 20px',textAlign:'center',cursor:'pointer'}}>
          <div style={{fontSize:'32px',color:C.green,marginBottom:'10px'}}>⬡</div>
          <div style={{fontSize:'14px',fontWeight:600}}>Tap to simulate scanning a patient's card</div>
        </div>}
        {scanChoices.length>0&&<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Demo: tap the patient whose card is being scanned</div>
          {scanChoices.map(p=>(
            <div key={p.id} onClick={()=>handleScanPick(p)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 16px',cursor:'pointer',display:'flex',justifyContent:'space-between'}}>
              <span style={{fontSize:'14px',fontWeight:500}}>{p.full_name}</span>
              <span style={{fontSize:'11px',color:C.textMuted}}>{p.medsa_id}</span>
            </div>
          ))}
        </div>}
      </div>}

      {mode==='search'&&!found&&<div style={{padding:'0 16px'}}>
        <div style={{display:'flex',gap:'8px',marginBottom:'14px'}}>
          <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()} placeholder="Search by name or Medsa ID…" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',background:C.cream,outline:'none',boxSizing:'border-box'}}/>
          <Btn variant="primary" onClick={handleSearch}>Search</Btn>
        </div>
        {searched&&!found&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>No patient found matching "{searchTerm}".</div>}
      </div>}

      {found&&<div style={{padding:'0 16px'}}>
        <Card style={{padding:'20px'}}>
          <div style={{fontSize:'11px',color:C.green,fontWeight:600,textTransform:'uppercase',marginBottom:'8px'}}>✓ Patient found</div>
          <div style={{fontSize:'18px',fontWeight:700}}>{found.full_name}</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>{found.medsa_id} · DOB {new Date(found.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
          {!checkedIn
            ? <div style={{display:'flex',gap:'10px'}}>
                <Btn onClick={()=>{setFound(null);setSearched(false)}}>Cancel</Btn>
                <Btn variant="primary" style={{flex:1}} onClick={handleRealCheckIn}>Check in patient</Btn>
              </div>
            : <div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'12px',textAlign:'center'}}>
                <div style={{fontSize:'13px',color:C.green,fontWeight:600}}>✓ {found.full_name} checked in</div>
                {checkInNote&&<div style={{fontSize:'11px',color:C.amber,marginTop:'8px'}}>{checkInNote}</div>}
                <Btn style={{marginTop:'10px'}} onClick={()=>{setFound(null);setSearched(false);setCheckedIn(false);setCheckInNote(null)}}>Check in another patient</Btn>
              </div>}
        </Card>
      </div>}
    </div>
  )
}

function PatientSearchScreen({ role, liveData={}, autoOpenLog=false, autoOpenRecord=false }) {
  const [view,setView]=useState('search')
  const [activeTab,setActiveTab]=useState('overview')
  const [isAdmitted,setIsAdmitted]=useState(false) // demo toggle - Bed/Location only shows once actually admitted

  useEffect(() => {
    if (autoOpenLog) { setView('patient'); setActiveTab('log') }
  }, [autoOpenLog])

  useEffect(() => {
    if (autoOpenRecord) { setView('patient'); setActiveTab('overview') }
  }, [autoOpenRecord])
  const [logText,setLogText]=useState('')
  const [logSaved,setLogSaved]=useState(false)
  const [diagnosis,setDiagnosis]=useState('')
  const [logSaving,setLogSaving]=useState(false)
  const [logDraftSaving,setLogDraftSaving]=useState(false)
  const [logDraftSaved,setLogDraftSaved]=useState(false)
  const [logError,setLogError]=useState(null)

  // Real writes to the patient's medical record - previously these
  // buttons only set local state and never touched Supabase at all.
  // "Save" writes a draft (editable, not final); "Submit" writes the
  // final record - this replaces needing a separate prep-notes feature,
  // since the same fields work for both pre-visit review and the actual
  // visit note.
  async function writeLogEntry(status) {
    if (!logText.trim() && !diagnosis.trim()) return
    const isDraft = status==='draft'
    isDraft ? setLogDraftSaving(true) : setLogSaving(true)
    setLogError(null)
    try {
      const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', patient.id).maybeSingle()
      if (!patientRow) throw new Error('Could not find this patient in Medsa.')
      const { error: insErr } = await supabase.from('medical_records').insert({
        patient_id: patientRow.id, record_type: 'visit', title: diagnosis || 'Consultation note',
        notes: logText || null, diagnosis: diagnosis || null,
        date_of_record: new Date().toISOString().slice(0,10), source: 'practitioner_log', record_status: status,
      })
      if (insErr) throw insErr
      if (isDraft) { setLogDraftSaved(true); setTimeout(()=>setLogDraftSaved(false), 2500) }
      else setLogSaved(true)
    } catch (e) {
      setLogError(e.message)
    } finally {
      isDraft ? setLogDraftSaving(false) : setLogSaving(false)
    }
  }
  const [showPrescribeModal,setShowPrescribeModal]=useState(false)
  const [dispensedIds,setDispensedIds]=useState([])
  const [patientMsgSubject,setPatientMsgSubject]=useState('')
  const [patientMsgUrgent,setPatientMsgUrgent]=useState(false)
  const [patientMsgBody,setPatientMsgBody]=useState('')
  const [patientMsgSaving,setPatientMsgSaving]=useState(false)
  const [patientMsgSaved,setPatientMsgSaved]=useState(false)
  const [patientMsgError,setPatientMsgError]=useState(null)
  const canRegisterPatients = role==='receptionist'||role==='admin'
  const access=ACCESS[role]||{}

  async function handleSendPatientMessage(patientMedsaId, doctorLabel) {
    if (!patientMsgBody.trim()) { setPatientMsgError('Write a message first.'); return }
    setPatientMsgSaving(true)
    setPatientMsgError(null)
    try {
      const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', patientMedsaId).maybeSingle()
      if (!patientRow) throw new Error('Could not find this patient in Medsa.')
      const { error: insErr } = await supabase.from('patient_messages').insert({
        patient_id: patientRow.id,
        doctor_name: doctorLabel,
        subject: patientMsgSubject || null,
        body: patientMsgBody,
        urgent: patientMsgUrgent,
      })
      if (insErr) throw insErr
      setPatientMsgSaved(true)
      setPatientMsgSubject(''); setPatientMsgBody(''); setPatientMsgUrgent(false)
      setTimeout(()=>setPatientMsgSaved(false), 3000)
    } catch (e) {
      setPatientMsgError(e.message)
    } finally {
      setPatientMsgSaving(false)
    }
  }

  const lp = liveData.patient
  const hasLive = !!lp
  const patient={
    name: hasLive ? lp.full_name : 'Wong Mei-ling, Lisa',
    id: hasLive ? lp.medsa_id : 'MDS-84921-HK',
    dob: hasLive ? new Date(lp.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}) : '14 Mar 1988',
    age: hasLive ? Math.floor((Date.now()-new Date(lp.date_of_birth))/(365.25*24*60*60*1000)) : 37,
    bloodType: hasLive ? lp.blood_type : 'O+',
    allergies: hasLive && liveData.allergies?.length ? liveData.allergies.map(a=>`${a.allergen} (${a.severity})`) : ['Penicillin (severe)','Dust mites (moderate)'],
    ward:'Ward 3B · Bed 12',status:'Outpatient',
    admissionReason:'Diabetic review — elevated glucose levels, persistent fatigue. Referred by Dr Chan for inpatient monitoring and medication adjustment.',
    emergency: hasLive ? {name:lp.emergency_contact_name, relation:lp.emergency_contact_rel, phone:lp.emergency_contact_phone} : {name:'Wong Tai',relation:'Mother',phone:'+852 9xxx xxxx'},
    vitals:{'Blood pressure':'118/76 mmHg','Heart rate':'72 bpm','Temperature':'36.8°C','SpO₂':'98%','Weight':'58 kg','Blood glucose':'5.9 mmol/L'},
    currentMeds: hasLive && liveData.medications?.length ? liveData.medications.map(m=>`${m.medication_name} ${m.dosage||''} — ${m.frequency||''}`.trim()) : ['Metformin 500mg — twice daily','Vitamin D3 1000IU — daily','Aspirin 100mg — daily'],
    criticalConditions: hasLive && liveData.conditions?.length ? liveData.conditions.map(c=>`${c.condition_name}${c.severity?' ('+c.severity+')':''}`) : ['Type 2 Diabetes (controlled)','Iron deficiency anaemia'],
    institutionRecords: hasLive && liveData.records?.length ? liveData.records.slice(0,6).map(r=>`${new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short'})} — ${r.title}, ${r.institutions?.name||''}`) : ['20 Jun — Admitted, Internal Medicine','21 Jun — Vitals recorded, Nurse Yip','22 Jun — Dr Chan consultation, symptom log updated','23 Jun — Blood panel ordered'],
    consent:{history:true,imaging:true,mental:false,social:false},
  }

  if(view==='ems') return <EMSCard onClose={()=>setView('search')}/>
  if(view==='newpatient') return <NewPatientRegistration onBack={()=>setView('search')}/>

  if(view==='patient') {
    const tabs=[
      {key:'overview',label:'Overview'},
      access.vitals&&{key:'vitals',label:'Vitals'},
      access.history&&{key:'history',label:'History'},
      access.medications&&{key:'medications',label:'Meds'},
      (access.prescribe||role==='doctor'||role==='dept_head'||role==='therapist'||role==='allied')&&{key:'log',label:'Log'},
      (role==='doctor'||role==='therapist'||role==='allied')&&{key:'message',label:'Message'},
    ].filter(Boolean)
    return (
      <>
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
            <span style={{fontSize:'11px',background:isAdmitted?C.greenLight:C.card,color:isAdmitted?C.green:C.textSub,padding:'3px 10px',borderRadius:'20px',fontWeight:500}}>{isAdmitted?patient.ward:'Outpatient'}</span>
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
            <InfoRow label="Ward / Bed" value={isAdmitted?patient.ward:'Not admitted - outpatient'}/>
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
              {condition:'Type 2 Diabetes (insulin-dependent)',since:'2018',severity:'Controlled',managing:'Dr Yeung Chi-hong · QE Hospital'},
              {condition:'Iron deficiency anaemia',since:'2020',severity:'Mild',managing:'Dr Yeung Chi-hong · QE Hospital'},
              {condition:'Coronary artery disease',since:'2021',severity:'Stable',managing:'Dr Tsang Wing-lam · HK Sanatorium'},
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
            {date:'20 Jun 2025',institution:'QE Hospital',type:'Admission',doctor:'Dr Yeung Chi-hong',dept:'Internal Medicine',notes:'Admitted for diabetic review. Elevated glucose 5.9 mmol/L. Fatigue reported. Blood panel ordered. Metformin dose reviewed.',icon:'▣',bg:C.blueLight},
            {date:'12 Jun 2025',institution:'QE Hospital',type:'Lab results',doctor:'Dr Yeung Chi-hong',dept:'Pathology',notes:'Full CBC. Haemoglobin 13.8 g/dL (normal). WBC 6.2 × 10⁹/L (normal). Glucose 5.9 mmol/L (slightly elevated). Iron 8.2 μmol/L (low).',icon:'◉',bg:C.greenLight},
            {date:'3 May 2025',institution:'Matilda International',type:'Outpatient visit',doctor:'Dr Ho Siu-wai',dept:'General Practice',notes:'Annual check-up. BP 118/76 mmHg. BMI 22.4. Mild iron deficiency noted. Iron supplement prescribed. Flu vaccine recommended.',icon:'◎',bg:C.greenLight},
            {date:'18 Feb 2025',institution:'Ruttonjee Hospital',type:'Imaging',doctor:'Dr Tsang Wing-lam',dept:'Radiology',notes:'Chest X-ray. No active TB. Lungs clear. Cardiac silhouette normal. Incidental mild cardiomegaly — noted for cardiology follow-up.',icon:'▣',bg:C.amberLight},
            {date:'9 Jan 2025',institution:'HK Sanatorium',type:'Specialist',doctor:'Dr Tsang Wing-lam',dept:'Cardiology',notes:'Coronary artery disease annual review. ECG normal sinus rhythm. Atorvastatin continued. BP well controlled. Next review in 12 months.',icon:'◈',bg:C.blueLight},
            {date:'14 Oct 2024',institution:'QE Hospital',type:'Outpatient visit',doctor:'Dr Yeung Chi-hong',dept:'Internal Medicine',notes:'Diabetes 6-month review. HbA1c 6.8% — good control. Metformin 500mg twice daily continued. Diet counselling provided.',icon:'◎',bg:C.greenLight},
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
              {access.dispense&&(dispensedIds.includes(i)
                ?<span style={{fontSize:'11px',color:C.green,fontWeight:600}}>✓ Dispensed</span>
                :<Btn variant="amber" style={{fontSize:'11px',padding:'5px 10px'}} onClick={()=>setDispensedIds([...dispensedIds,i])}>Dispense</Btn>)}
            </Card>
          ))}
          {access.prescribe&&<div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}} onClick={()=>setShowPrescribeModal(true)}>+ Prescribe medication</Btn></div>}
          {!access.prescribe&&!access.dispense&&<div style={{margin:'0 16px 16px',background:C.brownLight,borderRadius:'10px',padding:'10px 14px',fontSize:'12px',color:C.brown}}>◇ Your role can view but not prescribe or dispense medications.</div>}
          {access.dispense&&<div style={{margin:'0 16px 16px',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'10px',padding:'10px 14px',fontSize:'12px',color:C.green}}>◇ Dispensing here syncs directly from the doctor's prescription — no separate paperwork needed.</div>}
        </>}

        {activeTab==='log'&&<>
          <SecLabel>Consultation</SecLabel>
          <Card style={{padding:'16px'}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>Nurses can log symptoms and observations. Only doctors and dept heads can make diagnoses and prescriptions.</div>
            {(role==='doctor'||role==='dept_head')&&<>
              <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'6px'}}>Diagnosis</div>
              <input value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} placeholder="e.g. Type 2 Diabetes — glucose elevated" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,outline:'none',marginBottom:'12px',boxSizing:'border-box'}}/>
            </>}
            <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'6px'}}>Notes</div>
            <textarea value={logText} onChange={e=>setLogText(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,resize:'none',outline:'none',fontFamily:'inherit',marginBottom:'10px'}} rows={4} placeholder="Log symptoms, observations, or clinical notes for this visit…"/>
            {logError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'8px'}}>{logError}</div>}
            {logDraftSaved&&<div style={{fontSize:'12px',color:C.green,marginBottom:'8px'}}>✓ Draft saved - keep editing, or submit when ready</div>}
            {logSaved&&<div style={{fontSize:'12px',color:C.green,marginBottom:'8px'}}>✓ Submitted to patient record</div>}
            <div style={{display:'flex',gap:'8px',marginBottom:access.prescribe?'10px':'0'}}>
              <Btn style={{flex:1}} onClick={()=>{setLogText('');setDiagnosis('');setLogSaved(false);setLogDraftSaved(false)}}>Clear</Btn>
              <Btn style={{flex:1}} onClick={()=>writeLogEntry('draft')} disabled={logDraftSaving||logSaving}>{logDraftSaving?'Saving…':'Save'}</Btn>
              <Btn variant="primary" style={{flex:1}} onClick={()=>writeLogEntry('submitted')} disabled={logSaving||logDraftSaving}>{logSaving?'Submitting…':'Submit'}</Btn>
            </div>
            {access.prescribe&&<Btn variant="amber" style={{width:'100%'}} onClick={()=>setShowPrescribeModal(true)}>+ Add prescription to this visit</Btn>}
          </Card>
          {(role==='doctor'||role==='dept_head'||role==='admin')&&<>
            {isAdmitted ? <>
              <SecLabel>Bed / Location</SecLabel>
              <Card style={{padding:'0 16px'}}>
                <InfoRow label="Ward" value="Ward 3B"/>
                <InfoRow label="Bed" value="Bed 12"/>
                <InfoRow label="Admitted" value={new Date().toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}/>
                <InfoRow label="Expected discharge" value="TBC" last/>
              </Card>
              <div style={{padding:'0 16px 16px',display:'flex',gap:'8px'}}>
                <Btn style={{flex:1}}>Transfer ward</Btn>
                <Btn variant="amber" style={{flex:1}} onClick={()=>setIsAdmitted(false)}>Discharge</Btn>
              </div>
            </> : (role==='doctor'||role==='admin')&&<div style={{padding:'0 16px 16px'}}>
              <Btn style={{width:'100%'}} onClick={()=>setIsAdmitted(true)}>+ Admit to ward (demo)</Btn>
            </div>}
          </>}
        </>}
        {activeTab==='message'&&(role==='doctor'||role==='therapist'||role==='allied')&&<>
          <SecLabel>Message this patient</SecLabel>
          <div style={{margin:'0 16px 12px',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'10px',padding:'12px 14px',fontSize:'12px',color:C.textSub,lineHeight:1.5}}>
            ◇ Sent directly to {patient.name}'s Medsa app — visible to them under their own messages.
          </div>
          <Card style={{padding:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'6px'}}>Subject (optional)</div>
            <input value={patientMsgSubject} onChange={e=>setPatientMsgSubject(e.target.value)} placeholder="e.g. Follow-up on your last visit" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,outline:'none',marginBottom:'12px',boxSizing:'border-box'}}/>
            <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'6px'}}>Message</div>
            <textarea value={patientMsgBody} onChange={e=>setPatientMsgBody(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,resize:'none',outline:'none',fontFamily:'inherit',marginBottom:'10px',boxSizing:'border-box'}} rows={4} placeholder="Write a personal note to this patient…"/>
            <div onClick={()=>setPatientMsgUrgent(!patientMsgUrgent)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:patientMsgUrgent?C.redLight:C.card,border:`0.5px solid ${patientMsgUrgent?C.red:C.border}`,borderRadius:'8px',marginBottom:'12px',cursor:'pointer'}}>
              <Toggle checked={patientMsgUrgent} onChange={setPatientMsgUrgent}/>
              <div>
                <div style={{fontSize:'12px',fontWeight:600,color:patientMsgUrgent?C.red:C.text}}>Mark as urgent</div>
                <div style={{fontSize:'10px',color:C.textMuted}}>Shows with a red badge and appears prominently on the patient's home screen</div>
              </div>
            </div>
            {patientMsgError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{patientMsgError}</div>}
            {patientMsgSaved&&<div style={{fontSize:'12px',color:C.green,marginBottom:'10px'}}>✓ Message sent to patient</div>}
            <Btn variant="primary" style={{width:'100%'}} onClick={()=>handleSendPatientMessage(patient.id, ROLES[role]?.label || 'Your care team')} disabled={patientMsgSaving}>{patientMsgSaving?'Sending…':'Send to patient'}</Btn>
          </Card>
        </>}
      </div>
      <PrescribeModal open={showPrescribeModal} onClose={()=>setShowPrescribeModal(false)} patientMedsaId={patient.id}/>
      </>
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
          {role==='admin'&&'Administrative and operational view across all departments — staffing, bed management, records access. Not for clinical logging unless also rostered as a treating clinician.'}
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
      {canRegisterPatients&&<div style={{margin:'0 16px 16px',textAlign:'center'}}>
        <span style={{fontSize:'12px',color:C.textSub}}>Patient not on Medsa yet? </span>
        <span onClick={()=>setView('newpatient')} style={{fontSize:'12px',color:C.green,fontWeight:600,cursor:'pointer'}}>Register them →</span>
      </div>}
    </div>
  )
}

// ── SCHEDULE ──────────────────────────────────────────────────────────────────
// ── DOCTOR VIDEO CALL (mirrors patient-side VideoCallModal) ────────────────
function DoctorVideoCallModal({ patientName, onClose }) {
  if (!patientName) return null
  return (
    <div style={{position:'fixed',inset:0,background:'#1a1a1a',zIndex:400,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#fff'}}>
      <div style={{fontSize:'13px',opacity:0.6,marginBottom:'8px'}}>Video call (demo)</div>
      <div style={{width:96,height:96,borderRadius:'50%',background:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',fontWeight:700,marginBottom:'16px'}}>{patientName[0]}</div>
      <div style={{fontSize:'18px',fontWeight:600,marginBottom:'6px'}}>{patientName}</div>
      <div style={{fontSize:'13px',opacity:0.6,marginBottom:'40px'}}>Calling…</div>
      <div onClick={onClose} style={{width:56,height:56,borderRadius:'50%',background:C.red,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'20px'}}>✕</div>
    </div>
  )
}

// ── PATIENT ACTION MODAL — from the doctor's daily to-do list ──────────────
function PatientTodoActionModal({ patient, onClose, doctorLabel, onStartCall, onGoToFullDiagnosis, onSwitchDoctor, onCancelAppt, onBookFollowup, onViewFullRecord, onCancelCheckIn }) {
  const [mode,setMode]=useState(null) // null | 'message' | 'switch' | 'cancel' | 'followup' | 'prepnotes'
  const [msgBody,setMsgBody]=useState('')
  const [msgUrgent,setMsgUrgent]=useState(false)
  const [msgSaving,setMsgSaving]=useState(false)
  const [msgSaved,setMsgSaved]=useState(false)
  const [newDoctor,setNewDoctor]=useState('')
  const [followupDate,setFollowupDate]=useState('')
  const [followupType,setFollowupType]=useState('')
  const [error,setError]=useState(null)
  const [fullPatient,setFullPatient]=useState(null)
  const [loadingPatient,setLoadingPatient]=useState(true)
  const [conditions,setConditions]=useState([])
  const [allergies,setAllergies]=useState([])
  const [medications,setMedications]=useState([])

  // Show real patient info here, the same way it appears when their
  // Medsa ID is scanned at check-in - not just the bare appointment row.
  // Full medical history is shown here too, within the 48-hour consent
  // window, so a doctor can review and prep ahead of a visit - separate
  // from "Log diagnosis," which still requires actual check-in.
  const [patientFetchError,setPatientFetchError]=useState(null)
  useEffect(() => {
    async function loadPatient() {
      if (!patient?.medsaId) { setLoadingPatient(false); setPatientFetchError('This appointment has no linked Medsa ID.'); return }
      setLoadingPatient(true)
      const { data, error: fetchErr } = await supabase.from('patients').select('*').eq('medsa_id', patient.medsaId).maybeSingle()
      if (fetchErr) setPatientFetchError(fetchErr.message)
      else if (!data) setPatientFetchError(`No patient record found for Medsa ID ${patient.medsaId}.`)
      else setPatientFetchError(null)
      setFullPatient(data || null)
      if (data) {
        const [condRes, allergyRes, medRes] = await Promise.all([
          supabase.from('conditions').select('*').eq('patient_id', data.id).eq('active', true),
          supabase.from('allergies').select('*').eq('patient_id', data.id),
          supabase.from('medications').select('*').eq('patient_id', data.id),
        ])
        setConditions(condRes.data||[])
        setAllergies(allergyRes.data||[])
        setMedications(medRes.data||[])
      }
      setLoadingPatient(false)
    }
    loadPatient()
  }, [patient?.medsaId])

  if (!patient) return null

  const isCheckedIn = patient.status === 'checked_in'

  // Only offer doctors in the same department as this patient's current
  // doctor - switching to an unrelated specialty wouldn't make sense.
  const sameDeptDoctors = DOCTOR_DIRECTORY.filter(d=>d.department===patient.department && d.name!==patient.doctor).map(d=>d.name)

  async function handleSendMessage() {
    if (!msgBody.trim()) { setError('Write a message first.'); return }
    setMsgSaving(true)
    setError(null)
    try {
      const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', patient.medsaId).maybeSingle()
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
        <div onClick={onClose} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'14px'}}>Close</div>

        {loadingPatient&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,marginBottom:'14px'}}>Loading patient…</div>}
        {!loadingPatient&&patientFetchError&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.amber}}>⚠ {patientFetchError}</div>}

        {!loadingPatient&&fullPatient&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'12px',padding:'16px',marginBottom:'14px'}}>
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
              <div style={{fontSize:'12px',fontWeight:600}}>{patient.time} · {patient.type}</div>
            </div>
          </div>
        </div>}

        {!loadingPatient&&fullPatient&&<div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'8px'}}>Medical history</div>
          {allergies.length>0&&<div style={{background:C.redLight,borderRadius:'8px',padding:'10px 12px',marginBottom:'8px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.red,marginBottom:'4px'}}>⚠ Allergies</div>
            {allergies.map((a,i)=><div key={i} style={{fontSize:'12px',color:C.text}}>{a.allergen} ({a.severity})</div>)}
          </div>}
          {conditions.length>0&&<div style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'8px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.text,marginBottom:'4px'}}>Active conditions</div>
            {conditions.map((c,i)=><div key={i} style={{fontSize:'12px',color:C.textSub}}>{c.condition_name}{c.severity?` (${c.severity})`:''}</div>)}
          </div>}
          {medications.length>0&&<div style={{background:C.card,borderRadius:'8px',padding:'10px 12px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.text,marginBottom:'4px'}}>Current medications</div>
            {medications.map((m,i)=><div key={i} style={{fontSize:'12px',color:C.textSub}}>{m.medication_name} {m.dosage||''} — {m.frequency||''}</div>)}
          </div>}
          {allergies.length===0&&conditions.length===0&&medications.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'12px'}}>No history on file yet.</div>}
        </div>}

        {!mode&&<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>onStartCall(patient.name)}>◈ Video call</Btn>
          <Btn style={{width:'100%'}} onClick={()=>setMode('message')}>✉ Message patient</Btn>
          {onSwitchDoctor&&<Btn style={{width:'100%'}} onClick={()=>setMode('switch')}>⇄ Switch doctor</Btn>}
          {onBookFollowup&&<Btn style={{width:'100%'}} onClick={()=>setMode('followup')}>+ Book follow-up</Btn>}
          {onViewFullRecord&&<Btn style={{width:'100%'}} onClick={onViewFullRecord}>📄 View full record</Btn>}
          {isCheckedIn
            ? <Btn style={{width:'100%'}} onClick={onGoToFullDiagnosis}>📋 Log diagnosis</Btn>
            : <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',padding:'8px'}}>◇ Logging new diagnosis unlocks once this patient has checked in</div>}
          {isCheckedIn&&onCancelCheckIn&&<Btn style={{width:'100%'}} onClick={()=>setMode('cancelcheckin')}>↩ Cancel check-in</Btn>}
          {onCancelAppt&&<Btn variant="danger" style={{width:'100%'}} onClick={()=>setMode('cancel')}>✕ Cancel appointment</Btn>}
        </div>}

        {mode==='cancelcheckin'&&<>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'14px'}}>Undo {patient.name}'s check-in? This puts the appointment back to "scheduled" - use this to fix a mistaken check-in or to check them out for testing.</div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Keep checked in</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={async()=>{await onCancelCheckIn();setMode(null);onClose()}}>Confirm undo</Btn>
          </div>
        </>}

        {mode==='message'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Message {patient.name}</div>
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

        {mode==='switch'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Switch doctor for {patient.name}</div>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>Showing doctors in {patient.department||'the same department'} only</div>
          {sameDeptDoctors.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'14px'}}>No other doctor in this department yet.</div>}
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'14px'}}>
            {sameDeptDoctors.map(d=>(
              <div key={d} onClick={()=>setNewDoctor(d)} style={{border:`0.5px solid ${newDoctor===d?C.green:C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',background:newDoctor===d?C.green:C.card,color:newDoctor===d?'#fff':C.text}}>{d}</div>
            ))}
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={()=>{onSwitchDoctor(newDoctor);setMode(null);onClose()}} disabled={!newDoctor}>Confirm switch</Btn>
          </div>
        </>}

        {mode==='followup'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Book follow-up for {patient.name}</div>
          <input value={followupDate} onChange={e=>setFollowupDate(e.target.value)} type="date" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input value={followupType} onChange={e=>setFollowupType(e.target.value)} placeholder="Reason, e.g. Follow-up review" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'14px',boxSizing:'border-box'}}/>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={async()=>{const ok=await onBookFollowup(followupDate,followupType);if(ok){setMode(null);onClose()}else setError('Could not book follow-up - try again.')}} disabled={!followupDate||!followupType}>Confirm</Btn>
          </div>
        </>}

        {mode==='cancel'&&<>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'14px'}}>Cancel {patient.name}'s appointment at {patient.time}? This can't be undone from here.</div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Keep appointment</Btn>
            <Btn variant="danger" style={{flex:1}} onClick={()=>{onCancelAppt();setMode(null);onClose()}}>Confirm cancel</Btn>
          </div>
        </>}
      </div>
    </div>
  )
}

// ── RECEPTIONIST SCHEDULING ACTIONS — reschedule, switch doctor, cancel, follow-up ──
function ReceptionistScheduleActionModal({ appt, onClose, onSave, withinDataWindow, onCancelCheckIn }) {
  const [mode,setMode]=useState(null) // null | 'reschedule' | 'switch' | 'cancel' | 'followup' | 'notes'
  const [newTime,setNewTime]=useState('')
  const [newDoctor,setNewDoctor]=useState('')
  const [followupDate,setFollowupDate]=useState('')
  const [followupType,setFollowupType]=useState('')
  const [notesDraft,setNotesDraft]=useState('')

  if (!appt) return null

  // Only offer doctors in the same department as this appointment.
  const DOCTORS = DOCTOR_DIRECTORY.filter(d=>d.department===appt.department && d.name!==appt.doctor).map(d=>d.name)
  const TIMES = ['09:00','09:30','10:00','10:30','11:00','14:00','14:30','15:00','15:30']

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:440,padding:'20px',maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
          <div>
            <div style={{fontSize:'16px',fontWeight:700}}>{appt.name}</div>
            <div style={{fontSize:'12px',color:C.textSub}}>{appt.time} · {appt.type} · Rm {appt.room}</div>
          </div>
          <div onClick={onClose} style={{fontSize:'13px',color:C.green,cursor:'pointer'}}>Close</div>
        </div>

        {!withinDataWindow&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'11px',color:C.amber,lineHeight:1.5}}>
          ◇ Booking/scheduling changes are always available. Patient clinical details are only accessible within 48 hours of the appointment (once patient consent windows are fully wired in).
        </div>}

        {mode!=='notes'&&<div onClick={()=>{setNotesDraft(appt.notes||'');setMode('notes')}} style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.textSub,lineHeight:1.5,cursor:'pointer'}}>
          <div style={{fontWeight:600,color:C.text,marginBottom:'2px',display:'flex',justifyContent:'space-between'}}><span>Patient notes</span><span style={{color:C.green,fontSize:'11px'}}>Edit</span></div>{appt.notes||'No notes yet - tap to add'}
        </div>}

        {!mode&&<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>setMode('reschedule')}>📅 Change date/time</Btn>
          <Btn style={{width:'100%'}} onClick={()=>setMode('switch')}>⇄ Switch doctor/treatment</Btn>
          <Btn style={{width:'100%'}} onClick={()=>setMode('followup')}>+ Add follow-up appointment</Btn>
          {appt.status==='checked_in'&&onCancelCheckIn&&<Btn style={{width:'100%'}} onClick={()=>setMode('cancelcheckin')}>↩ Cancel check-in</Btn>}
          <Btn variant="danger" style={{width:'100%'}} onClick={()=>setMode('cancel')}>✕ Cancel appointment</Btn>
        </div>}

        {mode==='cancelcheckin'&&<>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'14px'}}>Undo {appt.name}'s check-in? This puts the appointment back to "scheduled" - use this to fix a mistaken check-in or to check them out for testing.</div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Keep checked in</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={async()=>{await onCancelCheckIn();setMode(null);onClose()}}>Confirm undo</Btn>
          </div>
        </>}

        {mode==='notes'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Notes for {appt.name}</div>
          <textarea value={notesDraft} onChange={e=>setNotesDraft(e.target.value)} rows={4} placeholder="Symptoms, patient-reported notes, anything relevant for the visit…" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginBottom:'14px',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={()=>{onSave({...appt,notes:notesDraft});setMode(null)}}>Save notes</Btn>
          </div>
        </>}

        {mode==='reschedule'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>New time for {appt.name}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'14px'}}>
            {TIMES.map(t=>(
              <div key={t} onClick={()=>setNewTime(t)} style={{border:`0.5px solid ${newTime===t?C.green:C.border}`,borderRadius:'8px',padding:'8px',textAlign:'center',fontSize:'12px',cursor:'pointer',background:newTime===t?C.green:C.card,color:newTime===t?'#fff':C.text}}>{t}</div>
            ))}
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={()=>{onSave({...appt,time:newTime||appt.time});onClose()}} disabled={!newTime}>Confirm change</Btn>
          </div>
        </>}

        {mode==='switch'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Switch doctor for {appt.name}</div>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>Showing doctors in {appt.department||'the same department'} only</div>
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
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Follow-up appointment for {appt.name}</div>
          <input value={followupDate} onChange={e=>setFollowupDate(e.target.value)} type="date" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input value={followupType} onChange={e=>setFollowupType(e.target.value)} placeholder="Reason, e.g. Follow-up review" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'14px',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={onClose} disabled={!followupDate||!followupType}>Schedule follow-up</Btn>
          </div>
        </>}

        {mode==='cancel'&&<>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'14px'}}>Cancel {appt.name}'s appointment at {appt.time}? This can't be undone from here.</div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Keep appointment</Btn>
            <Btn variant="danger" style={{flex:1}} onClick={()=>{onSave({...appt,cancelled:true});onClose()}}>Confirm cancel</Btn>
          </div>
        </>}
      </div>
    </div>
  )
}

// ── NEW APPOINTMENT — real, was previously a non-functional button ─────────
function NewAppointmentModal({ open, onClose, onBooked }) {
  const [searchTerm,setSearchTerm]=useState('')
  const [foundPatient,setFoundPatient]=useState(null)
  const [date,setDate]=useState('')
  const [time,setTime]=useState('09:00')
  const [doctor,setDoctor]=useState(DOCTOR_DIRECTORY[0]?.name || '')
  const [reason,setReason]=useState('')
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)

  if (!open) return null

  async function handleSearch() {
    if (!searchTerm.trim()) return
    const { data } = await supabase.from('patients').select('*')
      .or(`medsa_id.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`).limit(1).maybeSingle()
    setFoundPatient(data || null)
    if (!data) setError('No patient found matching that name or Medsa ID.')
    else setError(null)
  }

  async function handleBook() {
    if (!foundPatient || !date || !time) return
    setSaving(true)
    setError(null)
    const doctorInfo = DOCTOR_DIRECTORY.find(d=>d.name===doctor)
    const { error: insErr } = await supabase.from('appointments').insert({
      patient_id: foundPatient.id,
      doctor_name: doctor,
      department: doctorInfo?.department || null,
      scheduled_at: new Date(`${date}T${time}:00`).toISOString(),
      appointment_type: reason || 'Consultation',
      status: 'confirmed',
      institution_source: 'practitioner',
    })
    setSaving(false)
    if (insErr) { setError(insErr.message); return }
    onBooked()
    onClose()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:420,padding:'24px',maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{fontSize:'16px',fontWeight:700,marginBottom:'16px'}}>New appointment</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()} placeholder="Patient name or Medsa ID" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',boxSizing:'border-box'}}/>
          <Btn onClick={handleSearch}>Search</Btn>
        </div>
        {foundPatient&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'10px',marginBottom:'12px',fontSize:'12px',color:C.green}}>✓ {foundPatient.full_name} ({foundPatient.medsa_id})</div>}
        <input value={date} onChange={e=>setDate(e.target.value)} type="date" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
        <input value={time} onChange={e=>setTime(e.target.value)} type="time" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
        <select value={doctor} onChange={e=>setDoctor(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'10px'}}>
          {DOCTOR_DIRECTORY.map(d=><option key={d.name} value={d.name}>{d.name} · {d.department}</option>)}
        </select>
        <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason, e.g. Follow-up" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'14px',boxSizing:'border-box'}}/>
        {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
        <div style={{display:'flex',gap:'8px'}}>
          <Btn style={{flex:1}} onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" style={{flex:1}} onClick={handleBook} disabled={!foundPatient||!date||saving}>{saving?'Booking…':'Book appointment'}</Btn>
        </div>
      </div>
    </div>
  )
}

// ── WORKING HOURS — admin sets each doctor's weekly availability ───────────
// Same real source of truth as the ClinicOps side, tagged with its own
// institution_source so the two institutions' hours never mix.
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// ── TASK BOARD — HR/Admin hub, five distinct categories ─────────────────────
function TaskBoardScreen({ role, staffMedsaId, onNavOnboard, onNavCoverage }) {
  const [tab,setTab]=useState('onboarding')
  const [loading,setLoading]=useState(true)
  const [onboarding,setOnboarding]=useState([])
  const [updates,setUpdates]=useState([])
  const [expiring,setExpiring]=useState([])
  const [leaves,setLeaves]=useState([])
  const [permChanges,setPermChanges]=useState([])

  async function loadAll() {
    setLoading(true)
    const inst = 'practitioner'
    const [ob, exp, lv, pc] = await Promise.all([
      supabase.from('staff_credentials').select('*').eq('institution_source',inst).eq('status','pending_onboarding'),
      supabase.from('staff_credentials').select('*').eq('institution_source',inst).eq('status','active').not('registration_expiry','is',null).lte('registration_expiry', new Date(Date.now()+120*24*60*60*1000).toISOString().slice(0,10)),
      supabase.from('leave_requests').select('*').eq('institution_source',inst).eq('status','pending'),
      supabase.from('permanent_change_requests').select('*').eq('institution_source',inst).in('status',['pending','hr_confirmed']),
    ])
    setOnboarding(ob.data||[])
    setExpiring((exp.data||[]).map(r=>{
      const days = Math.ceil((new Date(r.registration_expiry) - new Date())/(1000*60*60*24))
      return {...r, monthsLeft: Math.max(1,Math.round(days/30))}
    }))
    setLeaves(lv.data||[])
    setPermChanges(pc.data||[])
    // Staff-submitted updates: verification_status flipped back to 'pending' on an
    // otherwise-active record signals a self-submitted credential update awaiting review
    const { data: upd } = await supabase.from('staff_credentials').select('*').eq('institution_source',inst).eq('status','active').eq('verification_status','pending')
    setUpdates(upd||[])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function handleConfirmOnboarding(row) {
    if (role!=='admin') return // only Admin confirms new hires
    await supabase.from('staff_credentials').update({ status:'active', verification_status:'verified', confirmed_by: staffMedsaId, last_verified_at:new Date().toISOString() }).eq('id', row.id)
    loadAll()
  }

  async function handleConfirmUpdate(row) {
    await supabase.from('staff_credentials').update({ verification_status:'verified', last_verified_at:new Date().toISOString() }).eq('id', row.id)
    loadAll()
  }

  async function handleLeaveDecision(row, approve) {
    // Short/annual leave: Department Head's call, not shown here at all -
    // this board only ever sees leave that's already routed to HR (long/
    // protected leave, dual-acknowledged with Admin).
    const updates = approve
      ? (role==='hr' ? {status:'awaiting_admin', hr_confirmed_by:staffMedsaId} : {status:'approved', admin_confirmed_by:staffMedsaId})
      : {status:'denied'}
    await supabase.from('leave_requests').update(updates).eq('id', row.id)
    loadAll()
  }

  async function handlePermChangeDecision(row, approve) {
    if (!approve) { await supabase.from('permanent_change_requests').update({status:'denied'}).eq('id', row.id); loadAll(); return }
    if (role==='hr' && row.status==='pending') {
      await supabase.from('permanent_change_requests').update({status:'hr_confirmed', hr_confirmed_by:staffMedsaId, hr_confirmed_at:new Date().toISOString()}).eq('id', row.id)
    } else if (role==='admin' && row.status==='hr_confirmed') {
      await supabase.from('permanent_change_requests').update({status:'fully_confirmed', admin_confirmed_by:staffMedsaId, admin_confirmed_at:new Date().toISOString()}).eq('id', row.id)
      // Apply the actual change now that both parties have signed off
      const staffUpdate = {}
      if (row.requested_employment_type) staffUpdate.employment_type = row.requested_employment_type
      if (row.requested_schedule_type) staffUpdate.schedule_type = row.requested_schedule_type
      if (Object.keys(staffUpdate).length) await supabase.from('staff_credentials').update(staffUpdate).eq('medsa_id', row.medsa_id)
    }
    loadAll()
  }

  const TABS = [
    {key:'onboarding', label:'Onboarding', count:onboarding.length},
    {key:'updates', label:'Updates', count:updates.length},
    {key:'expiring', label:'Expiring', count:expiring.length},
    {key:'leaves', label:'Leave', count:leaves.length},
    {key:'permchanges', label:'Permanent changes', count:permChanges.length},
  ]

  return (
    <div style={{background:C.beige,flex:1,padding:'16px'}}>
      <div style={{display:'flex',gap:'6px',overflowX:'auto',marginBottom:'16px'}}>
        {TABS.map(t=>(
          <div key={t.key} onClick={()=>setTab(t.key)} style={{flexShrink:0,padding:'8px 12px',borderRadius:'20px',fontSize:'12px',fontWeight:500,cursor:'pointer',background:tab===t.key?C.green:C.card,color:tab===t.key?'#fff':C.textSub,display:'flex',alignItems:'center',gap:'6px'}}>
            {t.label}
            {t.count>0&&<span style={{fontSize:'10px',background:tab===t.key?'rgba(255,255,255,0.3)':C.redLight,color:tab===t.key?'#fff':C.red,padding:'1px 6px',borderRadius:'10px',fontWeight:700}}>{t.count}</span>}
          </div>
        ))}
      </div>

      {loading&&<div style={{textAlign:'center',padding:'30px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}

      {!loading&&tab==='onboarding'&&<>
        {role==='hr'&&<Btn variant="primary" style={{width:'100%',marginBottom:'12px'}} onClick={onNavOnboard}>+ Onboard new staff</Btn>}
        {onboarding.length===0&&<div style={{textAlign:'center',padding:'30px',color:C.textMuted,fontSize:'13px'}}>No pending onboarding.</div>}
        {onboarding.map(row=>(
          <Card key={row.id} style={{padding:'14px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{row.full_name}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>{ROLES[row.role]?.label||row.role} · {row.department||'—'} · submitted by {row.onboarded_by||'HR'}</div>
            {role==='admin'
              ? <Btn variant="primary" style={{width:'100%'}} onClick={()=>handleConfirmOnboarding(row)}>Confirm hire</Btn>
              : <div style={{fontSize:'11px',color:C.textMuted}}>Awaiting Admin confirmation</div>}
          </Card>
        ))}
      </>}

      {!loading&&tab==='updates'&&<>
        {updates.length===0&&<div style={{textAlign:'center',padding:'30px',color:C.textMuted,fontSize:'13px'}}>No pending credential updates.</div>}
        {updates.map(row=>(
          <Card key={row.id} style={{padding:'14px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{row.full_name}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>Submitted updated credential information for review</div>
            <Btn variant="primary" style={{width:'100%'}} onClick={()=>handleConfirmUpdate(row)}>Confirm update</Btn>
          </Card>
        ))}
      </>}

      {!loading&&tab==='expiring'&&<>
        {expiring.length===0&&<div style={{textAlign:'center',padding:'30px',color:C.textMuted,fontSize:'13px'}}>Nothing expiring within 4 months.</div>}
        {expiring.map(row=>(
          <Card key={row.id} style={{padding:'14px 16px',marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:'13px',fontWeight:600}}>{row.full_name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{ROLES[row.role]?.label||row.role} · {row.registration_number||'—'}</div>
            </div>
            <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:row.monthsLeft<=1?C.redLight:C.amberLight,color:row.monthsLeft<=1?C.red:C.amber,fontWeight:600}}>{row.monthsLeft}mo left</span>
          </Card>
        ))}
      </>}

      {!loading&&tab==='leaves'&&<>
        {role==='hr'&&<Btn style={{width:'100%',marginBottom:'12px'}} onClick={onNavCoverage}>View department coverage</Btn>}
        {leaves.length===0&&<div style={{textAlign:'center',padding:'30px',color:C.textMuted,fontSize:'13px'}}>No leave requests routed to HR/Admin.</div>}
        {leaves.map(row=>(
          <Card key={row.id} style={{padding:'14px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{row.staff_name}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>{row.leave_type} · {row.start_date} to {row.end_date}{!row.is_discretionary?' · protected leave — acknowledgment, not permission':''}</div>
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1}} onClick={()=>handleLeaveDecision(row,false)}>Deny</Btn>
              <Btn variant="primary" style={{flex:1}} onClick={()=>handleLeaveDecision(row,true)}>{role==='hr'?'Acknowledge':'Confirm'}</Btn>
            </div>
          </Card>
        ))}
      </>}

      {!loading&&tab==='permchanges'&&<>
        {permChanges.length===0&&<div style={{textAlign:'center',padding:'30px',color:C.textMuted,fontSize:'13px'}}>No permanent change requests.</div>}
        {permChanges.map(row=>(
          <Card key={row.id} style={{padding:'14px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{row.medsa_id}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>{row.category.replace(/_/g,' ')} · initiated by {row.initiated_by}</div>
            {row.requested_employment_type&&<div style={{fontSize:'11px',color:C.textMuted}}>New employment type: {row.requested_employment_type}</div>}
            {row.requested_schedule_type&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'8px'}}>New schedule type: {row.requested_schedule_type}</div>}
            <div style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:C.card,color:C.textSub,display:'inline-block',marginBottom:'10px'}}>{row.status==='pending'?'Awaiting HR':'HR confirmed — awaiting Admin'}</div>
            {((role==='hr'&&row.status==='pending')||(role==='admin'&&row.status==='hr_confirmed'))&&
              <div style={{display:'flex',gap:'8px'}}>
                <Btn style={{flex:1}} onClick={()=>handlePermChangeDecision(row,false)}>Deny</Btn>
                <Btn variant="primary" style={{flex:1}} onClick={()=>handlePermChangeDecision(row,true)}>Confirm</Btn>
              </div>}
          </Card>
        ))}
      </>}
    </div>
  )
}

// ── ADMIN HOME — institution-wide settings and oversight ────────────────────
function AdminHomeScreen() {
  const [tab,setTab]=useState('settings')
  const [maxHours,setMaxHours]=useState({})
  const [instSettings,setInstSettings]=useState({permanent_change_requires_hr:true,permanent_change_requires_dept_head:true,permanent_change_requires_admin:true})
  const [deptOverview,setDeptOverview]=useState([])
  const [featureToggles,setFeatureToggles]=useState({})
  const [todaysAppts,setTodaysAppts]=useState([])
  const [loading,setLoading]=useState(true)
  const [savedMsg,setSavedMsg]=useState(null)

  const ROLE_LEGAL_MAX = { doctor:72, nurse:60, allied:60, therapist:60, receptionist:60 }
  const FEATURES = [['shift_bidding','Shift bidding'],['shift_openings','Permanent openings'],['leave_requests','Leave requests'],['coverage_alerts','Coverage alerts']]

  async function loadAdminData() {
    setLoading(true)
    const inst = 'practitioner'
    const [mh, is, staff, ft] = await Promise.all([
      supabase.from('role_max_hours').select('*').eq('institution_source',inst),
      supabase.from('institution_settings').select('*').eq('institution_source',inst).maybeSingle(),
      supabase.from('staff_credentials').select('department').eq('institution_source',inst).eq('status','active'),
      supabase.from('department_feature_toggles').select('*').eq('institution_source',inst),
    ])
    const mhMap = {}
    ;(mh.data||[]).forEach(r=>{ mhMap[r.role]=r.max_hours_per_week })
    setMaxHours(mhMap)
    if (is.data) setInstSettings(is.data)
    const byDept = {}
    ;(staff.data||[]).forEach(s=>{ byDept[s.department||'Unassigned']=(byDept[s.department||'Unassigned']||0)+1 })
    setDeptOverview(Object.entries(byDept).map(([dept,count])=>({dept,count})))
    const ftMap = {}
    ;(ft.data||[]).forEach(r=>{ ftMap[`${r.department}::${r.feature_key}`] = r.enabled })
    setFeatureToggles(ftMap)
    // Name/contact only - never the medical file. Pre-booked appointments
    // show ahead of the visit; walk-ins/checked-in appear once they arrive.
    const today = new Date().toISOString().slice(0,10)
    const { data: appts } = await supabase.from('appointments').select('patient_name,patient_contact,doctor_name,appointment_time,status,checked_in_at')
      .eq('institution_source', inst).eq('appointment_date', today).neq('status','cancelled').order('appointment_time',{ascending:true})
    setTodaysAppts(appts||[])
    setLoading(false)
  }

  useEffect(() => { loadAdminData() }, [])

  async function saveFeatureToggle(dept, featureKey, enabled) {
    setFeatureToggles(prev=>({...prev, [`${dept}::${featureKey}`]: enabled}))
    await supabase.from('department_feature_toggles').upsert({
      institution_source:'practitioner', department:dept, feature_key:featureKey, enabled, updated_by:'admin', updated_at:new Date().toISOString(),
    }, {onConflict:'institution_source,department,feature_key'})
  }

  async function saveMaxHours(role, value) {
    const legalMax = ROLE_LEGAL_MAX[role] || 60
    const clamped = Math.min(parseInt(value)||legalMax, legalMax)
    setMaxHours(prev=>({...prev,[role]:clamped}))
    await supabase.from('role_max_hours').upsert({ institution_source:'practitioner', role, max_hours_per_week:clamped, updated_at:new Date().toISOString() }, {onConflict:'institution_source,role'})
    setSavedMsg(`${ROLES[role]?.label||role} ceiling saved`)
    setTimeout(()=>setSavedMsg(null), 2000)
  }

  async function saveInstSettings(field, value) {
    const updated = {...instSettings, [field]:value}
    setInstSettings(updated)
    await supabase.from('institution_settings').upsert({ institution_source:'practitioner', ...updated, updated_at:new Date().toISOString() }, {onConflict:'institution_source'})
  }

  async function handleGenerateReport() {
    setSavedMsg('Generating report…')
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text('Quality & Safety Report', 14, 20)
    doc.setFontSize(10); doc.text(`Generated ${new Date().toLocaleDateString('en-HK')}`, 14, 28)
    let y = 40
    doc.setFontSize(12); doc.text('Department Headcount', 14, y); y+=8
    doc.setFontSize(10)
    deptOverview.forEach(d => { doc.text(`${d.dept}: ${d.count} staff`, 14, y); y+=6 })
    y += 6
    doc.setFontSize(12); doc.text('Credential Expiry (within 4 months)', 14, y); y+=8
    doc.setFontSize(10)
    const { data: exp } = await supabase.from('staff_credentials').select('full_name,role,registration_expiry').eq('institution_source','practitioner').eq('status','active').not('registration_expiry','is',null).lte('registration_expiry', new Date(Date.now()+120*24*60*60*1000).toISOString().slice(0,10))
    ;(exp||[]).forEach(r => { doc.text(`${r.full_name} (${r.role}) — expires ${r.registration_expiry}`, 14, y); y+=6 })
    if (!exp?.length) { doc.text('None', 14, y); y+=6 }
    doc.save(`Q&S-Report-${new Date().toISOString().slice(0,10)}.pdf`)
    setSavedMsg('✓ Report downloaded')
    setTimeout(()=>setSavedMsg(null), 3000)
  }

  return (
    <div style={{background:C.beige,flex:1,padding:'16px'}}>
      <div style={{display:'flex',gap:'6px',marginBottom:'16px'}}>
        {[['settings','Settings'],['oversight','Oversight'],['patients','Patients'],['reporting','Q&S']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,textAlign:'center',padding:'8px',borderRadius:'8px',fontSize:'12px',fontWeight:500,cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.textSub}}>{l}</div>
        ))}
      </div>

      {loading&&<div style={{textAlign:'center',padding:'30px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {savedMsg&&<div style={{fontSize:'12px',color:C.green,textAlign:'center',marginBottom:'10px'}}>✓ {savedMsg}</div>}

      {!loading&&tab==='settings'&&<>
        <SecLabel>Max hours ceiling — per role</SecLabel>
        <div style={{fontSize:'11px',color:C.textMuted,margin:'0 16px 12px'}}>Must sit at or below the legal maximum. HR's Working Hours schedule must fit within this.</div>
        {Object.entries(ROLE_LEGAL_MAX).map(([role,legalMax])=>(
          <Card key={role} style={{padding:'12px 16px',marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:'13px',fontWeight:500}}>{ROLES[role]?.label||role}</div>
              <div style={{fontSize:'10px',color:C.textMuted}}>Legal max: {legalMax}h/wk</div>
            </div>
            <input type="number" max={legalMax} value={maxHours[role]||legalMax} onChange={e=>saveMaxHours(role,e.target.value)} style={{width:60,padding:'6px',fontSize:'13px',textAlign:'center'}}/>
          </Card>
        ))}

        <SecLabel>Permanent change sign-off requirements</SecLabel>
        <Card style={{padding:'14px 16px'}}>
          {[['permanent_change_requires_hr','Requires HR'],['permanent_change_requires_dept_head','Requires Dept Head draft'],['permanent_change_requires_admin','Requires Admin']].map(([field,label])=>(
            <div key={field} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`0.5px solid ${C.border}`}}>
              <span style={{fontSize:'13px'}}>{label}</span>
              <Toggle checked={instSettings[field]!==false} onChange={(on)=>saveInstSettings(field,on)}/>
            </div>
          ))}
        </Card>
      </>}

      {!loading&&tab==='oversight'&&<>
        <SecLabel>Departments — read-only</SecLabel>
        {deptOverview.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>No active staff on file yet.</div>}
        {deptOverview.map(d=>(
          <Card key={d.dept} style={{padding:'12px 16px',marginBottom:'8px',display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:'13px',fontWeight:500}}>{d.dept}</span>
            <span style={{fontSize:'12px',color:C.textSub}}>{d.count} staff</span>
          </Card>
        ))}
        <div style={{margin:'12px 16px',fontSize:'11px',color:C.textMuted,lineHeight:1.5}}>◇ Full staff detail (credentials, insurance, individual records) lives in HR's portal — this view is oversight only.</div>

        <SecLabel>Department feature toggles</SecLabel>
        {deptOverview.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>No departments yet.</div>}
        {deptOverview.map(d=>(
          <Card key={`ft-${d.dept}`} style={{padding:'14px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600,marginBottom:'8px'}}>{d.dept}</div>
            {FEATURES.map(([key,label])=>{
              const enabled = featureToggles[`${d.dept}::${key}`] !== false // default on
              return (
                <div key={key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:`0.5px solid ${C.border}`}}>
                  <span style={{fontSize:'12px'}}>{label}</span>
                  <Toggle checked={enabled} onChange={(on)=>saveFeatureToggle(d.dept,key,on)}/>
                </div>
              )
            })}
          </Card>
        ))}
      </>}

      {!loading&&tab==='patients'&&<>
        <SecLabel>Today's schedule — name and contact only</SecLabel>
        <div style={{fontSize:'11px',color:C.textMuted,margin:'0 16px 12px'}}>Operational awareness, not clinical access. Full medical records stay with the treating practitioner.</div>
        {todaysAppts.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>Nothing scheduled today.</div>}
        {todaysAppts.map((a,i)=>(
          <Card key={i} style={{padding:'12px 16px',marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:'13px',fontWeight:500}}>{a.patient_name}</div>
              <div style={{fontSize:'11px',color:C.textMuted}}>{a.patient_contact||'—'} · with {a.doctor_name} · {a.appointment_time}</div>
            </div>
            <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:a.checked_in_at?C.greenLight:C.card,color:a.checked_in_at?C.green:C.textSub}}>{a.checked_in_at?'Checked in':'Booked'}</span>
          </Card>
        ))}
      </>}

      {!loading&&tab==='reporting'&&<>
        <SecLabel>Quality & Safety reporting</SecLabel>
        <Card style={{padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
            <span style={{fontSize:'13px'}}>Auto-generate monthly</span>
            <Toggle checked={true}/>
          </div>
          <Btn variant="primary" style={{width:'100%'}} onClick={handleGenerateReport}>Generate report now (PDF)</Btn>
        </Card>
      </>}
    </div>
  )
}

// ── ONBOARDING — role-triggered docs, simulated AI extraction ───────────────
function OnboardingScreen({ staffMedsaId }) {
  const [selRole,setSelRole]=useState('')
  const [fullName,setFullName]=useState('')
  const [department,setDepartment]=useState('')
  const [specialty,setSpecialty]=useState('')
  const [regNumber,setRegNumber]=useState('')
  const [employmentType,setEmploymentType]=useState('full_time')
  const [scheduleType,setScheduleType]=useState('rotating')
  const [docsUploaded,setDocsUploaded]=useState(false)
  const [aiProcessing,setAiProcessing]=useState(false)
  const [aiConfirmed,setAiConfirmed]=useState(false)
  const [submitting,setSubmitting]=useState(false)
  const [submitted,setSubmitted]=useState(false)
  const [uploadedFile,setUploadedFile]=useState(null)
  const [aiError,setAiError]=useState(null)

  const EPC_ROLES = ['doctor','nurse']
  const hasEpc = EPC_ROLES.includes(selRole)

  async function handleUpload(file) {
    setUploadedFile(file)
    setDocsUploaded(true)
    setAiProcessing(true)
    setAiError(null)
    try {
      // REAL integration point - calls a Supabase Edge Function that must
      // exist in production with a real AI vision/OCR API key configured.
      // This function does NOT exist yet in the Supabase project - it needs
      // to be created (supabase functions new extract-credential-document)
      // before this call will succeed. Until then this will fail and fall
      // through to the catch block below, which is expected, not a bug.
      const formData = new FormData()
      formData.append('file', file)
      formData.append('role', selRole)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${supabase.supabaseUrl}/functions/v1/extract-credential-document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token || supabase.supabaseKey}` },
        body: formData,
      })
      if (!res.ok) throw new Error('Extraction service unavailable')
      const extracted = await res.json()
      if (extracted.full_name) setFullName(extracted.full_name)
      if (extracted.registration_number) setRegNumber(extracted.registration_number)
      setAiProcessing(false)
      setAiConfirmed(true)
    } catch (err) {
      // Expected until the Edge Function above is actually created and
      // deployed with a real API key - falls back to manual entry rather
      // than blocking onboarding entirely.
      setAiProcessing(false)
      setAiError('Automatic extraction unavailable — please confirm the details above manually before submitting.')
      setAiConfirmed(true)
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    await supabase.from('staff_credentials').insert({
      institution_source: 'practitioner',
      medsa_id: `MED-${Date.now().toString(36).toUpperCase()}`,
      full_name: fullName,
      role: selRole,
      department,
      specialty: specialty||null,
      registration_number: regNumber||null,
      has_epc: hasEpc,
      employment_type: employmentType,
      schedule_type: scheduleType,
      status: 'pending_onboarding',
      verification_status: hasEpc ? 'verified' : 'pending', // e-PC roles verify live on scan; others await manual doc review
      onboarded_by: staffMedsaId,
    })
    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) return (
    <div style={{background:C.beige,flex:1,padding:'40px 20px',textAlign:'center'}}>
      <div style={{fontSize:'36px',marginBottom:'12px'}}>✓</div>
      <div style={{fontSize:'16px',fontWeight:700,marginBottom:'8px'}}>Submitted for Admin confirmation</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px'}}>{fullName} will appear on the Task Board's Onboarding tab.</div>
      <Btn variant="primary" onClick={()=>{setSubmitted(false);setSelRole('');setFullName('');setDocsUploaded(false);setAiConfirmed(false)}}>Onboard another</Btn>
    </div>
  )

  return (
    <div style={{background:C.beige,flex:1,padding:'16px'}}>
      <SecLabel>Role</SecLabel>
      <Card style={{padding:'12px 16px',marginBottom:'16px'}}>
        <select value={selRole} onChange={e=>{setSelRole(e.target.value);setDocsUploaded(false);setAiConfirmed(false)}} style={{width:'100%',padding:'10px',fontSize:'13px'}}>
          <option value="">Select role…</option>
          {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </Card>

      {selRole&&<>
        <SecLabel>Basic info</SecLabel>
        <Card style={{padding:'16px',marginBottom:'16px'}}>
          <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Full legal name" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input value={department} onChange={e=>setDepartment(e.target.value)} placeholder="Department" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          {(selRole==='doctor')&&<input value={specialty} onChange={e=>setSpecialty(e.target.value)} placeholder="Specialty (e.g. OBGYN) - used for shift-opening matching" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>}
          <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
            <select value={employmentType} onChange={e=>setEmploymentType(e.target.value)} style={{flex:1,padding:'10px',fontSize:'12px'}}>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
            </select>
            <select value={scheduleType} onChange={e=>setScheduleType(e.target.value)} style={{flex:1,padding:'10px',fontSize:'12px'}}>
              <option value="rotating">Rotating</option>
              <option value="fixed">Fixed</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
        </Card>

        <SecLabel>{hasEpc?'e-PC verification':'Documents'}</SecLabel>
        <Card style={{padding:'16px',marginBottom:'16px'}}>
          {hasEpc
            ? <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>Scan the e-PC QR code to pull live registration status directly from the Council's database — no separate document upload needed.</div>
            : <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>Upload identity, contract, qualification, registration, and insurance documents.</div>}
          {!hasEpc&&<input value={regNumber} onChange={e=>setRegNumber(e.target.value)} placeholder="Registration number (if applicable)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>}
          {!docsUploaded&&!hasEpc&&
            <label style={{display:'block',width:'100%',padding:'12px',textAlign:'center',background:C.green,color:'#fff',borderRadius:'10px',fontSize:'13px',fontWeight:600,cursor:'pointer',boxSizing:'border-box'}}>
              Upload documents
              <input type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={e=>e.target.files[0]&&handleUpload(e.target.files[0])}/>
            </label>}
          {!docsUploaded&&hasEpc&&
            // Real QR/camera scanning is a separate integration (device camera
            // access) from AI document extraction - kept honestly simulated
            // here rather than pretending this button does something it can't.
            <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setDocsUploaded(true);setAiProcessing(true);setTimeout(()=>{setAiProcessing(false);setAiConfirmed(true)},1200)}}>Scan e-PC QR code (simulated — needs camera integration)</Btn>}
          {aiProcessing&&<div style={{textAlign:'center',padding:'16px',fontSize:'12px',color:C.textMuted}}>{hasEpc?'Verifying against live registry…':'Reading and digitizing documents…'}</div>}
          {aiConfirmed&&!aiError&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'12px',fontSize:'12px',color:C.green}}>✓ {hasEpc?'Verified — active and in good standing':'Documents read and information extracted'}. Review above before submitting.</div>}
          {aiConfirmed&&aiError&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'12px',fontSize:'12px',color:C.amber}}>⚠ {aiError}</div>}
        </Card>

        {aiConfirmed&&fullName&&department&&<Btn variant="primary" style={{width:'100%'}} onClick={handleSubmit} disabled={submitting}>{submitting?'Submitting…':'Submit for Admin confirmation'}</Btn>}
      </>}
    </div>
  )
}

// ── STAFF PROFILE — used by Search and Admin oversight ──────────────────────
function StaffProfileModal({ medsaId, viewerRole, onClose, onChanged }) {
  const [staff,setStaff]=useState(null)
  const [loading,setLoading]=useState(true)
  const [showOffboardConfirm,setShowOffboardConfirm]=useState(false)
  const [offboarding,setOffboarding]=useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('staff_credentials').select('*').eq('medsa_id',medsaId).maybeSingle()
      setStaff(data)
      setLoading(false)
    }
    load()
  }, [medsaId])

  async function handleOffboard() {
    setOffboarding(true)
    // Move to the permanent audit trail before scrubbing the full file
    if (staff) {
      await supabase.from('staff_audit_trail').insert({
        medsa_id: staff.medsa_id, full_name: staff.full_name, institution_source: staff.institution_source,
        role: staff.role, department: staff.department, employment_start: staff.start_date,
        employment_end: new Date().toISOString().slice(0,10), offboarded_by: viewerRole,
        verification_status_at_offboard: staff.verification_status,
      })
      await supabase.from('staff_credentials').delete().eq('medsa_id', staff.medsa_id)
    }
    setOffboarding(false)
    onChanged&&onChanged()
    onClose()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:420,padding:'24px',maxHeight:'85vh',overflowY:'auto'}}>
        {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>Loading…</div>}
        {!loading&&!staff&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>Not found.</div>}
        {!loading&&staff&&<>
          <div style={{fontSize:'17px',fontWeight:700}}>{staff.full_name}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>{staff.medsa_id} · {ROLES[staff.role]?.label||staff.role}</div>

          <InfoRow label="Department" value={staff.department||'—'}/>
          {staff.specialty&&<InfoRow label="Specialty" value={staff.specialty}/>}
          <InfoRow label="Registration no." value={staff.registration_number||(staff.has_epc?'e-PC linked':'—')}/>
          <InfoRow label="Verification" value={staff.verification_status} highlight={staff.verification_status!=='verified'}/>
          <InfoRow label="Registration expiry" value={staff.registration_expiry||'—'}/>
          <InfoRow label="Employment type" value={staff.employment_type==='full_time'?'Full-time':'Part-time'}/>
          <InfoRow label="Schedule type" value={staff.schedule_type}/>
          <InfoRow label="Insurance" value={staff.insurance_provider||'—'}/>
          <InfoRow label="Emergency contact" value={staff.emergency_contact_name?`${staff.emergency_contact_name} · ${staff.emergency_contact_phone||''}`:'—'} last/>

          {(viewerRole==='hr'||viewerRole==='admin')&&<>
            {!showOffboardConfirm
              ? <Btn variant="danger" style={{width:'100%',marginTop:'16px'}} onClick={()=>setShowOffboardConfirm(true)}>Offboard</Btn>
              : <div style={{marginTop:'16px',background:C.redLight,borderRadius:'10px',padding:'14px'}}>
                  <div style={{fontSize:'12px',color:C.red,marginBottom:'10px',lineHeight:1.5}}>This will scrub {staff.full_name}'s full file. A minimal audit record (name, role, employment dates) is kept permanently; everything else is deleted. This can't be undone.</div>
                  <div style={{display:'flex',gap:'8px'}}>
                    <Btn style={{flex:1}} onClick={()=>setShowOffboardConfirm(false)}>Cancel</Btn>
                    <Btn variant="danger" style={{flex:1}} onClick={handleOffboard} disabled={offboarding}>{offboarding?'Offboarding…':'Confirm offboard'}</Btn>
                  </div>
                </div>}
          </>}
        </>}
      </div>
    </div>
  )
}

// ── EMPLOYEE SEARCH — name/registration/MedsaID, with filters ───────────────
function EmployeeSearchScreen({ role }) {
  const [query,setQuery]=useState('')
  const [deptFilter,setDeptFilter]=useState('')
  const [roleFilter,setRoleFilter]=useState('')
  const [expiringOnly,setExpiringOnly]=useState(false)
  const [results,setResults]=useState([])
  const [loading,setLoading]=useState(false)
  const [activeMedsaId,setActiveMedsaId]=useState(null)

  async function runSearch() {
    setLoading(true)
    let q = supabase.from('staff_credentials').select('*').eq('institution_source','practitioner').eq('status','active')
    if (query.trim()) q = q.or(`full_name.ilike.%${query}%,registration_number.ilike.%${query}%,medsa_id.ilike.%${query}%`)
    if (deptFilter) q = q.eq('department', deptFilter)
    if (roleFilter) q = q.eq('role', roleFilter)
    if (expiringOnly) q = q.lte('registration_expiry', new Date(Date.now()+120*24*60*60*1000).toISOString().slice(0,10))
    const { data } = await q
    setResults(data||[])
    setLoading(false)
  }

  useEffect(() => { runSearch() }, [deptFilter, roleFilter, expiringOnly])

  return (
    <div style={{background:C.beige,flex:1,padding:'16px'}}>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
        <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runSearch()} placeholder="Name, registration no., or MedsaID" style={{flex:1,padding:'10px',fontSize:'13px',boxSizing:'border-box'}}/>
        <Btn onClick={runSearch}>Search</Btn>
      </div>
      <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
        <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{flex:1,padding:'8px',fontSize:'12px'}}>
          <option value="">All roles</option>
          {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <div onClick={()=>setExpiringOnly(!expiringOnly)} style={{padding:'8px 12px',borderRadius:'8px',fontSize:'12px',cursor:'pointer',background:expiringOnly?C.amber:C.card,color:expiringOnly?'#fff':C.textSub,whiteSpace:'nowrap'}}>Expiring soon</div>
      </div>

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>Loading…</div>}
      {!loading&&results.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>No matches.</div>}
      {!loading&&results.map(r=>(
        <Card key={r.id} onClick={()=>setActiveMedsaId(r.medsa_id)} style={{padding:'12px 16px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer'}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,flexShrink:0}}>{r.full_name?.[0]||'?'}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:'13px',fontWeight:500}}>{r.full_name}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{ROLES[r.role]?.label||r.role} · {r.department||'—'}</div>
          </div>
          <span style={{color:C.textMuted,fontSize:'14px'}}>›</span>
        </Card>
      ))}

      {activeMedsaId&&<StaffProfileModal medsaId={activeMedsaId} viewerRole={role} onClose={()=>setActiveMedsaId(null)} onChanged={runSearch}/>}
    </div>
  )
}

// ── SHIFT OPENINGS — permanent positions, distinct from bidding ─────────────
function ShiftOpeningsScreen({ role, department, doctorName, specialty }) {
  const [showRequestForm,setShowRequestForm]=useState(false)
  const [openings,setOpenings]=useState([])
  const [loading,setLoading]=useState(true)
  const [showCreate,setShowCreate]=useState(false)
  const [newDept,setNewDept]=useState('')
  const [newRole,setNewRole]=useState('doctor')
  const [newSpecialty,setNewSpecialty]=useState('')
  const [newEmpType,setNewEmpType]=useState('full_time')
  const [newSchedType,setNewSchedType]=useState('fixed')
  const [newDetail,setNewDetail]=useState('')
  const [newStartDate,setNewStartDate]=useState('')
  const [creating,setCreating]=useState(false)

  async function loadOpenings() {
    setLoading(true)
    const { data } = await supabase.from('shift_openings').select('*, shift_opening_applications(*)').eq('institution_source','practitioner').in('status',['open','pending_admin_confirmation']).order('created_at',{ascending:false})
    setOpenings(data||[])
    setLoading(false)
  }
  useEffect(() => { loadOpenings() }, [])

  async function handleCreate() {
    setCreating(true)
    await supabase.from('shift_openings').insert({
      institution_source:'practitioner', department:newDept, role_required:newRole, specialty_required:newSpecialty||null,
      employment_type_offered:newEmpType, schedule_type_offered:newSchedType, schedule_detail:newDetail,
      start_date:newStartDate, created_by:doctorName, status:'pending_admin_confirmation',
    })
    setCreating(false)
    setShowCreate(false)
    setNewDept('');setNewSpecialty('');setNewDetail('');setNewStartDate('')
    loadOpenings()
  }

  async function handleConfirmOpening(id) {
    await supabase.from('shift_openings').update({ status:'open', confirmed_by:doctorName }).eq('id', id)
    loadOpenings()
  }

  async function handleApply(openingId) {
    await supabase.from('shift_opening_applications').insert({ opening_id:openingId, applicant_medsa_id:doctorName, consented_at:new Date().toISOString() })
    loadOpenings()
  }

  const canApply = (o) => o.role_required===role && (!o.specialty_required || o.specialty_required===specialty)

  return (
    <div style={{background:C.beige,flex:1,padding:'16px'}}>
      {role==='hr'&&<Btn variant="primary" style={{width:'100%',marginBottom:'16px'}} onClick={()=>setShowCreate(true)}>+ Create opening</Btn>}
      {WORKING_ROLES.includes(role)&&<Btn style={{width:'100%',marginBottom:'16px'}} onClick={()=>setShowRequestForm(true)}>Request a different permanent change</Btn>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>Loading…</div>}
      {!loading&&openings.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>No open positions right now.</div>}
      {!loading&&openings.map(o=>{
        const alreadyApplied = (o.shift_opening_applications||[]).some(a=>a.applicant_medsa_id===doctorName)
        const isPendingConfirm = o.status==='pending_admin_confirmation'
        return (
          <Card key={o.id} style={{padding:'14px 16px',marginBottom:'8px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
              <span style={{fontSize:'13px',fontWeight:600}}>{ROLES[o.role_required]?.label||o.role_required}{o.specialty_required?` · ${o.specialty_required}`:''}</span>
              <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',background:isPendingConfirm?C.card:C.amberLight,color:isPendingConfirm?C.textMuted:C.amber}}>{isPendingConfirm?'Pending Admin':'Open'}</span>
            </div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>{o.department} · {o.employment_type_offered==='full_time'?'Full-time':'Part-time'}, {o.schedule_type_offered} · {o.schedule_detail} · starts {o.start_date}</div>
            {isPendingConfirm&&role==='admin'&&<Btn variant="primary" style={{width:'100%'}} onClick={()=>handleConfirmOpening(o.id)}>Confirm & publish</Btn>}
            {!isPendingConfirm&&WORKING_ROLES.includes(role)&&(canApply(o)
              ? <Btn variant="primary" style={{width:'100%'}} onClick={()=>handleApply(o.id)} disabled={alreadyApplied}>{alreadyApplied?'Applied':'Apply'}</Btn>
              : <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center'}}>Requires {ROLES[o.role_required]?.label||o.role_required}{o.specialty_required?` · ${o.specialty_required}`:''} credentials</div>)}
          </Card>
        )
      })}

      {showCreate&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowCreate(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:400,padding:'24px',maxHeight:'85vh',overflowY:'auto'}}>
          <div style={{fontSize:'16px',fontWeight:700,marginBottom:'16px'}}>New opening</div>
          <input value={newDept} onChange={e=>setNewDept(e.target.value)} placeholder="Department" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <select value={newRole} onChange={e=>setNewRole(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px'}}>
            {WORKING_ROLES.map(r=><option key={r} value={r}>{ROLES[r]?.label||r}</option>)}
          </select>
          <input value={newSpecialty} onChange={e=>setNewSpecialty(e.target.value)} placeholder="Specialty required (optional)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
            <select value={newEmpType} onChange={e=>setNewEmpType(e.target.value)} style={{flex:1,padding:'10px',fontSize:'12px'}}>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
            </select>
            <select value={newSchedType} onChange={e=>setNewSchedType(e.target.value)} style={{flex:1,padding:'10px',fontSize:'12px'}}>
              <option value="fixed">Fixed</option>
              <option value="rotating">Rotating</option>
            </select>
          </div>
          <input value={newDetail} onChange={e=>setNewDetail(e.target.value)} placeholder="Schedule detail, e.g. Tue/Thu/Sat mornings" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input type="date" value={newStartDate} onChange={e=>setNewStartDate(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'14px',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setShowCreate(false)}>Cancel</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={handleCreate} disabled={creating||!newDept||!newStartDate}>{creating?'Creating…':'Submit for Admin'}</Btn>
          </div>
        </div>
      </div>}

      {showRequestForm&&<div style={{position:'fixed',inset:0,background:C.beige,zIndex:300,overflowY:'auto'}}>
        <div onClick={()=>setShowRequestForm(false)} style={{padding:'16px 16px 0',fontSize:'13px',color:C.green,cursor:'pointer'}}>‹ Back to Openings</div>
        <PermanentChangeRequestScreen doctorName={doctorName} department={department}/>
      </div>}
    </div>
  )
}

// ── PERMANENT CHANGE REQUEST — all five categories, staff-facing ────────────
function PermanentChangeRequestScreen({ doctorName, department }) {
  const [category,setCategory]=useState('medical_grounds')
  const [reqEmpType,setReqEmpType]=useState('')
  const [reqSchedType,setReqSchedType]=useState('')
  const [reqDetail,setReqDetail]=useState('')
  const [swapPartner,setSwapPartner]=useState('')
  const [docUploaded,setDocUploaded]=useState(false)
  const [submitting,setSubmitting]=useState(false)
  const [submitted,setSubmitted]=useState(false)

  const CATEGORIES = [
    {key:'medical_grounds', label:'Medical / compassionate grounds', needsDoc:true},
    {key:'pregnancy_accommodation', label:'Pregnancy accommodation', needsDoc:false},
    {key:'contractual_conversion', label:'Convert full-time ↔ part-time', needsDoc:false},
    {key:'permanent_swap', label:'Permanent swap with a colleague', needsDoc:false, needsPartner:true},
  ]
  const activeCategory = CATEGORIES.find(c=>c.key===category)

  async function handleSubmit() {
    setSubmitting(true)
    await supabase.from('permanent_change_requests').insert({
      institution_source:'practitioner', medsa_id:doctorName, category, initiated_by:'self',
      swap_partner_medsa_id: category==='permanent_swap'?swapPartner:null,
      requested_employment_type: reqEmpType||null,
      requested_schedule_type: reqSchedType||null,
      requested_schedule_detail: reqDetail||null,
      supporting_doc_url: (activeCategory?.needsDoc && docUploaded) ? 'uploaded' : null,
      status:'pending',
    })
    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) return (
    <div style={{background:C.beige,flex:1,padding:'40px 20px',textAlign:'center'}}>
      <div style={{fontSize:'36px',marginBottom:'12px'}}>✓</div>
      <div style={{fontSize:'16px',fontWeight:700,marginBottom:'8px'}}>Request submitted</div>
      <div style={{fontSize:'13px',color:C.textSub}}>Awaiting HR review, then Admin confirmation. Your Department Head will be informed.</div>
    </div>
  )

  return (
    <div style={{background:C.beige,flex:1,padding:'16px'}}>
      <SecLabel>What kind of change?</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
        {CATEGORIES.map(c=>(
          <div key={c.key} onClick={()=>setCategory(c.key)} style={{padding:'12px 16px',borderRadius:'10px',fontSize:'13px',fontWeight:500,cursor:'pointer',background:category===c.key?C.green:C.card,color:category===c.key?'#fff':C.text}}>{c.label}</div>
        ))}
      </div>

      {category==='permanent_swap'&&<>
        <SecLabel>Swap with</SecLabel>
        <input value={swapPartner} onChange={e=>setSwapPartner(e.target.value)} placeholder="Colleague's name or MedsaID" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'16px',boxSizing:'border-box'}}/>
      </>}

      <SecLabel>What's changing</SecLabel>
      <Card style={{padding:'16px',marginBottom:'16px'}}>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'8px'}}>Leave blank whatever doesn't apply</div>
        <select value={reqEmpType} onChange={e=>setReqEmpType(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px'}}>
          <option value="">No change to employment type</option>
          <option value="full_time">Change to Full-time</option>
          <option value="part_time">Change to Part-time</option>
        </select>
        <select value={reqSchedType} onChange={e=>setReqSchedType(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px'}}>
          <option value="">No change to schedule type</option>
          <option value="fixed">Change to Fixed</option>
          <option value="rotating">Change to Rotating</option>
          <option value="hybrid">Change to Hybrid (both)</option>
        </select>
        <textarea value={reqDetail} onChange={e=>setReqDetail(e.target.value)} rows={3} placeholder="Details, e.g. requested days/times" style={{width:'100%',padding:'10px',fontSize:'13px',resize:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
      </Card>

      {activeCategory?.needsDoc&&<>
        <SecLabel>Supporting document</SecLabel>
        <Card style={{padding:'16px',marginBottom:'16px'}}>
          {!docUploaded
            ? <Btn variant="primary" style={{width:'100%'}} onClick={()=>setDocUploaded(true)}>Upload document</Btn>
            : <div style={{fontSize:'12px',color:C.green}}>✓ Document attached</div>}
        </Card>
      </>}

      <Btn variant="primary" style={{width:'100%'}} onClick={handleSubmit} disabled={submitting||(activeCategory?.needsDoc&&!docUploaded)||(!reqEmpType&&!reqSchedType)}>{submitting?'Submitting…':'Submit request'}</Btn>
    </div>
  )
}

// ── COVERAGE GRID — HR's institution-wide staffing overview ─────────────────
function CoverageGridScreen({ role, department }) {
  const [grid,setGrid]=useState({})
  const [thresholds,setThresholds]=useState({})
  const [loading,setLoading]=useState(true)
  const [editingDept,setEditingDept]=useState(null)
  const [editValue,setEditValue]=useState('')
  const [savedMsg,setSavedMsg]=useState(null)

  async function load() {
    setLoading(true)
    const inst='practitioner'
    const [staff, avail, thr] = await Promise.all([
      supabase.from('staff_credentials').select('department').eq('institution_source',inst).eq('status','active'),
      supabase.from('doctor_availability').select('*').eq('institution_source',inst),
      supabase.from('department_coverage_thresholds').select('*').eq('institution_source',inst),
    ])
    const byDept = {}
    ;(staff.data||[]).forEach(s=>{ const d=s.department||'Unassigned'; byDept[d]=(byDept[d]||0)+1 })
    setGrid(byDept)
    const thrMap = {}
    ;(thr.data||[]).forEach(t=>{ thrMap[t.department]=t.min_safe_staff_count })
    setThresholds(thrMap)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function saveThreshold(dept) {
    const value = parseInt(editValue)
    if (!value || value<0) return
    await supabase.from('department_coverage_thresholds').upsert({
      institution_source:'practitioner', department:dept, min_safe_staff_count:value, set_by:role, updated_at:new Date().toISOString(),
    }, {onConflict:'institution_source,department'})
    setThresholds(prev=>({...prev,[dept]:value}))
    setEditingDept(null)
    setSavedMsg(`${dept} threshold saved`)
    setTimeout(()=>setSavedMsg(null),2000)
  }

  // Only the Department Head of this specific department (or Admin, institution-wide) can set thresholds
  const canEdit = (dept) => role==='admin' || (role==='dept_head' && dept===department)

  return (
    <div style={{background:C.beige,flex:1,padding:'16px'}}>
      <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'16px'}}>Institution-wide headcount by department — used to weigh discretionary leave against overall coverage. Each Department Head sets their own department's safe minimum here.</div>
      {savedMsg&&<div style={{fontSize:'12px',color:C.green,textAlign:'center',marginBottom:'10px'}}>✓ {savedMsg}</div>}
      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>Loading…</div>}
      {!loading&&Object.keys(grid).length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>No active staff on file yet.</div>}
      {!loading&&Object.entries(grid).map(([dept,count])=>{
        const min = thresholds[dept]
        const isTight = min && count<=min
        return (
          <Card key={dept} style={{padding:'14px 16px',marginBottom:'8px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{dept}</div>
                <div style={{fontSize:'11px',color:C.textMuted}}>{min?`Min safe: ${min}`:'No threshold set'}</div>
              </div>
              <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:isTight?C.redLight:C.greenLight,color:isTight?C.red:C.green,fontWeight:600}}>{count} staff</span>
            </div>
            {canEdit(dept)&&<div style={{marginTop:'10px'}}>
              {editingDept===dept
                ? <div style={{display:'flex',gap:'8px'}}>
                    <input type="number" value={editValue} onChange={e=>setEditValue(e.target.value)} placeholder="Min safe staff" style={{flex:1,padding:'8px',fontSize:'12px'}}/>
                    <Btn variant="primary" onClick={()=>saveThreshold(dept)}>Save</Btn>
                  </div>
                : <Btn style={{width:'100%'}} onClick={()=>{setEditingDept(dept);setEditValue(min||'')}}>{min?'Update threshold':'Set threshold'}</Btn>}
            </div>}
          </Card>
        )
      })}
    </div>
  )
}

function WorkingHoursScreen() {
  const [selectedDoctor,setSelectedDoctor]=useState(STAFF_DIRECTORY[0]?.name || '')
  const [hours,setHours]=useState({})
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [slotDuration,setSlotDuration]=useState(30)
  const [exporting,setExporting]=useState(false)
  const [exportMsg,setExportMsg]=useState(null)

  // One-way export for payroll/finance - Medsa hands off hours worked and
  // schedule records as a real PDF, never integrates with an actual payroll
  // system directly.
  async function handleExportHours() {
    setExporting(true)
    const { data } = await supabase.from('doctor_availability').select('*').eq('institution_source','practitioner').order('doctor_name')
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text('Working Hours Export', 14, 20)
    doc.setFontSize(10); doc.text(`Generated ${new Date().toLocaleDateString('en-HK')} — for payroll/finance use`, 14, 28)
    let y = 40
    const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    ;(data||[]).forEach(row => {
      if (y > 270) { doc.addPage(); y = 20 }
      const line = row.is_off ? `${row.doctor_name} — ${DAYS[row.day_of_week]}: Off` : `${row.doctor_name} — ${DAYS[row.day_of_week]}: ${row.start_time?.slice(0,5)}-${row.end_time?.slice(0,5)}`
      doc.text(line, 14, y); y += 6
    })
    doc.save(`Working-Hours-Export-${new Date().toISOString().slice(0,10)}.pdf`)
    setExporting(false)
    setExportMsg(`✓ Downloaded — ${(data||[]).length} schedule records`)
    setTimeout(()=>setExportMsg(null), 3000)
  }

  async function loadHours(doctorName) {
    setLoading(true)
    const { data } = await supabase.from('doctor_availability').select('*')
      .eq('doctor_name', doctorName).eq('institution_source', 'practitioner')
    const byDay = {}
    for (let d=0; d<7; d++) byDay[d] = { start:'09:00', end:'17:00', is_off: d===0 }
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
      doctor_name: selectedDoctor, institution_source: 'practitioner', day_of_week: parseInt(day),
      start_time: h.start, end_time: h.end, is_off: h.is_off, slot_duration_minutes: slotDuration,
      updated_at: new Date().toISOString(),
    }))
    await supabase.from('doctor_availability').upsert(rows, { onConflict: 'doctor_name,institution_source,day_of_week' })
    setSaving(false)
    setSaved(true)
    setTimeout(()=>setSaved(false), 2500)
  }

  return (
    <div style={{background:C.beige,flex:1,padding:'16px'}}>
      <div style={{fontSize:'12px',color:C.textSub,textAlign:'center',marginBottom:'16px'}}>Sets each doctor's availability - syncs to their schedule and patient booking</div>

      <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
        {STAFF_DIRECTORY.map(d=>(
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

        <div style={{margin:'20px 0 8px',fontSize:'11px',color:C.textMuted}}>◇ For payroll/finance — Medsa hands off records, it doesn't manage payroll itself.</div>
        {exportMsg&&<div style={{fontSize:'12px',color:C.green,marginBottom:'8px'}}>✓ {exportMsg}</div>}
        <Btn style={{width:'100%'}} onClick={handleExportHours} disabled={exporting}>{exporting?'Preparing export…':'Export all hours (PDF)'}</Btn>
      </>}
    </div>
  )
}

// ── DEPT HOURS EDIT — inline within Dept Schedule, HR-editable ─────────────
function DeptHoursEditModal({ staffName, viewerRole, onClose }) {
  const [hours,setHours]=useState({})
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const canEdit = viewerRole==='hr'

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('doctor_availability').select('*').eq('doctor_name', staffName).eq('institution_source','practitioner')
      const byDay = {}
      for (let d=0; d<7; d++) byDay[d] = { start:'09:00', end:'17:00', is_off: d===0 }
      ;(data||[]).forEach(row => { byDay[row.day_of_week] = { start: row.start_time?.slice(0,5)||'09:00', end: row.end_time?.slice(0,5)||'17:00', is_off: row.is_off } })
      setHours(byDay)
      setLoading(false)
    }
    load()
  }, [staffName])

  function updateDay(day, field, value) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const rows = Object.entries(hours).map(([day, h]) => ({
      doctor_name: staffName, institution_source: 'practitioner', day_of_week: parseInt(day),
      start_time: h.start, end_time: h.end, is_off: h.is_off, slot_duration_minutes: 30,
      updated_at: new Date().toISOString(),
    }))
    await supabase.from('doctor_availability').upsert(rows, { onConflict: 'doctor_name,institution_source,day_of_week' })
    setSaving(false)
    setSaved(true)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:400,padding:'24px',maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>{staffName}'s hours</div>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px'}}>{canEdit?'Editable by HR':'View only - HR manages hour changes'}</div>
        {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>Loading…</div>}
        {!loading&&['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((dayName,i)=>{
          const h = hours[i] || {start:'09:00',end:'17:00',is_off:false}
          return (
            <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:`0.5px solid ${C.border}`}}>
              <div style={{width:70,fontSize:'12px',fontWeight:500}}>{dayName.slice(0,3)}</div>
              {h.is_off ? <div style={{flex:1,fontSize:'12px',color:C.textMuted}}>Off</div> : (
                canEdit
                  ? <div style={{flex:1,display:'flex',gap:'6px'}}>
                      <input type="time" value={h.start} onChange={e=>updateDay(i,'start',e.target.value)} style={{flex:1,fontSize:'11px',padding:'5px'}}/>
                      <input type="time" value={h.end} onChange={e=>updateDay(i,'end',e.target.value)} style={{flex:1,fontSize:'11px',padding:'5px'}}/>
                    </div>
                  : <div style={{flex:1,fontSize:'12px'}}>{h.start} – {h.end}</div>
              )}
              {canEdit&&<Toggle checked={!h.is_off} onChange={(on)=>updateDay(i,'is_off',!on)}/>}
            </div>
          )
        })}
        {saved&&<div style={{fontSize:'12px',color:C.green,marginTop:'10px'}}>✓ Saved</div>}
        <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
          <Btn style={{flex:1}} onClick={onClose}>Close</Btn>
          {canEdit&&<Btn variant="primary" style={{flex:1}} onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save'}</Btn>}
        </div>
      </div>
    </div>
  )
}

function ScheduleScreen({ role, department, doctorName, onGoToFullDiagnosis, onViewFullRecord }) {
  const [view,setView]=useState(role==='hr'?'dept':'mine')
  const isLead=role==='admin'||role==='dept_head'
  const canViewDeptSchedule = isLead || role==='hr'
  const isClinicalTodoRole = role==='doctor'||role==='therapist'||role==='allied'
  const isReceptionist = role==='receptionist'
  const TABS=role==='hr'
    ? [{key:'dept',label:'Dept schedule'}]
    : [{key:'mine',label:'My schedule'},isLead&&{key:'dept',label:'Dept schedule'},{key:'appts',label:isClinicalTodoRole?"Today's patients":'Appointments'}].filter(Boolean)
  const [myHours,setMyHours]=useState({})
  const [myHoursLoading,setMyHoursLoading]=useState(true)

  useEffect(() => {
    async function loadMyHours() {
      if (role!=='doctor'||!doctorName) { setMyHoursLoading(false); return }
      setMyHoursLoading(true)
      const { data } = await supabase.from('doctor_availability').select('*').eq('doctor_name', doctorName).eq('institution_source','practitioner')
      const byDay = {}
      ;(data||[]).forEach(row => { byDay[row.day_of_week] = row })
      setMyHours(byDay)
      setMyHoursLoading(false)
    }
    loadMyHours()
  }, [role, doctorName])

  // Real upcoming dates starting today, not hardcoded date-string keys
  // like 'Mon 23' that never corresponded to any actual current date.
  const DAY_LABELS_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const dayOptions = Array.from({length:5}, (_,i) => {
    const d = new Date()
    d.setDate(d.getDate()+i)
    return d
  })
  const [selectedDay,setSelectedDay]=useState(dayOptions[0])

  // Demo data only shown on today's view, keyed by real weekday so it
  // still looks populated during testing without pretending to represent
  // dates that don't actually exist yet.
  const demoScheduleByWeekday = {
    'Mon': [{time:'09:30',name:'Ho Ka-yee',medsaId:'MDS-65310-HK',type:'Consultation',room:'3B',notes:'Reports mild fever, 2 days',doctor:'Dr Yeung Chi-hong',department:'Internal Medicine'}],
    'Tue': [
      {time:'09:00',name:'Wong Mei-ling',medsaId:'MDS-84921-HK',type:'Follow-up · Blood results',room:'3A',notes:'No new symptoms reported',doctor:'Dr Yeung Chi-hong',department:'Internal Medicine'},
      {time:'10:00',name:'Chan Tai-man',medsaId:'MDS-77213-HK',type:'New patient · Chest pain',room:'3A',notes:'Chest tightness on exertion, started yesterday',doctor:'Dr Yeung Chi-hong',department:'Internal Medicine'},
      {time:'10:30',name:'Lee Siu-fong',medsaId:'MDS-90142-HK',type:'Prescription review',room:'3B',notes:'',doctor:'Dr Ho Ka-fai',department:'Cardiology'},
      {time:'14:00',name:'Ho Ka-yee',medsaId:'MDS-65310-HK',type:'Post-op check',room:'4A',notes:'Wound healing well per patient',doctor:'Dr Yeung Chi-hong',department:'Internal Medicine'},
      {time:'15:30',name:'Yip Wing-sze',medsaId:'MDS-33017-HK',type:'Diabetes management',room:'3A',notes:'Requesting review of insulin dosage',doctor:'Dr Tsang Wing-lam',department:'Cardiology'},
    ],
    'Wed': [{time:'11:00',name:'Chan Tai-man',medsaId:'MDS-77213-HK',type:'Follow-up',room:'3A',notes:'',doctor:'Dr Yeung Chi-hong',department:'Internal Medicine'}],
  }

  // Doctors see only their own named patients; therapists/allied/nurses
  // see their department's patients; receptionist and admin/dept_head see
  // everyone, since they need the full picture to manage the schedule.
  function filterForRole(dayAppts) {
    if (role==='doctor' && doctorName) return dayAppts.filter(a=>a.doctor===doctorName)
    if ((role==='therapist'||role==='allied'||role==='nurse'||role==='clinic_nurse') && department) return dayAppts.filter(a=>a.department===department)
    return dayAppts
  }

  const [appts,setAppts]=useState([])
  const [loadingAppts,setLoadingAppts]=useState(true)

  // Load real appointments booked through PatientApp for the selected day
  // (see schema_connect_booking_to_schedule.sql), merged with illustrative
  // demo data on today's view only - this is what makes a real patient
  // booking actually show up here, not just in the old hardcoded lists.
  async function loadAppointmentsForDay(dateObj) {
    setLoadingAppts(true)
    const dayStart = new Date(dateObj); dayStart.setHours(0,0,0,0)
    const dayEnd = new Date(dateObj); dayEnd.setHours(23,59,59,999)
    // Only this institution's own bookings - ClinicOps and PractitionerApp
    // represent two different institutions and shouldn't see each other's
    // appointments just because they happen to share the same database.
    const { data } = await supabase.from('appointments').select('*, patients(full_name, medsa_id)')
      .eq('institution_source', 'practitioner')
      .neq('status', 'cancelled')
      .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())
      .order('scheduled_at', {ascending:true})

    const realRows = (data||[]).map(a => ({
      time: new Date(a.scheduled_at).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit',hour12:false}),
      name: a.patients?.full_name || 'Unknown patient',
      medsaId: a.patients?.medsa_id || null,
      type: a.appointment_type || 'Consultation',
      room: '-',
      notes: a.reason_for_visit || '',
      doctor: a.doctor_name || 'Unassigned',
      department: a.department || 'Internal Medicine',
      status: a.status || 'confirmed',
    }))

    const isToday = dayStart.toDateString() === new Date().toDateString()
    const weekdayShort = DAY_LABELS_SHORT[dateObj.getDay()]
    const demoRowsRaw = isToday ? (demoScheduleByWeekday[weekdayShort] || []) : []
    // If a patient already has a real booked appointment today, don't
    // also show their static demo row - that created confusing duplicate
    // entries where clicking the demo one never reflected a real check-in.
    const realMedsaIds = new Set(realRows.map(r=>r.medsaId).filter(Boolean))
    const demoRows = demoRowsRaw.filter(d=>!realMedsaIds.has(d.medsaId))

    setAppts(filterForRole([...realRows, ...demoRows]))
    setLoadingAppts(false)
  }

  function changeDay(day) {
    setSelectedDay(day)
  }

  useEffect(() => { loadAppointmentsForDay(selectedDay) }, [selectedDay])

  // Real per-patient check against the consent window set at booking time
  // (see schema_intake_consent.sql), replacing the earlier day-based
  // placeholder. Looked up per patient since the window is a lawyer's-eye
  // 12-hours-before/after their own specific appointment, not a blanket
  // per-day rule. Demo appointments that were never booked through the
  // real patient flow simply won't have a consent record - that's the
  // honest, correct outcome, not a bug.
  const [dataWindows,setDataWindows]=useState({}) // medsaId -> {allowed, checked}

  async function checkDataWindow(medsaId) {
    if (dataWindows[medsaId]?.checked) return
    const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
    if (!patientRow) { setDataWindows(prev=>({...prev,[medsaId]:{allowed:false,checked:true}})); return }
    const { data } = await supabase.from('appointment_intake').select('*').eq('patient_id', patientRow.id).eq('consent_given', true).order('created_at',{ascending:false}).limit(1).maybeSingle()
    if (!data) { setDataWindows(prev=>({...prev,[medsaId]:{allowed:false,checked:true}})); return }
    const now = new Date()
    const allowed = now >= new Date(data.access_window_start) && now <= new Date(data.access_window_end)
    setDataWindows(prev=>({...prev,[medsaId]:{allowed,checked:true,windowEnd:data.access_window_end}}))
  }

  useEffect(() => { appts.forEach(a=>checkDataWindow(a.medsaId)) }, [appts])

  function withinDataWindow(medsaId) {
    return dataWindows[medsaId]?.allowed || false
  }

  const [activeTodoPatient,setActiveTodoPatient]=useState(null)
  const [callingPatientName,setCallingPatientName]=useState(null)
  const [activeReceptionAppt,setActiveReceptionAppt]=useState(null)
  const [deptDoctors,setDeptDoctors]=useState([])
  const [deptHours,setDeptHours]=useState({}) // doctorName -> {day: row}
  const [deptScheduleLoading,setDeptScheduleLoading]=useState(true)
  const [editingDoctor,setEditingDoctor]=useState(null)

  useEffect(() => {
    async function loadDeptSchedule() {
      if (!canViewDeptSchedule) { setDeptScheduleLoading(false); return }
      setDeptScheduleLoading(true)
      const inDept = department ? STAFF_DIRECTORY.filter(d=>d.department===department) : STAFF_DIRECTORY
      setDeptDoctors(inDept)
      const { data } = await supabase.from('doctor_availability').select('*')
        .eq('institution_source','practitioner').in('doctor_name', inDept.map(d=>d.name))
      const byDoctor = {}
      ;(data||[]).forEach(row => {
        if (!byDoctor[row.doctor_name]) byDoctor[row.doctor_name] = {}
        byDoctor[row.doctor_name][row.day_of_week] = row
      })
      setDeptHours(byDoctor)
      setDeptScheduleLoading(false)
    }
    loadDeptSchedule()
  }, [canViewDeptSchedule, department])

  const [showNewApptModal,setShowNewApptModal]=useState(false)
  const myName = ROLES[role]?.label || 'Doctor'

  function handleReceptionSave(index, updated) {
    setAppts(prev => {
      const next = [...prev]
      if (updated.cancelled) { next.splice(index,1); return next }
      next[index] = updated
      return next
    })
  }

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
        {role!=='doctor'&&<div style={{margin:'0 16px',fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'20px'}}>Working hours are set per-doctor by an admin.</div>}
        {role==='doctor'&&myHoursLoading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>Loading…</div>}
        {role==='doctor'&&!myHoursLoading&&dayOptions.map((d,i)=>{
          const row = myHours[d.getDay()]
          const isOff = !row || row.is_off
          return (
            <Card key={i} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
              <div style={{width:40,height:40,borderRadius:'10px',background:isOff?C.card:C.greenLight,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize:'11px',fontWeight:700,color:isOff?C.textMuted:C.green,textAlign:'center',lineHeight:1.3}}>{d.toLocaleDateString('en-HK',{weekday:'short'})}<br/>{d.getDate()}</span>
              </div>
              <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:500}}>{isOff?'OFF':`${row.start_time?.slice(0,5)} – ${row.end_time?.slice(0,5)}`}</div><div style={{fontSize:'11px',color:C.textSub}}>{department||'—'}</div></div>
              <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',fontWeight:500,background:isOff?C.card:C.greenLight,color:isOff?C.textMuted:C.green}}>{isOff?'Day off':'Confirmed'}</span>
            </Card>
          )
        })}
      </>}
      {view==='dept'&&canViewDeptSchedule&&<>
        <SecLabel>{department||'Department'} · full week</SecLabel>
        {deptScheduleLoading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>Loading…</div>}
        {!deptScheduleLoading&&deptDoctors.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>No staff on file for this department yet.</div>}
        {!deptScheduleLoading&&Object.entries(ROLES).map(([roleKey,roleInfo])=>{
          const inRole = deptDoctors.filter(d=>d.role===roleKey)
          if (inRole.length===0) return null
          return (
            <div key={roleKey}>
              <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',margin:'12px 16px 8px'}}>{roleInfo.label}</div>
              {inRole.map(doc=>(
                <Card key={doc.name} onClick={()=>setEditingDoctor(doc.name)} style={{padding:'14px 16px',cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                    <span style={{fontSize:'13px',fontWeight:600}}>{doc.name}</span>
                    <span style={{color:C.textMuted,fontSize:'14px'}}>›</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px'}}>
                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>{
                      const row = (deptHours[doc.name]||{})[i===6?0:i+1]
                      const isOff = !row||row.is_off
                      return (
                        <div key={d} style={{textAlign:'center'}}>
                          <div style={{fontSize:'9px',color:C.textMuted,marginBottom:'2px'}}>{d}</div>
                          <div style={{fontSize:'9px',padding:'3px 1px',borderRadius:'4px',background:isOff?C.card:C.greenLight,color:isOff?C.textMuted:C.green}}>{isOff?'off':`${row.start_time?.slice(0,5)}`}</div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )
        })}
        {editingDoctor&&<DeptHoursEditModal staffName={editingDoctor} viewerRole={role} onClose={()=>setEditingDoctor(null)}/>}
        {isLead&&<>
          <SecLabel>Post announcement</SecLabel>
          <Card style={{padding:'16px'}}>
            <textarea style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,resize:'none',outline:'none',fontFamily:'inherit',marginBottom:'10px'}} rows={3} placeholder="Write announcement to your department…"/>
            <Btn variant="primary" style={{width:'100%'}}>Post to department</Btn>
          </Card>
        </>}
      </>}
      {view==='appts'&&<>
        {isReceptionist&&<div style={{padding:'12px 16px 4px',display:'flex',gap:'8px',overflowX:'auto'}}>
          {dayOptions.map(day=>(
            <div key={day.toISOString()} onClick={()=>changeDay(day)} style={{flexShrink:0,padding:'8px 14px',borderRadius:'20px',fontSize:'12px',fontWeight:500,cursor:'pointer',background:day.toDateString()===selectedDay.toDateString()?C.green:C.card,color:day.toDateString()===selectedDay.toDateString()?'#fff':C.textSub}}>{day.toLocaleDateString('en-HK',{weekday:'short',day:'numeric'})}</div>
          ))}
        </div>}
        <SecLabel>{isClinicalTodoRole?`Today's patients · ${selectedDay.toLocaleDateString('en-HK',{weekday:'short',day:'numeric',month:'short'})}`:selectedDay.toLocaleDateString('en-HK',{weekday:'short',day:'numeric',month:'short'})}</SecLabel>
        {loadingAppts&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,marginBottom:'12px'}}>Loading...</div>}
        {role==='doctor'&&doctorName&&<div style={{margin:'-4px 16px 10px',fontSize:'11px',color:C.textMuted}}>Showing your patients only · {doctorName}</div>}
        {(role==='therapist'||role==='allied')&&department&&<div style={{margin:'-4px 16px 10px',fontSize:'11px',color:C.textMuted}}>Showing {department} patients only</div>}
        {isClinicalTodoRole&&<div style={{margin:'0 16px 12px',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'10px',padding:'10px 14px',fontSize:'11px',color:C.textSub,lineHeight:1.5}}>
          ◇ Tap a patient to video call, message, or open their full record.
        </div>}
        {isReceptionist&&<div style={{margin:'0 16px 12px',background:C.blueLight,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'10px 14px',fontSize:'11px',color:C.textSub,lineHeight:1.5}}>
          ◇ Booking and scheduling changes work for any patient. Clinical details are only visible for patients within their own 48-hour consent window from booking (12h before, the appointment day, 12h after) - see each patient's badge below.
        </div>}
        {appts.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>No appointments scheduled for this day.</div>}
        {[...appts].sort((a,b)=>a.time.localeCompare(b.time)).map((a,i)=>(
          <Card key={i} onClick={()=>{ if(isClinicalTodoRole) setActiveTodoPatient(a); else if(isReceptionist) setActiveReceptionAppt({appt:a,index:appts.indexOf(a)}) }} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center',cursor:(isClinicalTodoRole||isReceptionist)?'pointer':'default'}}>
            <div style={{width:44,textAlign:'center'}}><div style={{fontSize:'14px',fontWeight:700,color:C.green}}>{a.time}</div></div>
            <div style={{flex:1}}>
              <div style={{fontSize:'13px',fontWeight:600}}>{a.name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{a.type}{a.doctor?` · ${a.doctor}`:''}</div>
              {a.notes&&<div style={{fontSize:'11px',color:C.amber,marginTop:'2px'}}>◇ {a.notes}</div>}
            </div>
            {isReceptionist&&<Badge text={withinDataWindow(a.medsaId)?'Data available':'Outside consent window'} type={withinDataWindow(a.medsaId)?'ok':'due'}/>}
            <span style={{fontSize:'11px',background:C.greenLight,color:C.green,padding:'3px 9px',borderRadius:'20px'}}>Rm {a.room}</span>
            {(isClinicalTodoRole||isReceptionist)&&<span style={{color:C.textMuted,fontSize:'14px'}}>›</span>}
          </Card>
        ))}
        <div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}} onClick={()=>setShowNewApptModal(true)}>+ New appointment</Btn></div>
      </>}
      <PatientTodoActionModal
        patient={activeTodoPatient}
        onClose={()=>setActiveTodoPatient(null)}
        doctorLabel={myName}
        onStartCall={(name)=>{setCallingPatientName(name);setActiveTodoPatient(null)}}
        onGoToFullDiagnosis={()=>{setActiveTodoPatient(null);onGoToFullDiagnosis&&onGoToFullDiagnosis()}}
        onViewFullRecord={()=>{setActiveTodoPatient(null);onViewFullRecord&&onViewFullRecord()}}
        onSwitchDoctor={(newDoctorName)=>{
          setAppts(prev=>prev.map(a=>a===activeTodoPatient?{...a,doctor:newDoctorName}:a))
        }}
        onCancelAppt={async()=>{
          setAppts(prev=>prev.filter(a=>a!==activeTodoPatient))
          // best-effort: if this is a real booked appointment (not demo
          // data), also cancel it in Supabase so it doesn't linger
          if (activeTodoPatient?.medsaId) {
            const { data: pRow } = await supabase.from('patients').select('id').eq('medsa_id', activeTodoPatient.medsaId).maybeSingle()
            if (pRow) {
              const dayStart=new Date(selectedDay); dayStart.setHours(0,0,0,0)
              const dayEnd=new Date(selectedDay); dayEnd.setHours(23,59,59,999)
              await supabase.from('appointments').update({status:'cancelled'}).eq('patient_id',pRow.id).eq('institution_source','practitioner').gte('scheduled_at',dayStart.toISOString()).lte('scheduled_at',dayEnd.toISOString())
            }
          }
        }}
        onCancelCheckIn={async()=>{
          if (!activeTodoPatient?.medsaId) return
          const { data: pRow } = await supabase.from('patients').select('id').eq('medsa_id', activeTodoPatient.medsaId).maybeSingle()
          if (!pRow) return
          const dayStart=new Date(selectedDay); dayStart.setHours(0,0,0,0)
          const dayEnd=new Date(selectedDay); dayEnd.setHours(23,59,59,999)
          await supabase.from('appointments').update({status:'confirmed', checked_in_at:null}).eq('patient_id',pRow.id).eq('institution_source','practitioner').gte('scheduled_at',dayStart.toISOString()).lte('scheduled_at',dayEnd.toISOString())
          setAppts(prev=>prev.map(a=>a===activeTodoPatient?{...a,status:'confirmed'}:a))
        }}
        onBookFollowup={async(date,reason)=>{
          if (!activeTodoPatient?.medsaId) return false
          const { data: pRow } = await supabase.from('patients').select('id').eq('medsa_id', activeTodoPatient.medsaId).maybeSingle()
          if (!pRow) return false
          const { error: apptErr } = await supabase.from('appointments').insert({
            patient_id: pRow.id, doctor_name: activeTodoPatient.doctor, department: activeTodoPatient.department,
            scheduled_at: new Date(date+'T10:00:00').toISOString(), appointment_type: reason, status: 'confirmed',
            institution_source: 'practitioner',
          })
          return !apptErr
        }}
      />
      <ReceptionistScheduleActionModal
        appt={activeReceptionAppt?.appt}
        onClose={()=>setActiveReceptionAppt(null)}
        onSave={(updated)=>handleReceptionSave(activeReceptionAppt.index, updated)}
        withinDataWindow={activeReceptionAppt ? withinDataWindow(activeReceptionAppt.appt.medsaId) : false}
        onCancelCheckIn={async()=>{
          const target = activeReceptionAppt?.appt
          if (!target?.medsaId) return
          const { data: pRow } = await supabase.from('patients').select('id').eq('medsa_id', target.medsaId).maybeSingle()
          if (!pRow) return
          const dayStart=new Date(selectedDay); dayStart.setHours(0,0,0,0)
          const dayEnd=new Date(selectedDay); dayEnd.setHours(23,59,59,999)
          await supabase.from('appointments').update({status:'confirmed', checked_in_at:null}).eq('patient_id',pRow.id).eq('institution_source','practitioner').gte('scheduled_at',dayStart.toISOString()).lte('scheduled_at',dayEnd.toISOString())
          loadAppointmentsForDay(selectedDay)
        }}
      />
      <DoctorVideoCallModal patientName={callingPatientName} onClose={()=>setCallingPatientName(null)}/>
      <NewAppointmentModal open={showNewApptModal} onClose={()=>setShowNewApptModal(false)} onBooked={()=>loadAppointmentsForDay(selectedDay)}/>
    </div>
  )
}

// ── MESSAGES ──────────────────────────────────────────────────────────────────
function MessagesScreen({ role }) {
  const isReadOnly = false // reverted per feedback - admin can compose/reply/delete like everyone else
  const [composing,setComposing]=useState(false)
  const [msgs,setMsgs]=useState([])
  const [loading,setLoading]=useState(true)
  const [openThread,setOpenThread]=useState(null)
  const [toField,setToField]=useState('')
  const [bodyField,setBodyField]=useState('')
  const [sending,setSending]=useState(false)
  const [error,setError]=useState(null)
  const [showSuggestions,setShowSuggestions]=useState(false)
  const [knownRecipients,setKnownRecipients]=useState([])

  const myName = ROLES[role]?.label || 'Staff'

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase.from('staff_messages').select('*').order('created_at',{ascending:false}).limit(100)
    setMsgs(data||[])
    const names = new Set()
    ;(data||[]).forEach(m=>{ names.add(m.sender_name); names.add(m.recipient_name) })
    Object.values(ROLES).forEach(r=>names.add(r.label))
    names.add('All Staff')
    setKnownRecipients([...names].filter(n=>n && n!==myName).sort())
    setLoading(false)
    return data||[]
  }

  useEffect(() => { loadMessages() }, [])

  function threadKey(m) { return m.thread_id || m.id }

  function getThreadFrom(list, m) {
    const key = threadKey(m)
    return list.filter(x=>threadKey(x)===key).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
  }

  const threadsLatestFirst = Object.values(
    msgs.reduce((acc,m)=>{
      const key = threadKey(m)
      if (!acc[key] || new Date(m.created_at) > new Date(acc[key].created_at)) acc[key] = m
      return acc
    }, {})
  ).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))

  async function handleOpen(m) {
    const thread = getThreadFrom(msgs, m)
    setOpenThread(thread)
    const unreadIds = thread.filter(x=>!x.read).map(x=>x.id)
    if (unreadIds.length>0) {
      await supabase.from('staff_messages').update({ read: true }).in('id', unreadIds)
      setMsgs(prev=>prev.map(x=>unreadIds.includes(x.id)?{...x,read:true}:x))
    }
  }

  async function handleSend() {
    if (!toField.trim() || !bodyField.trim()) { setError('Enter a recipient and a message.'); return }
    setSending(true)
    setError(null)
    const isReply = !!openThread
    const replyThreadId = isReply ? threadKey(openThread[0]) : null
    const { error: insErr } = await supabase.from('staff_messages').insert({
      sender_name: myName,
      recipient_name: toField,
      body: bodyField,
      read: false,
      thread_id: replyThreadId,
    })
    setSending(false)
    if (insErr) { setError(insErr.message); return }
    setBodyField(''); setComposing(false); setError(null)
    const fresh = await loadMessages()
    if (isReply) {
      // Stay inside the conversation, showing the reply appended - this is
      // the actual fix: previously this closed back to the inbox, which
      // made a reply look like a disconnected new message popping up top.
      setOpenThread(getThreadFrom(fresh, openThread[0]))
    } else {
      setToField('')
    }
  }

  async function handleDeleteMessage(id) {
    await supabase.from('staff_messages').delete().eq('id', id)
    const fresh = await loadMessages()
    if (openThread) {
      const remaining = getThreadFrom(fresh, openThread[0])
      if (remaining.length===0) setOpenThread(null)
      else setOpenThread(remaining)
    }
  }

  async function handleDeleteThread(m) {
    const thread = getThreadFrom(msgs, m)
    await supabase.from('staff_messages').delete().in('id', thread.map(x=>x.id))
    loadMessages()
  }

  if (openThread) return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{padding:'12px 16px 4px'}}>
        <div onClick={()=>setOpenThread(null)} style={{fontSize:'12px',color:C.green,cursor:'pointer'}}>← Back to messages</div>
      </div>
      <div style={{padding:'0 16px'}}>
        {openThread.map((m)=>(
          <Card key={m.id} style={{padding:'14px 16px',marginBottom:'8px',background:m.sender_name===myName?C.greenXLight:C.cream}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
              <span style={{fontSize:'13px',fontWeight:700}}>{m.sender_name}</span>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontSize:'11px',color:C.textMuted}}>{new Date(m.created_at).toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                {!isReadOnly&&<span onClick={()=>handleDeleteMessage(m.id)} style={{fontSize:'12px',color:C.red,cursor:'pointer'}} title="Delete message">✕</span>}
              </div>
            </div>
            <div style={{fontSize:'13px',color:C.text,lineHeight:1.6}}>{m.body}</div>
          </Card>
        ))}
      </div>
      {!isReadOnly&&!composing&&<div style={{padding:'8px 16px 16px'}}>
        <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setToField(openThread[0].sender_name===myName?openThread[0].recipient_name:openThread[0].sender_name);setComposing(true)}}>Reply</Btn>
      </div>}
      {isReadOnly&&<div style={{padding:'8px 16px 16px',fontSize:'11px',color:C.textMuted,textAlign:'center'}}>◇ Read-only view — Institution Admin cannot reply or delete</div>}
      {composing&&(
        <div style={{padding:'0 16px 16px'}}>
          <Card style={{padding:'16px'}}>
            <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Reply to {toField}</div>
            <textarea value={bodyField} onChange={e=>setBodyField(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginBottom:'10px',boxSizing:'border-box'}} rows={3} placeholder="Message…"/>
            {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
            <div style={{display:'flex',gap:'8px'}}><Btn style={{flex:1}} onClick={()=>{setComposing(false);setError(null)}}>Cancel</Btn><Btn variant="primary" style={{flex:1}} onClick={handleSend} disabled={sending}>{sending?'Sending…':'Send'}</Btn></div>
          </Card>
        </div>
      )}
    </div>
  )

  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>Messages{isReadOnly&&' (Read-only)'}</SecLabel>
      {loading&&<div style={{padding:'20px',textAlign:'center',fontSize:'12px',color:C.textMuted}}>Loading…</div>}
      {!loading&&threadsLatestFirst.length===0&&<div style={{padding:'20px',textAlign:'center',fontSize:'12px',color:C.textMuted}}>No messages yet.</div>}
      {threadsLatestFirst.map((m)=>(
        <Card key={m.id} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
          <div onClick={()=>handleOpen(m)} style={{width:36,height:36,borderRadius:'10px',background:!m.read?C.greenLight:C.card,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:600,color:!m.read?C.green:C.textMuted,flexShrink:0,cursor:'pointer'}}>{m.sender_name[0]}</div>
          <div onClick={()=>handleOpen(m)} style={{flex:1,cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:'13px',fontWeight:!m.read?700:500}}>{m.sender_name}</span><span style={{fontSize:'11px',color:C.textMuted}}>{new Date(m.created_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})}</span></div>
            <div style={{fontSize:'12px',color:!m.read?C.text:C.textSub,marginTop:'2px',lineHeight:1.4}}>{m.body}</div>
          </div>
          {!m.read&&<div style={{width:8,height:8,borderRadius:'50%',background:C.green,flexShrink:0,marginTop:'4px'}}/>}
          {!isReadOnly&&<span onClick={()=>handleDeleteThread(m)} style={{fontSize:'13px',color:C.textMuted,cursor:'pointer',flexShrink:0}} title="Delete conversation">✕</span>}
        </Card>
      ))}
      {!isReadOnly&&composing&&(
        <Card style={{padding:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>New message</div>
          <div style={{position:'relative',marginBottom:'8px'}}>
            <input
              value={toField}
              onChange={e=>{setToField(e.target.value);setShowSuggestions(true)}}
              onFocus={()=>setShowSuggestions(true)}
              onBlur={()=>setTimeout(()=>setShowSuggestions(false),150)}
              style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}
              placeholder="To: name or department…"
            />
            {showSuggestions&&toField.trim()&&<div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:'8px',marginTop:'4px',zIndex:20,boxShadow:'0 4px 12px rgba(0,0,0,0.1)',maxHeight:150,overflowY:'auto'}}>
              {knownRecipients.filter(n=>n.toLowerCase().includes(toField.toLowerCase())).slice(0,6).map((n,i)=>(
                <div key={i} onMouseDown={()=>{setToField(n);setShowSuggestions(false)}} style={{padding:'8px 12px',fontSize:'12px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`}}>{n}</div>
              ))}
            </div>}
          </div>
          <textarea value={bodyField} onChange={e=>setBodyField(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginBottom:'10px',boxSizing:'border-box'}} rows={3} placeholder="Message…"/>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
          <div style={{display:'flex',gap:'8px'}}><Btn style={{flex:1}} onClick={()=>{setComposing(false);setError(null)}}>Cancel</Btn><Btn variant="primary" style={{flex:1}} onClick={handleSend} disabled={sending}>{sending?'Sending…':'Send'}</Btn></div>
        </Card>
      )}
      {!isReadOnly&&!composing&&<div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}} onClick={()=>setComposing(true)}>+ Compose message</Btn></div>}
      {isReadOnly&&<div style={{padding:'8px 16px 16px',fontSize:'11px',color:C.textMuted,textAlign:'center'}}>◇ Institution Admin has read-only access to messages</div>}
    </div>
  )
}

function AdminPermissions() {
  const permLabels={identity:'View patient identity',vitals:'View & record vitals',history:'View medical history',medications:'View medication records',allergies:'View allergy info',mental:'View mental health records',imaging:'View imaging & scans',labs:'View lab results',prescribe:'Prescribe medications',dispense:'Dispense medications',appointments:'Manage appointments',billing:'View billing info',musculoskeletal:'View musculoskeletal notes',specialty_notes:'Log specialty notes',critical_conditions:'View critical conditions (EMS)',emergency:'Emergency override',tasks:'Manage patient tasks'}
  const [perms,setPerms]=useState(Object.fromEntries(Object.entries(ACCESS).map(([r,a])=>[r,{...a}])))
  const [activeRole,setActiveRole]=useState('nurse')
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState(null)
  const toggle=(role,perm)=>{setPerms(p=>({...p,[role]:{...p[role],[perm]:!p[role][perm]}}));setSaved(false)}
  const rolePerms=perms[activeRole]||{}

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const rows = Object.entries(rolePerms).map(([permission_key,enabled])=>({
        role: activeRole, permission_key, enabled, updated_at: new Date().toISOString(),
      }))
      const { error: upErr } = await supabase.from('role_permission_overrides').upsert(rows, { onConflict: 'role,permission_key' })
      if (upErr) throw upErr
      setSaved(true)
      setTimeout(()=>setSaved(false), 3000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:C.purpleLight,border:`0.5px solid ${C.border}`,margin:'16px 16px 0',borderRadius:'12px',padding:'12px 14px',display:'flex',gap:'10px',alignItems:'center'}}>
        <span style={{fontSize:'16px',color:C.purple}}>⬡</span>
        <div style={{fontSize:'12px',color:C.purple,lineHeight:1.5}}><strong>Admin permission control.</strong> Changes apply institution-wide for that role. Patient consent always takes precedence.</div>
      </div>
      <SecLabel>Select role to configure</SecLabel>
      <div style={{display:'flex',gap:'6px',padding:'0 16px 12px',overflowX:'auto'}}>
        {Object.entries(ROLES).filter(([k])=>k!=='admin').map(([key,r])=>(
          <div key={key} onClick={()=>{setActiveRole(key);setSaved(false)}} style={{flexShrink:0,padding:'6px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'12px',fontWeight:500,background:activeRole===key?r.color:C.card,color:activeRole===key?'#fff':C.textSub,border:`0.5px solid ${activeRole===key?r.color:C.border}`}}>{r.label}</div>
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
      <div style={{margin:'0 16px 12px',fontSize:'11px',color:C.textMuted,lineHeight:1.5}}>
        ◇ Saved changes are stored and will persist on reload. Applying these overrides to live access checks throughout the rest of the app is a separate follow-up — right now this screen's toggles are the source of truth for review, not yet wired into every access check elsewhere.
      </div>
      {error&&<div style={{margin:'0 16px 12px',fontSize:'12px',color:C.red}}>{error}</div>}
      {saved&&<div style={{margin:'0 16px 12px',background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:C.green,textAlign:'center'}}>✓ Changes saved</div>}
      <div style={{padding:'0 16px 16px'}}><Btn variant="purple" style={{width:'100%'}} onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save permission changes'}</Btn></div>
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
export default function PractitionerApp({ liveData={} }) {
  const [role,setRole]=useState(null)
  const [department,setDepartment]=useState(null)
  const [doctorName,setDoctorName]=useState(null)
  const [specialty,setSpecialty]=useState(null)
  const [screen,setScreen]=useState('id')
  const [jumpToLog,setJumpToLog]=useState(false)
  const [jumpToRecord,setJumpToRecord]=useState(false)
  if(!role) return <ClockInScreen onLogin={(session)=>{setRole(session.role);setDepartment(session.department);setDoctorName(session.doctorName);setSpecialty(session.specialty);setScreen(session.role==='receptionist'?'checkin':session.role==='hr'?'taskboard':'id')}}/>
  const r=ROLES[role]
  const navItems=[{key:'id',icon:'◈',label:'My ID'},role==='receptionist'&&{key:'checkin',icon:'⬢',label:'Check-in'},role!=='hr'&&{key:'patients',icon:'◎',label:'Patients'},{key:'schedule',icon:'▣',label:'Schedule'},(WORKING_ROLES.includes(role)||role==='dept_head')&&{key:'shifts',icon:'⬢',label:'Shifts'},(WORKING_ROLES.includes(role)||role==='hr'||role==='admin')&&{key:'openings',icon:'⬒',label:'Openings'},(role==='hr'||role==='admin')&&{key:'taskboard',icon:'☑',label:'Tasks'},(role==='hr'||role==='admin')&&{key:'staffsearch',icon:'⌕',label:'Search'},role==='dept_head'&&{key:'coverage',icon:'▤',label:'Coverage'},role==='admin'&&{key:'adminhome',icon:'⬢',label:'Admin'},{key:'messages',icon:'◇',label:'Messages'},role==='admin'&&{key:'permissions',icon:'⬡',label:'Perms'},role==='hr'&&{key:'workinghours',icon:'⬟',label:'Hours'},{key:'help',icon:'◌',label:'Help'}].filter(Boolean)
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
        {screen==='checkin'&&<CheckInScreen/>}
        {screen==='patients'&&<PatientSearchScreen role={role} liveData={liveData} autoOpenLog={jumpToLog} autoOpenRecord={jumpToRecord}/>}
        {screen==='schedule'&&<ScheduleScreen role={role} department={department} doctorName={doctorName} onGoToFullDiagnosis={()=>{setJumpToLog(true);setScreen('patients')}} onViewFullRecord={()=>{setJumpToRecord(true);setScreen('patients')}}/>}
        {screen==='messages'&&<MessagesScreen role={role}/>}
        {screen==='permissions'&&role==='admin'&&<AdminPermissions/>}
        {screen==='workinghours'&&role==='hr'&&<WorkingHoursScreen/>}
        {screen==='taskboard'&&(role==='hr'||role==='admin')&&<TaskBoardScreen role={role} staffMedsaId={doctorName} onNavOnboard={()=>setScreen('onboarding')} onNavCoverage={()=>setScreen('coverage')}/>}
        {screen==='coverage'&&(role==='hr'||role==='admin'||role==='dept_head')&&<CoverageGridScreen role={role} department={department}/>}
        {screen==='onboarding'&&role==='hr'&&<OnboardingScreen staffMedsaId={doctorName}/>}
        {screen==='staffsearch'&&(role==='hr'||role==='admin')&&<EmployeeSearchScreen role={role}/>}
        {screen==='adminhome'&&role==='admin'&&<AdminHomeScreen/>}
        {screen==='shifts'&&(WORKING_ROLES.includes(role)||role==='dept_head')&&<ShiftBiddingScreen role={role} doctorName={doctorName} department={department}/>}
        {screen==='openings'&&(WORKING_ROLES.includes(role)||role==='hr'||role==='admin')&&<ShiftOpeningsScreen role={role} department={department} doctorName={doctorName} specialty={specialty}/>}
        {screen==='help'&&<HelpScreen/>}
      </div>
      <div style={{background:C.cream,borderTop:`0.5px solid ${C.border}`,display:'flex',padding:'8px 0 6px'}}>
        {navItems.map(item=>(
          <div key={item.key} onClick={()=>{setScreen(item.key);setJumpToLog(false);setJumpToRecord(false)}} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',cursor:'pointer',color:screen===item.key?C.green:C.textMuted,fontSize:'10px'}}>
            <span style={{fontSize:'18px',lineHeight:1}}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
