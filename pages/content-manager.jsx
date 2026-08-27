// pages/content-manager.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The one Medsa-employee admin tool for both the home carousel
// (ads/newsletter) and the community forum - duplicate-product review,
// sponsor assignment, and reported-post moderation. Password-gated via
// middleware.js, same as the other admin/data tools.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'

export default function ContentManagerPage() {
  const [tab, setTab] = useState('carousel')
  return (
    <div style={{background:C.beige,minHeight:'100vh',padding:'24px',maxWidth:560,margin:'0 auto',fontFamily:'system-ui,sans-serif'}}>
      <div style={{fontSize:'20px',fontWeight:700,marginBottom:'16px'}}>Content & Community</div>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
        {[['carousel','Carousel'],['forum','Forum']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'13px',fontWeight:600,cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.text}}>{l}</div>
        ))}
      </div>
      {tab==='carousel' && <CarouselTab/>}
      {tab==='forum' && <ForumModerationTab/>}
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
