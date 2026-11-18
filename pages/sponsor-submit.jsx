// pages/sponsor-submit.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Public, no-login page for a sponsor/newsletter contributor to submit their
// own ad or article content directly - Medsa doesn't write or design this
// content, just reviews and posts it. Submissions land in
// home_carousel_submissions as 'pending' and only appear in the patient app
// once approved in Medsa Admin's Carousel tab. Not password-gated (public
// intake form), so it's deliberately left out of middleware.js's matcher.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'

function ImagePicker({ label, value, onChange }) {
  const [mode, setMode] = useState('url')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  // Real report, live-testing: "photo not working for image links" -
  // traced to a pasted Pinterest PIN PAGE url (pinterest.com/pin/...),
  // not an actual image file - an <img> tag can never render a webpage,
  // same as it couldn't on any other site. Flags that specific, common
  // mistake directly instead of leaving a silent broken-image icon.
  const [loadFailed, setLoadFailed] = useState(false)
  const looksLikeAPageNotAnImage = /pinterest\.[a-z.]+\/pin\//i.test(value||'') || /\/(search|photos|watch|status)[/?]/i.test(value||'')

  async function handleFile(file) {
    setUploading(true)
    setUploadError(null)
    const path = `submissions/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('carousel-images').upload(path, file)
    if (error) { setUploadError(error.message); setUploading(false); return }
    const { data } = supabase.storage.from('carousel-images').getPublicUrl(path)
    onChange(data.publicUrl)
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
      {mode==='url'&&<input value={value||''} onChange={e=>{onChange(e.target.value);setLoadFailed(false)}} placeholder="https://…" style={{width:'100%',padding:'10px',fontSize:'13px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>}
      {mode==='upload'&&<label style={{display:'block',width:'100%',padding:'10px',border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',color:C.textSub,textAlign:'center',cursor:'pointer',boxSizing:'border-box'}}>
        {uploading?'Uploading…':(value?'Uploaded ✓ - tap to replace':'Tap to upload (JPG/PNG)')}
        <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])}/>
      </label>}
      {uploadError&&<div style={{fontSize:'11px',color:C.red,marginTop:'6px'}}>Upload failed: {uploadError}</div>}
      {value&&(loadFailed||looksLikeAPageNotAnImage)&&<div style={{fontSize:'11px',color:C.red,marginTop:'8px',lineHeight:1.5}}>This looks like a link to a <b>page</b> (like a Pinterest pin, a search result, or a social post), not a direct link to the image file itself - that's why it won't show here or in the app. On the site where you found it, open the photo full-size, then right-click it and choose &ldquo;Copy image address&rdquo; (not &ldquo;Copy link&rdquo;) - the real address usually ends in .jpg/.png and often lives on a different domain (e.g. i.pinimg.com, not pinterest.com). Or just use &ldquo;Upload a file&rdquo; above instead.</div>}
      {value&&<img src={value} alt="" onLoad={()=>setLoadFailed(false)} onError={()=>setLoadFailed(true)} style={{width:'100%',maxHeight:140,objectFit:'cover',borderRadius:'8px',marginTop:'8px',background:C.beige}}/>}
    </div>
  )
}

function AdPricingMenuNote() {
  const [menu, setMenu] = useState(null)
  useEffect(() => {
    supabase.from('carousel_ad_pricing_options').select('*').order('sort_order').order('created_at').then(({data})=>setMenu(data||[]))
  }, [])
  if (menu===null || menu.length===0) return null
  return (
    <div style={{background:C.beige,borderRadius:'8px',padding:'10px 12px',marginBottom:'16px'}}>
      <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>Sponsored ads only go live through payment, at one of these durations - you'll pick one (and your start date) only after Medsa approves your content, not here:</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>{menu.map(o=>(
        <span key={o.id} style={{fontSize:'11px',background:'#fff',borderRadius:'6px',padding:'4px 8px'}}>{o.label} · HK${Number(o.price_hkd).toLocaleString()}</span>
      ))}</div>
    </div>
  )
}

export default function SponsorSubmitPage() {
  const [stage, setStage] = useState('form') // form | preview | submitting | done
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

  // Real gap found live-testing: this used to go straight from the form
  // to a live database insert with no way to see how any of it would
  // actually look first - a sponsor had to submit blind and wait for
  // Medsa to tell them if something read wrong. Now it's draft-first:
  // this just validates and shows the real preview (same markup
  // PatientApp.jsx's carousel card and article view use) - nothing is
  // written until they confirm from there.
  function handleReviewDraft() {
    setError(null)
    if (!title.trim()) { setError('Title is required.'); return }
    if (!sponsorName.trim() || !sponsorEmail.trim()) { setError('Your name/company and email are required, so Medsa can reach you about this submission.'); return }
    setStage('preview')
  }

  async function handleSubmit() {
    setError(null)
    const cleanBlocks = blocks.filter(b => (b.type==='paragraph' && b.text.trim()) || (b.type==='image' && b.url.trim()))
    setStage('submitting')
    const { error: insErr } = await supabase.from('home_carousel_submissions').insert({
      item_type: itemType, title: title.trim(), subtitle: subtitle.trim()||null,
      image_url: thumbnail||null, sponsor_name: sponsorName.trim(), sponsor_contact_email: sponsorEmail.trim(),
      link_url: linkUrl.trim()||null, cta_label: ctaLabel.trim()||null,
      content_blocks: cleanBlocks.length>0 ? cleanBlocks : null,
      status: 'pending',
    })
    if (insErr) { setError(insErr.message); setStage('preview'); return }
    setStage('done')
    // Best-effort - a missing/failed email never blocks the submission
    // itself, which already succeeded above.
    fetch('/api/sponsor/notify_submission', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ sponsorEmail: sponsorEmail.trim(), sponsorName: sponsorName.trim(), title: title.trim() }),
    }).catch(()=>{})
  }

  // Draft preview - same markup PatientApp.jsx's carousel card and
  // article view actually use, so this is a real preview, not a
  // guess at what it'll look like. Nothing is written to the database
  // until "Submit for review" below.
  if (stage==='preview' || stage==='submitting') {
    const cleanBlocks = blocks.filter(b => (b.type==='paragraph' && b.text.trim()) || (b.type==='image' && b.url.trim()))
    return (
      <div style={{background:C.beige,minHeight:'100vh',padding:'24px',fontFamily:'system-ui,sans-serif'}}>
        <div style={{maxWidth:520,margin:'0 auto',background:'#fff',borderRadius:'16px',padding:'28px'}}>
          <div style={{fontSize:'19px',fontWeight:700,marginBottom:'4px'}}>Your draft</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.6}}>This is exactly how it'll look if Medsa approves it. Nothing's submitted yet.</div>

          <div style={{fontSize:'12px',fontWeight:600,color:C.textMuted,marginBottom:'8px'}}>As a card on the home screen</div>
          <div style={{borderRadius:'14px',overflow:'hidden',background:C.beige,border:`0.5px solid ${C.border}`,maxWidth:280,marginBottom:'24px'}}>
            {thumbnail&&<img src={thumbnail} alt="" style={{width:'100%',height:110,objectFit:'cover',display:'block'}}/>}
            <div style={{padding:'12px 14px'}}>
              <span style={{fontSize:'9px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',color:itemType==='ad'?C.amber:C.green}}>{itemType==='ad'?(sponsorName?`Sponsored · ${sponsorName}`:'Sponsored'):'Newsletter'}</span>
              <div style={{fontSize:'13px',fontWeight:600,marginTop:'4px',marginBottom:'2px'}}>{title||'(no headline yet)'}</div>
              {subtitle&&<div style={{fontSize:'11px',color:C.textSub,lineHeight:1.4}}>{subtitle}</div>}
            </div>
          </div>

          <div style={{fontSize:'12px',fontWeight:600,color:C.textMuted,marginBottom:'8px'}}>When a patient taps it open</div>
          <div style={{border:`0.5px solid ${C.border}`,borderRadius:'12px',overflow:'hidden',marginBottom:'20px'}}>
            {thumbnail&&<img src={thumbnail} alt="" style={{width:'100%',height:180,objectFit:'cover',display:'block'}}/>}
            <div style={{padding:'16px'}}>
              <span style={{fontSize:'10px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',color:itemType==='ad'?C.amber:C.green}}>{itemType==='ad'?(sponsorName?`Sponsored · ${sponsorName}`:'Sponsored'):'Newsletter'}</span>
              <div style={{fontSize:'20px',fontWeight:700,margin:'8px 0 4px',lineHeight:1.3}}>{title||'(no headline yet)'}</div>
              {subtitle&&<div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>{subtitle}</div>}
              {cleanBlocks.length===0&&<div style={{fontSize:'13px',color:C.textMuted,marginBottom:'16px'}}>No further content added yet.</div>}
              {cleanBlocks.map((blk,i)=>blk.type==='image'
                ? <img key={i} src={blk.url} alt="" style={{width:'100%',borderRadius:'10px',margin:'12px 0',display:'block'}}/>
                : <p key={i} style={{fontSize:'14px',color:C.text,lineHeight:1.8,margin:'0 0 14px'}}>{blk.text}</p>)}
              {linkUrl&&<div style={{textAlign:'center',padding:'12px',background:C.green,color:'#fff',borderRadius:'10px',fontSize:'13px',fontWeight:600,marginTop:'8px'}}>{ctaLabel||'Learn more'} ↗</div>}
            </div>
          </div>

          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'14px'}}>{error}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>setStage('form')} disabled={stage==='submitting'} style={{flex:1,padding:'12px',background:C.card,color:C.text,border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>← Edit</button>
            <button onClick={handleSubmit} disabled={stage==='submitting'} style={{flex:2,padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>{stage==='submitting'?'Submitting…':'Submit for review'}</button>
          </div>
        </div>
      </div>
    )
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
        {itemType==='ad'&&<AdPricingMenuNote/>}

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
        <button onClick={handleReviewDraft} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>Preview →</button>
      </div>
    </div>
  )
}
