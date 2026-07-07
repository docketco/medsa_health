import { useState, useEffect } from 'react'
import MedsaLogo from '../shared/MedsaLogo'
import C from '../shared/colours'

function Btn({ children, onClick, variant='secondary', style:sx={}, disabled }) {
  const base={border:'none',borderRadius:'10px',padding:'10px 16px',fontSize:'13px',fontWeight:500,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:disabled?0.5:1,...sx}
  const V={primary:{background:C.green,color:'#fff'},secondary:{background:C.card,color:C.text,border:`0.5px solid ${C.border}`},danger:{background:C.red,color:'#fff'},amber:{background:C.amber,color:'#fff'},navy:{background:C.navy,color:'#fff'}}
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
  return <span style={{fontSize:'10px',background:bg,color:fg,padding:'3px 9px',borderRadius:'20px',fontWeight:500,whiteSpace:'nowrap'}}>{text}</span>
}

// ── EMERGENCY CARD SETUP + CONSENT FLOW ──────────────────────────────────────
// This is shown to PATIENTS only for setup/consent — not for showing to EMS.
// EMS access the emergency card automatically via QR scan in the practitioner portal.
function EmergencyCardSetup({ open, onClose, consented, onConsent, liveConditions=[], liveAllergies=[], liveMedications=[], patient }) {
  const p = patient || { full_name:'Wong Mei-ling, Lisa', medsa_id:'MDS-84921-HK', date_of_birth:'1988-03-14', blood_type:'O+', emergency_contact_name:'Wong Tai', emergency_contact_rel:'Mother', emergency_contact_phone:'+852 9xxx xxxx' }
  const [step, setStep] = useState(consented ? 'view' : 'intro')
  if (!open) return null
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:440,padding:'24px',maxHeight:'90vh',overflowY:'auto'}}>

        {/* Step 1 — intro / not yet consented */}
        {step==='intro'&&<>
          <div style={{textAlign:'center',marginBottom:'20px'}}>
            <div style={{fontSize:'36px',marginBottom:'10px'}}>🛡️</div>
            <div style={{fontSize:'18px',fontWeight:700,color:C.text,marginBottom:'6px'}}>Emergency health card</div>
            <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>When activated, verified emergency personnel can instantly access your critical medical info by scanning your Medsa QR — even if you can't speak or respond.</div>
          </div>
          <div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'14px',padding:'16px',marginBottom:'16px'}}>
            <div style={{fontSize:'12px',fontWeight:600,color:C.green,marginBottom:'10px'}}>What emergency personnel will see:</div>
            {['Blood type','Critical conditions','Severe allergies','Current medications','Emergency contact'].map((item,i)=>(
              <div key={i} style={{fontSize:'13px',color:C.text,padding:'4px 0',display:'flex',alignItems:'center',gap:'8px'}}><span style={{color:C.green,fontSize:'10px'}}>✓</span>{item}</div>
            ))}
          </div>
          <div style={{background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',marginBottom:'16px',fontSize:'12px',color:C.brown,lineHeight:1.6}}>
            ◇ This information is auto-populated from your verified medical records and updates automatically. You cannot selectively hide fields — this ensures accuracy in a life-critical moment. You can deactivate the card at any time.
          </div>
          <Btn variant="primary" style={{width:'100%',marginBottom:'8px',padding:'14px'}} onClick={()=>setStep('consent')}>Set up my emergency card</Btn>
          <Btn style={{width:'100%'}} onClick={onClose}>Not now</Btn>
        </>}

        {/* Step 2 — consent */}
        {step==='consent'&&<>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'16px'}}>One-time consent</div>
          <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'16px',marginBottom:'16px',fontSize:'13px',color:C.text,lineHeight:1.8}}>
            I, <strong>Wong Mei-ling, Lisa</strong>, consent to Medsa making my critical medical information accessible to verified emergency medical personnel (EMS, A&E staff, and Medsa-registered practitioners in an emergency context) via QR scan.<br/><br/>
            I understand that:<br/>
            · This information is sourced from my verified medical records<br/>
            · It updates automatically as my records are updated<br/>
            · I cannot selectively withhold fields from the emergency card<br/>
            · I can deactivate this consent at any time from Settings<br/>
            · Medsa is not liable for information on any physical card I self-complete
          </div>
          <Btn variant="primary" style={{width:'100%',marginBottom:'8px',padding:'14px'}} onClick={()=>{onConsent();setStep('view')}}>I agree — activate my emergency card</Btn>
          <Btn style={{width:'100%'}} onClick={()=>setStep('intro')}>Back</Btn>
        </>}

        {/* Step 3 — active card view (for patient reference) */}
        {step==='view'&&<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <div>
              <div style={{fontSize:'17px',fontWeight:700}}>Emergency card</div>
              <div style={{fontSize:'12px',color:C.green,marginTop:'2px'}}>● Active · Auto-updating from records</div>
            </div>
            <span style={{fontSize:'10px',background:C.greenLight,color:C.green,padding:'3px 10px',borderRadius:'20px',fontWeight:600}}>Consented ✓</span>
          </div>
          <div style={{background:C.redLight,border:`1px solid ${C.red}`,borderRadius:'14px',padding:'16px',marginBottom:'14px'}}>
            <div style={{fontSize:'13px',color:C.red,fontWeight:600,marginBottom:'10px',textTransform:'uppercase',letterSpacing:'0.5px'}}>What EMS sees on scan</div>
            <div style={{fontSize:'16px',fontWeight:700,marginBottom:'2px'}}>{p.full_name}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>DOB {new Date(p.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} · {p.medsa_id}</div>
            <div style={{display:'flex',gap:'10px',marginBottom:'12px'}}>
              <div style={{flex:1,background:'rgba(192,57,43,0.12)',borderRadius:'10px',padding:'10px',textAlign:'center'}}>
                <div style={{fontSize:'10px',color:C.red}}>Blood type</div>
                <div style={{fontSize:'28px',fontWeight:800,color:C.red}}>{p.blood_type}</div>
              </div>
              <div style={{flex:2,background:'rgba(192,57,43,0.12)',borderRadius:'10px',padding:'10px'}}>
                <div style={{fontSize:'10px',color:C.red,marginBottom:'4px'}}>Emergency contact</div>
                <div style={{fontSize:'13px',fontWeight:600}}>Wong Tai (Mother)</div>
                <div style={{fontSize:'12px',color:C.textSub}}>+852 9xxx xxxx</div>
              </div>
            </div>
            {['Type 2 Diabetes','Iron deficiency anaemia','Coronary artery disease'].map((c,i)=>(
              <div key={i} style={{fontSize:'13px',fontWeight:500,padding:'4px 0',borderTop:i===0?`0.5px solid rgba(192,57,43,0.2)`:undefined}}>◎ {c}</div>
            ))}
            <div style={{borderTop:`0.5px solid rgba(192,57,43,0.2)`,marginTop:'8px',paddingTop:'8px'}}>
              {['Penicillin — SEVERE ANAPHYLAXIS','Dust mites — moderate'].map((a,i)=>(
                <div key={i} style={{fontSize:'13px',fontWeight:700,color:C.red,padding:'3px 0'}}>⚠ {a}</div>
              ))}
            </div>
            <div style={{borderTop:`0.5px solid rgba(192,57,43,0.2)`,marginTop:'8px',paddingTop:'8px'}}>
              {['Metformin 500mg — twice daily','Aspirin 100mg — daily','Atorvastatin 20mg — nightly'].map((m,i)=>(
                <div key={i} style={{fontSize:'12px',color:C.textSub,padding:'2px 0'}}>◉ {m}</div>
              ))}
            </div>
          </div>
          <div style={{background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',marginBottom:'14px',fontSize:'12px',color:C.brown,lineHeight:1.5}}>
            ◇ <strong>Physical card:</strong> Medsa provides a blank courtesy card with your QR pre-printed. Fill in fields by hand from the information above. Keep it in your wallet. Note: you are responsible for keeping the handwritten fields accurate. Scanning the QR always retrieves live verified data.
          </div>
          <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
            <button onClick={()=>alert('Add your Medsa Emergency Card to Apple Wallet — coming in Phase 3.')} style={{flex:1,border:'none',borderRadius:'10px',padding:'11px',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',background:'#000',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="white"><path d="M11.5 0C9.6 0 8.8 1 7.5 1 6.2 1 5.2 0 3.5 0 1.6 0 0 1.7 0 4.2c0 3.8 3.2 8.8 5.5 8.8.8 0 1.4-.5 2-.5s1.3.5 2 .5C12 13 15 8.5 15 4.2 15 1.7 13.4 0 11.5 0zM7.5 2.5c-.1-1.2.9-2.3 1.5-2.5.1 1.2-.9 2.3-1.5 2.5z"/></svg>
              Apple Wallet
            </button>
            <button onClick={()=>alert('Add your Medsa Emergency Card to Google Wallet — coming in Phase 3.')} style={{flex:1,border:'0.5px solid #4285f4',borderRadius:'10px',padding:'11px',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',background:'#fff',color:'#4285f4',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#4285f4" strokeWidth="1.5"/><text x="8" y="12" textAnchor="middle" fontSize="9" fill="#4285f4" fontWeight="bold">G</text></svg>
              Google Wallet
            </button>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>alert('Request a physical courtesy card from Medsa — coming soon.')}>Request physical card</Btn>
            <Btn variant="danger" style={{flex:1,fontSize:'12px'}} onClick={()=>{onConsent(false);setStep('intro')}}>Deactivate card</Btn>
          </div>
          <Btn style={{width:'100%',marginTop:'8px'}} onClick={onClose}>Close</Btn>
        </>}
      </div>
    </div>
  )
}

function HomeScreen({ onNav, isEn, onOpenEmergencySetup, emergencyConsented, patient={} }) {
  // Demo queue position — in production this reads from a shared `clinic_queue`
  // Supabase table that both PatientApp and ClinicOpsApp read/write to, so a
  // check-in on the clinic side updates this in real time on the patient side.
  // Right now ClinicOpsApp's queue lives in local React state, not Supabase,
  // so this is illustrative until that table exists.
  const queueStatus = { checkedIn:true, position:2, ticket:'A14', clinic:'Pacific Medical Group', doctor:'Dr Chan Siu-ming' }

  return (
    <div style={{background:C.beige,flex:1,paddingBottom:'20px'}}>

      {/* ── Live queue position — shown only while checked in at a clinic ── */}
      {queueStatus.checkedIn&&(
        <div style={{margin:'14px 16px 0',background:C.navy,borderRadius:'14px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{width:44,height:44,borderRadius:'12px',background:'rgba(255,255,255,0.15)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <div style={{fontSize:'16px',fontWeight:800,color:'#fff',lineHeight:1}}>{queueStatus.position}</div>
            <div style={{fontSize:'8px',color:'rgba(255,255,255,0.7)'}}>{isEn?'ahead':'位在前'}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>{isEn?`${queueStatus.position} people ahead of you`:`您前面有${queueStatus.position}位`}</div>
            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.7)',marginTop:'2px'}}>{queueStatus.ticket} · {queueStatus.clinic} · {queueStatus.doctor}</div>
          </div>
        </div>
      )}

      {/* ── Emergency card reminder banner (shown until consented) ── */}
      {!emergencyConsented&&(
        <div onClick={onOpenEmergencySetup} style={{margin:'14px 16px 0',background:`linear-gradient(135deg,${C.amber} 0%,#c87000 100%)`,borderRadius:'14px',padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{width:36,height:36,background:'rgba(255,255,255,0.2)',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0}}>🛡️</div>
          <div style={{flex:1}}>
            <div style={{fontSize:'13px',fontWeight:700,color:'#fff'}}>{isEn?'Set up your emergency card':'設置緊急健康卡'}</div>
            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)',marginTop:'2px'}}>{isEn?'Let verified EMS access your critical info instantly on scan':'讓緊急人員即時掃描獲取您的關鍵資訊'}</div>
          </div>
          <span style={{color:'rgba(255,255,255,0.8)',fontSize:'18px'}}>›</span>
        </div>
      )}

      {/* ── QR Health Passport — hero element ── */}
      <div style={{margin:'14px 16px 0',background:`linear-gradient(135deg,${C.green} 0%,${C.greenMid} 100%)`,borderRadius:'16px',padding:'20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}}>
          <div>
            <div style={{fontSize:'17px',fontWeight:500,color:'#fff'}}>{isEn?`Good morning, ${patient?.preferred_name||patient?.full_name?.split(',')[1]?.trim()||'Lisa'}`:'早晨，Lisa'}</div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.8)',marginTop:'2px'}}>{isEn?'Your health passport':'您的健康護照'}</div>
            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.6)',marginTop:'6px',letterSpacing:'1px'}}>MDS-84921-HK · Verified ✓</div>
          </div>
          {/* Emergency card status badge */}
          <div onClick={onOpenEmergencySetup} style={{cursor:'pointer'}}>
            {emergencyConsented
              ?<span style={{fontSize:'10px',background:'rgba(255,255,255,0.2)',color:'#fff',padding:'4px 10px',borderRadius:'20px',fontWeight:600,display:'flex',alignItems:'center',gap:'4px'}}><span style={{width:6,height:6,borderRadius:'50%',background:'#7fff7f',display:'inline-block'}}/>Emergency card ✓</span>
              :<span style={{fontSize:'10px',background:'rgba(255,180,0,0.3)',color:'#ffe066',padding:'4px 10px',borderRadius:'20px',fontWeight:600}}>Emergency card — set up ›</span>
            }
          </div>
        </div>
        {/* QR Code — large and centred, the hero */}
        <div style={{background:'#fff',borderRadius:'14px',padding:'20px',display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'}}>
          <svg width="140" height="140" viewBox="0 0 48 48" fill="none">
            <rect x="2" y="2" width="18" height="18" rx="2" fill={C.green}/><rect x="6" y="6" width="10" height="10" rx="1" fill="white"/>
            <rect x="28" y="2" width="18" height="18" rx="2" fill={C.green}/><rect x="32" y="6" width="10" height="10" rx="1" fill="white"/>
            <rect x="2" y="28" width="18" height="18" rx="2" fill={C.green}/><rect x="6" y="32" width="10" height="10" rx="1" fill="white"/>
            <rect x="28" y="28" width="4" height="4" fill={C.green}/><rect x="34" y="28" width="4" height="4" fill={C.green}/>
            <rect x="40" y="28" width="6" height="4" fill={C.green}/><rect x="28" y="34" width="6" height="4" fill={C.green}/>
            <rect x="36" y="34" width="4" height="4" fill={C.green}/><rect x="28" y="40" width="4" height="6" fill={C.green}/>
            <rect x="34" y="42" width="12" height="4" fill={C.green}/>
          </svg>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'12px',fontWeight:600,color:C.text}}>{isEn?'Show this to any Medsa-registered provider':'向任何Medsa註冊醫療人員出示'}</div>
            <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{isEn?'They see what their role permits · You control the rest':'他們只看到其職責所允許的內容'}</div>
          </div>
        </div>
      </div>
      <SecLabel>{isEn?'Your health':'您的健康'}</SecLabel>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',padding:'0 16px'}}>
        {[
          {key:'records',icon:'▣',label:isEn?'Medical records':'醫療記錄',sub:isEn?'History, vaccinations, share':'病歷、疫苗、分享',bg:C.greenLight,badge:null},
          {key:'insurance',icon:'◉',label:isEn?'Insurance':'保險',sub:isEn?'Plans, claims, agents':'計劃、索賠、代理人',bg:C.blueLight,badge:'2'},
          {key:'prescriptions',icon:'◈',label:isEn?'Prescriptions':'處方',sub:isEn?'Meds, drug info':'藥物、資訊',bg:C.brownLight,badge:null},
          {key:'calendar',icon:'◇',label:isEn?'Calendar':'日曆',sub:isEn?'Appointments, alarms':'預約、提醒',bg:C.amberLight,badge:'1'},
        ].map(item=>(
          <div key={item.key} onClick={()=>onNav(item.key)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'16px',cursor:'pointer',position:'relative'}}>
            <div style={{width:36,height:36,background:item.bg,borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',marginBottom:'10px',color:C.green}}>{item.icon}</div>
            <div style={{fontSize:'13px',fontWeight:500,marginBottom:'3px'}}>{item.label}</div>
            <div style={{fontSize:'11px',color:C.textSub,lineHeight:1.4}}>{item.sub}</div>
            {item.badge&&<span style={{position:'absolute',top:10,right:10,background:C.red,color:'#fff',fontSize:'10px',width:18,height:18,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>{item.badge}</span>}
          </div>
        ))}
      </div>
      <SecLabel>{isEn?'Find care & manage':'尋找醫療'}</SecLabel>
      <div style={{padding:'0 16px'}}>
        {[
          {key:'doctors',icon:'◎',bg:C.greenLight,label:isEn?'Doctors & clinics':'醫生與診所',sub:isEn?'Search, book, pay':'搜索、預約、付款'},
          {key:'family',icon:'◇',bg:C.brownLight,label:isEn?'Family & guardians':'家庭與監護',sub:isEn?'Monitor family members · HK$38/mo':'監護家庭成員'},
          {key:'storage',icon:'▣',bg:C.card,label:isEn?'Storage & plan':'儲存與計劃',sub:isEn?'Free · 0.8 GB of 2 GB used':'免費 · 已使用0.8 GB / 2 GB'},
        ].map(item=>(
          <div key={item.key} onClick={()=>onNav(item.key)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:'14px',marginBottom:'10px'}}>
            <div style={{width:40,height:40,background:item.bg,borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.green,flexShrink:0}}>{item.icon}</div>
            <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{item.label}</div><div style={{fontSize:'12px',color:C.textSub}}>{item.sub}</div></div>
            <span style={{color:C.textMuted,fontSize:'18px'}}>›</span>
          </div>
        ))}
      </div>
      <SecLabel>{isEn?'Message board':'訊息板'}</SecLabel>
      <Card>
        <div style={{background:C.greenXLight,padding:'10px 14px',borderBottom:`0.5px solid ${C.border}`,fontSize:'13px',fontWeight:500,color:C.green}}>◈ {isEn?'Alerts & updates':'警報與更新'}</div>
        {[
          {dot:C.red,title:isEn?'Flu season advisory':'流感季節公告',body:isEn?'HKDOH recommends vaccination before Oct 31.':'衞生署建議於10月31日前接種疫苗。'},
          {dot:'#d4a017',title:isEn?'Reminder: Dr Chan — tomorrow 10am':'提醒：陳醫生 — 明天上午10時',body:isEn?'QE Hospital, Room 3B.':'伊利沙伯醫院，3B室。'},
          {dot:C.green,title:isEn?'Insurance claim approved':'保險索賠已批准',body:isEn?'AIA claim #44821 — HK$3,200 approved.':'AIA索賠#44821 — 港幣3,200元已批准。'},
        ].map((m,i)=>(
          <div key={i} style={{padding:'10px 14px',borderBottom:i<2?`0.5px solid ${C.border}`:'none',display:'flex',gap:'10px',alignItems:'flex-start'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:m.dot,marginTop:'5px',flexShrink:0}}/>
            <div><div style={{fontSize:'12px',fontWeight:500}}>{m.title}</div><div style={{fontSize:'11px',color:C.textSub,marginTop:'2px',lineHeight:1.4}}>{m.body}</div></div>
          </div>
        ))}
      </Card>
      <div style={{margin:'0 16px 16px',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'12px 14px',display:'flex',gap:'10px',alignItems:'center'}}>
        <span style={{color:C.brown}}>◇</span>
        <div>
          <div style={{fontSize:'12px',fontWeight:600,color:C.brown}}>{isEn?'You control your records':'您掌控自己的記錄'}</div>
          <div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>{isEn?'Choose what each provider sees — anytime.':'隨時選擇每位醫療提供者可查看的內容。'}</div>
        </div>
      </div>
    </div>
  )
}

function RecordsScreen({ isEn, records=[], conditions=[], vaccinations=[] }) {
  // Use live Supabase data if available, otherwise fall back to demo records
  const hasLiveData = records.length > 0
  const [tab,setTab]=useState('all')
  const [expanded,setExpanded]=useState(null)
  const demoRecords=[
    {id:1,icon:'◎',bg:C.blueLight,title:'Blood panel — full CBC',sub:'Queen Elizabeth Hospital · Lab',date:'12 Jun 2025',src:'Synced',details:[['Haemoglobin','13.8 g/dL ✓'],['WBC','6.2 × 10⁹/L ✓'],['Glucose','5.9 mmol/L ↑'],['Ordered by','Dr Chan Siu-ming']]},
    {id:2,icon:'◈',bg:C.greenLight,title:'General check-up',sub:'Matilda International · Visit',date:'3 May 2025',src:'Synced',details:[['Blood pressure','118/76 mmHg ✓'],['BMI','22.4'],['Heart rate','72 bpm ✓'],['Notes','Mild iron deficiency']]},
    {id:3,icon:'▣',bg:C.amberLight,title:'Chest X-ray',sub:'Ruttonjee Hospital · Imaging',date:'18 Feb 2025',src:'Synced',details:[['Findings','No active TB. Lungs clear.'],['Radiologist','Dr Lam Wai-yee']]},
    {id:4,icon:'◇',bg:C.brownLight,title:'Allergy test results',sub:'Uploaded manually · PDF',date:'9 Jan 2025',src:'Manual',details:[['Penicillin','⚠ Severe allergy'],['Verified by','Pending review']]},
  ]
  const vaccines=[
    {name:'COVID-19',status:'ok',label:'Up to date',doses:[['Dose 1 — BioNTech','12 Mar 2021'],['Dose 2 — BioNTech','3 Apr 2021'],['Booster 1','18 Jan 2022'],['Booster 2 — XBB','9 Oct 2023']]},
    {name:'Influenza (seasonal)',status:'due',label:'Due soon',doses:[['2023–24 Quadrivalent','6 Oct 2023'],['2024–25 — Book now','Recommended']]},
    {name:'Hepatitis B',status:'ok',label:'Complete',doses:[['Dose 1','Jan 1992'],['Dose 2','Mar 1992'],['Dose 3','Jul 1992']]},
    {name:'HPV (Gardasil 9)',status:'ok',label:'Complete',doses:[['Dose 1','5 Sep 2018'],['Dose 2','5 Nov 2018'],['Dose 3','5 Mar 2019']]},
    {name:'Tetanus / Td booster',status:'full',label:'Overdue',doses:[['Last booster','Mar 2013'],['Next due — every 10 yrs','Overdue 2023']]},
  ]
  const providers=[{init:'QE',name:'Queen Elizabeth Hospital',sub:'Medsa partner',on:true},{init:'MIH',name:'Matilda International',sub:'Medsa partner',on:true},{init:'DR',name:'Dr Chan Siu-ming',sub:'Private practitioner',on:true},{init:'VF',name:'Valley Fitness Clinic',sub:'Non-Medsa · Link share',on:false}]
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:C.greenXLight,borderBottom:`0.5px solid ${C.greenLight}`,padding:'10px 16px',display:'flex',gap:'8px',alignItems:'center'}}>
        <span style={{color:C.green}}>◇</span>
        <span style={{fontSize:'12px',color:C.green}}>{isEn?'You control exactly what each provider sees.':'您完全掌控每位醫療提供者可查看的內容。'}</span>
      </div>
      <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`,overflowX:'auto'}}>
        {[['all',isEn?'All records':'所有記錄'],['vax',isEn?'Vaccinations':'疫苗'],['sharing',isEn?'Sharing':'分享'],['upload',isEn?'Upload':'上傳']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'11px 8px',fontSize:'12px',fontWeight:500,color:tab===k?C.green:C.textSub,textAlign:'center',borderBottom:`2px solid ${tab===k?C.green:'transparent'}`,cursor:'pointer',whiteSpace:'nowrap'}}>{l}</div>
        ))}
      </div>
      {tab==='all'&&<>
        <SecLabel>{isEn?'Recent records':'最近記錄'}</SecLabel>
        {(hasLiveData ? records.map(r=>({
          id: r.id,
          icon: r.record_type==='lab'?'◉':r.record_type==='imaging'?'▣':r.record_type==='procedure'?'◇':'◎',
          bg: r.record_type==='lab'?C.blueLight:r.record_type==='imaging'?C.amberLight:r.record_type==='procedure'?C.brownLight:C.greenLight,
          title: r.title,
          sub: `${r.institutions?.name||'Unknown'} · ${r.record_type}`,
          date: new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}),
          src: r.source==='synced'?'Synced':'Manual',
          details: [['Diagnosis',r.diagnosis||'—'],['Notes',r.notes||'—'],['Department',r.department||'—']],
        })) : [
          {id:1,icon:'◎',bg:C.blueLight,title:'Blood panel — full CBC',sub:'Queen Elizabeth Hospital · Lab',date:'12 Jun 2025',src:'Synced',details:[['Haemoglobin','13.8 g/dL ✓'],['WBC','6.2 × 10⁹/L ✓'],['Glucose','5.9 mmol/L ↑'],['Ordered by','Dr Chan Siu-ming']]},
          {id:2,icon:'◈',bg:C.greenLight,title:'General check-up',sub:'Matilda International · Visit',date:'3 May 2025',src:'Synced',details:[['Blood pressure','118/76 mmHg ✓'],['BMI','22.4'],['Heart rate','72 bpm ✓'],['Notes','Mild iron deficiency']]},
          {id:3,icon:'▣',bg:C.amberLight,title:'Chest X-ray',sub:'Ruttonjee Hospital · Imaging',date:'18 Feb 2025',src:'Synced',details:[['Findings','No active TB. Lungs clear.'],['Radiologist','Dr Lam Wai-yee']]},
          {id:4,icon:'◇',bg:C.brownLight,title:'Allergy test results',sub:'Uploaded manually · PDF',date:'9 Jan 2025',src:'Manual',details:[['Penicillin','⚠ Severe allergy'],['Verified by','Pending review']]},
        ]).map(r=>(
          <Card key={r.id} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>
            <div style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
              <div style={{width:38,height:38,borderRadius:'10px',background:r.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',color:C.green,flexShrink:0}}>{r.icon}</div>
              <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{r.title}</div><div style={{fontSize:'12px',color:C.textSub}}>{r.sub}</div></div>
              <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:'11px',color:C.textMuted}}>{r.date}</div><span style={{fontSize:'10px',background:r.src==='Synced'?C.greenLight:C.brownLight,color:r.src==='Synced'?C.green:C.brown,padding:'2px 8px',borderRadius:'20px',fontWeight:500}}>{r.src}</span></div>
            </div>
            {expanded===r.id&&<div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}>
              {r.details.map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}><span style={{color:C.textSub}}>{l}</span><span style={{fontWeight:500}}>{v}</span></div>)}
              <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
                <Btn style={{flex:1,fontSize:'12px'}}>Share</Btn>
                <Btn style={{flex:1,fontSize:'12px'}}>Download</Btn>
                <Btn variant="primary" style={{flex:1,fontSize:'12px'}}>View full</Btn>
              </div>
            </div>}
          </Card>
        ))}
      </>}
      {tab==='vax'&&<>
        <SecLabel>{isEn?'Vaccination passport':'疫苗接種護照'}</SecLabel>
        {vaccines.map(v=>(
          <Card key={v.name}>
            <div style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'14px',fontWeight:500}}>{v.name}</span><Badge text={v.label} type={v.status}/></div>
            <div style={{padding:'0 16px 14px'}}>
              {v.doses.map(([d,date])=>(
                <div key={d} style={{display:'flex',gap:'10px',alignItems:'center',padding:'5px 0',borderTop:`0.5px solid ${C.border}`}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:v.status==='full'?C.amber:C.green,flexShrink:0}}/>
                  <div style={{flex:1,fontSize:'12px',color:C.textSub}}><strong style={{color:C.text}}>{d}</strong></div>
                  <span style={{fontSize:'11px',color:C.textMuted}}>{date}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
        <div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}}>📅 {isEn?'Book overdue vaccinations':'預約逾期疫苗'}</Btn></div>
      </>}
      {tab==='sharing'&&<>
        <SecLabel>{isEn?'Who can see your records':'誰可以查看您的記錄'}</SecLabel>
        <Card>
          {providers.map((p,i)=>(
            <div key={p.init} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center',borderBottom:i<providers.length-1?`0.5px solid ${C.border}`:'none'}}>
              <div style={{width:36,height:36,borderRadius:'10px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:600,flexShrink:0}}>{p.init}</div>
              <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:500}}>{p.name}</div><div style={{fontSize:'11px',color:C.textSub}}>{p.sub}</div></div>
              <Toggle checked={p.on}/>
            </div>
          ))}
        </Card>
        <SecLabel>{isEn?'Record type controls':'記錄類型控制'}</SecLabel>
        <Card>
          {['Lab results','Visit summaries','Imaging','Surgical history','Vaccinations','Mental health records','Allergy info'].map((item,i,arr)=>(
            <div key={item} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}>
              <span>{item}</span><Toggle checked={item!=='Mental health records'&&item!=='Surgical history'}/>
            </div>
          ))}
        </Card>
        <div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}}>◇ {isEn?'Create one-time access link':'建立一次性存取連結'}</Btn></div>
      </>}
      {tab==='upload'&&<>
        <SecLabel>{isEn?'Upload a record':'上傳記錄'}</SecLabel>
        <div style={{margin:'0 16px 10px',border:`1.5px dashed ${C.border}`,borderRadius:'14px',padding:'28px 20px',textAlign:'center',background:C.cream,cursor:'pointer'}}>
          <div style={{fontSize:'32px',color:C.green,marginBottom:'10px'}}>◈</div>
          <div style={{fontSize:'14px',fontWeight:500,marginBottom:'4px'}}>{isEn?'Tap to upload':'點擊上傳'}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>{isEn?'Non-Medsa hospitals, overseas providers, personal files':'非Medsa醫院、海外醫療機構或個人文件'}</div>
          <div style={{display:'flex',gap:'6px',justifyContent:'center',flexWrap:'wrap'}}>
            {['PDF','JPG/PNG','DICOM','CSV'].map(t=><span key={t} style={{fontSize:'10px',background:C.greenLight,color:C.green,padding:'3px 10px',borderRadius:'20px'}}>{t}</span>)}
          </div>
        </div>
        <Card style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
          <div style={{width:36,height:36,borderRadius:'10px',background:C.amberLight,display:'flex',alignItems:'center',justifyContent:'center',color:C.amber,fontSize:'18px'}}>⏳</div>
          <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:500}}>Allergy test results.pdf</div><div style={{fontSize:'11px',color:C.textSub}}>Uploaded 9 Jan · Awaiting verification</div></div>
          <Btn variant="primary" style={{fontSize:'11px',padding:'6px 10px'}}>Send for review</Btn>
        </Card>
      </>}
    </div>
  )
}

// ── VIDEO CONSULTATION MODAL ─────────────────────────────────────────────────
// Matches iMeddy's model: video call + medical certificate/referral issuance
function VideoCallModal({ doc, isEn, onClose }) {
  const [stage,setStage]=useState('connecting') // connecting | active | ended
  const [docsIssued,setDocsIssued]=useState([])

  useEffect(() => {
    if (stage==='connecting') {
      const t = setTimeout(()=>setStage('active'), 1800)
      return () => clearTimeout(t)
    }
  }, [stage])

  if (!doc) return null

  function requestDoc(type) {
    if (!docsIssued.includes(type)) setDocsIssued([...docsIssued, type])
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:400,display:'flex',flexDirection:'column'}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#fff',padding:'24px'}}>
        {stage==='connecting'&&<>
          <div style={{width:80,height:80,borderRadius:'50%',background:C.greenLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',fontWeight:600,color:C.green,marginBottom:'16px'}}>{doc.init}</div>
          <div style={{fontSize:'16px',fontWeight:600,marginBottom:'6px'}}>{doc.name}</div>
          <div style={{fontSize:'13px',opacity:0.7,marginBottom:'24px'}}>{isEn?'Connecting…':'連接中…'}</div>
          <div style={{width:36,height:36,border:'3px solid rgba(255,255,255,0.2)',borderTop:'3px solid #fff',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{position:'absolute',bottom:40}}>
            <Btn variant="danger" onClick={onClose}>{isEn?'Cancel':'取消'}</Btn>
          </div>
        </>}
        {stage==='active'&&<>
          <div style={{width:'100%',maxWidth:360,aspectRatio:'3/4',background:'#1a1a1a',borderRadius:'16px',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'16px',position:'relative'}}>
            <div style={{width:80,height:80,borderRadius:'50%',background:C.greenLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',fontWeight:600,color:C.green}}>{doc.init}</div>
            <div style={{position:'absolute',top:12,right:12,background:'rgba(0,0,0,0.5)',borderRadius:'20px',padding:'4px 10px',fontSize:'11px'}}>● {isEn?'Live':'直播中'}</div>
            <div style={{position:'absolute',bottom:12,left:12,width:56,height:74,background:'#333',borderRadius:'8px',border:'1.5px solid rgba(255,255,255,0.3)'}}/>
          </div>
          <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>{doc.name}</div>
          <div style={{fontSize:'12px',opacity:0.7,marginBottom:'20px'}}>{doc.spec}</div>
          <div style={{display:'flex',gap:'16px'}}>
            <button style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',fontSize:'20px',cursor:'pointer'}}>◉</button>
            <button onClick={()=>setStage('ended')} style={{width:52,height:52,borderRadius:'50%',background:C.red,border:'none',color:'#fff',fontSize:'20px',cursor:'pointer'}}>✕</button>
            <button style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',fontSize:'20px',cursor:'pointer'}}>◈</button>
          </div>
        </>}
        {stage==='ended'&&<div style={{background:C.cream,borderRadius:'16px',padding:'24px',width:'100%',maxWidth:400,color:C.text}}>
          <div style={{textAlign:'center',marginBottom:'16px'}}>
            <div style={{fontSize:'32px',marginBottom:'8px'}}>✓</div>
            <div style={{fontSize:'16px',fontWeight:700}}>{isEn?'Consultation complete':'問診完成'}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginTop:'4px'}}>{doc.name} · {doc.spec}</div>
          </div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px',fontWeight:600}}>{isEn?'Request documents':'索取文件'}</div>
          {[
            {key:'certificate',label:isEn?'Medical certificate':'醫療證明書'},
            {key:'sickleave',label:isEn?'Sick leave note':'病假紙'},
            {key:'referral',label:isEn?'Referral letter':'轉介信'},
          ].map(d=>(
            <div key={d.key} onClick={()=>requestDoc(d.key)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:C.card,borderRadius:'10px',marginBottom:'8px',cursor:'pointer'}}>
              <span style={{fontSize:'13px'}}>{d.label}</span>
              {docsIssued.includes(d.key)
                ?<span style={{fontSize:'11px',color:C.green,fontWeight:600}}>✓ {isEn?'Issued':'已發出'}</span>
                :<span style={{fontSize:'11px',color:C.green}}>{isEn?'Request':'索取'} ›</span>}
            </div>
          ))}
          <Btn variant="primary" style={{width:'100%',marginTop:'8px'}} onClick={onClose}>{isEn?'Done':'完成'}</Btn>
        </div>}
      </div>
    </div>
  )
}

function DoctorsScreen({ isEn }) {
  const [tab,setTab]=useState('search')
  const [selTime,setSelTime]=useState('10:30am')
  const [selLang,setSelLang]=useState('廣東話')
  const [booked,setBooked]=useState(false)
  const [sortBy,setSortBy]=useState('distance')
  const [videoCallDoc,setVideoCallDoc]=useState(null)
  const [whatsappReminder,setWhatsappReminder]=useState(true)
  const doctors=[
    {init:'陳',name:'Dr Chan Siu-ming',spec:'General Practice',clinic:'Pacific Medical Group · Wan Chai',rating:'4.9',avail:'Today',type:'ok',distanceKm:0.8,videoAvail:true},
    {init:'林',name:'Dr Lam Wai-yee',spec:'Cardiologist',clinic:'HK Sanatorium · Happy Valley',rating:'4.8',avail:'Tomorrow',type:'due',distanceKm:3.2,videoAvail:false},
    {init:'黃',name:'Dr Wong Mei-ling',spec:'TCM Practitioner',clinic:'Tong Wah TCM · Sham Shui Po',rating:'4.6',avail:'Today',type:'ok',distanceKm:5.1,videoAvail:true},
    {init:'鄭',name:'Dr Cheng Ka-wai',spec:'Psychiatrist',clinic:'Mind Health HK · Central',rating:'4.9',avail:'Thu',type:'due',distanceKm:1.5,videoAvail:true},
    {init:'李',name:'Dr Lee Tak-shing',spec:'Dentist',clinic:'Smile Dental · Causeway Bay',rating:'4.5',avail:'Fully booked',type:'full',distanceKm:2.1,videoAvail:false},
  ]
  const sortedDoctors = [...doctors].sort((a,b)=>{
    if (sortBy==='distance') return a.distanceKm - b.distanceKm
    if (sortBy==='rating') return parseFloat(b.rating) - parseFloat(a.rating)
    return 0
  })
  const TIMES=['9:00am','9:30am','10:00am','10:30am','11:00am','2:00pm','2:30pm','3:00pm']
  const UNAVAIL=['9:30am','11:00am']
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:C.green,padding:'0 16px 14px'}}>
        <div style={{position:'relative',display:'flex',alignItems:'center'}}>
          <span style={{position:'absolute',left:'10px',fontSize:'16px',color:C.green}}>◎</span>
          <input style={{width:'100%',background:'rgba(255,255,255,0.95)',border:'none',borderRadius:'10px',padding:'10px 12px 10px 34px',fontSize:'14px',outline:'none'}} placeholder={isEn?'Search by name, specialty, clinic…':'按名稱、專科搜尋…'}/>
        </div>
      </div>
      <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`}}>
        {[['search',isEn?'Find doctors':'尋找醫生'],['book',isEn?'Book':'預約'],['payments',isEn?'Payments':'付款']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'11px 8px',fontSize:'12px',fontWeight:500,color:tab===k?C.green:C.textSub,textAlign:'center',borderBottom:`2px solid ${tab===k?C.green:'transparent'}`,cursor:'pointer'}}>{l}</div>
        ))}
      </div>
      {tab==='search'&&<>
        <div style={{padding:'12px 16px 4px',display:'flex',gap:'8px',alignItems:'center'}}>
          <span style={{fontSize:'12px',color:C.textSub}}>{isEn?'Sort by':'排序方式'}</span>
          {[['distance',isEn?'Nearest':'最近'],['rating',isEn?'Top rated':'評分最高']].map(([k,l])=>(
            <div key={k} onClick={()=>setSortBy(k)} style={{fontSize:'11px',padding:'5px 12px',borderRadius:'20px',cursor:'pointer',background:sortBy===k?C.green:C.card,color:sortBy===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
          ))}
        </div>
        <SecLabel>{isEn?'Doctors near you · Wan Chai':'附近的醫生 · 灣仔'}</SecLabel>
        {sortedDoctors.map((doc,i)=>(
          <Card key={i}>
            <div style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
              <div style={{width:48,height:48,borderRadius:'12px',background:C.greenLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:600,color:C.green,flexShrink:0}}>{doc.init}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'14px',fontWeight:500}}>{doc.name}</div>
                <div style={{fontSize:'12px',color:C.green,fontWeight:500}}>{doc.spec}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{doc.clinic}</div>
                <div style={{display:'flex',gap:'8px',marginTop:'4px',alignItems:'center'}}>
                  <span style={{fontSize:'11px',color:C.textMuted}}>◇ {doc.distanceKm}km</span>
                  {doc.videoAvail&&<span style={{fontSize:'10px',background:C.blueLight,color:C.blue,padding:'2px 8px',borderRadius:'20px',fontWeight:500}}>◈ {isEn?'Video available':'視像問診'}</span>}
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:'12px',color:'#d4a017'}}>★★★★★</div><div style={{fontSize:'10px',color:C.textMuted}}>{doc.rating}</div><Badge text={doc.avail} type={doc.type}/></div>
            </div>
            <div style={{borderTop:`0.5px solid ${C.border}`,padding:'10px 16px',display:'flex',gap:'8px'}}>
              <Btn style={{flex:1,fontSize:'12px'}}>Profile</Btn>
              {doc.videoAvail&&<Btn style={{flex:1,fontSize:'12px'}} onClick={()=>setVideoCallDoc(doc)}>◈ Video</Btn>}
              {doc.type==='full'
                ?<Btn variant="primary" style={{flex:1,fontSize:'12px',opacity:0.5}} disabled>Full</Btn>
                :<Btn variant="primary" style={{flex:1,fontSize:'12px'}} onClick={()=>setTab('book')}>Book</Btn>}
            </div>
          </Card>
        ))}
      </>}
      {tab==='book'&&<>
        <SecLabel>{isEn?'New appointment':'新預約'}</SecLabel>
        <Card style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:C.greenLight,color:C.green,fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>✓</div>
          <div><div style={{fontSize:'14px',fontWeight:500}}>Dr Chan Siu-ming</div><div style={{fontSize:'12px',color:C.textSub}}>General Practice · Pacific Medical Group</div></div>
        </Card>
        <Card>
          <div style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}><div style={{width:28,height:28,borderRadius:'50%',background:C.green,color:'#fff',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>2</div><div style={{fontSize:'14px',fontWeight:500}}>{isEn?'Date & time':'日期與時間'}</div></div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}>
            <div style={{display:'flex',gap:'8px',overflowX:'auto',marginBottom:'12px'}}>
              {[['TUE','24',true],['WED','25',false],['THU','26',false],['FRI','27',false],['SAT','28',false]].map(([day,date,sel])=>(
                <div key={day} style={{flexShrink:0,textAlign:'center',padding:'8px 14px',borderRadius:'10px',background:sel?C.green:C.card,color:sel?'#fff':C.text,cursor:'pointer',border:`0.5px solid ${sel?C.green:C.border}`}}>
                  <div style={{fontSize:'10px',opacity:0.8}}>{day}</div><div style={{fontSize:'16px',fontWeight:600}}>{date}</div>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
              {TIMES.map(t=>{const u=UNAVAIL.includes(t);const s=t===selTime;return(
                <div key={t} onClick={()=>!u&&setSelTime(t)} style={{border:`0.5px solid ${s?C.green:C.border}`,borderRadius:'8px',padding:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:u?'not-allowed':'pointer',background:s?C.green:u?C.beige:C.card,color:s?'#fff':u?C.textMuted:C.text,opacity:u?0.5:1}}>{t}</div>
              )})}
            </div>
          </div>
        </Card>
        <Card>
          <div style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}><div style={{width:28,height:28,borderRadius:'50%',background:C.green,color:'#fff',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>3</div><div style={{fontSize:'14px',fontWeight:500}}>{isEn?'Language':'語言'}</div></div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
            {['廣東話','English','普通話','日本語'].map(l=>(
              <div key={l} onClick={()=>setSelLang(l)} style={{border:`0.5px solid ${selLang===l?C.green:C.border}`,borderRadius:'8px',padding:'10px',textAlign:'center',fontSize:'13px',fontWeight:500,cursor:'pointer',background:selLang===l?C.green:C.card,color:selLang===l?'#fff':C.text}}>{l}</div>
            ))}
          </div></div>
        </Card>
        <Card>
          <div style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}><div style={{width:28,height:28,borderRadius:'50%',background:C.green,color:'#fff',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>4</div><div style={{fontSize:'14px',fontWeight:500}}>{isEn?'Confirm & pay':'確認與付款'}</div></div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}>
            <div style={{background:C.greenXLight,borderRadius:'10px',padding:'14px',marginBottom:'12px'}}>
              {[['Doctor','Dr Chan Siu-ming'],['Date',`Tue 24 Jun · ${selTime}`],['Language',selLang],['Consultation fee','HK$380'],['AIA covers','HK$300'],['You pay','HK$80']].map(([l,v],i)=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:'13px'}}><span style={{color:C.green,fontWeight:500}}>{l}</span><span style={{fontWeight:i===5?700:400}}>{v}</span></div>
              ))}
            </div>
            <div onClick={()=>setWhatsappReminder(!whatsappReminder)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:C.card,borderRadius:'10px',marginBottom:'12px',cursor:'pointer'}}>
              <div style={{width:34,height:18,borderRadius:20,background:whatsappReminder?C.green:C.border,position:'relative',flexShrink:0}}>
                <div style={{position:'absolute',top:2,left:whatsappReminder?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:500}}>{isEn?'WhatsApp reminders':'WhatsApp提醒'}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{isEn?'Get appointment reminders via WhatsApp':'透過WhatsApp接收預約提醒'}</div>
              </div>
              <span style={{fontSize:'18px',color:'#25D366'}}>◈</span>
            </div>
            <Btn variant="primary" style={{width:'100%'}} onClick={()=>setBooked(true)}>{isEn?'Confirm appointment':'確認預約'}</Btn>
          </div>
        </Card>
        {booked&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:C.cream,borderRadius:'20px',width:'90%',maxWidth:380,padding:'32px 24px',textAlign:'center'}}>
            <div style={{fontSize:'40px',marginBottom:'12px'}}>✓</div>
            <div style={{fontSize:'18px',fontWeight:700,marginBottom:'8px'}}>{isEn?'Appointment confirmed':'預約已確認'}</div>
            <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.5}}>Dr Chan Siu-ming · Tue 24 Jun at {selTime}</div>
            <Btn variant="primary" style={{width:'100%'}} onClick={()=>setBooked(false)}>Done</Btn>
          </div>
        </div>}
      </>}
      {tab==='payments'&&<>
        <SecLabel>{isEn?'Outstanding':'待付款'}</SecLabel>
        <Card style={{padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><div style={{fontSize:'14px',fontWeight:500}}>Dr Chan — Jun 12</div><Badge text="Due HK$80" type="due"/></div>
          {[['Consultation fee','HK$380'],['AIA covered','−HK$300'],['Balance','HK$80']].map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:'12px',padding:'3px 0'}}><span style={{color:C.textSub}}>{l}</span><span style={{fontWeight:500}}>{v}</span></div>)}
          <div style={{display:'flex',gap:'8px',marginTop:'12px'}}><Btn style={{flex:1,fontSize:'12px'}}>Receipt</Btn><Btn variant="primary" style={{flex:1,fontSize:'12px'}}>Pay HK$80</Btn></div>
        </Card>
        <SecLabel>{isEn?'Recent payments':'最近付款'}</SecLabel>
        {[{title:'Ruttonjee Hospital — Feb 18',amount:'HK$1,200',status:'Paid',type:'ok'},{title:'Matilda International — May 3',amount:'HK$680',status:'Refund pending',type:'due'}].map((p,i)=>(
          <Card key={i} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:'13px',fontWeight:500}}>{p.title}</div></div>
            <div style={{textAlign:'right'}}><div style={{fontSize:'14px',fontWeight:600,color:C.green}}>{p.amount}</div><Badge text={p.status} type={p.type}/></div>
          </Card>
        ))}
      </>}
      <VideoCallModal doc={videoCallDoc} isEn={isEn} onClose={()=>setVideoCallDoc(null)}/>
    </div>
  )
}

function MedAlarmCard({ med, schedule, next, defaultOn, defaultTime, isEn }) {
  const [on,setOn]=useState(defaultOn)
  const [t,setT]=useState(defaultTime)
  return (
    <Card style={{padding:'14px 16px'}}>
      <div style={{display:'flex',gap:'12px',alignItems:'center',marginBottom:on?'12px':'0'}}>
        <div style={{width:36,height:36,borderRadius:'10px',background:C.brownLight,display:'flex',alignItems:'center',justifyContent:'center',color:C.brown,fontSize:'18px'}}>◉</div>
        <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:500}}>{med}</div><div style={{fontSize:'11px',color:C.textSub}}>{schedule} · Next: {next}</div></div>
        <div onClick={()=>setOn(!on)} style={{width:34,height:18,borderRadius:20,background:on?C.green:C.border,cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}><div style={{position:'absolute',top:2,left:on?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/></div>
      </div>
      {on&&<div style={{display:'flex',alignItems:'center',gap:'10px',paddingTop:'10px',borderTop:`0.5px solid ${C.border}`}}>
        <span style={{fontSize:'12px',color:C.textSub}}>{isEn?'Alarm at':'鬧鐘'}</span>
        <input type="time" value={t} onChange={e=>setT(e.target.value)} style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'6px 10px',fontSize:'13px',background:C.beige,outline:'none'}}/>
        <span style={{fontSize:'11px',color:C.green,fontWeight:500}}>● Active</span>
      </div>}
    </Card>
  )
}

function CalendarScreen({ isEn, appointments=[], medications=[] }) {
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:C.cream,border:`0.5px solid ${C.border}`,margin:'16px 16px 0',borderRadius:'14px',padding:'16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
          <span style={{fontSize:'15px',fontWeight:600}}>June 2025</span>
          <div style={{display:'flex',gap:'8px'}}>
            <button style={{background:C.card,border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'14px'}}>‹</button>
            <button style={{background:C.card,border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'14px'}}>›</button>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'8px'}}>
          {['M','T','W','T','F','S','S'].map((d,i)=><div key={i} style={{textAlign:'center',fontSize:'11px',color:C.textMuted,fontWeight:600}}>{d}</div>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px'}}>
          {[16,17,18,19,20,21,22,23,24,25,26,27,28,29].map(d=>(
            <div key={d} style={{textAlign:'center',fontSize:'13px',padding:'6px 2px',borderRadius:'50%',cursor:'pointer',background:d===24?C.green:'transparent',color:d===24?'#fff':(d===25||d===27)?C.green:C.text,fontWeight:d===24?600:400}}>
              {d}
              {(d===25||d===27)&&<div style={{width:4,height:4,borderRadius:'50%',background:C.green,margin:'2px auto 0'}}/>}
            </div>
          ))}
        </div>
      </div>
      <SecLabel>{isEn?'Upcoming':'即將到來'}</SecLabel>
      {appointments.length>0 ? appointments.map((appt,i)=>{
        const dt = new Date(appt.scheduled_at)
        const timeStr = dt.toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})
        const dateStr = dt.toLocaleDateString('en-HK',{weekday:'short',day:'numeric',month:'short',timeZone:'Asia/Hong_Kong'})
        const drName = appt.practitioners?.full_name ? 'Dr '+appt.practitioners.full_name.split(',')[0] : appt.appointment_type
        return(
          <Card key={i} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
            <div style={{width:40,height:40,borderRadius:'12px',background:C.greenLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.green,flexShrink:0}}>◎</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'14px',fontWeight:500}}>{drName}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{appt.institutions?.name||'—'}</div>
              <span style={{fontSize:'10px',background:appt.status==='confirmed'?C.greenLight:C.amberLight,color:appt.status==='confirmed'?C.green:C.amber,padding:'1px 8px',borderRadius:'20px',fontWeight:500}}>{appt.status}</span>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:'12px',fontWeight:600}}>{timeStr}</div>
              <div style={{fontSize:'11px',color:C.textMuted}}>{dateStr}</div>
              {appt.patient_pays>0&&<div style={{fontSize:'11px',color:C.amber}}>HK${appt.patient_pays} due</div>}
            </div>
          </Card>
        )
      }) : [
        {time:'10:30 am',date:'Tue 24 Jun',title:'Dr Chan Siu-ming',sub:'Pacific Medical Group · Wan Chai',bg:C.greenLight,icon:'◎'},
        {time:'8:00 pm',date:'Tue 24 Jun',title:'Metformin 500mg',sub:'Take with dinner · Daily',bg:C.brownLight,icon:'◉'},
        {time:'9:00 am',date:'Fri 27 Jun',title:'Flu vaccine — booking pending',sub:'Pacific Medical Group',bg:C.amberLight,icon:'◈'},
      ].map((e,i)=>(
        <Card key={i} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
          <div style={{width:40,height:40,borderRadius:'12px',background:e.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.green,flexShrink:0}}>{e.icon}</div>
          <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{e.title}</div><div style={{fontSize:'12px',color:C.textSub}}>{e.sub}</div></div>
          <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:'12px',fontWeight:600}}>{e.time}</div><div style={{fontSize:'11px',color:C.textMuted}}>{e.date}</div></div>
        </Card>
      ))}
      <SecLabel>{isEn?'Medication alarms':'用藥鬧鐘'}</SecLabel>
      {medications.length>0 ? medications.filter(m=>m.alarm_enabled||m.alarm_time).map((m,i)=>(
        <MedAlarmCard key={i} med={`${m.medication_name} ${m.dosage||''}`.trim()} schedule={m.frequency||'As prescribed'} next="Check schedule" defaultOn={m.alarm_enabled||false} defaultTime={m.alarm_time?.slice(0,5)||'08:00'} isEn={isEn}/>
      )) : <>
        <MedAlarmCard med="Metformin 500mg" schedule="Daily with dinner" next="Tonight 8pm" defaultOn={true} defaultTime="20:00" isEn={isEn}/>
        <MedAlarmCard med="Vitamin D3 1000IU" schedule="Daily with breakfast" next="Tomorrow 8am" defaultOn={true} defaultTime="08:00" isEn={isEn}/>
        <MedAlarmCard med="Iron supplement 14mg" schedule="Every other day" next="Thu morning" defaultOn={false} defaultTime="09:00" isEn={isEn}/>
      </>}
      <div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}}>+ {isEn?'Add reminder':'新增提醒'}</Btn></div>
    </div>
  )
}

// ── CLAIMS TAB ───────────────────────────────────────────────────────────────
function ClaimsTab({ isEn, claims=[] }) {
  const hasLiveClaims = claims.length > 0
  const [claimType,setClaimType]=useState(null)
  const [checklist,setChecklist]=useState({})
  const [bundleReady,setBundleReady]=useState(false)

  // Documents that already exist in this patient's Medsa records
  // In production these would be queried from the database
  const MEDSA_RECORDS = {
    'Lab results report': {title:'Blood panel — full CBC', date:'12 Jun 2025', institution:'QE Hospital'},
    'Test results report': {title:'Blood panel — full CBC', date:'12 Jun 2025', institution:'QE Hospital'},
    'Lab & imaging reports (if any)': {title:'Chest X-ray + Blood panel', date:'Feb & Jun 2025', institution:'QE Hospital / Ruttonjee'},
    'Prescription copy': {title:'Metformin 500mg + Iron supplement', date:'3 May 2025', institution:'Matilda International'},
    'Diagnosis and treatment notes': {title:'General check-up summary', date:'3 May 2025', institution:'Matilda International'},
    'Patient ID copy': {title:'Wong Mei-ling, Lisa — MDS-84921-HK', date:'On file', institution:'Medsa profile'},
    'Policy number': {title:'AIA Prime Care — Policy #AIA-84921-HK', date:'On file', institution:'Medsa profile'},
  }

  const CLAIM_TYPES=[
    {key:'outpatient',label:'Outpatient visit',icon:'◎',docs:[
      {name:'Consultation receipt',medsa:false},
      {name:'Doctor diagnosis letter or stamp',medsa:false},
      {name:'Patient ID copy',medsa:true},
      {name:'Policy number',medsa:true},
    ]},
    {key:'hospitalisation',label:'Hospitalisation',icon:'▣',docs:[
      {name:'Hospital admission & discharge summary',medsa:false},
      {name:'All receipts and invoices',medsa:false},
      {name:'Doctor report',medsa:false},
      {name:'Lab & imaging reports (if any)',medsa:true},
      {name:'Patient ID copy',medsa:true},
      {name:'Policy number',medsa:true},
    ]},
    {key:'specialist',label:'Specialist consultation',icon:'◈',docs:[
      {name:'Specialist consultation receipt',medsa:false},
      {name:'Referral letter from GP if required',medsa:false},
      {name:'Diagnosis and treatment notes',medsa:true},
      {name:'Patient ID copy',medsa:true},
      {name:'Policy number',medsa:true},
    ]},
    {key:'lab',label:'Lab & imaging',icon:'◉',docs:[
      {name:'Lab or imaging receipt',medsa:false},
      {name:'Test results report',medsa:true},
      {name:'Doctor referral or order',medsa:false},
      {name:'Patient ID copy',medsa:true},
      {name:'Policy number',medsa:true},
    ]},
    {key:'prescription',label:'Prescription / medication',icon:'◇',docs:[
      {name:'Pharmacy receipt',medsa:false},
      {name:'Prescription copy',medsa:true},
      {name:'Doctor diagnosis (if required)',medsa:false},
      {name:'Patient ID copy',medsa:true},
      {name:'Policy number',medsa:true},
    ]},
  ]

  const selectedType = CLAIM_TYPES.find(t=>t.key===claimType)
  // Medsa docs auto-checked, manual docs need patient action
  const getKey = (type,i) => `${type}_${i}`
  const isReady = (doc,key) => doc.medsa || checklist[key]
  const allChecked = selectedType && selectedType.docs.every((doc,i)=>isReady(doc,getKey(claimType,i)))
  const medsaCount = selectedType ? selectedType.docs.filter(d=>d.medsa).length : 0
  const manualCount = selectedType ? selectedType.docs.filter(d=>!d.medsa).length : 0

  return (
    <div>
      {/* Integration notice — greyed out past claims */}
      <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.navy,lineHeight:1.6}}>
        ◈ <strong>Live claim tracking coming with insurer integration.</strong> Once your insurer connects with Medsa, claim submission, status updates, and approvals will sync here automatically.
      </div>

      {/* Greyed out past claims — for reference only */}
      <SecLabel>{isEn?'Past claims (not yet synced)':'過往索賠（尚未同步）'}</SecLabel>
      <div style={{opacity:hasLiveClaims?1:0.4,pointerEvents:hasLiveClaims?'auto':'none'}}>
        {hasLiveClaims ? claims.map((c,i)=>{
          const statusType = c.status==='approved'?'ok':c.status==='rejected'?'full':'due'
          const date = new Date(c.submitted_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})
          return(
            <Card key={i} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:500}}>{c.claim_ref} · {c.institutions?.name||'—'}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{c.insurance_plans?.plan_name||'—'} · {c.claim_type}</div>
                <div style={{fontSize:'11px',color:C.textMuted}}>Submitted {date}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'14px',fontWeight:600,color:C.green}}>HK${c.plan_covers?.toLocaleString()}</div>
                <Badge text={c.status.charAt(0).toUpperCase()+c.status.slice(1)} type={statusType}/>
              </div>
            </Card>
          )
        }) : <>
          <Card style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:'14px',fontWeight:500}}>Matilda International · May 3</div><div style={{fontSize:'12px',color:C.textSub}}>Check-up · HK$680 · Filed directly with AIA</div></div>
            <Badge text="Pending" type="due"/>
          </Card>
          {[{title:'AIA #44821 · Ruttonjee Hospital',amount:'HK$1,200',date:'Feb 18'},{title:'AIA #43910 · Dr Chan consult',amount:'HK$300',date:'Jan 12'}].map((c,i)=>(
            <Card key={i} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontSize:'13px',fontWeight:500}}>{c.title}</div><div style={{fontSize:'11px',color:C.textSub}}>{c.date}</div></div>
              <div style={{textAlign:'right'}}><div style={{fontSize:'14px',fontWeight:600,color:C.green}}>{c.amount}</div><Badge text="Approved" type="ok"/></div>
            </Card>
          ))}
        </>}
      </div>
      {!hasLiveClaims&&<div style={{margin:'-4px 16px 0',fontSize:'11px',color:C.textMuted,textAlign:'center',marginBottom:'8px'}}>These records will sync automatically once your insurer integrates with Medsa</div>}

      {/* Medsa disclaimer */}
      <div style={{margin:'12px 16px 0',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.amber,lineHeight:1.6}}>
        ⚠ <strong>Important:</strong> Document requirements vary by insurer, plan type, and individual claim. The checklist below covers standard requirements — your insurer or agent may request additional documents. Medsa is not liable for incomplete or rejected claims. When in doubt, contact your assigned agent or insurer directly before submitting.
      </div>

      {/* Claim preparation flow */}
      <SecLabel>{isEn?'Prepare a claim package':'準備索賠文件包'}</SecLabel>

      {!claimType&&<>
        <div style={{padding:'0 16px 6px',fontSize:'12px',color:C.textSub}}>Select the type of claim you are preparing:</div>
        {CLAIM_TYPES.map(t=>(
          <Card key={t.key} onClick={()=>{setClaimType(t.key);setChecklist({});setBundleReady(false)}} style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:'14px',cursor:'pointer'}}>
            <div style={{width:40,height:40,background:C.greenLight,borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.green,flexShrink:0}}>{t.icon}</div>
            <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{t.label}</div><div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>{t.docs.length} documents typically required</div></div>
            <span style={{color:C.textMuted,fontSize:'18px'}}>›</span>
          </Card>
        ))}
      </>}

      {claimType&&selectedType&&<>
        <div style={{padding:'0 16px 10px',display:'flex',alignItems:'center',gap:'10px'}}>
          <div onClick={()=>{setClaimType(null);setChecklist({});setBundleReady(false)}} style={{fontSize:'12px',color:C.green,cursor:'pointer'}}>← Change claim type</div>
          <span style={{fontSize:'12px',color:C.textMuted}}>· {selectedType.label}</span>
        </div>

        {/* Auto-attach summary */}
        <div style={{margin:'0 16px 10px',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'12px',padding:'12px 14px'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'4px'}}>◎ {medsaCount} of {selectedType.docs.length} documents auto-attached from your Medsa records</div>
          <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5}}>{manualCount > 0 ? `${manualCount} item${manualCount>1?'s':''} need your attention — marked below.` : 'All documents are ready. You can bundle your claim now.'}</div>
        </div>
        <Card style={{padding:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,marginBottom:'4px'}}>Documents checklist</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'14px',lineHeight:1.5}}>Green items are auto-attached from your Medsa records. Upload or confirm the remaining items.</div>
          {selectedType.docs.map((doc,i)=>{
            const key=getKey(claimType,i)
            const ready=isReady(doc,key)
            const medsaRecord=MEDSA_RECORDS[doc.name]
            return(
              <div key={i} style={{display:'flex',gap:'12px',alignItems:'flex-start',padding:'12px 0',borderBottom:i<selectedType.docs.length-1?`0.5px solid ${C.border}`:'none',background:doc.medsa?C.greenXLight:'transparent',margin:doc.medsa?'0 -16px':undefined,padding:doc.medsa?'12px 16px':'12px 0'}}>
                {/* Checkbox — auto-checked and locked for Medsa records */}
                <div style={{width:22,height:22,borderRadius:6,border:`1.5px solid ${ready?C.green:C.border}`,background:ready?C.green:'transparent',cursor:doc.medsa?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'2px'}}
                  onClick={()=>!doc.medsa&&setChecklist(prev=>({...prev,[key]:!prev[key]}))}>
                  {ready&&<span style={{color:'#fff',fontSize:'12px',fontWeight:700}}>✓</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'13px',fontWeight:500,color:C.text}}>{doc.name}</div>
                  {doc.medsa&&medsaRecord&&<>
                    <div style={{fontSize:'11px',color:C.green,marginTop:'3px',fontWeight:500}}>◎ Auto-attached from Medsa records</div>
                    <div style={{background:'rgba(74,124,89,0.08)',borderRadius:'8px',padding:'8px 10px',marginTop:'6px'}}>
                      <div style={{fontSize:'12px',fontWeight:500,color:C.text}}>{medsaRecord.title}</div>
                      <div style={{fontSize:'11px',color:C.textSub,marginTop:'1px'}}>{medsaRecord.date} · {medsaRecord.institution}</div>
                    </div>
                  </>}
                  {!doc.medsa&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>Upload or confirm you have this ready</div>}
                </div>
                {!doc.medsa&&<div style={{fontSize:'12px',color:C.green,cursor:'pointer',fontWeight:500,flexShrink:0,padding:'4px 10px',border:`0.5px solid ${C.green}`,borderRadius:'8px'}}>Upload</div>}
                {doc.medsa&&<span style={{fontSize:'10px',background:C.greenLight,color:C.green,padding:'2px 8px',borderRadius:'20px',fontWeight:600,flexShrink:0,alignSelf:'center'}}>From Medsa</span>}
              </div>
            )
          })}
        </Card>

        {/* Progress indicator */}
        <div style={{padding:'0 16px 10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>
            <span style={{color:C.green}}>{medsaCount} auto-attached from Medsa</span>
            {allChecked
              ?<span style={{color:C.green,fontWeight:600}}>All documents ready ✓</span>
              :<span>{manualCount - Object.values(checklist).filter(Boolean).length} still needed</span>}
          </div>
          <div style={{height:6,background:C.card,borderRadius:6,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${(selectedType.docs.filter((doc,i)=>isReady(doc,getKey(claimType,i))).length/selectedType.docs.length)*100}%`,background:allChecked?C.green:C.amber,borderRadius:6,transition:'width 0.3s'}}/>
          </div>
          <div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>{selectedType.docs.filter((doc,i)=>isReady(doc,getKey(claimType,i))).length} of {selectedType.docs.length} documents ready</div>
        </div>

        {/* Bundle and submit */}
        <div style={{padding:'0 16px 8px'}}>
          <Btn variant="primary" style={{width:'100%',marginBottom:'8px'}} disabled={!allChecked} onClick={()=>setBundleReady(true)}>
            {allChecked?'Bundle claim package for download':'Complete checklist to bundle'}
          </Btn>
          {bundleReady&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'4px'}}>✓ Claim package ready</div>
            <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5,marginBottom:'10px'}}>Your documents have been bundled. Download the package and submit it directly to your insurer, or hold it ready for when direct submission via Medsa is available.</div>
            <Btn style={{width:'100%',marginBottom:'6px'}}>Download claim package (PDF)</Btn>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>or</div>
              <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'10px',textAlign:'center',opacity:0.5}}>
                <div style={{fontSize:'12px',color:C.textSub,fontWeight:500}}>Submit directly via Medsa</div>
                <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>Available once your insurer integrates with Medsa</div>
              </div>
            </div>
          </div>}
        </div>

        {/* Final disclaimer */}
        <div style={{margin:'0 16px 16px',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.brown,lineHeight:1.6}}>
          ◇ This checklist covers standard requirements. Your insurer or agent may request additional documents specific to your plan or claim. Medsa is a preparation tool only — submission, review, and approval are handled entirely by your insurer. For plan-specific guidance, contact your assigned agent.
        </div>
      </>}
    </div>
  )
}

function InsuranceScreen({ isEn, claims=[] }) {
  const hasLiveClaims = claims.length > 0
  const [tab,setTab]=useState('plans')
  const [expanded,setExpanded]=useState(null)
  const [inquired,setInquired]=useState(null)
  const [anonRating,setAnonRating]=useState(null)
  const [feedbackText,setFeedbackText]=useState('')
  const [feedbackSubmitted,setFeedbackSubmitted]=useState(false)

  const plans=[
    {name:'AIA Prime Care',company:'AIA',type:'Comprehensive',price:'HK$1,200/mo',limit:'HK$1.2M annual',match:98,sponsored:true,
     why:'Covers your diabetes management, outpatient visits, and lab tests. Matches your usage history.',
     covers:['Hospitalisation','Outpatient','Specialist','Labs & imaging','Dental (basic)']},
    {name:'Blue Cross Hospital Plan',company:'Blue Cross',type:'Hospital focus',price:'HK$980/mo',limit:'HK$800K annual',match:87,sponsored:false,
     why:'Strong hospital coverage at lower cost. Good if outpatient is secondary.',
     covers:['Hospitalisation','Specialist','Surgery']},
    {name:'Bupa Gold Cover',company:'Bupa',type:'Premium + travel',price:'HK$2,100/mo',limit:'HK$2M + travel',match:82,sponsored:false,
     why:'Best for frequent travellers. Covers all HK needs plus global emergency care.',
     covers:['Hospitalisation','Outpatient','Travel emergency','Mental health']},
    {name:'AIA Critical Rider',company:'AIA',type:'Critical illness',price:'HK$450/mo',limit:'HK$500K lump sum',match:79,sponsored:true,
     why:'Pays lump sum for critical diagnoses — cancer, heart attack, stroke. Add-on to existing plan.',
     covers:['Critical illness lump sum','57 covered conditions']},
  ]

  return (
    <div style={{background:C.beige,flex:1}}>
      {/* Active plan banner */}
      <div style={{margin:'16px 16px 0',background:`linear-gradient(135deg,#1e3a5f 0%,${C.blue} 100%)`,borderRadius:'16px',padding:'20px',color:'#fff'}}>
        <div style={{fontSize:'11px',opacity:0.7,textTransform:'uppercase',letterSpacing:'1px'}}>AIA Prime Care — Active plan</div>
        <div style={{fontSize:'20px',fontWeight:700,margin:'8px 0 4px'}}>HK$1,200,000</div>
        <div style={{fontSize:'12px',opacity:0.8}}>{isEn?'Annual limit · Renews Jan 2026':'年度限額 · 2026年1月續保'}</div>
        <div style={{display:'flex',gap:'16px',marginTop:'14px'}}>
          <div><div style={{fontSize:'11px',opacity:0.7}}>{isEn?'Used':'已使用'}</div><div style={{fontSize:'16px',fontWeight:600}}>HK$21,400</div></div>
          <div><div style={{fontSize:'11px',opacity:0.7}}>{isEn?'Remaining':'剩餘'}</div><div style={{fontSize:'16px',fontWeight:600}}>HK$1,178,600</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`,marginTop:'12px'}}>
        {[['plans',isEn?'Plans & AI picks':'計劃與AI推薦'],['claims',isEn?'Claims':'索賠'],['agents',isEn?'Agent ratings':'代理人評分']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'11px 4px',fontSize:'11px',fontWeight:500,color:tab===k?C.green:C.textSub,textAlign:'center',borderBottom:`2px solid ${tab===k?C.green:'transparent'}`,cursor:'pointer'}}>{l}</div>
        ))}
      </div>

      {/* ── PLANS & AI ── */}
      {tab==='plans'&&<>
        {/* How Medsa works with insurers — integration story visible in demo */}
        <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px 16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:C.navy,marginBottom:'6px'}}>◈ How Medsa connects you to insurers</div>
          <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.7}}>
            Medsa matches your health profile to publicly listed plans using AI — no questionnaires, no cold calls. When you inquire, your details are forwarded directly to the insurer. Once insurers integrate with Medsa, agent assignment, claims, and status updates will all sync back here automatically — one place for everything health.
          </div>
        </div>

        <div style={{margin:'10px 16px 0',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'14px',padding:'14px 16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'4px'}}>◈ AI plan recommendations</div>
          <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>Based on your verified health records. No agents involved in scoring — purely data-driven. Sponsored plans are clearly labelled and do not affect match scores.</div>
        </div>

        <SecLabel>{isEn?'Recommended for you':'為您推薦'}</SecLabel>
        {plans.map((plan,i)=>(
          <Card key={i} style={{padding:'14px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
                  {plan.sponsored&&<span style={{fontSize:'10px',background:C.amberLight,color:C.amber,padding:'1px 7px',borderRadius:'20px',fontWeight:600}}>Sponsored</span>}
                  <span style={{fontSize:'10px',background:C.card,color:C.textSub,padding:'1px 7px',borderRadius:'20px'}}>{plan.type}</span>
                </div>
                <div style={{fontSize:'15px',fontWeight:700}}>{plan.name}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{plan.company}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:'14px',fontWeight:700,color:C.navy}}>{plan.price}</div>
                <div style={{fontSize:'11px',color:C.textMuted}}>{plan.limit}</div>
              </div>
            </div>
            {/* Match bar */}
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
              <div style={{flex:1,height:5,background:C.card,borderRadius:5,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${plan.match}%`,background:plan.match>=90?C.green:plan.match>=80?C.amber:C.textMuted,borderRadius:5}}/>
              </div>
              <span style={{fontSize:'11px',fontWeight:600,color:plan.match>=90?C.green:plan.match>=80?C.amber:C.textSub}}>{plan.match}% match</span>
            </div>
            <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5,marginBottom:'10px',fontStyle:'italic'}}>"{plan.why}"</div>
            {expanded===i&&<div style={{marginBottom:'10px',display:'flex',gap:'6px',flexWrap:'wrap'}}>
              {plan.covers.map(c=><span key={c} style={{fontSize:'11px',background:C.greenLight,color:C.green,padding:'3px 10px',borderRadius:'20px'}}>{c}</span>)}
            </div>}
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>setExpanded(expanded===i?null:i)}>{expanded===i?'Hide details':'See details'}</Btn>
              {inquired===i
                ?<div style={{flex:1,background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'10px',textAlign:'center',fontSize:'12px',color:C.green,fontWeight:500}}>✓ Enquiry sent</div>
                :<Btn variant="primary" style={{flex:1,fontSize:'12px'}} onClick={()=>setInquired(i)}>Inquire about plan</Btn>}
            </div>
            {/* Post-inquiry confirmation */}
            {inquired===i&&<div style={{marginTop:'10px',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'10px',padding:'12px 14px'}}>
              <div style={{fontSize:'12px',color:C.green,fontWeight:600,marginBottom:'4px'}}>Your enquiry has been forwarded to {plan.company}</div>
              <div style={{fontSize:'11px',color:C.textSub,lineHeight:1.6}}>Their team will be in touch according to their standard response policy. Medsa connects you with insurers and their agents — plan outcomes, agent performance, and claims decisions are the responsibility of {plan.company}.</div>
              <div style={{fontSize:'11px',color:C.textMuted,marginTop:'6px',fontStyle:'italic'}}>Not sure which plans to combine? An agent can help structure your coverage once assigned.</div>
            </div>}
          </Card>
        ))}

        {/* Search all plans */}
        <SecLabel>{isEn?'Search all plans':'搜尋所有計劃'}</SecLabel>
        <div style={{padding:'0 16px 10px'}}>
          <div style={{position:'relative',display:'flex',alignItems:'center'}}>
            <span style={{position:'absolute',left:'10px',fontSize:'16px',color:C.green}}>◎</span>
            <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'10px 12px 10px 34px',fontSize:'13px',background:C.cream,outline:'none',fontFamily:'inherit'}} placeholder={isEn?'Search e.g. dental, travel, critical illness…':'按關鍵字搜尋…'}/>
          </div>
        </div>
        <div style={{padding:'0 16px 16px'}}>
          <div style={{background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.brown,lineHeight:1.6}}>
            ◇ Sponsored plans are clearly labelled. AI match scores are independent of sponsorship. Medsa earns a referral fee from insurers — this does not affect your recommendations.
          </div>
        </div>
      </>}

      {/* ── CLAIMS ── */}
      {tab==='claims'&&<ClaimsTab isEn={isEn} claims={claims}/>}

      {/* ── AGENT RATINGS ── */}
      {tab==='agents'&&<>
        <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px 16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:C.navy,marginBottom:'6px'}}>◈ Agent ratings — coming with insurer integration</div>
          <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.7}}>
            Once your insurer integrates with Medsa, verified agents will appear here with ratings, languages, specialties, and availability. You will be able to browse, choose, and switch agents directly. All ratings are anonymous and based on verified interactions only.
          </div>
        </div>

        {/* Anonymous feedback explainer */}
        <SecLabel>{isEn?'How feedback works':'如何提交評價'}</SecLabel>
        <Card style={{padding:'14px 16px'}}>
          {[
            {icon:'◎',title:'Anonymous by default',body:'Your name is never attached to ratings or comments. Agents and insurers cannot identify who left feedback.'},
            {icon:'◈',title:'Verified interactions only',body:'You can only rate an agent after a confirmed interaction — prevents fake reviews.'},
            {icon:'◇',title:'Separate from complaints',body:'Ratings are public and anonymous. Formal complaints are named, private, and go to the insurer and Medsa support.'},
          ].map((item,i,arr)=>(
            <div key={i} style={{display:'flex',gap:'12px',padding:'10px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>
              <span style={{fontSize:'18px',color:C.green,flexShrink:0}}>{item.icon}</span>
              <div><div style={{fontSize:'13px',fontWeight:500,marginBottom:'3px'}}>{item.title}</div><div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5}}>{item.body}</div></div>
            </div>
          ))}
        </Card>

        {/* Preview of what agent ratings will look like */}
        <SecLabel>{isEn?'Preview — agent ratings once live':'預覽 — 代理人評分上線後'}</SecLabel>
        <div style={{margin:'0 16px',background:C.card,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'16px',opacity:0.6}}>
          <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'12px',textAlign:'center',fontStyle:'italic'}}>This is a preview — agent profiles will be verified and live once your insurer integrates with Medsa</div>
          {[
            {init:'張',name:'Agent A',company:'AIA',rating:4.9,reviews:62,spec:'Health + critical illness',langs:['廣東話','English'],avail:'Available'},
            {init:'李',name:'Agent B',company:'Prudential',rating:4.8,reviews:41,spec:'Family & travel plans',langs:['English','普通話'],avail:'Busy'},
          ].map((a,i)=>(
            <div key={i} style={{display:'flex',gap:'12px',alignItems:'center',padding:'10px 0',borderTop:i>0?`0.5px solid ${C.border}`:'none'}}>
              <div style={{width:40,height:40,borderRadius:'10px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:600,flexShrink:0}}>{a.init}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:500}}>{a.name}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{a.company} · {a.spec}</div>
                <div style={{fontSize:'12px',color:'#d4a017'}}>{'★'.repeat(Math.round(a.rating))} <span style={{fontSize:'11px',color:C.textMuted}}>{a.rating} ({a.reviews})</span></div>
                <div style={{display:'flex',gap:'4px',marginTop:'4px',flexWrap:'wrap'}}>
                  {a.langs.map(l=><span key={l} style={{fontSize:'10px',background:C.greenLight,color:C.green,padding:'1px 7px',borderRadius:'20px'}}>{l}</span>)}
                  <span style={{fontSize:'10px',background:a.avail==='Available'?C.greenLight:C.amberLight,color:a.avail==='Available'?C.green:C.amber,padding:'1px 7px',borderRadius:'20px'}}>{a.avail}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Anonymous feedback form — available now for patients who have interacted */}
        <SecLabel>{isEn?'Leave anonymous feedback':'留下匿名評價'}</SecLabel>
        <Card style={{padding:'16px'}}>
          {!feedbackSubmitted?<>
            <div style={{fontSize:'13px',color:C.textSub,marginBottom:'12px',lineHeight:1.5}}>Had a recent interaction with an agent through Medsa? Leave anonymous feedback — your identity will never be revealed.</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>Your rating:</div>
            <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
              {[1,2,3,4,5].map(n=><div key={n} onClick={()=>setAnonRating(n)} style={{flex:1,textAlign:'center',fontSize:'24px',cursor:'pointer',opacity:anonRating&&anonRating>=n?1:0.25}}>★</div>)}
            </div>
            <textarea value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginBottom:'10px'}} rows={3} placeholder="Optional comment — anonymous, never attributed to you…"/>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>◇ Your name and account details are never stored with this feedback.</div>
            <Btn variant="primary" style={{width:'100%'}} disabled={!anonRating} onClick={()=>setFeedbackSubmitted(true)}>Submit anonymously</Btn>
          </>:<>
            <div style={{textAlign:'center',padding:'16px 0'}}>
              <div style={{fontSize:'28px',marginBottom:'10px'}}>✓</div>
              <div style={{fontSize:'14px',fontWeight:600,color:C.green,marginBottom:'6px'}}>Feedback submitted anonymously</div>
              <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>Thank you. Your feedback helps other patients make informed choices. It will appear on the agent's public profile once insurer integration is live.</div>
            </div>
          </>}
        </Card>

        {/* Complaint vs feedback distinction */}
        <div style={{margin:'0 16px 16px',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.brown,lineHeight:1.6}}>
          ◇ <strong>Feedback is anonymous and public.</strong> If you need to raise a formal complaint about an agent or insurer, use the Help section — complaints are named, private, and directed to Medsa support and the relevant insurer.
        </div>
      </>}
    </div>
  )
}


function PrescriptionsScreen({ isEn, medications=[] }) {
  const hasLiveMeds = medications.length > 0
  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>{isEn?'Active prescriptions':'有效處方'}</SecLabel>
      {(hasLiveMeds ? medications.map((m,idx)=>({
        name:`${m.medication_name} ${m.dosage||''}`.trim(),
        dose:m.frequency||'As prescribed',
        dr:m.prescribed_by||'—',
        refills:`${m.institution||''} · ${m.start_date?'Since '+new Date(m.start_date).toLocaleDateString('en-HK',{month:'short',year:'numeric'}):''}`.trim().replace(/^·\s*/,''),
        icon:['◉','◈','◇','◎','▣'][idx%5],
        bg:[C.greenLight,C.brownLight,C.amberLight,C.blueLight,C.greenLight][idx%5],
      })) : [
        {name:'Metformin 500mg',dose:'1 tablet twice daily with meals',dr:'Dr Chan Siu-ming',refills:'2 refills remaining',icon:'◉',bg:C.greenLight},
        {name:'Vitamin D3 1000IU',dose:'1 capsule daily with breakfast',dr:'Dr Chan Siu-ming',refills:'Auto-refill on',icon:'◈',bg:C.brownLight},
        {name:'Iron supplement 14mg',dose:'1 tablet every other day',dr:'Dr Lam Wai-yee',refills:'1 refill remaining',icon:'◇',bg:C.amberLight},
      ]).map((rx,i)=>(
        <Card key={i}>
          <div style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
            <div style={{width:40,height:40,borderRadius:'12px',background:rx.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.green,flexShrink:0}}>{rx.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'14px',fontWeight:500}}>{rx.name}</div>
              <div style={{fontSize:'12px',color:C.textSub,marginTop:'2px'}}>{rx.dose}</div>
              <div style={{fontSize:'11px',color:C.green,marginTop:'4px'}}>{rx.dr}</div>
              <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{rx.refills}</div>
            </div>
          </div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'10px 16px',display:'flex',gap:'8px'}}>
            <Btn style={{flex:1,fontSize:'12px'}}>Drug info</Btn>
            <Btn style={{flex:1,fontSize:'12px'}}>Interactions</Btn>
            <Btn variant="primary" style={{flex:1,fontSize:'12px'}}>Refill</Btn>
          </div>
        </Card>
      ))}
      <SecLabel>{isEn?'Drug reference':'藥物參考'}</SecLabel>
      <Card style={{padding:'14px 16px'}}>
        <div style={{position:'relative',display:'flex',alignItems:'center'}}>
          <span style={{position:'absolute',left:'10px',fontSize:'16px',color:C.green}}>◎</span>
          <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px 10px 34px',fontSize:'13px',background:C.beige,outline:'none'}} placeholder={isEn?'Search any drug name…':'搜尋任何藥物名稱…'}/>
        </div>
        <div style={{fontSize:'12px',color:C.textSub,marginTop:'10px'}}>{isEn?'Check dosage, interactions, contraindications, and side effects.':'查看劑量、相互作用、禁忌症和副作用。'}</div>
      </Card>
    </div>
  )
}

function FamilyScreen({ isEn }) {
  const members=[
    {name:'Wong Tai (Mum)',relation:'Mother',age:64,type:'Senior',status:'Active',alerts:2},
    {name:'Wong Siu-lok',relation:'Son',age:14,type:'Minor',status:'Active',alerts:0},
    {name:'Uncle Cheung Ho',relation:'Uncle',age:72,type:'Senior',status:'Pending',alerts:1},
  ]
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px 0',background:`linear-gradient(135deg,${C.green} 0%,${C.greenMid} 100%)`,borderRadius:'14px',padding:'16px',color:'#fff'}}>
        <div style={{fontSize:'11px',opacity:0.7,textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>{isEn?'Family guardian plan':'家庭監護計劃'}</div>
        <div style={{fontSize:'16px',fontWeight:700,marginBottom:'2px'}}>Active · HK$38/mo</div>
        <div style={{fontSize:'12px',opacity:0.8}}>{isEn?'Monitoring 2 of 3 members · Renews 1 Jul':'監護3名成員中的2名 · 7月1日續期'}</div>
      </div>
      <SecLabel>{isEn?'Family members':'家庭成員'}</SecLabel>
      {members.map((m,i)=>(
        <Card key={i} style={{padding:'14px 16px'}}>
          <div style={{display:'flex',gap:'12px',alignItems:'center',marginBottom:'10px'}}>
            <div style={{width:40,height:40,borderRadius:'12px',background:m.type==='Minor'?C.blueLight:C.amberLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:600,color:m.type==='Minor'?C.blue:C.amber,flexShrink:0}}>{m.name[0]}</div>
            <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:600}}>{m.name}</div><div style={{fontSize:'12px',color:C.textSub}}>{m.relation} · Age {m.age} · {m.type}</div></div>
            <div style={{textAlign:'right'}}>
              <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',fontWeight:500,background:m.status==='Active'?C.greenLight:C.amberLight,color:m.status==='Active'?C.green:C.amber}}>{m.status}</span>
              {m.alerts>0&&<div style={{fontSize:'11px',color:C.red,marginTop:'4px'}}>⚠ {m.alerts} alert{m.alerts>1?'s':''}</div>}
            </div>
          </div>
          <div style={{background:C.beige,borderRadius:'10px',padding:'10px 12px',marginBottom:'10px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>{isEn?'Guardian access':'監護人存取'}</div>
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
              {['Medication reminders','Appointment alerts','Emergency card','Vitals summary'].map(tag=>(
                <span key={tag} style={{fontSize:'10px',background:C.greenLight,color:C.green,padding:'2px 8px',borderRadius:'20px'}}>{tag}</span>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:'8px'}}><Btn style={{flex:1,fontSize:'12px'}}>View health</Btn><Btn variant="primary" style={{flex:1,fontSize:'12px'}}>Manage access</Btn></div>
        </Card>
      ))}
      <div style={{padding:'0 16px'}}><Btn variant="primary" style={{width:'100%',marginBottom:'10px'}}>+ {isEn?'Add family member':'新增家庭成員'}</Btn></div>
      <div style={{margin:'0 16px 16px',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.brown}}>
        ◇ {isEn?'Guardian access is consent-based. Family members approve via their own Medsa account.':'監護人存取基於同意。家庭成員透過自己的Medsa帳戶批准。'}
      </div>
    </div>
  )
}

function StorageScreen({ isEn, patient={} }) {
  const tiers=[
    {name:'Essential',price:isEn?'Free':'免費',storage:'2 GB',perks:['Emergency health card','Vaccination passport','Basic record storage','1 family member monitor'],current:true,color:C.green,bg:C.greenLight},
    {name:'Personal',price:'HK$18/mo',storage:'20 GB',perks:['Everything in Essential','Full record history','Unlimited uploads','Medication alarms','AI insurance recommendations','Travel health mode'],current:false,color:C.navy,bg:C.navyLight},
    {name:'Family',price:'HK$38/mo',storage:'50 GB shared',perks:['Everything in Personal','Up to 5 family members','Guardian monitoring for seniors/minors','Priority support','Family emergency card'],current:false,color:C.brown,bg:C.brownLight},
  ]
  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>{isEn?'Your storage':'您的儲存空間'}</SecLabel>
      <Card style={{padding:'16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'13px',fontWeight:500}}>Used: 0.8 GB of 2 GB</span><span style={{fontSize:'13px',fontWeight:600,color:C.green}}>40%</span></div>
        <div style={{height:8,background:C.card,borderRadius:8,overflow:'hidden'}}><div style={{height:'100%',width:'40%',background:C.green,borderRadius:8}}/></div>
        <div style={{fontSize:'11px',color:C.textSub,marginTop:'8px'}}>{isEn?'At current rate you\'ll reach your limit in ~14 months.':'按目前速度，約14個月內達到限額。'}</div>
      </Card>
      <SecLabel>{isEn?'Plans':'計劃'}</SecLabel>
      {tiers.map((tier,i)=>(
        <div key={i} style={{background:C.cream,border:`0.5px solid ${tier.current?tier.color:C.border}`,borderRadius:'14px',margin:'0 16px 10px',padding:'16px',position:'relative'}}>
          {tier.current&&<span style={{position:'absolute',top:12,right:12,fontSize:'10px',background:tier.bg,color:tier.color,padding:'2px 10px',borderRadius:'20px',fontWeight:600}}>{isEn?'Current plan':'目前計劃'}</span>}
          <div style={{fontSize:'16px',fontWeight:700,color:tier.color,marginBottom:'2px'}}>{tier.name}</div>
          <div style={{fontSize:'22px',fontWeight:800,color:C.text,marginBottom:'2px'}}>{tier.price}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>{tier.storage} {isEn?'cloud storage':'雲端儲存'}</div>
          <div style={{display:'flex',flexDirection:'column',gap:'5px',marginBottom:'14px'}}>
            {tier.perks.map(p=><div key={p} style={{fontSize:'12px',color:C.text,display:'flex',alignItems:'center',gap:'7px'}}><span style={{color:tier.color,fontSize:'10px'}}>✓</span>{p}</div>)}
          </div>
          {!tier.current&&<button style={{width:'100%',border:'none',background:tier.color,borderRadius:'10px',padding:'11px',fontSize:'13px',fontWeight:500,cursor:'pointer',fontFamily:'inherit',color:'#fff'}}>{isEn?`Upgrade to ${tier.name}`:`升級至${tier.name}`}</button>}
        </div>
      ))}
    </div>
  )
}

export default function PatientApp({ liveData={} }) {
  const patient = liveData.patient || { full_name:'Wong Mei-ling, Lisa', preferred_name:'Lisa', medsa_id:'MDS-84921-HK', date_of_birth:'1988-03-14', blood_type:'O+', emergency_card_active:true, emergency_contact_name:'Wong Tai', emergency_contact_rel:'Mother', emergency_contact_phone:'+852 9xxx xxxx', storage_tier:'essential' }
  const liveRecords = liveData.records || []
  const liveConditions = liveData.conditions || []
  const liveAllergies = liveData.allergies || []
  const liveMedications = liveData.medications || []
  const liveVaccinations = liveData.vaccinations || []
  const liveAppointments = liveData.appointments || []
  const liveClaims = liveData.claims || []
  const [screen,setScreen]=useState('home')
  const [isEn,setIsEn]=useState(true)
  const [emergencyOpen,setEmergencyOpen]=useState(false)
  const [emergencyConsented,setEmergencyConsented]=useState(true) // true = demo state, false = not set up
  const titles={home:'medsa',records:isEn?'Medical records':'醫療記錄',doctors:isEn?'Doctors & clinics':'醫生與診所',calendar:isEn?'Calendar':'日曆',insurance:isEn?'Insurance':'保險',prescriptions:isEn?'Prescriptions':'處方',family:isEn?'Family & guardians':'家庭與監護',storage:isEn?'Storage & plan':'儲存與計劃'}
  const navItems=[{key:'home',icon:'◎',en:'Home',zh:'主頁'},{key:'records',icon:'▣',en:'Records',zh:'記錄'},{key:'doctors',icon:'◈',en:'Find care',zh:'尋找'},{key:'calendar',icon:'◇',en:'Calendar',zh:'日曆'},{key:'insurance',icon:'◉',en:'Insurance',zh:'保險'}]
  return (
    <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',maxWidth:'440px',margin:'0 auto',background:C.beige}}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{background:C.green,padding:'14px 16px',display:'flex',alignItems:'center',gap:'10px',position:'sticky',top:0,zIndex:10}}>
        {screen!=='home'&&<button onClick={()=>setScreen('home')} style={{background:'rgba(255,255,255,0.18)',border:'none',color:'#fff',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</button>}
        {screen==='home'?<MedsaLogo height={20}/>:<span style={{fontSize:'17px',fontWeight:500,color:'#fff'}}>{titles[screen]}</span>}
        <div style={{flex:1}}/>
        <button onClick={()=>setIsEn(!isEn)} style={{background:'rgba(255,255,255,0.18)',border:'none',color:'#fff',fontSize:'11px',padding:'4px 10px',borderRadius:'20px',cursor:'pointer',flexShrink:0}}>{isEn?'廣東話':'EN'}</button>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {screen==='home'&&<HomeScreen onNav={setScreen} isEn={isEn} onOpenEmergencySetup={()=>setEmergencyOpen(true)} emergencyConsented={emergencyConsented} patient={patient}/>}
        {screen==='records'&&<RecordsScreen isEn={isEn} records={liveRecords} conditions={liveConditions} vaccinations={liveVaccinations}/>}
        {screen==='doctors'&&<DoctorsScreen isEn={isEn}/>}
        {screen==='calendar'&&<CalendarScreen isEn={isEn} appointments={liveAppointments} medications={liveMedications}/>}
        {screen==='insurance'&&<InsuranceScreen isEn={isEn} claims={liveClaims}/>}
        {screen==='prescriptions'&&<PrescriptionsScreen isEn={isEn} medications={liveMedications}/>}
        {screen==='family'&&<FamilyScreen isEn={isEn}/>}
        {screen==='storage'&&<StorageScreen isEn={isEn} patient={patient}/>}
      </div>
      <div style={{background:C.cream,borderTop:`0.5px solid ${C.border}`,display:'flex',padding:'8px 0 6px',position:'sticky',bottom:0}}>
        {navItems.map(item=>(
          <div key={item.key} onClick={()=>setScreen(item.key)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',cursor:'pointer',color:screen===item.key?C.green:C.textMuted,fontSize:'10px'}}>
            <span style={{fontSize:'20px',lineHeight:1}}>{item.icon}</span>
            <span>{isEn?item.en:item.zh}</span>
          </div>
        ))}
      </div>
      <EmergencyCardSetup
        open={emergencyOpen}
        onClose={()=>setEmergencyOpen(false)}
        consented={emergencyConsented}
        onConsent={(val=true)=>setEmergencyConsented(val)}
        liveConditions={liveConditions}
        liveAllergies={liveAllergies}
        liveMedications={liveMedications}
        patient={patient}
      />
    </div>
  )
}
