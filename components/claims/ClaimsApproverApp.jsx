// components/claims/ClaimsApproverApp.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The insurer's own claims-approver role - a real, separate identity from
// an underwriter (own table, own login at /claims-portal, own queue).
// Underwriting decides whether to accept an applicant; this decides
// whether to pay out on a claim - your own call that these are two
// different real-world jobs, even when the same person holds both
// accounts. Mirrors components/underwriter/UnderwriterApp.jsx's shape.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import C from '../shared/colours'

function Btn({ children, onClick, variant='secondary', style:sx={}, disabled }) {
  const base={border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:500,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:disabled?0.5:1,...sx}
  const V={primary:{background:C.green,color:'#fff'},secondary:{background:C.card,color:C.text,border:`0.5px solid ${C.border}`},danger:{background:C.red,color:'#fff'}}
  return <button style={{...base,...V[variant]}} onClick={onClick} disabled={disabled}>{children}</button>
}
function Card({ children, style:sx={} }) {
  return <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',overflow:'hidden',...sx}}>{children}</div>
}
function PageWrap({ children }) {
  return <div style={{maxWidth:720,margin:'0 auto',width:'100%',padding:'24px 20px'}}>{children}</div>
}

function ClaimsApproverLogin({ onLogin }) {
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [checking,setChecking]=useState(false)
  const [error,setError]=useState(null)

  async function handleLogin() {
    setChecking(true); setError(null)
    const { data: approver } = await supabase.from('insurance_claims_approvers')
      .select('id, full_name, email, institution_id, medsa_id, institutions(name)')
      .ilike('email', email.trim()).maybeSingle()
    if (!approver) { setChecking(false); setError('No claims approver account matches that email.'); return }
    const { data: ok } = await supabase.rpc('verify_claims_approver_password', { p_approver_id: approver.id, p_password: password })
    setChecking(false)
    if (!ok) { setError('Incorrect password.'); return }
    onLogin(approver)
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{fontSize:'22px',fontWeight:700,color:C.text}}>Medsa Claims Portal</div>
          <div style={{fontSize:'13px',color:C.textSub,marginTop:'4px'}}>Sign in with your claims approver account</div>
        </div>
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'20px'}}>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'14px',boxSizing:'border-box'}}/>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={handleLogin} disabled={checking||!email||!password}>{checking?'Checking…':'Sign in'}</Btn>
        </div>
        <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginTop:'16px',lineHeight:1.5}}>No account yet? Your insurer's own portal (Underwriters & Claims tab) adds claims approver accounts - not self-serve.</div>
      </div>
    </div>
  )
}

function ClaimCard({ claim, approver, onDecided }) {
  const [expanded,setExpanded]=useState(false)
  const [reason,setReason]=useState('')
  const [showReject,setShowReject]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState(null)

  async function act(action) {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/claims-approver/decide', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ claimId: claim.id, action, approverId: approver.id, approverName: approver.full_name, reason }),
      })
      const data = await res.json()
      if (data.status !== 'OK') {
        setError(data.message||'Could not save this decision.')
        if (res.status === 409) onDecided()
        setBusy(false); return
      }
      onDecided()
    } finally {
      setBusy(false)
    }
  }

  const payable = (claim.patient_copay_amount||0) + (claim.deductible_applied||0)

  return (
    <Card style={{marginBottom:'10px'}}>
      <div style={{padding:'14px 16px',cursor:'pointer'}} onClick={()=>setExpanded(x=>!x)}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'10px'}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:600}}>{claim.patients?.full_name||'Unnamed patient'}</div>
            <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{claim.insurance_plans?.plan_name} — {claim.claim_type||'General'}</div>
          </div>
          <span style={{fontSize:'10px',fontWeight:700,padding:'3px 9px',borderRadius:'20px',background:C.amberLight,color:C.amber,whiteSpace:'nowrap'}}>{claim.claim_ref}</span>
        </div>
        <div style={{fontSize:'12px',color:C.textSub,marginTop:'6px'}}>Claimed HK${claim.amount} · Insurer covers HK${claim.insurer_covered_amount??'—'}</div>
      </div>
      {expanded&&<div style={{padding:'0 16px 16px',borderTop:`0.5px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6,margin:'12px 0 8px'}}>Patient pays HK${payable} ({claim.patient_copay_amount||0} copay + {claim.deductible_applied||0} deductible){claim.verification_flag?` · ${claim.verification_flag}`:''}</div>
        {error&&<div style={{fontSize:'11px',color:C.red,marginBottom:'8px'}}>{error}</div>}
        {showReject ? (
          <div style={{marginBottom:'8px'}}>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={2} placeholder="Reason - the patient sees this" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'12px',boxSizing:'border-box',fontFamily:'inherit',marginBottom:'8px'}}/>
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>setShowReject(false)}>Cancel</Btn>
              <Btn variant="danger" style={{flex:1,fontSize:'12px'}} disabled={busy||!reason.trim()} onClick={()=>act('reject')}>{busy?'Saving…':'Confirm reject'}</Btn>
            </div>
          </div>
        ) : (
          <div style={{display:'flex',gap:'8px'}}>
            <Btn variant="primary" style={{flex:1,fontSize:'12px'}} disabled={busy} onClick={()=>act('approve')}>{busy?'Saving…':'✓ Approve'}</Btn>
            <Btn variant="danger" style={{flex:1,fontSize:'12px'}} disabled={busy} onClick={()=>setShowReject(true)}>✕ Reject</Btn>
          </div>
        )}
      </div>}
    </Card>
  )
}

function ClaimsQueueScreen({ approver }) {
  const [claims,setClaims]=useState([])
  const [loading,setLoading]=useState(true)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/claims-approver/list_queue', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ approverId: approver.id }),
    })
    const data = await res.json()
    setClaims(data.claims||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [approver.id])

  if (loading) return <PageWrap><div style={{textAlign:'center',color:C.textMuted,padding:'40px 0'}}>Loading…</div></PageWrap>

  return (
    <PageWrap>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
        <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'4px'}}>Claims Queue</h2>
        <div onClick={load} style={{fontSize:'12px',color:C.blue,cursor:'pointer'}}>↻ Refresh</div>
      </div>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>{approver.institutions?.name||'Your insurer'}</div>
      {claims.length===0&&<div style={{fontSize:'12px',color:C.textMuted}}>Nothing pending right now.</div>}
      {claims.map(c=><ClaimCard key={c.id} claim={c} approver={approver} onDecided={load}/>)}
    </PageWrap>
  )
}

export default function ClaimsApproverApp() {
  const [approver,setApprover]=useState(null)
  if (!approver) return <ClaimsApproverLogin onLogin={setApprover}/>
  return (
    <div style={{minHeight:'100vh',background:C.beige}}>
      <div style={{background:C.cream,borderBottom:`0.5px solid ${C.border}`,padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:'14px',fontWeight:700}}>{approver.full_name}</div>
          <div style={{fontSize:'11px',color:C.textMuted}}>{approver.medsa_id}</div>
        </div>
        <Btn onClick={()=>setApprover(null)}>Sign out</Btn>
      </div>
      <ClaimsQueueScreen approver={approver}/>
    </div>
  )
}
