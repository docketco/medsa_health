import { useState } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'
import QrScanner from '../components/QrScanner'

// medsa.health/referral-portal - public, no login required. For an
// out-of-network doctor to refer a patient to a freelance/independent
// allied health practitioner. Replaces a plain referral letter with a
// real file: who's referring, why, who they're referring to, and the
// supporting documents - all attached to the patient's record. An agent
// reviews and approves it (see AgentApp's Referrals tab) before it counts
// toward unblocking a claim that requires one (see
// insuranceAdapter.js's _checkPractitionerVerification).

export default function ReferralPortalPage() {
  const [stage, setStage] = useState('scan') // scan | form | uploading | done | error
  const [patient, setPatient] = useState(null)
  const [form, setForm] = useState({
    referringDoctorName: '', referringDoctorMchkNo: '', referringPracticeName: '',
    referredToPractitionerName: '', reason: '', clinicalNotes: '',
  })
  const [files, setFiles] = useState([])
  const [error, setError] = useState(null)

  async function handleScan(qrData) {
    const { data } = await supabase.from('patients').select('id, full_name, medsa_id').eq('medsa_id', qrData).maybeSingle()
    if (!data) { setError('Could not find a patient for this QR code.'); setStage('error'); return }
    setPatient(data)
    setStage('form')
  }

  async function handleSubmit() {
    if (!form.referringDoctorName.trim() || !form.referredToPractitionerName.trim() || !form.reason.trim()) return
    setStage('uploading')
    const documentPaths = []
    for (const file of files) {
      const path = `referrals/${patient.medsa_id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('external-clinic-uploads').upload(path, file)
      if (!upErr) documentPaths.push(path)
    }
    const { error: insErr } = await supabase.from('referrals').insert({
      patient_id: patient.id,
      referring_doctor_name: form.referringDoctorName.trim(),
      referring_doctor_mchk_no: form.referringDoctorMchkNo.trim() || null,
      referring_practice_name: form.referringPracticeName.trim() || null,
      referred_to_practitioner_name: form.referredToPractitionerName.trim(),
      reason: form.reason.trim(),
      clinical_notes: form.clinicalNotes.trim() || null,
      document_paths: documentPaths.length > 0 ? documentPaths : null,
      status: 'submitted',
    })
    if (insErr) { setError(insErr.message); setStage('error'); return }
    setStage('done')
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div style={{background:'#fff',borderRadius:'16px',padding:'28px',maxWidth:440,width:'100%'}}>

        {stage==='scan' && <>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'6px'}}>Refer a Patient</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'18px'}}>For a doctor outside Medsa referring a patient to an out-of-network practitioner. Scan the patient's Medsa QR code to begin.</div>
          <QrScanner onScan={handleScan} onCancel={()=>{}}/>
        </>}

        {stage==='form' && <>
          <div style={{fontSize:'15px',fontWeight:700,marginBottom:'4px'}}>Referral for {patient?.full_name}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>This becomes a real file attached to the patient's record - not just a letter. An agent reviews it before it's used to support any claim.</div>

          <div style={{fontSize:'12px',fontWeight:600,marginBottom:'8px'}}>Your details (the referring doctor)</div>
          <input value={form.referringDoctorName} onChange={e=>setForm(f=>({...f,referringDoctorName:e.target.value}))} placeholder="Your full name" style={inputStyle}/>
          <input value={form.referringDoctorMchkNo} onChange={e=>setForm(f=>({...f,referringDoctorMchkNo:e.target.value}))} placeholder="MCHK registration number (if applicable)" style={inputStyle}/>
          <input value={form.referringPracticeName} onChange={e=>setForm(f=>({...f,referringPracticeName:e.target.value}))} placeholder="Your clinic / hospital name" style={inputStyle}/>

          <div style={{fontSize:'12px',fontWeight:600,marginBottom:'8px',marginTop:'6px'}}>Referral details</div>
          <input value={form.referredToPractitionerName} onChange={e=>setForm(f=>({...f,referredToPractitionerName:e.target.value}))} placeholder="Name of the practitioner you're referring to" style={inputStyle}/>
          <textarea value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} rows={2} placeholder="Reason for referral" style={{...inputStyle,resize:'none',fontFamily:'inherit'}}/>
          <textarea value={form.clinicalNotes} onChange={e=>setForm(f=>({...f,clinicalNotes:e.target.value}))} rows={3} placeholder="Clinical notes (optional)" style={{...inputStyle,resize:'none',fontFamily:'inherit'}}/>

          <div style={{fontSize:'12px',fontWeight:600,marginBottom:'8px',marginTop:'6px'}}>Supporting documents</div>
          <input type="file" multiple onChange={e=>setFiles([...e.target.files])} style={{marginBottom:'16px',fontSize:'12px'}}/>

          <button onClick={handleSubmit} disabled={!form.referringDoctorName.trim()||!form.referredToPractitionerName.trim()||!form.reason.trim()}
            style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',opacity:(!form.referringDoctorName.trim()||!form.referredToPractitionerName.trim()||!form.reason.trim())?0.6:1}}>
            Submit referral
          </button>
        </>}

        {stage==='uploading' && <div style={{textAlign:'center',fontSize:'13px',color:C.textMuted}}>Submitting referral...</div>}

        {stage==='done' && <>
          <div style={{fontSize:'32px',textAlign:'center',marginBottom:'10px'}}>✓</div>
          <div style={{fontSize:'15px',fontWeight:700,textAlign:'center',marginBottom:'6px'}}>Referral submitted</div>
          <div style={{fontSize:'13px',color:C.textSub,textAlign:'center'}}>Medsa will review this referral. Once approved, it's on file for {patient?.full_name}'s record.</div>
        </>}

        {stage==='error' && <div style={{textAlign:'center',fontSize:'13px',color:C.red}}>{error}</div>}
      </div>
    </div>
  )
}

const inputStyle = {width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'10px'}
