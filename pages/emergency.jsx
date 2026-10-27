import { useState, useEffect } from 'react'
import C from '../components/shared/colours'

// medsa.health/emergency?t=<token> - public, no login required. What a
// Medsa Emergency Card's QR points to. Built for a stranger/EMS/A&E staff
// member who scanned a physical card off someone who can't speak or
// respond right now - so no gate, no "choose an action" step, just the
// data, as fast as possible. A patient also uses this exact URL as their
// own "Add to Home Screen" shortcut target (see EmergencyCardSetup),
// since a true OS home-screen widget isn't buildable from this web app.

export default function EmergencyPage() {
  const [state, setState] = useState('loading') // loading | not_found | found
  const [data, setData] = useState(null)

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('t')
    if (!token) { setState('not_found'); return }
    fetch(`/api/public/emergency_card?t=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => { if (d.found) { setData(d); setState('found') } else setState('not_found') })
      .catch(() => setState('not_found'))
  }, [])

  if (state === 'loading') {
    return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:C.beige,fontFamily:'system-ui',fontSize:'13px',color:C.textMuted}}>Loading…</div>
  }
  if (state === 'not_found') {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:C.beige,fontFamily:'system-ui',padding:'24px',textAlign:'center'}}>
        <div>
          <div style={{fontSize:'36px',marginBottom:'10px'}}>⚠️</div>
          <div style={{fontSize:'16px',fontWeight:700,color:C.text,marginBottom:'6px'}}>This emergency card isn't active</div>
          <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>The link may be invalid, or the card holder has deactivated it.</div>
        </div>
      </div>
    )
  }

  const p = data
  return (
    <div style={{minHeight:'100vh',background:C.beige,fontFamily:'system-ui',padding:'20px 16px 40px'}}>
      <div style={{maxWidth:440,margin:'0 auto'}}>
        <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginBottom:'14px',letterSpacing:'0.5px',textTransform:'uppercase'}}>Medsa Emergency Card</div>
        <div style={{background:C.redLight,border:`1px solid ${C.red}`,borderRadius:'14px',padding:'18px'}}>
          <div style={{fontSize:'18px',fontWeight:700,marginBottom:'2px'}}>{p.full_name}</div>
          <div style={{fontSize:'12.5px',color:C.textSub,marginBottom:'14px'}}>{p.date_of_birth ? `DOB ${new Date(p.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} · ` : ''}{p.medsa_id}</div>
          <div style={{display:'flex',gap:'10px',marginBottom:'14px'}}>
            <div style={{flex:1,background:'rgba(192,57,43,0.12)',borderRadius:'10px',padding:'12px',textAlign:'center'}}>
              <div style={{fontSize:'10px',color:C.red}}>Blood type</div>
              <div style={{fontSize:'28px',fontWeight:800,color:C.red}}>{p.blood_type || '—'}</div>
            </div>
            <div style={{flex:2,background:'rgba(192,57,43,0.12)',borderRadius:'10px',padding:'12px'}}>
              <div style={{fontSize:'10px',color:C.red,marginBottom:'4px'}}>Emergency contact</div>
              <div style={{fontSize:'14px',fontWeight:600}}>{p.emergency_contact_name ? `${p.emergency_contact_name} (${p.emergency_contact_rel||'Contact'})` : 'Not set'}</div>
              <div style={{fontSize:'13px',color:C.textSub}}>{p.emergency_contact_phone || '—'}</div>
            </div>
          </div>

          <div style={{fontSize:'10px',color:C.red,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'4px'}}>Active conditions</div>
          {p.conditions.length>0
            ? p.conditions.map((c,i)=><div key={i} style={{fontSize:'14px',fontWeight:500,padding:'4px 0'}}>◎ {c.condition_name}{c.severity?` (${c.severity})`:''}</div>)
            : <div style={{fontSize:'12.5px',color:C.textSub,padding:'4px 0'}}>None on file</div>}

          <div style={{borderTop:`0.5px solid rgba(192,57,43,0.2)`,marginTop:'10px',paddingTop:'10px'}}>
            <div style={{fontSize:'10px',color:C.red,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'4px'}}>Allergies</div>
            {p.allergies.length>0
              ? p.allergies.map((a,i)=>(
                  <div key={i} style={{padding:'3px 0',display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
                    <span style={{fontSize:'14px',fontWeight:700,color:C.red}}>⚠ {a.allergen}{a.severity?` — ${a.severity}`:''}</span>
                    {a.reported_by==='patient_reported'&&<span style={{fontSize:'9px',padding:'1px 6px',borderRadius:'20px',background:'rgba(212,160,23,0.15)',color:C.amber,fontWeight:600}}>Self-reported</span>}
                    {a.reported_by==='document_scan'&&<span style={{fontSize:'9px',padding:'1px 6px',borderRadius:'20px',background:'rgba(212,160,23,0.15)',color:C.amber,fontWeight:600}}>From a document</span>}
                  </div>
                ))
              : <div style={{fontSize:'12.5px',color:C.textSub,padding:'3px 0'}}>None known</div>}
          </div>

          <div style={{borderTop:`0.5px solid rgba(192,57,43,0.2)`,marginTop:'10px',paddingTop:'10px'}}>
            <div style={{fontSize:'10px',color:C.red,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'4px'}}>Current medications</div>
            {p.medications.length>0
              ? p.medications.map((m,i)=><div key={i} style={{fontSize:'13px',color:C.textSub,padding:'2px 0'}}>◉ {m.medication_name}{m.dosage?` ${m.dosage}`:''}{m.frequency?` — ${m.frequency}`:''}</div>)
              : <div style={{fontSize:'12.5px',color:C.textSub,padding:'2px 0'}}>None on file</div>}
          </div>

          {p.familyHistory.length>0&&(
            <div style={{borderTop:`0.5px solid rgba(192,57,43,0.2)`,marginTop:'10px',paddingTop:'10px'}}>
              <div style={{fontSize:'10px',color:C.red,marginBottom:'3px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Family history (self-reported)</div>
              {p.familyHistory.map((fh,i)=><div key={i} style={{fontSize:'12.5px',color:C.textSub,padding:'2px 0'}}>◈ {fh.relationship}: {fh.condition_name}</div>)}
            </div>
          )}
        </div>
        <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginTop:'14px',lineHeight:1.5}}>This data is sourced from the card holder's verified Medsa records and updates automatically. Self-reported items are clearly labelled.</div>
      </div>
    </div>
  )
}
