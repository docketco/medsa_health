import { useState } from 'react'
import MedsaLogo from '../shared/MedsaLogo'
import C from '../shared/colours'

function Btn({ children, onClick, variant='secondary', style:sx={}, disabled }) {
  const base={border:'none',borderRadius:'10px',padding:'10px 16px',fontSize:'13px',fontWeight:500,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:disabled?0.5:1,...sx}
  const V={primary:{background:C.green,color:'#fff'},secondary:{background:C.card,color:C.text,border:`0.5px solid ${C.border}`},danger:{background:C.red,color:'#fff'},amber:{background:C.amber,color:'#fff'},navy:{background:C.navy,color:'#fff'}}
  return <button style={{...base,...V[V[variant]?variant:'secondary']}} onClick={onClick} disabled={disabled}>{children}</button>
}
function Card({ children, style:sx={}, onClick }) {
  return <div onClick={onClick} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',margin:'0 16px 10px',overflow:'hidden',cursor:onClick?'pointer':'default',...sx}}>{children}</div>
}
function SecLabel({ children }) {
  return <div style={{fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.9px',color:C.textMuted,padding:'16px 16px 8px'}}>{children}</div>
}
function Badge({ text, type }) {
  const map={ok:[C.greenLight,C.green],due:[C.amberLight,C.amber],full:[C.redLight,C.red]}
  const [bg,fg]=map[type]||map.due
  return <span style={{fontSize:'10px',background:bg,color:fg,padding:'3px 9px',borderRadius:'20px',fontWeight:500,whiteSpace:'nowrap'}}>{text}</span>
}
function StatCard({ icon, label, value, sub, color=C.navy, bg=C.navyLight }) {
  return (
    <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px',flex:1}}>
      <div style={{width:36,height:36,background:bg,borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',color,marginBottom:'10px'}}>{icon}</div>
      <div style={{fontSize:'22px',fontWeight:700,color:C.text}}>{value}</div>
      <div style={{fontSize:'12px',fontWeight:500,color:C.text,marginTop:'2px'}}>{label}</div>
      {sub&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{sub}</div>}
    </div>
  )
}

const PLANS=[
  {name:'AIA Prime Care',price:'HK$1,200/mo',limit:'HK$1.2M annual',type:'Comprehensive',sponsored:true,rating:4.8,clients:12400},
  {name:'AIA Prime Care+',price:'HK$2,800/mo',limit:'HK$3M annual',type:'Premium',sponsored:false,rating:4.9,clients:3200},
  {name:'AIA Critical Rider',price:'HK$450/mo',limit:'HK$500K lump sum',type:'Critical illness',sponsored:true,rating:4.7,clients:8800},
]

const CLAIMS=[
  {id:'CLM-44823',patient:'Wong Mei-ling',agent:'Mr Cheung Ho-fai',plan:'AIA Prime Care',amount:'HK$1,200',status:'Pending',submitted:'22 Jun 2025',decision:null,reason:null},
  {id:'CLM-44810',patient:'Chan Wai-man',agent:'Ms Lee Mei-kwan',plan:'AIA Prime Care',amount:'HK$4,800',status:'Pending',submitted:'21 Jun 2025',decision:null,reason:null},
  {id:'CLM-44801',patient:'Ng Ka-wai',agent:'Mr Cheung Ho-fai',plan:'AIA Prime Care+',amount:'HK$12,400',status:'Approved',submitted:'18 Jun 2025',decision:'Mr Cheung Ho-fai · 20 Jun',reason:null},
  {id:'CLM-44788',patient:'Lam Yee-ting',agent:'Ms Lee Mei-kwan',plan:'AIA Prime Care',amount:'HK$680',status:'Rejected',submitted:'15 Jun 2025',decision:'Ms Lee Mei-kwan · 17 Jun',reason:'Pre-existing condition exclusion'},
]

// ── INSURANCE DASHBOARD ───────────────────────────────────────────────────────
function InsuranceDashboard({ onNav }) {
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px 0',background:`linear-gradient(135deg,${C.navy} 0%,${C.blue} 100%)`,borderRadius:'16px',padding:'20px',color:'#fff'}}>
        <div style={{fontSize:'11px',opacity:0.65,letterSpacing:'1px',textTransform:'uppercase'}}>AIA Insurance — Partner dashboard</div>
        <div style={{fontSize:'18px',fontWeight:700,marginTop:'4px'}}>Good morning, AIA Admin</div>
        <div style={{fontSize:'13px',opacity:0.8,marginTop:'2px'}}>Partner since Jan 2024 · 3 plans listed</div>
      </div>
      <SecLabel>Performance</SecLabel>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',padding:'0 16px'}}>
        <StatCard icon="◎" label="Plan views" value="4,821" sub="this month"/>
        <StatCard icon="◈" label="New clients" value="142" sub="via Medsa referral" color={C.green} bg={C.greenLight}/>
        <StatCard icon="▣" label="Active plans" value="3" sub="listed on Medsa"/>
        <StatCard icon="◇" label="Pending claims" value="2" sub="require attention" color={C.amber} bg={C.amberLight}/>
      </div>
      <SecLabel>Quick access</SecLabel>
      <div style={{padding:'0 16px'}}>
        {[
          {key:'plans',icon:'▣',label:'Manage plans',sub:'Add, edit, sponsor plan listings'},
          {key:'claims',icon:'◇',label:'Claims log',sub:'All claims — pending, approved, rejected'},
          {key:'ads',icon:'⬡',label:'Sponsored listings',sub:'Promote plans in AI recommendations'},
          {key:'analytics',icon:'◈',label:'Analytics',sub:'Views, referrals, conversion'},
        ].map(item=>(
          <div key={item.key} onClick={()=>onNav(item.key)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px 16px',marginBottom:'10px',cursor:'pointer',display:'flex',alignItems:'center',gap:'14px'}}>
            <div style={{width:40,height:40,background:C.navyLight,borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.navy,flexShrink:0}}>{item.icon}</div>
            <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{item.label}</div><div style={{fontSize:'12px',color:C.textSub}}>{item.sub}</div></div>
            <span style={{color:C.textMuted,fontSize:'18px'}}>›</span>
          </div>
        ))}
      </div>
      <div style={{margin:'0 16px 16px',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px'}}>
        <div style={{fontSize:'12px',color:C.brown,fontWeight:600,marginBottom:'4px'}}>How Medsa partner listings work</div>
        <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>Your plans appear in patient searches and AI recommendations. Sponsored plans get priority placement. Medsa charges a listing fee + referral commission. Claims submitted via Medsa are routed to your existing system via webhook.</div>
      </div>
    </div>
  )
}

// ── PLAN MANAGER ──────────────────────────────────────────────────────────────
function PlanManager() {
  const [creating,setCreating]=useState(false)
  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>Your listed plans</SecLabel>
      {PLANS.map((p,i)=>(
        <Card key={i} style={{padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
            <div>
              <div style={{fontSize:'14px',fontWeight:600}}>{p.name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{p.type} · {p.limit}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:'14px',fontWeight:700,color:C.navy}}>{p.price}</div>
              {p.sponsored&&<span style={{fontSize:'10px',background:C.amberLight,color:C.amber,padding:'2px 8px',borderRadius:'20px',fontWeight:600}}>Sponsored</span>}
            </div>
          </div>
          <div style={{display:'flex',gap:'16px',fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>
            <span>★ {p.rating}</span><span>{p.clients.toLocaleString()} clients</span>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1,fontSize:'12px'}}>Edit plan</Btn>
            <Btn variant={p.sponsored?'amber':'secondary'} style={{flex:1,fontSize:'12px'}}>{p.sponsored?'Sponsored ✓':'Sponsor this'}</Btn>
          </div>
        </Card>
      ))}
      {creating&&(
        <Card style={{padding:'16px'}}>
          <div style={{fontSize:'14px',fontWeight:600,marginBottom:'14px'}}>New plan listing</div>
          {[['Plan name','e.g. AIA Gold Health'],['Monthly premium','e.g. HK$1,200'],['Annual limit','e.g. HK$1,200,000'],['Plan type','e.g. Comprehensive, Critical illness']].map(([label,ph])=>(
            <div key={label} style={{marginBottom:'12px'}}>
              <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>{label}</div>
              <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit'}} placeholder={ph}/>
            </div>
          ))}
          <div style={{marginBottom:'12px'}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>What's covered (key benefits)</div>
            <textarea style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none'}} rows={3} placeholder="Hospitalisation, outpatient, specialist, dental…"/>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setCreating(false)}>Cancel</Btn>
            <Btn variant="navy" style={{flex:1}}>Submit plan</Btn>
          </div>
        </Card>
      )}
      {!creating&&<div style={{padding:'0 16px 16px'}}><Btn variant="navy" style={{width:'100%'}} onClick={()=>setCreating(true)}>+ Add new plan</Btn></div>}
    </div>
  )
}

// ── CLAIMS LOG (admin view — cannot approve/reject directly) ──────────────────
function InsuranceAdminClaimsLog() {
  const [filter,setFilter]=useState('All')
  const filtered=filter==='All'?CLAIMS:CLAIMS.filter(c=>c.status===filter)
  const statusStyle={Pending:[C.amberLight,C.amber],Approved:[C.greenLight,C.green],Rejected:[C.redLight,C.red]}
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px'}}>
        <div style={{fontSize:'12px',color:C.navy,lineHeight:1.6}}><strong>Claims flow:</strong> Patient submits → agent notified via link → agent approves or rejects with reason → outcome logged here. Admin can view all and override if needed.</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',padding:'16px 16px 0'}}>
        {[{label:'Pending',value:CLAIMS.filter(c=>c.status==='Pending').length,color:C.amber,bg:C.amberLight},{label:'Approved',value:CLAIMS.filter(c=>c.status==='Approved').length,color:C.green,bg:C.greenLight},{label:'Rejected',value:CLAIMS.filter(c=>c.status==='Rejected').length,color:C.red,bg:C.redLight}].map(s=>(
          <div key={s.label} style={{background:s.bg,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'22px',fontWeight:700,color:s.color}}>{s.value}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:'6px',padding:'12px 16px'}}>
        {['All','Pending','Approved','Rejected'].map(f=>(
          <div key={f} onClick={()=>setFilter(f)} style={{flexShrink:0,padding:'5px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'12px',fontWeight:500,background:filter===f?C.green:C.card,color:filter===f?'#fff':C.textSub,border:`0.5px solid ${filter===f?C.green:C.border}`}}>{f}</div>
        ))}
      </div>
      {filtered.map((c,i)=>{
        const [bg,fg]=statusStyle[c.status]||statusStyle.Pending
        return (
          <Card key={i} style={{padding:'14px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{c.patient}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{c.plan}</div>
                <div style={{fontSize:'11px',color:C.textMuted}}>Agent: {c.agent}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'15px',fontWeight:700,color:C.navy}}>{c.amount}</div>
                <span style={{fontSize:'10px',background:bg,color:fg,padding:'2px 8px',borderRadius:'20px',fontWeight:600}}>{c.status}</span>
              </div>
            </div>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Submitted {c.submitted} · {c.id}</div>
            {c.decision&&(
              <div style={{background:c.status==='Approved'?C.greenXLight:C.redLight,borderRadius:'8px',padding:'8px 12px',fontSize:'12px',color:c.status==='Approved'?C.green:C.red,marginBottom:'8px'}}>
                {c.status==='Approved'?'✓':'✗'} Decision by {c.decision}
                {c.reason&&<div style={{marginTop:'2px',fontWeight:500}}>Reason: {c.reason}</div>}
              </div>
            )}
            {c.status==='Pending'&&(
              <div style={{display:'flex',gap:'8px'}}>
                <Btn style={{flex:1,fontSize:'11px',padding:'7px'}}>Send reminder to agent</Btn>
                <Btn variant="primary" style={{flex:1,fontSize:'11px',padding:'7px'}}>Admin override</Btn>
              </div>
            )}
            {c.status==='Rejected'&&(
              <div style={{display:'flex',gap:'8px'}}>
                <Btn style={{flex:1,fontSize:'11px',padding:'7px'}}>View full claim</Btn>
                <Btn variant="primary" style={{flex:1,fontSize:'11px',padding:'7px'}}>Override rejection</Btn>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ── AGENT CLAIM VIEW (standalone page sent to agents via link) ────────────────
export function AgentClaimView() {
  const [decision,setDecision]=useState(null)
  const [reason,setReason]=useState('')
  const [submitted,setSubmitted]=useState(false)
  const claim={id:'CLM-44823',patient:'Wong Mei-ling, Lisa',patientId:'MDS-84921-HK',plan:'AIA Prime Care',agent:'Mr Cheung Ho-fai',submitted:'22 Jun 2025, 14:32',type:'Outpatient + lab tests',institution:'Queen Elizabeth Hospital',amount:'HK$1,200',planCovers:'HK$1,000',patientPays:'HK$200',notes:'Patient referred by Dr Chan for routine diabetic monitoring. Blood panel and glucose tolerance test conducted.'}
  const REJECT_REASONS=['Not covered under current plan','Pre-existing condition exclusion','Missing supporting documents','Treatment not pre-authorised','Duplicate claim','Other (specify below)']
  if(submitted) return (
    <div style={{background:C.beige,flex:1,padding:'32px 20px',textAlign:'center'}}>
      <div style={{fontSize:'40px',marginBottom:'16px'}}>{decision==='approve'?'✓':'◎'}</div>
      <div style={{fontSize:'18px',fontWeight:700,color:decision==='approve'?C.green:C.red,marginBottom:'8px'}}>Claim {decision==='approve'?'approved':'rejected'}</div>
      <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6,marginBottom:'16px'}}>{decision==='approve'?`${claim.patient} will be notified. Payment processes in 3–5 business days.`:`${claim.patient} will be notified with the rejection reason. They can appeal within 30 days.`}</div>
      <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',textAlign:'left'}}>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Logged to admin portal</div>
        <div style={{fontSize:'13px',fontWeight:500}}>Claim {claim.id} · {decision==='approve'?'Approved':'Rejected'}</div>
        {reason&&<div style={{fontSize:'12px',color:C.textSub,marginTop:'4px'}}>Reason: {reason}</div>}
        <div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>by {claim.agent}</div>
      </div>
    </div>
  )
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:C.navy,padding:'20px 16px',color:'#fff'}}>
        <div style={{fontSize:'11px',opacity:0.6,letterSpacing:'1px',textTransform:'uppercase',marginBottom:'4px'}}>Claim review · {claim.id}</div>
        <div style={{fontSize:'18px',fontWeight:700}}>{claim.patient}</div>
        <div style={{fontSize:'12px',opacity:0.8,marginTop:'2px'}}>{claim.plan} · Submitted {claim.submitted}</div>
      </div>
      <SecLabel>Claim details</SecLabel>
      <Card style={{padding:'0 16px'}}>
        {[['Claim ID',claim.id],['Patient',claim.patient],['Medsa ID',claim.patientId],['Claim type',claim.type],['Institution',claim.institution],['Total amount',claim.amount],['Plan covers',claim.planCovers],['Patient pays',claim.patientPays]].map(([l,v],i,arr)=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}><span style={{color:C.textSub}}>{l}</span><span style={{fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{v}</span></div>
        ))}
      </Card>
      <SecLabel>Clinical notes</SecLabel>
      <Card style={{padding:'14px 16px'}}>
        <div style={{fontSize:'13px',color:C.text,lineHeight:1.6,fontStyle:'italic'}}>"{claim.notes}"</div>
      </Card>
      <SecLabel>Supporting documents</SecLabel>
      <Card style={{padding:'12px 16px'}}>
        {['Lab report — Blood panel CBC (QE Hospital 12 Jun)','Receipt — Consultation HK$380','Receipt — Lab tests HK$820'].map((doc,i,arr)=>(
          <div key={i} style={{padding:'8px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'13px',color:C.text}}>{doc}</span>
            <span style={{fontSize:'12px',color:C.green,cursor:'pointer',fontWeight:500}}>View</span>
          </div>
        ))}
      </Card>
      <SecLabel>Your decision</SecLabel>
      <div style={{padding:'0 16px',display:'flex',gap:'10px',marginBottom:'12px'}}>
        <div onClick={()=>setDecision('approve')} style={{flex:1,border:`1.5px solid ${decision==='approve'?C.green:C.border}`,background:decision==='approve'?C.greenXLight:C.cream,borderRadius:'12px',padding:'14px',textAlign:'center',cursor:'pointer'}}>
          <div style={{fontSize:'20px',marginBottom:'4px'}}>✓</div>
          <div style={{fontSize:'13px',fontWeight:600,color:decision==='approve'?C.green:C.textSub}}>Approve</div>
          <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>Pay {claim.planCovers}</div>
        </div>
        <div onClick={()=>setDecision('reject')} style={{flex:1,border:`1.5px solid ${decision==='reject'?C.red:C.border}`,background:decision==='reject'?C.redLight:C.cream,borderRadius:'12px',padding:'14px',textAlign:'center',cursor:'pointer'}}>
          <div style={{fontSize:'20px',marginBottom:'4px'}}>◎</div>
          <div style={{fontSize:'13px',fontWeight:600,color:decision==='reject'?C.red:C.textSub}}>Reject</div>
          <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>With reason</div>
        </div>
      </div>
      {decision==='reject'&&(
        <div style={{padding:'0 16px 12px'}}>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px',fontWeight:500}}>Select rejection reason</div>
          {REJECT_REASONS.map((r,i)=>(
            <div key={i} onClick={()=>setReason(r)} style={{border:`0.5px solid ${reason===r?C.red:C.border}`,background:reason===r?C.redLight:C.cream,borderRadius:'10px',padding:'10px 14px',marginBottom:'6px',cursor:'pointer',fontSize:'13px',fontWeight:reason===r?500:400,color:reason===r?C.red:C.text}}>{r}</div>
          ))}
          {reason==='Other (specify below)'&&(
            <textarea style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginTop:'6px'}} rows={3} placeholder="Specify reason…" onChange={e=>setReason(e.target.value)}/>
          )}
        </div>
      )}
      {decision&&(
        <div style={{padding:'0 16px 24px'}}>
          <button onClick={()=>{if(decision==='approve'||reason)setSubmitted(true)}} style={{width:'100%',border:'none',background:decision==='approve'?C.green:C.red,borderRadius:'10px',padding:'14px',fontSize:'14px',fontWeight:500,cursor:'pointer',color:'#fff',fontFamily:'inherit'}}>
            {decision==='approve'?`Approve · ${claim.planCovers}`:'Reject claim'}
          </button>
          {decision==='reject'&&!reason&&<div style={{fontSize:'11px',color:C.amber,textAlign:'center',marginTop:'8px'}}>Please select a rejection reason before submitting.</div>}
        </div>
      )}
    </div>
  )
}

// ── SPONSORED LISTINGS ────────────────────────────────────────────────────────
function SponsoredListings() {
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'16px'}}>
        <div style={{fontSize:'14px',fontWeight:600,color:C.navy,marginBottom:'6px'}}>⬡ Sponsored placements</div>
        <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>Sponsored plans appear at the top of patient searches and are included in Medsa's AI recommendations. You set a monthly budget and pay per referral click.</div>
      </div>
      <SecLabel>Active sponsorships</SecLabel>
      {[{plan:'AIA Prime Care',placement:'AI recommendations + search top',budget:'HK$5,000/mo',clicks:284,cpc:'HK$17.6'},{plan:'AIA Critical Rider',placement:'Search top only',budget:'HK$2,000/mo',clicks:91,cpc:'HK$22.0'}].map((s,i)=>(
        <Card key={i} style={{padding:'14px 16px'}}>
          <div style={{fontSize:'14px',fontWeight:500,marginBottom:'4px'}}>{s.plan}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>{s.placement}</div>
          <div style={{display:'flex',gap:'16px',fontSize:'12px',marginBottom:'12px'}}>
            <span style={{color:C.textSub}}>Budget: <strong style={{color:C.text}}>{s.budget}</strong></span>
            <span style={{color:C.textSub}}>Clicks: <strong style={{color:C.text}}>{s.clicks}</strong></span>
            <span style={{color:C.textSub}}>CPC: <strong style={{color:C.text}}>{s.cpc}</strong></span>
          </div>
          <Btn style={{width:'100%',fontSize:'12px'}}>Edit sponsorship</Btn>
        </Card>
      ))}
      <SecLabel>Add sponsorship to a plan</SecLabel>
      <Card style={{padding:'16px'}}>
        {[['Select plan','AIA Prime Care+'],['Placement','AI recommendations'],['Monthly budget','HK$3,000']].map(([l,ph])=>(
          <div key={l} style={{marginBottom:'12px'}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>{l}</div>
            <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit'}} placeholder={ph}/>
          </div>
        ))}
        <Btn variant="navy" style={{width:'100%'}}>Launch sponsorship</Btn>
      </Card>
    </div>
  )
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
export default function InsuranceApp() {
  const [screen,setScreen]=useState('dashboard')
  const titles={dashboard:'Insurance partner',plans:'Plan listings',claims:'Claims log',ads:'Sponsored listings',analytics:'Analytics'}
  const navItems=[{key:'dashboard',icon:'◈',label:'Overview'},{key:'plans',icon:'▣',label:'Plans'},{key:'claims',icon:'◇',label:'Claims'},{key:'ads',icon:'⬡',label:'Sponsored'},{key:'analytics',icon:'◎',label:'Analytics'}]
  return (
    <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',maxWidth:'440px',margin:'0 auto',background:C.beige}}>
      <div style={{background:C.navy,padding:'14px 16px',display:'flex',alignItems:'center',gap:'10px',position:'sticky',top:0,zIndex:10}}>
        {screen!=='dashboard'&&<button onClick={()=>setScreen('dashboard')} style={{background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>}
        <MedsaLogo height={20}/>
        <span style={{flex:1,fontSize:'13px',color:'rgba(255,255,255,0.7)',fontWeight:500}}>{titles[screen]}</span>
        <span style={{fontSize:'10px',background:C.navyLight,color:C.navy,padding:'3px 9px',borderRadius:'20px',fontWeight:600}}>⬡ AIA</span>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {screen==='dashboard'&&<InsuranceDashboard onNav={setScreen}/>}
        {screen==='plans'&&<PlanManager/>}
        {screen==='claims'&&<InsuranceAdminClaimsLog/>}
        {screen==='ads'&&<SponsoredListings/>}
        {screen==='analytics'&&<div style={{padding:'40px 24px',textAlign:'center',color:C.textSub}}><div style={{fontSize:'32px',marginBottom:'12px'}}>◈</div><div style={{fontSize:'16px',fontWeight:600,marginBottom:'6px',color:C.text}}>Analytics</div><div style={{fontSize:'13px'}}>Views, referrals, and conversion data — coming in the next build.</div></div>}
      </div>
      <div style={{background:C.cream,borderTop:`0.5px solid ${C.border}`,display:'flex',padding:'8px 0 6px'}}>
        {navItems.map(item=>(
          <div key={item.key} onClick={()=>setScreen(item.key)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',cursor:'pointer',color:screen===item.key?C.navy:C.textMuted,fontSize:'10px'}}>
            <span style={{fontSize:'18px',lineHeight:1}}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
