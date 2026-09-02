import { useState, useEffect } from 'react'
import MedsaLogo from '../shared/MedsaLogo'
import C from '../shared/colours'
import { supabase } from '../../lib/supabase'

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

// ── INSURANCE DASHBOARD ───────────────────────────────────────────────────────
function InsuranceDashboard({ onNav, company }) {
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px 0',background:`linear-gradient(135deg,${C.navy} 0%,${C.blue} 100%)`,borderRadius:'16px',padding:'20px',color:'#fff'}}>
        <div style={{fontSize:'11px',opacity:0.65,letterSpacing:'1px',textTransform:'uppercase'}}>{company?.name||'Insurance'} — Partner dashboard</div>
        <div style={{fontSize:'18px',fontWeight:700,marginTop:'4px'}}>Welcome back</div>
        <div style={{fontSize:'13px',opacity:0.8,marginTop:'2px'}}>{company?.relationshipType==='unpartnered'?'TPA claims service':'Partner'}</div>
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
        {(company?.relationshipType==='unpartnered' ? [
          {key:'claims',icon:'◇',label:'Claims log',sub:'Claims Medsa has processed for you'},
        ] : [
          {key:'plans',icon:'▣',label:'Manage plans',sub:'Add, edit, sponsor plan listings'},
          {key:'claims',icon:'◇',label:'Claims log',sub:'All claims — pending, approved, rejected'},
          {key:'ads',icon:'⬡',label:'Sponsored listings',sub:'Promote plans in AI recommendations'},
          {key:'analytics',icon:'◈',label:'Analytics',sub:'Views, referrals, conversion'},
        ]).map(item=>(
          <div key={item.key} onClick={()=>onNav(item.key)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px 16px',marginBottom:'10px',cursor:'pointer',display:'flex',alignItems:'center',gap:'14px'}}>
            <div style={{width:40,height:40,background:C.navyLight,borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.navy,flexShrink:0}}>{item.icon}</div>
            <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{item.label}</div><div style={{fontSize:'12px',color:C.textSub}}>{item.sub}</div></div>
            <span style={{color:C.textMuted,fontSize:'18px'}}>›</span>
          </div>
        ))}
      </div>
      {company?.relationshipType==='unpartnered' ? (
        <div style={{margin:'0 16px 16px',background:`linear-gradient(135deg,${C.navy} 0%,${C.blue} 100%)`,borderRadius:'14px',padding:'16px'}}>
          <div style={{fontSize:'13px',color:'#fff',fontWeight:600,marginBottom:'6px'}}>⬡ Want a sponsored spot in patient search?</div>
          <div style={{fontSize:'12px',color:'rgba(255,255,255,0.8)',lineHeight:1.6,marginBottom:'12px'}}>Sponsored placements, plan listings, and client management are part of a full Medsa Partnership - a closer, integrated relationship beyond claims processing. Upgrade to get your plans in front of patients directly.</div>
          <a href="/insurer-signup" style={{display:'block',textAlign:'center',background:'#fff',color:C.navy,borderRadius:'8px',padding:'10px',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>Apply for a Partnership</a>
        </div>
      ) : (
        <div style={{margin:'0 16px 16px',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px'}}>
          <div style={{fontSize:'12px',color:C.brown,fontWeight:600,marginBottom:'4px'}}>How Medsa partner listings work</div>
          <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>Your plans appear in patient searches and AI recommendations. Sponsored plans get priority placement. Medsa charges a listing fee + referral commission. Claims submitted via Medsa are routed to your existing system via webhook.</div>
        </div>
      )}
    </div>
  )
}

// ── PLAN MANAGER ──────────────────────────────────────────────────────────────
function PlanManager({ company }) {
  const [plans,setPlans]=useState([])
  const [loading,setLoading]=useState(true)
  const [creating,setCreating]=useState(false)
  const [saving,setSaving]=useState(false)
  const [form,setForm]=useState({ plan_name:'', plan_type:'', key_benefits:'' })
  const [tiers,setTiers]=useState([{ age_min:'', age_max:'', monthly_premium:'', annual_limit:'' }])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('insurance_plans').select('*, insurance_plan_pricing_tiers(*)').eq('company_name',company.name).order('created_at',{ascending:false})
    setPlans(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function updateTier(i, field, value) {
    setTiers(t => t.map((tier,idx) => idx===i ? {...tier, [field]: value} : tier))
  }
  function addTier() {
    setTiers(t => [...t, { age_min:'', age_max:'', monthly_premium:'', annual_limit:'' }])
  }
  function removeTier(i) {
    setTiers(t => t.filter((_,idx)=>idx!==i))
  }

  async function handleSubmit() {
    const validTiers = tiers.filter(t => t.age_min!=='' && t.age_max!=='' && t.monthly_premium!=='')
    if (!form.plan_name || validTiers.length===0) return
    setSaving(true)
    const { data: newPlan } = await supabase.from('insurance_plans').insert({
      company_name: company.name, plan_name: form.plan_name, plan_type: form.plan_type || null,
      key_benefits: form.key_benefits || null, status: 'active',
    }).select().maybeSingle()
    if (newPlan) {
      await supabase.from('insurance_plan_pricing_tiers').insert(
        validTiers.map(t => ({
          plan_id: newPlan.id, age_min: parseInt(t.age_min), age_max: parseInt(t.age_max),
          monthly_premium: parseFloat(t.monthly_premium),
          annual_limit: t.annual_limit ? parseFloat(t.annual_limit) : null,
        }))
      )
    }
    setSaving(false); setCreating(false)
    setForm({ plan_name:'', plan_type:'', key_benefits:'' })
    setTiers([{ age_min:'', age_max:'', monthly_premium:'', annual_limit:'' }])
    load()
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>Your listed plans</SecLabel>
      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&plans.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>No plans listed yet.</div>}
      {!loading&&plans.map((p)=>(
        <Card key={p.id} style={{padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
            <div>
              <div style={{fontSize:'14px',fontWeight:600}}>{p.plan_name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{p.plan_type||'—'}</div>
            </div>
            {p.sponsored&&<span style={{fontSize:'10px',background:C.amberLight,color:C.amber,padding:'2px 8px',borderRadius:'20px',fontWeight:600}}>Sponsored</span>}
          </div>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'12px'}}>
            {(p.insurance_plan_pricing_tiers||[]).length===0
              ? <span style={{color:C.red}}>No pricing tiers entered</span>
              : p.insurance_plan_pricing_tiers.sort((a,b)=>a.age_min-b.age_min).map(t=>`Age ${t.age_min}-${t.age_max}: HK$${t.monthly_premium}/mo`).join(' · ')}
          </div>
        </Card>
      ))}
      {creating&&(
        <Card style={{padding:'16px'}}>
          <div style={{fontSize:'14px',fontWeight:600,marginBottom:'14px'}}>New plan listing</div>
          <div style={{marginBottom:'12px'}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Plan name</div>
            <input value={form.plan_name} onChange={e=>setForm(f=>({...f,plan_name:e.target.value}))} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}} placeholder="e.g. AIA Gold Health"/>
          </div>
          <div style={{marginBottom:'12px'}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Plan type</div>
            <input value={form.plan_type} onChange={e=>setForm(f=>({...f,plan_type:e.target.value}))} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}} placeholder="e.g. Comprehensive, Critical illness"/>
          </div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Pricing tiers - real pricing varies by age, so at least one tier is required</div>
          {tiers.map((tier,i)=>(
            <div key={i} style={{background:C.beige,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',marginBottom:'8px'}}>
              <div style={{display:'flex',gap:'6px',marginBottom:'6px'}}>
                <input type="number" value={tier.age_min} onChange={e=>updateTier(i,'age_min',e.target.value)} placeholder="Age from" style={{flex:1,padding:'8px',fontSize:'12px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
                <input type="number" value={tier.age_max} onChange={e=>updateTier(i,'age_max',e.target.value)} placeholder="Age to (120 for +)" style={{flex:1,padding:'8px',fontSize:'12px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
              </div>
              <div style={{display:'flex',gap:'6px'}}>
                <input type="number" value={tier.monthly_premium} onChange={e=>updateTier(i,'monthly_premium',e.target.value)} placeholder="Monthly premium (HK$)" style={{flex:1,padding:'8px',fontSize:'12px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
                <input type="number" value={tier.annual_limit} onChange={e=>updateTier(i,'annual_limit',e.target.value)} placeholder="Annual limit (optional)" style={{flex:1,padding:'8px',fontSize:'12px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
                {tiers.length>1&&<button onClick={()=>removeTier(i)} style={{padding:'0 10px',background:C.redLight,color:C.red,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>×</button>}
              </div>
            </div>
          ))}
          <button onClick={addTier} style={{width:'100%',padding:'8px',background:C.beige,border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',cursor:'pointer',marginBottom:'12px'}}>+ Add another age tier</button>
          <div style={{marginBottom:'12px'}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>What's covered (key benefits)</div>
            <textarea value={form.key_benefits} onChange={e=>setForm(f=>({...f,key_benefits:e.target.value}))} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',boxSizing:'border-box'}} rows={3} placeholder="Hospitalisation, outpatient, specialist, dental…"/>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setCreating(false)}>Cancel</Btn>
            <Btn variant="navy" style={{flex:1}} onClick={handleSubmit} disabled={saving||!form.plan_name||!tiers.some(t=>t.age_min!==''&&t.age_max!==''&&t.monthly_premium!=='')}>{saving?'Saving…':'Submit plan'}</Btn>
          </div>
        </Card>
      )}
      {!creating&&<div style={{padding:'0 16px 16px'}}><Btn variant="navy" style={{width:'100%'}} onClick={()=>setCreating(true)}>+ Add new plan</Btn></div>}
    </div>
  )
}

// ── CLAIMS LOG (admin view - real claims, tap one to approve/reject) ──────────
// Was a hardcoded sample array (fake patients, fake "Admin override" buttons
// that did nothing) - now the real insurance_claims table, same rows an
// agent sees via their emailed /claim-review link. Tapping a card opens
// that same real AgentClaimView right here instead of only being reachable
// via a link, so this dashboard isn't a second, disconnected surface.
function InsuranceAdminClaimsLog({ onOpenClaim, company }) {
  const [filter,setFilter]=useState('All')
  const [claims,setClaims]=useState([])
  const [loading,setLoading]=useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Scoped to the logged-in company, matching PlanManager's own
      // company_name filter above - this dashboard is a single insurer's
      // view, not a cross-insurer one.
      const { data } = await supabase.from('insurance_claims')
        .select('*, patients(full_name), insurance_plans!inner(plan_name, company_name)')
        .eq('insurance_plans.company_name', company.name)
        .order('submitted_at', { ascending: false })
        .limit(50)
      setClaims(data||[])
      setLoading(false)
    }
    load()
  }, [company.name])

  const statusMeta = {
    approved: {label:'Approved', type:'ok'},
    partially_approved: {label:'Partially approved', type:'due'},
    rejected: {label:'Rejected', type:'full'},
    pending_review: {label:'Pending review', type:'due'},
    settled: {label:'Settled', type:'ok'},
  }
  const sourceLabel = { clinic_ops:'ClinicOps', external_clinic:'TPA portal', api_client:'Insurer API' }
  const filtered = filter==='All' ? claims
    : filter==='Pending' ? claims.filter(c=>c.status==='pending_review')
    : filter==='Approved' ? claims.filter(c=>['approved','partially_approved','settled'].includes(c.status))
    : claims.filter(c=>c.status==='rejected')
  const counts = {
    Pending: claims.filter(c=>c.status==='pending_review').length,
    Approved: claims.filter(c=>['approved','partially_approved','settled'].includes(c.status)).length,
    Rejected: claims.filter(c=>c.status==='rejected').length,
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px'}}>
        <div style={{fontSize:'12px',color:C.navy,lineHeight:1.6}}><strong>Claims flow:</strong> Submitted via ClinicOps, the TPA portal, or the direct API - all land here. Tap a claim to approve or reject it, same decision an agent makes from their emailed link.</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',padding:'16px 16px 0'}}>
        {[{label:'Pending',value:counts.Pending,color:C.amber,bg:C.amberLight},{label:'Approved',value:counts.Approved,color:C.green,bg:C.greenLight},{label:'Rejected',value:counts.Rejected,color:C.red,bg:C.redLight}].map(s=>(
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
      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&filtered.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>No claims here yet.</div>}
      {filtered.map((c)=>{
        const meta = statusMeta[c.status] || {label:c.status, type:'due'}
        return (
          <Card key={c.id} onClick={()=>onOpenClaim(c.claim_ref)} style={{padding:'14px 16px',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{c.patients?.full_name||'Unknown patient'}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{c.insurance_plans?.plan_name}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'15px',fontWeight:700,color:C.navy}}>HK${c.amount}</div>
                <Badge text={meta.label} type={meta.type}/>
              </div>
            </div>
            <div style={{fontSize:'11px',color:C.textMuted}}>
              Submitted {c.submitted_at?new Date(c.submitted_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'}):'-'} · {c.claim_ref} · via {sourceLabel[c.source_type]||'ClinicOps'}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ── AGENT CLAIM VIEW (standalone page sent to agents via link) ────────────────
// Real claim, real decision - claimRef comes from the URL (see
// pages/claim-review.jsx), same pattern as the /referral-portal?receive=
// and /share links elsewhere. Was previously a single hardcoded claim
// object with no props at all - approve/reject never wrote anywhere.
export function AgentClaimView({ claimRef }) {
  const [decision,setDecision]=useState(null)
  const [reason,setReason]=useState('')
  const [otherReason,setOtherReason]=useState('')
  const [submitted,setSubmitted]=useState(false)
  const [submitting,setSubmitting]=useState(false)
  const [claim,setClaim]=useState(null)
  const [medicalRecord,setMedicalRecord]=useState(null)
  const [attachments,setAttachments]=useState([])
  const [loading,setLoading]=useState(true)
  const [notFound,setNotFound]=useState(false)
  const REJECT_REASONS=['Not covered under current plan','Pre-existing condition exclusion','Missing supporting documents','Treatment not pre-authorised','Duplicate claim','Other (specify below)']

  useEffect(() => {
    async function load() {
      if (!claimRef) { setLoading(false); setNotFound(true); return }
      const { data: c } = await supabase.from('insurance_claims')
        .select('*, patients(full_name, medsa_id), insurance_plans(plan_name, company_name)')
        .eq('claim_ref', claimRef).maybeSingle()
      if (!c) { setLoading(false); setNotFound(true); return }
      setClaim(c)
      const { data: rec } = await supabase.from('medical_records').select('*').eq('insurance_claim_id', c.id).maybeSingle()
      setMedicalRecord(rec||null)
      if (rec) {
        const { data: atts } = await supabase.from('medical_record_attachments').select('*').eq('medical_record_id', rec.id)
        setAttachments(atts||[])
      }
      setLoading(false)
    }
    load()
  }, [claimRef])

  async function handleDecide() {
    if (!claim) return
    setSubmitting(true)
    const finalReason = reason==='Other (specify below)' ? otherReason : reason
    if (decision==='approve') {
      const payable = (claim.patient_copay_amount||0) + (claim.deductible_applied||0)
      await supabase.from('insurance_claims').update({
        status: payable===0 ? 'settled' : 'approved',
        settled_at: payable===0 ? new Date().toISOString() : null,
      }).eq('id', claim.id)
    } else {
      await supabase.from('insurance_claims').update({ status:'rejected', rejection_reason: finalReason||null }).eq('id', claim.id)
    }
    setSubmitting(false)
    setSubmitted(true)
  }

  if (loading) return <div style={{background:C.beige,flex:1,padding:'32px 20px',textAlign:'center',fontSize:'13px',color:C.textMuted}}>Loading...</div>
  if (notFound) return <div style={{background:C.beige,flex:1,padding:'32px 20px',textAlign:'center',fontSize:'13px',color:C.textMuted}}>No claim found for this link.</div>

  if(submitted) return (
    <div style={{background:C.beige,flex:1,padding:'32px 20px',textAlign:'center'}}>
      <div style={{fontSize:'40px',marginBottom:'16px'}}>{decision==='approve'?'✓':'◎'}</div>
      <div style={{fontSize:'18px',fontWeight:700,color:decision==='approve'?C.green:C.red,marginBottom:'8px'}}>Claim {decision==='approve'?'approved':'rejected'}</div>
      <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',textAlign:'left'}}>
        <div style={{fontSize:'13px',fontWeight:500}}>Claim {claim.claim_ref} · {decision==='approve'?'Approved':'Rejected'}</div>
        {reason&&<div style={{fontSize:'12px',color:C.textSub,marginTop:'4px'}}>Reason: {reason==='Other (specify below)'?otherReason:reason}</div>}
      </div>
    </div>
  )
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:C.navy,padding:'20px 16px',color:'#fff'}}>
        <div style={{fontSize:'11px',opacity:0.6,letterSpacing:'1px',textTransform:'uppercase',marginBottom:'4px'}}>Claim review · {claim.claim_ref}</div>
        <div style={{fontSize:'18px',fontWeight:700}}>{claim.patients?.full_name||'Unknown patient'}</div>
        <div style={{fontSize:'12px',opacity:0.8,marginTop:'2px'}}>{claim.insurance_plans?.plan_name} · Submitted {new Date(claim.submitted_at).toLocaleString('en-HK',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <SecLabel>Claim details</SecLabel>
      <Card style={{padding:'0 16px'}}>
        {[['Claim ID',claim.claim_ref],['Patient',claim.patients?.full_name],['Medsa ID',claim.patients?.medsa_id],['Insurer',claim.insurance_plans?.company_name],claim.icd10_codes?['ICD-10',claim.icd10_codes]:null,['Total amount',`HK$${claim.amount}`],['Insurer covers',`HK$${claim.insurer_covered_amount}`],['Patient pays',`HK$${(claim.patient_copay_amount||0)+(claim.deductible_applied||0)}`]].filter(Boolean).map(([l,v],i,arr)=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}><span style={{color:C.textSub}}>{l}</span><span style={{fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{v||'—'}</span></div>
        ))}
      </Card>
      {claim.verification_flag&&<div style={{margin:'0 16px 16px',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'10px 14px',fontSize:'12px',color:C.amber}}>{'⚠'} Flagged: {claim.verification_flag==='referral_required'?'referral required, not yet approved':'treating practitioner not verified'}</div>}
      <SecLabel>Clinical notes</SecLabel>
      <Card style={{padding:'14px 16px'}}>
        {medicalRecord ? <div style={{fontSize:'13px',color:C.text,lineHeight:1.6}}>{medicalRecord.diagnosis&&<div style={{fontWeight:600,marginBottom:'4px'}}>{medicalRecord.diagnosis}</div>}{medicalRecord.notes||'No notes on file.'}</div>
          : <div style={{fontSize:'12px',color:C.textMuted,fontStyle:'italic'}}>No linked consultation record.</div>}
      </Card>
      <SecLabel>Supporting documents</SecLabel>
      <Card style={{padding:'12px 16px'}}>
        {attachments.length===0&&<div style={{fontSize:'12px',color:C.textMuted,fontStyle:'italic',padding:'4px 0'}}>None on file.</div>}
        {attachments.map((doc,i,arr)=>(
          <div key={doc.id} style={{padding:'8px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',fontSize:'13px',color:C.text}}>{doc.file_name||doc.category}</div>
        ))}
      </Card>
      <SecLabel>Your decision</SecLabel>
      <div style={{padding:'0 16px',display:'flex',gap:'10px',marginBottom:'12px'}}>
        <div onClick={()=>setDecision('approve')} style={{flex:1,border:`1.5px solid ${decision==='approve'?C.green:C.border}`,background:decision==='approve'?C.greenXLight:C.cream,borderRadius:'12px',padding:'14px',textAlign:'center',cursor:'pointer'}}>
          <div style={{fontSize:'20px',marginBottom:'4px'}}>✓</div>
          <div style={{fontSize:'13px',fontWeight:600,color:decision==='approve'?C.green:C.textSub}}>Approve</div>
          <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>Pay HK${claim.insurer_covered_amount}</div>
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
            <textarea value={otherReason} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginTop:'6px'}} rows={3} placeholder="Specify reason…" onChange={e=>setOtherReason(e.target.value)}/>
          )}
        </div>
      )}
      {decision&&(
        <div style={{padding:'0 16px 24px'}}>
          <button onClick={handleDecide} disabled={submitting||(decision==='reject'&&!reason)} style={{width:'100%',border:'none',background:decision==='approve'?C.green:C.red,borderRadius:'10px',padding:'14px',fontSize:'14px',fontWeight:500,cursor:'pointer',color:'#fff',fontFamily:'inherit',opacity:submitting||(decision==='reject'&&!reason)?0.6:1}}>
            {submitting?'Saving...':decision==='approve'?`Approve · HK$${claim.insurer_covered_amount}`:'Reject claim'}
          </button>
          {decision==='reject'&&!reason&&<div style={{fontSize:'11px',color:C.amber,textAlign:'center',marginTop:'8px'}}>Please select a rejection reason before submitting.</div>}
        </div>
      )}
    </div>
  )
}

// ── SPONSORED LISTINGS ────────────────────────────────────────────────────────
// Self-serve, pay-and-push - no Medsa approval step (unlike the
// carousel/newsletter sponsor flow). Real plans, real Stripe Checkout,
// real expiry - was entirely hardcoded sample data with a "Launch
// sponsorship" button that submitted nothing.
function SponsoredListings({ company }) {
  const [plans,setPlans]=useState([])
  const [loading,setLoading]=useState(true)
  const [selectedPlanId,setSelectedPlanId]=useState('')
  const [months,setMonths]=useState(3)
  const [starting,setStarting]=useState(false)
  const [error,setError]=useState(null)
  const RATE = 3000

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('insurance_plans').select('id, plan_name, sponsored, sponsored_until, sponsor_price_hkd').eq('company_name', company.name).order('plan_name')
    setPlans(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [company.name])

  const today = new Date().toISOString().slice(0,10)
  const active = plans.filter(p => p.sponsored && p.sponsored_until >= today)
  const available = plans.filter(p => !(p.sponsored && p.sponsored_until >= today))

  async function handleLaunch() {
    if (!selectedPlanId) return
    setStarting(true); setError(null)
    try {
      const res = await fetch('/api/insurer/create_sponsor_checkout', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ planId: selectedPlanId, companyId: company.id, months }),
      })
      const data = await res.json()
      if (data.status === 'CREATED' && data.paymentUrl) { window.location.href = data.paymentUrl; return }
      setError(data.message || 'Could not start checkout.')
    } catch {
      setError('Something went wrong - please try again.')
    }
    setStarting(false)
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'16px'}}>
        <div style={{fontSize:'14px',fontWeight:600,color:C.navy,marginBottom:'6px'}}>⬡ Sponsored placements</div>
        <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>Sponsored plans get priority placement in patient searches and AI recommendations for the period you pay for. HK${RATE.toLocaleString()}/month, charged upfront for the duration you pick - no approval needed, it goes live as soon as payment clears.</div>
      </div>
      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      <SecLabel>Active sponsorships</SecLabel>
      {!loading&&active.length===0&&<div style={{fontSize:'12px',color:C.textMuted,padding:'0 16px 10px'}}>None right now.</div>}
      {active.map(p=>(
        <Card key={p.id} style={{padding:'14px 16px'}}>
          <div style={{fontSize:'14px',fontWeight:500,marginBottom:'4px'}}>{p.plan_name}</div>
          <div style={{fontSize:'12px',color:C.textSub}}>Sponsored until {new Date(p.sponsored_until).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}{p.sponsor_price_hkd?` · paid HK$${p.sponsor_price_hkd.toLocaleString()}`:''}</div>
        </Card>
      ))}
      <SecLabel>Sponsor a plan</SecLabel>
      <Card style={{padding:'16px'}}>
        {available.length===0
          ? <div style={{fontSize:'12px',color:C.textMuted}}>{plans.length===0?'Add a plan under "Manage plans" first.':'All your plans are already sponsored.'}</div>
          : <>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Select plan</div>
            <select value={selectedPlanId} onChange={e=>setSelectedPlanId(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box'}}>
              <option value="">Choose a plan…</option>
              {available.map(p=><option key={p.id} value={p.id}>{p.plan_name}</option>)}
            </select>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Duration</div>
            <div style={{display:'flex',gap:'8px',marginBottom:'14px'}}>
              {[1,3,6].map(m=>(
                <div key={m} onClick={()=>setMonths(m)} style={{flex:1,padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:months===m?C.navy:C.beige,color:months===m?'#fff':C.text,border:`0.5px solid ${months===m?C.navy:C.border}`}}>{m} mo · HK${(RATE*m).toLocaleString()}</div>
              ))}
            </div>
            {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
            <Btn variant="navy" style={{width:'100%'}} onClick={handleLaunch} disabled={!selectedPlanId||starting}>{starting?'Starting checkout…':`Pay HK$${(RATE*months).toLocaleString()} & launch`}</Btn>
          </>}
      </Card>
    </div>
  )
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
// company: {id, name, relationshipType}. This used to be entirely
// hardcoded to "AIA" everywhere below (a demo shell, reachable only from
// behind Medsa's own admin password - see pages/institution.jsx's own
// comment about that) - now driven by whichever real insurer actually
// logged in via pages/insurer-portal.jsx. An unpartnered company (TPA
// service only, no plan/client management) gets a trimmed nav with just
// the claims log - the fuller Plans/Sponsored/Analytics screens are a
// partnered-only concern.
export default function InsuranceApp({ company, onLogout }) {
  const [screen,setScreen]=useState('dashboard')
  const [openClaimRef,setOpenClaimRef]=useState(null)
  const titles={dashboard:'Insurance partner',plans:'Plan listings',claims:'Claims log','claim-detail':'Claim review',ads:'Sponsored listings',analytics:'Analytics'}
  const isPartnered = company?.relationshipType!=='unpartnered'
  const navItems=isPartnered ? [{key:'dashboard',icon:'◈',label:'Overview'},{key:'plans',icon:'▣',label:'Plans'},{key:'claims',icon:'◇',label:'Claims'},{key:'ads',icon:'⬡',label:'Sponsored'},{key:'analytics',icon:'◎',label:'Analytics'}]
    : [{key:'dashboard',icon:'◈',label:'Overview'},{key:'claims',icon:'◇',label:'Claims'}]

  function openClaim(ref) { setOpenClaimRef(ref); setScreen('claim-detail') }

  return (
    <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',maxWidth:'440px',margin:'0 auto',background:C.beige}}>
      <div style={{background:C.navy,padding:'14px 16px',display:'flex',alignItems:'center',gap:'10px',position:'sticky',top:0,zIndex:10}}>
        {screen!=='dashboard'&&<button onClick={()=>setScreen(screen==='claim-detail'?'claims':'dashboard')} style={{background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>}
        <MedsaLogo height={20}/>
        <span style={{flex:1,fontSize:'13px',color:'rgba(255,255,255,0.7)',fontWeight:500}}>{titles[screen]}</span>
        <span style={{fontSize:'10px',background:C.navyLight,color:C.navy,padding:'3px 9px',borderRadius:'20px',fontWeight:600}}>⬡ {company?.name||'Preview'}</span>
        {onLogout&&<span onClick={onLogout} style={{fontSize:'11px',color:'rgba(255,255,255,0.6)',cursor:'pointer'}}>Sign out</span>}
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {screen==='dashboard'&&<InsuranceDashboard onNav={setScreen} company={company}/>}
        {screen==='plans'&&isPartnered&&<PlanManager company={company}/>}
        {screen==='claims'&&<InsuranceAdminClaimsLog onOpenClaim={openClaim} company={company}/>}
        {screen==='claim-detail'&&<AgentClaimView claimRef={openClaimRef}/>}
        {screen==='ads'&&isPartnered&&<SponsoredListings company={company}/>}
        {screen==='analytics'&&isPartnered&&<div style={{padding:'40px 24px',textAlign:'center',color:C.textSub}}><div style={{fontSize:'32px',marginBottom:'12px'}}>◈</div><div style={{fontSize:'16px',fontWeight:600,marginBottom:'6px',color:C.text}}>Analytics</div><div style={{fontSize:'13px'}}>Views, referrals, and conversion data — coming in the next build.</div></div>}
      </div>
      <div style={{background:C.cream,borderTop:`0.5px solid ${C.border}`,display:'flex',padding:'8px 0 6px'}}>
        {navItems.map(item=>(
          <div key={item.key} onClick={()=>setScreen(item.key)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',cursor:'pointer',color:screen===item.key||(screen==='claim-detail'&&item.key==='claims')?C.navy:C.textMuted,fontSize:'10px'}}>
            <span style={{fontSize:'18px',lineHeight:1}}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
