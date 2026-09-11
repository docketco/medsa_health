import { useState, useEffect } from 'react'
import MedsaLogo from '../shared/MedsaLogo'
import C from '../shared/colours'
import { supabase } from '../../lib/supabase'
import { parseCSV } from '../../lib/csvImport'

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
        <div style={{fontSize:'13px',opacity:0.8,marginTop:'2px'}}>{company?.relationshipType==='unpartnered'?'TPA claims service':'Partner'}{company?.medsaId?` · ${company.medsaId}`:''}</div>
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
          {key:'planrules',icon:'▣',label:'Coverage rules',sub:'Register your plans\' deductible/copay so claims calculate correctly'},
          {key:'claims',icon:'◇',label:'Claims log',sub:'Claims Medsa has processed for you'},
          {key:'ads',icon:'⬡',label:'Promote a plan',sub:'Sponsor an individual plan in patient search, priced per month'},
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
          <div style={{fontSize:'13px',color:'#fff',fontWeight:600,marginBottom:'6px'}}>⬡ Want your full catalog on Medsa?</div>
          <div style={{fontSize:'12px',color:'rgba(255,255,255,0.8)',lineHeight:1.6,marginBottom:'12px'}}>You can already promote an individual registered plan into patient search under "Promote a plan" above. A full Medsa Partnership goes further - all your plans listed and sold on Medsa, plus agent/team management.</div>
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

// ── PLAN RIDERS & DEDUCTIBLES (phase 6 - real quoting tools) ──────────────
// What NewPolicyScreen's package builder actually reads from - a plan
// with none of this still works (line item is just the tier premium,
// no add-ons, one flat deductible), it just can't be combined/customized.
function PlanExtrasManager({ plan, onChanged }) {
  const [riders,setRiders]=useState([])
  const [deductibles,setDeductibles]=useState([])
  const [loading,setLoading]=useState(true)
  const [newRider,setNewRider]=useState({ name:'', monthly_premium:'', description:'' })
  const [newDeductible,setNewDeductible]=useState({ deductible_hkd:'', premium_adjustment_pct:'' })

  async function load() {
    setLoading(true)
    const { data: r } = await supabase.from('insurance_plan_riders').select('*').eq('plan_id', plan.id).eq('status','active').order('monthly_premium')
    setRiders(r||[])
    const { data: d } = await supabase.from('insurance_plan_deductible_options').select('*').eq('plan_id', plan.id).order('deductible_hkd')
    setDeductibles(d||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [plan.id])

  async function addRider() {
    if (!newRider.name.trim() || newRider.monthly_premium==='') return
    await supabase.from('insurance_plan_riders').insert({ plan_id: plan.id, name: newRider.name.trim(), monthly_premium: parseFloat(newRider.monthly_premium)||0, description: newRider.description||null })
    setNewRider({ name:'', monthly_premium:'', description:'' })
    load(); onChanged?.()
  }
  async function removeRider(id) {
    await supabase.from('insurance_plan_riders').update({ status:'inactive' }).eq('id', id)
    load(); onChanged?.()
  }
  async function addDeductible() {
    if (newDeductible.deductible_hkd==='') return
    await supabase.from('insurance_plan_deductible_options').insert({ plan_id: plan.id, deductible_hkd: parseFloat(newDeductible.deductible_hkd)||0, premium_adjustment_pct: parseFloat(newDeductible.premium_adjustment_pct)||0 })
    setNewDeductible({ deductible_hkd:'', premium_adjustment_pct:'' })
    load(); onChanged?.()
  }
  async function removeDeductible(id) {
    await supabase.from('insurance_plan_deductible_options').delete().eq('id', id)
    load(); onChanged?.()
  }

  return (
    <div style={{background:C.beige,borderRadius:'8px',padding:'12px',marginTop:'10px'}}>
      {loading&&<div style={{fontSize:'11px',color:C.textMuted}}>Loading…</div>}
      <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',color:C.textMuted,marginBottom:'6px'}}>Riders / add-ons</div>
      {riders.map(r=>(
        <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'12px',padding:'4px 0'}}>
          <span>{r.name} - HK${r.monthly_premium}/mo{r.description?` (${r.description})`:''}</span>
          <span onClick={()=>removeRider(r.id)} style={{color:C.textMuted,cursor:'pointer'}}>✕</span>
        </div>
      ))}
      <div style={{display:'flex',gap:'6px',marginTop:'6px'}}>
        <input value={newRider.name} onChange={e=>setNewRider(f=>({...f,name:e.target.value}))} placeholder="Rider name (e.g. Dental & Optical)" style={{flex:2,padding:'6px 8px',fontSize:'11px',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
        <input value={newRider.monthly_premium} onChange={e=>setNewRider(f=>({...f,monthly_premium:e.target.value}))} type="number" placeholder="HK$/mo" style={{flex:1,padding:'6px 8px',fontSize:'11px',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
        <Btn style={{fontSize:'11px',padding:'6px 10px'}} onClick={addRider}>Add</Btn>
      </div>

      <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',color:C.textMuted,margin:'14px 0 6px'}}>Deductible options</div>
      {deductibles.map(d=>(
        <div key={d.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'12px',padding:'4px 0'}}>
          <span>HK${d.deductible_hkd} deductible - {d.premium_adjustment_pct>0?'+':''}{d.premium_adjustment_pct}% premium</span>
          <span onClick={()=>removeDeductible(d.id)} style={{color:C.textMuted,cursor:'pointer'}}>✕</span>
        </div>
      ))}
      <div style={{display:'flex',gap:'6px',marginTop:'6px'}}>
        <input value={newDeductible.deductible_hkd} onChange={e=>setNewDeductible(f=>({...f,deductible_hkd:e.target.value}))} type="number" placeholder="Deductible HK$" style={{flex:1,padding:'6px 8px',fontSize:'11px',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
        <input value={newDeductible.premium_adjustment_pct} onChange={e=>setNewDeductible(f=>({...f,premium_adjustment_pct:e.target.value}))} type="number" placeholder="% premium adj (e.g. -15)" style={{flex:1,padding:'6px 8px',fontSize:'11px',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
        <Btn style={{fontSize:'11px',padding:'6px 10px'}} onClick={addDeductible}>Add</Btn>
      </div>
    </div>
  )
}

// ── PLAN MANAGER ──────────────────────────────────────────────────────────────
const PLAN_MANAGER_CATEGORIES = ['Hospitalisation','Outpatient','Specialist','Labs & imaging','Dental (basic)','Surgery','Travel emergency','Mental health','Critical illness lump sum']
function PlanManager({ company }) {
  const [plans,setPlans]=useState([])
  const [loading,setLoading]=useState(true)
  const [creating,setCreating]=useState(false)
  const [saving,setSaving]=useState(false)
  const [editingId,setEditingId]=useState(null)
  const [form,setForm]=useState({ plan_name:'', plan_type:'', key_benefits:'', copay_rate:'', annual_deductible_hkd:'', covered_categories:[] })
  const [customCategory,setCustomCategory]=useState('')
  const [tiers,setTiers]=useState([{ age_min:'', age_max:'', monthly_premium:'', annual_limit:'' }])
  const [expandedPlanId,setExpandedPlanId]=useState(null)

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
  function toggleCategory(cat) {
    setForm(f => ({ ...f, covered_categories: f.covered_categories.includes(cat) ? f.covered_categories.filter(c=>c!==cat) : [...f.covered_categories, cat] }))
  }
  function addCustomCategory() {
    const val = customCategory.trim()
    if (!val || form.covered_categories.includes(val)) return
    setForm(f => ({ ...f, covered_categories: [...f.covered_categories, val] }))
    setCustomCategory('')
  }

  function startCreate() {
    setEditingId(null)
    setForm({ plan_name:'', plan_type:'', key_benefits:'', copay_rate:'', annual_deductible_hkd:'', covered_categories:[] })
    setTiers([{ age_min:'', age_max:'', monthly_premium:'', annual_limit:'' }])
    setCreating(true)
  }
  function startEdit(plan) {
    setEditingId(plan.id)
    setForm({
      plan_name: plan.plan_name||'', plan_type: plan.plan_type||'', key_benefits: plan.key_benefits||'',
      copay_rate: plan.copay_rate!=null ? String(Math.round(plan.copay_rate*100)) : '',
      annual_deductible_hkd: plan.annual_deductible_hkd!=null ? String(plan.annual_deductible_hkd) : '',
      covered_categories: plan.covered_categories||[],
    })
    const existingTiers = (plan.insurance_plan_pricing_tiers||[]).sort((a,b)=>a.age_min-b.age_min)
    setTiers(existingTiers.length>0
      ? existingTiers.map(t=>({ age_min:String(t.age_min), age_max:String(t.age_max), monthly_premium:String(t.monthly_premium), annual_limit:t.annual_limit!=null?String(t.annual_limit):'' }))
      : [{ age_min:'', age_max:'', monthly_premium:'', annual_limit:'' }])
    setCreating(true)
  }

  async function handleSubmit() {
    const validTiers = tiers.filter(t => t.age_min!=='' && t.age_max!=='' && t.monthly_premium!=='')
    if (!form.plan_name || validTiers.length===0) return
    setSaving(true)
    const payload = {
      plan_name: form.plan_name, plan_type: form.plan_type || null,
      key_benefits: form.key_benefits || null,
      covered_categories: form.covered_categories,
      // Real, plan-specific values the adjudication engine actually uses
      // (see lib/insuranceAdapter.js) - previously nothing on this form
      // ever set these, so every plan silently used the same hardcoded
      // 10% copay / $500 deductible regardless of what was entered here.
      copay_rate: form.copay_rate!=='' ? parseFloat(form.copay_rate)/100 : null,
      annual_deductible_hkd: form.annual_deductible_hkd!=='' ? parseFloat(form.annual_deductible_hkd) : null,
    }
    let planId = editingId
    if (editingId) {
      await supabase.from('insurance_plans').update(payload).eq('id', editingId)
      await supabase.from('insurance_plan_pricing_tiers').delete().eq('plan_id', editingId)
    } else {
      const { data: newPlan } = await supabase.from('insurance_plans').insert({
        ...payload, company_name: company.name, status: 'active',
      }).select().maybeSingle()
      planId = newPlan?.id
    }
    if (planId) {
      await supabase.from('insurance_plan_pricing_tiers').insert(
        validTiers.map(t => ({
          plan_id: planId, age_min: parseInt(t.age_min), age_max: parseInt(t.age_max),
          monthly_premium: parseFloat(t.monthly_premium),
          annual_limit: t.annual_limit ? parseFloat(t.annual_limit) : null,
        }))
      )
    }
    setSaving(false); setCreating(false); setEditingId(null)
    setForm({ plan_name:'', plan_type:'', key_benefits:'', copay_rate:'', annual_deductible_hkd:'', covered_categories:[] })
    setTiers([{ age_min:'', age_max:'', monthly_premium:'', annual_limit:'' }])
    load()
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>Your listed plans</SecLabel>
      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&plans.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>No plans listed yet.</div>}
      {!loading&&plans.map((p)=>(
        <Card key={p.id} style={{padding:'14px 16px',cursor:'pointer'}} onClick={()=>setExpandedPlanId(expandedPlanId===p.id?null:p.id)}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
            <div>
              <div style={{fontSize:'14px',fontWeight:600}}>{p.plan_name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{p.plan_type||'—'}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
              {p.sponsored&&<span style={{fontSize:'10px',background:C.amberLight,color:C.amber,padding:'2px 8px',borderRadius:'20px',fontWeight:600}}>Sponsored</span>}
              <span onClick={e=>{e.stopPropagation();startEdit(p)}} style={{fontSize:'11px',color:C.blue,cursor:'pointer'}}>Edit</span>
            </div>
          </div>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'4px'}}>
            {p.copay_rate!=null ? `${Math.round(p.copay_rate*100)}% copay` : 'Copay not set (defaults to 10%)'} · {p.annual_deductible_hkd!=null ? `HK$${p.annual_deductible_hkd} annual deductible` : 'Deductible not set (defaults to HK$500)'}
          </div>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'4px'}}>
            {(p.insurance_plan_pricing_tiers||[]).length===0
              ? <span style={{color:C.red}}>No pricing tiers entered</span>
              : p.insurance_plan_pricing_tiers.sort((a,b)=>a.age_min-b.age_min).map(t=>`Age ${t.age_min}-${t.age_max}: HK$${t.monthly_premium}/mo`).join(' · ')}
          </div>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>{(p.covered_categories||[]).length>0 ? p.covered_categories.join(', ') : 'No covered categories set - claims won\'t match against this plan'}</div>
          <div style={{fontSize:'11px',color:C.blue}}>{expandedPlanId===p.id?'▾':'▸'} Riders & deductible options</div>
          {expandedPlanId===p.id&&<div onClick={e=>e.stopPropagation()}><PlanExtrasManager plan={p} onChanged={load}/></div>}
        </Card>
      ))}
      {creating&&(
        <Card style={{padding:'16px'}}>
          <div style={{fontSize:'14px',fontWeight:600,marginBottom:'14px'}}>{editingId?'Edit plan listing':'New plan listing'}</div>
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
          <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Copay rate (%)</div>
              <input type="number" value={form.copay_rate} onChange={e=>setForm(f=>({...f,copay_rate:e.target.value}))} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}} placeholder="e.g. 10 (defaults to 10%)"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Annual deductible (HK$)</div>
              <input type="number" value={form.annual_deductible_hkd} onChange={e=>setForm(f=>({...f,annual_deductible_hkd:e.target.value}))} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}} placeholder="e.g. 500 (defaults to $500)"/>
            </div>
          </div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Covered categories - what the adjudication engine matches claims against</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
            {PLAN_MANAGER_CATEGORIES.map(cat=>(
              <div key={cat} onClick={()=>toggleCategory(cat)} style={{padding:'5px 10px',borderRadius:'16px',fontSize:'11px',cursor:'pointer',background:form.covered_categories.includes(cat)?C.green:C.card,color:form.covered_categories.includes(cat)?'#fff':C.textSub}}>{cat}</div>
            ))}
          </div>
          <div style={{display:'flex',gap:'6px',marginBottom:'10px'}}>
            <input value={customCategory} onChange={e=>setCustomCategory(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addCustomCategory())} placeholder="Other category (type your own)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'12px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
            <button onClick={addCustomCategory} disabled={!customCategory.trim()} style={{padding:'0 14px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>+ Add</button>
          </div>
          {form.covered_categories.filter(c=>!PLAN_MANAGER_CATEGORIES.includes(c)).length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'14px'}}>
            {form.covered_categories.filter(c=>!PLAN_MANAGER_CATEGORIES.includes(c)).map(cat=>(
              <div key={cat} style={{padding:'5px 10px',borderRadius:'16px',fontSize:'11px',background:C.green,color:'#fff',display:'flex',alignItems:'center',gap:'6px'}}>
                {cat}<span onClick={()=>toggleCategory(cat)} style={{cursor:'pointer',fontWeight:700}}>×</span>
              </div>
            ))}
          </div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>{setCreating(false);setEditingId(null)}}>Cancel</Btn>
            <Btn variant="navy" style={{flex:1}} onClick={handleSubmit} disabled={saving||!form.plan_name||!tiers.some(t=>t.age_min!==''&&t.age_max!==''&&t.monthly_premium!=='')}>{saving?'Saving…':editingId?'Save changes':'Submit plan'}</Btn>
          </div>
        </Card>
      )}
      {!creating&&<div style={{padding:'0 16px 16px'}}><Btn variant="navy" style={{width:'100%'}} onClick={startCreate}>+ Add new plan</Btn></div>}
    </div>
  )
}

// ── COVERAGE RULES (self-serve, unpartnered / TPA-claims-only insurers) ──────
// The lightweight counterpart to Plan Manager, for an insurer with no
// relationship to Medsa's marketplace at all - registers just enough
// (copay rate, deductible, covered categories) for the adjudication
// engine to calculate real claims against their plan, with none of the
// marketplace machinery (pricing tiers for agents to sell, sponsorship,
// riders). self_serve_only:true keeps these out of patient/agent-facing
// plan browsing - they never agreed to be sold on Medsa, only to have
// claims processed. Same insurance_plans table, same adjudication engine,
// deliberately smaller form.
const COVERAGE_RULE_CATEGORIES = ['Hospitalisation','Outpatient','Specialist','Labs & imaging','Dental (basic)','Surgery','Travel emergency','Mental health','Critical illness lump sum']
const NETWORK_TYPES = [['any_licensed','Any licensed clinic/hospital'],['panel_only','Panel providers only'],['hong_kong_only','Hong Kong only'],['asia_pacific','Asia-Pacific'],['worldwide','Worldwide']]
const PRE_EXISTING_POLICIES = [['excluded','Excluded permanently'],['covered_after_waiting','Covered after waiting period'],['covered','Covered from day one']]
const EMPTY_FORM = {
  plan_name:'', copay_rate:'', annual_deductible_hkd:'', covered_categories:[],
  overall_annual_limit_hkd:'', room_board_daily_limit_hkd:'', network_type:'', waiting_period_days:'',
  pre_existing_condition_policy:'', preauth_threshold_hkd:'', category_limits:{},
  policy_document_path:'',
}
function CoverageRulesManager({ company }) {
  const [plans,setPlans]=useState([])
  const [loading,setLoading]=useState(true)
  const [creating,setCreating]=useState(false)
  const [saving,setSaving]=useState(false)
  const [editingId,setEditingId]=useState(null)
  const [form,setForm]=useState(EMPTY_FORM)
  const [customCategory,setCustomCategory]=useState('')
  const [docFile,setDocFile]=useState(null)
  const [uploadingDoc,setUploadingDoc]=useState(false)
  const [parsingDoc,setParsingDoc]=useState(false)
  const [docError,setDocError]=useState(null)
  const [autoFilledNote,setAutoFilledNote]=useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('insurance_plans').select('*').eq('company_name',company.name).eq('self_serve_only',true).order('created_at',{ascending:false})
    setPlans(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function toggleCategory(cat) {
    setForm(f => {
      const has = f.covered_categories.includes(cat)
      const covered_categories = has ? f.covered_categories.filter(c=>c!==cat) : [...f.covered_categories, cat]
      const category_limits = {...f.category_limits}
      if (has) delete category_limits[cat]
      else category_limits[cat] = category_limits[cat] || { annual_limit_hkd:'', per_visit_limit_hkd:'', requires_preauth:false, requires_referral:false }
      return { ...f, covered_categories, category_limits }
    })
  }
  function updateCategoryLimit(cat, key, value) {
    setForm(f => ({ ...f, category_limits: { ...f.category_limits, [cat]: { ...f.category_limits[cat], [key]: value } } }))
  }
  function addCustomCategory() {
    const val = customCategory.trim()
    if (!val || form.covered_categories.includes(val)) return
    setForm(f => ({ ...f, covered_categories: [...f.covered_categories, val], category_limits: { ...f.category_limits, [val]: { annual_limit_hkd:'', per_visit_limit_hkd:'', requires_preauth:false, requires_referral:false } } }))
    setCustomCategory('')
  }

  function startCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDocFile(null); setDocError(null); setAutoFilledNote(null)
    setCreating(true)
  }
  function startEdit(plan) {
    setEditingId(plan.id)
    const category_limits = {}
    for (const cat of (plan.covered_categories||[])) {
      const stored = (plan.category_limits||{})[cat] || {}
      category_limits[cat] = {
        annual_limit_hkd: stored.annual_limit_hkd!=null ? String(stored.annual_limit_hkd) : '',
        per_visit_limit_hkd: stored.per_visit_limit_hkd!=null ? String(stored.per_visit_limit_hkd) : '',
        requires_preauth: !!stored.requires_preauth, requires_referral: !!stored.requires_referral,
      }
    }
    setForm({
      plan_name: plan.plan_name||'', copay_rate: plan.copay_rate!=null ? String(Math.round(plan.copay_rate*100)) : '',
      annual_deductible_hkd: plan.annual_deductible_hkd!=null ? String(plan.annual_deductible_hkd) : '',
      covered_categories: plan.covered_categories||[],
      overall_annual_limit_hkd: plan.overall_annual_limit_hkd!=null ? String(plan.overall_annual_limit_hkd) : '',
      room_board_daily_limit_hkd: plan.room_board_daily_limit_hkd!=null ? String(plan.room_board_daily_limit_hkd) : '',
      network_type: plan.network_type||'', waiting_period_days: plan.waiting_period_days!=null ? String(plan.waiting_period_days) : '',
      pre_existing_condition_policy: plan.pre_existing_condition_policy||'',
      preauth_threshold_hkd: plan.preauth_threshold_hkd!=null ? String(plan.preauth_threshold_hkd) : '',
      category_limits, policy_document_path: plan.policy_document_path||'',
    })
    setDocFile(null); setDocError(null); setAutoFilledNote(null)
    setCreating(true)
  }

  async function handleUploadDoc() {
    if (!docFile) return
    setUploadingDoc(true); setDocError(null); setAutoFilledNote(null)
    try {
      const path = `coverage-rules/${company.id}/${Date.now()}-${docFile.name}`
      const { error: upErr } = await supabase.storage.from('policy-contracts').upload(path, docFile)
      if (upErr) throw upErr
      setForm(f => ({ ...f, policy_document_path: path }))
      setParsingDoc(true)
      const res = await fetch('/api/insurer/parse_plan_document', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentPath: path }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not read this document')
      const e = json.extracted
      setForm(f => {
        const category_limits = {...f.category_limits}
        const covered_categories = [...f.covered_categories]
        for (const cl of (e.category_limits||[])) {
          if (!covered_categories.includes(cl.category)) covered_categories.push(cl.category)
          category_limits[cl.category] = {
            annual_limit_hkd: cl.annual_limit_hkd!=null ? String(cl.annual_limit_hkd) : (category_limits[cl.category]?.annual_limit_hkd||''),
            per_visit_limit_hkd: cl.per_visit_limit_hkd!=null ? String(cl.per_visit_limit_hkd) : (category_limits[cl.category]?.per_visit_limit_hkd||''),
            requires_preauth: !!cl.requires_preauth, requires_referral: !!cl.requires_referral,
          }
        }
        for (const cat of (e.covered_categories||[])) {
          if (!covered_categories.includes(cat)) covered_categories.push(cat)
          if (!category_limits[cat]) category_limits[cat] = { annual_limit_hkd:'', per_visit_limit_hkd:'', requires_preauth:false, requires_referral:false }
        }
        return {
          ...f,
          plan_name: e.plan_name || f.plan_name,
          copay_rate: e.copay_rate_pct!=null ? String(e.copay_rate_pct) : f.copay_rate,
          annual_deductible_hkd: e.annual_deductible_hkd!=null ? String(e.annual_deductible_hkd) : f.annual_deductible_hkd,
          overall_annual_limit_hkd: e.overall_annual_limit_hkd!=null ? String(e.overall_annual_limit_hkd) : f.overall_annual_limit_hkd,
          room_board_daily_limit_hkd: e.room_board_daily_limit_hkd!=null ? String(e.room_board_daily_limit_hkd) : f.room_board_daily_limit_hkd,
          network_type: e.network_type || f.network_type,
          waiting_period_days: e.waiting_period_days!=null ? String(e.waiting_period_days) : f.waiting_period_days,
          pre_existing_condition_policy: e.pre_existing_condition_policy || f.pre_existing_condition_policy,
          preauth_threshold_hkd: e.preauth_threshold_hkd!=null ? String(e.preauth_threshold_hkd) : f.preauth_threshold_hkd,
          covered_categories, category_limits,
        }
      })
      setAutoFilledNote('Filled in from your document - review every field before saving, nothing here was applied automatically.')
    } catch (e) {
      setDocError(e.message)
    } finally {
      setUploadingDoc(false); setParsingDoc(false)
    }
  }

  async function handleSubmit() {
    if (!form.plan_name.trim()) return
    setSaving(true)
    const category_limits = {}
    for (const cat of form.covered_categories) {
      const cl = form.category_limits[cat]
      if (!cl) continue
      category_limits[cat] = {
        annual_limit_hkd: cl.annual_limit_hkd!=='' ? parseFloat(cl.annual_limit_hkd) : null,
        per_visit_limit_hkd: cl.per_visit_limit_hkd!=='' ? parseFloat(cl.per_visit_limit_hkd) : null,
        requires_preauth: !!cl.requires_preauth, requires_referral: !!cl.requires_referral,
      }
    }
    const payload = {
      plan_name: form.plan_name.trim(),
      copay_rate: form.copay_rate!=='' ? parseFloat(form.copay_rate)/100 : null,
      annual_deductible_hkd: form.annual_deductible_hkd!=='' ? parseFloat(form.annual_deductible_hkd) : null,
      covered_categories: form.covered_categories,
      overall_annual_limit_hkd: form.overall_annual_limit_hkd!=='' ? parseFloat(form.overall_annual_limit_hkd) : null,
      room_board_daily_limit_hkd: form.room_board_daily_limit_hkd!=='' ? parseFloat(form.room_board_daily_limit_hkd) : null,
      network_type: form.network_type || null,
      waiting_period_days: form.waiting_period_days!=='' ? parseInt(form.waiting_period_days,10) : null,
      pre_existing_condition_policy: form.pre_existing_condition_policy || null,
      preauth_threshold_hkd: form.preauth_threshold_hkd!=='' ? parseFloat(form.preauth_threshold_hkd) : null,
      category_limits,
      policy_document_path: form.policy_document_path || null,
      policy_document_uploaded_at: form.policy_document_path ? new Date().toISOString() : null,
    }
    if (editingId) {
      await supabase.from('insurance_plans').update(payload).eq('id', editingId)
    } else {
      await supabase.from('insurance_plans').insert({
        ...payload, company_name: company.name,
        status: 'active', self_serve_only: true, created_by: 'self-serve (TPA-claims-only)',
      })
    }
    setSaving(false); setCreating(false); setEditingId(null)
    setForm(EMPTY_FORM); setDocFile(null); setAutoFilledNote(null)
    load()
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px'}}>
        <div style={{fontSize:'12px',color:C.navy,lineHeight:1.6}}>Register your plans' coverage rules so a claim from any Medsa-network clinic (or the direct API) calculates the right deductible/copay for your policyholders. This isn't a marketplace listing - your plans aren't shown to patients or sold by agents, they're only used to process real claims.</div>
      </div>
      <SecLabel>Your registered plans</SecLabel>
      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&plans.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>No plans registered yet.</div>}
      {!loading&&plans.map((p)=>(
        <Card key={p.id} style={{padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
            <div style={{fontSize:'14px',fontWeight:600}}>{p.plan_name}</div>
            <span onClick={()=>startEdit(p)} style={{fontSize:'11px',color:C.blue,cursor:'pointer',flexShrink:0}}>Edit</span>
          </div>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'4px'}}>
            {p.copay_rate!=null ? `${Math.round(p.copay_rate*100)}% copay` : 'Copay defaults to 10%'} · {p.annual_deductible_hkd!=null ? `HK$${p.annual_deductible_hkd} annual deductible` : 'Deductible defaults to HK$500'}
          </div>
          <div style={{fontSize:'11px',color:C.textMuted}}>{(p.covered_categories||[]).length>0 ? p.covered_categories.join(', ') : 'No categories set - claims won\'t match against this plan'}</div>
          {(p.overall_annual_limit_hkd||p.network_type||p.waiting_period_days!=null)&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>
            {p.overall_annual_limit_hkd&&`HK$${Number(p.overall_annual_limit_hkd).toLocaleString()} annual max`}
            {p.network_type&&`${p.overall_annual_limit_hkd?' · ':''}${NETWORK_TYPES.find(n=>n[0]===p.network_type)?.[1]||p.network_type}`}
            {p.waiting_period_days!=null&&`${(p.overall_annual_limit_hkd||p.network_type)?' · ':''}${p.waiting_period_days}d waiting period`}
          </div>}
          {p.policy_document_path&&<div style={{fontSize:'11px',color:C.blue,marginTop:'4px',cursor:'pointer'}} onClick={async()=>{const {data}=await supabase.storage.from('policy-contracts').createSignedUrl(p.policy_document_path,300);if(data?.signedUrl)window.open(data.signedUrl,'_blank')}}>📄 View uploaded policy document</div>}
        </Card>
      ))}
      {creating&&(
        <Card style={{padding:'16px'}}>
          <div style={{fontSize:'14px',fontWeight:600,marginBottom:'14px'}}>{editingId?'Edit plan':'New plan'}</div>

          <div style={{background:C.beige,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px',marginBottom:'14px'}}>
            <div style={{fontSize:'12px',fontWeight:600,marginBottom:'6px'}}>✨ Auto-fill from your policy document</div>
            <div style={{fontSize:'11px',color:C.textSub,marginBottom:'8px',lineHeight:1.5}}>Upload the real plan/policy document (PDF or a clear photo) and every field below gets proposed from it - review and edit before saving, nothing is applied automatically.</div>
            <div style={{display:'flex',gap:'6px'}}>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>setDocFile(e.target.files?.[0]||null)} style={{flex:1,fontSize:'11px'}}/>
              <Btn variant="navy" style={{flexShrink:0}} onClick={handleUploadDoc} disabled={!docFile||uploadingDoc||parsingDoc}>{uploadingDoc?'Uploading…':parsingDoc?'Reading…':'Upload & fill'}</Btn>
            </div>
            {docError&&<div style={{fontSize:'11px',color:C.red,marginTop:'8px'}}>{docError}</div>}
            {autoFilledNote&&<div style={{fontSize:'11px',color:C.green,marginTop:'8px'}}>{autoFilledNote}</div>}
            {form.policy_document_path&&!docError&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'8px'}}>Document on file - will be saved with this plan.</div>}
          </div>

          <div style={{marginBottom:'12px'}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Plan name</div>
            <input value={form.plan_name} onChange={e=>setForm(f=>({...f,plan_name:e.target.value}))} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}} placeholder="e.g. Standard Outpatient"/>
          </div>
          <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Copay rate (%)</div>
              <input type="number" value={form.copay_rate} onChange={e=>setForm(f=>({...f,copay_rate:e.target.value}))} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}} placeholder="e.g. 10"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Annual deductible (HK$)</div>
              <input type="number" value={form.annual_deductible_hkd} onChange={e=>setForm(f=>({...f,annual_deductible_hkd:e.target.value}))} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}} placeholder="e.g. 500"/>
            </div>
          </div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Covered categories</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
            {COVERAGE_RULE_CATEGORIES.map(cat=>(
              <div key={cat} onClick={()=>toggleCategory(cat)} style={{padding:'5px 10px',borderRadius:'16px',fontSize:'11px',cursor:'pointer',background:form.covered_categories.includes(cat)?C.green:C.card,color:form.covered_categories.includes(cat)?'#fff':C.textSub}}>{cat}</div>
            ))}
          </div>
          {/* Not every insurer's category names match the fixed list above -
              this is a real column (insurance_plans.covered_categories,
              text[]), free-form on write already, just missing a way to
              actually type a custom value in rather than only toggling
              from a fixed set. */}
          <div style={{display:'flex',gap:'6px',marginBottom:'10px'}}>
            <input value={customCategory} onChange={e=>setCustomCategory(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addCustomCategory())} placeholder="Other category (type your own)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'12px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
            <button onClick={addCustomCategory} disabled={!customCategory.trim()} style={{padding:'0 14px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>+ Add</button>
          </div>
          {form.covered_categories.filter(c=>!COVERAGE_RULE_CATEGORIES.includes(c)).length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'14px'}}>
            {form.covered_categories.filter(c=>!COVERAGE_RULE_CATEGORIES.includes(c)).map(cat=>(
              <div key={cat} style={{padding:'5px 10px',borderRadius:'16px',fontSize:'11px',background:C.green,color:'#fff',display:'flex',alignItems:'center',gap:'6px'}}>
                {cat}<span onClick={()=>toggleCategory(cat)} style={{cursor:'pointer',fontWeight:700}}>×</span>
              </div>
            ))}
          </div>}

          {/* Per-category sub-limits - the single biggest lever for
              calculation accuracy: a real HK medical plan almost never
              covers every category at the same rate/cap (e.g. unlimited
              hospitalisation but a capped physiotherapy allowance), so a
              flat plan-wide copay+deductible alone under-models most real
              policies. */}
          {form.covered_categories.length>0&&<>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Per-category limits (optional - leave blank for uncapped)</div>
            {form.covered_categories.map(cat=>{
              const cl = form.category_limits[cat] || { annual_limit_hkd:'', per_visit_limit_hkd:'', requires_preauth:false, requires_referral:false }
              return (
                <div key={cat} style={{background:C.beige,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',marginBottom:'8px'}}>
                  <div style={{fontSize:'11px',fontWeight:600,marginBottom:'6px'}}>{cat}</div>
                  <div style={{display:'flex',gap:'6px',marginBottom:'6px'}}>
                    <input type="number" value={cl.annual_limit_hkd} onChange={e=>updateCategoryLimit(cat,'annual_limit_hkd',e.target.value)} placeholder="Annual cap (HK$)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'7px 9px',fontSize:'11px',background:C.card,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
                    <input type="number" value={cl.per_visit_limit_hkd} onChange={e=>updateCategoryLimit(cat,'per_visit_limit_hkd',e.target.value)} placeholder="Per-visit cap (HK$)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'7px 9px',fontSize:'11px',background:C.card,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
                  </div>
                  <div style={{display:'flex',gap:'14px'}}>
                    <label style={{fontSize:'11px',color:C.textSub,display:'flex',alignItems:'center',gap:'5px',cursor:'pointer'}}><input type="checkbox" checked={cl.requires_preauth} onChange={e=>updateCategoryLimit(cat,'requires_preauth',e.target.checked)}/>Needs pre-authorization</label>
                    <label style={{fontSize:'11px',color:C.textSub,display:'flex',alignItems:'center',gap:'5px',cursor:'pointer'}}><input type="checkbox" checked={cl.requires_referral} onChange={e=>updateCategoryLimit(cat,'requires_referral',e.target.checked)}/>Needs doctor referral</label>
                  </div>
                </div>
              )
            })}
          </>}

          <div style={{fontSize:'12px',color:C.textSub,margin:'14px 0 6px'}}>Overall plan limits</div>
          <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Overall annual limit (HK$)</div>
              <input type="number" value={form.overall_annual_limit_hkd} onChange={e=>setForm(f=>({...f,overall_annual_limit_hkd:e.target.value}))} placeholder="e.g. 2000000" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Room & board (HK$/day)</div>
              <input type="number" value={form.room_board_daily_limit_hkd} onChange={e=>setForm(f=>({...f,room_board_daily_limit_hkd:e.target.value}))} placeholder="e.g. 1500" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
            </div>
          </div>
          <div style={{marginBottom:'10px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Pre-authorization required above (HK$)</div>
            <input type="number" value={form.preauth_threshold_hkd} onChange={e=>setForm(f=>({...f,preauth_threshold_hkd:e.target.value}))} placeholder="e.g. 5000 - claims over this need review before auto-settling" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
          </div>
          <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Network</div>
              <select value={form.network_type} onChange={e=>setForm(f=>({...f,network_type:e.target.value}))} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}>
                <option value="">Not set</option>
                {NETWORK_TYPES.map(([k,l])=><option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Waiting period (days)</div>
              <input type="number" value={form.waiting_period_days} onChange={e=>setForm(f=>({...f,waiting_period_days:e.target.value}))} placeholder="e.g. 30" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
            </div>
          </div>
          <div style={{marginBottom:'14px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Pre-existing conditions</div>
            <select value={form.pre_existing_condition_policy} onChange={e=>setForm(f=>({...f,pre_existing_condition_policy:e.target.value}))} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}>
              <option value="">Not set</option>
              {PRE_EXISTING_POLICIES.map(([k,l])=><option key={k} value={k}>{l}</option>)}
            </select>
          </div>

          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>{setCreating(false);setEditingId(null)}}>Cancel</Btn>
            <Btn variant="navy" style={{flex:1}} onClick={handleSubmit} disabled={saving||!form.plan_name.trim()}>{saving?'Saving…':editingId?'Save changes':'Register plan'}</Btn>
          </div>
        </Card>
      )}
      {!creating&&<div style={{padding:'0 16px 16px'}}><Btn variant="navy" style={{width:'100%'}} onClick={startCreate}>+ Register a plan</Btn></div>}
    </div>
  )
}

// ── POLICY VERIFICATION (check a submitted policy number against the
// insurer's own records) ──────────────────────────────────────────────────
// The piece that was missing entirely from Coverage Rules: registering a
// plan's copay/deductible rules never meant anyone checked a claim's real
// policy number against anything - Medsa just trusted whatever was on
// file. This doesn't need a full adjudication partnership (Medsa still
// does 100% of the coverage math) - an insurer only needs to tell Medsa
// how to confirm a policyholder actually exists on their books, via
// whichever of these is realistic for them: a plain roster export (any
// insurer already has one, zero engineering work), or a key to a lookup
// endpoint they already run.
const VERIFICATION_MODES = [
  ['none', 'Not verified', 'Any policy number on file is trusted as-is - the same as before this feature existed.'],
  ['roster', 'Roster upload', 'Periodically upload a plain export of your active policyholders. Medsa checks every claim\'s policy number against the most recent upload.'],
  ['api', 'Live lookup API', 'Give Medsa a key to your own member-eligibility endpoint. Medsa calls it at claim time instead of trusting a stored list.'],
]
function PolicyVerificationManager({ company }) {
  const [mode,setMode]=useState('none')
  const [apiUrl,setApiUrl]=useState('')
  const [apiKeyInput,setApiKeyInput]=useState('')
  const [rosterCount,setRosterCount]=useState(0)
  const [rosterUpdatedAt,setRosterUpdatedAt]=useState(null)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [notice,setNotice]=useState(null)
  const [rosterFile,setRosterFile]=useState(null)
  const [uploadingRoster,setUploadingRoster]=useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('insurance_companies').select('verification_mode, verification_api_url, roster_updated_at').eq('id', company.id).maybeSingle()
    setMode(data?.verification_mode || 'none')
    setApiUrl(data?.verification_api_url || '')
    setRosterUpdatedAt(data?.roster_updated_at || null)
    const { count } = await supabase.from('insurer_policy_roster').select('id', { count: 'exact', head: true }).eq('insurance_company_id', company.id)
    setRosterCount(count || 0)
    setLoading(false)
  }
  useEffect(() => { load() }, [company.id])

  async function saveMode(newMode) {
    setSaving(true); setNotice(null)
    const res = await fetch('/api/insurer/set_verification_config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company.id, verificationMode: newMode, verificationApiUrl: apiUrl, verificationApiKey: apiKeyInput }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setNotice(`Error: ${json.error}`); return }
    setMode(newMode)
    setApiKeyInput('')
    setNotice('Saved.')
    load()
  }

  async function handleRosterUpload() {
    if (!rosterFile) return
    setUploadingRoster(true); setNotice(null)
    try {
      const text = await rosterFile.text()
      const { rows } = parseCSV(text)
      if (rows.length === 0) throw new Error('No rows found - check the file has a header row plus at least one data row.')
      // Replace semantics - a stale roster is worse than an empty one
      // (an old row for a policyholder who's since lapsed would wrongly
      // keep verifying). Delete-then-insert rather than diffing, since
      // this is a small, infrequent, whole-file operation.
      await supabase.from('insurer_policy_roster').delete().eq('insurance_company_id', company.id)
      const toInsert = rows.map(r => ({
        insurance_company_id: company.id,
        policy_number: r.policy_number || null, hkid: r.hkid || null,
        patient_name: r.patient_name || null, plan_name: r.plan_name || null,
        status: r.status || 'active',
      })).filter(r => r.policy_number || r.hkid)
      if (toInsert.length === 0) throw new Error('No row had a policy_number or hkid column - nothing to check claims against.')
      const { error } = await supabase.from('insurer_policy_roster').insert(toInsert)
      if (error) throw error
      await supabase.from('insurance_companies').update({ roster_updated_at: new Date().toISOString() }).eq('id', company.id)
      setRosterFile(null)
      setNotice(`Uploaded ${toInsert.length} polic${toInsert.length===1?'y':'ies'}.`)
      load()
    } catch (e) {
      setNotice(`Error: ${e.message}`)
    } finally {
      setUploadingRoster(false)
    }
  }

  if (loading) return <div style={{textAlign:'center',padding:'40px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px'}}>
        <div style={{fontSize:'12px',color:C.navy,lineHeight:1.6}}>Medsa always does the coverage/copay/deductible math from your registered plan rules. This only controls whether a claim's policy number gets checked against your own records before that math runs.</div>
      </div>
      <SecLabel>How should Medsa verify a policy number?</SecLabel>
      {VERIFICATION_MODES.map(([key,label,desc])=>(
        <Card key={key} onClick={()=>key!==mode&&saveMode(key)} style={{padding:'14px 16px',cursor:'pointer',...(mode===key?{border:`1.5px solid ${C.navy}`}:{})}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'4px'}}>
            <div style={{width:16,height:16,borderRadius:'50%',border:`1.5px solid ${mode===key?C.navy:C.border}`,background:mode===key?C.navy:'transparent',flexShrink:0}}/>
            <div style={{fontSize:'13px',fontWeight:600}}>{label}</div>
          </div>
          <div style={{fontSize:'11px',color:C.textSub,lineHeight:1.5,marginLeft:'26px'}}>{desc}</div>
        </Card>
      ))}
      {notice&&<div style={{margin:'0 16px 10px',fontSize:'12px',color:notice.startsWith('Error')?C.red:C.green}}>{notice}</div>}

      {mode==='roster'&&<>
        <SecLabel>Your roster</SecLabel>
        <Card style={{padding:'16px'}}>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>{rosterCount>0 ? `${rosterCount} polic${rosterCount===1?'y':'ies'} on file${rosterUpdatedAt?`, last updated ${new Date(rosterUpdatedAt).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}`:''}.` : 'No roster uploaded yet - every claim will be rejected as unverified until one is.'}</div>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>CSV columns: policy_number, hkid (either works), patient_name, plan_name, status (defaults to active).</div>
          <div style={{display:'flex',gap:'6px'}}>
            <input type="file" accept=".csv" onChange={e=>setRosterFile(e.target.files?.[0]||null)} style={{flex:1,fontSize:'11px'}}/>
            <Btn variant="navy" style={{flexShrink:0}} onClick={handleRosterUpload} disabled={!rosterFile||uploadingRoster}>{uploadingRoster?'Uploading…':'Upload & replace'}</Btn>
          </div>
        </Card>
      </>}

      {mode==='api'&&<>
        <SecLabel>Your lookup endpoint</SecLabel>
        <Card style={{padding:'16px'}}>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'10px',lineHeight:1.5}}>Medsa POSTs {'{ policyNumber, hkid }'} and expects back JSON with a valid/eligible boolean.</div>
          <div style={{marginBottom:'10px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Endpoint URL</div>
            <input value={apiUrl} onChange={e=>setApiUrl(e.target.value)} placeholder="https://your-system.example.com/verify" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
          </div>
          <div style={{marginBottom:'12px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>API key{apiUrl.trim()&&' (leave blank to keep the current one)'}</div>
            <input type="password" value={apiKeyInput} onChange={e=>setApiKeyInput(e.target.value)} placeholder="Sent as a Bearer token" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
          </div>
          <Btn variant="navy" style={{width:'100%'}} onClick={()=>saveMode('api')} disabled={saving||!apiUrl.trim()}>{saving?'Saving…':'Save endpoint'}</Btn>
        </Card>
      </>}
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
  const [promotingId,setPromotingId]=useState(null)
  const [description,setDescription]=useState('')
  const [thumbnailUrl,setThumbnailUrl]=useState('')
  const [months,setMonths]=useState(3)
  const [termsAccepted,setTermsAccepted]=useState(false)
  const [starting,setStarting]=useState(false)
  const [error,setError]=useState(null)
  const RATE = 3000

  async function load() {
    setLoading(true)
    // Not filtered by self_serve_only - a TPA-claims-only insurer's
    // Coverage Rules plans can be promoted exactly the same way a
    // partnered insurer's marketplace plans can, at the same per-month
    // rate. Both land in the same insurance_plans table.
    const { data } = await supabase.from('insurance_plans').select('id, plan_name, sponsored, sponsored_until, sponsor_price_hkd, sponsor_description, sponsor_thumbnail_url').eq('company_name', company.name).order('plan_name')
    setPlans(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [company.name])

  const today = new Date().toISOString().slice(0,10)
  const active = plans.filter(p => p.sponsored && p.sponsored_until >= today)
  const available = plans.filter(p => !(p.sponsored && p.sponsored_until >= today))
  const promotingPlan = available.find(p=>p.id===promotingId)

  function startPromote(plan) {
    setPromotingId(plan.id)
    setDescription(plan.sponsor_description||'')
    setThumbnailUrl(plan.sponsor_thumbnail_url||'')
    setMonths(3)
    setTermsAccepted(false)
    setError(null)
  }

  async function handleLaunch() {
    if (!promotingId || !termsAccepted) return
    setStarting(true); setError(null)
    try {
      // The description/thumbnail and the terms-acceptance timestamp are
      // real content shown to patients - save them to the plan itself
      // before checkout, not just passed along as Stripe metadata that
      // would otherwise be lost. The webhook only ever sets
      // sponsored/sponsored_until/sponsor_price_hkd once payment clears.
      const { error: updErr } = await supabase.from('insurance_plans').update({
        sponsor_description: description.trim() || null,
        sponsor_thumbnail_url: thumbnailUrl.trim() || null,
        sponsor_terms_accepted_at: new Date().toISOString(),
      }).eq('id', promotingId)
      if (updErr) throw updErr
      const res = await fetch('/api/insurer/create_sponsor_checkout', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ planId: promotingId, companyId: company.id, months }),
      })
      const data = await res.json()
      if (data.status === 'CREATED' && data.paymentUrl) { window.location.href = data.paymentUrl; return }
      setError(data.message || 'Could not start checkout.')
    } catch (e) {
      setError(e.message || 'Something went wrong - please try again.')
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
          <div style={{display:'flex',gap:'10px'}}>
            {p.sponsor_thumbnail_url&&<img src={p.sponsor_thumbnail_url} alt="" style={{width:52,height:52,borderRadius:'10px',objectFit:'cover',flexShrink:0}}/>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:'14px',fontWeight:500,marginBottom:'4px'}}>{p.plan_name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>Sponsored until {new Date(p.sponsored_until).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}{p.sponsor_price_hkd?` · paid HK$${p.sponsor_price_hkd.toLocaleString()}`:''}</div>
              {p.sponsor_description&&<div style={{fontSize:'12px',color:C.text,marginTop:'4px'}}>{p.sponsor_description}</div>}
            </div>
          </div>
        </Card>
      ))}
      <SecLabel>Promote a plan</SecLabel>
      {available.length===0&&!promotingId&&<Card style={{padding:'16px'}}><div style={{fontSize:'12px',color:C.textMuted}}>{plans.length===0?'Add a plan first.':'All your plans are already sponsored.'}</div></Card>}
      {!promotingId&&available.map(p=>(
        <Card key={p.id} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px'}}>
          <div style={{fontSize:'13px',fontWeight:500}}>{p.plan_name}</div>
          <Btn variant="navy" onClick={()=>startPromote(p)}>Promote</Btn>
        </Card>
      ))}
      {promotingId&&promotingPlan&&(
        <Card style={{padding:'16px'}}>
          <div style={{fontSize:'14px',fontWeight:600,marginBottom:'14px'}}>Promote "{promotingPlan.plan_name}"</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Description shown to patients</div>
          <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="What makes this plan worth a look?" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box',resize:'none',fontFamily:'inherit'}}/>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Thumbnail image URL</div>
          <input value={thumbnailUrl} onChange={e=>setThumbnailUrl(e.target.value)} placeholder="https://…" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box'}}/>
          {thumbnailUrl.trim()&&<img src={thumbnailUrl} alt="" style={{width:'100%',height:120,objectFit:'cover',borderRadius:'8px',marginBottom:'12px'}} onError={e=>{e.target.style.display='none'}}/>}
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Duration</div>
          <div style={{display:'flex',gap:'8px',marginBottom:'14px'}}>
            {[1,3,6].map(m=>(
              <div key={m} onClick={()=>setMonths(m)} style={{flex:1,padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:months===m?C.navy:C.beige,color:months===m?'#fff':C.text,border:`0.5px solid ${months===m?C.navy:C.border}`}}>{m} mo · HK${(RATE*m).toLocaleString()}</div>
            ))}
          </div>
          <div onClick={()=>setTermsAccepted(!termsAccepted)} style={{display:'flex',gap:'10px',alignItems:'flex-start',padding:'12px',background:termsAccepted?C.greenXLight:C.card,border:`0.5px solid ${termsAccepted?C.green:C.border}`,borderRadius:'10px',cursor:'pointer',marginBottom:'14px'}}>
            <div style={{width:18,height:18,borderRadius:'4px',border:`1.5px solid ${termsAccepted?C.green:C.border}`,background:termsAccepted?C.green:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'#fff',flexShrink:0,marginTop:'1px'}}>{termsAccepted?'✓':''}</div>
            <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>I agree this listing must accurately describe the plan's real terms, that Medsa may remove it if it's misleading, and that the sponsorship fee is non-refundable once the placement goes live.</div>
          </div>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setPromotingId(null)}>Cancel</Btn>
            <Btn variant="navy" style={{flex:1}} onClick={handleLaunch} disabled={!termsAccepted||starting}>{starting?'Starting checkout…':`Pay HK$${(RATE*months).toLocaleString()} & launch`}</Btn>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── TEAMS & AGENTS (institution side) ──────────────────────────────────────
// "Onboard/offboard agent/team", teams' plan authorizations from the
// institution's basket - none of this existed before; every agent was
// flatly tied to one institution with no branch layer and no per-team
// product restriction at all.
function TeamManagementCard({ company, team, plans, onChanged }) {
  const [members,setMembers]=useState([])
  const [authorizedPlanIds,setAuthorizedPlanIds]=useState(new Set())
  const [loading,setLoading]=useState(true)
  const [showAddMember,setShowAddMember]=useState(false)
  const [memberForm,setMemberForm]=useState({ fullName:'', email:'', phone:'', licenseNumber:'' })
  const [saving,setSaving]=useState(false)
  const [notice,setNotice]=useState(null)

  async function load() {
    setLoading(true)
    const { data: appts } = await supabase.from('agent_institution_appointments')
      .select('agent_id, agents(id, full_name, email, medsa_id)').eq('institution_id', company.institutionRefId).eq('team_id', team.id).eq('status','active')
    setMembers((appts||[]).map(a=>a.agents).filter(Boolean))
    const { data: auths } = await supabase.from('team_plan_authorizations').select('plan_id').eq('team_id', team.id)
    setAuthorizedPlanIds(new Set((auths||[]).map(a=>a.plan_id)))
    setLoading(false)
  }
  useEffect(() => { load() }, [team.id])

  async function toggleAuthorization(planId) {
    if (authorizedPlanIds.has(planId)) {
      await supabase.from('team_plan_authorizations').delete().eq('team_id', team.id).eq('plan_id', planId)
    } else {
      await supabase.from('team_plan_authorizations').insert({ team_id: team.id, plan_id: planId })
    }
    load()
  }

  async function setAssignmentMode(mode) {
    await supabase.from('insurance_teams').update({ assignment_mode: mode }).eq('id', team.id)
    onChanged()
  }

  async function handleAddMember() {
    if (!memberForm.email.trim()) return
    setSaving(true); setNotice(null)
    try {
      const res = await fetch('/api/agent/onboard', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...memberForm, agentType:'captive', institutionId: company.institutionRefId, teamId: team.id }),
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
    <Card style={{padding:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
        <div>
          <div style={{fontSize:'14px',fontWeight:600}}>{team.name}</div>
          <div style={{fontSize:'11px',color:C.textMuted}}>{team.medsa_id}</div>
        </div>
      </div>
      <div style={{fontSize:'11px',color:C.textSub,marginBottom:'10px'}}>{loading?'Loading…':`${members.length} member${members.length===1?'':'s'}`}</div>
      {!loading&&members.map(m=>(
        <div key={m.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:'12px',borderBottom:`0.5px solid ${C.border}`}}>
          <span>{m.full_name}{team.team_lead_agent_id===m.id?' (lead)':''}</span>
          <span style={{color:C.textMuted}}>{m.medsa_id}</span>
        </div>
      ))}

      <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',color:C.textMuted,margin:'14px 0 6px'}}>Won-inquiry assignment</div>
      <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
        {[['confirmer','Whoever confirmed'],['random','Random member'],['manual','I assign manually']].map(([k,l])=>(
          <div key={k} onClick={()=>setAssignmentMode(k)} style={{flex:1,padding:'8px',borderRadius:'8px',textAlign:'center',fontSize:'11px',fontWeight:500,cursor:'pointer',background:team.assignment_mode===k?C.navy:C.beige,color:team.assignment_mode===k?'#fff':C.text,border:`0.5px solid ${team.assignment_mode===k?C.navy:C.border}`}}>{l}</div>
        ))}
      </div>

      <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',color:C.textMuted,margin:'14px 0 6px'}}>Plans this team is authorized to sell</div>
      {plans.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'10px'}}>No plans in your basket yet - add one under "Manage plans".</div>}
      {plans.map(p=>(
        <div key={p.id} onClick={()=>toggleAuthorization(p.id)} style={{display:'flex',alignItems:'center',gap:'8px',padding:'5px 0',cursor:'pointer'}}>
          <div style={{width:16,height:16,borderRadius:'4px',border:`1.5px solid ${authorizedPlanIds.has(p.id)?C.green:C.border}`,background:authorizedPlanIds.has(p.id)?C.green:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'#fff',flexShrink:0}}>{authorizedPlanIds.has(p.id)?'✓':''}</div>
          <span style={{fontSize:'12px'}}>{p.plan_name}</span>
        </div>
      ))}

      {notice&&<div style={{fontSize:'11px',color:C.textSub,marginTop:'10px'}}>{notice}</div>}
      {showAddMember ? (
        <div style={{marginTop:'12px',background:C.beige,borderRadius:'8px',padding:'12px'}}>
          {[['fullName','Full name (blank if appointing an existing agent)'],['email','Email'],['phone','Phone'],['licenseNumber','License number']].map(([k,ph])=>(
            <input key={k} value={memberForm[k]} onChange={e=>setMemberForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px 10px',fontSize:'12px',marginBottom:'6px',boxSizing:'border-box'}}/>
          ))}
          <div style={{display:'flex',gap:'6px'}}>
            <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>setShowAddMember(false)}>Cancel</Btn>
            <Btn variant="navy" style={{flex:1,fontSize:'12px'}} onClick={handleAddMember} disabled={saving||!memberForm.email.trim()}>{saving?'Saving…':'Add / appoint'}</Btn>
          </div>
        </div>
      ) : (
        <Btn style={{width:'100%',marginTop:'12px',fontSize:'12px'}} onClick={()=>setShowAddMember(true)}>+ Add member</Btn>
      )}
    </Card>
  )
}

function TeamsAndAgents({ company }) {
  const [teams,setTeams]=useState([])
  const [plans,setPlans]=useState([])
  const [independents,setIndependents]=useState([])
  const [loading,setLoading]=useState(true)
  const [creating,setCreating]=useState(false)
  const [newTeamName,setNewTeamName]=useState('')
  const [showAddIndependent,setShowAddIndependent]=useState(false)
  const [indyForm,setIndyForm]=useState({ fullName:'', email:'', phone:'', licenseNumber:'' })
  const [saving,setSaving]=useState(false)
  const [notice,setNotice]=useState(null)
  // Bulk CSV onboarding - only real path for onboarding at any volume,
  // since there's no real HK agent-license registry to self-serve
  // signup against (same reasoning as leaving license_number
  // self-declared). Columns: fullName,email,phone,licenseNumber.
  const [bulkTeamId,setBulkTeamId]=useState('')
  const [bulkRows,setBulkRows]=useState([])
  const [bulkRunning,setBulkRunning]=useState(false)
  const [bulkResults,setBulkResults]=useState([])

  function handleBulkFile(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const lines = String(e.target.result).split(/\r?\n/).filter(l=>l.trim())
      const [header, ...rows] = lines
      const cols = header.split(',').map(c=>c.trim().toLowerCase())
      const parsed = rows.map(line => {
        const vals = line.split(',').map(v=>v.trim())
        const row = {}
        cols.forEach((c,i)=>{ row[c] = vals[i]||'' })
        return row
      }).filter(r=>r.email)
      setBulkRows(parsed)
      setBulkResults([])
    }
    reader.readAsText(file)
  }

  async function runBulkImport() {
    setBulkRunning(true)
    const results = []
    for (const row of bulkRows) {
      try {
        const res = await fetch('/api/agent/onboard', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            fullName: row.fullname, email: row.email, phone: row.phone, licenseNumber: row.licensenumber,
            agentType: bulkTeamId ? 'captive' : 'independent', institutionId: company.institutionRefId, teamId: bulkTeamId || null,
          }),
        })
        const data = await res.json()
        results.push({ email: row.email, ok: data.status==='OK', message: data.status==='OK' ? (data.isNew?'created':'appointed') : (data.message||'failed') })
      } catch (e) {
        results.push({ email: row.email, ok: false, message: e.message })
      }
    }
    setBulkResults(results)
    setBulkRunning(false)
    setBulkRows([])
    load()
  }

  async function load() {
    setLoading(true)
    const { data: teamRows } = await supabase.from('insurance_teams').select('*').eq('institution_id', company.institutionRefId).order('created_at')
    setTeams(teamRows||[])
    const { data: planRows } = await supabase.from('insurance_plans').select('id, plan_name').eq('company_name', company.name).eq('status','active')
    setPlans(planRows||[])
    const { data: apptRows } = await supabase.from('agent_institution_appointments')
      .select('agent_id, agents(id, full_name, email, medsa_id, agent_type)').eq('institution_id', company.institutionRefId).is('team_id', null).eq('status','active')
    setIndependents((apptRows||[]).map(a=>a.agents).filter(Boolean))
    setLoading(false)
  }
  useEffect(() => { load() }, [company.id, company.name])

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return
    setSaving(true)
    await supabase.from('insurance_teams').insert({
      institution_id: company.institutionRefId, name: newTeamName.trim(),
      medsa_id: `${company.medsaId||'TEAM'}-T${Math.floor(100+Math.random()*899)}`,
    })
    setSaving(false); setCreating(false); setNewTeamName('')
    load()
  }

  async function handleAddIndependent() {
    if (!indyForm.email.trim()) return
    setSaving(true); setNotice(null)
    try {
      const res = await fetch('/api/agent/onboard', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...indyForm, agentType:'independent', institutionId: company.institutionRefId }),
      })
      const data = await res.json()
      if (data.status !== 'OK') { setNotice(data.message||'Could not appoint agent.'); setSaving(false); return }
      setNotice(data.isNew ? `Appointed - temp password ${data.emailSent?'emailed':data.tempPassword}.` : 'Existing agent appointed.')
      setIndyForm({ fullName:'', email:'', phone:'', licenseNumber:'' })
      setShowAddIndependent(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px'}}>
        <div style={{fontSize:'12px',color:C.navy,lineHeight:1.6}}>Teams are branches under {company.name} - each has its own roster, its own subset of your plan basket it's authorized to sell, and its own rule for how a won inquiry gets down to one member. Independent agents appointed to you directly (not under any team) get your whole basket.</div>
      </div>

      <SecLabel>Bulk onboard agents (CSV)</SecLabel>
      <Card style={{padding:'16px'}}>
        <div style={{fontSize:'11px',color:C.textSub,marginBottom:'10px',lineHeight:1.5}}>Columns: fullName, email, phone, licenseNumber. An email that already has an agent account is appointed (not re-created); a new one gets a temp password emailed to them.</div>
        <select value={bulkTeamId} onChange={e=>setBulkTeamId(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}>
          <option value="">Independent (no team - whole basket)</option>
          {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label style={{display:'block',width:'100%',padding:'10px',border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',color:C.textSub,textAlign:'center',cursor:'pointer',boxSizing:'border-box',marginBottom:'10px'}}>
          {bulkRows.length>0 ? `${bulkRows.length} row(s) ready` : 'Tap to upload CSV'}
          <input type="file" accept=".csv" style={{display:'none'}} onChange={e=>e.target.files[0]&&handleBulkFile(e.target.files[0])}/>
        </label>
        {bulkRows.length>0&&<Btn variant="navy" style={{width:'100%'}} onClick={runBulkImport} disabled={bulkRunning}>{bulkRunning?'Importing…':`Import ${bulkRows.length} agent(s)`}</Btn>}
        {bulkResults.length>0&&<div style={{marginTop:'10px'}}>
          {bulkResults.map((r,i)=>(
            <div key={i} style={{fontSize:'11px',color:r.ok?C.green:C.red}}>{r.ok?'✓':'✕'} {r.email} - {r.message}</div>
          ))}
        </div>}
      </Card>

      <SecLabel>Teams</SecLabel>
      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&teams.length===0&&<div style={{fontSize:'12px',color:C.textMuted,padding:'0 16px 10px'}}>No teams yet.</div>}
      {teams.map(t=><TeamManagementCard key={t.id} company={company} team={t} plans={plans} onChanged={load}/>)}
      {creating ? (
        <Card style={{padding:'16px'}}>
          <input value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} placeholder="Team / branch name (e.g. Metrotown Branch)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setCreating(false)}>Cancel</Btn>
            <Btn variant="navy" style={{flex:1}} onClick={handleCreateTeam} disabled={saving||!newTeamName.trim()}>{saving?'Creating…':'Create team'}</Btn>
          </div>
        </Card>
      ) : (
        <div style={{padding:'0 16px 8px'}}><Btn variant="navy" style={{width:'100%'}} onClick={()=>setCreating(true)}>+ New team</Btn></div>
      )}

      <SecLabel>Independent agents appointed to you</SecLabel>
      {!loading&&independents.length===0&&<div style={{fontSize:'12px',color:C.textMuted,padding:'0 16px 10px'}}>None yet.</div>}
      {independents.map(a=>(
        <Card key={a.id} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between'}}>
          <span style={{fontSize:'13px'}}>{a.full_name}</span>
          <span style={{fontSize:'11px',color:C.textMuted}}>{a.medsa_id}</span>
        </Card>
      ))}
      {notice&&<div style={{fontSize:'11px',color:C.textSub,padding:'0 16px'}}>{notice}</div>}
      {showAddIndependent ? (
        <Card style={{padding:'16px'}}>
          {[['fullName','Full name (blank if appointing an existing agent)'],['email','Email'],['phone','Phone'],['licenseNumber','License number']].map(([k,ph])=>(
            <input key={k} value={indyForm[k]} onChange={e=>setIndyForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}/>
          ))}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setShowAddIndependent(false)}>Cancel</Btn>
            <Btn variant="navy" style={{flex:1}} onClick={handleAddIndependent} disabled={saving||!indyForm.email.trim()}>{saving?'Saving…':'Appoint agent'}</Btn>
          </div>
        </Card>
      ) : (
        <div style={{padding:'0 16px 20px'}}><Btn style={{width:'100%'}} onClick={()=>setShowAddIndependent(true)}>+ Appoint an independent agent</Btn></div>
      )}
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
  const titles={dashboard:'Insurance partner',plans:'Plan listings',planrules:'Coverage rules',claims:'Claims log','claim-detail':'Claim review',ads:'Sponsored listings',analytics:'Analytics',teams:'Teams & Agents',verify:'Policy verification'}
  const isPartnered = company?.relationshipType!=='unpartnered'
  const navItems=isPartnered ? [{key:'dashboard',icon:'◈',label:'Overview'},{key:'plans',icon:'▣',label:'Plans'},{key:'teams',icon:'◆',label:'Teams'},{key:'verify',icon:'✓',label:'Verify'},{key:'claims',icon:'◇',label:'Claims'},{key:'ads',icon:'⬡',label:'Sponsored'},{key:'analytics',icon:'◎',label:'Analytics'}]
    : [{key:'dashboard',icon:'◈',label:'Overview'},{key:'planrules',icon:'▣',label:'Coverage'},{key:'verify',icon:'✓',label:'Verify'},{key:'claims',icon:'◇',label:'Claims'},{key:'ads',icon:'⬡',label:'Promote'}]

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
        {screen==='planrules'&&!isPartnered&&<CoverageRulesManager company={company}/>}
        {screen==='teams'&&isPartnered&&<TeamsAndAgents company={company}/>}
        {screen==='verify'&&<PolicyVerificationManager company={company}/>}
        {screen==='claims'&&<InsuranceAdminClaimsLog onOpenClaim={openClaim} company={company}/>}
        {screen==='claim-detail'&&<AgentClaimView claimRef={openClaimRef}/>}
        {/* Available to both tiers - a TPA-claims-only insurer can sponsor
            a registered plan the same way a partnered one sponsors a
            marketplace listing, at the same per-month rate. */}
        {screen==='ads'&&<SponsoredListings company={company}/>}
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
