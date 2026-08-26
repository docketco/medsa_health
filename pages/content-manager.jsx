// pages/content-manager.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Manages the ads/newsletter carousel on the patient home screen
// (home_carousel_items). Password-gated via middleware.js, same as the
// other admin/data tools - not meant for a patient to ever see.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'

export default function ContentManagerPage() {
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
    <div style={{background:C.beige,minHeight:'100vh',padding:'24px',maxWidth:560,margin:'0 auto',fontFamily:'system-ui,sans-serif'}}>
      <div style={{fontSize:'20px',fontWeight:700,marginBottom:'4px'}}>Home Carousel</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px'}}>Ads and newsletter cards shown on the patient home screen. A card with a link opens it externally; a card with content opens it inside the app.</div>

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
