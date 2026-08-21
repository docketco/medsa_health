import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import C from '../shared/colours'
import QrScanner from '../components/QrScanner'

// medsa.health/share - public, no login required. For a non-Medsa clinic
// to either send a file into a patient's Medsa record (upload) or request
// a bundle of the patient's data (download). Registration gate first
// (clinic proving it's real), THEN choose the action, THEN scan - the
// scan itself needs to already know what to do with the result the
// moment it's decoded, so the choice has to come before it, not after.

export default function SharePage() {
  const [stage, setStage] = useState('gate') // gate | choose | upload_file | upload_scan | upload_syncing | upload_done | download_scan | download_waiting | download_ready | error
  const [clinicName, setClinicName] = useState('')
  const [clinicRegNumber, setClinicRegNumber] = useState('')
  const [gateError, setGateError] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState(null)
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [requestId, setRequestId] = useState(null)
  const [bundledRecords, setBundledRecords] = useState(null)

  async function handleGateSubmit() {
    if (!clinicName.trim()) { setGateError('Clinic name is required.'); return }
    if (!clinicRegNumber.trim()) { setGateError('A real registration/license number is required to verify eligibility.'); return }
    setGateError(null)
    setVerifying(true)
    try {
      const res = await fetch('/api/verify-license', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ registrationCode: clinicRegNumber }),
      })
      const result = await res.json()
      setVerificationResult(result)
    } catch (e) {
      setVerificationResult({ status: 'ERROR', message: 'Could not reach the verification service.' })
    }
    setVerifying(false)
    setStage('choose')
  }

  async function handleQrScanned(qrData, direction) {
    const { data: patient } = await supabase.from('patients').select('id, full_name, medsa_id').eq('medsa_id', qrData).maybeSingle()
    if (!patient) { setError('Could not find a patient for this QR code.'); setStage('error'); return }

    if (direction === 'upload') {
      setStage('upload_syncing')
      const path = `${clinicRegNumber}/${patient.medsa_id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('external-clinic-uploads').upload(path, file)
      if (upErr) { setError(upErr.message); setStage('error'); return }
      const { error: insErr } = await supabase.from('external_share_requests').insert({
        patient_id: patient.id, direction: 'upload', clinic_name: clinicName, clinic_registration_number: clinicRegNumber,
        status: 'fulfilled', uploaded_file_url: path, uploaded_file_name: file.name,
        responded_at: new Date().toISOString(), expires_at: new Date(Date.now() + 24*60*60*1000).toISOString(),
      })
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
          <button onClick={handleGateSubmit} disabled={verifying} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:verifying?'default':'pointer',opacity:verifying?0.7:1}}>{verifying?'Verifying...':'Continue'}</button>
        </>}

        {stage==='choose' && <>
          {verificationResult?.status==='FOUND'&&<div style={{background:'#e8f5e9',borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:'#2e7d32'}}>{'\u2713'} Matched in HK Small Practice Clinic registry: {verificationResult.facilityName} (data as of {verificationResult.dataAsOf})</div>}
          {verificationResult?.status==='NOT_FOUND'&&<div style={{background:'#fff3e0',borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:'#e65100'}}>{'\u25c7'} No match in the Small Practice Clinic registry - this doesn't mean invalid, this dataset only covers that specific facility type. Proceeding on the registration number provided.</div>}
          {verificationResult?.status==='ERROR'&&<div style={{background:'#ffebee',borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:'#c62828'}}>{'\u26a0'} Verification service unavailable - proceeding on the registration number provided without confirmation.</div>}
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

        {stage==='upload_scan' && <QrScanner onScan={(data)=>handleQrScanned(data,'upload')} onCancel={()=>setStage('upload_file')}/>}

        {stage==='upload_syncing' && <div style={{textAlign:'center',fontSize:'13px',color:C.textMuted}}>Syncing to the patient's Medsa portal...</div>}

        {stage==='upload_done' && <>
          <div style={{fontSize:'32px',textAlign:'center',marginBottom:'10px'}}>{'\u2713'}</div>
          <div style={{fontSize:'15px',fontWeight:700,textAlign:'center',marginBottom:'6px'}}>Synced</div>
          <div style={{fontSize:'13px',color:C.textSub,textAlign:'center'}}>The file is now on the patient's Medsa portal.</div>
        </>}

        {stage==='download_scan' && <QrScanner onScan={(data)=>handleQrScanned(data,'download')} onCancel={()=>setStage('choose')}/>}

        {stage==='download_waiting' && <div style={{textAlign:'center',fontSize:'13px',color:C.textMuted}}>Request sent to the patient's Medsa app - waiting for them to choose what to share...</div>}

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
