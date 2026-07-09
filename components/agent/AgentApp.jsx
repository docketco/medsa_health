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

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000*60*60*24))
}

// ── AGENT LOGIN ───────────────────────────────────────────────────────────
// Captive agents belong to one insurer (like a doctor belongs to one
// clinic). Independent agents are standalone and can hold policies with
// multiple insurers at once - their view aggregates across all of them.
function AgentLogin({ onLogin }) {
  const [agents,setAgents]=useState([])
  const [loading,setLoading]=useState(true)
  const [selected,setSelected]=useState(null)
  const [pin,setPin]=useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('agents').select('*, institutions(name)')
      setAgents(data||[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:420}}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{fontSize:'22px',fontWeight:700,color:C.text}}>Medsa Agent Portal</div>
          <div style={{fontSize:'13px',color:C.textSub,marginTop:'4px'}}>Select your account to sign in</div>
        </div>
        {!selected ? (
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted}}>Loading...</div>}
            {agents.map(a=>(
              <div key={a.id} onClick={()=>setSelected(a)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer'}}>
                <div style={{width:38,height:38,borderRadius:'10px',background:a.agent_type==='captive'?'#ddeae1':'#eeedfe',color:a.agent_type==='captive'?C.green:C.purple,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'14px',flexShrink:0}}>{a.full_name[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'14px',fontWeight:600}}>{a.full_name}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{a.agent_type==='captive'?`Captive - ${a.institutions?.name||'Insurer'}`:'Independent agent'}</div>
                </div>
                <span style={{color:C.textMuted}}>{'\u203a'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'24px'}}>
            <div style={{textAlign:'center',marginBottom:'18px'}}>
              <div style={{width:52,height:52,borderRadius:'12px',background:selected.agent_type==='captive'?'#ddeae1':'#eeedfe',color:selected.agent_type==='captive'?C.green:C.purple,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'18px',margin:'0 auto 10px'}}>{selected.full_name[0]}</div>
              <div style={{fontSize:'15px',fontWeight:600}}>{selected.full_name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{selected.agent_type==='captive'?`Captive - ${selected.institutions?.name||'Insurer'}`:'Independent agent'}</div>
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

function Sidebar({ screen, setScreen, agent, onLogout, navItems }) {
  return (
    <div style={{width:220,flexShrink:0,background:C.cream,borderRight:`0.5px solid ${C.border}`,display:'flex',flexDirection:'column',height:'100vh',position:'sticky',top:0}}>
      <div style={{padding:'20px 18px',borderBottom:`0.5px solid ${C.border}`}}>
        <div style={{fontSize:'16px',fontWeight:700}}>Medsa Agent</div>
        <div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>{agent.agent_type==='captive'?agent.institutions?.name||'Insurer':'Independent'}</div>
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
          <div style={{width:32,height:32,borderRadius:'8px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'13px',flexShrink:0}}>{agent.full_name[0]}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:'12px',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{agent.full_name}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{agent.agent_type==='captive'?'Captive agent':'Independent agent'}</div>
          </div>
        </div>
        <Btn style={{width:'100%',fontSize:'12px'}} onClick={onLogout}>Sign out</Btn>
      </div>
    </div>
  )
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────
function OverviewScreen({ agent, policies, inquiries }) {
  const activeCount = policies.filter(p=>p.status==='active').length
  const renewalsSoon = policies.filter(p=>{ const d=daysUntil(p.renewal_date); return d!==null && d<=30 && d>=0 }).length
  const pendingInquiries = inquiries.filter(i=>i.status==='new').length

  return (
    <PageWrap maxWidth={720}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Overview</h2>
      <div style={{display:'flex',gap:'12px',marginBottom:'24px'}}>
        <StatCard label="Active policies" value={activeCount} sub={agent.agent_type==='captive'?'with your insurer':'across all insurers'} color={C.green} bg={C.greenLight}/>
        <StatCard label="Renewals due soon" value={renewalsSoon} sub="within 30 days" color={C.amber} bg={C.amberLight}/>
        <StatCard label="New claim inquiries" value={pendingInquiries} sub="awaiting response" color={C.blue} bg={C.blueLight}/>
      </div>
      <SecLabel>Recent policies</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {policies.slice(0,5).map((p,i)=>(
          <Card key={i} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:'13px',fontWeight:500}}>{p.patient_name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{p.plan_name}{agent.agent_type==='independent'&&p.institutions?.name?` - ${p.institutions.name}`:''}</div>
            </div>
            <Badge text={p.status} type={p.status==='active'?'ok':p.status==='quote'?'waiting':'due'}/>
          </Card>
        ))}
      </div>
    </PageWrap>
  )
}

// ── POLICIES ──────────────────────────────────────────────────────────────
function PoliciesScreen({ agent, policies, onNewPolicy }) {
  const [filter,setFilter]=useState('all')
  const displayed = filter==='all' ? policies : policies.filter(p=>p.status===filter)

  return (
    <PageWrap maxWidth={720}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h2 style={{fontSize:'20px',fontWeight:700}}>Policies</h2>
        <Btn variant="primary" onClick={onNewPolicy}>+ Issue policy / quote</Btn>
      </div>
      <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
        {[['all','All'],['quote','Quotes'],['active','Active'],['lapsed','Lapsed']].map(([k,l])=>(
          <div key={k} onClick={()=>setFilter(k)} style={{fontSize:'12px',padding:'7px 14px',borderRadius:'20px',cursor:'pointer',background:filter===k?C.green:C.card,color:filter===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {displayed.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>No policies here yet.</div>}
        {displayed.map((p,i)=>{
          const d = daysUntil(p.renewal_date)
          return (
            <Card key={i} style={{padding:'14px 18px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                <div>
                  <div style={{fontSize:'14px',fontWeight:600}}>{p.patient_name}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{p.plan_name} - {p.policy_number||'No policy number yet'}</div>
                  {agent.agent_type==='independent'&&<div style={{fontSize:'11px',color:C.purple,marginTop:'2px'}}>{p.institutions?.name||'Unknown insurer'}</div>}
                </div>
                <Badge text={p.status} type={p.status==='active'?'ok':p.status==='quote'?'waiting':'due'}/>
              </div>
              <div style={{display:'flex',gap:'16px',fontSize:'11px',color:C.textMuted}}>
                <span>Premium: HK${p.premium}/mo</span>
                {p.renewal_date&&<span style={{color:d!==null&&d<=30?C.amber:C.textMuted}}>Renews {new Date(p.renewal_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}{d!==null&&d<=30&&d>=0?` (${d}d)`:''}</span>}
              </div>
            </Card>
          )
        })}
      </div>
    </PageWrap>
  )
}

// ── NEW POLICY / QUOTE ────────────────────────────────────────────────────
// Phase 1: manual entry. The AI-assisted entry mentioned for later would
// pre-fill this form from a signed contract document once that pipeline
// exists - this form is built so that slots in without changing structure.
function NewPolicyScreen({ agent, onBack, onSaved }) {
  const [patientSearch,setPatientSearch]=useState('')
  const [foundPatient,setFoundPatient]=useState(null)
  const [insurers,setInsurers]=useState([])
  const [selectedInsurer,setSelectedInsurer]=useState(agent.agent_type==='captive'?agent.institution_id:null)
  const [planName,setPlanName]=useState('')
  const [policyNumber,setPolicyNumber]=useState('')
  const [premium,setPremium]=useState('')
  const [startDate,setStartDate]=useState('')
  const [renewalDate,setRenewalDate]=useState('')
  const [status,setStatus]=useState('quote')
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)

  useEffect(() => {
    if (agent.agent_type==='independent') {
      supabase.from('institutions').select('id,name').eq('institution_type','insurer').then(({data})=>setInsurers(data||[]))
    }
  }, [agent.agent_type])

  async function searchPatient() {
    if (!patientSearch.trim()) return
    const { data } = await supabase.from('patients').select('id,full_name,medsa_id')
      .or(`medsa_id.ilike.%${patientSearch}%,full_name.ilike.%${patientSearch}%`).limit(1).maybeSingle()
    setFoundPatient(data||null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const { error: insErr } = await supabase.from('agent_policies').insert({
        agent_id: agent.id,
        institution_id: selectedInsurer,
        patient_id: foundPatient?.id || null,
        patient_name: foundPatient?.full_name || patientSearch,
        plan_name: planName,
        policy_number: policyNumber || null,
        status,
        premium: parseFloat(premium) || null,
        start_date: startDate || null,
        renewal_date: renewalDate || null,
      })
      if (insErr) throw insErr
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageWrap maxWidth={560}>
      <div onClick={onBack} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'16px'}}>Back</div>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Issue Policy / Quote</h2>

      <SecLabel>Patient</SecLabel>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
        <input value={patientSearch} onChange={e=>setPatientSearch(e.target.value)} placeholder="Search by name or Medsa ID" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
        <Btn onClick={searchPatient}>Search</Btn>
      </div>
      {foundPatient&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'16px',fontSize:'12px',color:C.green}}>Matched: {foundPatient.full_name} ({foundPatient.medsa_id})</div>}
      {!foundPatient&&patientSearch&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px'}}>No match yet - you can still type the name in manually below and continue without linking a Medsa profile.</div>}

      {agent.agent_type==='independent'&&<>
        <SecLabel>Insurer</SecLabel>
        <select value={selectedInsurer||''} onChange={e=>setSelectedInsurer(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'16px',boxSizing:'border-box'}}>
          <option value="">Select insurer</option>
          {insurers.map(ins=><option key={ins.id} value={ins.id}>{ins.name}</option>)}
        </select>
      </>}

      <SecLabel>Plan details</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'16px'}}>
        <input value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="Plan name" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
        <input value={policyNumber} onChange={e=>setPolicyNumber(e.target.value)} placeholder="Policy number (optional for quotes)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
        <input value={premium} onChange={e=>setPremium(e.target.value)} placeholder="Monthly premium (HK$)" type="number" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:'10px'}}>
          <div style={{flex:1}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Start date</div>
            <input value={startDate} onChange={e=>setStartDate(e.target.value)} type="date" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 10px',fontSize:'13px',boxSizing:'border-box'}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Renewal date</div>
            <input value={renewalDate} onChange={e=>setRenewalDate(e.target.value)} type="date" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 10px',fontSize:'13px',boxSizing:'border-box'}}/>
          </div>
        </div>
      </div>

      <SecLabel>Status</SecLabel>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
        {['quote','active'].map(s=>(
          <div key={s} onClick={()=>setStatus(s)} style={{flex:1,padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:status===s?C.green:C.card,color:status===s?'#fff':C.text,textTransform:'capitalize'}}>{s}</div>
        ))}
      </div>

      <div style={{background:C.blueLight,borderRadius:'8px',padding:'10px 14px',marginBottom:'16px',fontSize:'11px',color:C.blue,lineHeight:1.5}}>
        {'\u25c7'} Manual entry for now. Once a contract is signed and written up, this form is designed to be pre-filled automatically from that document in a future update.
      </div>

      {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
      <Btn variant="primary" style={{width:'100%'}} onClick={handleSave} disabled={saving||!planName||(agent.agent_type==='independent'&&!selectedInsurer)}>{saving?'Saving...':'Save policy'}</Btn>
    </PageWrap>
  )
}

// ── CLAIM INQUIRIES ───────────────────────────────────────────────────────
function ClaimInquiriesScreen({ agent, inquiries, onStatusChange }) {
  const [filter,setFilter]=useState('new')
  const displayed = filter==='all' ? inquiries : inquiries.filter(i=>i.status===filter)

  return (
    <PageWrap maxWidth={680}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Claim Inquiries</h2>
      <div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'20px',fontSize:'12px',color:C.textSub,lineHeight:1.6}}>
        Inquiries arrive here from Medsa's patient claim-prep tool, or can be logged manually if a patient reaches you by phone or external email.
      </div>
      <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
        {[['new','New'],['in_progress','In progress'],['resolved','Resolved'],['all','All']].map(([k,l])=>(
          <div key={k} onClick={()=>setFilter(k)} style={{fontSize:'12px',padding:'7px 14px',borderRadius:'20px',cursor:'pointer',background:filter===k?C.green:C.card,color:filter===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {displayed.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>No inquiries here.</div>}
        {displayed.map((inq,i)=>(
          <Card key={i} style={{padding:'14px 18px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{inq.patient_name}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{inq.source==='medsa_portal'?'Via Medsa portal':'External (email/phone)'} - {new Date(inq.created_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})}</div>
              </div>
              <Badge text={inq.status.replace('_',' ')} type={inq.status==='new'?'due':inq.status==='resolved'?'ok':'waiting'}/>
            </div>
            {inq.notes&&<div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>{inq.notes}</div>}
            <div style={{display:'flex',gap:'8px'}}>
              {inq.status!=='in_progress'&&<Btn style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>onStatusChange(inq.id,'in_progress')}>Mark in progress</Btn>}
              {inq.status!=='resolved'&&<Btn variant="primary" style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>onStatusChange(inq.id,'resolved')}>Mark resolved</Btn>}
            </div>
          </Card>
        ))}
      </div>
    </PageWrap>
  )
}

// ── RENEWALS ──────────────────────────────────────────────────────────────
function RenewalsScreen({ agent, policies }) {
  const withRenewal = policies.filter(p=>p.renewal_date).map(p=>({...p, d:daysUntil(p.renewal_date)})).sort((a,b)=>a.d-b.d)
  const overdue = withRenewal.filter(p=>p.d<0)
  const soon = withRenewal.filter(p=>p.d>=0&&p.d<=30)
  const later = withRenewal.filter(p=>p.d>30)

  function Group({ title, items, color }) {
    if (items.length===0) return null
    return (
      <>
        <SecLabel>{title}</SecLabel>
        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
          {items.map((p,i)=>(
            <Card key={i} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:500}}>{p.patient_name}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{p.plan_name}{agent.agent_type==='independent'&&p.institutions?.name?` - ${p.institutions.name}`:''}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'12px',fontWeight:600,color}}>{p.d<0?`${Math.abs(p.d)}d overdue`:`${p.d}d left`}</div>
                <div style={{fontSize:'11px',color:C.textMuted}}>{new Date(p.renewal_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
              </div>
            </Card>
          ))}
        </div>
      </>
    )
  }

  return (
    <PageWrap maxWidth={680}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Renewal Alerts</h2>
      <div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'20px',fontSize:'12px',color:C.amber,lineHeight:1.6}}>
        {'\u25c7'} Patients see the same renewal countdown on their side of Medsa, so both of you are working from the same date.
      </div>
      <Group title="Overdue" items={overdue} color={C.red}/>
      <Group title="Due within 30 days" items={soon} color={C.amber}/>
      <Group title="Later" items={later} color={C.textSub}/>
      {withRenewal.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>No policies with renewal dates yet.</div>}
    </PageWrap>
  )
}

// ── ROOT ──────────────────────────────────────────────────────────────────
export default function AgentApp() {
  const [agent,setAgent]=useState(null)
  const [screen,setScreen]=useState('overview')
  const [policies,setPolicies]=useState([])
  const [inquiries,setInquiries]=useState([])
  const [loading,setLoading]=useState(true)

  async function loadData(a) {
    setLoading(true)
    // Captive agents only ever see their own insurer's policies.
    // Independent agents see everything tied to their agent_id, spanning
    // whichever insurers they've written business with.
    let query = supabase.from('agent_policies').select('*, institutions(name)').eq('agent_id', a.id)
    const { data: policyRows } = await query
    setPolicies(policyRows||[])

    const { data: inquiryRows } = await supabase.from('agent_claim_inquiries').select('*').eq('agent_id', a.id).order('created_at',{ascending:false})
    setInquiries(inquiryRows||[])
    setLoading(false)
  }

  useEffect(() => {
    if (agent) loadData(agent)
  }, [agent])

  async function handleStatusChange(id, newStatus) {
    setInquiries(prev=>prev.map(i=>i.id===id?{...i,status:newStatus}:i))
    await supabase.from('agent_claim_inquiries').update({ status: newStatus }).eq('id', id)
  }

  const pendingCount = inquiries.filter(i=>i.status==='new').length
  const renewalsSoonCount = policies.filter(p=>{ const d=daysUntil(p.renewal_date); return d!==null && d<=30 }).length

  const navItems = [
    {key:'overview', icon:'\u25a3', label:'Overview'},
    {key:'policies', icon:'\u25c7', label:'Policies'},
    {key:'inquiries', icon:'\u25c9', label:'Claim Inquiries', badge: pendingCount},
    {key:'renewals', icon:'\u25ce', label:'Renewals', badge: renewalsSoonCount},
  ]

  if (!agent) return <AgentLogin onLogin={setAgent}/>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:C.beige,fontFamily:'system-ui, -apple-system, sans-serif'}}>
      <Sidebar screen={screen} setScreen={setScreen} agent={agent} navItems={navItems} onLogout={()=>{setAgent(null);setScreen('overview')}}/>
      <div style={{flex:1,padding:'32px 40px',overflowY:'auto'}}>
        {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted}}>Loading...</div>}
        {!loading&&screen==='overview'&&<OverviewScreen agent={agent} policies={policies} inquiries={inquiries}/>}
        {!loading&&screen==='policies'&&<PoliciesScreen agent={agent} policies={policies} onNewPolicy={()=>setScreen('newpolicy')}/>}
        {!loading&&screen==='newpolicy'&&<NewPolicyScreen agent={agent} onBack={()=>setScreen('policies')} onSaved={()=>{loadData(agent);setScreen('policies')}}/>}
        {!loading&&screen==='inquiries'&&<ClaimInquiriesScreen agent={agent} inquiries={inquiries} onStatusChange={handleStatusChange}/>}
        {!loading&&screen==='renewals'&&<RenewalsScreen agent={agent} policies={policies}/>}
      </div>
    </div>
  )
}
