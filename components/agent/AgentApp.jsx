import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import C from '../shared/colours'
import TermsAgreementModal from '../shared/TermsAgreementModal'
import { REFERRAL_FEE_ENABLED } from '../../lib/featureFlags'

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
// Real login - this used to be "pick your name off a public list of
// every agent in the system, type a PIN" with the PIN never actually
// checked (Sign in fired regardless of what was typed). Same
// email+password pattern already fixed this session for external
// clinics and insurance companies.
function AgentLogin({ onLogin }) {
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [checking,setChecking]=useState(false)
  const [error,setError]=useState(null)

  async function handleLogin() {
    setChecking(true)
    setError(null)
    const { data: agent } = await supabase.from('agents')
      .select('id, full_name, agent_type, institution_id, team_id, medsa_id, institutions(name)')
      .ilike('email', email.trim()).maybeSingle()
    if (!agent) { setChecking(false); setError('No agent account matches that email.'); return }
    const { data: ok } = await supabase.rpc('verify_agent_password', { p_agent_id: agent.id, p_password: password })
    setChecking(false)
    if (!ok) { setError('Incorrect password.'); return }
    onLogin(agent)
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{fontSize:'22px',fontWeight:700,color:C.text}}>Medsa Agent Portal</div>
          <div style={{fontSize:'13px',color:C.textSub,marginTop:'4px'}}>Sign in with your agent account</div>
        </div>
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'20px'}}>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'14px',boxSizing:'border-box'}}/>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={handleLogin} disabled={checking||!email||!password}>{checking?'Checking\u2026':'Sign in'}</Btn>
        </div>
        <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginTop:'16px',lineHeight:1.5}}>No account yet? Your institution or team lead onboards you - not self-serve.</div>
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
        {/* Real gap reported live-testing: this was here, but as 10px
            muted grey text easy to miss entirely against everything else
            in the sidebar header - a real ID with nothing marking it as
            one. Same small-badge treatment used for a company's own
            Medsa ID elsewhere in the app. */}
        {agent.medsa_id&&<div style={{display:'inline-block',marginTop:'6px',fontSize:'10px',fontWeight:600,color:C.green,background:C.greenXLight,padding:'2px 8px',borderRadius:'20px'}}>Medsa ID: {agent.medsa_id}</div>}
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
// Agent-initiated: "I want to hand this client to a teammate" - distinct
// from the patient-initiated switch_requested_at flag elsewhere (that one
// creates a fresh inquiry while this policy keeps running uninterrupted;
// this is the agent's own side of a handoff, and needs the team lead to
// approve it before the policy's agent_id actually changes).
function TransferRequestModal({ policy, agent, onClose, onRequested }) {
  const [teammates,setTeammates]=useState([])
  const [toAgentId,setToAgentId]=useState('')
  const [reason,setReason]=useState('')
  const [saving,setSaving]=useState(false)

  useEffect(() => {
    if (!policy) return
    supabase.from('agent_institution_appointments').select('agent_id, agents(id, full_name)')
      .eq('team_id', agent.team_id).eq('status','active').neq('agent_id', agent.id)
      .then(({data}) => setTeammates((data||[]).map(a=>a.agents).filter(Boolean)))
  }, [policy, agent.team_id, agent.id])

  if (!policy) return null

  async function handleSubmit() {
    setSaving(true)
    await supabase.from('agent_client_transfer_requests').insert({
      policy_id: policy.id, from_agent_id: agent.id, to_agent_id: toAgentId || null,
      team_id: agent.team_id, reason: reason || null,
    })
    setSaving(false)
    onRequested()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:400,padding:'24px'}}>
        <div style={{fontSize:'16px',fontWeight:700,marginBottom:'4px'}}>Request transfer</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>{policy.patient_name} - {policy.plan_name}</div>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Hand to (optional - leave blank for the team lead to pick)</div>
        <select value={toAgentId} onChange={e=>setToAgentId(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box'}}>
          <option value="">Any teammate</option>
          {teammates.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason (optional)" rows={2} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',marginBottom:'16px',boxSizing:'border-box',fontFamily:'inherit',resize:'none'}}/>
        <div style={{display:'flex',gap:'8px'}}>
          <Btn style={{flex:1}} onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" style={{flex:1}} onClick={handleSubmit} disabled={saving}>{saving?'Sending…':'Send request'}</Btn>
        </div>
      </div>
    </div>
  )
}

function PoliciesScreen({ agent, policies, onNewPolicy, onReload }) {
  const [filter,setFilter]=useState('all')
  const [transferringPolicy,setTransferringPolicy]=useState(null)
  const [confirmingCancelId,setConfirmingCancelId]=useState(null)
  const displayed = filter==='all' ? policies : policies.filter(p=>p.status===filter)

  // A patient's cancellation request just marks intent - the actual
  // cancellation still has to be processed with the insurer, so this is
  // the agent confirming that's done, not a rubber stamp on a self-
  // service button. Sets status to 'cancelled' so it drops out of the
  // patient's own active-plan view automatically (that view only ever
  // reads status in ['active','renewal_in_progress']).
  async function confirmCancellation(p) {
    setConfirmingCancelId(p.id)
    await supabase.from('agent_policies').update({ status: 'cancelled' }).eq('id', p.id)
    setConfirmingCancelId(null)
    onReload?.()
  }

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
              {p.cancellation_requested_at&&<div style={{marginTop:'10px',background:C.redLight,borderRadius:'8px',padding:'10px 12px'}}>
                <div style={{fontSize:'11px',fontWeight:600,color:C.red}}>Patient requested cancellation - {new Date(p.cancellation_requested_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})}</div>
                <div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>Process it with the insurer, then confirm here once it's actually cancelled.</div>
                <Btn style={{fontSize:'11px',padding:'6px 10px',marginTop:'8px'}} disabled={confirmingCancelId===p.id} onClick={()=>confirmCancellation(p)}>{confirmingCancelId===p.id?'Confirming…':'Confirm cancelled'}</Btn>
              </div>}
              {agent.team_id&&<div style={{marginTop:'10px'}}><Btn style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>setTransferringPolicy(p)}>Request transfer to teammate</Btn></div>}
            </Card>
          )
        })}
      </div>
      <TransferRequestModal policy={transferringPolicy} agent={agent} onClose={()=>setTransferringPolicy(null)} onRequested={()=>setTransferringPolicy(null)}/>
    </PageWrap>
  )
}

// ── NEW POLICY / QUOTE ────────────────────────────────────────────────────
// Phase 1: manual entry. The AI-assisted entry mentioned for later would
// pre-fill this form from a signed contract document once that pipeline
// exists - this form is built so that slots in without changing structure.
function NewPolicyScreen({ agent, prefillInquiry, onBack, onSaved }) {
  const [patientSearch,setPatientSearch]=useState(prefillInquiry?.applicant_full_name || '')
  const [foundPatient,setFoundPatient]=useState(prefillInquiry?.patient_id ? { id: prefillInquiry.patient_id, full_name: prefillInquiry.applicant_full_name, medsa_id: null } : null)
  const [patientAge,setPatientAge]=useState(null)
  const [patientDetails,setPatientDetails]=useState(null) // {date_of_birth, phone, email, hkid} - what an agent actually needs to see to work the case
  const [insurers,setInsurers]=useState([])
  const [policyNumber,setPolicyNumber]=useState('')
  const [startDate,setStartDate]=useState('')
  const [renewalDate,setRenewalDate]=useState('')
  const [status,setStatus]=useState('quote')
  // Referral fee to Medsa - only relevant when this policy converts a
  // real inquiry (an unsolicited manually-entered policy has no referral
  // to pay a fee for). broker_commission_hkd used to be a number the
  // agent typed themselves - backwards, since commission is the
  // insurer's own rate, not the agent's to declare. It's now always
  // computed from the plan's own commission_rate_pct (below) and this
  // field just displays it - every line item on a policy now traces
  // back to a real plan_id, so there's always a real rate to compute
  // from. referral_fee_hkd is still capped at 50% of whichever
  // commission applies, per the Insurance Authority's published
  // referral-fee benchmark.
  const [brokerCommission,setBrokerCommission]=useState('')
  const [referralFee,setReferralFee]=useState('')
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)
  // Mirrors what the automated patient-side purchase now also collects
  // (see PatientApp.jsx's purchase flow) - an agent-issued policy should
  // carry the same details, not less, than one a patient bought without
  // any human involved at all.
  const [wardClass,setWardClass]=useState('')
  const [paymentFrequency,setPaymentFrequency]=useState('monthly')
  const [healthDeclarationAck,setHealthDeclarationAck]=useState(false)
  const [termsModalOpen,setTermsModalOpen]=useState(false)

  // ── Package builder (phase 6) ── real plans from this agent's own
  // basket (a team's authorized subset, or - independent/no-team - the
  // whole institution basket), with real riders/deductible options and
  // multi-plan bundling. A plan outside the basket is still only ever
  // added via the real cross-insurer search below, never typed in.
  const [basketPlans,setBasketPlans]=useState([])
  const [builderInsurer,setBuilderInsurer]=useState(agent.agent_type==='captive'?agent.institution_id:'')
  const [builderPlanId,setBuilderPlanId]=useState('')
  const [builderRiders,setBuilderRiders]=useState([])
  const [builderDeductibles,setBuilderDeductibles]=useState([])
  const [builderDeductibleId,setBuilderDeductibleId]=useState('')
  const [builderSelectedRiderIds,setBuilderSelectedRiderIds]=useState(new Set())
  const [lineItems,setLineItems]=useState([]) // [{planId, planName, deductibleId, deductibleHkd, riderIds:[], riderNames:[], premium}]
  const [bundleDiscount,setBundleDiscount]=useState('')
  // Real gap found live-testing: the old "manual plan" section let an
  // agent just type a plan name and a premium into existence, unlinked
  // to any real plan_id - no riders, no contract, no real commission
  // rate, and the user's own read was right: agents can only ever write
  // a policy against a plan that actually exists. This replaces that
  // free-text entry with a real cross-insurer search, so a plan found
  // outside the agent's basket still has to be a genuine, active,
  // insurer-published plan - it flows into the exact same
  // deductible/rider/premium/commission builder below as a basket pick.
  const [planSearchTerm,setPlanSearchTerm]=useState('')
  const [planSearchResults,setPlanSearchResults]=useState([])
  const [planSearching,setPlanSearching]=useState(false)
  const [searchedPlan,setSearchedPlan]=useState(null)

  useEffect(() => {
    if (agent.agent_type==='independent') {
      supabase.from('institutions').select('id,name').eq('institution_type','insurer').then(({data})=>setInsurers(data||[]))
    }
  }, [agent.agent_type])

  // Real gap found live-testing: an agent building or converting a policy
  // had no way to actually see the patient they were writing it for - not
  // even basic contact details, let alone the declared conditions the
  // patient's own inquiry already collected. patientAge was already
  // fetched (for pricing-tier matching) but never shown; this pulls the
  // rest of what an agent needs to actually work the case.
  useEffect(() => {
    if (!foundPatient?.id) { setPatientAge(null); setPatientDetails(null); return }
    supabase.from('patients').select('date_of_birth, phone, email, hkid').eq('id', foundPatient.id).maybeSingle().then(({data}) => {
      if (!data) { setPatientAge(null); setPatientDetails(null); return }
      setPatientDetails(data)
      if (!data.date_of_birth) { setPatientAge(null); return }
      const dob = new Date(data.date_of_birth)
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25*24*3600*1000))
      setPatientAge(age)
    })
  }, [foundPatient?.id])

  // Which plans this agent can actually build a quote from: a team's
  // authorized subset if they're on one, else their whole institution's
  // basket (independent agents pick the institution first, above).
  const [medsaReferralFeeRatePct,setMedsaReferralFeeRatePct]=useState(null)
  useEffect(() => {
    async function loadBasket() {
      if (!builderInsurer) { setBasketPlans([]); setMedsaReferralFeeRatePct(null); return }
      const { data: inst } = await supabase.from('institutions').select('name').eq('id', builderInsurer).maybeSingle()
      if (!inst) { setBasketPlans([]); setMedsaReferralFeeRatePct(null); return }
      const { data: allPlansRaw } = await supabase.from('insurance_plans').select('id, plan_name, commission_rate_pct, waiting_period_days, pre_existing_condition_policy, additional_terms, insurance_plan_pricing_tiers(*)').eq('company_name', inst.name).eq('status','active').eq('self_serve_only',false)
      const allPlans = Array.from(new Map((allPlansRaw||[]).map(p=>[p.plan_name,p])).values())
      if (agent.team_id) {
        const { data: auths } = await supabase.from('team_plan_authorizations').select('plan_id').eq('team_id', agent.team_id)
        const authIds = new Set((auths||[]).map(a=>a.plan_id))
        setBasketPlans(allPlans.filter(p=>authIds.has(p.id)))
      } else {
        setBasketPlans(allPlans)
      }
      // Medsa's own cut, set once per insurer partnership by Medsa admin
      // (medsa-admin's Insurers tab) - a contract term, not something an
      // agent types on a per-policy basis.
      const { data: companyRow } = await supabase.from('insurance_companies').select('referral_fee_rate_pct').eq('institution_ref_id', builderInsurer).maybeSingle()
      setMedsaReferralFeeRatePct(companyRow?.referral_fee_rate_pct ?? null)
    }
    loadBasket()
  }, [builderInsurer, agent.team_id])

  // Converting a specific inquiry already tells us exactly which plan the
  // patient asked about - re-showing an empty "Select plan" dropdown and
  // making the agent pick it again from the whole basket was pure friction
  // (and confusing: why ask again when it's already known?). Auto-select
  // it the moment it shows up in the loaded basket.
  useEffect(() => {
    if (!prefillInquiry?.plan_id || builderPlanId) return
    if (basketPlans.some(p=>p.id===prefillInquiry.plan_id)) setBuilderPlanId(prefillInquiry.plan_id)
  }, [basketPlans, prefillInquiry, builderPlanId])

  useEffect(() => {
    setBuilderDeductibleId(''); setBuilderSelectedRiderIds(new Set())
    if (!builderPlanId) { setBuilderRiders([]); setBuilderDeductibles([]); return }
    supabase.from('insurance_plan_riders').select('*').eq('plan_id', builderPlanId).eq('status','active').then(({data})=>setBuilderRiders(data||[]))
    supabase.from('insurance_plan_deductible_options').select('*').eq('plan_id', builderPlanId).then(({data})=>setBuilderDeductibles(data||[]))
  }, [builderPlanId])

  const builderPlan = basketPlans.find(p=>p.id===builderPlanId) || (searchedPlan?.id===builderPlanId ? searchedPlan : null)
  const builderBasePremium = (() => {
    if (!builderPlan) return 0
    const tiers = builderPlan.insurance_plan_pricing_tiers||[]
    const matched = patientAge!=null ? tiers.find(t=>patientAge>=t.age_min && patientAge<=t.age_max) : null
    return (matched || tiers[0])?.monthly_premium || 0
  })()
  const builderDeductible = builderDeductibles.find(d=>d.id===builderDeductibleId)
  const builderRidersTotal = builderRiders.filter(r=>builderSelectedRiderIds.has(r.id)).reduce((s,r)=>s+(r.monthly_premium||0),0)
  const builderComputedPremium = Math.round((builderBasePremium * (1 + (builderDeductible?.premium_adjustment_pct||0)/100) + builderRidersTotal) * 100) / 100

  function toggleBuilderRider(id) {
    setBuilderSelectedRiderIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function addLineItem() {
    if (!builderPlan) return
    const riderNames = builderRiders.filter(r=>builderSelectedRiderIds.has(r.id)).map(r=>r.name)
    setLineItems(prev => [...prev, {
      planId: builderPlan.id, planName: builderPlan.plan_name, institutionId: builderInsurer,
      deductibleId: builderDeductibleId||null, deductibleHkd: builderDeductible?.deductible_hkd??null,
      riderIds: [...builderSelectedRiderIds], riderNames, premium: builderComputedPremium,
      commissionRatePct: builderPlan.commission_rate_pct,
      waitingPeriodDays: builderPlan.waiting_period_days ?? null,
      preExistingConditionPolicy: builderPlan.pre_existing_condition_policy || null,
      additionalTerms: builderPlan.additional_terms || null,
    }])
    setBuilderPlanId(''); setSearchedPlan(null); setPlanSearchTerm(''); setPlanSearchResults([])
    setHealthDeclarationAck(false) // the plan set changed - the declaration has to be reviewed again
  }
  function removeLineItem(i) {
    setLineItems(prev => prev.filter((_,idx)=>idx!==i))
    setHealthDeclarationAck(false)
  }
  // Searches every insurer's active, agent-sellable plans (not just this
  // agent's own basket) by name - a captive agent still only ever sees
  // their own institution's plans, matching how the basket picker above
  // already restricts them.
  async function searchAllPlans(term) {
    setPlanSearchTerm(term)
    setSearchedPlan(null)
    const q = term.trim()
    if (!q) { setPlanSearchResults([]); return }
    setPlanSearching(true)
    let query = supabase.from('insurance_plans')
      .select('id, plan_name, company_name, commission_rate_pct, waiting_period_days, pre_existing_condition_policy, additional_terms, insurance_plan_pricing_tiers(*)')
      .eq('status','active').eq('self_serve_only', false)
      .ilike('plan_name', `%${q}%`).limit(10)
    if (agent.agent_type==='captive' && agent.institutions?.name) query = query.eq('company_name', agent.institutions.name)
    const { data } = await query
    setPlanSearching(false)
    setPlanSearchResults(data||[])
  }
  async function selectSearchedPlan(plan) {
    const { data: company } = await supabase.from('insurance_companies').select('institution_ref_id').eq('name', plan.company_name).maybeSingle()
    if (!company?.institution_ref_id) { setError(`Could not find ${plan.company_name}'s institution record on Medsa - contact Medsa admin before selling this plan.`); return }
    setSearchedPlan(plan)
    setBuilderInsurer(company.institution_ref_id)
    setBuilderPlanId(plan.id)
    setPlanSearchTerm(''); setPlanSearchResults([])
  }
  const lineItemsTotal = lineItems.reduce((s,l)=>s+l.premium,0)
  const bundleDiscountNum = parseFloat(bundleDiscount) || 0
  // Commission is the insurer's own published rate (set in Plan Manager),
  // never something an agent gets to declare - computed from each line
  // item's plan automatically. A plan the basket picked up before an
  // insurer set a rate shows as unset rather than silently defaulting to
  // 0, since 0% and "not set yet" mean very different things here.
  const anyLineItemMissingCommissionRate = lineItems.length>0 && lineItems.some(l=>l.commissionRatePct==null)
  const computedCommission = lineItems.length===0 ? null : (anyLineItemMissingCommissionRate ? null
    : lineItems.reduce((s,l)=>s+(l.premium*(l.commissionRatePct||0)/100),0))

  useEffect(() => {
    setBrokerCommission(computedCommission!=null ? computedCommission.toFixed(2) : '')
  }, [computedCommission])

  const commissionNum = parseFloat(brokerCommission) || 0
  // Medsa's referral fee is likewise computed, never agent-typed, once a
  // real commission and Medsa's contracted rate for this insurer are both
  // known - same reasoning as commission itself, one level up.
  const computedReferralFee = (lineItems.length>0 && commissionNum>0 && medsaReferralFeeRatePct!=null)
    ? Math.min(commissionNum * medsaReferralFeeRatePct / 100, commissionNum * 0.5) : null
  useEffect(() => {
    setReferralFee(computedReferralFee!=null ? computedReferralFee.toFixed(2) : '')
  }, [computedReferralFee])
  const referralFeeNum = parseFloat(referralFee) || 0
  const referralFeeExceedsCap = commissionNum > 0 && referralFeeNum > commissionNum * 0.5

  async function searchPatient() {
    const term = patientSearch.trim()
    if (!term) return
    // Real bug found live-testing: a stored name with irregular spacing
    // ("ikea  kau", two spaces) never matched a normally-typed single-
    // space search - ILIKE needs the literal substring, and extra
    // whitespace breaks that silently (no error, just zero results).
    // Collapsing whitespace in the search term into a wildcard makes any
    // amount of spacing between words match.
    const pattern = term.replace(/\s+/g, '%')
    const { data } = await supabase.from('patients').select('id,full_name,medsa_id')
      .or(`medsa_id.ilike.%${pattern}%,full_name.ilike.%${pattern}%`).limit(1).maybeSingle()
    setFoundPatient(data||null)
  }

  async function handleSave() {
    // No more freehand fallback - every policy has to trace back to at
    // least one real plan_id, added via the basket or the cross-insurer
    // search above. If neither ever produced a line item, there is
    // nothing real to save.
    if (lineItems.length === 0) { setError('Add at least one real plan first - from your basket or by searching.'); return }
    setSaving(true)
    setError(null)
    try {
      // One policy_bundles row when combining multiple plans, one
      // agent_policies row per plan, riders linked per policy.
      let bundleId = null
      if (lineItems.length > 1) {
        const { data: bundle, error: bErr } = await supabase.from('policy_bundles').insert({
          agent_id: agent.id, patient_id: foundPatient?.id||null, patient_name: foundPatient?.full_name||patientSearch,
          discount_hkd: bundleDiscountNum, notes: null,
        }).select().maybeSingle()
        if (bErr) throw bErr
        bundleId = bundle.id
      }
      for (const li of lineItems) {
        const { data: pol, error: pErr } = await supabase.from('agent_policies').insert({
          agent_id: agent.id, institution_id: li.institutionId, patient_id: foundPatient?.id||null,
          patient_name: foundPatient?.full_name||patientSearch, plan_name: li.planName, plan_id: li.planId,
          policy_number: policyNumber||null, status, premium: li.premium, deductible_hkd: li.deductibleHkd,
          start_date: startDate||null, renewal_date: renewalDate||null, bundle_id: bundleId,
          inquiry_id: prefillInquiry?.id || null,
          broker_commission_hkd: prefillInquiry && brokerCommission ? commissionNum : null,
          referral_fee_hkd: prefillInquiry && referralFee ? referralFeeNum : null,
          ward_class: wardClass||null, payment_frequency: paymentFrequency,
          health_declaration_acknowledged_at: healthDeclarationAck ? new Date().toISOString() : null,
        }).select().maybeSingle()
        if (pErr) throw pErr
        if (li.riderIds.length > 0) {
          await supabase.from('agent_policy_riders').insert(li.riderIds.map(riderId => ({ policy_id: pol.id, rider_id: riderId })))
        }
      }
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

      {prefillInquiry&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'20px',fontSize:'12px',color:C.text,lineHeight:1.5}}>Converting the plan inquiry from <strong>{prefillInquiry.applicant_full_name||'this applicant'}</strong> - saving below links this policy back to it, closing the loop for referral-fee tracking.</div>}

      <SecLabel>Patient</SecLabel>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
        <input value={patientSearch} onChange={e=>setPatientSearch(e.target.value)} placeholder="Search by name or Medsa ID" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
        <Btn onClick={searchPatient}>Search</Btn>
      </div>
      {/* Real gap this closes: an agent building or converting a policy
          used to see just a name and a Medsa ID - no age, no way to
          reach the patient, and (when converting a real inquiry)
          nothing of what the patient had already declared. Everything
          below is real data already on file, never agent-typed. */}
      {foundPatient&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'16px',fontSize:'12px',color:C.text}}>
        <div style={{color:C.green,fontWeight:600,marginBottom:'2px'}}>Matched: {foundPatient.full_name} {foundPatient.medsa_id?`(${foundPatient.medsa_id})`:''}</div>
        <div style={{color:C.textSub,fontSize:'11px',lineHeight:1.6}}>
          {patientAge!=null&&`Age ${patientAge}`}
          {patientDetails?.phone&&` · ${patientDetails.phone}`}
          {patientDetails?.email&&` · ${patientDetails.email}`}
          {patientDetails?.hkid&&` · HKID ${patientDetails.hkid}`}
        </div>
      </div>}
      {!foundPatient&&patientSearch&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px'}}>No match yet - you can still type the name in manually below and continue without linking a Medsa profile.</div>}

      {prefillInquiry&&(prefillInquiry.suitability_verdict||(prefillInquiry.declared_conditions||[]).length>0)&&<div style={{background:prefillInquiry.suitability_verdict==='needs_review'?C.amberLight:C.card,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'12px 14px',marginBottom:'16px',fontSize:'11px',lineHeight:1.6}}>
        <div style={{fontWeight:600,marginBottom:'4px',color:prefillInquiry.suitability_verdict==='needs_review'?C.amber:C.green}}>
          {prefillInquiry.suitability_verdict==='suitable'&&'✓ Pre-checked: suitable'}
          {prefillInquiry.suitability_verdict==='suitable_with_notes'&&'◇ Pre-checked: likely suitable'}
          {prefillInquiry.suitability_verdict==='needs_review'&&'⚠ Pre-checked: needs a closer look'}
        </div>
        {prefillInquiry.suitability_summary&&<div style={{color:C.textSub}}>{prefillInquiry.suitability_summary}</div>}
        {(prefillInquiry.declared_conditions||[]).length>0&&<div style={{marginTop:'4px',color:C.textMuted}}>Declared: {prefillInquiry.declared_conditions.join(', ')}</div>}
        {prefillInquiry.history_context_summary&&<div style={{marginTop:'6px',paddingTop:'6px',borderTop:`0.5px solid ${C.border}`,color:C.textMuted,fontStyle:'italic'}}>{prefillInquiry.history_context_summary}</div>}
      </div>}

      <SecLabel>Build from basket (real plans, riders, deductibles)</SecLabel>
      <Card style={{padding:'16px',marginBottom:'8px'}}>
        {patientAge!=null&&<div style={{fontSize:'11px',color:C.textSub,marginBottom:'10px'}}>Patient age {patientAge} - matching pricing tier auto-selected below.</div>}
        <select value={builderInsurer||''} onChange={e=>setBuilderInsurer(e.target.value)} disabled={agent.agent_type==='captive'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}>
          <option value="">Select insurer</option>
          {agent.agent_type==='captive'
            ? <option value={agent.institution_id}>{agent.institutions?.name||'Your insurer'}</option>
            : insurers.map(ins=><option key={ins.id} value={ins.id}>{ins.name}</option>)}
        </select>
        <select value={searchedPlan?'':builderPlanId} onChange={e=>{setSearchedPlan(null);setBuilderPlanId(e.target.value)}} disabled={!builderInsurer} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}>
          <option value="">{basketPlans.length===0?'No authorized plans in this basket':'Select plan'}</option>
          {basketPlans.map(p=><option key={p.id} value={p.id}>{p.plan_name}</option>)}
        </select>
        {/* Replaces the old freehand "manual plan" entry - a plan not in
            this agent's basket still has to be found here, as a real,
            active, insurer-published plan_id, never typed into existence. */}
        {!searchedPlan&&<div style={{marginBottom:'8px'}}>
          <input value={planSearchTerm} onChange={e=>searchAllPlans(e.target.value)} placeholder="Or search any other plan by name" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          {planSearching&&<div style={{fontSize:'11px',color:C.textMuted,padding:'6px 0'}}>Searching…</div>}
          {!planSearching&&planSearchTerm.trim()&&planSearchResults.length===0&&<div style={{fontSize:'11px',color:C.textMuted,padding:'6px 0'}}>No matching active plan found.</div>}
          {planSearchResults.map(p=>(
            <div key={p.id} onClick={()=>selectSearchedPlan(p)} style={{padding:'8px 10px',borderRadius:'8px',cursor:'pointer',fontSize:'12px',background:C.beige,marginTop:'6px'}}>
              <div style={{fontWeight:600}}>{p.plan_name}</div>
              <div style={{color:C.textMuted,fontSize:'11px'}}>{p.company_name}</div>
            </div>
          ))}
        </div>}
        {searchedPlan&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'9px 12px',marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{fontSize:'12px',fontWeight:600}}>{searchedPlan.plan_name}</div><div style={{fontSize:'11px',color:C.textMuted}}>{searchedPlan.company_name} - found by search, not in your basket</div></div>
          <span onClick={()=>{setSearchedPlan(null);setBuilderPlanId('')}} style={{fontSize:'11px',color:C.green,cursor:'pointer',flexShrink:0,marginLeft:'8px'}}>Change</span>
        </div>}
        {builderPlan&&<>
          {builderDeductibles.length>0&&<>
            <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>Deductible</div>
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'10px'}}>
              {builderDeductibles.map(d=>(
                <div key={d.id} onClick={()=>setBuilderDeductibleId(d.id)} style={{padding:'6px 10px',borderRadius:'8px',fontSize:'11px',cursor:'pointer',background:builderDeductibleId===d.id?C.green:C.card,color:builderDeductibleId===d.id?'#fff':C.text}}>HK${d.deductible_hkd} ({d.premium_adjustment_pct>0?'+':''}{d.premium_adjustment_pct}%)</div>
              ))}
            </div>
          </>}
          {builderRiders.length>0&&<>
            <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>Riders / add-ons</div>
            <div style={{marginBottom:'10px'}}>
              {builderRiders.map(r=>(
                <div key={r.id} onClick={()=>toggleBuilderRider(r.id)} style={{display:'flex',alignItems:'center',gap:'8px',padding:'4px 0',cursor:'pointer'}}>
                  <div style={{width:16,height:16,borderRadius:'4px',border:`1.5px solid ${builderSelectedRiderIds.has(r.id)?C.green:C.border}`,background:builderSelectedRiderIds.has(r.id)?C.green:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'#fff',flexShrink:0}}>{builderSelectedRiderIds.has(r.id)?'✓':''}</div>
                  <span style={{fontSize:'12px'}}>{r.name} (+HK${r.monthly_premium}/mo)</span>
                </div>
              ))}
            </div>
          </>}
          <div style={{fontSize:'13px',fontWeight:600,marginBottom:'10px'}}>Line premium: HK${builderComputedPremium}/mo</div>
          <Btn variant="primary" style={{width:'100%'}} onClick={addLineItem}>+ Add this plan to the package</Btn>
        </>}
      </Card>
      {lineItems.length>0&&<Card style={{padding:'16px',marginBottom:'16px'}}>
        <div style={{fontSize:'13px',fontWeight:600,marginBottom:'10px'}}>Package ({lineItems.length} plan{lineItems.length>1?'s':''})</div>
        {lineItems.map((li,i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'6px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}>
            <div>
              <div style={{fontWeight:500}}>{li.planName}</div>
              {(li.deductibleHkd!=null||li.riderNames.length>0)&&<div style={{color:C.textMuted,fontSize:'11px'}}>{li.deductibleHkd!=null?`HK$${li.deductibleHkd} deductible`:''}{li.riderNames.length>0?`${li.deductibleHkd!=null?' · ':''}${li.riderNames.join(', ')}`:''}</div>}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span>HK${li.premium}/mo</span>
              <span onClick={()=>removeLineItem(i)} style={{color:C.textMuted,cursor:'pointer'}}>✕</span>
            </div>
          </div>
        ))}
        {lineItems.length>1&&<div style={{marginTop:'10px'}}>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'4px'}}>Bundle discount (HK$/mo, real negotiated figure)</div>
          <input value={bundleDiscount} onChange={e=>setBundleDiscount(e.target.value)} type="number" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>}
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',fontWeight:700,marginTop:'12px',paddingTop:'10px',borderTop:`0.5px solid ${C.border}`}}>
          <span>Total</span><span>HK${(lineItemsTotal-bundleDiscountNum).toFixed(2)}/mo</span>
        </div>
      </Card>}

      {/* Real gap found live-testing: these dates apply to the whole
          policy - basket-built or not - but used to live only under "Or
          add a plan not in the basket," which reads as optional/manual-
          only. An agent building straight from the basket had no visible
          reason to scroll down into that section at all, so a basket-
          built policy could go out with no start/renewal date on file.
          Always shown now, ahead of the basket-vs-manual plan fields. */}
      <SecLabel>Policy dates</SecLabel>
      <div style={{display:'flex',gap:'10px',marginBottom:'16px'}}>
        <div style={{flex:1}}>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Start date</div>
          <input value={startDate} onChange={e=>setStartDate(e.target.value)} type="date" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 10px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Renewal date</div>
          <input value={renewalDate} onChange={e=>setRenewalDate(e.target.value)} type="date" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 10px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>
      </div>

      <SecLabel>Coverage details</SecLabel>
      <div style={{display:'flex',gap:'10px',marginBottom:'16px'}}>
        <div style={{flex:1}}>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Ward class</div>
          <select value={wardClass} onChange={e=>setWardClass(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 10px',fontSize:'13px',boxSizing:'border-box'}}>
            <option value="">Not set</option>
            <option value="general">General ward</option>
            <option value="semi_private">Semi-private</option>
            <option value="private">Private</option>
          </select>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Payment frequency</div>
          <select value={paymentFrequency} onChange={e=>setPaymentFrequency(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 10px',fontSize:'13px',boxSizing:'border-box'}}>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
      </div>
      {/* Real gap this closes: this used to be one inline checkbox
          sentence, ticked by the agent alone with no real document - not
          something the agent could actually walk the patient through.
          Now a real, scrollable declaration screen (Uber-Merchant-
          onboarding style) built from the plan's own on-file terms and
          whatever the inquiry already declared, meant to be reviewed
          together with the patient before issuing an active policy. */}
      <div style={{marginBottom:'20px'}}>
        {healthDeclarationAck
          ? <div style={{fontSize:'12px',color:C.green,fontWeight:600}}>✓ Health declaration & terms reviewed and accepted with the patient.</div>
          : <Btn style={{width:'100%'}} disabled={lineItems.length===0} onClick={()=>setTermsModalOpen(true)}>{lineItems.length===0?'Add a plan first to review the health declaration':'Review & accept health declaration with patient'}</Btn>}
      </div>
      {lineItems.length>0&&<TermsAgreementModal
        open={termsModalOpen} onClose={()=>setTermsModalOpen(false)} isEn={true}
        planName={lineItems.map(l=>l.planName).join(', ')}
        declaredConditions={prefillInquiry?.declared_conditions||[]}
        waitingPeriodDays={lineItems[0]?.waitingPeriodDays}
        preExistingConditionPolicy={lineItems[0]?.preExistingConditionPolicy}
        additionalTerms={lineItems[0]?.additionalTerms}
        onAccept={()=>{setHealthDeclarationAck(true);setTermsModalOpen(false)}}
      />}

      <SecLabel>Policy number</SecLabel>
      <div style={{marginBottom:'16px'}}>
        <input value={policyNumber} onChange={e=>setPolicyNumber(e.target.value)} placeholder="Policy number, once the insurer issues it (optional for quotes)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
      </div>

      <SecLabel>Status</SecLabel>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
        {['quote','active'].map(s=>(
          <div key={s} onClick={()=>setStatus(s)} style={{flex:1,padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:status===s?C.green:C.card,color:status===s?'#fff':C.text,textTransform:'capitalize'}}>{s}</div>
        ))}
      </div>

      {REFERRAL_FEE_ENABLED && prefillInquiry&&<>
        <SecLabel>Referral fee owed to Medsa</SecLabel>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>
          {lineItems.length>0
            ? `Commission is the insurer's own rate for this plan, not something you enter. Medsa's fee is its own contracted rate against that commission${medsaReferralFeeRatePct!=null?` (${medsaReferralFeeRatePct}%, set by Medsa admin)`:' (not set yet by Medsa admin)'}, capped at 50% either way (the Insurance Authority's own referral-fee benchmark).`
            : "Add a plan to this policy first - commission and Medsa's fee are both set by the insurer's and Medsa's own contracted rates, never typed in by an agent."}
        </div>
        <div style={{display:'flex',gap:'10px',marginBottom:'8px'}}>
          <input value={brokerCommission} disabled type="number" placeholder={lineItems.length===0?'Add a plan first':(anyLineItemMissingCommissionRate?'Not set by insurer yet':'Your commission (HK$)')} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box',background:C.beige,color:C.textSub}}/>
          <input value={referralFee} disabled type="number" placeholder={lineItems.length===0?'Add a plan first':(medsaReferralFeeRatePct==null?'Not set by Medsa admin yet':'Referral fee to Medsa (HK$)')} style={{flex:1,border:`0.5px solid ${referralFeeExceedsCap?C.red:C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box',background:C.beige,color:C.textSub}}/>
        </div>
        {referralFeeExceedsCap&&<div style={{fontSize:'11px',color:C.red,marginBottom:'12px'}}>That's more than 50% of the commission entered (HK${(commissionNum*0.5).toFixed(0)} max) - the IA's referral-fee benchmark.</div>}
      </>}

      <div style={{background:C.blueLight,borderRadius:'8px',padding:'10px 14px',marginBottom:'16px',fontSize:'11px',color:C.blue,lineHeight:1.5}}>
        {'\u25c7'} Manual entry for now. Once a contract is signed and written up, this form is designed to be pre-filled automatically from that document in a future update.
      </div>

      {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
      <Btn variant="primary" style={{width:'100%'}} onClick={handleSave} disabled={saving||lineItems.length===0||referralFeeExceedsCap||(status==='active'&&!healthDeclarationAck)}>{saving?'Saving...':lineItems.length>0?`Save policy (${lineItems.length} plan${lineItems.length>1?'s':''})`:'Add a plan above to save'}</Btn>
      {status==='active'&&!healthDeclarationAck&&<div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginTop:'6px'}}>Acknowledge the health declaration above to issue an active policy - a quote doesn't need it yet.</div>}
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
// ── RENEW POLICY MODAL ────────────────────────────────────────────────────
function RenewPolicyModal({ policy, onClose, onRenewed }) {
  const stage = !policy ? null
    : policy.status==='active' || policy.status==='lapsed' ? 'prep'
    : policy.status==='renewal_in_progress' && !policy.contract_ready_at ? 'checklist'
    : policy.status==='renewal_in_progress' && policy.contract_ready_at ? 'awaiting_signature'
    : 'prep'

  const checklist = policy?.renewal_checklist || {}
  const [checks,setChecks]=useState({
    confirmContact: checklist.confirmContact||false,
    declareConditions: checklist.declareConditions||false,
    confirmBeneficiary: checklist.confirmBeneficiary||false,
    confirmBilling: checklist.confirmBilling||false,
  })
  const [newDate,setNewDate]=useState(() => {
    if (!policy?.renewal_date) return ''
    const d = new Date(policy.renewal_date)
    d.setFullYear(d.getFullYear()+1)
    return d.toISOString().slice(0,10)
  })
  const [newPremium,setNewPremium]=useState(policy?.premium||'')
  const [contractFile,setContractFile]=useState(null)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)

  if (!policy) return null

  const checklistItems = [
    {key:'confirmContact', label:'Confirmed contact details are current'},
    {key:'declareConditions', label:'Client has declared any new medical conditions'},
    {key:'confirmBeneficiary', label:'Beneficiary / dependent info confirmed'},
    {key:'confirmBilling', label:'Payment / billing details confirmed'},
  ]

  async function handleStartPrep() {
    setSaving(true)
    setError(null)
    const { error: updErr } = await supabase.from('agent_policies').update({
      status: 'renewal_in_progress',
      renewal_started_at: new Date().toISOString(),
      renewal_checklist: checks,
    }).eq('id', policy.id)
    setSaving(false)
    if (updErr) { setError(`Could not start renewal: ${updErr.message}`); return }
    onRenewed()
  }

  function toggleCheck(key) {
    const updated = {...checks, [key]: !checks[key]}
    setChecks(updated)
    supabase.from('agent_policies').update({ renewal_checklist: updated }).eq('id', policy.id)
  }

  async function handleUploadForSignature() {
    if (!contractFile) { setError('Upload the new contract to send for signature.'); return }
    setSaving(true)
    setError(null)
    try {
      const filePath = `${policy.id}/${Date.now()}-${contractFile.name}`
      const { error: upErr } = await supabase.storage.from('policy-contracts').upload(filePath, contractFile)
      if (upErr) throw upErr
      const { error: updErr } = await supabase.from('agent_policies').update({
        contract_file_path: filePath,
        contract_uploaded_at: new Date().toISOString(),
        contract_ready_at: new Date().toISOString(),
      }).eq('id', policy.id)
      if (updErr) throw updErr
      onRenewed()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmRenewal() {
    setSaving(true)
    setError(null)
    const { error: updErr } = await supabase.from('agent_policies').update({
      renewal_date: newDate,
      premium: parseFloat(newPremium) || policy.premium,
      status: 'active',
      patient_requested_renewal_at: null,
      contract_ready_at: null,
      patient_signed_at: null,
    }).eq('id', policy.id)
    setSaving(false)
    if (updErr) { setError(`Could not confirm renewal: ${updErr.message}`); return }
    onRenewed()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:440,padding:'24px',maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{fontSize:'16px',fontWeight:700,marginBottom:'4px'}}>
          {stage==='prep'&&'Start renewal'}
          {stage==='checklist'&&'Upload contract for signature'}
          {stage==='awaiting_signature'&&'Confirm renewal'}
        </div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'18px'}}>{policy.patient_name} - {policy.plan_name}</div>
        {policy.patient_requested_renewal_at&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'16px',fontSize:'12px',color:C.green}}>Patient requested this renewal on {new Date(policy.patient_requested_renewal_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})}</div>}

        {stage==='prep' && <>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'14px',lineHeight:1.5}}>Starting this notifies the patient that you're working on their renewal. Work through this checklist with them, then come back to upload the new contract.</div>
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
            {checklistItems.map(item=>(
              <div key={item.key} onClick={()=>setChecks({...checks,[item.key]:!checks[item.key]})} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:C.card,borderRadius:'8px',cursor:'pointer'}}>
                <div style={{width:18,height:18,borderRadius:'4px',border:`1.5px solid ${checks[item.key]?C.green:C.border}`,background:checks[item.key]?C.green:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'#fff',flexShrink:0}}>{checks[item.key]?'\u2713':''}</div>
                <span style={{fontSize:'12px'}}>{item.label}</span>
              </div>
            ))}
          </div>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={handleStartPrep} disabled={saving}>{saving?'Starting...':'Start renewal process'}</Btn>
          </div>
        </>}

        {stage==='checklist' && <>
          <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'8px'}}>Checklist</div>
          <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'18px'}}>
            {checklistItems.map(item=>(
              <div key={item.key} onClick={()=>toggleCheck(item.key)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',background:C.card,borderRadius:'8px',cursor:'pointer'}}>
                <div style={{width:16,height:16,borderRadius:'4px',border:`1.5px solid ${checks[item.key]?C.green:C.border}`,background:checks[item.key]?C.green:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'#fff',flexShrink:0}}>{checks[item.key]?'\u2713':''}</div>
                <span style={{fontSize:'12px'}}>{item.label}</span>
              </div>
            ))}
          </div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px',lineHeight:1.5}}>Once you have the new contract drafted, upload it here. The patient will see it's ready and be asked to review and confirm.</div>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Upload new contract</div>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>setContractFile(e.target.files[0])} style={{width:'100%',fontSize:'12px',marginBottom:'20px'}}/>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={onClose}>Close</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={handleUploadForSignature} disabled={saving}>{saving?'Uploading...':'Send for review & signature'}</Btn>
          </div>
        </>}

        {stage==='awaiting_signature' && <>
          <div style={{background:policy.patient_signed_at?C.greenXLight:C.amberLight,border:`0.5px solid ${policy.patient_signed_at?C.green:C.amber}`,borderRadius:'8px',padding:'12px 14px',marginBottom:'18px',fontSize:'12px',color:policy.patient_signed_at?C.green:C.amber}}>
            {policy.patient_signed_at
              ? `\u2713 Patient reviewed and signed on ${new Date(policy.patient_signed_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})}`
              : '\u25c7 Contract sent - awaiting patient review and signature'}
          </div>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>New renewal date</div>
          <input value={newDate} onChange={e=>setNewDate(e.target.value)} type="date" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'14px',boxSizing:'border-box'}}/>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Premium (HK$/mo)</div>
          <input value={newPremium} onChange={e=>setNewPremium(e.target.value)} type="number" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'20px',boxSizing:'border-box'}}/>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={onClose}>Close</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={handleConfirmRenewal} disabled={saving}>{saving?'Confirming...':'Confirm renewal'}</Btn>
          </div>
        </>}
      </div>
    </div>
  )
}

// New plan inquiries (someone shopping for a policy, not an existing
// policyholder) - first-come-first-served claiming, then a direct
// message thread with the applicant once claimed. If the patient asks
// to switch agents, the inquiry is simply released back into the
// unclaimed pool for the next agent to claim, rather than routing
// through Medsa Admin.
function InquiryMessageThread({ inquiry, agentName }) {
  const [messages,setMessages]=useState([])
  const [loading,setLoading]=useState(true)
  const [body,setBody]=useState('')
  const [sending,setSending]=useState(false)
  const [attachment,setAttachment]=useState(null)
  const [uploading,setUploading]=useState(false)
  const [uploadError,setUploadError]=useState(null)

  async function load() {
    const { data } = await supabase.from('inquiry_messages').select('*').eq('inquiry_id', inquiry.id).order('created_at',{ascending:true})
    setMessages(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [inquiry.id])

  async function handleFile(file) {
    setUploading(true)
    setUploadError(null)
    const path = `${inquiry.id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('inquiry-attachments').upload(path, file)
    if (error) { setUploadError(error.message); setUploading(false); return }
    const { data } = supabase.storage.from('inquiry-attachments').getPublicUrl(path)
    setAttachment({ url: data.publicUrl, name: file.name })
    setUploading(false)
  }

  async function handleSend() {
    if (!body.trim() && !attachment) return
    setSending(true)
    await supabase.from('inquiry_messages').insert({
      inquiry_id: inquiry.id, sender_type: 'agent', sender_name: agentName,
      body: body.trim()||null, attachment_url: attachment?.url||null, attachment_name: attachment?.name||null,
    })
    setBody(''); setAttachment(null); setSending(false)
    load()
  }

  return (
    <div style={{marginTop:'10px',borderTop:`0.5px solid ${C.border}`,paddingTop:'10px'}}>
      {loading&&<div style={{fontSize:'12px',color:C.textMuted}}>Loading messages…</div>}
      {!loading&&messages.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'8px'}}>No messages yet - say hello.</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'10px',maxHeight:260,overflowY:'auto'}}>
        {messages.map(m=>(
          <div key={m.id} style={{alignSelf:m.sender_type==='agent'?'flex-end':'flex-start',maxWidth:'80%',background:m.sender_type==='agent'?C.greenLight:C.card,borderRadius:'8px',padding:'8px 10px'}}>
            <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'2px'}}>{m.sender_name||(m.sender_type==='agent'?'You':'Patient')} · {new Date(m.created_at).toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
            {m.body&&<div style={{fontSize:'13px'}}>{m.body}</div>}
            {m.attachment_url&&<a href={m.attachment_url} target="_blank" rel="noreferrer" style={{fontSize:'12px',color:C.green}}>{'📎'} {m.attachment_name||'Attachment'}</a>}
          </div>
        ))}
      </div>
      <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Message the applicant, propose a meeting time, ..." rows={2} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px',fontSize:'13px',boxSizing:'border-box',marginBottom:'6px',fontFamily:'inherit'}}/>
      <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
        <label style={{fontSize:'11px',color:C.textSub,cursor:'pointer',padding:'8px 10px',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}>
          {uploading?'Uploading…':(attachment?`✓ ${attachment.name}`:'Attach file')}
          <input type="file" style={{display:'none'}} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])}/>
        </label>
        <Btn variant="primary" style={{flex:1}} onClick={handleSend} disabled={sending||uploading}>{sending?'Sending…':'Send'}</Btn>
      </div>
      {uploadError&&<div style={{fontSize:'11px',color:C.red,marginTop:'6px'}}>Attachment failed: {uploadError}</div>}
    </div>
  )
}

function PlanInquiriesScreen({ agent, onConvert }) {
  const [unclaimed,setUnclaimed]=useState([])
  const [mine,setMine]=useState([])
  const [convertedInquiryIds,setConvertedInquiryIds]=useState(new Set())
  // plan_id -> [team_id, ...] authorized to sell it. A plan with no entry
  // here has no team gating at all - the old flat claim race still
  // applies unchanged. A plan that DOES have team authorizations can only
  // be won by a member of one of those teams, via team-confirm below.
  const [planTeamAuth,setPlanTeamAuth]=useState({})
  const [loading,setLoading]=useState(true)
  const [claimingId,setClaimingId]=useState(null)
  const [claimNotice,setClaimNotice]=useState(null)
  const [expandedId,setExpandedId]=useState(null)

  async function load() {
    setLoading(true)
    // Real gap found live-testing: this used to show every unclaimed
    // inquiry across every insurer to every agent, regardless of who
    // they actually work for - a Bupa agent could see an AIA applicant's
    // real name/HKID/DOB/phone/email. Scope to insurers this agent can
    // actually work with: their one employer if captive, or whichever
    // insurers they're actively appointed to if independent.
    let myCompanyNames = []
    if (agent.agent_type === 'captive') {
      myCompanyNames = agent.institutions?.name ? [agent.institutions.name] : []
    } else {
      const { data: appts } = await supabase.from('agent_institution_appointments')
        .select('institutions(name)').eq('agent_id', agent.id).eq('status','active')
      myCompanyNames = [...new Set((appts||[]).map(a=>a.institutions?.name).filter(Boolean))]
    }
    // An 'auto' inquiry already got its answer instantly on the patient's
    // own screen - it was never meant to sit in a claim queue for an
    // agent to work, so it's excluded here rather than showing up as a
    // dead lead nobody needs to act on.
    const { data: unclaimedRows } = myCompanyNames.length===0 ? { data: [] } : await supabase.from('plan_inquiries').select('*, insurance_plans!inner(plan_name, company_name)')
      .is('claimed_by_agent_id', null).or('mode.is.null,mode.neq.auto').in('insurance_plans.company_name', myCompanyNames).order('created_at',{ascending:false})
    const { data: mineRows } = await supabase.from('plan_inquiries').select('*, insurance_plans(plan_name, company_name)')
      .eq('claimed_by_agent_id', agent.id).order('claimed_at',{ascending:false})
    setMine(mineRows||[])
    // Which claimed inquiries already converted to a real policy - so
    // "Convert to policy" only ever shows once, not every visit.
    const { data: convertedRows } = await supabase.from('agent_policies').select('inquiry_id').eq('agent_id', agent.id).not('inquiry_id', 'is', null)
    setConvertedInquiryIds(new Set((convertedRows||[]).map(r=>r.inquiry_id)))

    // Real bug found live-testing: unclaimed used to be committed to state
    // before this team-authorization data was ready, so a team-gated
    // inquiry the agent isn't eligible for would render for one frame
    // (planTeamAuth still empty, so isTeamGated read as false below) and
    // then vanish the instant the real auth data landed - a visible
    // flash-then-disappear on every refresh. Both are committed together
    // now, so the list never shows something it's about to hide.
    const planIds = [...new Set((unclaimedRows||[]).map(i=>i.plan_id).filter(Boolean))]
    if (planIds.length>0) {
      const { data: auths } = await supabase.from('team_plan_authorizations').select('plan_id, team_id').in('plan_id', planIds)
      const byPlan = {}
      for (const a of (auths||[])) (byPlan[a.plan_id] ||= []).push(a.team_id)
      setPlanTeamAuth(byPlan)
    } else {
      setPlanTeamAuth({})
    }
    setUnclaimed(unclaimedRows||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [agent.id])

  // First team (among those authorized to sell this plan) to confirm
  // wins the lead - same atomic race pattern as handleClaim below, just
  // scoped to team_confirmed_by_team_id instead of claimed_by_agent_id.
  // Once a team wins, its own assignment_mode decides the final agent
  // immediately (confirmer/random) or leaves it for the team lead
  // (manual) - see TeamLeadScreen's "Awaiting your assignment".
  async function handleTeamConfirm(inquiry) {
    if (!agent.team_id) return
    setClaimingId(inquiry.id)
    setClaimNotice(null)
    const { data } = await supabase.from('plan_inquiries')
      .update({ team_confirmed_by_team_id: agent.team_id, team_confirmed_at: new Date().toISOString(), confirmed_by_agent_id: agent.id })
      .eq('id', inquiry.id).is('team_confirmed_by_team_id', null).select()
    if (!data || data.length === 0) {
      setClaimNotice('Another team already confirmed this inquiry first.')
      setClaimingId(null); load(); return
    }
    const { data: team } = await supabase.from('insurance_teams').select('assignment_mode').eq('id', agent.team_id).maybeSingle()
    if (team?.assignment_mode === 'confirmer') {
      await supabase.from('plan_inquiries').update({ claimed_by_agent_id: agent.id, claimed_at: new Date().toISOString() }).eq('id', inquiry.id)
    } else if (team?.assignment_mode === 'random') {
      const { data: appts } = await supabase.from('agent_institution_appointments').select('agent_id').eq('team_id', agent.team_id).eq('status','active')
      const memberIds = (appts||[]).map(a=>a.agent_id)
      const pick = memberIds[Math.floor(Math.random()*memberIds.length)] || agent.id
      await supabase.from('plan_inquiries').update({ claimed_by_agent_id: pick, claimed_at: new Date().toISOString() }).eq('id', inquiry.id)
    }
    // 'manual' leaves claimed_by_agent_id null - the team lead assigns it.
    setClaimingId(null)
    load()
  }

  // Atomic first-come-first-served claim - the .is('claimed_by_agent_id', null)
  // filter means this UPDATE only affects the row if nobody has claimed
  // it yet. If another agent's claim beat this one, the row simply
  // doesn't match anymore and .select() comes back empty - that's how
  // we know to tell this agent they lost the race, instead of two
  // agents both believing they got the same lead.
  async function handleClaim(inquiry) {
    setClaimingId(inquiry.id)
    setClaimNotice(null)
    const { data } = await supabase.from('plan_inquiries')
      .update({ claimed_by_agent_id: agent.id, claimed_at: new Date().toISOString() })
      .eq('id', inquiry.id).is('claimed_by_agent_id', null).select()
    if (!data || data.length === 0) {
      setClaimNotice('Someone else claimed this inquiry first.')
    }
    setClaimingId(null)
    load()
  }

  return (
    <PageWrap>
      <div style={{fontSize:'20px',fontWeight:700,marginBottom:'16px'}}>New Plan Inquiries</div>
      {claimNotice&&<div style={{background:C.amberLight,color:C.amber,borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'12px'}}>{claimNotice}</div>}

      <SecLabel>Unclaimed - first to claim gets the lead</SecLabel>
      {loading&&<div style={{fontSize:'12px',color:C.textMuted}}>Loading…</div>}
      {!loading&&unclaimed.filter(i=>{
        const authTeams = planTeamAuth[i.plan_id]
        const isTeamGated = authTeams && authTeams.length > 0
        return !isTeamGated || (agent.team_id && authTeams.includes(agent.team_id))
      }).length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'20px'}}>No unclaimed inquiries you're eligible to work right now.</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'24px'}}>
        {unclaimed.map(i=>{
          const authTeams = planTeamAuth[i.plan_id]
          const isTeamGated = authTeams && authTeams.length > 0
          const myTeamEligible = isTeamGated && agent.team_id && authTeams.includes(agent.team_id)
          // An inquiry this agent structurally cannot work (gated to
          // teams they're not on) isn't shown at all any more, not just
          // disabled - "Not your team's plan" used to still surface the
          // applicant's real name/HKID/DOB/phone/email to someone who
          // could never legitimately act on it.
          if (isTeamGated && !myTeamEligible) return null
          return (
          <Card key={i.id} style={{padding:'14px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{i.applicant_full_name||'Unnamed applicant'}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{i.insurance_plans?.plan_name} - {i.insurance_plans?.company_name}</div>
                <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{new Date(i.created_at).toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                {i.is_switch_request&&<div style={{marginTop:'4px'}}><Badge text="⇄ Plan switch request" type="due"/></div>}
                {isTeamGated&&<div style={{fontSize:'11px',color:C.blue,marginTop:'2px'}}>Team-gated - claim it yourself, or confirm it for your team to distribute by its own rule</div>}
              </div>
              <div style={{display:'flex',gap:'6px'}}>
                <Btn onClick={()=>handleClaim(i)} disabled={claimingId===i.id} style={{fontSize:'12px'}}>{claimingId===i.id?'Claiming…':'Claim for myself'}</Btn>
                {isTeamGated&&<Btn variant="primary" onClick={()=>handleTeamConfirm(i)} disabled={claimingId===i.id} style={{fontSize:'12px'}}>{claimingId===i.id?'Confirming…':'Confirm for team'}</Btn>}
              </div>
            </div>
          </Card>
          )
        })}
      </div>

      <SecLabel>Your claimed inquiries</SecLabel>
      {!loading&&mine.length===0&&<div style={{fontSize:'12px',color:C.textMuted}}>None claimed yet.</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {mine.map(i=>(
          <Card key={i.id} style={{padding:'14px 16px',cursor:'pointer'}} onClick={()=>setExpandedId(expandedId===i.id?null:i.id)}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{i.applicant_full_name||'Unnamed applicant'}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{i.insurance_plans?.plan_name} - {i.insurance_plans?.company_name}</div>
                <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{i.applicant_phone||''} {i.applicant_email||''}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'6px'}}>
                {i.is_switch_request&&<Badge text="⇄ Plan switch request" type="due"/>}
                {i.switch_requested_at&&<Badge text="Switch requested earlier" type="due"/>}
                {convertedInquiryIds.has(i.id)
                  ? <Badge text="Converted to policy" type="ok"/>
                  : <Btn variant="primary" style={{fontSize:'11px',padding:'6px 10px'}} onClick={e=>{e.stopPropagation();onConvert?.(i)}}>Convert to policy</Btn>}
              </div>
            </div>
            {/* Pre-computed suitability read (lib/planSuitability.js), run
                the moment the patient submitted this inquiry - lower
                agent workload was the whole point: this isn't a blank
                lead, it's already checked against the plan's own terms. */}
            {i.suitability_verdict&&<div style={{marginTop:'8px',padding:'8px 10px',borderRadius:'8px',fontSize:'11px',lineHeight:1.5,background:i.suitability_verdict==='needs_review'?C.amberLight:C.greenXLight,color:C.textSub}}>
              <span style={{fontWeight:600,color:i.suitability_verdict==='needs_review'?C.amber:C.green}}>
                {i.suitability_verdict==='suitable'&&'✓ Pre-checked: suitable'}
                {i.suitability_verdict==='suitable_with_notes'&&'◇ Pre-checked: likely suitable'}
                {i.suitability_verdict==='needs_review'&&'⚠ Pre-checked: needs a closer look'}
              </span>
              {i.quoted_premium_hkd!=null&&<span> · Est. HK${i.quoted_premium_hkd}/mo</span>}
              <div style={{marginTop:'2px'}}>{i.suitability_summary}</div>
              {(i.declared_conditions||[]).length>0&&<div style={{marginTop:'2px',color:C.textMuted}}>Declared: {i.declared_conditions.join(', ')}</div>}
              {i.history_context_summary&&<div style={{marginTop:'6px',paddingTop:'6px',borderTop:`0.5px solid ${C.border}`,color:C.textMuted,fontStyle:'italic'}}>{i.history_context_summary}</div>}
            </div>}
            {/* Real gap found live-testing: the patient explicitly
                consented to Medsa checking their visit history against
                this plan, but the agent could only ever see a computed
                summary sentence, never the actual entries it came from -
                no way to review what was really on file. Expanding the
                card now also shows the real snapshot taken at inquiry
                time (not a live query - what the patient actually
                consented to at that moment). */}
            {expandedId===i.id&&(i.history_records_snapshot||[]).length>0&&<div onClick={e=>e.stopPropagation()} style={{marginTop:'8px',background:C.beige,borderRadius:'8px',padding:'10px 12px'}}>
              <div style={{fontSize:'11px',fontWeight:600,marginBottom:'6px'}}>Visit history reviewed (patient consented)</div>
              {i.history_records_snapshot.map((r,ri)=>(
                <div key={ri} style={{fontSize:'11px',color:C.textSub,padding:'3px 0'}}>{r.date?new Date(r.date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}):'-'} · {r.diagnosis}</div>
              ))}
            </div>}
            {expandedId===i.id&&<div onClick={e=>e.stopPropagation()}><InquiryMessageThread inquiry={i} agentName={agent.name}/></div>}
          </Card>
        ))}
      </div>
    </PageWrap>
  )
}

function RenewalsScreen({ agent, policies, onRenewed }) {
  const [renewingPolicy,setRenewingPolicy]=useState(null)
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
            <Card key={i} style={{padding:'12px 16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:p.patient_requested_renewal_at?'8px':'0'}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:500}}>{p.patient_name}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{p.plan_name}{agent.agent_type==='independent'&&p.institutions?.name?` - ${p.institutions.name}`:''}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'12px',fontWeight:600,color}}>{p.d<0?`${Math.abs(p.d)}d overdue`:`${p.d}d left`}</div>
                  <div style={{fontSize:'11px',color:C.textMuted}}>{new Date(p.renewal_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
                </div>
              </div>
              {p.status==='renewal_in_progress'&&!p.contract_ready_at&&<Badge text="Renewal in progress" type="waiting"/>}
              {p.status==='renewal_in_progress'&&p.contract_ready_at&&!p.patient_signed_at&&<Badge text="Awaiting signature" type="due"/>}
              {p.status==='renewal_in_progress'&&p.patient_signed_at&&<Badge text="Signed - ready to confirm" type="ok"/>}
              {p.patient_requested_renewal_at&&<Badge text="Patient requested renewal" type="due"/>}
              <div style={{marginTop:'10px'}}>
                <Btn variant="primary" style={{width:'100%',fontSize:'12px'}} onClick={()=>setRenewingPolicy(p)}>
                  {p.status!=='renewal_in_progress' ? 'Start renewal'
                    : p.contract_ready_at ? 'Confirm renewal'
                    : 'Upload contract for signature'}
                </Btn>
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
        Patients see the same renewal countdown on their side of Medsa, and can flag that they'd like it renewed - you'll see that flag here.
      </div>
      <Group title="Overdue" items={overdue} color={C.red}/>
      <Group title="Due within 30 days" items={soon} color={C.amber}/>
      <Group title="Later" items={later} color={C.textSub}/>
      {withRenewal.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>No policies with renewal dates yet.</div>}
      <RenewPolicyModal policy={renewingPolicy} onClose={()=>setRenewingPolicy(null)} onRenewed={()=>{setRenewingPolicy(null);onRenewed()}}/>
    </PageWrap>
  )
}

// ── TEAM LEAD SCREEN ─────────────────────────────────────────────────────
// Only reachable by whoever insurance_teams.team_lead_agent_id actually
// points at - same portal every other agent uses, just with this one
// extra screen visible, so a lead who also carries their own book of
// business isn't forced into a separate app.
function TeamLeadScreen({ agent, team }) {
  const [members,setMembers]=useState([])
  const [plans,setPlans]=useState([])
  const [authorizedPlanIds,setAuthorizedPlanIds]=useState(new Set())
  const [pendingAssignments,setPendingAssignments]=useState([])
  const [transferRequests,setTransferRequests]=useState([])
  const [transferPicks,setTransferPicks]=useState({})
  const [loading,setLoading]=useState(true)
  const [showAddMember,setShowAddMember]=useState(false)
  const [memberForm,setMemberForm]=useState({ fullName:'', email:'', phone:'', licenseNumber:'' })
  const [saving,setSaving]=useState(false)
  const [notice,setNotice]=useState(null)
  const [assigningId,setAssigningId]=useState(null)

  async function load() {
    setLoading(true)
    const { data: appts } = await supabase.from('agent_institution_appointments')
      .select('agent_id, agents(id, full_name, email, medsa_id)').eq('team_id', team.id).eq('status','active')
    setMembers((appts||[]).map(a=>a.agents).filter(Boolean))
    const { data: planRows } = await supabase.from('insurance_plans').select('id, plan_name').eq('company_name', agent.institutions?.name||'').eq('status','active').eq('self_serve_only',false)
    // Same dedupe as the insurer-side Teams screen (InsuranceApp.jsx) -
    // this is a separate, parallel implementation of the same "Plans
    // this team is authorized to sell" screen for the team-lead view,
    // and hit the exact same leftover-duplicate-seed-row bug independently.
    const dedupedPlans = Array.from(new Map((planRows||[]).map(p=>[p.plan_name, p])).values())
    setPlans(dedupedPlans)
    const { data: auths } = await supabase.from('team_plan_authorizations').select('plan_id').eq('team_id', team.id)
    setAuthorizedPlanIds(new Set((auths||[]).map(a=>a.plan_id)))
    // Inquiries this team won but that need a human to hand them to one
    // member - only ever non-empty when the team's assignment_mode is
    // 'manual'.
    const { data: pending } = await supabase.from('plan_inquiries')
      .select('*, insurance_plans(plan_name)').eq('team_confirmed_by_team_id', team.id).is('claimed_by_agent_id', null)
    setPendingAssignments(pending||[])
    const { data: transfers } = await supabase.from('agent_client_transfer_requests')
      .select('*, agent_policies(patient_name, plan_name), from:from_agent_id(full_name), to:to_agent_id(full_name)')
      .eq('team_id', team.id).eq('status','pending')
    setTransferRequests(transfers||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [team.id])

  const [savedNotice,setSavedNotice]=useState(null)
  async function toggleAuthorization(planId, planName) {
    if (authorizedPlanIds.has(planId)) {
      await supabase.from('team_plan_authorizations').delete().eq('team_id', team.id).eq('plan_id', planId)
      setSavedNotice(`✓ Saved - ${planName} no longer authorized`)
    } else {
      await supabase.from('team_plan_authorizations').insert({ team_id: team.id, plan_id: planId })
      setSavedNotice(`✓ Saved - ${planName} authorized`)
    }
    load()
    setTimeout(() => setSavedNotice(null), 2500)
  }

  async function setAssignmentMode(mode) {
    await supabase.from('insurance_teams').update({ assignment_mode: mode }).eq('id', team.id)
    load()
  }

  async function assignInquiry(inquiryId, toAgentId) {
    setAssigningId(inquiryId)
    await supabase.from('plan_inquiries').update({ claimed_by_agent_id: toAgentId, claimed_at: new Date().toISOString() }).eq('id', inquiryId)
    setAssigningId(null)
    load()
  }

  // Real bug found here: a request left "Any teammate" (to_agent_id null,
  // meaning "team lead, you pick") approved with status='approved' but
  // never actually reassigned the policy - the guard below only ever ran
  // for a request that already named someone. Approving looked like it
  // worked (the card disappeared) while silently doing nothing to
  // agent_policies.agent_id. Now requires picking someone at approval
  // time when the request didn't already name one.
  async function decideTransfer(reqRow, approve, pickedAgentId) {
    const targetAgentId = reqRow.to_agent_id || pickedAgentId || null
    if (approve && !targetAgentId) return
    await supabase.from('agent_client_transfer_requests').update({
      status: approve?'approved':'rejected', decided_at: new Date().toISOString(), decided_by_agent_id: agent.id,
    }).eq('id', reqRow.id)
    if (approve && targetAgentId) {
      await supabase.from('agent_policies').update({ agent_id: targetAgentId }).eq('id', reqRow.policy_id)
    }
    load()
  }

  async function handleAddMember() {
    if (!memberForm.email.trim()) return
    setSaving(true); setNotice(null)
    try {
      const res = await fetch('/api/agent/onboard', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...memberForm, agentType:'captive', institutionId: agent.institution_id, teamId: team.id }),
      })
      const data = await res.json()
      if (data.status !== 'OK') { setNotice(data.message||'Could not add member.'); setSaving(false); return }
      setNotice(data.isNew ? `Added - temp password ${data.emailSent?'emailed':data.tempPassword}.` : 'Existing agent appointed to this team.')
      setMemberForm({ fullName:'', email:'', phone:'', licenseNumber:'' })
      setShowAddMember(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageWrap maxWidth={720}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'6px',textAlign:'center'}}>{team.name}</h2>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'20px',textAlign:'center'}}>{team.medsa_id}</div>
      {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted}}>Loading...</div>}

      {pendingAssignments.length>0&&<>
        <SecLabel>Awaiting your assignment</SecLabel>
        {pendingAssignments.map(inq=>(
          <Card key={inq.id} style={{padding:'14px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{inq.applicant_full_name||'Unnamed applicant'} - {inq.insurance_plans?.plan_name}</div>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'10px'}}>
              {members.map(m=>(
                <Btn key={m.id} variant="primary" style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>assignInquiry(inq.id, m.id)} disabled={assigningId===inq.id}>{m.full_name}</Btn>
              ))}
            </div>
          </Card>
        ))}
      </>}

      {transferRequests.length>0&&<>
        <SecLabel>Transfer requests</SecLabel>
        {transferRequests.map(r=>{
          const needsPick = !r.to_agent_id
          const picked = transferPicks[r.id] || ''
          const eligible = members.filter(m=>m.id!==r.from_agent_id)
          return (
          <Card key={r.id} style={{padding:'14px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{r.agent_policies?.patient_name} - {r.agent_policies?.plan_name}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginTop:'2px'}}>{r.from?.full_name||'Agent'} wants to hand this to {r.to?.full_name||'another member (your pick)'}{r.reason?`: ${r.reason}`:''}</div>
            {needsPick&&<select value={picked} onChange={e=>setTransferPicks(prev=>({...prev,[r.id]:e.target.value}))} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'12px',marginTop:'8px',boxSizing:'border-box'}}>
              <option value="">Pick who gets this client</option>
              {eligible.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>}
            <div style={{display:'flex',gap:'8px',marginTop:'10px'}}>
              <Btn variant="primary" style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>decideTransfer(r, true, picked)} disabled={needsPick&&!picked}>Approve</Btn>
              <Btn style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>decideTransfer(r, false)}>Reject</Btn>
            </div>
          </Card>
          )
        })}
      </>}

      <SecLabel>Members</SecLabel>
      {!loading&&members.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'10px'}}>No members yet.</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'16px'}}>
        {members.map(m=>(
          <Card key={m.id} style={{padding:'10px 16px',display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:'13px'}}>{m.full_name}{team.team_lead_agent_id===m.id?' (lead)':''}</span>
            <span style={{fontSize:'11px',color:C.textMuted}}>{m.medsa_id}</span>
          </Card>
        ))}
      </div>
      {notice&&<div style={{fontSize:'11px',color:C.textSub,marginBottom:'10px'}}>{notice}</div>}
      {showAddMember ? (
        <Card style={{padding:'16px',marginBottom:'20px'}}>
          {[['fullName','Full name (blank if adding an existing agent)'],['email','Email'],['phone','Phone'],['licenseNumber','License number']].map(([k,ph])=>(
            <input key={k} value={memberForm[k]} onChange={e=>setMemberForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}/>
          ))}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setShowAddMember(false)}>Cancel</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={handleAddMember} disabled={saving||!memberForm.email.trim()}>{saving?'Saving…':'Add / appoint'}</Btn>
          </div>
        </Card>
      ) : (
        <div style={{marginBottom:'20px'}}><Btn variant="primary" style={{width:'100%'}} onClick={()=>setShowAddMember(true)}>+ Add member</Btn></div>
      )}

      <SecLabel>Won-inquiry assignment</SecLabel>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
        {[['confirmer','Whoever confirmed'],['random','Random member'],['manual','I assign manually']].map(([k,l])=>(
          <div key={k} onClick={()=>setAssignmentMode(k)} style={{flex:1,padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:team.assignment_mode===k?C.green:C.card,color:team.assignment_mode===k?'#fff':C.text}}>{l}</div>
        ))}
      </div>

      <SecLabel>Plans this team is authorized to sell</SecLabel>
      {plans.length===0&&<div style={{fontSize:'12px',color:C.textMuted}}>No plans in your insurer's basket yet.</div>}
      {plans.map(p=>(
        <div key={p.id} onClick={()=>toggleAuthorization(p.id, p.plan_name)} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',cursor:'pointer'}}>
          <div style={{width:16,height:16,borderRadius:'4px',border:`1.5px solid ${authorizedPlanIds.has(p.id)?C.green:C.border}`,background:authorizedPlanIds.has(p.id)?C.green:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'#fff',flexShrink:0}}>{authorizedPlanIds.has(p.id)?'✓':''}</div>
          <span style={{fontSize:'13px'}}>{p.plan_name}</span>
        </div>
      ))}
      {savedNotice&&<div style={{fontSize:'11px',color:C.green,fontWeight:500,marginTop:'6px'}}>{savedNotice}</div>}
    </PageWrap>
  )
}

// ── ROOT ──────────────────────────────────────────────────────────────────
// ── PENDING CLAIMS REVIEW ────────────────────────────────────────────────
// Claims that adjudicateClaim flagged - an unverified/out-of-network
// practitioner, or a plan that requires a referral and doesn't have an
// approved one yet. Never auto-settled; this is the manual step that
// decides whether it goes through. Scoped to this agent's own book of
// business (policies they wrote), same scoping as everything else here.
function ClaimsReviewScreen({ agent }) {
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: myPolicies } = await supabase.from('agent_policies').select('plan_id').eq('agent_id', agent.id)
    const planIds = [...new Set((myPolicies||[]).map(p=>p.plan_id).filter(Boolean))]
    if (planIds.length === 0) { setClaims([]); setLoading(false); return }
    const { data } = await supabase.from('insurance_claims').select('*, patients(full_name), insurance_plans(plan_name, company_name)')
      .eq('status', 'pending_review').in('plan_id', planIds).order('submitted_at', { ascending: false })
    setClaims(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleDecision(claim, approve) {
    const payableTotal = (claim.patient_copay_amount||0) + (claim.deductible_applied||0)
    const settlesNow = approve && payableTotal === 0
    await supabase.from('insurance_claims').update({
      status: approve ? (settlesNow ? 'settled' : 'approved') : 'rejected',
      settled_at: settlesNow ? new Date().toISOString() : null,
    }).eq('id', claim.id)
    load()
  }

  return (
    <PageWrap maxWidth={680}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'6px',textAlign:'center'}}>Pending Claims</h2>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'20px',textAlign:'center'}}>Flagged for review - an unverified practitioner, or a referral requirement not yet met. Nothing here auto-settles until you decide.</div>
      {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted}}>Loading...</div>}
      {!loading&&claims.length===0&&<div style={{textAlign:'center',fontSize:'13px',color:C.textMuted,padding:'20px'}}>Nothing pending review.</div>}
      {claims.map(c=>(
        <Card key={c.id} style={{padding:'16px 18px',marginBottom:'10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
            <div>
              <div style={{fontSize:'14px',fontWeight:700}}>{c.patients?.full_name || 'Unknown patient'}</div>
              <div style={{fontSize:'11px',color:C.textSub}}>{c.insurance_plans?.plan_name} · {c.insurance_plans?.company_name}</div>
            </div>
            <Badge text={c.verification_flag==='referral_required'?'Referral required':'Unverified practitioner'} type="due"/>
          </div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>Claim {c.claim_ref} · HK${c.amount}</div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn variant="primary" style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>handleDecision(c, true)}>Approve</Btn>
            <Btn style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>handleDecision(c, false)}>Reject</Btn>
          </div>
        </Card>
      ))}
    </PageWrap>
  )
}

// ── REFERRALS REVIEW ─────────────────────────────────────────────────────
// Referrals submitted via /referral-portal by out-of-network doctors.
// Not insurer-scoped - a referral exists independently of which plan
// eventually processes the claim it supports, so every agent sees the
// same shared queue here.
function ReferralsScreen({ agent }) {
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('referrals').select('*, patients(full_name)').eq('status', 'submitted').order('created_at', { ascending: false })
    setReferrals(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleDecision(referral, approve) {
    await supabase.from('referrals').update({
      status: approve ? 'approved' : 'rejected',
      reviewed_by: agent.name, reviewed_at: new Date().toISOString(),
    }).eq('id', referral.id)
    load()
  }

  return (
    <PageWrap maxWidth={680}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'6px',textAlign:'center'}}>Referrals</h2>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'20px',textAlign:'center'}}>Submitted through the out-of-network referral portal. Approving one is what lets a plan requiring a referral treat the matching claim as covered.</div>
      {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted}}>Loading...</div>}
      {!loading&&referrals.length===0&&<div style={{textAlign:'center',fontSize:'13px',color:C.textMuted,padding:'20px'}}>No referrals waiting for review.</div>}
      {referrals.map(r=>(
        <Card key={r.id} style={{padding:'16px 18px',marginBottom:'10px'}}>
          <div style={{fontSize:'14px',fontWeight:700,marginBottom:'2px'}}>{r.patients?.full_name || 'Unknown patient'}</div>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'4px'}}>Referred by {r.referring_doctor_name}{r.referring_doctor_mchk_no?` (MCHK ${r.referring_doctor_mchk_no})`:''}{r.referring_practice_name?` · ${r.referring_practice_name}`:''}</div>
          <div style={{fontSize:'10px',color:r.referring_staff_medsa_id?C.green:(r.referring_clinic_verification_id?C.green:C.amber),marginBottom:'8px',fontWeight:600}}>
            {r.referring_staff_medsa_id ? '✓ Verified - existing Medsa doctor login' : r.referring_clinic_verification_id ? '✓ Verified - practice OTP-confirmed' : '⚠ Not identity-verified'}
          </div>
          <div style={{fontSize:'12px',color:C.text,marginBottom:'4px'}}>To: <strong>{r.referred_to_practitioner_name}</strong></div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>{r.reason}</div>
          {r.clinical_notes&&<div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>{r.clinical_notes}</div>}
          {r.document_paths?.length>0&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>{r.document_paths.length} document(s) attached</div>}
          <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
            <Btn variant="primary" style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>handleDecision(r, true)}>Approve</Btn>
            <Btn style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>handleDecision(r, false)}>Reject</Btn>
          </div>
        </Card>
      ))}
    </PageWrap>
  )
}

export default function AgentApp() {
  const [agent,setAgent]=useState(null)
  const [screen,setScreen]=useState('overview')
  const [prefillInquiry,setPrefillInquiry]=useState(null)
  const [policies,setPolicies]=useState([])
  const [inquiries,setInquiries]=useState([])
  const [newInquiryCount,setNewInquiryCount]=useState(0)
  const [loading,setLoading]=useState(true)
  const [myLeadTeam,setMyLeadTeam]=useState(null)

  useEffect(() => {
    if (!agent?.id) { setMyLeadTeam(null); return }
    supabase.from('insurance_teams').select('*').eq('team_lead_agent_id', agent.id).maybeSingle()
      .then(({data}) => setMyLeadTeam(data||null))
  }, [agent?.id])

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

    // Same insurer-scoping PlanInquiriesScreen.load() applies to the actual
    // list - this badge counted every unclaimed inquiry system-wide before,
    // so an agent with nothing to claim (wrong insurer) still saw a nonzero
    // count with an empty list behind it.
    let myCompanyNames = []
    if (a.agent_type === 'captive') {
      myCompanyNames = a.institutions?.name ? [a.institutions.name] : []
    } else {
      const { data: appts } = await supabase.from('agent_institution_appointments')
        .select('institutions(name)').eq('agent_id', a.id).eq('status','active')
      myCompanyNames = [...new Set((appts||[]).map(x=>x.institutions?.name).filter(Boolean))]
    }
    const { count } = myCompanyNames.length===0 ? { count: 0 } : await supabase.from('plan_inquiries')
      .select('id, insurance_plans!inner(company_name)', {count:'exact', head:true})
      .is('claimed_by_agent_id', null).or('mode.is.null,mode.neq.auto').in('insurance_plans.company_name', myCompanyNames)
    setNewInquiryCount(count||0)
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
    {key:'planinquiries', icon:'\u25c6', label:'New Plan Inquiries', badge: newInquiryCount},
    {key:'claimsreview', icon:'\u26a0', label:'Pending Claims'},
    {key:'referrals', icon:'\u25c8', label:'Referrals'},
    {key:'renewals', icon:'\u25ce', label:'Renewals', badge: renewalsSoonCount},
    ...(myLeadTeam ? [{key:'team', icon:'\u25c6', label:`Team: ${myLeadTeam.name}`}] : []),
  ]

  if (!agent) return <AgentLogin onLogin={setAgent}/>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:C.beige,fontFamily:'system-ui, -apple-system, sans-serif'}}>
      <Sidebar screen={screen} setScreen={setScreen} agent={agent} navItems={navItems} onLogout={()=>{setAgent(null);setScreen('overview')}}/>
      <div style={{flex:1,padding:'32px 40px',overflowY:'auto'}}>
        {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted}}>Loading...</div>}
        {!loading&&screen==='overview'&&<OverviewScreen agent={agent} policies={policies} inquiries={inquiries}/>}
        {!loading&&screen==='policies'&&<PoliciesScreen agent={agent} policies={policies} onNewPolicy={()=>{setPrefillInquiry(null);setScreen('newpolicy')}} onReload={()=>loadData(agent)}/>}
        {!loading&&screen==='newpolicy'&&<NewPolicyScreen agent={agent} prefillInquiry={prefillInquiry} onBack={()=>setScreen(prefillInquiry?'planinquiries':'policies')} onSaved={()=>{loadData(agent);setPrefillInquiry(null);setScreen('policies')}}/>}
        {!loading&&screen==='inquiries'&&<ClaimInquiriesScreen agent={agent} inquiries={inquiries} onStatusChange={handleStatusChange}/>}
        {!loading&&screen==='planinquiries'&&<PlanInquiriesScreen agent={agent} onConvert={(inq)=>{setPrefillInquiry(inq);setScreen('newpolicy')}}/>}
        {!loading&&screen==='claimsreview'&&<ClaimsReviewScreen agent={agent}/>}
        {!loading&&screen==='referrals'&&<ReferralsScreen agent={agent}/>}
        {!loading&&screen==='renewals'&&<RenewalsScreen agent={agent} policies={policies} onRenewed={()=>loadData(agent)}/>}
        {!loading&&screen==='team'&&myLeadTeam&&<TeamLeadScreen agent={agent} team={myLeadTeam}/>}
      </div>
    </div>
  )
}
