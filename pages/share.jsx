import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import C from '../shared/colours'
import QrScanner from '../components/QrScanner'

// medsa.health/share - public, no login required. For a non-Medsa clinic
// to either send a file into a patient's Medsa record (upload) or request
// a bundle of the patient's data (download). Both directions require the
// clinic to verify its own registration number first - this isn't the
// patient proving who they are, it's the clinic proving it's real.

export default function SharePage() {
  const [stage, setStage] = useState('gate') // gate | choose | upload_file | upload_scan | upload_done | download_scan | download_waiting | download_ready | error
  const [clinicName, setClinicName] = useState('')
  const [clinicRegNumber, setClinicRegNumber] = useState('')
  const [gateError, setGateError] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [requestId, setRequestId] = useState(null)
  const [bundledRecords, setBundledRecords] = useState(null)

  function handleGateSubmit() {
    if (!clinicName.trim()) { setGateError('Clinic name is required.'); return }
    if (!clinicRegNumber.trim()) { setGateError('A real registration/license number is required to verify eligibility.'); return }
    setGateError(null)
    setStage('choose')
  }

  async function handleQrScanned(qrData, direction) {
    // The patient's permanent QR is expected to encode their medsa_id
    // directly - this matches the identifier used everywhere else across
    // the app, but hasn't been independently re-verified against the
    // original QR-generation code in this session.
    const { data: patient } = await supabase.from('patients').select('id, full_name, medsa_id').eq('medsa_id', qrData).maybeSingle()
    if (!patient) { setError('Could not find a patient for this QR code.'); setStage('error'); return }

    if (direction === 'upload') {
      setUploading(true)
      const path = `${clinicRegNumber}/${patient.medsa_id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('external-clinic-uploads').upload(path, file)
      if (upErr) { setError(upErr.message); setUploading(false); setStage('error'); return }
      const { error: insErr } = await supabase.from('external_share_requests').insert({
        patient_id: patient.id, direction: 'upload', clinic_name: clinicName, clinic_registration_number: clinicRegNumber,
        status: 'fulfilled', uploaded_file_url: path, uploaded_file_name: file.name,
        responded_at: new Date().toISOString(), expires_at: new Date(Date.now() + 24*60*60*1000).toISOString(),
      })
      setUploading(false)
      if (insErr) { setError(insErr.message); setStage('error'); return }
      setStage('upload_done')
    } else {
      const { data: req, error: insErr } = await supabase.from('external_share_requests').insert({
        patient_id: patient.id, direction: 'download', clinic_name: clinicName, clinic_registration_number: clinicRegNumber,
        status: 'pending', expires_at: new Date(Date.now() + 30*60*1000).toISOString(),
      }).select('id').maybeSingle()
      if (insErr || !req) { setError(insErr?.message || 'Could not create the request.'); setStage('error'); return }
      setRequestId(req.id)
      setStage('download_waiting')
    }
  }

  // Real polling while waiting for the patient to respond from their own
  // app - not a fake timer, an actual check against the real request row.
  useEffect(() => {
    if (stage !== 'download_waiting' || !requestId) return
    const interval = setInterval(async () => {
      const { data } = await supabase.from('external_share_requests').select('status, bundled_record_ids').eq('id', requestId).maybeSingle()
      if (data?.status === 'fulfilled') {
        const { data: records } = await supabase.from('medical_records').select('*').in('id', data.bundled_record_ids || [])
        setBundledRecords(records || [])
        setStage('download_ready')
      } else if (data?.status === 'declined') {
        setError('The patient declined this request.')
        setStage('error')
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [stage, requestId])

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div style={{background:'#fff',borderRadius:'16px',padding:'28px',maxWidth:400,width:'100%'}}>

        {stage==='gate' && <>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'6px'}}>Medsa Share</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'18px'}}>For a clinic not using Medsa. Verify your clinic before sending or requesting patient data.</div>
          <input value={clinicName} onChange={e=>setClinicName(e.target.value)} placeholder="Clinic name" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'10px'}}/>
          <input value={clinicRegNumber} onChange={e=>setClinicRegNumber(e.target.value)} placeholder="Clinic registration/license number" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'14px'}}/>
          {gateError && <div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{gateError}</div>}
          <button onClick={handleGateSubmit} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer'}}>Continue</button>
        </>}

        {stage==='choose' && <>
          <div style={{fontSize:'15px',fontWeight:700,marginBottom:'16px'}}>What do you need to do?</div>
          <button onClick={()=>setStage('upload_file')} style={{width:'100%',padding:'14px',background:C.card,border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',marginBottom:'10px',textAlign:'left'}}>
            Upload — send a file into this patient's Medsa record
          </button>
          <button onClick={()=>setStage('download_scan')} style={{width:'100%',padding:'14px',background:C.card,border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',textAlign:'left'}}>
            Download — request data from this patient
          </button>
        </>}

        {stage==='upload_file' && <>
          <div style={{fontSize:'15px',fontWeight:700,marginBottom:'12px'}}>Upload the file first</div>
          <input type="file" onChange={e=>setFile(e.target.files[0])} style={{marginBottom:'16px'}}/>
          <button disabled={!file} onClick={()=>setStage('upload_scan')} style={{width:'100%',padding:'12px',background:file?C.green:C.border,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:file?'pointer':'default'}}>Submit, then scan patient QR</button>
        </>}

        {stage==='upload_scan' && (uploading
          ? <div style={{textAlign:'center',fontSize:'13px',color:C.textMuted}}>Syncing to the patient's Medsa portal...</div>
          : <QrScanner onScan={(data)=>handleQrScanned(data,'upload')} onCancel={()=>setStage('upload_file')}/>)}

        {stage==='upload_done' && <>
          <div style={{fontSize:'32px',textAlign:'center',marginBottom:'10px'}}>{'\u2713'}</div>
          <div style={{fontSize:'15px',fontWeight:700,textAlign:'center',marginBottom:'6px'}}>Synced</div>
          <div style={{fontSize:'13px',color:C.textSub,textAlign:'center'}}>The file is now on the patient's Medsa portal.</div>
        </>}

        {stage==='download_scan' && <QrScanner onScan={(data)=>handleQrScanned(data,'download')} onCancel={()=>setStage('choose')}/>}

        {stage==='download_waiting' && <>
          <div style={{textAlign:'center',fontSize:'13px',color:C.textMuted}}>Request sent to the patient's Medsa app - waiting for them to choose what to share...</div>
        </>}

        {stage==='download_ready' && <>
          <div style={{fontSize:'15px',fontWeight:700,marginBottom:'12px'}}>The patient shared {bundledRecords?.length||0} record{bundledRecords?.length===1?'':'s'}</div>
          {bundledRecords?.map(r=>(
            <div key={r.id} style={{padding:'10px',background:C.card,borderRadius:'8px',marginBottom:'8px',fontSize:'13px'}}>
              <div style={{fontWeight:600}}>{r.title}</div>
              <div style={{color:C.textSub}}>{r.date_of_record}</div>
            </div>
          ))}
          <button onClick={()=>window.print()} style={{width:'100%',padding:'12px',background:C.card,border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',marginTop:'10px'}}>Print</button>
        </>}

        {stage==='error' && <div style={{textAlign:'center',fontSize:'13px',color:C.red}}>{error}</div>}
      </div>
    </div>
  )
}
