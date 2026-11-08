import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { resolveScannedPatient } from '../lib/scannedPatientCode'
import C from '../components/shared/colours'
import QrScanner from '../components/QrScanner'

// medsa.health/referral-portal - public, no login required (though one
// path inside it does check a real Medsa login). Two roles share this
// page:
//
// - The REFERRING doctor (doctor 1) - submits who they're referring, why,
//   and who to. Verified via Medsa login (in-network) or the same
//   credential-check + OTP already built for /share (out-of-network).
// - The RECEIVING practitioner (doctor 2) - arrives via a link doctor 1
//   shares (?receive=<referralId>). Using this portal at all is optional
//   (nobody can require an outside doctor to log into it), but what they
//   submit here is their real consultation record - findings, diagnosis,
//   materials like x-rays - the same as doctor 1's own submission, not a
//   lesser add-on. Same scan step doctor 1 went through too, not skipped
//   just because the link already knows the patient.
//
// How much doctor 2 has to verify depends on doctor 1's own trust level -
// this is the actual point of asking doctor 1 to verify at all:
// - Doctor 1 was a logged-in Medsa doctor -> doctor 1 already vouches for
//   the referral, so doctor 2 skips the gate entirely. Doctor 2 still
//   enters a registration number + phone, which gets remembered for a
//   real OTP check later (same 90-day window as everywhere else) -
//   they're just not asked to prove it *right now*.
// - Doctor 1 was an out-of-network practice verified via OTP -> doctor 2
//   goes through that same gate themselves. One doctor's OTP doesn't
//   vouch for a second, unverified one.
//
// No live outbound email exists in this app yet (same honest gap as
// SMS/voice OTP delivery elsewhere) - so instead of pretending to send
// an email, doctor 1's "done" screen gives a real link plus a mailto:
// button that opens *their own* email client, already addressed and
// pre-filled. That's arguably more trustworthy than an automated system
// email anyway, and needs zero new infrastructure.

export default function ReferralPortalPage() {
  const router = useRouter()
  const receiveId = router.query.receive

  const [stage, setStage] = useState('loading')
  // Referrer (doctor 1) state
  const [referrerIdentity, setReferrerIdentity] = useState(null)
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
  // Real gap found right after vouching shipped: a bare link alone let
  // anyone who got hold of it claim to be the receiving doctor it names -
  // nothing proved they actually received the referral. This code travels
  // in the same email as the link (see ClinicOpsApp.jsx's handleSendReferral)
  // and has to be entered before the vouched (no out-of-network-gate) flow
  // unlocks - verified server-side via an RPC so the real code is never
  // sent to the browser up front (loadReferral deliberately excludes it).
  const [accessCode, setAccessCode] = useState('')
  const [accessCodeError, setAccessCodeError] = useState(null)
  const [accessCodeVerifying, setAccessCodeVerifying] = useState(false)
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
  const [submittedReferralId, setSubmittedReferralId] = useState(null)

  // Receiving practitioner (doctor 2) state
  const [referral, setReferral] = useState(null)
  const [receiverName, setReceiverName] = useState('')
  const [receiverRegNumber, setReceiverRegNumber] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [receiverEmail, setReceiverEmail] = useState('')
  const [receiverVerificationMethod, setReceiverVerificationMethod] = useState(null)
  const [receiverVerifiedPractitionerId, setReceiverVerifiedPractitionerId] = useState(null)
  const [treatmentLog, setTreatmentLog] = useState({ findings: '', interventions: '', sessionDurationMinutes: '' })
  const [receiverFiles, setReceiverFiles] = useState([])
  // Review/accept/decline (Stage A - happens here, independent of the
  // actual visit) vs. scan+record-results (Stage B, further down) are two
  // separate moments for an out-of-network receiving doctor, same split
  // ClinicOpsApp.jsx's ReferralsManagementScreen gives a matched Medsa
  // doctor in-app. Verification (gate/vouched above) still comes first -
  // decided_by should name someone who's actually proven to be this
  // practice, not just whoever typed a name into a box.
  const [declineReason, setDeclineReason] = useState('')
  const [decisionActing, setDecisionActing] = useState(false)
  // Fetched only once accepted (never part of loadReferral's own select,
  // which deliberately stays viewable pre-verification) - a patient's
  // phone/email has no business reaching the browser before this doctor
  // has actually committed to taking the referral.
  const [patientContact, setPatientContact] = useState(null)

  useEffect(() => {
    if (!router.isReady) return
    if (receiveId) {
      loadReferral(receiveId)
    } else {
      setStage('choose')
    }
  }, [router.isReady, receiveId])

  async function loadReferral(id) {
    // Explicit column list, NOT select('*') - access_code must never reach
    // the browser before it's actually verified, or the code-entry step
    // below would be security theatre.
    const { data } = await supabase.from('referrals')
      .select('id, patient_id, referred_to_practitioner_name, referring_doctor_name, referring_practice_name, reason, diagnosis, referring_staff_medsa_id, status, clinical_status, decline_reason, patients(full_name)')
      .eq('id', id).maybeSingle()
    if (!data) { setError('This referral link is no longer valid.'); setStage('error'); return }
    setReferral(data)
    setPatient(data.patients)
    // A decision already made (by this portal or by a matched doctor
    // in-app) is final here - no reason to make a declining doctor sit
    // through a registry/OTP check, and a completed one has nothing left
    // to decide.
    if (data.clinical_status === 'declined') { setStage('receive_declined'); return }
    if (data.clinical_status === 'completed') { setStage('receive_already_completed'); return }
    if (data.referring_staff_medsa_id) {
      // Doctor 1 was a logged-in Medsa doctor - that already vouches for
      // this referral. Skip the out-of-network gate, but still confirm
      // whoever's here actually received the referral email (see the
      // access-code state above) before collecting anything else.
      setReceiverVerificationMethod('vouched_pending')
      setStage('receive_vouched_code')
    } else {
      setStage('receive_gate')
    }
  }

  // Shared landing point once doctor 2 is verified (vouched-code or
  // gate+OTP) - replaces the old unconditional setStage('receive_scan'):
  // that assumed review/accept and the actual visit were the same
  // moment, which real referrals aren't. 'accepted' means the decision's
  // already made (maybe weeks ago) and this is now the actual visit.
  function goToReceiveNextStage() {
    if (referral?.clinical_status === 'accepted') { setStage('receive_scan') } else { setStage('receive_decision') }
  }

  async function handleAcceptReferral() {
    if (!receiverName.trim() || decisionActing) return
    setDecisionActing(true)
    const { error: updErr } = await supabase.from('referrals').update({
      clinical_status: 'accepted', decided_by: receiverName.trim(), decided_at: new Date().toISOString(),
    }).eq('id', referral.id)
    setDecisionActing(false)
    if (updErr) { setError(updErr.message); setStage('error'); return }
    setReferral(prev => ({ ...prev, clinical_status: 'accepted' }))
    // Straightforward call-to-schedule beats building a separate patient-
    // facing booking flow - the receiving doctor just needs a real way to
    // reach the patient themselves, once they've actually committed to
    // taking the referral (not before).
    const { data: contact } = await supabase.from('patients').select('phone, email').eq('id', referral.patient_id).maybeSingle()
    setPatientContact(contact || null)
    setStage('receive_accepted')
  }

  async function handleDeclineReferralSubmit() {
    if (!declineReason.trim() || decisionActing) return
    setDecisionActing(true)
    const { error: updErr } = await supabase.from('referrals').update({
      clinical_status: 'declined', decline_reason: declineReason.trim(),
      decided_by: receiverName.trim() || null, decided_at: new Date().toISOString(),
    }).eq('id', referral.id)
    setDecisionActing(false)
    if (updErr) { setError(updErr.message); setStage('error'); return }
    setStage('receive_declined')
  }

  async function handleVerifyAccessCode() {
    if (!accessCode.trim()) return
    setAccessCodeVerifying(true)
    setAccessCodeError(null)
    const { data: ok } = await supabase.rpc('verify_referral_access_code', { p_referral_id: referral.id, p_code: accessCode.trim() })
    setAccessCodeVerifying(false)
    if (!ok) { setAccessCodeError("That code doesn't match - check the email the referring doctor sent you."); return }
    setStage('receive_vouched')
  }

  // ── Doctor 1, path A: already a Medsa doctor - real password login ─────
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

  // ── Doctor 1, path B: not on Medsa - same gate as /share ────────────────
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
        if (chResult.channels?.length > 0) { setOtpChannels(chResult.channels); setStage('otp_channel_choice'); return }
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
    const data = await resolveScannedPatient(qrData)
    if (!data) { setError('Could not find a patient for this QR code.'); setStage('error'); return }
    setPatient(data)
    setStage('form')
  }

  async function handleReferralSubmit() {
    if (!form.referredToPractitionerName.trim() || !form.reason.trim()) return
    setStage('uploading')
    const documentPaths = []
    for (const file of files) {
      const path = `referrals/${patient.medsa_id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('external-clinic-uploads').upload(path, file)
      if (!upErr) documentPaths.push(path)
    }
    const { data: inserted, error: insErr } = await supabase.from('referrals').insert({
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
    }).select('id').maybeSingle()
    if (insErr) { setError(insErr.message); setStage('error'); return }
    setSubmittedReferralId(inserted.id)
    setStage('done')
  }

  // ── Doctor 2, gated path (doctor 1 was out-of-network) ──────────────────
  async function handleReceiveGateSubmit() {
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
        setReceiverVerificationMethod('clinic_otp')
        goToReceiveNextStage()
        return
      }
      if (result.id) {
        const chRes = await fetch('/api/cds/send_clinic_otp', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ verifiedClinicId: result.id, action: 'list_channels' }),
        })
        const chResult = await chRes.json()
        if (chResult.channels?.length > 0) { setOtpChannels(chResult.channels); setStage('receive_otp_channel_choice'); return }
      }
      setGateError('This practice matched a registry, but has no phone or email on file to confirm identity.')
    } catch (e) {
      setGateError('Could not reach the verification service - try again shortly.')
      setVerifying(false)
    }
  }

  async function handleReceiveOtpVerify() {
    setOtpVerifying(true)
    const res = await fetch('/api/cds/verify_clinic_otp', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ verifiedClinicId: verificationResult.id, code: otpCode }),
    })
    const result = await res.json()
    setOtpVerifyResult(result)
    setOtpVerifying(false)
    if (result.status === 'VERIFIED') { setReceiverVerificationMethod('clinic_otp'); goToReceiveNextStage() }
  }

  async function handleVouchedContinue() {
    if (!receiverName.trim()) return
    goToReceiveNextStage()
  }

  // Same scan step doctor 1 goes through - not skipped just because the
  // link already carries a patient_id. Confirms doctor 2 actually has the
  // patient in front of them (or the patient's own QR in hand), and
  // catches a stale/mistargeted link before anything gets uploaded.
  async function handleReceiveScan(qrData) {
    // Resolve by id, not by comparing the raw scanned text against
    // patient.medsa_id directly - patient here only ever carries
    // full_name (loadReferral's patients(full_name) join), and the
    // scanned text is now a URL wrapping a token, not a bare medsa_id.
    const scanned = await resolveScannedPatient(qrData, 'id')
    if (!scanned || scanned.id !== referral?.patient_id) {
      setError("That QR code doesn't match this referral's patient.")
      setStage('error')
      return
    }
    setStage('receive_form')
  }

  async function handleReceiveSubmit() {
    setStage('uploading')
    const documentPaths = []
    for (const file of receiverFiles) {
      const path = `referrals/${referral.patient_id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('external-clinic-uploads').upload(path, file)
      if (!upErr) documentPaths.push(path)
    }

    // Remember the receiving practitioner's contact for a real OTP check
    // later - not sent now, just kept on file with the same shape (and
    // 90-day re-verify window) as every other practitioner record. A
    // plain insert, not an upsert - there's no BR number to key on for
    // someone who's only ever been vouched-for, not BR-checked, and
    // exact dedup isn't essential for this pending bucket.
    let verifiedPractitionerId = null
    if (receiverRegNumber.trim() || receiverPhone.trim() || receiverEmail.trim()) {
      const { data: vp } = await supabase.from('verified_practitioners').insert({
        practitioner_name_declared: receiverName.trim() || form.referredToPractitionerName,
        registration_number: receiverRegNumber.trim() || null,
        phone: receiverPhone.trim() || null,
        email: receiverEmail.trim() || null,
        br_status: 'unchecked',
      }).select('id').maybeSingle()
      verifiedPractitionerId = vp?.id || null
    }

    const { error: insErr } = await supabase.from('referral_consultations').insert({
      referral_id: referral.id, patient_id: referral.patient_id,
      practitioner_name: receiverName.trim() || referral.referred_to_practitioner_name,
      verification_method: receiverVerificationMethod,
      verified_practitioner_id: verifiedPractitionerId,
      findings: treatmentLog.findings.trim() || null,
      interventions: treatmentLog.interventions.trim() || null,
      session_duration_minutes: treatmentLog.sessionDurationMinutes ? parseInt(treatmentLog.sessionDurationMinutes) : null,
      document_paths: documentPaths.length > 0 ? documentPaths : null,
    })
    if (insErr) { setError(insErr.message); setStage('error'); return }
    // Clearing referrer_viewed_at (even though it was already cleared by
    // 'accepted' never touching it) is what flips the referring doctor's
    // Sent-tab badge back to unread - that's the "results are in, go
    // check" notification they're waiting on.
    await supabase.from('referrals').update({ clinical_status: 'completed', referrer_viewed_at: null }).eq('id', referral.id)
    setStage('receive_done')
  }

  const shareLink = submittedReferralId && typeof window !== 'undefined' ? `${window.location.origin}/referral-portal?receive=${submittedReferralId}` : ''
  const mailtoLink = shareLink ? `mailto:?subject=${encodeURIComponent('Referral for '+patient?.full_name+' via Medsa')}&body=${encodeURIComponent(`I've referred ${patient?.full_name} to you. Open this link to see the referral and optionally add your own treatment notes:\n\n${shareLink}\n\n(This link is powered by Medsa, a health record platform - no account needed to view it.)`)}` : ''

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div style={{background:'#fff',borderRadius:'16px',padding:'28px',maxWidth:440,width:'100%'}}>

        {stage==='loading' && <div style={{textAlign:'center',fontSize:'13px',color:C.textMuted}}>Loading...</div>}

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

        {stage==='otp_channel_choice' && <OtpChannelChoice channels={otpChannels} sending={otpSending} onChoose={handleChooseChannel}/>}
        {stage==='otp_challenge' && <OtpChallenge otpState={otpState} otpCode={otpCode} setOtpCode={setOtpCode} verifyResult={otpVerifyResult} verifying={otpVerifying} onVerify={handleOtpVerify} onBack={()=>setStage('otp_channel_choice')}/>}

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
          <button onClick={handleReferralSubmit} disabled={!form.referredToPractitionerName.trim()||!form.reason.trim()}
            style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',opacity:(!form.referredToPractitionerName.trim()||!form.reason.trim())?0.6:1}}>
            Submit referral
          </button>
        </>}

        {stage==='uploading' && <div style={{textAlign:'center',fontSize:'13px',color:C.textMuted}}>Submitting...</div>}

        {stage==='done' && <>
          <div style={{fontSize:'32px',textAlign:'center',marginBottom:'10px'}}>✓</div>
          <div style={{fontSize:'15px',fontWeight:700,textAlign:'center',marginBottom:'6px'}}>Referral submitted</div>
          <div style={{fontSize:'13px',color:C.textSub,textAlign:'center',marginBottom:'18px'}}>Medsa will review this referral. Once approved, it's on file for {patient?.full_name}'s record.</div>
          <div style={{background:C.card,borderRadius:'10px',padding:'14px',marginBottom:'12px'}}>
            <div style={{fontSize:'12px',fontWeight:600,marginBottom:'6px'}}>Invite {form.referredToPractitionerName} to add their own consultation record</div>
            <div style={{fontSize:'11px',color:C.textSub,marginBottom:'10px'}}>Whether they use this link at all is up to them - but if they do, it's their real consultation record (findings, diagnosis, materials like x-rays), not just an extra step. Send them this link:</div>
            <div style={{fontSize:'11px',color:C.textMuted,wordBreak:'break-all',marginBottom:'10px',padding:'8px',background:'#fff',borderRadius:'6px'}}>{shareLink}</div>
            <a href={mailtoLink} style={{display:'block',textAlign:'center',padding:'10px',background:C.green,color:'#fff',borderRadius:'8px',fontSize:'12px',fontWeight:600,textDecoration:'none'}}>Email this link</a>
          </div>
        </>}

        {/* ── Doctor 2 (receiving practitioner) ─────────────────────────── */}
        {stage==='receive_gate' && <>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'6px'}}>Referral for {patient?.full_name}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>Referred by {referral?.referring_doctor_name || referral?.referring_practice_name} - {referral?.reason}. Since the referring practice isn't a Medsa login, we need the same real-registry check to confirm who you are before you can add anything here.</div>
          <input value={clinicName} onChange={e=>setClinicName(e.target.value)} placeholder="Your clinic / hospital name" style={inputStyle}/>
          <input value={clinicRegNumber} onChange={e=>setClinicRegNumber(e.target.value)} placeholder="ORPHF licence/exemption code (e.g. CE000001)" style={inputStyle}/>
          <input value={businessRegNumber} onChange={e=>setBusinessRegNumber(e.target.value)} placeholder="Business Registration Number (e.g. C1572528)" style={inputStyle}/>
          {gateError && <div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{gateError}</div>}
          <button onClick={handleReceiveGateSubmit} disabled={verifying} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:verifying?'default':'pointer',opacity:verifying?0.7:1}}>{verifying?'Verifying...':'Continue'}</button>
        </>}

        {stage==='receive_otp_channel_choice' && <OtpChannelChoice channels={otpChannels} sending={otpSending} onChoose={async (ch)=>{
          setOtpSending(true)
          const res = await fetch('/api/cds/send_clinic_otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ verifiedClinicId: verificationResult.id, action:'send', channel: ch }) })
          const result = await res.json(); setOtpState(result); setOtpSending(false)
          if (result.status==='SENT') setStage('receive_otp_challenge')
        }}/>}
        {stage==='receive_otp_challenge' && <OtpChallenge otpState={otpState} otpCode={otpCode} setOtpCode={setOtpCode} verifyResult={otpVerifyResult} verifying={otpVerifying} onVerify={handleReceiveOtpVerify} onBack={()=>setStage('receive_otp_channel_choice')}/>}

        {stage==='receive_vouched_code' && <>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'6px'}}>Referral for {patient?.full_name}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>Referred by {referral?.referring_doctor_name}, a verified Medsa doctor. No out-of-network check is needed here, but enter the access code from their referral email first, so we know you actually received it.</div>
          <input value={accessCode} onChange={e=>setAccessCode(e.target.value)} placeholder="Access code from the email" style={{...inputStyle,letterSpacing:'2px',textTransform:'uppercase'}}/>
          {accessCodeError && <div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{accessCodeError}</div>}
          <button onClick={handleVerifyAccessCode} disabled={accessCodeVerifying||!accessCode.trim()} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',opacity:accessCodeVerifying||!accessCode.trim()?0.6:1}}>{accessCodeVerifying?'Checking...':'Continue'}</button>
        </>}

        {stage==='receive_vouched' && <>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'6px'}}>Referral for {patient?.full_name}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>Referred by {referral?.referring_doctor_name}, a verified Medsa doctor - {referral?.reason}. Their referral vouches for you, so there's no verification step here - go ahead and log this consultation. If you'd like, leave a registration number and a way to reach you, purely for your own convenience next time (so you're not asked to verify again for 90 days) - entirely optional.</div>
          <input value={receiverName} onChange={e=>setReceiverName(e.target.value)} placeholder="Your full name" style={inputStyle}/>
          <input value={receiverRegNumber} onChange={e=>setReceiverRegNumber(e.target.value)} placeholder="Registration number (optional)" style={inputStyle}/>
          <input value={receiverPhone} onChange={e=>setReceiverPhone(e.target.value)} placeholder="Phone number (optional)" style={inputStyle}/>
          <input value={receiverEmail} onChange={e=>setReceiverEmail(e.target.value)} placeholder="Email (optional)" style={inputStyle}/>
          {((receiverPhone.trim()&&!receiverEmail.trim())||(receiverEmail.trim()&&!receiverPhone.trim()))&&
            <div style={{fontSize:'11px',color:C.amber,marginTop:'-4px',marginBottom:'10px'}}>{'◇'} Got a {receiverPhone.trim()?'email':'phone number'} too? Having both means we can reach you whichever way works when this is next needed.</div>}
          <button onClick={handleVouchedContinue} disabled={!receiverName.trim()} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',opacity:!receiverName.trim()?0.6:1}}>Continue</button>
          <div style={{fontSize:'10px',color:C.textMuted,marginTop:'10px',textAlign:'center'}}>Powered by Medsa - a health record platform for Hong Kong clinics.</div>
        </>}

        {stage==='receive_decision' && <>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'6px'}}>Referral for {patient?.full_name}</div>
          <div style={{background:C.card,borderRadius:'10px',padding:'14px',marginBottom:'16px'}}>
            <div style={{fontSize:'12px',marginBottom:'6px'}}><strong>From:</strong> {referral?.referring_doctor_name || referral?.referring_practice_name}</div>
            {referral?.reason && <div style={{fontSize:'12px',marginBottom:'6px'}}><strong>Reason:</strong> {referral.reason}</div>}
            {referral?.diagnosis && <div style={{fontSize:'12px'}}><strong>Diagnosis:</strong> {referral.diagnosis}</div>}
          </div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>This is just the review step - you're not expected to have the patient in front of you right now. Accepting means you'll schedule and see them later; the actual visit (scan + record results) happens separately when they come in.</div>
          {/* The vouched path (receive_vouched, above) already asked for
              this - re-asking would just repeat the same question right
              after answering it. Only the gate+OTP path reaches here
              without a name on file yet. */}
          {receiverName.trim()
            ? <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>Deciding as <strong>{receiverName.trim()}</strong></div>
            : <input value={receiverName} onChange={e=>setReceiverName(e.target.value)} placeholder="Your full name" style={inputStyle}/>}
          <button onClick={handleAcceptReferral} disabled={!receiverName.trim()||decisionActing} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',marginBottom:'8px',opacity:(!receiverName.trim()||decisionActing)?0.6:1}}>{decisionActing?'Saving...':'Accept referral'}</button>
          <button onClick={()=>setStage('receive_decline_reason')} disabled={decisionActing} style={{width:'100%',padding:'12px',background:'none',border:`0.5px solid ${C.border}`,borderRadius:'10px',fontWeight:600,cursor:'pointer',color:C.textSub}}>Decline</button>
        </>}

        {stage==='receive_accepted' && <>
          <div style={{fontSize:'32px',textAlign:'center',marginBottom:'10px'}}>✓</div>
          <div style={{fontSize:'15px',fontWeight:700,textAlign:'center',marginBottom:'6px'}}>Referral accepted</div>
          <div style={{fontSize:'13px',color:C.textSub,textAlign:'center',marginBottom:'16px'}}>Call {patient?.full_name} directly to confirm and schedule their visit - that's the fastest way to do both at once.</div>
          <div style={{background:C.card,borderRadius:'10px',padding:'14px',marginBottom:'16px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}>Contact for {patient?.full_name}</div>
            {patientContact?.phone && <div style={{fontSize:'14px',fontWeight:600,marginBottom:'2px'}}>{patientContact.phone}</div>}
            {patientContact?.email && <div style={{fontSize:'13px',color:C.textSub}}>{patientContact.email}</div>}
            {!patientContact?.phone && !patientContact?.email && <div style={{fontSize:'13px',color:C.textMuted}}>No phone or email on file for this patient.</div>}
          </div>
          <button onClick={()=>setStage('receive_scan')} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',marginBottom:'8px'}}>Patient is here now - check them in</button>
          <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center'}}>Otherwise, just come back to this same link once they're actually in for their visit.</div>
        </>}

        {stage==='receive_decline_reason' && <>
          <div style={{fontSize:'15px',fontWeight:700,marginBottom:'6px'}}>Decline this referral</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'14px'}}>{referral?.referring_doctor_name || referral?.referring_practice_name} will see this reason.</div>
          <textarea value={declineReason} onChange={e=>setDeclineReason(e.target.value)} rows={3} placeholder="Reason for declining" style={{...inputStyle,resize:'none',fontFamily:'inherit'}}/>
          <button onClick={handleDeclineReferralSubmit} disabled={!declineReason.trim()||decisionActing} style={{width:'100%',padding:'12px',background:C.red,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',marginBottom:'8px',opacity:(!declineReason.trim()||decisionActing)?0.6:1}}>{decisionActing?'Saving...':'Confirm decline'}</button>
          <button onClick={()=>setStage('receive_decision')} disabled={decisionActing} style={{width:'100%',padding:'10px',background:'none',border:'none',color:C.textSub,fontSize:'12px',cursor:'pointer'}}>Back</button>
        </>}

        {stage==='receive_declined' && <>
          <div style={{fontSize:'15px',fontWeight:700,textAlign:'center',marginBottom:'6px'}}>Referral declined</div>
          <div style={{fontSize:'13px',color:C.textSub,textAlign:'center'}}>You've declined this referral for {patient?.full_name}. The referring doctor has been notified.</div>
        </>}

        {stage==='receive_already_completed' && <>
          <div style={{fontSize:'32px',textAlign:'center',marginBottom:'10px'}}>✓</div>
          <div style={{fontSize:'15px',fontWeight:700,textAlign:'center',marginBottom:'6px'}}>Already completed</div>
          <div style={{fontSize:'13px',color:C.textSub,textAlign:'center'}}>Results for this referral have already been submitted for {patient?.full_name}.</div>
        </>}

        {stage==='receive_scan' && <>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'12px'}}>Scan the patient's Medsa QR code - same step doctor 1 went through, confirms this is really their file.</div>
          <QrScanner onScan={handleReceiveScan} onCancel={()=>{}}/>
        </>}

        {stage==='receive_form' && <>
          <div style={{fontSize:'15px',fontWeight:700,marginBottom:'4px'}}>Your consultation for {patient?.full_name}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>Coming here at all is optional - nobody can require an outside doctor to use this portal. But if you do, this is your real consultation record, not an extra step: findings, diagnosis, what was done, and any materials like x-rays or lab results, the same as if you were entering it directly into Medsa.</div>
          <textarea value={treatmentLog.findings} onChange={e=>setTreatmentLog(t=>({...t,findings:e.target.value}))} rows={2} placeholder="Findings / diagnosis" style={{...inputStyle,resize:'none',fontFamily:'inherit'}}/>
          <textarea value={treatmentLog.interventions} onChange={e=>setTreatmentLog(t=>({...t,interventions:e.target.value}))} rows={2} placeholder="Interventions / treatment performed" style={{...inputStyle,resize:'none',fontFamily:'inherit'}}/>
          <input type="number" value={treatmentLog.sessionDurationMinutes} onChange={e=>setTreatmentLog(t=>({...t,sessionDurationMinutes:e.target.value}))} placeholder="Session duration (minutes)" style={inputStyle}/>
          <div style={{fontSize:'12px',fontWeight:600,marginBottom:'8px',marginTop:'6px'}}>Referral letter, x-rays, lab results, or any other materials</div>
          <input type="file" multiple onChange={e=>setReceiverFiles([...e.target.files])} style={{marginBottom:'16px',fontSize:'12px'}}/>
          <button onClick={handleReceiveSubmit} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer'}}>Submit</button>
        </>}

        {stage==='receive_done' && <>
          <div style={{fontSize:'32px',textAlign:'center',marginBottom:'10px'}}>✓</div>
          <div style={{fontSize:'15px',fontWeight:700,textAlign:'center',marginBottom:'6px'}}>Submitted</div>
          <div style={{fontSize:'13px',color:C.textSub,textAlign:'center'}}>Your treatment log is on file against this referral for {patient?.full_name}.</div>
        </>}

        {stage==='error' && <div style={{textAlign:'center',fontSize:'13px',color:C.red}}>{error}</div>}
      </div>
    </div>
  )
}

function OtpChannelChoice({ channels, sending, onChoose }) {
  return (
    <>
      <div style={{fontSize:'15px',fontWeight:700,marginBottom:'6px'}}>Confirm you're from this practice</div>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>Choose how to receive a code - sent only to the contact the government registry has on file, not anything typed above.</div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {channels.includes('call')&&<button onClick={()=>onChoose('call')} disabled={sending} style={{width:'100%',padding:'14px',background:C.card,border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',textAlign:'left'}}>Phone call</button>}
        {channels.includes('text')&&<button onClick={()=>onChoose('text')} disabled={sending} style={{width:'100%',padding:'14px',background:C.card,border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',textAlign:'left'}}>Text message</button>}
        {channels.includes('email')&&<button onClick={()=>onChoose('email')} disabled={sending} style={{width:'100%',padding:'14px',background:C.card,border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',textAlign:'left'}}>Email</button>}
      </div>
      {sending&&<div style={{fontSize:'12px',color:C.textMuted,marginTop:'10px',textAlign:'center'}}>Sending...</div>}
    </>
  )
}

function OtpChallenge({ otpState, otpCode, setOtpCode, verifyResult, verifying, onVerify, onBack }) {
  return (
    <>
      <div style={{fontSize:'15px',fontWeight:700,marginBottom:'6px'}}>Enter the code</div>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'14px'}}>Sent via {otpState?.channel} to {otpState?.target} - the registry's own contact for this practice.</div>
      {otpState?.devOnlyCode&&<div style={{background:'#fff3e0',borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:'#e65100'}}>{'◇'} No live SMS/voice/email provider connected yet - shown here for now: <strong>{otpState.devOnlyCode}</strong></div>}
      <input value={otpCode} onChange={e=>setOtpCode(e.target.value)} placeholder="6-digit code" style={{...inputStyle,letterSpacing:'2px'}}/>
      {verifyResult?.status==='INCORRECT'&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>That code doesn't match.</div>}
      {verifyResult?.status==='EXPIRED'&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>That code expired - request a new one.</div>}
      <button onClick={onVerify} disabled={verifying||otpCode.length<6} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',marginBottom:'8px',opacity:verifying||otpCode.length<6?0.6:1}}>{verifying?'Checking...':'Confirm'}</button>
      <button onClick={onBack} style={{width:'100%',padding:'10px',background:'none',border:'none',color:C.textSub,fontSize:'12px',cursor:'pointer'}}>Try a different channel</button>
    </>
  )
}

const inputStyle = {width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'10px'}
