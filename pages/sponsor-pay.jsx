// pages/sponsor-pay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Public, no-login page - the sponsor's own half of the redesigned carousel
// flow. Medsa still reviews content first (pages/sponsor-submit.jsx lands in
// home_carousel_submissions as 'pending'; medsa-admin's Carousel tab reviews
// it and sets a monthly rate via /api/sponsor/approve_for_payment.js, which
// emails the sponsor the link here). Once here, the sponsor - not Medsa -
// picks their own duration and start date and pays, same self-serve pattern
// as Sponsored Listings (components/insurance/InsuranceApp.jsx's
// SponsoredListings). Nothing goes live until Stripe confirms payment (see
// /api/webhooks/stripe.js and this page's own verify-on-return fallback) -
// and even then, it's scheduled to the exact start/end date picked here, not
// published immediately forever.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'
import { grossUpForStripeFee } from '../lib/paymentFees'

function PreviewCard({ sub }) {
  return (
    <div style={{borderRadius:'14px',overflow:'hidden',background:C.cream,border:`0.5px solid ${C.border}`,maxWidth:280}}>
      {sub.image_url&&<img src={sub.image_url} alt="" style={{width:'100%',height:110,objectFit:'cover',display:'block'}}/>}
      <div style={{padding:'12px 14px'}}>
        <span style={{fontSize:'9px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',color:sub.item_type==='ad'?C.amber:C.green}}>{sub.item_type==='ad'?(sub.sponsor_name?`Sponsored · ${sub.sponsor_name}`:'Sponsored'):'Newsletter'}</span>
        <div style={{fontSize:'13px',fontWeight:600,marginTop:'4px',marginBottom:'2px'}}>{sub.title}</div>
        {sub.subtitle&&<div style={{fontSize:'11px',color:C.textSub,lineHeight:1.4}}>{sub.subtitle}</div>}
      </div>
    </div>
  )
}

export default function SponsorPayPage() {
  const [stage, setStage] = useState('loading') // loading | ready | not_found | wrong_status | already_paid | paying | done | error
  const [sub, setSub] = useState(null)
  const [months, setMonths] = useState(1)
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0,10))
  const [error, setError] = useState(null)
  const [returnNotice, setReturnNotice] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id')
    const sessionId = params.get('session_id')
    if (!id) { setStage('not_found'); return }

    async function load() {
      const { data } = await supabase.from('home_carousel_submissions').select('*').eq('id', id).maybeSingle()
      if (!data) { setStage('not_found'); return }
      setSub(data)
      if (params.get('paid') === '1' && sessionId) {
        fetch('/api/sponsor/verify_scheduled_checkout', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ sessionId }),
        }).then(r=>r.json()).then(result => {
          if (result.status === 'OK') { setReturnNotice({ ok: true, text: 'Payment confirmed - your placement is scheduled.' }); setStage('done') }
          else if (result.status === 'NOT_PAID') { setReturnNotice({ ok: false, text: `Payment didn't complete (status: ${result.paymentStatus}) - nothing was charged.` }); setStage('ready') }
          else { setReturnNotice({ ok: false, text: result.message || 'Could not verify this payment - contact Medsa with your payment confirmation.' }); setStage('ready') }
        }).catch(() => { setReturnNotice({ ok: false, text: 'Could not reach Medsa to verify this payment - contact Medsa with your payment confirmation.' }); setStage('ready') })
        window.history.replaceState({}, '', window.location.pathname + '?id=' + id)
        return
      }
      if (params.get('cancelled') === '1') setReturnNotice({ ok: false, text: 'Checkout was cancelled - nothing was charged.' })
      if (data.payment_status === 'paid') { setStage('already_paid'); return }
      if (data.status !== 'approved_awaiting_payment') { setStage('wrong_status'); return }
      setStage('ready')
    }
    load()
  }, [])

  async function handlePay() {
    if (!sub) return
    setError(null); setStage('paying')
    try {
      const res = await fetch('/api/sponsor/create_scheduled_checkout', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ submissionId: sub.id, months, startsAt }),
      })
      const data = await res.json()
      if (data.status === 'CREATED' && data.paymentUrl) { window.location.href = data.paymentUrl; return }
      setError(data.message || 'Could not start checkout.')
      setStage('ready')
    } catch (e) {
      setError(e.message || 'Something went wrong - please try again.')
      setStage('ready')
    }
  }

  const rate = sub?.price_hkd || 0
  const netAmountHKD = rate * months
  const { grossAmountHKD } = grossUpForStripeFee(netAmountHKD)
  const endDate = (() => { const d = new Date(`${startsAt}T00:00:00`); if (isNaN(d.getTime())) return null; d.setMonth(d.getMonth()+months); return d })()

  const Shell = ({ children }) => (
    <div style={{background:C.beige,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',fontFamily:'system-ui,sans-serif'}}>
      <div style={{background:'#fff',borderRadius:'16px',padding:'32px',maxWidth:420,width:'100%'}}>{children}</div>
    </div>
  )

  if (stage === 'loading') return <Shell><div style={{textAlign:'center',color:C.textMuted,fontSize:'13px'}}>Loading…</div></Shell>
  if (stage === 'not_found') return <Shell><div style={{textAlign:'center'}}><div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Not found</div><div style={{fontSize:'13px',color:C.textSub}}>This link doesn't match a real submission - double-check it, or contact Medsa.</div></div></Shell>
  if (stage === 'wrong_status') return <Shell><div style={{textAlign:'center'}}><div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Not ready yet</div><div style={{fontSize:'13px',color:C.textSub}}>This submission hasn't been approved for payment yet - Medsa will email you once it has.</div></div></Shell>
  if (stage === 'already_paid' || stage === 'done') return <Shell><div style={{textAlign:'center'}}>
    <div style={{fontSize:'32px',marginBottom:'12px'}}>✓</div>
    <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Scheduled</div>
    <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>"{sub?.title}" is paid and scheduled{sub?.starts_at?` to go live ${sub.starts_at}`:''}{sub?.ends_at?` through ${sub.ends_at}`:''}.</div>
  </div></Shell>

  return (
    <Shell>
      <div style={{fontSize:'17px',fontWeight:700,marginBottom:'4px'}}>Schedule your placement</div>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>Approved at HK${rate.toLocaleString()}/month. Pick how long and when it starts.</div>
      {returnNotice&&<div style={{marginBottom:'14px',padding:'10px 12px',borderRadius:'10px',fontSize:'12px',lineHeight:1.5,background:returnNotice.ok?C.greenXLight:C.redLight,border:`0.5px solid ${returnNotice.ok?C.green:C.red}`,color:returnNotice.ok?C.green:C.red}}>{returnNotice.text}</div>}
      {sub&&<div style={{marginBottom:'16px'}}><PreviewCard sub={sub}/></div>}

      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Duration</div>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
        {[1,3,6].map(m=>(
          <div key={m} onClick={()=>setMonths(m)} style={{flex:1,padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:months===m?C.navy:C.beige,color:months===m?'#fff':C.text,border:`0.5px solid ${months===m?C.navy:C.border}`}}>{m} mo · HK${(rate*m).toLocaleString()}</div>
        ))}
      </div>

      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Start date</div>
      <input type="date" value={startsAt} min={new Date().toISOString().slice(0,10)} onChange={e=>setStartsAt(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',marginBottom:'6px',boxSizing:'border-box'}}/>
      {endDate&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'14px'}}>Runs through {endDate.toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}.</div>}

      <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px'}}>Actual card charge: HK${grossAmountHKD.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} (includes Stripe's card processing fee - Medsa receives the full HK${netAmountHKD.toLocaleString()} quoted).</div>

      {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
      <button onClick={handlePay} disabled={stage==='paying'} style={{width:'100%',padding:'12px',background:C.navy,color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer'}}>{stage==='paying'?'Opening checkout…':`Pay HK$${grossAmountHKD.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} & schedule`}</button>
    </Shell>
  )
}
