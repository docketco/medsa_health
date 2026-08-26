import { useState } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'
import QrScanner from '../components/QrScanner'

// medsa.health/referral-portal - public, no login required (though one
// path inside it does check a real Medsa login). For any doctor - Medsa
// staff or not - referring a patient to an out-of-network practitioner.
// Replaces a plain referral letter with a real file: who's referring,
// why, who they're referring to, and supporting documents - attached to
// the patient's record. An agent reviews and approves it (AgentApp's
// Referrals tab) before it counts toward unblocking a claim that
// requires one (insuranceAdapter.js's _checkPractitionerVerification).
//
// Two ways in, converging on the same referral form:
// - Already a Medsa doctor: real medsa_id + password login (the same
//   password every Medsa staff member already has) - no separate check
//   needed, that login already means something.
// - Not on Medsa: same credential-check-then-OTP gate already built for
//   /share, reused as-is against their own practice's registration
//   number - there's no public phone/email for an individual doctor to
//   OTP (privacy, same reason SMPC doesn't publish one), so the OTP
//   targets the practice's registry-listed contact instead, exactly like
//   an out-of-network clinic uploading into a patient's record. Same
//   REMEMBERED shortcut applies on a repeat visit - nothing new built for
//   that, it's the existing mechanism in verify_clinic_credentials.js.

export default function ReferralPortalPage() {
  const [stage, setStage] = useState('choose') // choose | staff_login | gate | otp_channel_choice | otp_challenge | scan | form | uploading | done | error
  const [referrerIdentity, setReferrerIdentity] = useState(null) // { name, mchkNo, practiceName, staffMedsaId, verifiedClinicId }

  const [staffMedsaId, setStaffMedsaId] = useState('')
  const [staffPassword, setStaffPassword] = useState('')
  const [staffLoginError, setStaffLoginError] = useState(null)
  const [staffLoggingIn, setStaffLoggingIn] = useState(false)

  const [clinicName, setClinicName] = useState('')
  const [clinicRegNumber, setClinicRegNumber] = useState('')
  const [businessRegNumber, setBusinessRegNumber] = useState('')
  const [gateError, setGateError] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState(null)
  const [otpChannels, setOtpChannels] = useState([])
  const [otpSending, setOtpSending] = useState(false)
  const [otpState, setOtpState] = useState(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [otpVerifyResult, setOtpVerifyResult] = useState(null)

  const [patient, setPatient] = useState(null)
  const [form, setForm] = useState({ referredToPractitionerName: '', reason: '', clinicalNotes: '' })
  const [files, setFiles] = useState([])
  const [error, setError] = useState(null)

  // ── Path A: already a Medsa doctor - real password login, no gate ──────
  async function handleStaffLogin() {
    if (!staffMedsaId.trim() || !staffPassword) return
    setStaffLoggingIn(true)
    setStaffLoginError(null)
    const { data: ok } = await supabase.rpc('verify_staff_password', { p_medsa_id: staffMedsaId.trim(), p_password: staffPassword })
    if (!ok) { setStaffLoginError('Medsa ID or password not recognized.'); setStaffLoggingIn(false); return }
    const { data: staff } = await supabase.from('staff_credentials').select('full_name, registration_number, institution_id, institutions(name)')
      .eq('medsa_id', staffMedsaId.trim()).maybeSingle()
    setReferrerIdentity({
      name: staff?.full_name || staffMedsaId.trim(), mchkNo: staff?.registration_number || null,
      practiceName: staff?.institutions?.name || null, staffMedsaId: staffMedsaId.trim(), verifiedClinicId: null,
    })
    setStaffLoggingIn(false)
    setStage('scan')
  }

  // ── Path B: not on Medsa - same gate as /share, applied to their own practice ──
  async function handleGateSubmit() {
    if (!clinicName.trim()) { setGateError('Your practice name is required.'); return }
    if (!clinicRegNumber.trim() && !businessRegNumber.trim()) { setGateError('At least one real registration number (ORPHF or Business Registration) is required.'); return }
    setGateError(null)
    setVerifying(true)
    try {
      const res = await fetch('/api/cds/verify_clinic_credentials', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ businessRegistrationNumber: businessRegNumber, orphfCode: clinicRegNumber, clinicNameDeclared: clinicName }),
      })
      const result = await res.json()
      setVerificationResult(result)
      setVerifying(false)

      if (result.status === 'REMEMBERED' && result.contact_verified) {
        setReferrerIdentity({ name: null, mchkNo: null, practiceName: clinicName, staffMedsaId: null, verifiedClinicId: result.id })
        setStage('scan')
        return
      }
      if (result.id) {
        const chRes = await fetch('/api/cds/send_clinic_otp', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ verifiedClinicId: result.id, action: 'list_channels' }),
        })
        const chResult = await chRes.json()
        if (chResult.channels?.length > 0) {
          setOtpChannels(chResult.channels)
          setStage('otp_channel_choice')
          return
        }
      }
      setGateError('This practice matched a registry, but has no phone or email on file to confirm identity - a referral from an unconfirmed practice needs to go through Medsa support directly rather than this portal.')
    } catch (e) {
      setGateError('Could not reach the verification service - try again shortly.')
      setVerifying(false)
    }
  }

  async function handleChooseChannel(channel) {
    setOtpSending(true)
    const res = await fetch('/api/cds/send_clinic_otp', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ verifiedClinicId: verificationResult.id, action: 'send', channel }),
    })
    const result = await res.json()
    setOtpState(result)
    setOtpSending(false)
    if (result.status === 'SENT') setStage('otp_challenge')
  }

  async function handleOtpVerify() {
    setOtpVerifying(true)
    const res = await fetch('/api/cds/verify_clinic_otp', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ verifiedClinicId: verificationResult.id, code: otpCode }),
    })
    const result = await res.json()
    setOtpVerifyResult(result)
    setOtpVerifying(false)
    if (result.status === 'VERIFIED') {
      setReferrerIdentity({ name: null, mchkNo: null, practiceName: clinicName, staffMedsaId: null, verifiedClinicId: verificationResult.id })
      setStage('scan')
    }
  }

  async function handleScan(qrData) {
    const { data } = await supabase.from('patients').select('id, full_name, medsa_id').eq('medsa_id', qrData).maybeSingle()
    if (!data) { setError('Could not find a patient for this QR code.'); setStage('error'); return }
    setPatient(data)
    setStage('form')
  }

  async function handleSubmit() {
    if (!form.referredToPractitionerName.trim() || !form.reason.trim()) return
    setStage('uploading')
    const documentPaths = []
    for (const file of files) {
      const path = `referrals/${patient.medsa_id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('external-clinic-uploads').upload(path, file)
      if (!upErr) documentPaths.push(path)
    }
    const { error: insErr } = await supabase.from('referrals').insert({
      patient_id: patient.id,
      referring_doctor_name: referrerIdentity.name || staffMedsaId || null,
      referring_doctor_mchk_no: referrerIdentity.mchkNo || null,
      referring_practice_name: referrerIdentity.practiceName || null,
      referring_staff_medsa_id: referrerIdentity.staffMedsaId || null,
      referring_clinic_verification_id: referrerIdentity.verifiedClinicId || null,
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

        {stage==='choose' && <>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'6px'}}>Refer a Patient</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'18px'}}>For referring a patient to an out-of-network practitioner. First, are you already on Medsa?</div>
          <button onClick={()=>setStage('staff_login')} style={{width:'100%',padding:'14px',background:C.card,border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',marginBottom:'10px',textAlign:'left'}}>I'm a Medsa doctor - log in</button>
          <button onClick={()=>setStage('gate')} style={{width:'100%',padding:'14px',background:C.card,border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',textAlign:'left'}}>I'm outside Medsa</button>
        </>}

        {stage==='staff_login' && <>
          <div style={{fontSize:'15px',fontWeight:700,marginBottom:'6px'}}>Medsa doctor login</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>Same Medsa ID and password you already use to log in at your clinic.</div>
          <input value={staffMedsaId} onChange={e=>setStaffMedsaId(e.target.value)} placeholder="Medsa ID" style={inputStyle}/>
          <input type="password" value={staffPassword} onChange={e=>setStaffPassword(e.target.value)} placeholder="Password" style={inputStyle}/>
          {staffLoginError && <div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{staffLoginError}</div>}
          <button onClick={handleStaffLogin} disabled={staffLoggingIn||!staffMedsaId.trim()||!staffPassword} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',opacity:staffLoggingIn?0.7:1}}>{staffLoggingIn?'Checking...':'Log in'}</button>
        </>}

        {stage==='gate' && <>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'6px'}}>Verify your practice</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'18px'}}>Same real-registry check used for any outside clinic on Medsa.</div>
          <input value={clinicName} onChange={e=>setClinicName(e.target.value)} placeholder="Your clinic / hospital name" style={inputStyle}/>
          <input value={clinicRegNumber} onChange={e=>setClinicRegNumber(e.target.value)} placeholder="ORPHF licence/exemption code (e.g. CE000001)" style={inputStyle}/>
          <input value={businessRegNumber} onChange={e=>setBusinessRegNumber(e.target.value)} placeholder="Business Registration Number (e.g. C1572528)" style={inputStyle}/>
          {gateError && <div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{gateError}</div>}
          <button onClick={handleGateSubmit} disabled={verifying} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:verifying?'default':'pointer',opacity:verifying?0.7:1}}>{verifying?'Verifying...':'Continue'}</button>
        </>}

        {stage==='otp_channel_choice' && <>
          <div style={{fontSize:'15px',fontWeight:700,marginBottom:'6px'}}>Confirm you're from this practice</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>Choose how to receive a code - sent only to the contact the government registry has on file, not anything typed above.</div>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {otpChannels.includes('call')&&<button onClick={()=>handleChooseChannel('call')} disabled={otpSending} style={{width:'100%',padding:'14px',background:C.card,border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',textAlign:'left'}}>Phone call</button>}
            {otpChannels.includes('text')&&<button onClick={()=>handleChooseChannel('text')} disabled={otpSending} style={{width:'100%',padding:'14px',background:C.card,border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',textAlign:'left'}}>Text message</button>}
            {otpChannels.includes('email')&&<button onClick={()=>handleChooseChannel('email')} disabled={otpSending} style={{width:'100%',padding:'14px',background:C.card,border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',textAlign:'left'}}>Email</button>}
          </div>
          {otpSending&&<div style={{fontSize:'12px',color:C.textMuted,marginTop:'10px',textAlign:'center'}}>Sending...</div>}
        </>}

        {stage==='otp_challenge' && <>
          <div style={{fontSize:'15px',fontWeight:700,marginBottom:'6px'}}>Enter the code</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'14px'}}>Sent via {otpState?.channel} to {otpState?.target} - the registry's own contact for this practice.</div>
          {otpState?.devOnlyCode&&<div style={{background:'#fff3e0',borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:'#e65100'}}>{'◇'} No live SMS/voice/email provider connected yet - shown here for now: <strong>{otpState.devOnlyCode}</strong></div>}
          <input value={otpCode} onChange={e=>setOtpCode(e.target.value)} placeholder="6-digit code" style={{...inputStyle,letterSpacing:'2px'}}/>
          {otpVerifyResult?.status==='INCORRECT'&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>That code doesn't match.</div>}
          {otpVerifyResult?.status==='EXPIRED'&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>That code expired - request a new one.</div>}
          <button onClick={handleOtpVerify} disabled={otpVerifying||otpCode.length<6} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',marginBottom:'8px',opacity:otpVerifying||otpCode.length<6?0.6:1}}>{otpVerifying?'Checking...':'Confirm'}</button>
          <button onClick={()=>setStage('otp_channel_choice')} style={{width:'100%',padding:'10px',background:'none',border:'none',color:C.textSub,fontSize:'12px',cursor:'pointer'}}>Try a different channel</button>
        </>}

        {stage==='scan' && <>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'12px'}}>Scan the patient's Medsa QR code.</div>
          <QrScanner onScan={handleScan} onCancel={()=>{}}/>
        </>}

        {stage==='form' && <>
          <div style={{fontSize:'15px',fontWeight:700,marginBottom:'4px'}}>Referral for {patient?.full_name}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>Referring as {referrerIdentity?.name || referrerIdentity?.practiceName}. This becomes a real file attached to the patient's record - an agent reviews it before it's used to support any claim.</div>

          <input value={form.referredToPractitionerName} onChange={e=>setForm(f=>({...f,referredToPractitionerName:e.target.value}))} placeholder="Name of the practitioner you're referring to" style={inputStyle}/>
          <textarea value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} rows={2} placeholder="Reason for referral" style={{...inputStyle,resize:'none',fontFamily:'inherit'}}/>
          <textarea value={form.clinicalNotes} onChange={e=>setForm(f=>({...f,clinicalNotes:e.target.value}))} rows={3} placeholder="Clinical notes (optional)" style={{...inputStyle,resize:'none',fontFamily:'inherit'}}/>

          <div style={{fontSize:'12px',fontWeight:600,marginBottom:'8px',marginTop:'6px'}}>Supporting documents</div>
          <input type="file" multiple onChange={e=>setFiles([...e.target.files])} style={{marginBottom:'16px',fontSize:'12px'}}/>

          <button onClick={handleSubmit} disabled={!form.referredToPractitionerName.trim()||!form.reason.trim()}
            style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',opacity:(!form.referredToPractitionerName.trim()||!form.reason.trim())?0.6:1}}>
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
