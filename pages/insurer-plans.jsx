// pages/insurer-plans.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Real plan management, wired to the actual insurance_plans table - completes
// the pipeline InsuranceScreen (patient-facing) reads from. Medsa-managed on
// the insurer's behalf until real self-service insurer accounts exist,
// matching the top-down partnership approach.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  green:'#4a7c59', greenLight:'#e8f2ea', greenXLight:'#f2f8f4',
  beige:'#f0ede8', cream:'#faf8f5', card:'#f0ede8',
  text:'#1a1a1a', textSub:'#6b6560', textMuted:'#9c9690',
  border:'#e5e0d8', red:'#c0392b', redLight:'#fbeae8',
  amber:'#d4a017', amberLight:'#fbf3e0', navy:'#1e3a5f',
}

const CATEGORIES = ['Hospitalisation','Outpatient','Specialist','Labs & imaging','Dental (basic)','Surgery','Travel emergency','Mental health','Critical illness lump sum']

export default function InsurerPlansPage() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ insurer_name:'', plan_name:'', plan_type:'', monthly_premium:'', annual_limit:'', covered_conditions:'', covered_categories:[], key_benefits:'', sponsored:false })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('insurance_plans').select('*').order('created_at',{ascending:false})
    setPlans(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function toggleCategory(cat) {
    setForm(f => ({ ...f, covered_categories: f.covered_categories.includes(cat) ? f.covered_categories.filter(c=>c!==cat) : [...f.covered_categories, cat] }))
  }

  async function handleSubmit() {
    if (!form.plan_name || !form.insurer_name) return
    setSaving(true)
    await supabase.from('insurance_plans').insert({
      company_name: form.insurer_name,
      plan_name: form.plan_name,
      plan_type: form.plan_type || null,
      monthly_premium: form.monthly_premium || null,
      annual_limit: form.annual_limit || null,
      // Comma-separated entry, split into the real array field the
      // matching logic in InsuranceScreen actually reads.
      covered_conditions: form.covered_conditions.split(',').map(s=>s.trim()).filter(Boolean),
      covered_categories: form.covered_categories,
      key_benefits: form.key_benefits || null,
      sponsored: form.sponsored,
      status: 'active',
    })
    setSaving(false)
    setCreating(false)
    setForm({ insurer_name:'', plan_name:'', plan_type:'', monthly_premium:'', annual_limit:'', covered_conditions:'', covered_categories:[], key_benefits:'', sponsored:false })
    load()
  }

  async function toggleStatus(plan) {
    const newStatus = plan.status === 'active' ? 'inactive' : 'active'
    await supabase.from('insurance_plans').update({ status: newStatus }).eq('id', plan.id)
    load()
  }

  return (
    <div style={{background:C.beige,minHeight:'100vh',padding:'24px',maxWidth:560,margin:'0 auto',fontFamily:'system-ui,sans-serif'}}>
      <div style={{fontSize:'20px',fontWeight:700,marginBottom:'4px'}}>Insurer Plan Management</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px'}}>Plans added here appear in patient-facing plan matching immediately. Inactive plans stay on file but stop showing to patients.</div>

      {!creating&&<button onClick={()=>setCreating(true)} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer',marginBottom:'20px'}}>+ Add new plan</button>}

      {creating&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
        <div style={{fontSize:'15px',fontWeight:600,marginBottom:'14px'}}>New plan</div>
        {[
          ['insurer_name','Insurer name (e.g. AIA)'],
          ['plan_name','Plan name'],
          ['plan_type','Plan type (e.g. Comprehensive)'],
          ['monthly_premium','Monthly premium (e.g. HK$1,200/mo)'],
          ['annual_limit','Annual limit (e.g. HK$1.2M annual)'],
        ].map(([field,ph]) => (
          <input key={field} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph}
            style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        ))}
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Covered conditions (comma-separated) - this drives real patient matching</div>
        <input value={form.covered_conditions} onChange={e=>setForm(f=>({...f,covered_conditions:e.target.value}))} placeholder="e.g. diabetes, hypertension, asthma"
          style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Coverage categories</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
          {CATEGORIES.map(cat => (
            <div key={cat} onClick={()=>toggleCategory(cat)} style={{padding:'5px 10px',borderRadius:'16px',fontSize:'11px',cursor:'pointer',background:form.covered_categories.includes(cat)?C.green:C.card,color:form.covered_categories.includes(cat)?'#fff':C.textSub}}>{cat}</div>
          ))}
        </div>
        <textarea value={form.key_benefits} onChange={e=>setForm(f=>({...f,key_benefits:e.target.value}))} rows={2} placeholder="Key benefits summary"
          style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px',resize:'none',fontFamily:'inherit'}}/>
        <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',marginBottom:'14px',cursor:'pointer'}}>
          <input type="checkbox" checked={form.sponsored} onChange={e=>setForm(f=>({...f,sponsored:e.target.checked}))}/>
          Sponsored placement
        </label>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setCreating(false)} style={{flex:1,padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving||!form.plan_name||!form.insurer_name} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{saving?'Saving…':'Submit plan'}</button>
        </div>
      </div>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&plans.map(p => (
        <div key={p.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
            <div>
              <div style={{fontSize:'14px',fontWeight:600}}>{p.plan_name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{p.company_name} · {p.plan_type||'—'}</div>
            </div>
            <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:p.status==='active'?C.greenLight:C.card,color:p.status==='active'?C.green:C.textMuted,fontWeight:600}}>{p.status}</span>
          </div>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>Covers: {(p.covered_conditions||[]).join(', ')||'none listed'}</div>
          <button onClick={()=>toggleStatus(p)} style={{width:'100%',padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{p.status==='active'?'Deactivate':'Reactivate'}</button>
        </div>
      ))}
    </div>
  )
}
