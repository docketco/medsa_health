// pages/insurer-portal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// medsa.health/insurer-portal - the real, public entry point for an
// insurer (partnered or unpartnered) to log into their own account and
// see their own real data. Distinct from pages/institution.jsx's
// ?portal=insurance, which stays a Medsa-admin-gated internal preview
// (always shows AIA sample data) rather than a real per-insurer login -
// see that file's own comment. Accounts come from either
// /insurer-signup (self-serve) or medsa-admin approving a pending
// partnered application.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'
import InsuranceApp from '../components/insurance/InsuranceApp'
import MedsaLogo from '../components/shared/MedsaLogo'

function InsurerLogin({ onLogin }) {
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [checking,setChecking]=useState(false)
  const [error,setError]=useState(null)

  async function handleLogin() {
    setChecking(true)
    setError(null)
    const { data: company } = await supabase.from('insurance_companies')
      .select('id, name, status, relationship_type, medsa_id, institution_ref_id').ilike('contact_email', email.trim()).maybeSingle()
    if (!company || company.status !== 'active') { setChecking(false); setError('No active insurer account matches that email.'); return }
    const { data: ok } = await supabase.rpc('verify_insurance_company_password', { p_company_id: company.id, p_password: password })
    setChecking(false)
    if (!ok) { setError('Incorrect password.'); return }
    onLogin({ id: company.id, name: company.name, relationshipType: company.relationship_type, medsaId: company.medsa_id, institutionRefId: company.institution_ref_id })
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <MedsaLogo height={24}/>
          <div style={{fontSize:'18px',fontWeight:700,color:C.text,marginTop:'12px'}}>Insurance Partner Portal</div>
          <div style={{fontSize:'13px',color:C.textSub,marginTop:'4px'}}>For insurers with a Medsa account - partnered or TPA-only</div>
        </div>
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'20px'}}>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Contact email" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'14px',boxSizing:'border-box'}}/>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
          <button onClick={handleLogin} disabled={checking||!email||!password} style={{width:'100%',border:'none',borderRadius:'10px',padding:'12px',fontSize:'14px',fontWeight:600,cursor:checking?'not-allowed':'pointer',background:C.green,color:'#fff',fontFamily:'inherit',opacity:checking?0.6:1}}>{checking?'Checking…':'Sign in'}</button>
        </div>
        <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginTop:'16px',lineHeight:1.5}}>No account yet? <a href="/insurer-signup" style={{color:C.green}}>Apply here</a>.</div>
      </div>
    </div>
  )
}

export default function InsurerPortalPage() {
  const [company,setCompany]=useState(null)
  if (!company) return <InsurerLogin onLogin={setCompany}/>
  return <InsuranceApp company={company} onLogout={()=>setCompany(null)}/>
}
