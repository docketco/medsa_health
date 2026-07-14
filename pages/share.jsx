import { useState } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  green:'#4a7c59', greenLight:'#ddeae1', greenXLight:'#eef4f0',
  beige:'#f0ede8', card:'#e8e4de', cream:'#faf8f5',
  text:'#1a1a1a', textSub:'#6b6560', textMuted:'#9c9690', border:'#d8d4ce',
  red:'#c0392b', redLight:'#fdecea', amber:'#b45309', amberLight:'#fef3e2',
}

export default function SharePage() {
  const [code,setCode]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState(null)
  const [data,setData]=useState(null) // { link, patient, allergies, conditions, medications, vaccinations, records }

  async function handleSubmit() {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const { data: link, error: linkErr } = await supabase
        .from('patient_share_links')
        .select('*, patients(*)')
        .eq('code', code.trim().toUpperCase())
        .maybeSingle()

      if (linkErr || !link) throw new Error('Code not found. Check it with the patient and try again.')
      if (new Date(link.expires_at) < new Date()) throw new Error('This code has expired. Ask the patient to generate a new one.')

      const patientId = link.patients.id
      const [{data:allergies},{data:conditions},{data:medications},{data:vaccinations},{data:records}] = await Promise.all([
        link.include_allergies ? supabase.from('allergies').select('*').eq('patient_id', patientId) : Promise.resolve({data:[]}),
        link.include_conditions ? supabase.from('conditions').select('*').eq('patient_id', patientId).eq('active', true) : Promise.resolve({data:[]}),
        link.include_medications ? supabase.from('medications').select('*').eq('patient_id', patientId).eq('active', true) : Promise.resolve({data:[]}),
        link.include_vaccinations ? supabase.from('vaccinations').select('*').eq('patient_id', patientId) : Promise.resolve({data:[]}),
        link.include_full_history ? supabase.from('medical_records').select('*').eq('patient_id', patientId).order('date_of_record',{ascending:false}) : Promise.resolve({data:[]}),
      ])

      if (!link.used_at) {
        await supabase.from('patient_share_links').update({ used_at: new Date().toISOString() }).eq('id', link.id)
      }

      setData({ link, patient: link.patients, allergies: allergies||[], conditions: conditions||[], medications: medications||[], vaccinations: vaccinations||[], records: records||[] })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,fontFamily:'-apple-system, BlinkMacSystemFont, sans-serif',padding:'40px 20px'}}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
      <div style={{maxWidth:520,margin:'0 auto'}}>
        <div className="no-print" style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{fontSize:'20px',fontWeight:700,color:C.green}}>medsa</div>
          <div style={{fontSize:'13px',color:C.textSub,marginTop:'4px'}}>Shared patient information</div>
        </div>

        {!data && (
          <div className="no-print" style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'24px'}}>
            <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>Enter the code the patient gave you for this visit.</div>
            <input
              value={code}
              onChange={e=>setCode(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
              placeholder="Code"
              style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'14px',fontSize:'20px',textAlign:'center',letterSpacing:'4px',textTransform:'uppercase',marginBottom:'16px',boxSizing:'border-box'}}
            />
            {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'14px'}}>{error}</div>}
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{width:'100%',background:C.green,color:'#fff',border:'none',borderRadius:'10px',padding:'14px',fontSize:'14px',fontWeight:600,cursor:loading?'not-allowed':'pointer',opacity:loading?0.6:1}}
            >
              {loading?'Checking...':'View shared information'}
            </button>
          </div>
        )}

        {data && (
          <div style={{background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'24px'}}>
            <div style={{borderBottom:`1px solid ${C.border}`,paddingBottom:'14px',marginBottom:'16px'}}>
              <div style={{fontSize:'18px',fontWeight:700}}>{data.patient.full_name}</div>
              <div style={{fontSize:'13px',color:C.textSub}}>{data.patient.medsa_id} · DOB {new Date(data.patient.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} · Blood type {data.patient.blood_type||'—'}</div>
              {data.link.reason_note&&<div style={{fontSize:'12px',color:C.textMuted,marginTop:'6px',fontStyle:'italic'}}>Shared for: {data.link.reason_note}</div>}
            </div>

            {data.allergies.length>0&&<div style={{marginBottom:'16px'}}>
              <div style={{fontSize:'11px',fontWeight:700,color:C.red,textTransform:'uppercase',marginBottom:'6px'}}>Allergies</div>
              {data.allergies.map((a,i)=>(<div key={i} style={{fontSize:'13px',padding:'3px 0'}}>⚠ {a.allergen} ({a.severity})</div>))}
            </div>}

            {data.conditions.length>0&&<div style={{marginBottom:'16px'}}>
              <div style={{fontSize:'11px',fontWeight:700,color:C.textMuted,textTransform:'uppercase',marginBottom:'6px'}}>Active Conditions</div>
              {data.conditions.map((c,i)=>(<div key={i} style={{fontSize:'13px',padding:'3px 0'}}>◎ {c.condition_name}</div>))}
            </div>}

            {data.medications.length>0&&<div style={{marginBottom:'16px'}}>
              <div style={{fontSize:'11px',fontWeight:700,color:C.textMuted,textTransform:'uppercase',marginBottom:'6px'}}>Current Medications</div>
              {data.medications.map((m,i)=>(<div key={i} style={{fontSize:'13px',padding:'3px 0'}}>{m.medication_name} — {m.dosage} {m.frequency}</div>))}
            </div>}

            {data.vaccinations.length>0&&<div style={{marginBottom:'16px'}}>
              <div style={{fontSize:'11px',fontWeight:700,color:C.textMuted,textTransform:'uppercase',marginBottom:'6px'}}>Vaccination History</div>
              {data.vaccinations.map((v,i)=>(<div key={i} style={{fontSize:'13px',padding:'3px 0'}}>{v.vaccine_name} — {new Date(v.date_administered).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>))}
            </div>}

            {data.records.length>0&&<div style={{marginBottom:'16px'}}>
              <div style={{fontSize:'11px',fontWeight:700,color:C.textMuted,textTransform:'uppercase',marginBottom:'6px'}}>Full Medical History</div>
              {data.records.map((r,i)=>(<div key={i} style={{fontSize:'13px',padding:'6px 0',borderBottom:i<data.records.length-1?`0.5px solid ${C.border}`:'none'}}>
                <div style={{fontWeight:600}}>{r.title}</div>
                <div style={{fontSize:'11px',color:C.textMuted}}>{new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
              </div>))}
            </div>}

            <div className="no-print" style={{marginTop:'20px',paddingTop:'16px',borderTop:`1px solid ${C.border}`,fontSize:'11px',color:C.textMuted,lineHeight:1.5}}>
              This link expires {new Date(data.link.expires_at).toLocaleString('en-HK')}. Information shown is limited to what the patient chose to disclose for this visit.
            </div>
            <button className="no-print" onClick={handlePrint} style={{width:'100%',marginTop:'14px',background:C.card,color:C.text,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px',fontSize:'13px',fontWeight:500,cursor:'pointer'}}>
              Print / Save as PDF
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
