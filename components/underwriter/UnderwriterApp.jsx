// components/underwriter/UnderwriterApp.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The insurer's own underwriter role (aq2-06) - a real, separate identity
// from a sales agent, seeing the ONE thing agents never do: the full
// declared-conditions detail and plan-specific reasoning behind a flagged
// case. Only ever reaches a case that lib/planSuitabilityMatch.js couldn't
// confidently approve or decline on its own, plus the lighter "clean case,
// just needs a sign-off" queue for insurers who haven't turned on
// auto_buy_on_clean (aq2-19). Every decision is logged (aq2-16) via
// pages/api/underwriter/decide.js.
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
function SecLabel({ children }) {
  return <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.9px',color:C.textMuted,margin:'20px 0 10px'}}>{children}</div>
}
function PageWrap({ children }) {
  return <div style={{maxWidth:720,margin:'0 auto',width:'100%',padding:'24px 20px'}}>{children}</div>
}

function UnderwriterLogin({ onLogin }) {
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [checking,setChecking]=useState(false)
  const [error,setError]=useState(null)

  async function handleLogin() {
    setChecking(true); setError(null)
    const { data: underwriter } = await supabase.from('insurance_underwriters')
      .select('id, full_name, email, institution_id, medsa_id, institutions(name)')
      .ilike('email', email.trim()).maybeSingle()
    if (!underwriter) { setChecking(false); setError('No underwriter account matches that email.'); return }
    const { data: ok } = await supabase.rpc('verify_underwriter_password', { p_underwriter_id: underwriter.id, p_password: password })
    setChecking(false)
    if (!ok) { setError('Incorrect password.'); return }
    onLogin(underwriter)
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{fontSize:'22px',fontWeight:700,color:C.text}}>Medsa Underwriter Portal</div>
          <div style={{fontSize:'13px',color:C.textSub,marginTop:'4px'}}>Sign in with your underwriter account</div>
        </div>
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'20px'}}>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'14px',boxSizing:'border-box'}}/>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={handleLogin} disabled={checking||!email||!password}>{checking?'Checking…':'Sign in'}</Btn>
        </div>
        <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginTop:'16px',lineHeight:1.5}}>No account yet? Your insurer's own portal (Teams tab) adds underwriter accounts - not self-serve.</div>
      </div>
    </div>
  )
}

function CaseCard({ inquiry, underwriter, isCleanSignoff, onDecided }) {
  const [expanded,setExpanded]=useState(false)
  const [reason,setReason]=useState('')
  const [reportNote,setReportNote]=useState('')
  const [reportDoctor,setReportDoctor]=useState('')
  const [showDecline,setShowDecline]=useState(false)
  const [showRequestReport,setShowRequestReport]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState(null)

  async function act(action, extra={}) {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/underwriter/decide', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ inquiryId: inquiry.id, action, underwriterId: underwriter.id, underwriterName: underwriter.full_name, ...extra }),
      })
      const data = await res.json()
      if (data.status !== 'OK') { setError(data.message||'Could not save this decision.'); setBusy(false); return }
      onDecided()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card style={{marginBottom:'10px'}}>
      <div style={{padding:'14px 16px',cursor:'pointer'}} onClick={()=>setExpanded(x=>!x)}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'10px'}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:600}}>{inquiry.applicant_full_name||'Unnamed applicant'}</div>
            <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{inquiry.insurance_plans?.plan_name} — {inquiry.insurance_plans?.company_name}</div>
          </div>
          <span style={{fontSize:'10px',fontWeight:700,padding:'3px 9px',borderRadius:'20px',background:isCleanSignoff?C.greenXLight:C.amberLight,color:isCleanSignoff?C.green:C.amber,whiteSpace:'nowrap'}}>
            {isCleanSignoff?'Clean - sign-off':'Flagged'}
          </span>
        </div>
        {inquiry.quoted_premium_hkd!=null&&<div style={{fontSize:'12px',color:C.textSub,marginTop:'6px'}}>Est. HK${inquiry.quoted_premium_hkd}/mo</div>}
      </div>
      {expanded&&<div style={{padding:'0 16px 16px',borderTop:`0.5px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',color:C.textMuted,margin:'12px 0 6px'}}>Full detail - underwriter-only</div>
        <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6,marginBottom:'8px'}}>{inquiry.suitability_summary}</div>
        {(inquiry.declared_conditions||[]).length>0&&<div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>Declared: {inquiry.declared_conditions.join(', ')}</div>}
        {inquiry.applicant_hkid&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'12px'}}>HKID {inquiry.applicant_hkid}</div>}
        {inquiry.requested_report_note&&<div style={{background:C.beige,borderRadius:'8px',padding:'10px 12px',marginBottom:'12px',fontSize:'11px',color:C.textSub}}>
          Report already requested{inquiry.requested_report_doctor?` from ${inquiry.requested_report_doctor}`:''}: {inquiry.requested_report_note}
        </div>}
        {error&&<div style={{fontSize:'11px',color:C.red,marginBottom:'8px'}}>{error}</div>}

        {showDecline ? (
          <div style={{marginBottom:'8px'}}>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={2} placeholder="Reason - the patient sees this" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'12px',boxSizing:'border-box',fontFamily:'inherit',marginBottom:'8px'}}/>
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>setShowDecline(false)}>Cancel</Btn>
              <Btn variant="danger" style={{flex:1,fontSize:'12px'}} disabled={busy||!reason.trim()} onClick={()=>act('decline',{reason})}>{busy?'Saving…':'Confirm decline'}</Btn>
            </div>
          </div>
        ) : showRequestReport ? (
          <div style={{marginBottom:'8px'}}>
            <input value={reportDoctor} onChange={e=>setReportDoctor(e.target.value)} placeholder="Named doctor (optional)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'12px',boxSizing:'border-box',marginBottom:'8px'}}/>
            <textarea value={reportNote} onChange={e=>setReportNote(e.target.value)} rows={2} placeholder="What the report should cover - scoped to the one flagged item" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'12px',boxSizing:'border-box',fontFamily:'inherit',marginBottom:'8px'}}/>
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>setShowRequestReport(false)}>Cancel</Btn>
              <Btn variant="primary" style={{flex:1,fontSize:'12px'}} disabled={busy||!reportNote.trim()} onClick={()=>act('request_report',{reportNote,reportDoctor})}>{busy?'Saving…':'Send request'}</Btn>
            </div>
          </div>
        ) : (
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <Btn variant="primary" style={{flex:1,fontSize:'12px'}} disabled={busy} onClick={()=>act('approve')}>{busy?'Saving…':'✓ Approve'}</Btn>
            {!isCleanSignoff&&<Btn style={{flex:1,fontSize:'12px'}} disabled={busy} onClick={()=>setShowRequestReport(true)}>Request report</Btn>}
            <Btn variant="danger" style={{flex:1,fontSize:'12px'}} disabled={busy} onClick={()=>setShowDecline(true)}>✕ Decline</Btn>
          </div>
        )}
      </div>}
    </Card>
  )
}

function QueueScreen({ underwriter }) {
  const [flagged,setFlagged]=useState([])
  const [cleanSignoff,setCleanSignoff]=useState([])
  const [loading,setLoading]=useState(true)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/underwriter/list_queue', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ underwriterId: underwriter.id }),
    })
    const data = await res.json()
    setFlagged(data.flagged||[])
    setCleanSignoff(data.cleanSignoff||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [underwriter.id])

  if (loading) return <PageWrap><div style={{textAlign:'center',color:C.textMuted,padding:'40px 0'}}>Loading…</div></PageWrap>

  return (
    <PageWrap>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'4px'}}>Underwriting Queue</h2>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>{underwriter.institutions?.name||'Your insurer'}</div>

      <SecLabel>Flagged - needs real review ({flagged.length})</SecLabel>
      {flagged.length===0&&<div style={{fontSize:'12px',color:C.textMuted}}>Nothing flagged right now.</div>}
      {flagged.map(i=><CaseCard key={i.id} inquiry={i} underwriter={underwriter} isCleanSignoff={false} onDecided={load}/>)}

      <SecLabel>Clean - quick sign-off ({cleanSignoff.length})</SecLabel>
      {cleanSignoff.length===0&&<div style={{fontSize:'12px',color:C.textMuted}}>Nothing waiting on a clean-case sign-off.</div>}
      {cleanSignoff.map(i=><CaseCard key={i.id} inquiry={i} underwriter={underwriter} isCleanSignoff={true} onDecided={load}/>)}
    </PageWrap>
  )
}

export default function UnderwriterApp() {
  const [underwriter,setUnderwriter]=useState(null)
  if (!underwriter) return <UnderwriterLogin onLogin={setUnderwriter}/>
  return (
    <div style={{minHeight:'100vh',background:C.beige}}>
      <div style={{background:C.cream,borderBottom:`0.5px solid ${C.border}`,padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:'14px',fontWeight:700}}>{underwriter.full_name}</div>
          <div style={{fontSize:'11px',color:C.textMuted}}>{underwriter.medsa_id}</div>
        </div>
        <Btn onClick={()=>setUnderwriter(null)}>Sign out</Btn>
      </div>
      <QueueScreen underwriter={underwriter}/>
    </div>
  )
}
