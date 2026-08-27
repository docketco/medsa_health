// pages/medsa-admin.jsx (was content-manager.jsx)
// ─────────────────────────────────────────────────────────────────────────────
// The one Medsa-employee admin tool: home carousel (ads/newsletter), the
// community forum (duplicate review, sponsor assignment, reported-post
// moderation), onboarding insurance partners, and admin-assisted clinic
// onboarding (clinic-signup.jsx still exists too, for clinics that want
// to self-serve - this is the same real flow, run on their behalf).
// Password-gated via middleware.js, same as the other admin/data tools.
// All future onboarding tools belong here too, rather than as their own
// standalone pages.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'

export default function MedsaAdminPage() {
  const [tab, setTab] = useState('carousel')
  return (
    <div style={{background:C.beige,minHeight:'100vh',padding:'24px',maxWidth:560,margin:'0 auto',fontFamily:'system-ui,sans-serif'}}>
      <div style={{fontSize:'20px',fontWeight:700,marginBottom:'16px'}}>Medsa Admin</div>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px',flexWrap:'wrap'}}>
        {[['carousel','Carousel'],['forum','Forum'],['partners','Insurers'],['clinics','Clinics']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,minWidth:70,padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'13px',fontWeight:600,cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.text}}>{l}</div>
        ))}
      </div>
      {tab==='carousel' && <CarouselTab/>}
      {tab==='forum' && <ForumModerationTab/>}
      {tab==='partners' && <PartnersTab/>}
      {tab==='clinics' && <ClinicsTab/>}
    </div>
  )
}

function PartnersTab() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name:'', contact_name:'', contact_email:'', contact_phone:'' })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('insurance_companies').select('*').order('created_at',{ascending:false})
    setCompanies(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleSubmit() {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('insurance_companies').insert({
      name: form.name.trim(), contact_name: form.contact_name.trim()||null,
      contact_email: form.contact_email.trim()||null, contact_phone: form.contact_phone.trim()||null,
      onboarded_by: 'Medsa admin',
    })
    setSaving(false)
    setCreating(false)
    setForm({ name:'', contact_name:'', contact_email:'', contact_phone:'' })
    load()
  }

  async function toggleStatus(company) {
    await supabase.from('insurance_companies').update({ status: company.status==='active'?'inactive':'active' }).eq('id', company.id)
    load()
  }

  return (
    <div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>Onboard an insurance partner - same idea as clinic-signup.jsx, but admin-driven rather than self-serve, and no login yet (that's part of the bigger insurance build). Once onboarded, use this exact company name in Insurer Plan Management to add their plans.</div>

      {!creating&&<button onClick={()=>setCreating(true)} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer',marginBottom:'20px'}}>+ Onboard a company</button>}

      {creating&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
        <div style={{fontSize:'15px',fontWeight:600,marginBottom:'14px'}}>New insurance partner</div>
        {[['name','Company name (e.g. AIA)'],['contact_name','Contact person'],['contact_email','Contact email'],['contact_phone','Contact phone']].map(([field,ph]) => (
          <input key={field} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph}
            style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        ))}
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setCreating(false)} style={{flex:1,padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving||!form.name.trim()} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{saving?'Saving…':'Onboard'}</button>
        </div>
      </div>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&companies.map(c => (
        <div key={c.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
            <div>
              <div style={{fontSize:'14px',fontWeight:600}}>{c.name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{c.contact_name}{c.contact_email?` · ${c.contact_email}`:''}</div>
            </div>
            <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:c.status==='active'?C.greenLight:C.card,color:c.status==='active'?C.green:C.textMuted,fontWeight:600}}>{c.status}</span>
          </div>
          <button onClick={()=>toggleStatus(c)} style={{width:'100%',padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{c.status==='active'?'Deactivate':'Reactivate'}</button>
        </div>
      ))}
    </div>
  )
}

// Same real flow as clinic-signup.jsx (real institution + real staff
// login + the same BR/ORPHF check), just run by a Medsa employee on the
// clinic's behalf instead of the clinic filling it in themselves - for
// when onboarding happens over a call, not a link. A temp password is
// generated and shown once, same pattern as the CSV bulk staff import.
function ClinicsTab() {
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState(null)
  const [form, setForm] = useState({ name:'', medicineType:'western', businessRegNumber:'', orphfCode:'', phone:'', address:'', adminName:'', adminEmail:'' })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('institutions').select('*').order('created_at',{ascending:false}).limit(50)
    setClinics(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleSubmit() {
    if (!form.name.trim() || !form.adminName.trim() || !form.adminEmail.trim()) return
    setSaving(true)
    setResult(null)
    let verification = { status: 'unchecked' }
    if (form.businessRegNumber.trim() || form.orphfCode.trim()) {
      setVerifying(true)
      const res = await fetch('/api/cds/verify_clinic_credentials', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ businessRegistrationNumber: form.businessRegNumber, orphfCode: form.orphfCode, clinicNameDeclared: form.name }),
      })
      verification = await res.json()
      setVerifying(false)
    }
    const { data: institution, error: instErr } = await supabase.from('institutions').insert({
      name: form.name.trim(), medicine_type: form.medicineType,
      onboarding_status: 'pending', created_by_name: form.adminName.trim(), created_by_email: form.adminEmail.trim(),
      business_registration_number: form.businessRegNumber.trim()||null, orphf_code: form.orphfCode.trim()||null,
      phone: form.phone.trim()||null, address: form.address.trim()||null,
      verification_status: verification.overall_status || verification.status || 'unchecked',
    }).select().maybeSingle()
    if (instErr) { setResult({ error: instErr.message }); setSaving(false); return }

    const medsaId = `MED-${Date.now().toString(36).toUpperCase()}`
    const tempPassword = `Temp${Math.floor(1000+Math.random()*9000)}!`
    await supabase.from('staff_credentials').insert({
      institution_source: 'clinic_ops', institution_id: institution.id, medsa_id: medsaId,
      full_name: form.adminName.trim(), role: 'admin', department: 'All departments',
      onboarded_by: 'medsa-admin', status: 'active', verification_status: 'verified', mchk_declaration_agreed: false,
    })
    await supabase.rpc('set_staff_password', { p_medsa_id: medsaId, p_new_password: tempPassword })

    setResult({ medsaId, tempPassword, verified: verification.overall_status==='verified' })
    setSaving(false)
    setCreating(false)
    setForm({ name:'', medicineType:'western', businessRegNumber:'', orphfCode:'', phone:'', address:'', adminName:'', adminEmail:'' })
    load()
  }

  return (
    <div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>Onboard a clinic on their behalf - same real flow as clinic-signup.jsx (real institution, real staff login, same BR/ORPHF check), for when it happens over a call instead of them using the link themselves.</div>

      {result&&!result.error&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'14px',marginBottom:'16px'}}>
        <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'6px'}}>✓ Clinic created{result.verified?' - registration matched a real registry':' - registration not matched, can be updated later'}</div>
        <div style={{fontSize:'12px',color:C.textSub}}>Medsa ID: <strong>{result.medsaId}</strong> · Temp password: <strong>{result.tempPassword}</strong></div>
        <div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>Relay these to the clinic directly - not shown again.</div>
      </div>}
      {result?.error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'16px'}}>{result.error}</div>}

      {!creating&&<button onClick={()=>setCreating(true)} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer',marginBottom:'20px'}}>+ Onboard a clinic</button>}

      {creating&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
        <div style={{fontSize:'15px',fontWeight:600,marginBottom:'14px'}}>New clinic</div>
        {[['name','Clinic name'],['businessRegNumber','Business Registration Number'],['orphfCode','ORPHF licence/exemption code'],['phone','Clinic phone'],['address','Clinic address'],['adminName','Practice manager full name'],['adminEmail','Practice manager email']].map(([field,ph]) => (
          <input key={field} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph}
            style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        ))}
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setCreating(false)} style={{flex:1,padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving||!form.name.trim()||!form.adminName.trim()||!form.adminEmail.trim()} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{saving?(verifying?'Verifying…':'Creating…'):'Onboard'}</button>
        </div>
      </div>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&clinics.map(c => (
        <div key={c.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{fontSize:'14px',fontWeight:600}}>{c.name}</div>
          <div style={{fontSize:'12px',color:C.textSub}}>{c.address||'No address on file'}{c.phone?` · ${c.phone}`:''}</div>
          <div style={{fontSize:'11px',marginTop:'4px',color:c.verification_status==='verified'?C.green:C.amber}}>{c.verification_status==='verified'?'✓ Verified':c.verification_status||'Unchecked'}</div>
        </div>
      ))}
    </div>
  )
}

function CarouselTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ item_type:'ad', title:'', subtitle:'', image_url:'', sponsor_name:'', link_url:'', content:'', display_order:0 })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('home_carousel_items').select('*').order('display_order')
    setItems(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleSubmit() {
    if (!form.title.trim()) return
    if (!form.link_url.trim() && !form.content.trim()) return
    setSaving(true)
    await supabase.from('home_carousel_items').insert({
      item_type: form.item_type, title: form.title.trim(), subtitle: form.subtitle.trim()||null,
      image_url: form.image_url.trim()||null, sponsor_name: form.sponsor_name.trim()||null,
      link_url: form.link_url.trim()||null, content: form.content.trim()||null,
      display_order: parseInt(form.display_order)||0, active: true,
    })
    setSaving(false)
    setCreating(false)
    setForm({ item_type:'ad', title:'', subtitle:'', image_url:'', sponsor_name:'', link_url:'', content:'', display_order:0 })
    load()
  }

  async function toggleActive(item) {
    await supabase.from('home_carousel_items').update({ active: !item.active }).eq('id', item.id)
    load()
  }

  async function handleDelete(item) {
    await supabase.from('home_carousel_items').delete().eq('id', item.id)
    load()
  }

  return (
    <div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>Ads and newsletter cards shown on the patient home screen. A card with a link opens it externally; a card with content opens it inside the app.</div>

      {!creating&&<button onClick={()=>setCreating(true)} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer',marginBottom:'20px'}}>+ Add card</button>}

      {creating&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
        <div style={{fontSize:'15px',fontWeight:600,marginBottom:'14px'}}>New card</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          {['ad','newsletter'].map(t=>(
            <div key={t} onClick={()=>setForm(f=>({...f,item_type:t}))} style={{flex:1,padding:'8px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:form.item_type===t?C.green:C.card,color:form.item_type===t?'#fff':C.text,textTransform:'capitalize'}}>{t}</div>
          ))}
        </div>
        {[['title','Title'],['subtitle','Subtitle'],['sponsor_name','Sponsor / brand name (optional)'],['image_url','Image URL (optional)'],['link_url','External link (opens outside the app)'],['display_order','Display order (lower shows first)']].map(([field,ph]) => (
          <input key={field} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph}
            style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        ))}
        <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={4} placeholder="In-app content (for a newsletter article - leave blank if using an external link instead)"
          style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px',resize:'vertical',fontFamily:'inherit'}}/>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setCreating(false)} style={{flex:1,padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving||!form.title.trim()||(!form.link_url.trim()&&!form.content.trim())} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{saving?'Saving…':'Add card'}</button>
        </div>
      </div>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&items.map(item => (
        <div key={item.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
            <div>
              <div style={{fontSize:'14px',fontWeight:600}}>{item.title}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{item.item_type}{item.sponsor_name?` · ${item.sponsor_name}`:''} · order {item.display_order}</div>
            </div>
            <span style={{fontSize:'10px',padding:'3px 9px',borderRadius:'20px',background:item.active?C.greenLight:C.card,color:item.active?C.green:C.textMuted,fontWeight:600}}>{item.active?'active':'inactive'}</span>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>toggleActive(item)} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{item.active?'Deactivate':'Reactivate'}</button>
            <button onClick={()=>handleDelete(item)} style={{flex:1,padding:'8px',background:C.redLight,color:C.red,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ForumModerationTab() {
  const [flags, setFlags] = useState([])
  const [reportedPosts, setReportedPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sponsorSearch, setSponsorSearch] = useState('')
  const [sponsorResults, setSponsorResults] = useState([])
  const [sponsorName, setSponsorName] = useState('')

  async function load() {
    setLoading(true)
    const [{data:f},{data:p}] = await Promise.all([
      supabase.from('forum_duplicate_flags').select('*, product_a:product_id_a(canonical_name, post_count), product_b:product_id_b(canonical_name, post_count)').eq('status','pending').order('created_at',{ascending:false}),
      supabase.from('forum_posts').select('*').eq('flagged_for_review', true).order('created_at',{ascending:false}),
    ])
    setFlags(f||[])
    setReportedPosts(p||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Merges B into A - every post moves, B disappears. Never automatic;
  // an employee always makes this call after reading both names.
  async function handleMerge(flag, keepField, mergeField) {
    const keepId = flag[keepField], mergeId = flag[mergeField]
    await supabase.from('forum_posts').update({ product_id: keepId }).eq('product_id', mergeId)
    const { data: keepRow } = await supabase.from('forum_products').select('post_count').eq('id', keepId).maybeSingle()
    const { data: mergeRow } = await supabase.from('forum_products').select('post_count').eq('id', mergeId).maybeSingle()
    await supabase.from('forum_products').update({ post_count: (keepRow?.post_count||0)+(mergeRow?.post_count||0) }).eq('id', keepId)
    await supabase.from('forum_products').delete().eq('id', mergeId)
    await supabase.from('forum_duplicate_flags').update({ status:'merged', resolved_at:new Date().toISOString() }).eq('id', flag.id)
    load()
  }

  async function handleDismiss(flag) {
    await supabase.from('forum_duplicate_flags').update({ status:'dismissed', resolved_at:new Date().toISOString() }).eq('id', flag.id)
    load()
  }

  async function handleClearReport(post) {
    await supabase.from('forum_posts').update({ flagged_for_review: false }).eq('id', post.id)
    load()
  }

  async function handleDeletePost(post) {
    await supabase.from('forum_posts').delete().eq('id', post.id)
    load()
  }

  async function searchProductsForSponsor() {
    if (!sponsorSearch.trim()) { setSponsorResults([]); return }
    const { data } = await supabase.from('forum_products').select('*').ilike('canonical_name', `%${sponsorSearch.trim()}%`)
    setSponsorResults(data||[])
  }

  async function setSponsor(product) {
    await supabase.from('forum_products').update({ sponsored_by: sponsorName.trim()||null }).eq('id', product.id)
    searchProductsForSponsor()
  }

  return (
    <div>
      <div style={{fontSize:'15px',fontWeight:600,marginBottom:'10px'}}>Likely-duplicate threads ({flags.length})</div>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'14px'}}>Flagged automatically by name similarity - nothing merges without your confirmation.</div>
      {loading&&<div style={{textAlign:'center',padding:'16px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&flags.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'20px'}}>Nothing pending.</div>}
      {flags.map(flag=>(
        <div key={flag.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>{flag.similarity_reason}</div>
          <div style={{fontSize:'13px',marginBottom:'4px'}}><strong>{flag.product_a?.canonical_name}</strong> ({flag.product_a?.post_count||0} posts)</div>
          <div style={{fontSize:'13px',marginBottom:'10px'}}><strong>{flag.product_b?.canonical_name}</strong> ({flag.product_b?.post_count||0} posts)</div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <button onClick={()=>handleMerge(flag,'product_id_a','product_id_b')} style={{flex:1,padding:'8px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer'}}>Merge into "{flag.product_a?.canonical_name}"</button>
            <button onClick={()=>handleMerge(flag,'product_id_b','product_id_a')} style={{flex:1,padding:'8px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer'}}>Merge into "{flag.product_b?.canonical_name}"</button>
            <button onClick={()=>handleDismiss(flag)} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer'}}>Not a duplicate</button>
          </div>
        </div>
      ))}

      <div style={{fontSize:'15px',fontWeight:600,marginTop:'24px',marginBottom:'10px'}}>Reported posts ({reportedPosts.length})</div>
      {!loading&&reportedPosts.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'20px'}}>Nothing reported.</div>}
      {reportedPosts.map(post=>(
        <div key={post.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{fontSize:'12px',fontWeight:600,marginBottom:'4px'}}>{post.pseudonym}</div>
          <div style={{fontSize:'13px',marginBottom:'10px'}}>{post.body}</div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>handleClearReport(post)} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>Clear report</button>
            <button onClick={()=>handleDeletePost(post)} style={{flex:1,padding:'8px',background:C.redLight,color:C.red,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>Delete post</button>
          </div>
        </div>
      ))}

      <div style={{fontSize:'15px',fontWeight:600,marginTop:'24px',marginBottom:'10px'}}>Sponsor a product thread</div>
      <input value={sponsorSearch} onChange={e=>setSponsorSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchProductsForSponsor()} placeholder="Search a product…" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
      <input value={sponsorName} onChange={e=>setSponsorName(e.target.value)} placeholder="Sponsor / brand name (leave blank to remove sponsorship)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
      <button onClick={searchProductsForSponsor} style={{width:'100%',padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',marginBottom:'12px'}}>Search</button>
      {sponsorResults.map(p=>(
        <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`0.5px solid ${C.border}`}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:600}}>{p.canonical_name}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{p.sponsored_by?`Sponsored by ${p.sponsored_by}`:'Not sponsored'}</div>
          </div>
          <button onClick={()=>setSponsor(p)} style={{padding:'6px 12px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer'}}>Set</button>
        </div>
      ))}
    </div>
  )
}
