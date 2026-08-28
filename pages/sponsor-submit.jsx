// pages/sponsor-submit.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Public, no-login page for a sponsor/newsletter contributor to submit their
// own ad or article content directly - Medsa doesn't write or design this
// content, just reviews and posts it. Submissions land in
// home_carousel_submissions as 'pending' and only appear in the patient app
// once approved in Medsa Admin's Carousel tab. Not password-gated (public
// intake form), so it's deliberately left out of middleware.js's matcher.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'

function ImagePicker({ label, value, onChange }) {
  const [mode, setMode] = useState('url')
  const [uploading, setUploading] = useState(false)

  async function handleFile(file) {
    setUploading(true)
    const path = `submissions/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('carousel-images').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('carousel-images').getPublicUrl(path)
      onChange(data.publicUrl)
    }
    setUploading(false)
  }

  return (
    <div style={{marginBottom:'14px'}}>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>{label}</div>
      <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
        {[['url','Paste a URL'],['upload','Upload a file']].map(([k,l])=>(
          <div key={k} onClick={()=>setMode(k)} style={{flex:1,padding:'7px',borderRadius:'8px',textAlign:'center',fontSize:'11px',fontWeight:500,cursor:'pointer',background:mode===k?C.green:C.card,color:mode===k?'#fff':C.textSub}}>{l}</div>
        ))}
      </div>
      {mode==='url'&&<input value={value||''} onChange={e=>onChange(e.target.value)} placeholder="https://…" style={{width:'100%',padding:'10px',fontSize:'13px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>}
      {mode==='upload'&&<label style={{display:'block',width:'100%',padding:'10px',border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',color:C.textSub,textAlign:'center',cursor:'pointer',boxSizing:'border-box'}}>
        {uploading?'Uploading…':(value?'Uploaded ✓ - tap to replace':'Tap to upload (JPG/PNG)')}
        <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])}/>
      </label>}
      {value&&<img src={value} alt="" style={{width:'100%',maxHeight:140,objectFit:'cover',borderRadius:'8px',marginTop:'8px'}}/>}
    </div>
  )
}

export default function SponsorSubmitPage() {
  const [stage, setStage] = useState('form') // form | submitting | done
  const [itemType, setItemType] = useState('ad')
  const [sponsorName, setSponsorName] = useState('')
  const [sponsorEmail, setSponsorEmail] = useState('')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [ctaLabel, setCtaLabel] = useState('')
  const [blocks, setBlocks] = useState([{ type:'paragraph', text:'' }])
  const [error, setError] = useState(null)

  function updateBlock(i, field, value) {
    setBlocks(b => b.map((blk,idx) => idx===i ? {...blk,[field]:value} : blk))
  }
  function addBlock(type) {
    setBlocks(b => [...b, type==='paragraph' ? { type:'paragraph', text:'' } : { type:'image', url:'' }])
  }
  function removeBlock(i) {
    setBlocks(b => b.filter((_,idx)=>idx!==i))
  }

  async function handleSubmit() {
    setError(null)
    if (!title.trim()) { setError('Title is required.'); return }
    if (!sponsorName.trim() || !sponsorEmail.trim()) { setError('Your name/company and email are required, so Medsa can reach you about this submission.'); return }
    const cleanBlocks = blocks.filter(b => (b.type==='paragraph' && b.text.trim()) || (b.type==='image' && b.url.trim()))
    setStage('submitting')
    const { error: insErr } = await supabase.from('home_carousel_submissions').insert({
      item_type: itemType, title: title.trim(), subtitle: subtitle.trim()||null,
      image_url: thumbnail||null, sponsor_name: sponsorName.trim(), sponsor_contact_email: sponsorEmail.trim(),
      link_url: linkUrl.trim()||null, cta_label: ctaLabel.trim()||null,
      content_blocks: cleanBlocks.length>0 ? cleanBlocks : null,
      status: 'pending',
    })
    if (insErr) { setError(insErr.message); setStage('form'); return }
    setStage('done')
  }

  if (stage==='done') return (
    <div style={{background:C.beige,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',fontFamily:'system-ui,sans-serif'}}>
      <div style={{background:'#fff',borderRadius:'16px',padding:'32px',maxWidth:420,width:'100%',textAlign:'center'}}>
        <div style={{fontSize:'32px',marginBottom:'12px'}}>✓</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Submitted for review</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Medsa will review this before it appears in the app. We'll reach out at {sponsorEmail} if we have questions.</div>
      </div>
    </div>
  )

  return (
    <div style={{background:C.beige,minHeight:'100vh',padding:'24px',fontFamily:'system-ui,sans-serif'}}>
      <div style={{maxWidth:520,margin:'0 auto',background:'#fff',borderRadius:'16px',padding:'28px'}}>
        <div style={{fontSize:'19px',fontWeight:700,marginBottom:'4px'}}>Submit content for Medsa</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.6}}>Ads and newsletter articles shown to patients on the Medsa home screen. Fill this in yourself - Medsa reviews and posts it, but doesn't write it for you. Nothing goes live until approved.</div>

        <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
          {[['ad','Sponsored ad'],['newsletter','Newsletter article']].map(([k,l])=>(
            <div key={k} onClick={()=>setItemType(k)} style={{flex:1,padding:'9px',borderRadius:'8px',textAlign:'center',fontSize:'13px',fontWeight:500,cursor:'pointer',background:itemType===k?C.green:C.card,color:itemType===k?'#fff':C.text}}>{l}</div>
          ))}
        </div>

        <div style={{fontSize:'12px',fontWeight:600,marginBottom:'10px'}}>Your details</div>
        <input value={sponsorName} onChange={e=>setSponsorName(e.target.value)} placeholder="Your name / company" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        <input value={sponsorEmail} onChange={e=>setSponsorEmail(e.target.value)} placeholder="Contact email" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'14px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>

        <div style={{fontSize:'12px',fontWeight:600,marginBottom:'10px'}}>Content</div>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Headline" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        <input value={subtitle} onChange={e=>setSubtitle(e.target.value)} placeholder="Subtitle (shown on the card and in related-article lists)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'14px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>

        <ImagePicker label="Thumbnail / hero image" value={thumbnail} onChange={setThumbnail}/>

        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>Article body - add paragraphs and images in whatever order they should appear</div>
        {blocks.map((blk,i) => (
          <div key={i} style={{background:C.beige,borderRadius:'8px',padding:'10px',marginBottom:'8px'}}>
            {blk.type==='paragraph'
              ? <textarea value={blk.text} onChange={e=>updateBlock(i,'text',e.target.value)} rows={3} placeholder="Paragraph text" style={{width:'100%',padding:'8px',fontSize:'13px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px',fontFamily:'inherit',resize:'vertical'}}/>
              : <ImagePicker label="" value={blk.url} onChange={v=>updateBlock(i,'url',v)}/>}
            <div onClick={()=>removeBlock(i)} style={{fontSize:'11px',color:C.red,cursor:'pointer',marginTop:'6px'}}>Remove this block</div>
          </div>
        ))}
        <div style={{display:'flex',gap:'8px',marginBottom:'18px'}}>
          <button onClick={()=>addBlock('paragraph')} style={{flex:1,padding:'8px',background:C.card,border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>+ Add paragraph</button>
          <button onClick={()=>addBlock('image')} style={{flex:1,padding:'8px',background:C.card,border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>+ Add image</button>
        </div>

        <div style={{fontSize:'12px',fontWeight:600,marginBottom:'10px'}}>Call to action (optional)</div>
        <input value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="Link to your site (e.g. https://…)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        <input value={ctaLabel} onChange={e=>setCtaLabel(e.target.value)} placeholder="Button text, e.g. Visit our site - defaults to Learn more" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'18px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>

        {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'14px'}}>{error}</div>}
        <button onClick={handleSubmit} disabled={stage==='submitting'} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>{stage==='submitting'?'Submitting…':'Submit for review'}</button>
      </div>
    </div>
  )
}
