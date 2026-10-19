// pages/insurer-signup.jsx
// ─────────────────────────────────────────────────────────────────────────────
// medsa.health/insurer-signup - public, no-login signup for an insurer.
// One tier, one outcome (see /api/insurer/signup.js): activates
// immediately with a temp password. The old "unpartnered vs. partnered"
// split (instant activation vs. a manual-review application) is gone -
// plan registration/editing is Medsa-admin-only regardless of who signs
// up, so there's no longer a bigger-access tier that needs gating.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import C from '../components/shared/colours'
import MedsaLogo from '../components/shared/MedsaLogo'

export default function InsurerSignupPage() {
  const [companyName,setCompanyName]=useState('')
  const [contactName,setContactName]=useState('')
  const [contactEmail,setContactEmail]=useState('')
  const [contactPhone,setContactPhone]=useState('')
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)
  const [result,setResult]=useState(null)

  async function handleSubmit() {
    setError(null)
    if (!companyName.trim() || !contactEmail.trim()) { setError('Company name and contact email are required.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/insurer/signup', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ companyName, contactName, contactEmail, contactPhone }),
      })
      const data = await res.json()
      if (data.status === 'ERROR') { setError(data.message); setSaving(false); return }
      setResult(data)
    } catch {
      setError('Something went wrong - please try again.')
    }
    setSaving(false)
  }

  if (result) return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:420,background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'28px',textAlign:'center'}}>
        <div style={{fontSize:'32px',marginBottom:'12px'}}>✓</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'10px'}}>{result.companyName} is active</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>Sign in at <strong>/insurer-portal</strong> with your contact email and this temporary password - change it once you're in.</div>
        <div style={{background:C.beige,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'12px',fontSize:'16px',fontWeight:700,letterSpacing:'1px'}}>{result.tempPassword}</div>
        <div style={{fontSize:'11px',color:C.textMuted,marginTop:'12px'}}>{result.emailSent ? `Also emailed to ${contactEmail}.` : `Not emailed (${result.emailReason || 'email not configured'}) - save this password now.`}</div>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:C.beige,padding:'40px 20px'}}>
      <div style={{maxWidth:460,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:'24px'}}>
          <MedsaLogo height={24}/>
          <div style={{fontSize:'18px',fontWeight:700,color:C.text,marginTop:'12px'}}>Sign up as an Insurance Partner</div>
        </div>
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'20px'}}>
          {[['Company name',companyName,setCompanyName],['Contact person',contactName,setContactName],['Contact email',contactEmail,setContactEmail],['Contact phone',contactPhone,setContactPhone]].map(([label,val,setter])=>(
            <div key={label} style={{marginBottom:'12px'}}>
              <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>{label}</div>
              <input value={val} onChange={e=>setter(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'14px',boxSizing:'border-box'}}/>
            </div>
          ))}
          {error&&<div style={{fontSize:'12px',color:C.red,margin:'10px 0'}}>{error}</div>}
          <button onClick={handleSubmit} disabled={saving} style={{width:'100%',border:'none',borderRadius:'10px',padding:'13px',fontSize:'14px',fontWeight:600,cursor:saving?'not-allowed':'pointer',background:C.green,color:'#fff',fontFamily:'inherit',opacity:saving?0.6:1,marginTop:'8px'}}>{saving?'Submitting…':'Sign up'}</button>
        </div>
        <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginTop:'16px'}}>Already have an account? <a href="/insurer-portal" style={{color:C.green}}>Sign in</a>.</div>
      </div>
    </div>
  )
}
