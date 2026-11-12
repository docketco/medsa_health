// pages/agent-signup.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Self-service agent signup - see pages/api/agent/self_signup.js's own
// header comment for why this exists and what it's backed against.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'
import MedsaLogo from '../components/shared/MedsaLogo'

export default function AgentSignupPage() {
  const [form, setForm] = useState({ fullName:'', email:'', phone:'', licenseNumber:'', password:'', confirmPassword:'' })
  const [proofFile, setProofFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  // Real gap: no confirm-password field meant a typo in the only password
  // box was invisible until the very next sign-in attempt failed, with
  // no way to tell "wrong password" apart from "I mistyped it when I
  // signed up" - the same confirm-field pattern most real signup forms
  // use specifically to catch this before the account is even created.
  const passwordsMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword

  async function handleSubmit() {
    if (!form.fullName.trim() || !form.email.trim() || !form.licenseNumber.trim() || !form.password) return
    if (form.password !== form.confirmPassword) { setError('Passwords don\'t match.'); return }
    setSaving(true); setError(null)
    try {
      let licenseProofPath = null
      if (proofFile) {
        const path = `agent-license-proof/${Date.now()}-${proofFile.name}`
        const { error: upErr } = await supabase.storage.from('policy-contracts').upload(path, proofFile)
        if (upErr) { setError(upErr.message); setSaving(false); return }
        licenseProofPath = path
      }
      const res = await fetch('/api/agent/self_signup', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, licenseProofPath }),
      })
      const data = await res.json()
      if (data.status !== 'OK') { setError(data.message||'Could not create your account.'); setSaving(false); return }
      setDone(true)
    } finally {
      setSaving(false)
    }
  }

  if (done) return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380,textAlign:'center'}}>
        <MedsaLogo height={24}/>
        <div style={{fontSize:'17px',fontWeight:700,color:C.text,marginTop:'16px',marginBottom:'8px'}}>Account created - pending verification</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Medsa checks your license number against the Insurance Authority's own public register before your account goes live - this usually doesn't take long. You'll be able to sign in once it's verified.</div>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <MedsaLogo height={24}/>
          <div style={{fontSize:'18px',fontWeight:700,color:C.text,marginTop:'12px'}}>Agent sign-up</div>
          <div style={{fontSize:'13px',color:C.textSub,marginTop:'4px'}}>You're not tied to one insurer to get started - add appointments afterward from My Insurers.</div>
        </div>
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'20px'}}>
          <input value={form.fullName} onChange={e=>setForm(f=>({...f,fullName:e.target.value}))} placeholder="Full name" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="Email" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="Phone (optional)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input value={form.licenseNumber} onChange={e=>setForm(f=>({...f,licenseNumber:e.target.value}))} placeholder="IA license number" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Choose a password" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input type="password" value={form.confirmPassword} onChange={e=>setForm(f=>({...f,confirmPassword:e.target.value}))} placeholder="Confirm password" style={{width:'100%',border:`0.5px solid ${passwordsMismatch?C.red:C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:passwordsMismatch?'4px':'10px',boxSizing:'border-box'}}/>
          {passwordsMismatch&&<div style={{fontSize:'11px',color:C.red,marginBottom:'10px'}}>Passwords don't match.</div>}
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>Proof of your license (optional, but speeds up verification)</div>
          <input type="file" onChange={e=>setProofFile(e.target.files?.[0]||null)} style={{fontSize:'11px',marginBottom:'14px'}}/>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
          <button onClick={handleSubmit} disabled={saving||!form.fullName.trim()||!form.email.trim()||!form.licenseNumber.trim()||!form.password||passwordsMismatch||!form.confirmPassword} style={{width:'100%',border:'none',borderRadius:'10px',padding:'12px',fontSize:'14px',fontWeight:600,cursor:saving?'not-allowed':'pointer',background:C.green,color:'#fff',fontFamily:'inherit',opacity:saving?0.6:1}}>{saving?'Creating…':'Create account'}</button>
        </div>
        <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginTop:'16px',lineHeight:1.5}}>Already have an account? <a href="/agent-portal" style={{color:C.green}}>Sign in</a>.</div>
      </div>
    </div>
  )
}
