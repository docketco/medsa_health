import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { STAFF_CREDENTIALS_SAFE_COLUMNS } from '../../lib/staffCredentialsColumns'
import { getInsuranceAdapter, calculatePlatformClaimFee, calculatePaymentProcessingFee, findEligiblePlans, buildFeeBreakdown } from '../../lib/insuranceAdapter'
import { fetchAndDownloadConsultationReceipt, fetchAndDownloadTreatmentPlanReceipt } from '../../lib/receiptPdf'
import C from '../shared/colours'
import Icon from '../shared/Icon'

// Doctors, nurses, and the 5 Core Statutory Board allied health
// professions (Allied Health Professions Ordinance) get a real,
// government-issued e-PC with a secured e-signature and encrypted QR -
// that's what epc_link/hkid actually verify against. Everyone else here
// (Accredited Register Scheme professions) has no such government cert -
// their credential is a live status on their own society's voluntary
// register instead, so they use registering_body + registration_number +
// an uploaded document rather than an e-PC link.
const EPC_TRACK_ROLES = ['doctor', 'physiotherapist', 'occupational_therapist', 'optometrist', 'radiographer', 'medical_lab_technologist']
const ACCREDITED_REGISTER_ROLES = ['speech_therapist', 'dietitian', 'clinical_psychologist']

const ROLE_LABELS = {
  doctor: 'Doctor', clinic_assistant: 'Clinic Assistant', admin: 'Practice Manager',
  physiotherapist: 'Physiotherapist', occupational_therapist: 'Occupational Therapist',
  optometrist: 'Optometrist', radiographer: 'Radiographer', medical_lab_technologist: 'Medical Laboratory Technologist',
  speech_therapist: 'Speech Therapist', dietitian: 'Dietitian', clinical_psychologist: 'Clinical Psychologist',
}
const ROLE_COLORS = {
  doctor: C.green, clinic_assistant: C.blue, admin: C.purple,
  physiotherapist: C.green, occupational_therapist: C.green, optometrist: C.green,
  radiographer: C.green, medical_lab_technologist: C.green,
  speech_therapist: C.navy, dietitian: C.navy, clinical_psychologist: C.navy,
}

function Btn({ children, onClick, variant='secondary', style:sx={}, disabled }) {
  const base={border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontWeight:500,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:disabled?0.5:1,...sx}
  const V={primary:{background:C.green,color:'#fff'},secondary:{background:C.card,color:C.text,border:`0.5px solid ${C.border}`},danger:{background:C.red,color:'#fff'},amber:{background:C.amber,color:'#fff'}}
  return <button style={{...base,...V[variant]}} onClick={onClick} disabled={disabled}>{children}</button>
}
function Card({ children, style:sx={}, onClick }) {
  return <div onClick={onClick} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',overflow:'hidden',cursor:onClick?'pointer':'default',...sx}}>{children}</div>
}
// No card/Octopus terminal is actually integrated yet - this just lets
// staff record the reference/approval number their real standalone
// terminal already prints, for their own reconciliation. Optional,
// never shown for cash (which has no such number).
function TxnRefField({ method, value, onChange }) {
  if (method === 'cash') return null
  return (
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={`${method==='octopus'?'Octopus':'Card'} terminal reference # (optional)`} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box'}}/>
  )
}
function SecLabel({ children }) {
  return <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.9px',color:C.textMuted,marginBottom:'10px'}}>{children}</div>
}
function StatCard({ label, value, sub, color=C.green, bg=C.greenLight }) {
  return (
    <div style={{flex:1,background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'16px'}}>
      <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px',fontWeight:600,textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:'26px',fontWeight:700,color}}>{value}</div>
      {sub&&<div style={{fontSize:'12px',color:C.textSub,marginTop:'2px'}}>{sub}</div>}
    </div>
  )
}
function Toggle({ checked=false, onChange }) {
  return (
    <div onClick={()=>onChange(!checked)} style={{width:34,height:18,borderRadius:20,background:checked?C.green:C.border,position:'relative',flexShrink:0,cursor:'pointer'}}>
      <div style={{position:'absolute',top:2,left:checked?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
    </div>
  )
}

function Badge({ text, type }) {
  const map={ok:[C.greenLight,C.green],due:[C.amberLight,C.amber],full:[C.redLight,C.red],waiting:[C.blueLight,C.blue],muted:[C.card,C.textSub]}
  const [bg,fg]=map[type]||map.ok
  return <span style={{fontSize:'11px',background:bg,color:fg,padding:'4px 10px',borderRadius:'20px',fontWeight:500,whiteSpace:'nowrap'}}>{text}</span>
}
function PageWrap({ children, maxWidth=720 }) {
  return <div style={{maxWidth, margin:'0 auto', width:'100%'}}>{children}</div>
}
function InfoRow({ label, value, last }) {
  return (
    <div style={{padding:'11px 0',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:last?'none':`0.5px solid ${C.border}`,fontSize:'13px'}}>
      <span style={{color:C.textSub}}>{label}</span>
      <span style={{fontWeight:500}}>{value}</span>
    </div>
  )
}

// Shared doctor directory - single source of truth for name + department,
// used both at staff login and when filtering/switching doctors elsewhere,
// Real doctors, queried fresh wherever needed - replaces the old hardcoded
// DOCTOR_DIRECTORY array, which never reflected who was actually onboarded
// and kept showing two stale demo names indefinitely.
async function loadClinicDoctors() {
  const { data } = await supabase.from('staff_credentials').select('full_name,department')
    .eq('institution_source','clinic_ops').eq('role','doctor').eq('status','active').order('full_name')
  return (data||[]).map(d => ({ name: d.full_name, department: d.department }))
}

// Queues should follow the doctors/departments a clinic actually has by
// default, without a practice manager first having to manually create a
// same-named queue for each one - this creates any department's queue
// that's still missing, the first time it's needed. A practice manager's
// own manually-added extra queues (no department) are untouched and
// still coexist for front desk to pick from.
async function ensureDepartmentQueues(institutionId) {
  if (!institutionId) return
  const doctors = await loadClinicDoctors()
  const departments = [...new Set(doctors.map(d=>d.department).filter(Boolean))]
  if (departments.length === 0) return
  const { data: existing } = await supabase.from('clinic_queues').select('department,ticket_prefix').eq('institution_id', institutionId)
  const existingDepartments = new Set((existing||[]).map(q=>q.department).filter(Boolean))
  const usedPrefixes = new Set((existing||[]).map(q=>q.ticket_prefix))
  const missing = departments.filter(d => !existingDepartments.has(d))
  if (missing.length === 0) return
  const rows = missing.map(dept => {
    const letter = (dept.match(/[A-Za-z]/)||['Q'])[0].toUpperCase()
    let candidate = letter
    let n = 1
    while (usedPrefixes.has(candidate)) { candidate = letter + n; n++ }
    usedPrefixes.add(candidate)
    return { institution_id: institutionId, name: dept, ticket_prefix: candidate.slice(0,2), department: dept, active: true }
  })
  await supabase.from('clinic_queues').insert(rows)
}

// Cancelling an appointment used to leave any queue ticket tied to it
// completely untouched - if the patient had already checked in, they'd
// keep showing as waiting/being seen on both the front desk board and
// their own "X people ahead of you" banner in the app, indefinitely.
// Also sends the patient the same cancellation email/SMS a patient-
// initiated cancel already gets, so the notification exists in both
// directions.
async function cancelAppointmentSideEffects(appointmentId) {
  if (!appointmentId) return
  await supabase.from('clinic_queue').update({ status: 'no_show' })
    .eq('appointment_id', appointmentId).in('status', ['waiting','serving'])

  const { data: appt } = await supabase.from('appointments').select('doctor_name, scheduled_at, patients(email, full_name, notify_email, phone, notify_sms)').eq('id', appointmentId).maybeSingle()
  const patient = appt?.patients
  const wantsEmail = patient?.notify_email !== false && patient?.email
  const wantsSms = patient?.notify_sms !== false && patient?.phone
  if (wantsEmail || wantsSms) {
    fetch('/api/appointments/notify_cancellation', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        email: wantsEmail ? patient.email : null,
        phone: wantsSms ? patient.phone : null,
        patientName: patient.full_name,
        doctorName: appt.doctor_name, scheduledAt: appt.scheduled_at,
      }),
    }).catch(()=>{})
  }
}

// Builds the actual, plain-language Frequency text from the structured
// dosing controls (mode, times/day, which times of day, every-X-hours,
// duration) - this is what shows up on the medication label, the
// receipt, and the patient's own medication list.
function describeFrequency(rx) {
  const mode = rx.dosingMode || 'fixed'
  const days = parseInt(rx.durationDays) || 0
  const durationText = days>0 ? ` for ${days} day${days===1?'':'s'}` : ''
  if (mode === 'interval') {
    const hours = parseInt(rx.intervalHours) || 0
    return hours>0 ? `Every ${hours} hours${durationText}` : ''
  }
  if (mode === 'prn') return rx.frequency || ''
  const times = parseInt(rx.timesPerDay) || 0
  if (!times) return ''
  const timesText = times===1 ? 'Once daily' : times===2 ? 'Twice daily' : `${times} times daily`
  const timeOfDay = (rx.timesOfDay||[]).length>0 ? ` (${rx.timesOfDay.join(', ')})` : ''
  return `${timesText}${timeOfDay}${durationText}`
}

function hoursRemaining(checkedInAt) {
  const elapsed = Date.now() - checkedInAt
  const remaining = 24*60*60*1000 - elapsed
  return Math.max(0, remaining / (60*60*1000))
}

// A patient who checked in on time or early for a booked appointment
// should queue near their appointment time, not get pushed behind
// walk-ins who simply arrived earlier in the day. Someone who checks in
// late for their appointment has already lost that slot, so they queue
// by when they actually arrived, same as a walk-in.
function queuePosition(q) {
  if (q.appointmentTime && q.checkedInAt <= q.appointmentTime) return q.appointmentTime
  return q.checkedInAt
}

// Module-level, not scoped to any one component - moved here after
// discovering it was previously local to InventoryScreen only, making it
// inaccessible to the new bulk staff import (a different component)
// that also needs real CSV parsing.
function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h=>h.trim())
  return lines.slice(1).filter(l=>l.trim()).map(line=>{
    const values = (line.match(/(".*?"|[^",]+)(?=,|$)/g)||[]).map(v=>v.trim().replace(/^"|"$/g,''))
    const row = {}
    headers.forEach((h,i)=>row[h]=values[i]||'')
    return row
  })
}

// A random one-time temp password meeting the same rules handleOnboard
// enforces (8+ chars, a number, a capital, a special character) - used
// wherever an account is created without the person present to set
// their own password, so no two accounts (and no deployed source file)
// ever carry the same guessable default.
function generateTempPassword() {
  const words = ['Coral','Willow','Amber','Cedar','Harbor','Lotus','Maple','Ridge','Delta','Ember']
  const word = words[Math.floor(Math.random()*words.length)]
  const digits = Math.floor(1000 + Math.random()*9000)
  const symbols = ['!','#','$','%','*']
  const symbol = symbols[Math.floor(Math.random()*symbols.length)]
  return `${word}${digits}${symbol}`
}

function StaffLogin({ onLogin, kickedOutMessage }) {
  const [staff,setStaff]=useState([])
  const [loading,setLoading]=useState(true)
  const [pin,setPin]=useState('')
  const [pinError,setPinError]=useState(false)
  const [checkingPin,setCheckingPin]=useState(false)
  const [selected,setSelected]=useState(null)
  const [stage,setStage]=useState('pick') // pick | pin | device_otp | forgot | forgot_otp
  const [forgotSending,setForgotSending]=useState(false)
  const [forgotError,setForgotError]=useState(null)
  const [forgotMaskedEmail,setForgotMaskedEmail]=useState(null)
  const [forgotDevCode,setForgotDevCode]=useState(null)
  const [otpCode,setOtpCode]=useState('')
  const [newPassword,setNewPassword]=useState('')
  const [resetting,setResetting]=useState(false)
  const [resetDone,setResetDone]=useState(false)

  async function handleForgotPassword() {
    setForgotSending(true)
    setForgotError(null)
    const res = await fetch('/api/staff/send_password_reset_otp', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ medsaId: selected.id }),
    })
    const data = await res.json()
    setForgotSending(false)
    if (data.status === 'NO_EMAIL_ON_FILE') { setForgotError(data.message); return }
    if (data.status !== 'SENT') { setForgotError(data.message || 'Could not send a reset code.'); return }
    setForgotMaskedEmail(data.email)
    setForgotDevCode(data.devOnlyCode) // no live email provider yet - see API route
    setStage('forgot_otp')
  }

  async function handleResetPassword() {
    setResetting(true)
    setForgotError(null)
    const res = await fetch('/api/staff/reset_password', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ medsaId: selected.id, code: otpCode, newPassword }),
    })
    const data = await res.json()
    setResetting(false)
    if (data.status !== 'OK') { setForgotError(data.message || 'Could not reset password.'); return }
    setResetDone(true)
  }


  useEffect(() => {
    async function load() {
      setLoading(true)
      // Real query against the same shared staff_credentials table
      // PractitionerApp uses - clinic_staff was retired before ever going
      // live, so a clinic doctor's identity is portable if they ever also
      // work at a Medsa-partnered hospital later.
      const { data } = await supabase.from('staff_credentials').select('medsa_id,full_name,role,department,is_nurse,institution_id,practitioner_portal_enabled,practitioner_identity_id,registration_number,registration_expiry,epc_link,registering_body,email')
  .eq('institution_source','clinic_ops').eq('status','active').order('full_name')
const mapped = (data||[]).map(s => ({
  id: s.medsa_id, name: s.full_name, role: s.role,
  roleLabel: ROLE_LABELS[s.role]||s.role, color: ROLE_COLORS[s.role]||C.textMuted,
  department: s.department, isNurse: !!s.is_nurse, institutionId: s.institution_id,
  practitionerPortalEnabled: s.practitioner_portal_enabled, practitionerIdentityId: s.practitioner_identity_id,
  registrationNumber: s.registration_number, registrationExpiry: s.registration_expiry, hasEpc: !!s.epc_link,
  registeringBody: s.registering_body, email: s.email,
}))
      setStaff(mapped)
      setLoading(false)
    }
    load()
  }, [])

  // A random id this browser keeps in localStorage so the app can tell
  // "have I seen this device before for this account" apart from
  // whether the password was right - not a secret, not a security
  // boundary by itself, just a marker. If localStorage isn't available
  // (private browsing etc.) this returns null and the device check is
  // skipped entirely rather than blocking login.
  function getOrCreateDeviceId() {
    try {
      let id = localStorage.getItem('medsa_clinicops_device_id')
      if (!id) {
        id = (typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
        localStorage.setItem('medsa_clinicops_device_id', id)
      }
      return id
    } catch { return null }
  }

  const [deviceOtpCode,setDeviceOtpCode]=useState('')
  const [deviceOtpSending,setDeviceOtpSending]=useState(false)
  const [deviceOtpVerifying,setDeviceOtpVerifying]=useState(false)
  const [deviceOtpError,setDeviceOtpError]=useState(null)
  const [deviceMaskedEmail,setDeviceMaskedEmail]=useState(null)
  const [deviceDevCode,setDeviceDevCode]=useState(null)
  const [deviceNoEmailMessage,setDeviceNoEmailMessage]=useState(null)

  // Finishes what used to be the whole of handlePinConfirm - split out
  // so a new, unrecognized device can run the OTP challenge in between
  // "password was right" and "actually let them in."
  function finishLogin() {
    const deviceLabel = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0,160) : null
    // Single device at a time - this login's session token overwrites
    // whatever was there before, which is what the previously-signed-in
    // device's polling loop (see ClinicOpsApp) notices to sign itself
    // out. Best-effort: if this write fails (e.g. migration not run
    // yet), login still proceeds - it just won't enforce single-device
    // until the table exists.
    const sessionToken = (typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
    supabase.from('staff_sessions').upsert({
      medsa_id: selected.id, session_token: sessionToken, device_label: deviceLabel, created_at: new Date().toISOString(),
    }, { onConflict: 'medsa_id' }).then(({ error: sessionErr }) => {
      const withSession = { ...selected, sessionToken: sessionErr ? null : sessionToken }
      // Doctors and nurses are clinically tied to the speciality they were
      // onboarded under (set once by the practice manager in Staff) - that's
      // fixed, not something to pick again at every login. A practice
      // manager oversees the whole clinic, and general front desk (a
      // clinic_assistant who isn't a nurse) handles check-ins for every
      // doctor regardless of speciality, so both go straight in unscoped.
      const isGeneralFrontDesk = selected.role==='clinic_assistant' && !selected.isNurse
      if (selected.role==='admin' || isGeneralFrontDesk) {
        onLogin({ ...withSession, department: 'All departments' })
      } else {
        onLogin(withSession)
      }
    })
  }

  async function handleSendDeviceOtp() {
    setDeviceOtpSending(true)
    setDeviceOtpError(null)
    const res = await fetch('/api/staff/send_device_otp', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ medsaId: selected.id }),
    })
    const data = await res.json()
    setDeviceOtpSending(false)
    // Returns the raw status too, so handlePinConfirm can decide which
    // screen to show BEFORE committing to the "enter your code" stage -
    // an account with no email never actually had a code sent to it.
    if (data.status === 'NO_EMAIL_ON_FILE') { setDeviceNoEmailMessage(data.message); return data }
    if (data.status !== 'SENT') { setDeviceOtpError(data.message || 'Could not send a verification code.'); return data }
    setDeviceMaskedEmail(data.email)
    setDeviceDevCode(data.devOnlyCode) // no live email provider yet - see API route
    return data
  }

  async function handleVerifyDeviceOtp() {
    setDeviceOtpVerifying(true)
    setDeviceOtpError(null)
    const deviceId = getOrCreateDeviceId()
    const deviceLabel = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0,160) : null
    const res = await fetch('/api/staff/verify_device_otp', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ medsaId: selected.id, code: deviceOtpCode, deviceId, deviceLabel }),
    })
    const data = await res.json()
    setDeviceOtpVerifying(false)
    if (data.status !== 'OK') { setDeviceOtpError(data.message || 'Could not verify this device.'); return }
    finishLogin()
  }

  async function handlePinConfirm() {
    setCheckingPin(true)
    // Real verification against a hashed password, server-side inside
    // Postgres - the actual password value is never stored in the
    // database at all, only its one-way hash, and this function only
    // ever returns true/false, never the hash itself.
    const { data: ok } = await supabase.rpc('verify_staff_password', { p_medsa_id: selected.id, p_password: pin })
    const deviceLabel = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0,160) : null
    // Login audit log - both outcomes, for breach investigation. Never
    // awaited into the pass/fail decision itself and errors are ignored
    // (e.g. the table not existing yet) - a logging failure must never
    // be the reason someone can't sign in.
    supabase.from('staff_login_log').insert({
      medsa_id: selected.id, full_name: selected.name, role: selected.role,
      event: ok ? 'login_success' : 'login_failed', device_label: deviceLabel,
    }).then(()=>{}).catch(()=>{})
    if (!ok) { setCheckingPin(false); setPinError(true); return }
    setPinError(false)

    // New-device check - fails OPEN: if the table doesn't exist yet, or
    // localStorage isn't available, this device is treated as trusted
    // and login proceeds normally rather than getting stuck on a
    // challenge that can't be completed. checkingPin deliberately stays
    // true (keeping Sign In disabled) all the way through this and the
    // OTP send below - it used to reset right after the password check,
    // so a second click while this was still running fired a second
    // send_device_otp, silently overwriting the code already shown with
    // a new one and invalidating whatever the first click's code was.
    const deviceId = getOrCreateDeviceId()
    if (deviceId) {
      const { data: trustRow, error: trustErr } = await supabase.from('staff_device_trust')
        .select('id').eq('medsa_id', selected.id).eq('device_id', deviceId).maybeSingle()
      if (!trustErr && !trustRow) {
        // Check whether this account even has an email on file BEFORE
        // committing to the "enter your code" screen - previously both
        // happened together, so an account with no email still saw a
        // code input box with nothing actually sent, and the real
        // NO_EMAIL_ON_FILE error was tucked underneath it instead of
        // being the whole story.
        const sent = await handleSendDeviceOtp()
        setCheckingPin(false)
        setStage(sent?.status === 'NO_EMAIL_ON_FILE' ? 'device_no_email' : 'device_otp')
        return
      }
    }
    setCheckingPin(false)
    finishLogin()
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:420}}>
        {kickedOutMessage&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>{'⚠'} {kickedOutMessage}</div>}
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{fontSize:'22px',fontWeight:700,color:C.text}}>Medsa Clinic</div>
          <div style={{fontSize:'13px',color:C.textSub,marginTop:'4px'}}>
            {stage==='pick'&&'Select your account to sign in'}
            {stage==='pin'&&'Enter your PIN'}
            {stage==='device_otp'&&'Verify this device'}
            {(stage==='forgot'||stage==='forgot_otp')&&'Reset your password'}
          </div>
        </div>
        {loading&&<div style={{textAlign:'center',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
        {!loading&&stage==='pick'&&(
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {staff.length===0&&<div style={{textAlign:'center',color:C.textMuted,fontSize:'13px',padding:'20px'}}>No staff onboarded yet — ask your Practice Manager to add you.</div>}
            {staff.map(s=>(
              <div key={s.id} onClick={()=>{setSelected(s);setStage('pin')}} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer'}}>
                <div style={{width:38,height:38,borderRadius:'10px',background:s.color+'22',color:s.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'14px',flexShrink:0}}>{s.name[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'14px',fontWeight:600}}>{s.name}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{s.roleLabel}</div>
                </div>
                <span style={{color:C.textMuted}}>{'\u203a'}</span>
              </div>
            ))}
          </div>
        )}
        {stage==='pin'&&(
          <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'24px'}}>
            <div style={{textAlign:'center',marginBottom:'18px'}}>
              <div style={{width:52,height:52,borderRadius:'12px',background:selected.color+'22',color:selected.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'18px',margin:'0 auto 10px'}}>{selected.name[0]}</div>
              <div style={{fontSize:'15px',fontWeight:600}}>{selected.name}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{selected.roleLabel}</div>
            </div>
            <input type="password" value={pin} onChange={e=>{setPin(e.target.value);setPinError(false)}} placeholder="Password"
              onKeyDown={e=>e.key==='Enter'&&!checkingPin&&pin&&handlePinConfirm()}
              style={{width:'100%',border:`0.5px solid ${pinError?C.red:C.border}`,borderRadius:'10px',padding:'12px',fontSize:'16px',textAlign:'center',marginBottom:pinError?'6px':'14px',boxSizing:'border-box'}}/>
            {pinError&&<div style={{fontSize:'12px',color:C.red,textAlign:'center',marginBottom:'14px'}}>Incorrect password</div>}
            <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
              <Btn style={{flex:1}} onClick={()=>{setSelected(null);setPin('');setPinError(false);setStage('pick')}}>Back</Btn>
              <Btn variant="primary" style={{flex:1}} onClick={handlePinConfirm} disabled={checkingPin||!pin}>{checkingPin?'Checking...':'Sign in'}</Btn>
            </div>
            <div onClick={()=>{setForgotError(null);setStage('forgot')}} style={{fontSize:'12px',color:C.green,textAlign:'center',cursor:'pointer'}}>Forgot password?</div>
          </div>
        )}
        {stage==='device_otp'&&(
          <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'24px'}}>
            <div style={{fontSize:'14px',fontWeight:600,marginBottom:'6px',textAlign:'center'}}>New device for {selected.name}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'18px',textAlign:'center',lineHeight:1.5}}>{deviceMaskedEmail?`We sent a code to ${deviceMaskedEmail}.`:'Sending a verification code…'}</div>
            {deviceDevCode&&<div style={{fontSize:'11px',color:C.amber,textAlign:'center',marginBottom:'14px',lineHeight:1.5}}>◇ No live email provider is connected yet, so here's the code directly: <strong>{deviceDevCode}</strong></div>}
            <input value={deviceOtpCode} onChange={e=>setDeviceOtpCode(e.target.value)} placeholder="6-digit code"
              onKeyDown={e=>e.key==='Enter'&&!deviceOtpVerifying&&deviceOtpCode&&handleVerifyDeviceOtp()}
              style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px',fontSize:'16px',textAlign:'center',marginBottom:'14px',boxSizing:'border-box'}}/>
            {deviceOtpError&&<div style={{fontSize:'12px',color:C.red,textAlign:'center',marginBottom:'14px'}}>{deviceOtpError}</div>}
            <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
              <Btn style={{flex:1}} onClick={()=>{setStage('pin');setDeviceOtpCode('');setDeviceOtpError(null);setDeviceMaskedEmail(null);setDeviceDevCode(null)}}>Back</Btn>
              <Btn variant="primary" style={{flex:1}} onClick={handleVerifyDeviceOtp} disabled={deviceOtpVerifying||!deviceOtpCode}>{deviceOtpVerifying?'Verifying...':'Verify'}</Btn>
            </div>
            <div onClick={handleSendDeviceOtp} style={{fontSize:'12px',color:C.green,textAlign:'center',cursor:'pointer'}}>{deviceOtpSending?'Sending…':'Resend code'}</div>
          </div>
        )}
        {stage==='device_no_email'&&(
          <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'24px'}}>
            <div style={{fontSize:'14px',fontWeight:600,marginBottom:'6px',textAlign:'center'}}>New device for {selected.name}</div>
            <div style={{fontSize:'12px',color:C.amber,textAlign:'center',marginBottom:'18px',lineHeight:1.5}}>{'⚠'} {deviceNoEmailMessage}</div>
            <Btn style={{width:'100%'}} onClick={()=>{setStage('pin');setDeviceNoEmailMessage(null)}}>Back</Btn>
          </div>
        )}
        {stage==='forgot'&&(
          <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'24px'}}>
            <div style={{fontSize:'14px',fontWeight:600,marginBottom:'6px',textAlign:'center'}}>Reset {selected.name}'s password</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'18px',textAlign:'center',lineHeight:1.5}}>We'll send a one-time code to the email on file for this account.</div>
            {forgotError&&<div style={{fontSize:'12px',color:C.red,textAlign:'center',marginBottom:'14px'}}>{forgotError}</div>}
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1}} onClick={()=>{setStage('pin');setForgotError(null)}}>Back</Btn>
              <Btn variant="primary" style={{flex:1}} onClick={handleForgotPassword} disabled={forgotSending}>{forgotSending?'Sending…':'Send code'}</Btn>
            </div>
          </div>
        )}
        {stage==='forgot_otp'&&(
          <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'24px'}}>
            {!resetDone?<>
              <div style={{fontSize:'14px',fontWeight:600,marginBottom:'6px',textAlign:'center'}}>Enter the code sent to {forgotMaskedEmail}</div>
              {forgotDevCode&&<div style={{fontSize:'11px',color:C.amber,textAlign:'center',marginBottom:'14px',lineHeight:1.5}}>◇ No live email provider is connected yet, so here's the code directly: <strong>{forgotDevCode}</strong></div>}
              <input value={otpCode} onChange={e=>setOtpCode(e.target.value)} placeholder="6-digit code" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px',fontSize:'16px',textAlign:'center',marginBottom:'10px',boxSizing:'border-box'}}/>
              <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password (8+ chars, 1 number, 1 capital, 1 special)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px',fontSize:'14px',textAlign:'center',marginBottom:'14px',boxSizing:'border-box'}}/>
              {forgotError&&<div style={{fontSize:'12px',color:C.red,textAlign:'center',marginBottom:'14px'}}>{forgotError}</div>}
              <div style={{display:'flex',gap:'8px'}}>
                <Btn style={{flex:1}} onClick={()=>{setStage('pin');setOtpCode('');setNewPassword('');setForgotError(null)}}>Cancel</Btn>
                <Btn variant="primary" style={{flex:1}} onClick={handleResetPassword} disabled={resetting||!otpCode||!newPassword}>{resetting?'Resetting…':'Reset password'}</Btn>
              </div>
            </>:<>
              <div style={{fontSize:'14px',fontWeight:600,marginBottom:'8px',textAlign:'center',color:C.green}}>✓ Password reset</div>
              <div style={{fontSize:'12px',color:C.textSub,marginBottom:'18px',textAlign:'center'}}>Sign in with your new password.</div>
              <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setStage('pin');setOtpCode('');setNewPassword('');setPin('');setResetDone(false)}}>Continue</Btn>
            </>}
          </div>
        )}
      </div>
    </div>
  )
}

function Sidebar({ screen, setScreen, staffMember, onLogout, navItems }) {
  return (
    <div style={{width:220,flexShrink:0,background:C.cream,borderRight:`0.5px solid ${C.border}`,display:'flex',flexDirection:'column',height:'100vh',position:'sticky',top:0}}>
      <div style={{padding:'20px 18px',borderBottom:`0.5px solid ${C.border}`}}>
        <div style={{fontSize:'16px',fontWeight:700}}>Medsa Clinic</div>
        <div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>Operations</div>
      </div>
      <div style={{flex:1,padding:'12px 10px',overflowY:'auto'}}>
        {navItems.map(item=>(
          <div key={item.key} onClick={()=>setScreen(item.key)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',borderRadius:'8px',cursor:'pointer',marginBottom:'2px',background:screen===item.key?C.green:'transparent',color:screen===item.key?'#fff':C.text,position:'relative'}}>
            <Icon name={item.icon} size={17}/>
            <span style={{fontSize:'13px',fontWeight:500,flex:1}}>{item.label}</span>
            {item.badge>0&&<span style={{background:screen===item.key?'#fff':C.red,color:screen===item.key?C.green:'#fff',fontSize:'10px',fontWeight:700,borderRadius:'10px',padding:'2px 7px',minWidth:18,textAlign:'center'}}>{item.badge}</span>}
          </div>
        ))}
      </div>
      <div style={{padding:'14px',borderTop:`0.5px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
          <div style={{width:32,height:32,borderRadius:'8px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'13px',flexShrink:0}}>{staffMember.name[0]}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:'12px',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{staffMember.name}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{staffMember.roleLabel}{staffMember.department&&staffMember.department!=='All departments'&&` · ${staffMember.department}`}</div>
          </div>
        </div>
        <Btn style={{width:'100%',fontSize:'12px'}} onClick={onLogout}>Sign out</Btn>
      </div>
    </div>
  )
}

function CheckInSearchScreen({ onCheckedIn, onNewPatient, onNavSchedule, checkInError, onDoneCheckIn, staffMember }) {
  const [mode,setMode]=useState('scan')
  const [stage,setStage]=useState('idle')
  const [patient,setPatient]=useState(null)
  const [searchTerm,setSearchTerm]=useState('')
  const [searchResult,setSearchResult]=useState(null)
  const [requestSent,setRequestSent]=useState(false)
  const [accessRequestStatus,setAccessRequestStatus]=useState(null) // null | 'pending' | 'approved' | 'denied'
  const [checkingIn,setCheckingIn]=useState(false)
  const [revealedClaimCode,setRevealedClaimCode]=useState(null)
  const [regeneratingCode,setRegeneratingCode]=useState(false)

  const [justCheckedIn,setJustCheckedIn]=useState(null) // holds the patient name once confirmed, for a real success message

  // Whether the found/searched patient is already sitting in today's
  // queue - checked proactively so the button reads "Already checked
  // in" up front, instead of only finding out after clicking "Check in"
  // and getting an error back.
  const [alreadyInQueue,setAlreadyInQueue]=useState(false)
  async function checkAlreadyInQueue(patientId) {
    const { data } = await supabase.from('clinic_queue').select('status')
      .eq('patient_id', patientId).in('status', ['waiting','serving']).limit(1).maybeSingle()
    setAlreadyInQueue(!!data)
  }

  // Asked live at check-in (scan or search) rather than buried in a
  // separate screen - default on, staff taps it off if the patient
  // says no when asked. Never blocks the check-in itself either way,
  // it only decides whether this clinic can read past records today.
  const [walkInConsent,setWalkInConsent]=useState(true)

  // A quick heads-up for the doctor/queue - "limping, priority" etc -
  // front desk or the nurse usually already asks this at check-in, but
  // had nowhere to put it before. Separate from clinical notes, which
  // stay doctor-only inside the consultation itself.
  const [checkinNote,setCheckinNote]=useState('')

  // Weight/height logged at check-in, with its own date - a real
  // history table (patient_vitals), not the transient weight field
  // inside ConsultationScreen that only exists for a live dose
  // calculation and is never saved anywhere.
  const [vitalsWeight,setVitalsWeight]=useState('')
  const [vitalsHeight,setVitalsHeight]=useState('')
  const [vitalsSaving,setVitalsSaving]=useState(false)
  const [vitalsSaved,setVitalsSaved]=useState(false)
  const [lastVitals,setLastVitals]=useState(null)

  async function loadLastVitals(patientId) {
    const { data } = await supabase.from('patient_vitals').select('*').eq('patient_id', patientId).order('logged_at',{ascending:false}).limit(1).maybeSingle()
    setLastVitals(data||null)
  }

  async function handleSaveVitals(patientId) {
    if (!vitalsWeight && !vitalsHeight) return
    setVitalsSaving(true)
    await supabase.from('patient_vitals').insert({
      patient_id: patientId, weight_kg: vitalsWeight?parseFloat(vitalsWeight):null,
      height_cm: vitalsHeight?parseFloat(vitalsHeight):null,
      logged_at: new Date().toISOString(), logged_by: staffMember?.name || null,
    })
    setVitalsSaving(false)
    setVitalsSaved(true)
    loadLastVitals(patientId)
  }

  // Front desk assigns the doctor right here, grouped by speciality -
  // this is the actual routing decision for a walk-in with no existing
  // booking (a booked appointment already carries its own doctor and
  // takes priority server-side; this only matters when there isn't one).
  // Without this, a walk-in checked in by front desk had no doctor
  // attached at all and never showed up under anyone's My Patients.
  const [checkInDoctors,setCheckInDoctors]=useState([])
  const [selectedCheckInDoctor,setSelectedCheckInDoctor]=useState('')
  useEffect(() => { loadClinicDoctors().then(setCheckInDoctors) }, [])
  const checkInDoctorsBySpeciality = checkInDoctors.reduce((acc,d)=>{
    const key = d.department || 'General'
    ;(acc[key] = acc[key]||[]).push(d)
    return acc
  }, {})

  // Which queue this clinic runs, if more than one - lets front desk
  // route a check-in to the right line (e.g. General vs Chinese
  // Medicine) instead of everyone sharing one ticket sequence.
  const [queues,setQueues]=useState([])
  const [selectedQueueId,setSelectedQueueId]=useState(null)
  const [institutionNameForTicket,setInstitutionNameForTicket]=useState('')
  const [printTicket,setPrintTicket]=useState(null)

  useEffect(() => {
    async function loadQueues() {
      if (!staffMember?.institutionId) return
      const [{data:qs},{data:inst}] = await Promise.all([
        supabase.from('clinic_queues').select('*').eq('institution_id', staffMember.institutionId).eq('active', true).order('created_at'),
        supabase.from('institutions').select('name').eq('id', staffMember.institutionId).maybeSingle(),
      ])
      setQueues(qs||[])
      if (qs?.length) setSelectedQueueId(qs[0].id)
      setInstitutionNameForTicket(inst?.name||'')
    }
    loadQueues()
  }, [staffMember?.institutionId])

  // Recommend the doctor/department's own queue as the default the
  // moment a doctor is picked (or on load, using the checking-in staff
  // member's own department) - front desk can still override with a tap
  // on any other queue chip, this just makes the default the right one
  // instead of always whichever queue happened to be created first.
  useEffect(() => {
    if (queues.length <= 1) return
    const dept = checkInDoctors.find(d=>d.name===selectedCheckInDoctor)?.department || staffMember?.department
    const match = queues.find(q=>q.department===dept)
    if (match) setSelectedQueueId(match.id)
  }, [selectedCheckInDoctor, queues])

  // Shared by both scan and search check-in paths - records the
  // consent answer asked at check-in (appointment_intake, same table a
  // booked appointment already writes to), then runs the real check-in
  // and looks up the ticket that was just created so it can be offered
  // for printing. The consent answer asked above is passed through to
  // handleCheckedIn, which is the one place that actually writes
  // appointment_intake - inserting a second row here too would just
  // race with it and whichever one lands last wins, silently
  // overwriting whatever the other one recorded.
  async function doCheckIn(p, force) {
    setCheckingIn(true)
    const qId = queues.length>1 ? selectedQueueId : undefined
    const explicitDoctor = checkInDoctors.find(d=>d.name===selectedCheckInDoctor) || null
    const result = await onCheckedIn(p, force, qId, walkInConsent, checkinNote.trim()||null, undefined, explicitDoctor)
    setCheckingIn(false)
    if (result === true) {
      setJustCheckedIn(p.full_name)
      setAlreadyInQueue(true)
      const { data: ticketRow } = await supabase.from('clinic_queue').select('ticket, queue_id')
        .eq('patient_id', p.id).order('checked_in_at', { ascending: false }).limit(1).maybeSingle()
      setPrintTicket(ticketRow ? {
        ticket: ticketRow.ticket, patientName: p.full_name,
        queueName: queues.find(q=>q.id===ticketRow.queue_id)?.name || null,
      } : null)
    }
    return result
  }

  async function handleCheckInClick(force=false) {
    if (checkingIn) return // guard against rapid repeat clicks
    await doCheckIn(patient, force)
    // 'already_active' leaves the screen as-is with checkInError shown,
    // plus a "Check in anyway" option below for testing/demo purposes
  }

  const [scanChoices,setScanChoices]=useState([])

  async function loadScanChoices() {
    const { data } = await supabase.from('patients').select('*').limit(10)
    setScanChoices(data || [])
  }

  async function simulateScan(chosenPatient) {
    setStage('scanning')
    setWalkInConsent(true)
    setCheckinNote(''); setVitalsWeight(''); setVitalsHeight(''); setVitalsSaved(false)
    loadLastVitals(chosenPatient.id)
    checkAlreadyInQueue(chosenPatient.id)
    // Real scan hardware isn't wired up yet - this simulates it by letting
    // you pick which patient's card is being "scanned," pulled from real
    // Supabase data, rather than always fetching one fixed demo patient.
    setTimeout(() => {
      setPatient(chosenPatient)
      setStage('found')
    }, 600)
  }

  const [searched,setSearched]=useState(false)

  async function handleSearch() {
    if (!searchTerm.trim()) return
    const term = searchTerm.trim()
    const { data } = await supabase
      .from('patients')
      .select('*')
      .or(`medsa_id.ilike.%${term}%,full_name.ilike.%${term}%`)
      .limit(1)
      .maybeSingle()
    setSearchResult(data || null)
    setRequestSent(false)
    setSearched(true)
    setRevealedClaimCode(null)
    setWalkInConsent(true)
    setCheckinNote(''); setVitalsWeight(''); setVitalsHeight(''); setVitalsSaved(false)
    if (data) { loadLastVitals(data.id); checkAlreadyInQueue(data.id) } else { setAlreadyInQueue(false) }
    // Real status, not just "did I click the button this session" - a
    // fresh search should show whether the patient already approved or
    // denied a request from an earlier visit, not just "not sent yet."
    // Matched by institution_id, not institution_source - that field is
    // a fixed literal ('clinic_ops') shared by every clinic using this
    // app, not a per-clinic identifier, so matching on it would have
    // shown one clinic's approval to every other clinic.
    if (data && staffMember?.institutionId) {
      const { data: existingRequest } = await supabase.from('record_access_requests')
        .select('status').eq('patient_id', data.id).eq('requesting_institution_id', staffMember.institutionId)
        .order('created_at',{ascending:false}).limit(1).maybeSingle()
      setAccessRequestStatus(existingRequest?.status || null)
    } else {
      setAccessRequestStatus(null)
    }
  }

  function isClaimCodeExpired(patient) {
    if (!patient?.claim_code_expires_at) return true
    return new Date(patient.claim_code_expires_at) < new Date()
  }

  async function handleRegenerateClaimCode(patient) {
    setRegeneratingCode(true)
    const newCode = Math.random().toString(36).slice(2,8).toUpperCase()
    const newExpiry = new Date(Date.now() + 48*60*60*1000).toISOString()
    await supabase.from('patients').update({
      claim_code: newCode, claim_code_expires_at: newExpiry, claim_code_sent_to: patient.phone,
    }).eq('id', patient.id)
    setRegeneratingCode(false)
    setRevealedClaimCode(newCode)
  }

  return (
    <>
    <PageWrap maxWidth={560}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Check-In / Search</h2>
      {checkInError&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>{'\u26a0'} {checkInError}</div>}

      <div style={{display:'flex',gap:'8px',marginBottom:'20px',justifyContent:'center'}}>
        {[['scan','Scan to check in'],['search','Search patients']].map(([k,l])=>(
          <div key={k} onClick={()=>setMode(k)} style={{fontSize:'13px',padding:'9px 18px',borderRadius:'20px',cursor:'pointer',background:mode===k?C.green:C.card,color:mode===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>

      {mode==='scan'&&<>
        {stage==='idle'&&<>
          {scanChoices.length===0&&<div onClick={loadScanChoices} style={{background:C.cream,border:`1.5px dashed ${C.border}`,borderRadius:'14px',padding:'44px 20px',textAlign:'center',cursor:'pointer',marginBottom:'16px'}}>
            <div style={{fontSize:'36px',color:C.green,marginBottom:'10px'}}>{'\u2b21'}</div>
            <div style={{fontSize:'15px',fontWeight:600,marginBottom:'4px'}}>Scan patient QR code</div>
            <div style={{fontSize:'12px',color:C.textSub}}>Tap to simulate scanning a patient's card</div>
          </div>}
          {scanChoices.length>0&&<div style={{marginBottom:'16px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',textAlign:'center'}}>Demo: tap the patient whose card is being scanned</div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {scanChoices.map(p=>(
                <div key={p.id} onClick={()=>simulateScan(p)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 16px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'14px',fontWeight:500}}>{p.full_name}</span>
                  <span style={{fontSize:'11px',color:C.textMuted}}>{p.medsa_id}</span>
                </div>
              ))}
            </div>
          </div>}
          <div style={{textAlign:'center'}}>
            <span style={{fontSize:'12px',color:C.textSub}}>New patient, not yet on Medsa? </span>
            <span onClick={onNewPatient} style={{fontSize:'12px',color:C.green,fontWeight:600,cursor:'pointer'}}>Register them {'\u2192'}</span>
          </div>
        </>}
        {stage==='scanning'&&<div style={{textAlign:'center',padding:'60px 24px'}}>
          <div style={{width:36,height:36,border:`3px solid ${C.greenLight}`,borderTop:`3px solid ${C.green}`,borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 16px'}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{fontSize:'13px',color:C.textSub}}>Reading QR code...</div>
        </div>}
        {stage==='found'&&patient&&<div>
          <div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'12px',padding:'20px',marginBottom:'14px'}}>
            <div style={{fontSize:'11px',color:C.green,fontWeight:600,marginBottom:'8px',textTransform:'uppercase'}}>{'\u2713'} Patient found</div>
            <div style={{fontSize:'18px',fontWeight:700}}>{patient.full_name}</div>
            <div style={{fontSize:'13px',color:C.textSub,marginBottom:'14px'}}>{patient.medsa_id} - DOB {new Date(patient.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
            <div style={{display:'flex',gap:'10px'}}>
              <div style={{flex:1,background:'#fff',borderRadius:'8px',padding:'10px',textAlign:'center'}}>
                <div style={{fontSize:'11px',color:C.textMuted}}>Blood type</div>
                <div style={{fontSize:'18px',fontWeight:700,color:C.red}}>{patient.blood_type||'-'}</div>
              </div>
              <div style={{flex:2,background:'#fff',borderRadius:'8px',padding:'10px'}}>
                <div style={{fontSize:'11px',color:C.textMuted}}>Emergency card</div>
                <div style={{fontSize:'13px',fontWeight:600,color:patient.emergency_card_active?C.green:C.textMuted}}>{patient.emergency_card_active?'Active':'Not set up'}</div>
              </div>
            </div>
            <div style={{marginTop:'10px',background:'#fff',borderRadius:'8px',padding:'10px'}}>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Log weight/height{lastVitals?` - last logged ${new Date(lastVitals.logged_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}: ${lastVitals.weight_kg?lastVitals.weight_kg+'kg':''}${lastVitals.height_cm?' '+lastVitals.height_cm+'cm':''}`:''}</div>
              <div style={{display:'flex',gap:'6px'}}>
                <input type="number" step="0.1" value={vitalsWeight} onChange={e=>setVitalsWeight(e.target.value)} placeholder="Weight (kg)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px',fontSize:'12px',boxSizing:'border-box'}}/>
                <input type="number" step="0.1" value={vitalsHeight} onChange={e=>setVitalsHeight(e.target.value)} placeholder="Height (cm)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px',fontSize:'12px',boxSizing:'border-box'}}/>
                <button onClick={()=>handleSaveVitals(patient.id)} disabled={vitalsSaving||(!vitalsWeight&&!vitalsHeight)} style={{padding:'8px 12px',background:C.navy,color:'#fff',border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>{vitalsSaving?'Saving…':'Save'}</button>
              </div>
              {vitalsSaved&&<div style={{fontSize:'11px',color:C.green,marginTop:'6px'}}>{'✓'} Logged with today's date.</div>}
            </div>
          </div>
          {!justCheckedIn ? <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            <div style={{background:C.card,borderRadius:'8px',padding:'10px 12px'}}>
              <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>Ask: does {patient.full_name} consent to this clinic viewing their past Medsa records today?</div>
              <div style={{display:'flex',gap:'8px'}}>
                <div onClick={()=>setWalkInConsent(true)} style={{flex:1,padding:'8px',borderRadius:'6px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:walkInConsent?C.green:'#fff',color:walkInConsent?'#fff':C.textSub,border:`1px solid ${C.border}`}}>Yes, consents</div>
                <div onClick={()=>setWalkInConsent(false)} style={{flex:1,padding:'8px',borderRadius:'6px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:!walkInConsent?C.amber:'#fff',color:!walkInConsent?'#fff':C.textSub,border:`1px solid ${C.border}`}}>No</div>
              </div>
              {!walkInConsent&&<div style={{fontSize:'11px',color:C.amber,marginTop:'6px'}}>Check-in still proceeds - records just won't be visible to this clinic today.</div>}
            </div>
            {Object.keys(checkInDoctorsBySpeciality).length>0&&<div style={{background:C.card,borderRadius:'8px',padding:'10px 12px'}}>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Doctor (only needed if not already booked - a booking's own doctor is used automatically)</div>
              {Object.entries(checkInDoctorsBySpeciality).map(([speciality,docs])=>(
                <div key={speciality} style={{marginBottom:'6px'}}>
                  <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>{speciality}</div>
                  <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                    {docs.map(d=>(
                      <div key={d.name} onClick={()=>setSelectedCheckInDoctor(selectedCheckInDoctor===d.name?'':d.name)} style={{padding:'6px 12px',borderRadius:'16px',fontSize:'12px',cursor:'pointer',background:selectedCheckInDoctor===d.name?C.green:'#fff',color:selectedCheckInDoctor===d.name?'#fff':C.textSub,border:`1px solid ${C.border}`}}>{d.name}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>}
            <div style={{background:C.card,borderRadius:'8px',padding:'10px 12px'}}>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Note for the doctor/queue (optional) - e.g. "limping", "priority"</div>
              <input value={checkinNote} onChange={e=>setCheckinNote(e.target.value)} placeholder="Heads-up note..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px',fontSize:'12px',boxSizing:'border-box'}}/>
            </div>
            {queues.length>1&&<div>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Queue</div>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                {queues.map(q=>(
                  <div key={q.id} onClick={()=>setSelectedQueueId(q.id)} style={{padding:'6px 12px',borderRadius:'16px',fontSize:'12px',cursor:'pointer',background:selectedQueueId===q.id?C.green:C.card,color:selectedQueueId===q.id?'#fff':C.textSub}}>{q.name}</div>
                ))}
              </div>
            </div>}
            <div style={{display:'flex',gap:'10px'}}>
              <Btn onClick={()=>setStage('idle')} disabled={checkingIn}>Cancel</Btn>
              <Btn variant={alreadyInQueue?'secondary':'primary'} style={{flex:1}} onClick={()=>handleCheckInClick(false)} disabled={checkingIn||alreadyInQueue}>{checkingIn?'Checking in...':alreadyInQueue?'✓ Checked in':'Check in patient'}</Btn>
            </div>
            {alreadyInQueue&&<Btn style={{width:'100%'}} onClick={()=>handleCheckInClick(true)} disabled={checkingIn}>Check in again (testing)</Btn>}
            {checkInError&&checkInError.includes('already checked in')&&<Btn style={{width:'100%'}} onClick={()=>handleCheckInClick(true)} disabled={checkingIn}>Check in anyway (testing)</Btn>}
          </div> : <div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'14px',textAlign:'center'}}>
            <div style={{fontSize:'14px',color:C.green,fontWeight:600,marginBottom:'10px'}}>{'\u2713'} {justCheckedIn} checked in successfully{printTicket?` \u00b7 ticket ${printTicket.ticket}`:''}</div>
            {printTicket&&<Btn style={{width:'100%',marginBottom:'8px'}} onClick={()=>window.print()}>{'\u2399'} Print ticket</Btn>}
            <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setJustCheckedIn(null);setStage('idle');setPatient(null);setPrintTicket(null);setWalkInConsent(true);setCheckinNote('');setVitalsWeight('');setVitalsHeight('');setVitalsSaved(false);setAlreadyInQueue(false);setSelectedCheckInDoctor('');onDoneCheckIn&&onDoneCheckIn()}}>Done</Btn>
          </div>}
        </div>}
        {stage==='error'&&<div style={{textAlign:'center',padding:'40px 24px'}}>
          <div style={{fontSize:'28px',marginBottom:'10px'}}>{'\u25ce'}</div>
          <div style={{fontSize:'14px',color:C.textSub,marginBottom:'14px'}}>Patient not found. Try search or register a new patient.</div>
          <Btn onClick={()=>setStage('idle')}>Try again</Btn>
        </div>}
      </>}

      {mode==='search'&&<>
        <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
          <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',background:C.cream,outline:'none',boxSizing:'border-box'}} placeholder="Search by name or Medsa ID..."/>
          <Btn variant="primary" onClick={handleSearch}>Search</Btn>
        </div>
        {searchResult&&!justCheckedIn&&<Card style={{padding:'20px'}}>
          <div style={{fontSize:'17px',fontWeight:700}}>{searchResult.full_name}</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'10px'}}>{searchResult.medsa_id} - DOB {new Date(searchResult.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} {searchResult.blood_type?`- Blood type ${searchResult.blood_type}`:''}</div>
          <div style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'10px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Log weight/height{lastVitals?` - last logged ${new Date(lastVitals.logged_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}: ${lastVitals.weight_kg?lastVitals.weight_kg+'kg':''}${lastVitals.height_cm?' '+lastVitals.height_cm+'cm':''}`:''}</div>
            <div style={{display:'flex',gap:'6px'}}>
              <input type="number" step="0.1" value={vitalsWeight} onChange={e=>setVitalsWeight(e.target.value)} placeholder="Weight (kg)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px',fontSize:'12px',boxSizing:'border-box'}}/>
              <input type="number" step="0.1" value={vitalsHeight} onChange={e=>setVitalsHeight(e.target.value)} placeholder="Height (cm)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px',fontSize:'12px',boxSizing:'border-box'}}/>
              <button onClick={()=>handleSaveVitals(searchResult.id)} disabled={vitalsSaving||(!vitalsWeight&&!vitalsHeight)} style={{padding:'8px 12px',background:C.navy,color:'#fff',border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>{vitalsSaving?'Saving…':'Save'}</button>
            </div>
            {vitalsSaved&&<div style={{fontSize:'11px',color:C.green,marginTop:'6px'}}>{'✓'} Logged with today's date.</div>}
          </div>
          <div style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'10px'}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>Ask: does {searchResult.full_name} consent to this clinic viewing their past Medsa records today?</div>
            <div style={{display:'flex',gap:'8px'}}>
              <div onClick={()=>setWalkInConsent(true)} style={{flex:1,padding:'8px',borderRadius:'6px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:walkInConsent?C.green:'#fff',color:walkInConsent?'#fff':C.textSub,border:`1px solid ${C.border}`}}>Yes, consents</div>
              <div onClick={()=>setWalkInConsent(false)} style={{flex:1,padding:'8px',borderRadius:'6px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:!walkInConsent?C.amber:'#fff',color:!walkInConsent?'#fff':C.textSub,border:`1px solid ${C.border}`}}>No</div>
            </div>
            {!walkInConsent&&<div style={{fontSize:'11px',color:C.amber,marginTop:'6px'}}>Check-in still proceeds - records just won't be visible to this clinic today.</div>}
          </div>
          {Object.keys(checkInDoctorsBySpeciality).length>0&&<div style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'10px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Doctor (only needed if not already booked - a booking's own doctor is used automatically)</div>
            {Object.entries(checkInDoctorsBySpeciality).map(([speciality,docs])=>(
              <div key={speciality} style={{marginBottom:'6px'}}>
                <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>{speciality}</div>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                  {docs.map(d=>(
                    <div key={d.name} onClick={()=>setSelectedCheckInDoctor(selectedCheckInDoctor===d.name?'':d.name)} style={{padding:'6px 12px',borderRadius:'16px',fontSize:'12px',cursor:'pointer',background:selectedCheckInDoctor===d.name?C.green:'#fff',color:selectedCheckInDoctor===d.name?'#fff':C.textSub,border:`1px solid ${C.border}`}}>{d.name}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>}
          <div style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'10px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Note for the doctor/queue (optional) - e.g. "limping", "priority"</div>
            <input value={checkinNote} onChange={e=>setCheckinNote(e.target.value)} placeholder="Heads-up note..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px',fontSize:'12px',boxSizing:'border-box'}}/>
          </div>
          <div style={{display:'flex',gap:'10px',marginBottom:'10px'}}>
            <Btn variant={alreadyInQueue?'secondary':'primary'} style={{flex:1}} onClick={()=>doCheckIn(searchResult,false)} disabled={checkingIn||alreadyInQueue}>{checkingIn?'Checking in...':alreadyInQueue?'✓ Checked in':'Check in now'}</Btn>
            <Btn style={{flex:1}} onClick={onNavSchedule}>Schedule instead</Btn>
          </div>
          {alreadyInQueue&&<Btn style={{width:'100%',marginBottom:'10px'}} onClick={()=>doCheckIn(searchResult,true)} disabled={checkingIn}>Check in again (testing)</Btn>}
          {queues.length>1&&<div style={{marginBottom:'10px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Queue</div>
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
              {queues.map(q=>(
                <div key={q.id} onClick={()=>setSelectedQueueId(q.id)} style={{padding:'6px 12px',borderRadius:'16px',fontSize:'12px',cursor:'pointer',background:selectedQueueId===q.id?C.green:C.card,color:selectedQueueId===q.id?'#fff':C.textSub}}>{q.name}</div>
              ))}
            </div>
          </div>}
          {checkInError&&checkInError.includes('already checked in')&&<Btn style={{width:'100%',marginBottom:'10px'}} onClick={()=>doCheckIn(searchResult,true)} disabled={checkingIn}>Check in anyway (testing)</Btn>}
          {!requestSent&&!accessRequestStatus&&<Btn style={{width:'100%'}} onClick={async()=>{
            // Real clinic name, not the fixed 'clinic_ops' app-source
            // literal - that string was showing up as the "requesting
            // clinic" in the patient's own approval screen.
            let clinicName = null
            if (staffMember?.institutionId) {
              const { data: inst } = await supabase.from('institutions').select('name').eq('id', staffMember.institutionId).maybeSingle()
              clinicName = inst?.name || null
            }
            const { error } = await supabase.from('record_access_requests').insert({
              patient_id: searchResult.id, requesting_staff: staffMember?.name || 'Unknown',
              requesting_clinic: clinicName, requesting_institution_id: staffMember?.institutionId || null,
              reason: 'Ahead of upcoming visit', status: 'pending',
            })
            if (error) { alert(`Could not send request: ${error.message}`); return }
            setRequestSent(true)
            setAccessRequestStatus('pending')
          }}>Request record access ahead of visit</Btn>}
          {(requestSent||accessRequestStatus==='pending')&&<div style={{marginTop:'10px',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:C.amber}}>{'\u25c7'} Request sent to patient for approval. Records will be available here once granted, ahead of check-in.</div>}
          {accessRequestStatus==='approved'&&<div style={{marginTop:'10px',background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:C.green}}>{'\u2713'} Patient approved this request.</div>}
          {accessRequestStatus==='denied'&&<div style={{marginTop:'10px',background:C.redLight,border:`0.5px solid ${C.red}`,borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:C.red}}>Patient declined this request.</div>}
          {searchResult.registration_path==='unclaimed'&&<div style={{marginTop:'14px',paddingTop:'14px',borderTop:`0.5px solid ${C.border}`}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>This patient hasn't claimed their profile yet - that's why clinical data isn't available. Lost or forgot the claim code?</div>
            {revealedClaimCode
              ? <div style={{background:C.card,borderRadius:'10px',padding:'14px',textAlign:'center'}}>
                  <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>New claim code (valid 48 hours)</div>
                  <div style={{fontSize:'22px',fontWeight:700,letterSpacing:'2px',color:C.green}}>{revealedClaimCode}</div>
                </div>
              : <Btn style={{width:'100%'}} onClick={()=>isClaimCodeExpired(searchResult)?handleRegenerateClaimCode(searchResult):setRevealedClaimCode(searchResult.claim_code)} disabled={regeneratingCode}>
                  {regeneratingCode?'Generating…':isClaimCodeExpired(searchResult)?'Generate new claim code (old one expired)':'View claim code'}
                </Btn>}
          </div>}
        </Card>}
        {justCheckedIn&&<Card style={{padding:'20px'}}>
          <div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'14px',textAlign:'center'}}>
            <div style={{fontSize:'14px',color:C.green,fontWeight:600,marginBottom:'10px'}}>{'\u2713'} {justCheckedIn} checked in successfully{printTicket?` \u00b7 ticket ${printTicket.ticket}`:''}</div>
            {printTicket&&<Btn style={{width:'100%',marginBottom:'8px'}} onClick={()=>window.print()}>{'\u2399'} Print ticket</Btn>}
            <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setJustCheckedIn(null);setSearchResult(null);setSearchTerm('');setSearched(false);setPrintTicket(null);onDoneCheckIn&&onDoneCheckIn()}}>Done</Btn>
          </div>
        </Card>}
        {searched&&!searchResult&&!justCheckedIn&&<div style={{textAlign:'center',padding:'20px'}}>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'10px'}}>No patient found matching "{searchTerm}".</div>
          <span onClick={onNewPatient} style={{fontSize:'13px',color:C.green,fontWeight:600,cursor:'pointer'}}>Register them as a new patient {'\u2192'}</span>
        </div>}
      </>}
    </PageWrap>

    {/* Print-only ticket - the rest of the app is hidden via @media
        print, leaving just this. Works with any printer registered in
        the browser/OS print dialog, including thermal ticket printers
        (most ship with a driver that shows up as a normal printer). A
        genuine ESC/POS receipt printer needing raw USB/serial commands
        would need model-specific driver code - not something buildable
        without the actual hardware to test against. */}
    {printTicket&&<div id="print-ticket-area">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-ticket-area, #print-ticket-area * { visibility: visible; }
          #print-ticket-area { position: fixed; top: 0; left: 0; width: 80mm; padding: 8mm; font-family: monospace; }
        }
        @media screen { #print-ticket-area { display: none; } }
      `}</style>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:'14px',fontWeight:700}}>{institutionNameForTicket || 'Medsa Clinic'}</div>
        {printTicket.queueName&&<div style={{fontSize:'11px',marginTop:'4px'}}>{printTicket.queueName}</div>}
        <div style={{fontSize:'42px',fontWeight:700,margin:'14px 0'}}>{printTicket.ticket}</div>
        <div style={{fontSize:'11px'}}>{printTicket.patientName}</div>
        <div style={{fontSize:'10px',marginTop:'4px'}}>{new Date().toLocaleString('en-HK')}</div>
      </div>
    </div>}
    </>
  )
}

function NewPatientScreen({ onBack, onCreated, onCheckInNow, prefillName }) {
  const [form,setForm]=useState({firstName:prefillName||'',lastName:'',dob:'',phone:'',hkid:'',email:'',remindersViaPhone:true,remindersViaEmail:false})
  const [saving,setSaving]=useState(false)
  const [submitted,setSubmitted]=useState(false)
  const [error,setError]=useState(null)
  const [claimCode,setClaimCode]=useState(null)
  const [createdPatient,setCreatedPatient]=useState(null)

  function generateClaimCode() {
    return Math.random().toString(36).slice(2,8).toUpperCase()
  }

  // Real message copy - what would actually be sent once a real SMS/email
  // provider is connected. Shown on-screen now so this can be reviewed and
  // approved before any real integration is wired up.
  function smsText(name, code) {
    return `Medsa: Hi ${name}, your clinic has created a health record for you. To claim it and access your records anytime, open the Medsa app, enter your HKID and this code: ${code} (valid 48 hours). Reply STOP to opt out.`
  }
  function emailText(name, code) {
    return `Subject: Claim your Medsa health record\n\nHi ${name},\n\nYour clinic has created a Medsa health record for you. To claim it - and access your records from any Medsa-connected clinic going forward - open the Medsa app and enter your HKID along with this code:\n\n${code}\n\nThis code is valid for 48 hours. If you didn't expect this message, you can safely ignore it.\n\n- Medsa`
  }

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      if (!form.firstName) throw new Error('First name is required.')
      if (!form.hkid) throw new Error('HKID is required so the patient can later claim this profile.')
      if (!form.phone && !form.email) throw new Error('At least one contact method (phone or email) is required to send the claim code.')
      const fullName = `${form.firstName}${form.lastName ? ' '+form.lastName : ''}`

      // Check for an existing record under this HKID first - the database
      // itself enforces uniqueness, so blindly inserting would just fail.
      // This is also the real, correct fix for the cross-institution
      // scenario: rather than creating a duplicate to merge later, reuse
      // the existing unclaimed record directly.
      const { data: existing } = await supabase.from('patients').select('*').eq('hkid', form.hkid).maybeSingle()
      if (existing?.claimed_at) {
        throw new Error(`${existing.full_name} already has a claimed Medsa profile (${existing.medsa_id}). Search for them instead of registering as new.`)
      }
      if (existing && !existing.claimed_at) {
        // Already has an unclaimed record from another visit/institution -
        // refresh their claim code and contact info for this visit rather
        // than creating a second row the database would reject anyway.
        const code = generateClaimCode()
        const expiresAt = new Date(Date.now() + 48*60*60*1000).toISOString()
        const { data: refreshed, error: updErr } = await supabase.from('patients').update({
          full_name: fullName || existing.full_name,
          preferred_name: form.firstName || existing.preferred_name,
          date_of_birth: form.dob || existing.date_of_birth,
          phone: form.phone || existing.phone,
          email: form.email || existing.email,
          reminders_via_phone: form.remindersViaPhone && !!form.phone,
          reminders_via_email: form.remindersViaEmail && !!form.email,
          claim_code: code, claim_code_expires_at: expiresAt,
          claim_code_sent_to: [form.phone, form.email].filter(Boolean).join(', '),
        }).eq('id', existing.id).select().maybeSingle()
        if (updErr) throw updErr
        setCreatedPatient(refreshed)
        setClaimCode(code)
        setSubmitted(true)
        setSaving(false)
        return
      }

      const medsaId = 'MDS-' + Math.floor(10000+Math.random()*89999) + '-HK'
      const code = generateClaimCode()
      const expiresAt = new Date(Date.now() + 48*60*60*1000).toISOString()
      const { data: inserted, error: insErr } = await supabase.from('patients').insert({
        medsa_id: medsaId,
        full_name: fullName,
        preferred_name: form.firstName,
        date_of_birth: form.dob,
        hkid: form.hkid,
        phone: form.phone||null,
        email: form.email||null,
        reminders_via_phone: form.remindersViaPhone && !!form.phone,
        reminders_via_email: form.remindersViaEmail && !!form.email,
        emergency_card_consent: false,
        emergency_card_active: false,
        registration_path: 'unclaimed',
        claim_code: code,
        claim_code_expires_at: expiresAt,
        claim_code_sent_to: [form.phone, form.email].filter(Boolean).join(', '),
      }).select().maybeSingle()
      if (insErr) throw insErr
      setCreatedPatient(inserted)
      setClaimCode(code)
      setSubmitted(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (submitted) return (
    <PageWrap maxWidth={480}>
      <div style={{textAlign:'center',padding:'60px 20px'}}>
        <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Patient registered</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px',lineHeight:1.6}}>A Medsa profile has been created for {form.firstName || 'this patient'}. A claim code has been sent to {[form.phone, form.email].filter(Boolean).join(' and ')} - valid for 48 hours - which they will enter alongside their HKID in the Medsa app to link this record to their own account.</div>
        <div style={{background:C.card,borderRadius:'10px',padding:'14px',marginBottom:'14px'}}>
          <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>Claim code (for reference)</div>
          <div style={{fontSize:'22px',fontWeight:700,letterSpacing:'2px',color:C.green}}>{claimCode}</div>
        </div>
        {form.phone&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'14px',marginBottom:'10px',textAlign:'left'}}>
          <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',marginBottom:'6px'}}>SMS text (not yet actually sent - no live provider connected)</div>
          <div style={{fontSize:'12px',color:C.text,whiteSpace:'pre-wrap'}}>{smsText(form.firstName, claimCode)}</div>
        </div>}
        {form.email&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'14px',marginBottom:'20px',textAlign:'left'}}>
          <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',marginBottom:'6px'}}>Email text (not yet actually sent - no live provider connected)</div>
          <div style={{fontSize:'12px',color:C.text,whiteSpace:'pre-wrap'}}>{emailText(form.firstName, claimCode)}</div>
        </div>}
        {/* Reaching this screen from Schedule used to force every new
            patient through the booking-slot picker next, with no way to
            just check them in right now - most walk-ins registered here
            are standing at the desk wanting to be seen today, not booking
            a future date. */}
        <div style={{display:'flex',gap:'8px'}}>
          {onCheckInNow&&<Btn style={{flex:1}} onClick={()=>createdPatient&&onCheckInNow(createdPatient)}>Check in now</Btn>}
          <Btn variant="primary" style={{flex:onCheckInNow?1:undefined,width:onCheckInNow?undefined:'100%'}} onClick={()=>onCreated?createdPatient&&onCreated(createdPatient):onBack()}>{onCheckInNow?'Book appointment':(onCreated?'Continue with this patient':'Back to check-in')}</Btn>
        </div>
      </div>
    </PageWrap>
  )

  return (
    <PageWrap maxWidth={480}>
      <div onClick={onBack} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'16px'}}>{'\u2190'} Back</div>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Register New Patient</h2>
      <div style={{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'16px'}}>
        <input value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} placeholder="First name" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} placeholder="Last name" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} placeholder="Date of birth (YYYY-MM-DD)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.hkid} onChange={e=>setForm({...form,hkid:e.target.value})} placeholder="HKID (required)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone number" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        {form.phone&&<label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:C.textSub,cursor:'pointer'}}>
          <input type="checkbox" checked={form.remindersViaPhone} onChange={e=>setForm({...form,remindersViaPhone:e.target.checked})}/>
          Opt in for appointment reminders by SMS
        </label>}
        <input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Email (optional)" style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        {form.email&&<label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:C.textSub,cursor:'pointer'}}>
          <input type="checkbox" checked={form.remindersViaEmail} onChange={e=>setForm({...form,remindersViaEmail:e.target.checked})}/>
          Opt in for appointment reminders by email
        </label>}
        <div style={{fontSize:'11px',color:C.textMuted}}>At least one of phone or email is required, to send the claim code.</div>
      </div>
      <div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'10px',padding:'12px 14px',fontSize:'12px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>
        {'\u25c7'} A claim code will be sent to this phone number, valid 48 hours. The patient enters their HKID plus this code in the Medsa app to securely link this record - only someone who actually received the code can claim it.
      </div>
      {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
      <Btn variant="primary" style={{width:'100%'}} onClick={handleSubmit} disabled={saving||!form.firstName||!form.dob}>{saving?'Saving...':'Create Medsa profile'}</Btn>
    </PageWrap>
  )
}


// ── DOCTOR VIDEO CALL — real, working embed via Jitsi Meet's public
// server. No account, API key, or signup required, and it's a genuine,
// functioning video call, not a demo - the trade-off is it runs on
// meet.jit.si's shared infrastructure rather than Medsa's own, which is
// fine for now and can move to a dedicated/self-hosted provider later
// without changing anything else in this file.
function DoctorVideoCallModal({ patientName, roomId, onClose }) {
  if (!patientName) return null
  const roomName = `medsa-${(roomId||patientName).toString().replace(/[^a-zA-Z0-9]/g,'')}-${new Date().toISOString().slice(0,10)}`
  const jitsiUrl = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&userInfo.displayName=%22Doctor%22`
  return (
    <div style={{position:'fixed',inset:0,background:'#1a1a1a',zIndex:400,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#111'}}>
        <div style={{color:'#fff',fontSize:'13px'}}>Video call with {patientName}</div>
        <div onClick={onClose} style={{width:36,height:36,borderRadius:'50%',background:C.red,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'16px',color:'#fff'}}>✕</div>
      </div>
      <iframe
        src={jitsiUrl}
        style={{flex:1,border:'none'}}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
      />
    </div>
  )
}

// ── PATIENT ACTION MODAL — quick actions before entering full consultation ──
function PatientQueueActionModal({ patient, onClose, onGoToConsultation, onStartCall, doctorLabel }) {
  const [mode,setMode]=useState(null) // null | 'message'
  const [msgBody,setMsgBody]=useState('')
  const [msgUrgent,setMsgUrgent]=useState(false)
  const [msgSaving,setMsgSaving]=useState(false)
  const [msgSaved,setMsgSaved]=useState(false)
  const [error,setError]=useState(null)

  if (!patient) return null

  async function handleSendMessage() {
    if (!msgBody.trim()) { setError('Write a message first.'); return }
    if (!patient.patientMedsaId) { setError('This patient has no linked Medsa profile yet.'); return }
    setMsgSaving(true)
    setError(null)
    try {
      const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', patient.patientMedsaId).maybeSingle()
      if (!patientRow) throw new Error('Could not find this patient in Medsa.')
      const { error: insErr } = await supabase.from('patient_messages').insert({
        patient_id: patientRow.id, doctor_name: doctorLabel, body: msgBody, urgent: msgUrgent,
      })
      if (insErr) throw insErr
      setMsgSaved(true); setMsgBody(''); setMsgUrgent(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setMsgSaving(false)
    }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:440,padding:'20px',maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
          <div style={{fontSize:'16px',fontWeight:700}}>{patient.patientName}</div>
          <div onClick={onClose} style={{fontSize:'13px',color:C.green,cursor:'pointer'}}>Close</div>
        </div>

        {!mode&&<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>onStartCall(patient.patientName, patient.patientMedsaId)}>◈ Video call</Btn>
          <Btn style={{width:'100%'}} onClick={()=>setMode('message')}>✉ Message patient</Btn>
          <Btn variant="primary" style={{width:'100%'}} onClick={onGoToConsultation}>📋 Go to full consultation</Btn>
        </div>}

        {mode==='message'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Message {patient.patientName}</div>
          <textarea value={msgBody} onChange={e=>setMsgBody(e.target.value)} rows={4} placeholder="Write a note to this patient…" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginBottom:'10px',boxSizing:'border-box'}}/>
          <div onClick={()=>setMsgUrgent(!msgUrgent)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:msgUrgent?C.redLight:C.card,border:`0.5px solid ${msgUrgent?C.red:C.border}`,borderRadius:'8px',marginBottom:'12px',cursor:'pointer'}}>
            <Toggle checked={msgUrgent} onChange={setMsgUrgent}/>
            <span style={{fontSize:'12px',fontWeight:600,color:msgUrgent?C.red:C.text}}>Mark as urgent</span>
          </div>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
          {msgSaved&&<div style={{fontSize:'12px',color:C.green,marginBottom:'10px'}}>✓ Sent</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={handleSendMessage} disabled={msgSaving}>{msgSaving?'Sending…':'Send'}</Btn>
          </div>
        </>}
      </div>
    </div>
  )
}

function MyPatientsScreen({ queue, onSelectPatient, staffMember, onRefresh }) {
  const [actionPatient,setActionPatient]=useState(null)
  const [callingPatient,setCallingPatient]=useState(null) // {name, medsaId}
  // Completed/no-show tickets used to sit here all day (the queue only
  // ever grew, never shrank) - a doctor's active list should only be who
  // still needs seeing.
  // Sorted by queuePosition, not raw check-in order - an on-time/early
  // booked patient queues near their appointment time rather than behind
  // every walk-in who happened to arrive earlier in the day.
  const activeQueue = queue.filter(q=>q.status!=='done'&&q.status!=='no_show').sort((a,b)=>queuePosition(a)-queuePosition(b))
  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'8px',textAlign:'center'}}>My Patients</h2>
      {onRefresh&&<div style={{textAlign:'center',marginBottom:'16px'}}><span onClick={onRefresh} style={{fontSize:'12px',color:C.green,fontWeight:600,cursor:'pointer'}}>{'\u21bb'} Refresh</span></div>}
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {activeQueue.length===0&&<div style={{textAlign:'center',padding:'60px 20px',color:C.textMuted,fontSize:'13px'}}>No patients checked in yet today.</div>}
        {activeQueue.map((q,i)=>{
          const hrsLeft = hoursRemaining(q.checkedInAt)
          return (
            <Card key={i} onClick={()=>setActionPatient(q)} style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:'14px'}}>
              <div style={{width:36,height:36,borderRadius:'8px',background:q.status==='serving'?C.green:C.greenLight,color:q.status==='serving'?'#fff':C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,flexShrink:0}}>{q.ticket}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'14px',fontWeight:600}}>{q.patientName}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{q.status==='serving'?'Being seen \u00b7 ':''}Checked in {new Date(q.checkedInAt).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <Badge text={hrsLeft>0?`Records ${Math.floor(hrsLeft)}h left`:'Access expired'} type={hrsLeft>0?'ok':'full'}/>
              <span style={{color:C.textMuted,fontSize:'16px'}}>{'\u203a'}</span>
            </Card>
          )
        })}
      </div>
      <PatientQueueActionModal
        patient={actionPatient}
        onClose={()=>setActionPatient(null)}
        doctorLabel={staffMember?.name || 'Doctor'}
        onStartCall={(name, medsaId)=>{setCallingPatient({name, medsaId});setActionPatient(null)}}
        onGoToConsultation={()=>{onSelectPatient(actionPatient);setActionPatient(null)}}
      />
      <DoctorVideoCallModal patientName={callingPatient?.name} roomId={callingPatient?.medsaId} onClose={()=>setCallingPatient(null)}/>
    </PageWrap>
  )
}

function ConsultationScreen({ queueEntry, staffMember, onPrescribed, institutionId, medicineType }) {
  const [patient,setPatient]=useState(null)
  const [records,setRecords]=useState([])
  const [conditions,setConditions]=useState([])
  const [allergies,setAllergies]=useState([])
  const [activeMedications,setActiveMedications]=useState([])
  const [loading,setLoading]=useState(true)
  const [notes,setNotes]=useState('')
  const [diagnosis,setDiagnosis]=useState('')
  const [icd10Codes,setIcd10Codes]=useState([])
  const [icd10Search,setIcd10Search]=useState('')
  const [icd10Open,setIcd10Open]=useState(false)
  const [icd10Results,setIcd10Results]=useState([])
  const [icd10Loading,setIcd10Loading]=useState(false)
  const [icd10Suggestions,setIcd10Suggestions]=useState([])
  const [icd10Suggesting,setIcd10Suggesting]=useState(false)
  const [icd10SuggestError,setIcd10SuggestError]=useState(null)
  async function suggestIcd10() {
    setIcd10Suggesting(true); setIcd10SuggestError(null); setIcd10Suggestions([])
    try {
      const res = await fetch('/api/cds/suggest_icd10', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ text: [diagnosis, notes].filter(Boolean).join('. ') }),
      })
      const data = await res.json()
      if (!res.ok) { setIcd10SuggestError(data.error || 'Suggestion failed.'); return }
      setIcd10Suggestions(data.suggestions || [])
      if ((data.suggestions||[]).length===0) setIcd10SuggestError(data.note || 'No confident match found - search or enter manually.')
    } catch {
      setIcd10SuggestError('AI coding suggestion unavailable right now - pick codes manually.')
    } finally {
      setIcd10Suggesting(false)
    }
  }
  const [weightKg,setWeightKg]=useState('')
  const [heightCm,setHeightCm]=useState('')
  const [lastVitals,setLastVitals]=useState(null)
  const [vitalsSaving,setVitalsSaving]=useState(false)
  const [vitalsSaved,setVitalsSaved]=useState(false)

  async function handleSaveVitalsHere() {
    if (!weightKg && !heightCm) return
    setVitalsSaving(true)
    await supabase.from('patient_vitals').insert({
      patient_id: patient.id, weight_kg: weightKg?parseFloat(weightKg):null,
      height_cm: heightCm?parseFloat(heightCm):null,
      logged_at: new Date().toISOString(), logged_by: staffMember?.name || null,
    })
    setVitalsSaving(false)
    setVitalsSaved(true)
  }
  const [consentWindow,setConsentWindow]=useState({checked:false,allowed:false})
  const [consultationStartedAt]=useState(() => new Date().toISOString())
  const [safetyChecks,setSafetyChecks]=useState({}) // rxIndex -> {status, orderSet, triggered, checking}
  const [overrideReasons,setOverrideReasons]=useState({}) // rxIndex -> reason text
  // For a patient referred in by an out-of-network doctor with no Medsa
  // presence at all - the receiving doctor here is already logged in and
  // verified, so the simplest, most honest way to get that outside
  // referral letter on file is to just attach it directly to this visit,
  // no separate portal or verification step needed.
  const [outsideReferralFile,setOutsideReferralFile]=useState(null)

  // Real drug-to-drug interaction engine. Collects every other drug
  // actually in play for this patient right now - both the other drugs
  // in this same prescription being written today, and the patient's
  // existing active medications from past visits. This is the piece that
  // was missing before: the old version only ever checked a single drug
  // against conditions/allergies, never against other drugs.
  function getAllActiveDrugNames(excludeIdx) {
    const otherNewDrugs = prescriptions
      .map((p, i) => i === excludeIdx ? null : p.drug?.trim())
      .filter(Boolean)
    const existingDrugNames = activeMedications.map(m => m.medication_name).filter(Boolean)
    return [...new Set([...otherNewDrugs, ...existingDrugNames])]
  }

  async function checkDrugSafety(idx, drugName) {
    if (!drugName.trim()) return
    setSafetyChecks(prev => ({...prev, [idx]: {status:'checking'}}))

    const [{ data: orderSet }, { data: drugRef }] = await Promise.all([
      supabase.from('order_sets').select('*')
        .eq('institution_id', institutionId).ilike('drug_name', drugName.trim()).maybeSingle(),
      supabase.from('drug_reference').select('atc_code, hk_registration_number')
        .eq('drug_name', drugName.trim()).eq('medicine_type', medicineType||'western').maybeSingle(),
    ])

    // Local, institution-approved rules - condition/allergy/age checks.
    let localStatus = orderSet ? 'passed' : 'no_data_on_file'
    const localTriggered = []
    if (orderSet) {
      if (patient?.date_of_birth) {
        const ageYears = (Date.now() - new Date(patient.date_of_birth).getTime()) / (1000*60*60*24*365.25)
        if (orderSet.min_age_years!=null && ageYears < orderSet.min_age_years) localTriggered.push(`Below minimum age (${orderSet.min_age_years}+)`)
        if (orderSet.max_age_years!=null && ageYears > orderSet.max_age_years) localTriggered.push(`Above maximum age (${orderSet.max_age_years})`)
      }
      const patientConditionNames = conditions.map(c=>c.condition_name?.toLowerCase())
      const patientAllergenNames = allergies.map(a=>a.allergen?.toLowerCase())
      const hardMatches = orderSet.hard_stop_conditions.filter(hc =>
        patientConditionNames.includes(hc.toLowerCase()) || patientAllergenNames.includes(hc.toLowerCase()))
      const softMatches = orderSet.soft_stop_conditions.filter(sc =>
        patientConditionNames.includes(sc.toLowerCase()) || patientAllergenNames.includes(sc.toLowerCase()))
      if (hardMatches.length > 0) { localStatus = 'hard_stop_blocked'; localTriggered.push(...hardMatches) }
      else if (softMatches.length > 0) { localStatus = 'soft_stop'; localTriggered.push(...softMatches) }
    }

    // Real drug-to-drug check - looks at every OTHER drug already in play
    // (other new prescriptions this visit, plus existing active
    // medications) and treats an explicit interaction listed against this
    // new drug the same way condition/allergy matches are treated: hard
    // stop blocks, soft stop requires a reason. Once a real CDS/MIMS
    // provider is connected, this is the one place that changes - it
    // would receive this same otherDrugs list and return a verdict the
    // same way, without needing anything downstream to change.
    const otherDrugs = getAllActiveDrugNames(idx)
    if (otherDrugs.length > 0) {
      const { data: interactionRows } = await supabase.from('order_sets')
        .select('drug_name, hard_stop_conditions, soft_stop_conditions')
        .eq('institution_id', institutionId).in('drug_name', otherDrugs)
      for (const row of interactionRows || []) {
        const nameLower = drugName.trim().toLowerCase()
        if ((row.hard_stop_conditions||[]).some(c => c.toLowerCase() === nameLower)) {
          localStatus = 'hard_stop_blocked'
          localTriggered.push(`Interacts with ${row.drug_name} (already prescribed)`)
        } else if ((row.soft_stop_conditions||[]).some(c => c.toLowerCase() === nameLower) && localStatus !== 'hard_stop_blocked') {
          localStatus = 'soft_stop'
          localTriggered.push(`Possible interaction with ${row.drug_name} (already prescribed)`)
        }
      }
    }

    // Real, external CDS plugin check - only runs if this drug actually
    // has a standardized code on file, since without one no real lookup
    // is possible (same "no data" honesty as the local check).
    let cdsResult = null
    if (drugRef?.atc_code || drugRef?.hk_registration_number) {
      const ageInMonths = patient?.date_of_birth
        ? Math.round((Date.now() - new Date(patient.date_of_birth).getTime()) / (1000*60*60*24*30.44))
        : null
      try {
        const res = await fetch('/api/cds/check-safety', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            patientId: patient.id, ageInMonths, weightKg: parseFloat(weightKg)||null,
            drugName: drugName.trim(), atcCode: drugRef.atc_code, hkRegistrationNumber: drugRef.hk_registration_number,
            otherDrugs, institutionId,
          }),
        })
        cdsResult = await res.json()
      } catch (e) {
        cdsResult = { safetyStatus: 'ERROR', message: 'Could not reach safety check service.' }
      }
    }

    // Merge - the more cautious of all sources wins. A hard stop from
    // any source blocks; a warning from any requires an override reason;
    // only clear from all (or no data from all) passes through cleanly.
    const severity = { hard_stop_blocked: 3, WARNING: 2, soft_stop: 2, ERROR: 2, passed: 1, CLEAR: 1, no_data_on_file: 0 }
    const cdsStatus = cdsResult?.safetyStatus === 'WARNING' ? 'soft_stop' : cdsResult?.safetyStatus === 'ERROR' ? 'soft_stop' : cdsResult ? 'passed' : 'no_data_on_file'
    const finalStatus = severity[cdsStatus] > severity[localStatus] ? cdsStatus : localStatus
    const combinedTriggered = [...localTriggered]
    if (cdsResult?.message) combinedTriggered.push(`CDS: ${cdsResult.message}`)

    setSafetyChecks(prev => ({...prev, [idx]: { status: finalStatus, orderSet, triggered: combinedTriggered, cdsResult }}))
  }
  const [lineItems,setLineItems]=useState([]) // [{service_item_id, description, category, fee, qty}]
  const [catalog,setCatalog]=useState([])

  // Real service catalog - what the doctor actually picks from to build
  // the itemized list, rather than typing free text or manually
  // searching a code database. Shows the whole active price list, not
  // filtered by clinic type - a clinic_type mismatch (bad data, or a
  // mixed-practice clinic) used to make items silently invisible here
  // with no way to tell why; showing everything means nothing's ever
  // hidden from the person actually billing.
  useEffect(() => {
    async function loadCatalog() {
      const { data } = await supabase.from('service_items').select('*')
        .eq('active', true).order('category')
      setCatalog(data || [])
      // A visit shouldn't need the doctor to remember to add a base
      // consultation charge every single time - auto-itemize it from
      // the catalog if one's listed (matched by name), otherwise as an
      // editable placeholder so at minimum something reaches billing,
      // including for a visit with no prescription at all.
      setLineItems(prev => {
        if (prev.length > 0) return prev
        // The practice manager's explicit pick (Price List > Set as
        // default) wins if there is one - falling back to a name match
        // only when nobody's set one, so it's never left to a guess that
        // can land on the wrong clinic type's item (this is how "Chinese
        // Consultation" used to end up as a western clinic's default -
        // it was just the first 'consult'-named row the query returned).
        const consultItem = (data||[]).find(i => i.is_default) || (data||[]).find(i => i.name?.toLowerCase().includes('consult'))
        return [{
          service_item_id: consultItem?.id || 'custom-consultation',
          description: consultItem?.name || 'Consultation fee',
          category: consultItem?.category || 'custom',
          fee: parseFloat(consultItem?.default_price) || 0, qty: 1,
        }]
      })
    }
    loadCatalog()
  }, [])

  const invoiceTotal = lineItems.reduce((sum, i) => sum + (i.fee * i.qty), 0)

  function addLineItem(item) {
    setLineItems(prev => {
      const existing = prev.find(i => i.service_item_id === item.id)
      if (existing) return prev.map(i => i.service_item_id === item.id ? {...i, qty: i.qty + 1} : i)
      return [...prev, { service_item_id: item.id, description: item.name, description_tc: item.name_tc, category: item.category, fee: parseFloat(item.default_price) || 0, qty: 1 }]
    })
  }

  const [customItemName,setCustomItemName]=useState('')
  const [customItemPrice,setCustomItemPrice]=useState('')
  const customItemMatches = customItemName.trim()
    ? catalog.filter(i => i.name?.toLowerCase().includes(customItemName.trim().toLowerCase())).slice(0, 6)
    : []

  // The catalog is real but necessarily incomplete - a charge that isn't
  // in it (a one-off, a clinic-specific service not yet added) had no
  // way in at all before this.
  function addCustomLineItem() {
    if (!customItemName.trim()) return
    setLineItems(prev => [...prev, {
      service_item_id: `custom-${Date.now()}`, description: customItemName.trim(),
      category: 'custom', fee: parseFloat(customItemPrice) || 0, qty: 1,
    }])
    setCustomItemName(''); setCustomItemPrice('')
  }

  function updateLineItemQty(id, qty) {
    if (qty <= 0) { setLineItems(prev => prev.filter(i => i.service_item_id !== id)); return }
    setLineItems(prev => prev.map(i => i.service_item_id === id ? {...i, qty} : i))
  }

  function updateLineItemFee(id, fee) {
    setLineItems(prev => prev.map(i => i.service_item_id === id ? {...i, fee: parseFloat(fee) || 0} : i))
  }

  // Real query against the icd10_reference table - debounced so it doesn't
  // fire on every keystroke.
  useEffect(() => {
    if (!icd10Search.trim()) { setIcd10Results([]); return }
    setIcd10Loading(true)
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('icd10_reference').select('*')
        .or(`code.ilike.%${icd10Search}%,label.ilike.%${icd10Search}%`).limit(8)
      setIcd10Results(data||[])
      setIcd10Loading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [icd10Search])
  const [prescriptions,setPrescriptions]=useState([{drug:'',dosage:'',frequency:'',quantity:'',durationDays:'',timesPerDay:'',timesOfDay:[]}])

  // Real drug prices, from the same clinic_inventory list Inventory
  // manages stock against - so a prescribed drug's price can be looked
  // up by name instead of the doctor having to type it into billing
  // separately (or, in practice, never remembering to).
  const [drugPrices,setDrugPrices]=useState({}) // lowercased item_name -> price
  useEffect(() => {
    async function loadDrugPrices() {
      if (!institutionId) return
      const { data } = await supabase.from('clinic_inventory').select('item_name, price').eq('institution_id', institutionId)
      const map = {}
      ;(data||[]).forEach(r => { if (r.item_name && r.price != null) map[r.item_name.trim().toLowerCase()] = parseFloat(r.price) })
      setDrugPrices(map)
    }
    loadDrugPrices()
  }, [institutionId])

  // Auto-itemize prescribed drugs that have a known price - re-synced
  // whenever the prescriptions list changes, replacing only the
  // prescription-derived lines (category:'prescription') so it never
  // touches the consultation fee or anything the doctor added by hand.
  // Billed qty is the real total quantity being dispensed - the same
  // `quantity` field (auto-computed from days x times/day, or typed
  // directly) that medications.quantity is saved with and that stock
  // gets deducted by at dispense time - not a flat 1 regardless of how
  // much is actually being given.
  useEffect(() => {
    setLineItems(prev => {
      const withoutRx = prev.filter(i => i.category !== 'prescription')
      const seen = new Set()
      const rxItems = []
      for (const p of prescriptions) {
        const name = p.drug?.trim()
        if (!name || seen.has(name.toLowerCase())) continue
        const price = drugPrices[name.toLowerCase()]
        if (price == null) continue
        seen.add(name.toLowerCase())
        const qty = parseInt(p.quantity) || 1
        rxItems.push({ service_item_id: `rx-${name.toLowerCase()}`, description: name, category: 'prescription', fee: price, qty })
      }
      return [...withoutRx, ...rxItems]
    })
  }, [prescriptions, drugPrices])
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState(null)
  const [showReferral,setShowReferral]=useState(false)
  const [referralNote,setReferralNote]=useState('')
  const [referralSearch,setReferralSearch]=useState('')
  const [referralMatches,setReferralMatches]=useState([])
  const [referralMatched,setReferralMatched]=useState(null) // the selected real match, if any
  const [referralClinicName,setReferralClinicName]=useState('')
  const [referralClinicPhone,setReferralClinicPhone]=useState('')
  const [referralClinicEmail,setReferralClinicEmail]=useState('')
  const [referralSending,setReferralSending]=useState(false)
  const [referralSent,setReferralSent]=useState(false)
  const [referralDiagnosis,setReferralDiagnosis]=useState('')
  const [referralConsultationSummary,setReferralConsultationSummary]=useState('')

  // Real auto-match search - both real Medsa doctors and the directory
  // (non-Medsa doctors Medsa knows about for referral purposes). Debounced
  // so it doesn't fire on every keystroke.
  useEffect(() => {
    if (!referralSearch.trim()) { setReferralMatches([]); return }
    const timeout = setTimeout(async () => {
      const [medsaRes, dirRes] = await Promise.all([
        supabase.from('staff_credentials').select('id,full_name,department')
          .eq('role','doctor').eq('status','active').ilike('full_name', `%${referralSearch}%`).limit(5),
        supabase.from('directory_doctors').select('*, directory_clinics(*)')
          .ilike('full_name', `%${referralSearch}%`).limit(5),
      ])
      const medsaMatches = (medsaRes.data||[]).map(d => ({ source:'medsa', id:d.id, name:d.full_name, clinicLabel:d.department||'Medsa Clinic' }))
      const dirMatches = (dirRes.data||[]).map(d => ({ source:'directory', id:d.id, name:d.full_name, clinicLabel:d.directory_clinics?.name, phone:d.directory_clinics?.contact_phone, email:d.directory_clinics?.contact_email }))
      setReferralMatches([...medsaMatches, ...dirMatches])
    }, 300)
    return () => clearTimeout(timeout)
  }, [referralSearch])

  function handleSelectReferralMatch(m) {
    setReferralMatched(m)
    setReferralSearch(m.name)
    setReferralMatches([])
    setReferralClinicName(m.clinicLabel||'')
    setReferralClinicPhone(m.phone||'')
    setReferralClinicEmail(m.email||'')
  }

  async function handleSendReferral() {
    if (!referralSearch.trim() || !patient?.id) return
    setReferralSending(true)
    await supabase.from('referrals').insert({
      patient_id: patient.id, referring_staff: staffMember?.name, note: referralNote||null,
      diagnosis: referralDiagnosis||null, consultation_summary: referralConsultationSummary||null,
      to_doctor_name: referralSearch,
      to_clinic_name: referralClinicName||null, to_clinic_phone: referralClinicPhone||null, to_clinic_email: referralClinicEmail||null,
      matched_staff_credential_id: referralMatched?.source==='medsa' ? referralMatched.id : null,
      matched_directory_doctor_id: referralMatched?.source==='directory' ? referralMatched.id : null,
    })
    setReferralSending(false)
    setReferralSent(true)
  }
  const [drugInfoOpen,setDrugInfoOpen]=useState(null)
  const [drugInfoData,setDrugInfoData]=useState({}) // prescription index -> {loading, found, effects, intake, precautions, isDangerous}
  async function loadDrugInfo(i, drugName) {
    setDrugInfoData(prev=>({...prev,[i]:{loading:true}}))
    const { data } = await supabase.from('drug_reference').select('*')
      .eq('drug_name', drugName.trim()).eq('medicine_type', medicineType||'western').maybeSingle()
    setDrugInfoData(prev=>({...prev,[i]: data
      ? { loading:false, found:true, effects:data.effects, intake:data.intake_info, precautions:data.precautions, isDangerous:data.is_dangerous_drug }
      : { loading:false, found:false }
    }))
  }
  const [expandedRecord,setExpandedRecord]=useState(null)
  const [reportRequests,setReportRequests]=useState({})
  const [inventoryItems,setInventoryItems]=useState([])
  const [suggestOpen,setSuggestOpen]=useState(null)

  useEffect(() => {
    async function loadInventory() {
      const { data } = await supabase.from('clinic_inventory').select('item_name')
      setInventoryItems((data||[]).map(i=>i.item_name))
    }
    loadInventory()
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      if (!queueEntry?.patientMedsaId) { setLoading(false); return }
      const { data: p } = await supabase.from('patients').select('*').eq('medsa_id', queueEntry.patientMedsaId).maybeSingle()
      if (p) {
        setPatient(p)
        // Allergies and chronic conditions are never gated by consent -
        // these are exactly what an emergency card shows, and a doctor
        // needs to know about a dangerous allergy regardless of consent
        // window status. Real, live search against the shared patient
        // record every time - not a local copy stored in this clinic's
        // own data, so it always reflects the patient's actual, current
        // Medsa profile. Active medications loaded here too - this is
        // what the drug interaction engine checks new prescriptions
        // against.
        const [{data:c},{data:a},{data:m},{data:v}] = await Promise.all([
          supabase.from('conditions').select('*').eq('patient_id',p.id).eq('active',true),
          supabase.from('allergies').select('*').eq('patient_id',p.id),
          supabase.from('medications').select('*').eq('patient_id',p.id).eq('active',true),
          supabase.from('patient_vitals').select('*').eq('patient_id',p.id).order('logged_at',{ascending:false}).limit(1).maybeSingle(),
        ])
        setConditions(c||[]); setAllergies(a||[]); setActiveMedications(m||[])
        // Prefills the dose-safety weight field from the most recent
        // logged vitals (usually just taken at check-in) so the doctor
        // doesn't have to re-ask and re-type it.
        if (v?.weight_kg) setWeightKg(String(v.weight_kg))
        setLastVitals(v||null)

        // Full history (past visit records) is the part that's actually
        // gated - checks that real consent exists and that the current
        // time isn't before the window even starts (e.g. a doctor
        // shouldn't be able to open a patient's history days ahead of a
        // booking). The window's *end* only matters for how long access
        // stays open after check-in when no active, unsubmitted
        // consultation is happening - during an active one, access stays
        // open until actually submitted, not by a ticking clock, since
        // consultation length varies with patient volume.
        // The MOST RECENT intake row overall, not the most recent one
        // that happens to say consent_given:true - filtering to
        // consent_given:true first (the old query) meant a patient who
        // explicitly declined on their latest visit still had an older,
        // still-in-window "yes" row found and honoured instead, silently
        // ignoring their actual, more recent choice.
        const { data: intake } = await supabase.from('appointment_intake')
          .select('access_window_start, access_window_end, consent_given').eq('patient_id', p.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        const now = new Date()
        const pastStart = !!intake && intake.consent_given && now >= new Date(intake.access_window_start)
        setConsentWindow({ checked: true, allowed: pastStart })
        if (pastStart) {
          const { data: r } = await supabase.from('medical_records').select('*,institutions(name)').eq('patient_id',p.id).order('date_of_record',{ascending:false})
          setRecords(r||[])
        }
      }
      setLoading(false)
    }
    load()
  }, [queueEntry])

  function addPrescriptionLine() { setPrescriptions([...prescriptions, {drug:'',dosage:'',frequency:'',quantity:'',durationDays:'',timesPerDay:'',timesOfDay:[]}]) }
  function updateRx(i, field, value) {
    setPrescriptions(prescriptions.map((p,idx)=>{
      if (idx!==i) return p
      const updated = {...p,[field]:value}
      const mode = field==='dosingMode' ? value : (p.dosingMode||'fixed')

      // Auto-suggest quantity for fixed and interval modes, but never
      // override a quantity the doctor has manually typed in. PRN has no
      // fixed schedule, so it's never auto-calculated.
      if (mode==='fixed' && (field==='durationDays'||field==='timesPerDay') && !p.quantityManuallySet) {
        const days = parseInt(field==='durationDays'?value:updated.durationDays) || 0
        const times = parseInt(field==='timesPerDay'?value:updated.timesPerDay) || 0
        if (days>0 && times>0) updated.quantity = String(days*times)
      }
      if (mode==='interval' && (field==='durationDays'||field==='intervalHours') && !p.quantityManuallySet) {
        const days = parseInt(field==='durationDays'?value:updated.durationDays) || 0
        const hours = parseInt(field==='intervalHours'?value:updated.intervalHours) || 0
        if (days>0 && hours>0) updated.quantity = String(Math.round((24/hours)*days))
      }
      if (field==='quantity') updated.quantityManuallySet = true

      // Auto-compose the actual Frequency text (what shows up on the
      // label, receipt, and the patient's own medication list) from the
      // structured dosing controls below it - the doctor was picking a
      // real schedule there (times/day, every X hours, which times of
      // day) but none of it ever made it into the one field that's
      // actually shown anywhere; Frequency stayed whatever was typed by
      // hand, or blank. Never overrides a frequency the doctor has
      // deliberately typed themselves.
      if (field==='frequency') updated.frequencyManuallySet = true
      else if (!p.frequencyManuallySet && ['dosingMode','timesPerDay','intervalHours','durationDays','timesOfDay'].includes(field)) {
        updated.frequency = describeFrequency(updated)
      }
      return updated
    }))
  }

  const [draftSaved,setDraftSaved]=useState(false)
  const [savingDraft,setSavingDraft]=useState(false)

  // Saves current notes/diagnosis as a draft - stays on this screen so
  // the doctor can keep editing before finally submitting. This is what
  // replaces having a separate "prep notes" feature - the same
  // notes/diagnosis fields work for both prep and the final visit.
  async function handleSaveDraft() {
    if (!patient || (!diagnosis.trim() && !notes.trim())) return
    setSavingDraft(true)
    setError(null)
    try {
      const { error: recErr } = await supabase.from('medical_records').insert({
        patient_id: patient.id, record_type: 'visit', title: diagnosis || 'Draft consultation note',
        notes: notes || null, diagnosis: diagnosis || null, icd10_code: icd10Codes.length>0 ? icd10Codes.map(c=>c.code).join(', ') : null,
        date_of_record: new Date().toISOString().slice(0,10), source: 'clinic_ops', record_status: 'draft',
      })
      if (recErr) throw recErr
      setDraftSaved(true)
      setTimeout(()=>setDraftSaved(false), 2500)
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleSave() {
    // Real enforcement - a hard stop blocks saving entirely, no override
    // possible. A soft stop requires a logged reason before proceeding.
    const hardBlocked = Object.entries(safetyChecks).filter(([,c])=>c.status==='hard_stop_blocked')
    if (hardBlocked.length > 0) {
      setError('One or more prescriptions are blocked by a safety check. Remove them or choose an alternative before saving.')
      return
    }
    const unresolvedSoft = Object.entries(safetyChecks).filter(([idx,c])=>c.status==='soft_stop' && !overrideReasons[idx]?.trim())
    if (unresolvedSoft.length > 0) {
      setError('Enter a reason for each safety warning before saving.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const rxRows = prescriptions.filter(p=>p.drug.trim())
      let savedRecordId = null
      const submittedAt = new Date().toISOString()
      if ((diagnosis.trim()||notes.trim()||rxRows.length>0||lineItems.length>0) && patient) {
        const visitTitle = diagnosis || 'Clinic consultation'
        const visitDate = new Date().toISOString().slice(0,10)
        const { error: recErr } = await supabase.from('medical_records').insert({
          patient_id: patient.id, record_type: 'visit', title: visitTitle,
          notes: notes || null, diagnosis: diagnosis || null, icd10_code: icd10Codes.length>0 ? icd10Codes.map(c=>c.code).join(', ') : null,
          date_of_record: visitDate, source: 'clinic_ops', record_status: 'submitted',
          line_items: lineItems.length>0 ? lineItems : null, total_fee: invoiceTotal || null,
          doctor_name: staffMember?.name || 'Unknown',
          consultation_started_at: consultationStartedAt, submitted_at: submittedAt,
        })
        if (recErr) throw recErr
        // Separate, standard select rather than chaining .select() off
        // .insert() - same fix already applied elsewhere after that
        // pattern broke the CI test suite's mock client. Matches on
        // fields already confirmed set in this exact insert, rather than
        // relying on a created_at column I haven't verified exists here.
        const { data: recData } = await supabase.from('medical_records').select('id')
          .eq('patient_id', patient.id).eq('record_type', 'visit').eq('title', visitTitle).eq('date_of_record', visitDate)
          .order('date_of_record', { ascending: false }).limit(1).maybeSingle()
        savedRecordId = recData?.id || null
      }
      if (outsideReferralFile && savedRecordId && patient) {
        const path = `referral_letters/${patient.medsa_id}/${Date.now()}-${outsideReferralFile.name}`
        const { error: upErr } = await supabase.storage.from('external-clinic-uploads').upload(path, outsideReferralFile)
        if (!upErr) {
          await supabase.from('medical_record_attachments').insert({
            patient_id: patient.id, medical_record_id: savedRecordId, category: 'referral_letter',
            file_url: path, file_name: outsideReferralFile.name, verification_status: 'attached_by_treating_doctor',
          })
        }
      }
      // Real audit logging - every safety check that ran gets a
      // permanent record, regardless of outcome. Uses rx.drug directly
      // rather than assuming safetyChecks keys line up with rxRows
      // indices, since rxRows is filtered (drug.trim()) from the full
      // prescriptions array and the two could otherwise drift apart.
      for (const [idx, check] of Object.entries(safetyChecks)) {
        const rx = prescriptions[idx]
        if (!rx || !rx.drug.trim() || check.status === 'checking') continue
        await supabase.from('prescription_safety_checks').insert({
          medical_record_id: savedRecordId, patient_id: patient.id, drug_name: rx.drug,
          order_set_id: check.orderSet?.id || null,
          result: check.status === 'soft_stop' ? 'soft_stop_overridden' : check.status,
          triggered_conditions: check.triggered || [],
          override_reason: check.status === 'soft_stop' ? (overrideReasons[idx] || null) : null,
          checked_by: staffMember?.name || 'Unknown',
        })
      }
      if (rxRows.length>0 && patient) {
        // Guarantee a real Frequency ends up saved regardless of exactly
        // how the doctor got here - describeFrequency already keeps it in
        // sync live as the dosing controls are used, but this is the one
        // place that decides what actually reaches the database, so it's
        // also the right place to make sure a blank one never does: the
        // label, the receipt, and the patient's own medication list all
        // just read this stored value, with no fallback of their own.
        const dbRows = rxRows.map(p=>({
          patient_id: patient.id, medical_record_id: savedRecordId, medication_name: p.drug, dosage: p.dosage,
          frequency: p.frequency || describeFrequency(p) || null,
          medicine_type: medicineType||'western',
          quantity: parseInt(p.quantity)||1,
          duration_days: parseInt(p.durationDays)||null,
          times_per_day: parseInt(p.timesPerDay)||null,
          dosing_mode: p.dosingMode||'fixed',
          interval_hours: parseInt(p.intervalHours)||null,
          active: true, on_emergency_card: false, start_date: new Date().toISOString().slice(0,10),
          prescribed_by_staff: staffMember?.name || 'Unknown', dispense_status: 'pending',
          prescribed_submitted_at: submittedAt,
        }))
        const { error: insErr } = await supabase.from('medications').insert(dbRows)
        if (insErr) throw insErr
      }
      if (rxRows.length>0) {
        onPrescribed({
          patientName: queueEntry.patientName,
          doctorName: staffMember.name,
          drugs: rxRows,
          timestamp: Date.now(),
          status: 'pending',
        })
      }
      if (queueEntry?.id) {
        await supabase.from('clinic_queue').update({ status: 'done' }).eq('id', queueEntry.id)
      }
      // Mark the linked appointment finished too, not just the queue ticket -
      // the Schedule page reads appointments.status, and without this it had
      // no way to ever show a consultation as actually done.
      if (queueEntry?.appointmentId) {
        await supabase.from('appointments').update({ status: 'completed' }).eq('id', queueEntry.appointmentId)
      }
      setSaved(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Unified with the real, database-backed consent window (24h before +
  // after for booked appointments, 24h after only for walk-ins) rather
  // than the old, simpler local-only timer that only ever counted 24h
  // from check-in and never distinguished booked from walk-in at all -
  // having both active at once would let them silently disagree.
  const recordsVisible = consentWindow.checked && consentWindow.allowed

  if (saved) return (
    <PageWrap maxWidth={480}>
      <div style={{textAlign:'center',padding:'60px 20px'}}>
        <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Consultation saved</div>
        <div style={{fontSize:'13px',color:C.textSub}}>Notes and prescription synced to {queueEntry.patientName}'s Medsa record. Front desk has been notified to prepare the prescription.</div>
      </div>
    </PageWrap>
  )

  return (
    <PageWrap maxWidth={680}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'4px',textAlign:'center'}}>{queueEntry.patientName}</h2>
      <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',textAlign:'center'}}>{queueEntry.ticket} - checked in {new Date(queueEntry.checkedInAt).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}</div>

      {queueEntry.checkinNote&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:C.amber}}>{'◇'} Front desk note: {queueEntry.checkinNote}</div>}

      <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'16px'}}>
        <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,marginBottom:'6px',textTransform:'uppercase'}}>Weight / Height</div>
        {lastVitals&&(lastVitals.weight_kg||lastVitals.height_cm)&&<div style={{fontSize:'11px',color:C.textSub,marginBottom:'8px'}}>Last logged {new Date(lastVitals.logged_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}: {lastVitals.weight_kg?`${lastVitals.weight_kg}kg`:''}{lastVitals.height_cm?` ${lastVitals.height_cm}cm`:''}</div>}
        <div style={{display:'flex',gap:'6px'}}>
          <input type="number" step="0.1" value={weightKg} onChange={e=>setWeightKg(e.target.value)} placeholder="Weight (kg)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px',fontSize:'12px',boxSizing:'border-box'}}/>
          <input type="number" step="0.1" value={heightCm} onChange={e=>setHeightCm(e.target.value)} placeholder="Height (cm)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px',fontSize:'12px',boxSizing:'border-box'}}/>
          <button onClick={handleSaveVitalsHere} disabled={vitalsSaving||(!weightKg&&!heightCm)} style={{padding:'8px 12px',background:C.navy,color:'#fff',border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>{vitalsSaving?'Saving…':'Save'}</button>
        </div>
        {vitalsSaved&&<div style={{fontSize:'11px',color:C.green,marginTop:'6px'}}>{'✓'} Logged with today's date.</div>}
      </div>

      <SecLabel>Medical records{recordsVisible?' - full history open, closes on submit':''}</SecLabel>
      {loading&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'16px'}}>Loading...</div>}
      {!loading&&<div style={{display:'flex',gap:'16px',marginBottom:'20px'}}>
        <div style={{flex:1}}>
          {allergies.length>0&&<Card style={{padding:'12px 14px',marginBottom:'8px'}}>
            {allergies.map((a,i)=>(<div key={i} style={{fontSize:'12px',fontWeight:600,color:a.severity==='severe'?C.red:C.text,padding:'3px 0'}}>{'\u26a0'} {a.allergen}</div>))}
          </Card>}
          {conditions.length>0&&<Card style={{padding:'12px 14px'}}>
            {conditions.map((c,i)=>(<div key={i} style={{fontSize:'12px',padding:'3px 0'}}>{'\u25ce'} {c.condition_name}</div>))}
          </Card>}
        </div>
        <div style={{flex:2}}>
          {!recordsVisible&&<div style={{background:C.card,borderRadius:'10px',padding:'14px',fontSize:'12px',color:C.textMuted,textAlign:'center'}}>Full visit history not available yet for this check-in - reload and re-check-in the patient to resolve.</div>}
          {recordsVisible&&records.slice(0,5).map((r,i)=>{
            const isOpen = expandedRecord===i
            const requested = reportRequests[i]
            return (
              <Card key={i} style={{padding:'10px 14px',marginBottom:'6px'}}>
                <div onClick={()=>setExpandedRecord(isOpen?null:i)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
                  <div>
                    <div style={{fontSize:'12px',fontWeight:600}}>{r.title}</div>
                    <div style={{fontSize:'11px',color:C.textSub}}>{new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short'})} - {r.institutions?.name||'-'}</div>
                  </div>
                  <span style={{color:C.textMuted,fontSize:'12px'}}>{isOpen?'\u2212':'+'}</span>
                </div>
                {isOpen&&<div style={{marginTop:'10px',paddingTop:'10px',borderTop:`0.5px solid ${C.border}`}}>
                  {r.diagnosis&&<div style={{fontSize:'12px',marginBottom:'6px'}}><strong>Diagnosis:</strong> {r.diagnosis}</div>}
                  {r.notes&&<div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6,marginBottom:'10px'}}><strong style={{color:C.text}}>Report detail:</strong> {r.notes}</div>}
                  {!r.notes&&!r.diagnosis&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'10px'}}>No further detail on file for this record.</div>}
                  {!requested?<Btn style={{fontSize:'11px',padding:'6px 12px'}} onClick={async()=>{
                    const { error } = await supabase.from('record_access_requests').insert({
                      patient_id: patient.id, requesting_staff: staffMember?.name || 'Unknown',
                      requesting_clinic: r.institutions?.name || null,
                      reason: `Full detail requested for record: ${r.title || r.diagnosis || 'record'}`,
                    })
                    if (error) { alert(`Could not send request: ${error.message}`); return }
                    setReportRequests({...reportRequests,[i]:true})
                  }}>Request full/detailed report</Btn>
                    :<div style={{fontSize:'11px',color:C.amber}}>{'\u25c7'} Requested from {r.institutions?.name||'originating provider'} - patient will be notified to approve release of the complete report.</div>}
                </div>}
              </Card>
            )
          })}
        </div>
      </div>}

      <SecLabel>Diagnosis</SecLabel>
      <input value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} disabled={saved} placeholder="e.g. Upper respiratory tract infection" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'10px',background:saved?C.card:'#fff'}}/>

      {weightKg&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'14px'}}>Using weight {weightKg}kg (set in Weight / Height above) for dose-safety reference ranges below.</div>}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px',gap:'8px'}}>
        <div style={{fontSize:'11px',color:C.textMuted}}>ICD-10 codes - structured coding, required for direct-billing claims. A visit can have more than one.</div>
        <span onClick={diagnosis||notes?suggestIcd10:undefined} style={{fontSize:'11px',fontWeight:600,color:diagnosis||notes?C.green:C.textMuted,cursor:diagnosis||notes?'pointer':'not-allowed',whiteSpace:'nowrap',flexShrink:0}}>{icd10Suggesting?'Thinking…':'✨ Suggest codes'}</span>
      </div>
      {icd10SuggestError&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'8px',fontStyle:'italic'}}>{icd10SuggestError}</div>}
      {icd10Suggestions.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
        {icd10Suggestions.filter(s=>!icd10Codes.some(x=>x.code===s.code)).map(s=>(
          <div key={s.code} onClick={()=>{setIcd10Codes(prev=>[...prev,{code:s.code,label:s.label}]);setIcd10Suggestions(prev=>prev.filter(x=>x.code!==s.code))}} title={s.reasoning} style={{display:'flex',alignItems:'center',gap:'6px',background:C.blueLight||'#eef4ff',border:`0.5px dashed ${C.blue}`,borderRadius:'20px',padding:'6px 10px',cursor:'pointer'}}>
            <span style={{fontWeight:700,color:C.blue,fontSize:'12px'}}>{s.code}</span>
            <span style={{fontSize:'12px',color:C.textSub}}>{s.label}</span>
            <span style={{fontSize:'11px',color:C.blue}}>+ add</span>
          </div>
        ))}
      </div>}
      {icd10Codes.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
        {icd10Codes.map(c=>(
          <div key={c.code} style={{display:'flex',alignItems:'center',gap:'6px',background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'20px',padding:'6px 10px'}}>
            <span style={{fontWeight:700,color:C.green,fontSize:'12px'}}>{c.code}</span>
            <span style={{fontSize:'12px',color:C.textSub}}>{c.label}</span>
            <span onClick={()=>setIcd10Codes(prev=>prev.filter(x=>x.code!==c.code))} style={{fontSize:'12px',color:C.textMuted,cursor:'pointer'}}>✕</span>
          </div>
        ))}
      </div>}
      <div style={{position:'relative',marginBottom:'18px'}}>
        <input value={icd10Search} onChange={e=>{setIcd10Search(e.target.value);setIcd10Open(true)}} onFocus={()=>setIcd10Open(true)} placeholder="Search to add another ICD-10 code or condition…" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        {icd10Open&&icd10Search.trim()&&<div style={{position:'absolute',top:'100%',left:0,right:0,background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'8px',marginTop:'4px',maxHeight:220,overflowY:'auto',zIndex:20,boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
          {icd10Loading&&<div style={{padding:'10px 14px',fontSize:'12px',color:C.textMuted}}>Searching…</div>}
          {!icd10Loading&&icd10Results.filter(c=>!icd10Codes.some(x=>x.code===c.code)).map(c=>(
            <div key={c.code} onClick={()=>{setIcd10Codes(prev=>[...prev,c]);setIcd10Search('');setIcd10Open(false)}} style={{padding:'10px 14px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`,fontSize:'13px'}}>
              <span style={{fontWeight:700,color:C.green}}>{c.code}</span> {c.label}
            </div>
          ))}
          {!icd10Loading&&icd10Results.length===0&&
            <div style={{padding:'10px 14px',fontSize:'12px',color:C.textMuted}}>No match in the reference set - free-text diagnosis above still saves normally.</div>}
        </div>}
      </div>

      <SecLabel>Consultation notes</SecLabel>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} disabled={saved} rows={4} placeholder="Clinical findings, examination notes, follow-up plan..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'18px',fontFamily:'inherit',resize:'vertical',background:saved?C.card:'#fff'}}/>

      {!saved&&<>
        <SecLabel>Outside referral letter (optional)</SecLabel>
        <div style={{fontSize:'11px',color:C.textSub,marginBottom:'8px'}}>If this patient was referred in by a doctor outside Medsa, attach their letter here - it saves with this visit.</div>
        <input type="file" onChange={e=>setOutsideReferralFile(e.target.files[0]||null)} style={{marginBottom:'18px',fontSize:'12px'}}/>
      </>}

      <SecLabel>Itemized Treatment & Charges</SecLabel>
      <div style={{marginBottom:'10px'}}>
        {lineItems.map(item=>(
          <div key={item.service_item_id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 0',borderBottom:`0.5px solid ${C.border}`}}>
            <div style={{flex:1,fontSize:'13px'}}>{item.description}</div>
            <input type="number" min="1" value={item.qty} onChange={e=>updateLineItemQty(item.service_item_id, parseInt(e.target.value)||0)} style={{width:'44px',border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'6px',fontSize:'12px',textAlign:'center'}}/>
            <div style={{fontSize:'12px',color:C.textSub}}>x</div>
            <input type="number" step="0.01" value={item.fee} onChange={e=>updateLineItemFee(item.service_item_id, e.target.value)} style={{width:'68px',border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'6px',fontSize:'12px'}}/>
            <div onClick={()=>updateLineItemQty(item.service_item_id, 0)} style={{fontSize:'12px',color:C.textMuted,cursor:'pointer',padding:'0 4px'}}>{'\u2715'}</div>
          </div>
        ))}
        {lineItems.length>0&&<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontWeight:700,fontSize:'14px'}}><span>Total</span><span>HK${invoiceTotal.toFixed(2)}</span></div>}
        <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,marginBottom:'6px'}}>Add treatment or charge</div>
        <select value="" onChange={e=>{ const item = catalog.find(i=>i.id===e.target.value); if (item) addLineItem(item) }} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box',background:'#fff'}}>
          <option value="">{catalog.length===0?'No active items on the price list yet - use Price List to add some':`Select from price list (${catalog.length} items)...`}</option>
          {catalog.map(item=>(
            <option key={item.id} value={item.id}>{item.name} - HK${item.default_price}</option>
          ))}
        </select>
        <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'8px'}}>
          <div style={{padding:'10px 14px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Or type a charge not in the price list - matching items suggest as you type</div>
            <div style={{display:'flex',gap:'6px',position:'relative'}}>
              <input value={customItemName} onChange={e=>setCustomItemName(e.target.value)} placeholder="Description" style={{flex:2,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'7px 8px',fontSize:'12px',boxSizing:'border-box'}}/>
              <input type="number" step="0.01" value={customItemPrice} onChange={e=>setCustomItemPrice(e.target.value)} placeholder="HK$" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'7px 8px',fontSize:'12px',boxSizing:'border-box'}}/>
              <button onClick={addCustomLineItem} disabled={!customItemName.trim()} style={{padding:'7px 12px',background:C.green,color:'#fff',border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Add</button>
            </div>
            {customItemMatches.length>0&&<div style={{marginTop:'6px',background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:'6px',overflow:'hidden'}}>
              {customItemMatches.map(m=>(
                <div key={m.id} onClick={()=>{addLineItem(m);setCustomItemName('');setCustomItemPrice('')}} style={{padding:'8px 10px',fontSize:'12px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
                  <span>{m.name}</span><span style={{color:C.textSub}}>HK${m.default_price}</span>
                </div>
              ))}
            </div>}
          </div>
        </div>
      </div>
      <SecLabel>Prescription</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'10px'}}>
        {prescriptions.map((rx,i)=>{
          const matches = rx.drug.trim() ? inventoryItems.filter(n=>n.toLowerCase().includes(rx.drug.toLowerCase()) && n.toLowerCase()!==rx.drug.toLowerCase()) : []
          return (
          <div key={i} style={{position:'relative'}}>
            <div style={{display:'flex',gap:'8px'}}>
              <div style={{flex:2,position:'relative'}}>
                <input
                  value={rx.drug}
                  onChange={e=>{updateRx(i,'drug',e.target.value);setSuggestOpen(i)}}
                  onFocus={()=>setSuggestOpen(i)}
                  onBlur={()=>{setTimeout(()=>setSuggestOpen(null),150);checkDrugSafety(i,rx.drug)}}
                  placeholder="Drug name"
                  style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}
                />
                {suggestOpen===i&&matches.length>0&&<div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:'8px',marginTop:'4px',zIndex:20,boxShadow:'0 4px 12px rgba(0,0,0,0.1)',maxHeight:150,overflowY:'auto'}}>
                  {matches.slice(0,5).map((m,mi)=>(
                    <div key={mi} onMouseDown={()=>{updateRx(i,'drug',m);setSuggestOpen(null)}} style={{padding:'8px 12px',fontSize:'12px',cursor:'pointer',borderBottom:mi<matches.length-1?`0.5px solid ${C.border}`:'none'}}>{m}</div>
                  ))}
                </div>}
              </div>
              <input value={rx.dosage} onChange={e=>updateRx(i,'dosage',e.target.value)} placeholder="Dosage" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
              <input value={rx.frequency} onChange={e=>updateRx(i,'frequency',e.target.value)} placeholder="Frequency" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
              {rx.drug.trim()&&<Btn style={{fontSize:'11px',padding:'8px 10px',flexShrink:0}} onClick={()=>{
                const opening = drugInfoOpen!==i
                setDrugInfoOpen(opening?i:null)
                if (opening) loadDrugInfo(i, rx.drug)
              }}>Info</Btn>}
            </div>
            {/* Direct confirmation that this exact drug name matched a
                priced inventory item and was added to the bill below -
                without this, whether the auto-itemize actually fired was
                invisible unless you scrolled up to the bill yourself. */}
            {rx.drug.trim()&&(drugPrices[rx.drug.trim().toLowerCase()]!=null
              ? (()=>{ const unitPrice = drugPrices[rx.drug.trim().toLowerCase()]; const qty = parseInt(rx.quantity)||1
                return <div style={{fontSize:'11px',color:C.green,marginTop:'4px'}}>{'✓'} HK${(unitPrice*qty).toFixed(2)} added to bill ({qty} x HK${unitPrice.toFixed(2)} - matched "{rx.drug.trim()}" in inventory{!rx.quantity&&', set days/times per day or quantity above for the real total'})</div> })()
              : <div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>No priced inventory item matches "{rx.drug.trim()}" - pick a suggestion above, or add a price for it in Inventory {'→'} Stock, to have it auto-added to the bill.</div>)}

            {safetyChecks[i]&&safetyChecks[i].status==='checking'&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'6px'}}>Checking safety data...</div>}
            {safetyChecks[i]&&safetyChecks[i].status==='no_data_on_file'&&<div style={{fontSize:'11px',color:C.amber,marginTop:'6px'}}>{'\u26a0'} No safety data on file for this drug (no local order set, no standardized code for external lookup) - prescribing as usual, nothing blocked.</div>}
            {safetyChecks[i]&&safetyChecks[i].status==='passed'&&<div style={{fontSize:'11px',color:C.green,marginTop:'6px'}}>
              {'\u2713'} {safetyChecks[i].orderSet ? `Checked against ${safetyChecks[i].orderSet.approved_by}'s order set` : 'Checked against external safety database'} - no concerns flagged.
              {safetyChecks[i].orderSet&&(safetyChecks[i].orderSet.min_dose_per_kg||safetyChecks[i].orderSet.max_dose_per_kg)&&<div style={{color:C.textMuted}}>
                {weightKg&&!isNaN(parseFloat(weightKg))
                  ? `Safe range for ${weightKg}kg: ${safetyChecks[i].orderSet.min_dose_per_kg?(safetyChecks[i].orderSet.min_dose_per_kg*parseFloat(weightKg)).toFixed(1):'?'}–${safetyChecks[i].orderSet.max_dose_per_kg?(safetyChecks[i].orderSet.max_dose_per_kg*parseFloat(weightKg)).toFixed(1):'?'} ${safetyChecks[i].orderSet.dose_unit} total - verify your prescribed dose against this.`
                  : `Reference range: ${safetyChecks[i].orderSet.min_dose_per_kg||'?'}–${safetyChecks[i].orderSet.max_dose_per_kg||'?'} ${safetyChecks[i].orderSet.dose_unit}/kg - enter weight above to calculate this patient's exact safe range.`}
              </div>}
              {safetyChecks[i].orderSet?.renal_adjustment_notes&&<div style={{color:C.textMuted}}>Renal: {safetyChecks[i].orderSet.renal_adjustment_notes}</div>}
            </div>}
            {safetyChecks[i]&&safetyChecks[i].status==='hard_stop_blocked'&&<div style={{background:C.redLight,border:`1px solid ${C.red}`,borderRadius:'8px',padding:'10px 12px',marginTop:'6px'}}>
              <div style={{fontSize:'12px',fontWeight:600,color:C.red}}>{'\u26d4'} Blocked - do not prescribe</div>
              <div style={{fontSize:'11px',color:C.red}}>{safetyChecks[i].triggered.join(', ')} - flagged by {safetyChecks[i].orderSet?.approved_by ? `${safetyChecks[i].orderSet.approved_by}'s order set` : 'external safety check'}. Remove this item or choose an alternative.</div>
            </div>}
            {safetyChecks[i]&&safetyChecks[i].status==='soft_stop'&&<div style={{background:C.amberLight,border:`1px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',marginTop:'6px'}}>
              <div style={{fontSize:'12px',fontWeight:600,color:C.amber}}>{'\u26a0'} Warning: {safetyChecks[i].triggered.join(', ')}</div>
              <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>Flagged by {safetyChecks[i].orderSet?.approved_by ? `${safetyChecks[i].orderSet.approved_by}'s order set` : 'external safety check'}. Enter a reason to proceed anyway.</div>
              <input value={overrideReasons[i]||''} onChange={e=>setOverrideReasons({...overrideReasons,[i]:e.target.value})} placeholder="Reason for prescribing despite warning" style={{width:'100%',border:`0.5px solid ${C.amber}`,borderRadius:'6px',padding:'7px 10px',fontSize:'12px',boxSizing:'border-box'}}/>
            </div>}

            {/* Doctor-friendly dosing control - three common HK prescribing patterns */}
            <div style={{marginTop:'6px',background:C.card,borderRadius:'8px',padding:'8px 10px'}}>
              <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
                {[['fixed','Fixed times/day'],['interval','Every X hours'],['prn','PRN (as needed)']].map(([k,l])=>(
                  <div key={k} onClick={()=>updateRx(i,'dosingMode',k)} style={{fontSize:'11px',padding:'5px 9px',borderRadius:'6px',cursor:'pointer',background:(rx.dosingMode||'fixed')===k?C.green:'#fff',color:(rx.dosingMode||'fixed')===k?'#fff':C.textSub,border:`0.5px solid ${C.border}`}}>{l}</div>
                ))}
              </div>

              {(rx.dosingMode||'fixed')==='fixed'&&<div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>Times/day</span>
                <div style={{display:'flex',gap:'4px'}}>
                  {[1,2,3,4].map(n=>(
                    <div key={n} onClick={()=>updateRx(i,'timesPerDay',String(n))} style={{width:26,height:26,borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',cursor:'pointer',background:String(rx.timesPerDay)===String(n)?C.green:'#fff',color:String(rx.timesPerDay)===String(n)?'#fff':C.text,border:`0.5px solid ${C.border}`}}>{n}</div>
                  ))}
                </div>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0,marginLeft:'8px'}}>for</span>
                <input value={rx.durationDays} onChange={e=>updateRx(i,'durationDays',e.target.value)} type="number" placeholder="days" style={{width:56,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'5px 8px',fontSize:'12px',boxSizing:'border-box'}}/>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>days</span>
              </div>}

              {/* Optional - a plain times/day count doesn't say WHEN, and
                  "one in the morning, one at night" reads very
                  differently from "one at noon and one at midnight" even
                  though both are twice daily. Purely additive to
                  Frequency, never required. */}
              {(rx.dosingMode||'fixed')==='fixed'&&parseInt(rx.timesPerDay)>0&&<div style={{display:'flex',gap:'6px',alignItems:'center',marginTop:'6px',flexWrap:'wrap'}}>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>Take at</span>
                {['Morning','Afternoon','Evening','Night'].map(t=>{
                  const active = (rx.timesOfDay||[]).includes(t)
                  return <div key={t} onClick={()=>{
                    const cur = rx.timesOfDay||[]
                    updateRx(i,'timesOfDay', active ? cur.filter(x=>x!==t) : [...cur,t])
                  }} style={{fontSize:'11px',padding:'4px 9px',borderRadius:'6px',cursor:'pointer',background:active?C.green:'#fff',color:active?'#fff':C.textSub,border:`0.5px solid ${C.border}`}}>{t}</div>
                })}
              </div>}

              {rx.dosingMode==='interval'&&<div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>Every</span>
                <div style={{display:'flex',gap:'4px'}}>
                  {[4,6,8,12].map(h=>(
                    <div key={h} onClick={()=>updateRx(i,'intervalHours',String(h))} style={{padding:'5px 9px',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',cursor:'pointer',background:String(rx.intervalHours)===String(h)?C.green:'#fff',color:String(rx.intervalHours)===String(h)?'#fff':C.text,border:`0.5px solid ${C.border}`}}>{h}h</div>
                  ))}
                </div>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0,marginLeft:'8px'}}>for</span>
                <input value={rx.durationDays} onChange={e=>updateRx(i,'durationDays',e.target.value)} type="number" placeholder="days" style={{width:56,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'5px 8px',fontSize:'12px',boxSizing:'border-box'}}/>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>days</span>
              </div>}

              {rx.dosingMode==='prn'&&<div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <span style={{fontSize:'11px',color:C.textSub}}>Take as needed - specify max per day and any minimum gap in the Frequency field above (e.g. "1 lozenge as needed, max 8/day, at least 2 hours apart").</span>
              </div>}

              <div style={{display:'flex',alignItems:'center',marginTop:'8px',paddingTop:'8px',borderTop:`0.5px solid ${C.border}`}}>
                <span style={{fontSize:'11px',color:C.textSub,flexShrink:0}}>Qty to dispense</span>
                <div style={{flex:1}}/>
                <input value={rx.quantity} onChange={e=>updateRx(i,'quantity',e.target.value)} placeholder="0" type="number" style={{width:56,flexShrink:0,border:`0.5px solid ${rx.quantity&&!rx.quantityManuallySet?C.green:C.border}`,borderRadius:'6px',padding:'5px 8px',fontSize:'12px',boxSizing:'border-box'}}/>
                {rx.quantity&&!rx.quantityManuallySet&&<span style={{fontSize:'10px',color:C.green,marginLeft:'4px'}}>auto</span>}
              </div>
            </div>

            {drugInfoOpen===i&&<div style={{marginTop:'6px',background:C.blueLight,borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:C.text,lineHeight:1.6}}>
              <strong>{rx.drug} - drug information</strong>
              {drugInfoData[i]?.loading&&<div style={{color:C.textMuted,marginTop:'4px'}}>Checking drug library...</div>}
              {!drugInfoData[i]?.loading&&drugInfoData[i]?.found&&<>
                {drugInfoData[i].isDangerous&&<div style={{color:C.red,fontWeight:600,marginTop:'6px'}}>{'⚠'} Dangerous Drugs Ordinance - statutory tracking required</div>}
                <div style={{marginTop:'6px'}}><strong>Effects:</strong> {drugInfoData[i].effects||'-'}</div>
                <div style={{marginTop:'4px'}}><strong>Intake:</strong> {drugInfoData[i].intake||'-'}</div>
                <div style={{marginTop:'4px',color:C.red}}><strong>Precautions:</strong> {drugInfoData[i].precautions||'-'}</div>
              </>}
              {!drugInfoData[i]?.loading&&drugInfoData[i]?.found===false&&<div style={{color:C.textMuted,marginTop:'4px'}}>No reference on file yet for "{rx.drug}" - front desk can add effects, intake instructions, and precautions when dispensing this prescription, and it'll show here automatically from then on.</div>}
            </div>}
          </div>
          )
        })}
      </div>
      <Btn style={{marginBottom:'20px'}} onClick={addPrescriptionLine}>+ Add drug</Btn>

      {prescriptions.some(p=>p.drug.trim())&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 14px',fontSize:'12px',color:C.amber,marginBottom:'20px'}}>
        {'\u25c7'} Saving will notify front desk immediately to prepare and label this prescription. Quantity dispensed will auto-deduct from inventory once confirmed.
      </div>}

      <SecLabel>Refer to another doctor</SecLabel>
      {!showReferral&&<Btn style={{marginBottom:'20px'}} onClick={()=>setShowReferral(true)}>+ Refer this patient</Btn>}
      {showReferral&&!referralSent&&<Card style={{padding:'16px',marginBottom:'20px'}}>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>Attach a case note. Search for the receiving doctor - matches from Medsa or the directory auto-fill clinic info; if nothing matches, fill in manually.</div>
        <input value={referralDiagnosis} onChange={e=>setReferralDiagnosis(e.target.value)} placeholder="Diagnosis" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px'}}/>
        <textarea value={referralConsultationSummary} onChange={e=>setReferralConsultationSummary(e.target.value)} rows={3} placeholder="Consultation summary - findings, tests done, treatment so far..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'10px',fontFamily:'inherit',resize:'vertical'}}/>
        <textarea value={referralNote} onChange={e=>setReferralNote(e.target.value)} rows={2} placeholder="Any additional note for the receiving doctor..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'10px',fontFamily:'inherit',resize:'vertical'}}/>
        <div style={{position:'relative',marginBottom:'10px'}}>
          <input value={referralSearch} onChange={e=>{setReferralSearch(e.target.value);setReferralMatched(null)}} placeholder="Doctor name..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          {referralMatches.length>0&&<div style={{position:'absolute',top:'100%',left:0,right:0,background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'8px',marginTop:'4px',zIndex:20,boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
            {referralMatches.map(m=>(
              <div key={m.source+m.id} onClick={()=>handleSelectReferralMatch(m)} style={{padding:'10px 12px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`,fontSize:'13px'}}>
                <div style={{fontWeight:600}}>{m.name}</div>
                <div style={{fontSize:'11px',color:C.textMuted}}>{m.clinicLabel||'—'} {m.source==='medsa'?'· Medsa':'· Directory'}</div>
              </div>
            ))}
          </div>}
        </div>
        {referralMatched&&<div style={{fontSize:'11px',color:C.green,marginBottom:'10px'}}>{'\u2713'} Matched - clinic info auto-filled below</div>}
        <input value={referralClinicName} onChange={e=>setReferralClinicName(e.target.value)} placeholder="Clinic name" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px'}}/>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          <input value={referralClinicPhone} onChange={e=>setReferralClinicPhone(e.target.value)} placeholder="Clinic phone" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          <input value={referralClinicEmail} onChange={e=>setReferralClinicEmail(e.target.value)} placeholder="Clinic email" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <Btn onClick={()=>{setShowReferral(false);setReferralNote('');setReferralSearch('');setReferralMatched(null);setReferralClinicName('');setReferralClinicPhone('');setReferralClinicEmail('');setReferralDiagnosis('');setReferralConsultationSummary('')}}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSendReferral} disabled={referralSending||!referralSearch.trim()}>{referralSending?'Sending…':'Send referral'}</Btn>
        </div>
      </Card>}
      {referralSent&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'12px 14px',fontSize:'12px',color:C.green,marginBottom:'20px'}}>
        {'\u2713'} Referral logged for {referralSearch}{referralClinicName?` at ${referralClinicName}`:''}. {referralMatched?.source==='medsa'?"The receiving doctor will see this patient's consented records once they accept.":'Contact the clinic directly using the details provided, since this referral is outside Medsa.'}
      </div>}

      {error&&<div style={{fontSize:'13px',color:C.red,marginBottom:'12px'}}>{error}</div>}
      {draftSaved&&<div style={{fontSize:'13px',color:C.green,marginBottom:'12px'}}>✓ Draft saved - keep editing, or submit when ready</div>}
      <div style={{display:'flex',gap:'8px'}}>
        <Btn style={{flex:1}} onClick={handleSaveDraft} disabled={savingDraft||saving||saved}>{savingDraft?'Saving…':'Save'}</Btn>
        <Btn variant="primary" style={{flex:1}} onClick={handleSave} disabled={saving||savingDraft||saved}>{saved?'Submitted':saving?'Submitting...':'Submit'}</Btn>
      </div>
    </PageWrap>
  )
}

// ── LABEL STICKER — one editable sticker per drug in a prescription ─────────
// Pulls effects/intake/precautions from the drug_reference library if a
// previous nurse/doctor already filled them in for this drug. If not, the
// fields are empty and editable — saving here writes back to the shared
// reference so it auto-populates next time this same drug is prescribed.
function LabelSticker({ patientName, doctorName, drug, onFieldsChange, medicineType, institutionName }) {
  const [effects,setEffects]=useState('')
  const [intake,setIntake]=useState('')
  const [precautions,setPrecautions]=useState('')
  const [loading,setLoading]=useState(true)
  const [hasReference,setHasReference]=useState(false)
  const [isDangerousDrug,setIsDangerousDrug]=useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('drug_reference').select('*').eq('drug_name', drug.drug).eq('medicine_type', medicineType||'western').maybeSingle()
      if (data) {
        setEffects(data.effects||''); setIntake(data.intake_info||''); setPrecautions(data.precautions||'')
        setHasReference(true)
        setIsDangerousDrug(!!data.is_dangerous_drug)
      }
      setLoading(false)
    }
    load()
  }, [drug.drug, medicineType])

  useEffect(() => {
    onFieldsChange({ effects, intake, precautions })
  }, [effects, intake, precautions])

  return (
    <div style={{background:'#fff',border:`1.5px dashed ${C.border}`,borderRadius:'10px',padding:'14px',marginBottom:'10px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
        <div>
          <div style={{fontSize:'10px',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.5px'}}>{institutionName || 'Medsa Clinic'}</div>
          <div style={{fontSize:'14px',fontWeight:700}}>{drug.drug} {drug.dosage}</div>
          <div style={{fontSize:'12px',color:C.textSub}}>{patientName} - Prescribed by {doctorName}</div>
          <div style={{fontSize:'11px',color:C.textMuted}}>{new Date().toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
        </div>
        {hasReference&&!loading&&<Badge text="From library" type="ok"/>}
      </div>
      {isDangerousDrug&&<div style={{background:C.redLight,border:`1px solid ${C.red}`,borderRadius:'6px',padding:'6px 10px',marginBottom:'10px',fontSize:'11px',fontWeight:600,color:C.red}}>{'\u26a0'} Dangerous Drugs Ordinance - statutory tracking required</div>}
      <div style={{fontSize:'11px',color:C.textSub,marginBottom:'10px'}}>
        {drug.frequency||'-'} {drug.durationDays&&`for ${drug.durationDays} days`} {drug.quantity&&`(${drug.quantity} total)`}
      </div>
      {loading?<div style={{fontSize:'11px',color:C.textMuted}}>Checking drug library...</div>:<>
        <div style={{marginBottom:'8px'}}>
          <div style={{fontSize:'10px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'3px'}}>Effects</div>
          <textarea value={effects} onChange={e=>setEffects(e.target.value)} rows={2} placeholder="What this drug does..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'6px 8px',fontSize:'12px',boxSizing:'border-box',fontFamily:'inherit',resize:'vertical'}}/>
        </div>
        <div style={{marginBottom:'8px'}}>
          <div style={{fontSize:'10px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'3px'}}>Intake instructions</div>
          <textarea value={intake} onChange={e=>setIntake(e.target.value)} rows={2} placeholder="How and when to take it..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'6px 8px',fontSize:'12px',boxSizing:'border-box',fontFamily:'inherit',resize:'vertical'}}/>
        </div>
        <div>
          <div style={{fontSize:'10px',fontWeight:600,color:C.red,textTransform:'uppercase',marginBottom:'3px'}}>Precautions & side effects</div>
          <textarea value={precautions} onChange={e=>setPrecautions(e.target.value)} rows={2} placeholder="Warnings, side effects, interactions..." style={{width:'100%',border:`0.5px solid ${C.red}`,borderRadius:'6px',padding:'6px 8px',fontSize:'12px',boxSizing:'border-box',fontFamily:'inherit',resize:'vertical'}}/>
        </div>
      </>}
    </div>
  )
}

function PrescriptionsQueueScreen({ pending, onConfirm, medicineType, onReload, onProceedToBilling, institutionName }) {
  const [printingId,setPrintingId]=useState(null)
  const [openLabelId,setOpenLabelId]=useState(null)
  const [editedFields,setEditedFields]=useState({}) // drugIndex -> {effects,intake,precautions}
  const [inventoryWarning,setInventoryWarning]=useState(null)
  const [expandedRundownId,setExpandedRundownId]=useState(null)
  const [addItemOpenId,setAddItemOpenId]=useState(null)
  const [catalog,setCatalog]=useState([])

  // Real service catalog - same source ConsultationScreen picks from, so
  // front desk adding something (e.g. a sick-leave note the patient asks
  // for at checkout) uses the identical list, not a separate one.
  useEffect(() => {
    async function loadCatalog() {
      const { data } = await supabase.from('service_items').select('*').eq('active', true).order('category')
      setCatalog(data || [])
    }
    loadCatalog()
  }, [])

  // Writes directly to the real, already-saved consultation record - this
  // is front desk adding to something the doctor already submitted, not
  // building a fresh local list the way ConsultationScreen does.
  async function addItemToRecord(p, item) {
    const newLineItems = [...(p.lineItems||[]), { service_item_id: item.id, description: item.name, category: item.category, fee: parseFloat(item.default_price)||0, qty: 1 }]
    const newTotal = newLineItems.reduce((sum,i)=>sum+(i.fee*i.qty),0)
    await supabase.from('medical_records').update({ line_items: newLineItems, total_fee: newTotal }).eq('id', p.recordId)
    setAddItemOpenId(null)
    await onReload()
  }

  async function handleConfirm(p) {
    setPrintingId(p.id)
    setInventoryWarning(null)
    // Save/update the drug reference library with whatever is currently in
    // each label's fields - this is what makes it "automated" next time.
    // Scoped by medicine_type so Western and Chinese medicine formularies
    // never mix, matching HK's two separate regulatory systems.
    for (let idx=0; idx<p.drugs.length; idx++) {
      const drug = p.drugs[idx]
      const fields = editedFields[idx]
      if (fields && (fields.effects||fields.intake||fields.precautions)) {
        await supabase.from('drug_reference').upsert({
          drug_name: drug.drug, medicine_type: medicineType||'western', effects: fields.effects, intake_info: fields.intake,
          precautions: fields.precautions, updated_by: p.doctorName, updated_at: new Date().toISOString(),
        }, { onConflict: 'drug_name,medicine_type' })
      }
    }
    const warnings = await onConfirm(p)
    setTimeout(()=>{
      setPrintingId(null); setOpenLabelId(null); setEditedFields({})
      if (warnings && warnings.length>0) setInventoryWarning(`No inventory match found for: ${warnings.join(', ')} - stock was not deducted. Add these to Inventory or check the spelling matches.`)
    }, 900)
  }

  const waiting = pending.filter(p=>p.status==='pending')
  const done = pending.filter(p=>p.status==='printed')

  // Real dispensing history export - queries the actual dispensed_by/
  // dispensed_at fields on medications, not just what's currently pending
  // in this session's queue.
  const [exporting,setExporting]=useState(false)
  const [exportMsg,setExportMsg]=useState(null)
  async function handleExportMedicationLog() {
    setExporting(true)
    const { data } = await supabase.from('medications').select('medication_name,dosage,dispensed_by,dispensed_at,patient_id,patients(full_name)')
      .eq('institution_source','clinic_ops').not('dispensed_at','is',null).order('dispensed_at',{ascending:false})
    const rows = [['Patient','Medication','Dosage','Dispensed By','Dispensed At']]
    ;(data||[]).forEach(m => rows.push([m.patients?.full_name||'Unknown', m.medication_name||'', m.dosage||'', m.dispensed_by||'', m.dispensed_at?new Date(m.dispensed_at).toLocaleString('en-HK'):'']))
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Medication-Log-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    setExporting(false)
    setExportMsg(`Downloaded ${(data||[]).length} records`)
    setTimeout(()=>setExportMsg(null), 3000)
  }

  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Prescriptions</h2>
      <div style={{textAlign:'center',marginBottom:'16px'}}>
        {exportMsg&&<div style={{fontSize:'12px',color:C.green,marginBottom:'8px'}}>{'\u2713'} {exportMsg}</div>}
        <button onClick={handleExportMedicationLog} disabled={exporting} style={{padding:'8px 16px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{exporting?'Preparing…':'Export medication log (CSV)'}</button>
      </div>
      {inventoryWarning&&<div style={{background:C.redLight,border:`0.5px solid ${C.red}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:C.red}}>{'\u26a0'} {inventoryWarning}</div>}

      {waiting.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px',marginBottom:'20px'}}>No pending prescriptions right now.</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'28px'}}>
        {waiting.map(p=>{
          const isOpen = openLabelId===p.id
          const isRundownOpen = expandedRundownId===p.id
          return (
          <Card key={p.id} style={{padding:'16px 18px',border:`1.5px solid ${C.amber}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:700}}>{p.patientName}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>Prescribed by {p.doctorName} - {new Date(p.timestamp).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <Badge text="New" type="due"/>
            </div>

            <div onClick={()=>setExpandedRundownId(isRundownOpen?null:p.id)} style={{fontSize:'11px',color:C.green,cursor:'pointer',marginBottom:'10px'}}>
              {isRundownOpen?'Hide consultation rundown':'View full consultation rundown'}
            </div>
            {isRundownOpen&&<div style={{background:C.card,borderRadius:'8px',padding:'12px',marginBottom:'12px'}}>
              {p.diagnosis&&<div style={{fontSize:'12px',marginBottom:'6px'}}><span style={{color:C.textMuted}}>Diagnosis: </span>{p.diagnosis}{p.icd10Code&&<span style={{color:C.textMuted}}> ({p.icd10Code})</span>}</div>}
              {p.notes&&<div style={{fontSize:'12px',marginBottom:'8px'}}><span style={{color:C.textMuted}}>Notes: </span>{p.notes}</div>}
              <div style={{fontSize:'10px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>Itemized charges</div>
              {(p.lineItems||[]).map((item,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'12px',padding:'3px 0'}}>
                  <span>{item.description} {item.qty>1&&`x${item.qty}`}</span><span>HK${(item.fee*item.qty).toFixed(2)}</span>
                </div>
              ))}
              {(!p.lineItems||p.lineItems.length===0)&&<div style={{fontSize:'12px',color:C.textMuted}}>No itemized charges yet.</div>}
              <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:'13px',padding:'6px 0',borderTop:`0.5px solid ${C.border}`,marginTop:'4px'}}><span>Total</span><span>HK${(p.totalFee||0).toFixed(2)}</span></div>
              <div onClick={()=>setAddItemOpenId(addItemOpenId===p.id?null:p.id)} style={{fontSize:'11px',color:C.green,cursor:'pointer',marginTop:'8px'}}>{'+'} Add item (e.g. sick leave note)</div>
              {addItemOpenId===p.id&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'8px',maxHeight:180,overflowY:'auto',marginTop:'6px'}}>
                {catalog.map(item=>(
                  <div key={item.id} onClick={()=>addItemToRecord(p,item)} style={{padding:'8px 12px',fontSize:'12px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
                    <span>{item.name}</span><span style={{color:C.textSub}}>HK${item.default_price}</span>
                  </div>
                ))}
              </div>}
            </div>}
            <div onClick={()=>setOpenLabelId(isOpen?null:p.id)} style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'12px',cursor:'pointer'}}>
              {p.drugs.map((d,i)=>(<div key={i} style={{fontSize:'13px',padding:'3px 0'}}>{d.drug} {d.dosage&&('- '+d.dosage)} {d.frequency&&('- '+d.frequency)}</div>))}
              <div style={{fontSize:'11px',color:C.green,marginTop:'4px'}}>{isOpen?'Hide label sticker preview':'Tap to review & edit label stickers'}</div>
            </div>

            {isOpen&&<div style={{marginBottom:'12px'}}>
              {p.drugs.map((drug,idx)=>(
                <LabelSticker
                  key={idx}
                  patientName={p.patientName}
                  doctorName={p.doctorName}
                  drug={drug}
                  medicineType={medicineType}
                  institutionName={institutionName}
                  onFieldsChange={(fields)=>setEditedFields(prev=>({...prev,[idx]:fields}))}
                />
              ))}
            </div>}

            <Btn variant="primary" style={{width:'100%'}} onClick={()=>handleConfirm(p)} disabled={printingId===p.id}>
              {printingId===p.id?'Printing labels...':'Confirm & print labels'}
            </Btn>
          </Card>
          )
        })}
      </div>
      {done.length>0&&<>
        <SecLabel>Printed today</SecLabel>
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {done.map(p=>(
            <Card key={p.id} style={{padding:'12px 16px',opacity:0.85}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:p.dispensedBy?'4px':'0'}}>
                <div><div style={{fontSize:'13px',fontWeight:500}}>{p.patientName}</div><div style={{fontSize:'11px',color:C.textSub}}>{p.doctorName}</div></div>
                <Badge text="Printed" type="ok"/>
              </div>
              {p.dispensedBy&&<div style={{fontSize:'10px',color:C.textMuted}}>Confirmed by {p.dispensedBy} at {new Date(p.dispensedAt).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}</div>}
              <Btn variant="primary" style={{width:'100%',marginTop:'10px'}} onClick={()=>onProceedToBilling(p)}>
                Proceed to billing (HK${(p.totalFee||0).toFixed(2)})
              </Btn>
            </Card>
          ))}
        </div>
      </>}
    </PageWrap>
  )
}

// A clinic running just one line never has to touch this - check-in and
// the Overview board silently fall back to a single shared queue when
// nothing's configured here. Only needed once a clinic wants more than
// one line at once (e.g. General vs Chinese Medicine, or a dedicated
// dressing/injection queue).
function QueueSettingsScreen({ institutionId, queues, onRefresh }) {
  const [creating,setCreating]=useState(false)
  const [editingId,setEditingId]=useState(null)
  const [saving,setSaving]=useState(false)
  const [name,setName]=useState('')
  const [prefix,setPrefix]=useState('')
  const [department,setDepartment]=useState('')
  const [error,setError]=useState(null)

  function startCreate() {
    setEditingId(null); setName(''); setPrefix(''); setDepartment(''); setError(null); setCreating(true)
  }
  // Renaming a queue or fixing its ticket prefix used to mean deactivating
  // it and adding a new one from scratch, losing its history - this edits
  // the same row in place. Also exposes the department tie directly, so a
  // practice manager can detach an auto-created department queue or point
  // a manual one at a department without going through the database.
  function startEdit(q) {
    setCreating(false); setEditingId(q.id); setName(q.name); setPrefix(q.ticket_prefix); setDepartment(q.department||''); setError(null)
  }
  function cancelForm() {
    setCreating(false); setEditingId(null); setName(''); setPrefix(''); setDepartment('')
  }

  async function handleSave() {
    if (!name.trim() || !prefix.trim()) return
    setSaving(true)
    setError(null)
    const payload = { name: name.trim(), ticket_prefix: prefix.trim().toUpperCase().slice(0,2), department: department.trim()||null }
    const { error: err } = editingId
      ? await supabase.from('clinic_queues').update(payload).eq('id', editingId)
      : await supabase.from('clinic_queues').insert({ institution_id: institutionId, active: true, ...payload })
    setSaving(false)
    if (err) { setError(err.message); return }
    cancelForm()
    onRefresh()
  }

  async function toggleActive(q) {
    await supabase.from('clinic_queues').update({ active: !q.active }).eq('id', q.id)
    onRefresh()
  }

  const formOpen = creating || !!editingId

  return (
    <PageWrap maxWidth={520}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'8px',textAlign:'center'}}>Queues</h2>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px',textAlign:'center'}}>With no queues configured, check-in runs one shared line (ticket prefix A). Add named queues here if this clinic runs more than one line at once - each gets its own ticket sequence and its own "now serving" board. This is a front-desk tool for managing the physical waiting room - checked-in patients show up under a doctor's own patients right away regardless of queue order.</div>

      {queues.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'16px'}}>No named queues yet - running the default single shared queue.</div>}
      {queues.map(q=>(
        <Card key={q.id} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:600}}>{q.name}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>Ticket prefix "{q.ticket_prefix}"{q.department?` · ${q.department} queue`:''}</div>
          </div>
          <div style={{display:'flex',gap:'6px'}}>
            <Btn onClick={()=>startEdit(q)}>Edit</Btn>
            <Btn onClick={()=>toggleActive(q)}>{q.active?'Deactivate':'Reactivate'}</Btn>
          </div>
        </Card>
      ))}

      {!formOpen&&<Btn variant="primary" style={{width:'100%',marginTop:'12px'}} onClick={startCreate}>+ Add a queue</Btn>}
      {formOpen&&<Card style={{padding:'16px',marginTop:'12px'}}>
        <div style={{fontSize:'13px',fontWeight:600,marginBottom:'10px'}}>{editingId?'Edit queue':'New queue'}</div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Queue name (e.g. Chinese Medicine)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
        <input value={prefix} onChange={e=>setPrefix(e.target.value)} placeholder="Ticket prefix, 1-2 letters (e.g. B)" maxLength={2} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
        <input value={department} onChange={e=>setDepartment(e.target.value)} placeholder="Department this queue routes for (optional)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
        {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{error}</div>}
        <div style={{display:'flex',gap:'8px'}}>
          <Btn style={{flex:1}} onClick={cancelForm}>Cancel</Btn>
          <Btn variant="primary" style={{flex:1}} onClick={handleSave} disabled={saving||!name.trim()||!prefix.trim()}>{saving?'Saving…':(editingId?'Save changes':'Add queue')}</Btn>
        </div>
      </Card>}
    </PageWrap>
  )
}

function OverviewScreen({ queue, pendingCount, onRemoveFromQueue, onCancelAppointment, onUpdateStatus, queues=[], checkInError, staffMember, institutionId, onNavCredentials, onNavStaff }) {
  // Same 120-day check as My Credentials - surfaced here too, since a
  // warning that only ever showed on a sub-page nobody was told to visit
  // wasn't a real alert, just something that happened to exist if you
  // already knew to go look for it.
  const ownRegExpiringSoon = staffMember?.registrationExpiry && new Date(staffMember.registrationExpiry) <= new Date(Date.now()+120*24*60*60*1000)

  // A practice manager (admin) usually has no registration_expiry of
  // their own to trigger the check above - the alert they actually need
  // is "which of MY STAFF have credentials expiring soon", which
  // previously only ever showed up if they happened to open Staff >
  // Expiring. Same 120-day threshold as that tab.
  const [expiringStaffCount,setExpiringStaffCount]=useState(0)
  useEffect(() => {
    async function loadExpiringStaffCount() {
      if (staffMember?.role !== 'admin' || !institutionId) return
      const cutoff = new Date(Date.now()+120*24*60*60*1000).toISOString().slice(0,10)
      const { count } = await supabase.from('staff_credentials').select('id', { count:'exact', head:true })
        .eq('institution_id', institutionId).eq('status','active')
        .not('registration_expiry','is',null).lte('registration_expiry', cutoff)
      setExpiringStaffCount(count || 0)
    }
    loadExpiringStaffCount()
  }, [staffMember?.role, institutionId])
  const inRoom = queue.filter(q=>q.status!=='done'&&q.status!=='no_show').length
  const [todaysQueue,setTodaysQueue]=useState([]) // scheduled but not yet checked in
  const [loadingQueue,setLoadingQueue]=useState(true)
  const [activeAction,setActiveAction]=useState(null) // {type:'checkedin'|'scheduled', entry}
  const [callingId,setCallingId]=useState(null)

  // How the checked-in list below is organized - by speciality (grouped
  // under each doctor's own speciality, still time-ordered within the
  // group) or flat by time only, across every doctor. Front desk picks
  // whichever fits how busy the day is; doesn't affect who can be seen,
  // purely a display grouping.
  const [checkedInView,setCheckedInView]=useState('speciality')
  // Keep each entry's real position in `queue` (used by onRemoveFromQueue)
  // even after sorting/grouping for display. Sorted by queuePosition, not
  // raw check-in time - a patient who arrived on time or early for their
  // booked appointment queues near that appointment time rather than
  // behind every walk-in who happened to arrive earlier in the day; a
  // patient late for their appointment queues by when they actually
  // checked in, same as a walk-in.
  // A ticket drops off this board the moment it's done (the doctor's own
  // consultation submission sets that automatically - no manual "Mark
  // done" needed) or marked no-show, instead of sitting there all day
  // needing a manual "Cancel check-in" to clear it.
  const checkedInSortedByTime = queue.map((q,i)=>({...q,_idx:i})).filter(q=>q.status!=='done'&&q.status!=='no_show').sort((a,b)=>queuePosition(a)-queuePosition(b))
  const checkedInBySpeciality = checkedInSortedByTime.reduce((acc,q)=>{
    const key = q.department || 'General'
    ;(acc[key] = acc[key]||[]).push(q)
    return acc
  }, {})

  // One shared board when the clinic hasn't set up named queues (the
  // common case); a separate "now serving" + call-next per queue once
  // it has, since each queue's line is independent of the others.
  // Built from checkedInSortedByTime (queuePosition order), not raw
  // `queue` - otherwise "Call next" pulled whoever happened to be first
  // in check-in order even when an on-time appointment should go first.
  const queueGroups = queues.length>1
    ? queues.map(q=>({ id:q.id, name:q.name, entries: checkedInSortedByTime.filter(e=>e.queueId===q.id) }))
    : [{ id:null, name:null, entries: checkedInSortedByTime }]

  async function callNext(waitingList) {
    const next = waitingList[0]
    if (!next) return
    setCallingId(next.id)
    await onUpdateStatus(next, 'serving')
    setCallingId(null)
  }

  // Real revenue stat - queries today's actual transactions. This was
  // previously a static "HK$4,820" string that never changed at all, and
  // then briefly a reference to variables that were never declared,
  // which crashed this entire screen. Both are fixed here: real query,
  // real state.
  const [todaysRevenue,setTodaysRevenue]=useState(0)
  const [todaysTransactionCount,setTodaysTransactionCount]=useState(0)

  async function loadRevenue() {
    const dayStart = new Date(); dayStart.setHours(0,0,0,0)
    const dayEnd = new Date(); dayEnd.setHours(23,59,59,999)
    const { data } = await supabase.from('transactions').select('patient_pays')
      .gte('created_at', dayStart.toISOString()).lte('created_at', dayEnd.toISOString())
    setTodaysRevenue((data||[]).reduce((sum,t)=>sum+(t.patient_pays||0),0))
    setTodaysTransactionCount((data||[]).length)
  }

  async function loadTodaysQueue() {
    setLoadingQueue(true)
    const dayStart = new Date(); dayStart.setHours(0,0,0,0)
    const dayEnd = new Date(); dayEnd.setHours(23,59,59,999)
    const { data } = await supabase.from('appointments').select('*, patients(full_name, medsa_id)')
      .eq('institution_source', 'clinic_ops')
      .neq('status', 'cancelled')
      .neq('status', 'checked_in')
      .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())
      .order('scheduled_at', {ascending:true})
    setTodaysQueue((data||[]).map(a=>({
      id:a.id, time:new Date(a.scheduled_at).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit',hour12:false}),
      patientName:a.patients?.full_name||'Unknown', medsaId:a.patients?.medsa_id||null, doctor:a.doctor_name||'Unassigned',
    })))
    setLoadingQueue(false)
  }

  useEffect(() => { loadTodaysQueue(); loadRevenue() }, [])

  return (
    <PageWrap maxWidth={720}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Overview</h2>
      {checkInError&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>{'⚠'} {checkInError}</div>}
      {ownRegExpiringSoon&&<div onClick={onNavCredentials} style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:C.amber,lineHeight:1.5,cursor:'pointer'}}>{'⚠'} Your registration expires {staffMember.registrationExpiry} - tap to renew and update it in My Credentials before it lapses.</div>}
      {expiringStaffCount>0&&<div onClick={onNavStaff} style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:C.amber,lineHeight:1.5,cursor:'pointer'}}>{'⚠'} {expiringStaffCount} staff member{expiringStaffCount>1?'s have':' has'} a registration expiring within 4 months - tap to review in Staff.</div>}
      <div style={{display:'flex',gap:'12px',marginBottom:'24px'}}>
        <StatCard label="Checked in today" value={inRoom} sub="patients" color={C.blue} bg={C.blueLight}/>
        <StatCard label="Pending prescriptions" value={pendingCount} sub="awaiting front desk" color={C.amber} bg={C.amberLight}/>
        <StatCard label="Today's revenue" value={`HK$${todaysRevenue.toFixed(0)}`} sub={`${todaysTransactionCount} transaction${todaysTransactionCount===1?'':'s'}`} color={C.green} bg={C.greenLight}/>
      </div>
      <SecLabel>Now serving</SecLabel>
      <div style={{marginBottom:'20px'}}>
        {queueGroups.map(group=>{
          const nowServing = group.entries.filter(q=>q.status==='serving')
          const waitingList = group.entries.filter(q=>q.status==='waiting')
          return (
            <div key={group.id||'default'} style={{marginBottom:'14px'}}>
              {group.name&&<div style={{fontSize:'12px',fontWeight:600,color:C.textSub,marginBottom:'6px'}}>{group.name}</div>}
              {nowServing.length===0&&<Card style={{padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{fontSize:'12px',color:C.textMuted}}>{waitingList.length===0?'No one waiting.':`${waitingList.length} waiting`}</div>
                <Btn variant="primary" onClick={()=>callNext(waitingList)} disabled={!!callingId||waitingList.length===0}>{callingId?'Calling…':`Call next${waitingList[0]?' · '+waitingList[0].ticket:''}`}</Btn>
              </Card>}
              {nowServing.map(q=>(
                <Card key={q.id} style={{padding:'14px 16px',marginBottom:'8px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'10px'}}>
                    <div style={{width:36,height:36,borderRadius:'8px',background:C.green,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,flexShrink:0}}>{q.ticket}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'13px',fontWeight:500}}>{q.patientName}</div>
                      <div style={{fontSize:'12px',color:C.textSub}}>{q.doctor}</div>
                    </div>
                    <Badge text="In consultation" type="ok"/>
                  </div>
                  {/* No manual "Mark done" here - the doctor's own
                      consultation submission marks the ticket done and
                      drops it off this board automatically. No-show stays
                      manual since only front desk knows a patient never
                      actually walked in. */}
                  <Btn style={{width:'100%'}} onClick={()=>onUpdateStatus(q,'no_show')}>No-show</Btn>
                </Card>
              ))}
            </div>
          )
        })}
      </div>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'-4px'}}>
        <SecLabel>Checked-in patients</SecLabel>
        <div style={{display:'flex',gap:'4px',background:C.card,borderRadius:'8px',padding:'2px',marginBottom:'10px'}}>
          <div onClick={()=>setCheckedInView('speciality')} style={{padding:'5px 10px',borderRadius:'6px',fontSize:'11px',fontWeight:600,cursor:'pointer',background:checkedInView==='speciality'?'#fff':'transparent',color:checkedInView==='speciality'?C.text:C.textMuted}}>By speciality</div>
          <div onClick={()=>setCheckedInView('time')} style={{padding:'5px 10px',borderRadius:'6px',fontSize:'11px',fontWeight:600,cursor:'pointer',background:checkedInView==='time'?'#fff':'transparent',color:checkedInView==='time'?C.text:C.textMuted}}>By time</div>
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
        {queue.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'16px'}}>No one checked in yet.</div>}
        {checkedInView==='time'&&checkedInSortedByTime.map(q=>{
          const hrsLeft = hoursRemaining(q.checkedInAt)
          const statusBadge = {waiting:['Waiting','due'],serving:['In consultation','ok'],done:['Done','ok'],no_show:['No-show','full']}[q.status] || ['Waiting','due']
          return (
            <Card key={q._idx} onClick={()=>setActiveAction({type:'checkedin', entry:q, index:q._idx})} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer'}}>
              <div style={{width:32,height:32,borderRadius:'8px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,flexShrink:0}}>{q.ticket}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:500}}>{q.patientName}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{q.doctor}</div>
              </div>
              <Badge text={statusBadge[0]} type={statusBadge[1]}/>
              <span style={{color:C.textMuted,fontSize:'14px'}}>›</span>
            </Card>
          )
        })}
        {checkedInView==='speciality'&&Object.entries(checkedInBySpeciality).map(([speciality,entries])=>(
          <div key={speciality} style={{marginBottom:'6px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.textSub,marginBottom:'6px'}}>{speciality}</div>
            {entries.map(q=>{
              const hrsLeft = hoursRemaining(q.checkedInAt)
              const statusBadge = {waiting:['Waiting','due'],serving:['In consultation','ok'],done:['Done','ok'],no_show:['No-show','full']}[q.status] || ['Waiting','due']
              return (
                <Card key={q._idx} onClick={()=>setActiveAction({type:'checkedin', entry:q, index:q._idx})} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer',marginBottom:'8px'}}>
                  <div style={{width:32,height:32,borderRadius:'8px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,flexShrink:0}}>{q.ticket}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'13px',fontWeight:500}}>{q.patientName}</div>
                    <div style={{fontSize:'12px',color:C.textSub}}>{q.doctor}</div>
                  </div>
                  <Badge text={statusBadge[0]} type={statusBadge[1]}/>
                  <span style={{color:C.textMuted,fontSize:'14px'}}>›</span>
                </Card>
              )
            })}
          </div>
        ))}
      </div>

      <SecLabel>Today's queue - not yet checked in</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {loadingQueue&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'16px'}}>Loading…</div>}
        {!loadingQueue&&todaysQueue.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'16px'}}>Nothing else scheduled for today.</div>}
        {todaysQueue.map((a,i)=>(
          <Card key={a.id} onClick={()=>setActiveAction({type:'scheduled', entry:a})} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer'}}>
            <div style={{width:32,textAlign:'center',fontSize:'12px',fontWeight:700,color:C.textSub,flexShrink:0}}>{a.time}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'13px',fontWeight:500}}>{a.patientName}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{a.doctor}</div>
            </div>
            <span style={{color:C.textMuted,fontSize:'14px'}}>›</span>
          </Card>
        ))}
      </div>

      {activeAction&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setActiveAction(null)}>
        <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:380,padding:'24px'}}>
          <div style={{fontSize:'16px',fontWeight:700,marginBottom:'6px'}}>{activeAction.entry.patientName}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'18px'}}>{activeAction.type==='checkedin'?`${activeAction.entry.ticket} · checked in`:`${activeAction.entry.time} · scheduled`}</div>
          {activeAction.type==='checkedin'&&activeAction.entry.status==='waiting'&&<Btn variant="primary" style={{width:'100%',marginBottom:'8px'}} onClick={async()=>{await onUpdateStatus(activeAction.entry,'serving');setActiveAction(null)}}>Call now</Btn>}
          {/* No manual "Mark done" - the doctor's own consultation
              submission marks the ticket done and drops it off the board
              automatically. */}
          {activeAction.type==='checkedin'&&activeAction.entry.status==='serving'&&<Btn style={{width:'100%',marginBottom:'8px'}} onClick={async()=>{await onUpdateStatus(activeAction.entry,'no_show');setActiveAction(null)}}>No-show</Btn>}
          {activeAction.type==='checkedin'
            ? <Btn variant="danger" style={{width:'100%'}} onClick={async()=>{await onRemoveFromQueue(activeAction.index);setActiveAction(null)}}>↩ Cancel check-in</Btn>
            : <Btn variant="danger" style={{width:'100%'}} onClick={async()=>{await onCancelAppointment(activeAction.entry.id);setActiveAction(null);loadTodaysQueue()}}>✕ Cancel appointment</Btn>}
          <Btn style={{width:'100%',marginTop:'8px'}} onClick={()=>setActiveAction(null)}>Close</Btn>
        </div>
      </div>}
    </PageWrap>
  )
}



// ── CLINIC SCHEDULE ACTIONS — reschedule, switch doctor, cancel, follow-up ──
// Available to both doctors and front desk/admin - anyone with schedule
// access should be able to make these changes, not just reception staff.
function ClinicScheduleActionModal({ appt, onClose, onSave, withinDataWindow, consentReason, onConfirmConsent, onGoToConsultation, onCancelCheckIn, role, onCheckedIn, onScheduleFollowup, staffMember, onRefreshAppointments, checkInError, clinicQueues=[] }) {
  const [mode,setMode]=useState(null) // null | 'reschedule' | 'switch' | 'cancel' | 'followup' | 'notes'
  const [checkingIn,setCheckingIn]=useState(false)
  const [saveError,setSaveError]=useState(null)
  const [savingChange,setSavingChange]=useState(false)
  // Checking in from here used to always fall through to auto-resolved
  // queue routing with no say in it - front desk can now see and
  // override which queue this check-in goes to, same as Check-In/Search
  // already lets them do. Defaults to this appointment's department queue.
  const [checkInQueueId,setCheckInQueueId]=useState(null)
  useEffect(() => {
    if (!appt) return
    const match = clinicQueues.find(q=>q.department===appt.department)
    setCheckInQueueId(match ? match.id : (clinicQueues[0]?.id ?? null))
  }, [appt?.id, clinicQueues])
  const [newTime,setNewTime]=useState('')
  const [newDoctor,setNewDoctor]=useState('')
  const [followupDate,setFollowupDate]=useState('')
  const [followupType,setFollowupType]=useState('')
  const [notesDraft,setNotesDraft]=useState('')
  const [fullPatient,setFullPatient]=useState(null)
  const [loadingPatient,setLoadingPatient]=useState(true)
  const [clinicDoctors,setClinicDoctors]=useState([])
  const [patientFetchError,setPatientFetchError]=useState(null)
  const [conditions,setConditions]=useState([])
  const [allergies,setAllergies]=useState([])
  const [medications,setMedications]=useState([])
  const [records,setRecords]=useState([])
  const [accessRequestStatus,setAccessRequestStatus]=useState(null) // null | 'pending' | 'approved' | 'denied'
  const [sendingAccessRequest,setSendingAccessRequest]=useState(false)

  // Same weight/height logging as Check-in/Search and the consultation
  // screen (patient_vitals) - added here too since this appointment-
  // bubble modal turned out to be where front desk actually looks for
  // it, not just the separate Check-in/Search screen.
  const [vitalsWeight,setVitalsWeight]=useState('')
  const [vitalsHeight,setVitalsHeight]=useState('')
  const [vitalsSaving,setVitalsSaving]=useState(false)
  const [vitalsSaved,setVitalsSaved]=useState(false)
  const [lastVitals,setLastVitals]=useState(null)
  async function loadLastVitals(patientId) {
    const { data } = await supabase.from('patient_vitals').select('*').eq('patient_id', patientId).order('logged_at',{ascending:false}).limit(1).maybeSingle()
    setLastVitals(data||null)
  }
  async function handleSaveVitals(patientId) {
    if (!vitalsWeight && !vitalsHeight) return
    setVitalsSaving(true)
    await supabase.from('patient_vitals').insert({
      patient_id: patientId, weight_kg: vitalsWeight?parseFloat(vitalsWeight):null,
      height_cm: vitalsHeight?parseFloat(vitalsHeight):null,
      logged_at: new Date().toISOString(), logged_by: staffMember?.name || null,
    })
    setVitalsSaving(false)
    setVitalsSaved(true)
    loadLastVitals(patientId)
  }

  // Same "request record access ahead of visit" feature Check-in/Search
  // has, offered here too - this is actually the more natural place for
  // it, since seeing a scheduled patient's history hidden (outside
  // their consent window) ahead of the visit is exactly when a doctor
  // would want to ask for early access, not just at walk-in check-in.
  async function loadAccessRequestStatus(patientId) {
    if (!patientId || !staffMember?.institutionId) { setAccessRequestStatus(null); return }
    const { data } = await supabase.from('record_access_requests')
      .select('status').eq('patient_id', patientId).eq('requesting_institution_id', staffMember.institutionId)
      .order('created_at',{ascending:false}).limit(1).maybeSingle()
    setAccessRequestStatus(data?.status || null)
  }

  async function handleRequestAccess() {
    if (!fullPatient?.id) return
    setSendingAccessRequest(true)
    let clinicName = null
    if (staffMember?.institutionId) {
      const { data: inst } = await supabase.from('institutions').select('name').eq('id', staffMember.institutionId).maybeSingle()
      clinicName = inst?.name || null
    }
    const { error } = await supabase.from('record_access_requests').insert({
      patient_id: fullPatient.id, requesting_staff: staffMember?.name || 'Unknown',
      requesting_clinic: clinicName, requesting_institution_id: staffMember?.institutionId || null,
      reason: 'Ahead of scheduled visit', status: 'pending',
    })
    setSendingAccessRequest(false)
    if (error) { alert(`Could not send request: ${error.message}`); return }
    setAccessRequestStatus('pending')
  }

  // Real working-hours-based slots for rescheduling - replaces the
  // hardcoded ['09:00','09:30',...] list, which never reflected the
  // doctor's actual hours (set in Working Hours) and could suggest a
  // time they don't even work.
  const [availableSlots,setAvailableSlots]=useState([])
  const [slotsLoading,setSlotsLoading]=useState(true)

  useEffect(() => {
    loadClinicDoctors().then(setClinicDoctors)
  }, [])

  useEffect(() => {
    async function loadSlots() {
      setSlotsLoading(true)
      if (!appt?.doctor) { setAvailableSlots([]); setSlotsLoading(false); return }
      // The day this appointment is actually scheduled for, not "today" -
      // rescheduling an appointment booked for a different day than today
      // was checking today's working hours instead of that day's.
      const apptDay = appt.scheduledAt ? new Date(appt.scheduledAt) : new Date()
      const dayOfWeek = apptDay.getDay()
      const { data } = await supabase.from('doctor_availability').select('*')
        .eq('doctor_name', appt.doctor).eq('institution_source', 'clinic_ops').eq('day_of_week', dayOfWeek).maybeSingle()
      if (!data || data.is_off) { setAvailableSlots([]); setSlotsLoading(false); return }
      const slots = []
      const [startH, startM] = (data.start_time||'09:00').split(':').map(Number)
      const [endH, endM] = (data.end_time||'17:00').split(':').map(Number)
      let current = startH*60 + startM
      const end = endH*60 + endM
      while (current < end) {
        slots.push(`${String(Math.floor(current/60)).padStart(2,'0')}:${String(current%60).padStart(2,'0')}`)
        current += data.slot_duration_minutes || 30
      }
      setAvailableSlots(slots)
      setSlotsLoading(false)
    }
    loadSlots()
  }, [appt?.doctor])

  // Show real patient info here - the same view as when their Medsa ID is
  // scanned at check-in - not just a bare scheduling row. Full medical
  // history is available here (within the consent window) so a doctor
  // can review and prep ahead of a follow-up or first visit - this is
  // separate from "Log diagnosis," which still requires actual check-in.
  useEffect(() => {
    async function loadPatient() {
      if (!appt?.medsaId) { setLoadingPatient(false); setPatientFetchError('This appointment has no linked Medsa ID.'); return }
      setLoadingPatient(true)
      const { data, error: fetchErr } = await supabase.from('patients').select('*').eq('medsa_id', appt.medsaId).maybeSingle()
      if (fetchErr) setPatientFetchError(fetchErr.message)
      else if (!data) setPatientFetchError(`No patient record found for Medsa ID ${appt.medsaId}.`)
      else setPatientFetchError(null)
      setFullPatient(data || null)
      if (data) {
        const [condRes, allergyRes, medRes, recRes] = await Promise.all([
          supabase.from('conditions').select('*').eq('patient_id', data.id).eq('active', true),
          supabase.from('allergies').select('*').eq('patient_id', data.id),
          supabase.from('medications').select('*').eq('patient_id', data.id),
          supabase.from('medical_records').select('*, institutions(name)').eq('patient_id', data.id).order('date_of_record',{ascending:false}).limit(5),
        ])
        setConditions(condRes.data||[])
        setAllergies(allergyRes.data||[])
        setMedications(medRes.data||[])
        setRecords(recRes.data||[])
        loadAccessRequestStatus(data.id)
        loadLastVitals(data.id)
      } else {
        setAccessRequestStatus(null)
      }
      setVitalsWeight(''); setVitalsHeight(''); setVitalsSaved(false)
      setLoadingPatient(false)
    }
    loadPatient()
  }, [appt?.medsaId])

  if (!appt || appt.status==='open') return null

  // Full diagnosis access requires both being within the patient's own
  // consent window AND having actually checked in - being scheduled for
  // today alone isn't enough to log a new diagnosis.
  const isCheckedIn = appt.status==='checked_in'
  const isCompleted = appt.status==='completed'
  const isCancelled = appt.status==='cancelled'
  const canLogDiagnosis = withinDataWindow && isCheckedIn && role==='doctor'

  // Only offer doctors in the same department/specialty as this
  // appointment - switching to an unrelated specialty wouldn't make sense.
  const DOCTORS = clinicDoctors.filter(d=>d.department===appt.department && d.name!==appt.doctor).map(d=>d.name)

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:420,padding:'24px',maxHeight:'85vh',overflowY:'auto'}}>
        <div onClick={onClose} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'14px'}}>Close</div>

        {loadingPatient&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,marginBottom:'14px'}}>Loading patient…</div>}
        {!loadingPatient&&patientFetchError&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.amber}}>⚠ {patientFetchError}</div>}

        {!loadingPatient&&withinDataWindow&&fullPatient&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'12px',padding:'16px',marginBottom:'14px'}}>
          <div style={{fontSize:'11px',color:isCancelled?C.red:C.green,fontWeight:600,textTransform:'uppercase',marginBottom:'6px'}}>{isCancelled?'✕ Cancelled':isCompleted?'✓ Completed':isCheckedIn?'✓ Checked in':'Scheduled'}</div>
          <div style={{fontSize:'17px',fontWeight:700}}>{fullPatient.full_name}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>{fullPatient.medsa_id} · DOB {new Date(fullPatient.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
          <div style={{display:'flex',gap:'10px'}}>
            <div style={{flex:1,background:'#fff',borderRadius:'8px',padding:'8px',textAlign:'center'}}>
              <div style={{fontSize:'10px',color:C.textMuted}}>Blood type</div>
              <div style={{fontSize:'15px',fontWeight:700,color:C.red}}>{fullPatient.blood_type||'-'}</div>
            </div>
            <div style={{flex:2,background:'#fff',borderRadius:'8px',padding:'8px'}}>
              <div style={{fontSize:'10px',color:C.textMuted}}>Visit</div>
              <div style={{fontSize:'12px',fontWeight:600}}>{appt.time} · {appt.type}</div>
            </div>
          </div>
        </div>}

        {/* Deliberately NOT inside the withinDataWindow-gated card above -
            weight/height is a front-desk/administrative task, not a
            clinical record, so it shouldn't need consent to log. This is
            what "front desk can't access that" was about: it was only
            ever inside the same block as Blood type, which is hidden
            entirely outside the consent window. */}
        {!loadingPatient&&fullPatient&&<div style={{background:C.card,borderRadius:'10px',padding:'12px 14px',marginBottom:'14px'}}>
          <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,marginBottom:'6px',textTransform:'uppercase'}}>Weight / Height</div>
          {lastVitals&&(lastVitals.weight_kg||lastVitals.height_cm)&&<div style={{fontSize:'11px',color:C.textSub,marginBottom:'8px'}}>Last logged {new Date(lastVitals.logged_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}: {lastVitals.weight_kg?`${lastVitals.weight_kg}kg`:''}{lastVitals.height_cm?` ${lastVitals.height_cm}cm`:''}</div>}
          <div style={{display:'flex',gap:'6px'}}>
            <input type="number" step="0.1" value={vitalsWeight} onChange={e=>setVitalsWeight(e.target.value)} placeholder="Weight (kg)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px',fontSize:'12px',boxSizing:'border-box'}}/>
            <input type="number" step="0.1" value={vitalsHeight} onChange={e=>setVitalsHeight(e.target.value)} placeholder="Height (cm)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'8px',fontSize:'12px',boxSizing:'border-box'}}/>
            <button onClick={()=>handleSaveVitals(fullPatient.id)} disabled={vitalsSaving||(!vitalsWeight&&!vitalsHeight)} style={{padding:'8px 12px',background:C.navy,color:'#fff',border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>{vitalsSaving?'Saving…':'Save'}</button>
          </div>
          {vitalsSaved&&<div style={{fontSize:'11px',color:C.green,marginTop:'6px'}}>{'✓'} Logged with today's date.</div>}
        </div>}

        {!loadingPatient&&withinDataWindow&&fullPatient&&role==='doctor'&&<div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'8px'}}>Medical history</div>
          {allergies.length>0&&<div style={{background:C.redLight,borderRadius:'8px',padding:'10px 12px',marginBottom:'8px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.red,marginBottom:'4px'}}>⚠ Allergies</div>
            {allergies.map((a,i)=><div key={i} style={{fontSize:'12px',color:C.text}}>{a.allergen} ({a.severity})</div>)}
          </div>}
          {conditions.length>0&&<div style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'8px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.text,marginBottom:'4px'}}>Active conditions</div>
            {conditions.map((c,i)=><div key={i} style={{fontSize:'12px',color:C.textSub}}>{c.condition_name}{c.severity?` (${c.severity})`:''}</div>)}
          </div>}
          {medications.length>0&&<div style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'8px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.text,marginBottom:'4px'}}>Current medications</div>
            {medications.map((m,i)=><div key={i} style={{fontSize:'12px',color:C.textSub}}>{m.medication_name} {m.dosage||''} — {m.frequency||''}</div>)}
          </div>}
          {records.length>0&&<div style={{background:C.card,borderRadius:'8px',padding:'10px 12px'}}>
            <div style={{fontSize:'11px',fontWeight:600,color:C.text,marginBottom:'4px'}}>Recent records</div>
            {records.map((r,i)=><div key={i} style={{fontSize:'12px',color:C.textSub,marginBottom:'2px'}}>{new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short'})} — {r.title}{r.institutions?.name?`, ${r.institutions.name}`:''}</div>)}
          </div>}
          {allergies.length===0&&conditions.length===0&&medications.length===0&&records.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'12px'}}>No history on file yet.</div>}
        </div>}

        {!loadingPatient&&withinDataWindow&&fullPatient&&role!=='doctor'&&<div style={{background:C.card,borderRadius:'10px',padding:'12px 14px',marginBottom:'14px',fontSize:'12px',color:C.textMuted,lineHeight:1.5}}>
          ◇ Medical history is only visible to doctors. Scheduling changes still work below.
        </div>}

        {!loadingPatient&&!withinDataWindow&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'14px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>
          ◇ {appt.patient} · {appt.time} · {appt.type} — {consentReason==='outside_window'
            ? "outside this patient's consent window, so clinical details aren't shown here."
            : 'no consent is on file for this patient yet, so clinical details aren\'t shown here.'} Scheduling changes still work below.
        </div>}
        {/* Was front-desk-only - a doctor sitting across from the
            patient during the actual visit can just as legitimately
            log verbal consent themselves, and gating this to front
            desk meant a doctor was stuck waiting on someone else for
            an appointment that was scheduled for right now. Requires
            isCheckedIn - this only unlocks viewing the medical history
            summary above, it never substitutes for check-in itself,
            which canLogDiagnosis still requires separately. */}
        {!loadingPatient&&!withinDataWindow&&isCheckedIn&&consentReason==='no_consent'&&<Btn variant="primary" style={{width:'100%',marginBottom:'14px'}} onClick={()=>onConfirmConsent?.(appt)}>Confirm patient consented (verbal/paper) - now checked in</Btn>}
        {!loadingPatient&&!withinDataWindow&&fullPatient&&!accessRequestStatus&&<Btn style={{width:'100%',marginBottom:'14px'}} onClick={handleRequestAccess} disabled={sendingAccessRequest}>{sendingAccessRequest?'Sending…':'Request record access ahead of visit'}</Btn>}
        {!loadingPatient&&accessRequestStatus==='pending'&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.amber}}>◇ Request sent to patient for approval. Records will be available here once granted.</div>}
        {!loadingPatient&&accessRequestStatus==='approved'&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.green}}>✓ Patient approved this request.</div>}
        {!loadingPatient&&accessRequestStatus==='denied'&&<div style={{background:C.redLight,border:`0.5px solid ${C.red}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.red}}>Patient declined this request.</div>}

        {mode!=='notes'&&<div onClick={()=>{setNotesDraft(appt.notes||'');setMode('notes')}} style={{background:C.card,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.textSub,lineHeight:1.5,cursor:'pointer'}}>
          <div style={{fontWeight:600,color:C.text,marginBottom:'2px',display:'flex',justifyContent:'space-between'}}><span>Patient notes</span><span style={{color:C.green,fontSize:'11px'}}>Edit</span></div>{appt.notes||'No notes yet - tap to add'}
        </div>}

        {mode==='notes'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Notes for {appt.patient}</div>
          <textarea value={notesDraft} onChange={e=>setNotesDraft(e.target.value)} rows={4} placeholder="Symptoms, patient-reported notes, anything relevant for the visit…" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginBottom:'14px',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={()=>{onSave({...appt,notes:notesDraft});setMode(null)}}>Save notes</Btn>
          </div>
        </>}

        {/* Previously this state existed at the top level (ClinicOpsApp)
            but was only ever rendered inside the Check-in/Search screen -
            a failed check-in triggered from here set the error but the
            modal just closed as if nothing happened, with zero feedback
            for whoever clicked it. */}
        {checkInError&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'14px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>{'⚠'} {checkInError}</div>}

        {!mode&&isCompleted&&<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'8px'}}>◇ This appointment has been completed.</div>
          <Btn style={{width:'100%'}} onClick={()=>setMode('followup')}>+ Add follow-up appointment</Btn>
        </div>}

        {!mode&&isCancelled&&<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <div style={{fontSize:'12px',color:C.red,textAlign:'center',padding:'8px'}}>✕ This appointment was cancelled.</div>
          <Btn style={{width:'100%'}} onClick={()=>setMode('followup')}>+ Book a new appointment</Btn>
        </div>}

        {!mode&&!isCompleted&&!isCancelled&&<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {!isCheckedIn&&onCheckedIn&&clinicQueues.length>1&&<div style={{marginBottom:'2px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Check in to which queue?</div>
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
              {clinicQueues.map(q=>(
                <div key={q.id} onClick={()=>setCheckInQueueId(q.id)} style={{padding:'6px 12px',borderRadius:'16px',fontSize:'12px',cursor:'pointer',background:checkInQueueId===q.id?C.green:C.card,color:checkInQueueId===q.id?'#fff':C.textSub}}>{q.name}</div>
              ))}
            </div>
          </div>}
          {!isCheckedIn&&onCheckedIn&&<Btn variant="primary" style={{width:'100%'}} disabled={checkingIn} onClick={async()=>{
            setCheckingIn(true)
            const result = await onCheckedIn({ id: appt.patientId, full_name: appt.patient }, false, clinicQueues.length>1?checkInQueueId:undefined, true, null, appt.id)
            setCheckingIn(false)
            // Closing without refreshing the underlying appointments list
            // (unlike onCancelCheckIn just below, which already does this)
            // left the Schedule page showing the old "Pending"/"Confirmed"
            // badge and the modal's own isCheckedIn stuck on stale data -
            // check-in was actually succeeding, it just never looked like
            // it did anything without a manual page reload.
            if (result === true) { onRefreshAppointments?.(); onClose() }
          }}>{checkingIn?'Checking in...':'✓ Check in'}</Btn>}
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setSaveError(null);setMode('reschedule')}}>📅 Change date/time</Btn>
          <Btn style={{width:'100%'}} onClick={()=>{setSaveError(null);setMode('switch')}}>⇄ Switch doctor/treatment</Btn>
          <Btn style={{width:'100%'}} onClick={()=>setMode('followup')}>+ Add follow-up appointment</Btn>
          {canLogDiagnosis
            ? <Btn style={{width:'100%'}} onClick={()=>onGoToConsultation(appt)}>📋 Full diagnosis / log</Btn>
            : <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',padding:'8px'}}>◇ {role!=='doctor'?'Full diagnosis/log is only available to doctors':`Full diagnosis/log unlocks once this patient has checked in${!withinDataWindow?' and is within their consent window':''}`}</div>}
          {isCheckedIn&&onCancelCheckIn&&<Btn style={{width:'100%'}} onClick={()=>setMode('cancelcheckin')}>↩ Cancel check-in</Btn>}
          <Btn variant="danger" style={{width:'100%'}} onClick={()=>setMode('cancel')}>✕ Cancel appointment</Btn>
        </div>}

        {mode==='cancelcheckin'&&<>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'14px'}}>Undo {appt.patient}'s check-in? This puts the appointment back to "scheduled" and removes them from today's active queue - use this to fix a mistaken check-in or to check them out for testing.</div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Keep checked in</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={async()=>{await onCancelCheckIn(appt);setMode(null);onClose()}}>Confirm undo</Btn>
          </div>
        </>}

        {mode==='reschedule'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>New time for {appt.patient}</div>
          {slotsLoading&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'14px'}}>Loading {appt.doctor}'s working hours…</div>}
          {!slotsLoading&&availableSlots.length===0&&<div style={{fontSize:'12px',color:C.amber,marginBottom:'14px'}}>{'\u26a0'} No working hours set for {appt.doctor} today - set them in Working Hours before rescheduling here.</div>}
          {!slotsLoading&&availableSlots.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'14px'}}>
            {availableSlots.map(t=>(
              <div key={t} onClick={()=>setNewTime(t)} style={{border:`0.5px solid ${newTime===t?C.green:C.border}`,borderRadius:'8px',padding:'8px',textAlign:'center',fontSize:'12px',cursor:'pointer',background:newTime===t?C.green:C.card,color:newTime===t?'#fff':C.text}}>{t}</div>
            ))}
          </div>}
          {saveError&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.amber}}>{'⚠'} {saveError}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} disabled={!newTime||savingChange} onClick={async()=>{
              setSavingChange(true); setSaveError(null)
              const res = await onSave({...appt,time:newTime||appt.time})
              setSavingChange(false)
              if (res?.ok===false) { setSaveError(res.error); return }
              onClose()
            }}>{savingChange?'Saving…':'Confirm change'}</Btn>
          </div>
        </>}

        {mode==='switch'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Switch doctor for {appt.patient}</div>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>Showing doctors in {appt.department} only</div>
          {DOCTORS.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'14px'}}>No other doctor in this speciality yet.</div>}
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'14px'}}>
            {DOCTORS.map(d=>(
              <div key={d} onClick={()=>setNewDoctor(d)} style={{border:`0.5px solid ${newDoctor===d?C.green:C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',background:newDoctor===d?C.green:C.card,color:newDoctor===d?'#fff':C.text}}>{d}</div>
            ))}
          </div>
          {saveError&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.amber}}>{'⚠'} {saveError}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} disabled={!newDoctor||savingChange} onClick={async()=>{
              setSavingChange(true); setSaveError(null)
              const res = await onSave({...appt,doctor:newDoctor||appt.doctor})
              setSavingChange(false)
              if (res?.ok===false) { setSaveError(res.error); return }
              onClose()
            }}>{savingChange?'Saving…':'Confirm switch'}</Btn>
          </div>
        </>}

        {mode==='followup'&&<>
          <div style={{fontSize:'13px',fontWeight:500,marginBottom:'10px'}}>Follow-up appointment for {appt.patient}</div>
          <input value={followupDate} onChange={e=>setFollowupDate(e.target.value)} type="date" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input value={followupType} onChange={e=>setFollowupType(e.target.value)} placeholder="Reason, e.g. Follow-up review" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'14px',boxSizing:'border-box'}}/>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'14px'}}>This takes you to Schedule with {appt.patient} already selected, so you just pick the day and time - no need to search or re-enter their details.</div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Back</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={()=>{onScheduleFollowup?.({ full_name: appt.patient, id: appt.patientId }); onClose()}} disabled={!followupDate||!followupType}>Schedule follow-up</Btn>
          </div>
        </>}

        {mode==='cancel'&&<>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'14px'}}>Cancel {appt.patient}'s appointment at {appt.time}? This can't be undone from here.</div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>setMode(null)}>Keep appointment</Btn>
            <Btn variant="danger" style={{flex:1}} onClick={()=>{onSave({...appt,cancelled:true});onClose()}}>Confirm cancel</Btn>
          </div>
        </>}
      </div>
    </div>
  )
}

// ── WORKING HOURS — admin sets each doctor's weekly availability ───────────
// This is the real source of truth for both the doctor's own schedule view
// and what patients see as bookable slots in Find Care - replacing the
// previous hardcoded/pseudo-random time slots on both sides.
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// ── PRACTICE MANAGER — STAFF ─────────────────────────────────────────────────
// Deliberately consolidated into one screen with tabs, not five separate
// screens like the Practitioner-side HR system - a small clinic doesn't need
// that much structure, just needs the same real underlying jobs done.
// ── MY CREDENTIALS — real replacement for the shelved /practitioner ────────
// app's fake "Practitioner ID" screen (hardcoded name, hardcoded license
// number, two different names shown on its own two tabs). Real fields
// from this person's actual staff_credentials row, plus the one thing
// that screen never had: if the same real person (matched by HKID +
// e-PC at onboarding) also works at another clinic, switching to it
// here doesn't need a second password - they already proved who they
// are this session.
function PractitionerCredentialsScreen({ staffMember, institutionName, affiliatedClinics, onSwitchClinic }) {
  const [editing,setEditing]=useState(false)
  const [form,setForm]=useState({
    registrationNumber: staffMember.registrationNumber||'', registrationExpiry: staffMember.registrationExpiry||'',
    registeringBody: staffMember.registeringBody||'',
  })
  // Local override of what's displayed, since a self-edit doesn't refresh
  // the staffMember prop this whole app was logged in with - avoids the
  // edited fields silently reverting to look untouched until next login.
  const [saved,setSaved] = useState(null)
  const [saving,setSaving]=useState(false)
  const [docFile,setDocFile]=useState(null)
  const [uploading,setUploading]=useState(false)

  // Own contact email - was only ever editable by a practice manager on
  // the Staff tab (needed for password-reset OTP delivery), with no
  // self-service way to fix a typo or update it after changing providers.
  // Applies immediately, same as a practice manager editing someone
  // else's - this is contact info, not a licensing credential, so it
  // doesn't need the "pending verification" review step below.
  const [editingEmail,setEditingEmail]=useState(false)
  const [emailValue,setEmailValue]=useState(staffMember.email||'')
  const [emailSaving,setEmailSaving]=useState(false)
  const [emailSaved,setEmailSaved]=useState(null)
  const [emailError,setEmailError]=useState(null)

  async function handleSaveEmail() {
    setEmailError(null)
    const trimmed = emailValue.trim()
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setEmailError('Enter a valid email address.'); return }
    setEmailSaving(true)
    const { error } = await supabase.from('staff_credentials').update({ email: trimmed||null }).eq('medsa_id', staffMember.id)
    setEmailSaving(false)
    if (error) { setEmailError(error.message); return }
    setEmailSaved(trimmed||null)
    setEditingEmail(false)
  }

  // Change own password - previously only ever settable at onboarding
  // (by the practice manager) or via the forgot-password email OTP flow;
  // no way to just change it directly while already logged in. Verifies
  // the current password first via the same verify_staff_password RPC
  // login uses, rather than trusting whoever's sitting at this session.
  const [changingPw,setChangingPw]=useState(false)
  const [currentPw,setCurrentPw]=useState('')
  const [newPw,setNewPw]=useState('')
  const [newPwConfirm,setNewPwConfirm]=useState('')
  const [pwSaving,setPwSaving]=useState(false)
  const [pwError,setPwError]=useState(null)
  const [pwSuccess,setPwSuccess]=useState(false)

  async function handleChangePassword() {
    setPwError(null)
    if (!currentPw) { setPwError('Enter your current password.'); return }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return }
    if (!/[0-9]/.test(newPw)) { setPwError('New password must contain at least one number.'); return }
    if (!/[A-Z]/.test(newPw)) { setPwError('New password must contain at least one capital letter.'); return }
    if (!/[^A-Za-z0-9]/.test(newPw)) { setPwError('New password must contain at least one special character.'); return }
    if (newPw !== newPwConfirm) { setPwError('New password and confirmation don\'t match.'); return }
    setPwSaving(true)
    // Real change, atomically - was two separate calls (verify, then
    // set_staff_password), and set_staff_password only ever writes when
    // no password exists yet (a one-time onboarding guard), so an actual
    // change to an already-provisioned account silently did nothing: no
    // error, but the old password kept working. change_staff_password
    // both proves the current password and overwrites in one call.
    const { data: ok, error: pwErr } = await supabase.rpc('change_staff_password', { p_medsa_id: staffMember.id, p_current_password: currentPw, p_new_password: newPw })
    setPwSaving(false)
    if (pwErr) { setPwError(pwErr.message); return }
    if (!ok) { setPwError('Current password is incorrect.'); return }
    setCurrentPw(''); setNewPw(''); setNewPwConfirm('')
    setChangingPw(false)
    setPwSuccess(true)
  }

  const current = saved || { registrationNumber: staffMember.registrationNumber, registrationExpiry: staffMember.registrationExpiry, registeringBody: staffMember.registeringBody, hasEpc: staffMember.hasEpc }
  const expiringSoon = current.registrationExpiry && new Date(current.registrationExpiry) <= new Date(Date.now()+120*24*60*60*1000)

  async function handleSave() {
    setSaving(true)
    let registration_doc_url = undefined
    if (docFile) {
      setUploading(true)
      const path = `clinic_ops/${Date.now()}-${docFile.name}`
      const { error: upErr } = await supabase.storage.from('staff-documents').upload(path, docFile)
      if (!upErr) registration_doc_url = path
      setUploading(false)
    }
    // Self-submitted - flips verification_status back to 'pending' so it
    // shows up for the practice manager to confirm (Staff tab), rather
    // than silently becoming the record of truth with no second look.
    // status itself stays 'active' - this doesn't lock anyone out.
    await supabase.from('staff_credentials').update({
      registration_number: form.registrationNumber.trim()||null,
      registration_expiry: form.registrationExpiry||null,
      registering_body: form.registeringBody.trim()||null,
      verification_status: 'pending',
      ...(registration_doc_url !== undefined ? { registration_doc_url } : {}),
    }).eq('medsa_id', staffMember.id)
    setSaved({ registrationNumber: form.registrationNumber, registrationExpiry: form.registrationExpiry, registeringBody: form.registeringBody, hasEpc: staffMember.hasEpc })
    setSaving(false)
    setEditing(false)
    setDocFile(null)
  }

  return (
    <PageWrap maxWidth={520}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>My Credentials</h2>
      <div style={{margin:'0 0 16px',background:`linear-gradient(135deg,${C.green} 0%,#3f6b4f 100%)`,borderRadius:'16px',padding:'24px',color:'#fff'}}>
        <div style={{fontSize:'10px',opacity:0.65,letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:'4px'}}>medsa practitioner</div>
        <div style={{fontSize:'20px',fontWeight:700,marginBottom:'2px'}}>{staffMember.name}</div>
        <div style={{fontSize:'13px',opacity:0.85,marginBottom:'16px'}}>{ROLE_LABELS[staffMember.role]||staffMember.role}{staffMember.department&&staffMember.department!=='All departments'?` · ${staffMember.department}`:''}</div>
        <div style={{display:'flex',gap:'20px'}}>
          <div><div style={{fontSize:'10px',opacity:0.6}}>Registration</div><div style={{fontSize:'13px',fontWeight:600}}>{current.registrationNumber||'Not on file'}</div></div>
          <div><div style={{fontSize:'10px',opacity:0.6}}>Institution</div><div style={{fontSize:'13px',fontWeight:600}}>{institutionName||'—'}</div></div>
        </div>
      </div>

      {saved&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>{'⚠'} Saved - pending your practice manager's confirmation before it counts as verified again.</div>}
      {expiringSoon&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>{'⚠'} Registration expires {current.registrationExpiry} - renew and update this before it lapses.</div>}

      {!editing&&<Card style={{padding:'0 16px'}}>
        <InfoRow label="Full name" value={staffMember.name}/>
        <InfoRow label="Registration no." value={current.registrationNumber||'Not on file'}/>
        <InfoRow label="Registration expiry" value={current.registrationExpiry||'Not on file'}/>
        {ACCREDITED_REGISTER_ROLES.includes(staffMember.role)&&<InfoRow label="Registering body" value={current.registeringBody||'Not on file'}/>}
        <InfoRow label="e-PC on file" value={current.hasEpc?'Yes':'No'} last/>
      </Card>}
      {!editing&&<button onClick={()=>{setForm({registrationNumber:current.registrationNumber||'',registrationExpiry:current.registrationExpiry||'',registeringBody:current.registeringBody||''});setEditing(true)}} style={{width:'100%',padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',marginTop:'12px',marginBottom:'12px'}}>Edit registration details</button>}

      {editing&&<Card style={{padding:'16px'}}>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>e-PC and HKID link your identity across clinics, so those stay admin-managed - contact your practice manager for those. Everything below is yours to keep current.</div>
        <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px'}}>Registration number</div>
        <input value={form.registrationNumber} onChange={e=>setForm(f=>({...f,registrationNumber:e.target.value}))} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px'}}>Registration/license expiry</div>
        <input type="date" value={form.registrationExpiry} onChange={e=>setForm(f=>({...f,registrationExpiry:e.target.value}))} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        {ACCREDITED_REGISTER_ROLES.includes(staffMember.role)&&<>
          <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px'}}>Registering body / society</div>
          <input value={form.registeringBody} onChange={e=>setForm(f=>({...f,registeringBody:e.target.value}))} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        </>}
        <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px'}}>Updated document (optional - PDF or image)</div>
        <label style={{display:'block',width:'100%',padding:'10px',border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',color:C.textSub,textAlign:'center',cursor:'pointer',marginBottom:'12px',boxSizing:'border-box'}}>
          {docFile?.name || 'Tap to upload'}
          <input type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={e=>setDocFile(e.target.files[0]||null)}/>
        </label>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setEditing(false)} style={{flex:1,padding:'10px',background:C.cream,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleSave} disabled={saving||uploading} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>{uploading?'Uploading…':saving?'Saving…':'Save'}</button>
        </div>
      </Card>}

      <SecLabel>Password</SecLabel>
      {pwSuccess&&!changingPw&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',fontSize:'12px',color:C.green}}>{'✓'} Password changed.</div>}
      {!changingPw&&<button onClick={()=>{setPwError(null);setPwSuccess(false);setChangingPw(true)}} style={{width:'100%',padding:'10px',background:C.card,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',marginBottom:'16px'}}>Change password</button>}
      {changingPw&&<Card style={{padding:'16px',marginBottom:'16px'}}>
        <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px'}}>Current password</div>
        <input type="password" value={currentPw} onChange={e=>setCurrentPw(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px'}}>New password (8+ chars, 1 number, 1 capital, 1 special)</div>
        <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px'}}>Confirm new password</div>
        <input type="password" value={newPwConfirm} onChange={e=>setNewPwConfirm(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${newPwConfirm&&newPwConfirm!==newPw?C.red:C.border}`,borderRadius:'8px'}}/>
        {pwError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{pwError}</div>}
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>{setChangingPw(false);setCurrentPw('');setNewPw('');setNewPwConfirm('');setPwError(null)}} style={{flex:1,padding:'10px',background:C.cream,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleChangePassword} disabled={pwSaving} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>{pwSaving?'Saving…':'Save new password'}</button>
        </div>
      </Card>}

      <SecLabel>Contact email</SecLabel>
      <div style={{fontSize:'11px',color:C.textMuted,padding:'0 16px 10px',lineHeight:1.5}}>Used for password reset codes and account notices.</div>
      {!editingEmail&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px 16px',gap:'10px'}}>
        <div style={{fontSize:'13px',color:(emailSaved!==null?emailSaved:staffMember.email)?C.text:C.amber,wordBreak:'break-all'}}>{(emailSaved!==null?emailSaved:staffMember.email)||'⚠ No email on file - required for password reset'}</div>
        <button onClick={()=>{setEmailValue((emailSaved!==null?emailSaved:staffMember.email)||'');setEmailError(null);setEditingEmail(true)}} style={{padding:'6px 12px',background:C.card,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer',flexShrink:0}}>Edit</button>
      </div>}
      {editingEmail&&<Card style={{padding:'16px',marginBottom:'16px'}}>
        <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px'}}>Email</div>
        <input type="email" value={emailValue} onChange={e=>setEmailValue(e.target.value)} placeholder="you@example.com" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px'}}/>
        {emailError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{emailError}</div>}
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={()=>setEditingEmail(false)} style={{flex:1,padding:'10px',background:C.cream,border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button onClick={handleSaveEmail} disabled={emailSaving} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>{emailSaving?'Saving…':'Save'}</button>
        </div>
      </Card>}

      <SecLabel>Switch clinic</SecLabel>
      {affiliatedClinics.length===0
        ? <div style={{fontSize:'12px',color:C.textMuted,padding:'0 16px 16px'}}>No other clinics linked to your identity yet. If you also work elsewhere on Medsa, your practice manager there onboards you with the same HKID and e-PC to link it here.</div>
        : affiliatedClinics.map(c=>(
          <Card key={c.institutionId} onClick={()=>onSwitchClinic(c)} style={{padding:'14px 16px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:'13px',fontWeight:600}}>{c.institutionName}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{ROLE_LABELS[c.role]||c.role}{c.department&&c.department!=='All departments'?` · ${c.department}`:''}</div>
            </div>
            <span style={{color:C.textMuted,fontSize:'18px'}}>›</span>
          </Card>
        ))}
    </PageWrap>
  )
}

function HelpScreen({ staffMember }) {
  const [expanded,setExpanded]=useState(null)
  const [submitType,setSubmitType]=useState(null) // 'technical_issue' | 'complaint' | null
  const [message,setMessage]=useState('')
  const [saving,setSaving]=useState(false)
  const [sent,setSent]=useState(false)

  async function handleSubmit() {
    if (!message.trim()) return
    setSaving(true)
    await supabase.from('support_requests').insert({
      type: submitType, staff_name: staffMember?.name, institution_source: 'clinic_ops', message,
    })
    setSaving(false)
    setSent(true)
  }

  const ITEMS = [
    { key:'technical', title:'Report a technical issue', sub:'Contact Medsa support team', isForm:true, formType:'technical_issue' },
    { key:'complaint', title:'Submit a complaint', sub:'About a patient, colleague, or process', isForm:true, formType:'complaint' },
    { key:'faq', title:'FAQ', sub:'Common questions about the portal', content:'Q: How do I reset a staff PIN?\nA: Practice Manager → Staff → select the staff member → Reset PIN.\n\nQ: What if a patient has no appointment when checking in?\nA: Book one via Scheduling first - check-in requires a real appointment to correctly notify the doctor.\n\nQ: How do I add a new insurance plan?\nA: Use the Insurance Plans admin page - real age-banded pricing tiers are required.' },
    { key:'privacy', title:'Data & privacy', sub:'How patient data is protected', content:'Patient records are only visible within their consent window, or with explicit patient-granted access. Staff actions on patient records are logged. Patients own their claimed records - a clinic never retains ownership once a profile is claimed.' },
  ]

  return (
    <div style={{background:C.beige,flex:1,minHeight:'100vh'}}>
      <SecLabel>Help & support</SecLabel>
      {ITEMS.map(item=>(
        <div key={item.key}>
          <Card onClick={()=>{setExpanded(expanded===item.key?null:item.key); if(item.isForm){setSubmitType(item.formType);setSent(false);setMessage('')}}} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
            <div><div style={{fontSize:'14px',fontWeight:500}}>{item.title}</div><div style={{fontSize:'12px',color:C.textSub}}>{item.sub}</div></div>
            <span style={{color:C.textMuted,fontSize:'18px'}}>{expanded===item.key?'\u2039':'\u203a'}</span>
          </Card>
          {expanded===item.key&&item.content&&<Card style={{padding:'14px 16px',marginTop:'-6px',whiteSpace:'pre-wrap',fontSize:'13px',color:C.textSub,lineHeight:1.6}}>{item.content}</Card>}
          {expanded===item.key&&item.isForm&&<Card style={{padding:'14px 16px',marginTop:'-6px'}}>
            {sent
              ? <div style={{fontSize:'13px',color:C.green}}>{'\u2713'} Sent - Medsa support will follow up.</div>
              : <>
                  <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="Describe the issue…" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'10px',fontFamily:'inherit',resize:'vertical'}}/>
                  <Btn variant="primary" style={{width:'100%'}} onClick={handleSubmit} disabled={saving||!message.trim()}>{saving?'Sending…':'Send'}</Btn>
                </>}
          </Card>}
        </div>
      ))}
    </div>
  )
}

// ── PRICE LIST — the service catalog ConsultationScreen's "Add treatment
// or charge" picker draws from. Never had any admin UI at all before this -
// bulk CSV upload is the real way a practice manager gets their actual
// price list in, one row per service, rather than typing each in by hand.
function PriceListScreen({ medicineType }) {
  const [items,setItems]=useState([])
  const [loading,setLoading]=useState(true)
  const [bulkResult,setBulkResult]=useState(null)
  const [adding,setAdding]=useState(false)
  const [saving,setSaving]=useState(false)
  const [form,setForm]=useState({ name:'', category:'', default_price:'' })
  const [editingId,setEditingId]=useState(null)
  const [editForm,setEditForm]=useState({ name:'', category:'', default_price:'' })
  const [editSaving,setEditSaving]=useState(false)

  // Same vocabulary the consultation screen's catalog filter uses
  // (ConsultationScreen.catalogClinicType) - 'chinese' maps to 'tcm',
  // everything else to 'western'. Items saved here MUST match that or
  // they silently never show up in the doctor's picker.
  const catalogClinicType = medicineType==='chinese' ? 'tcm' : 'western'

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('service_items').select('*').order('category').order('name')
    setItems(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleBulkFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const rows = parseCSV(text)
    let imported = 0
    const skipped = []
    // A human-typed CSV clinic_type column ("Western", " general ", etc)
    // won't match the exact lowercase values the consultation picker
    // filters on ('western'/'tcm'/'general') - normalize it, and only
    // trust it if it's actually one of those three once normalized,
    // otherwise fall back to this clinic's own type so a typo can't
    // silently make an imported row invisible to the picker.
    const KNOWN_CLINIC_TYPES = ['western', 'tcm', 'general']
    for (const row of rows) {
      if (!row.name?.trim() || !row.default_price?.trim()) { skipped.push(`${row.name||'(no name)'} - name and default_price required`); continue }
      const normalizedType = row.clinic_type?.trim().toLowerCase()
      await supabase.from('service_items').insert({
        name: row.name.trim(), name_tc: row.name_tc?.trim()||null,
        category: row.category?.trim()||'General', default_price: parseFloat(row.default_price)||0,
        clinic_type: KNOWN_CLINIC_TYPES.includes(normalizedType) ? normalizedType : catalogClinicType,
        active: true,
      })
      imported++
    }
    setBulkResult({ imported, skipped, total: rows.length })
    load()
  }

  async function handleAdd() {
    if (!form.name.trim() || !form.default_price) return
    setSaving(true)
    await supabase.from('service_items').insert({
      name: form.name.trim(), category: form.category.trim()||'General',
      default_price: parseFloat(form.default_price)||0, clinic_type: catalogClinicType, active: true,
    })
    setSaving(false)
    setAdding(false)
    setForm({ name:'', category:'', default_price:'' })
    load()
  }

  // The one item ConsultationScreen auto-adds as the first line item on
  // every new consultation, for this clinic_type - explicit, instead of
  // the screen guessing by name match (which could land on any clinic's
  // "...consult..."-named item, not necessarily this one). Only one
  // default per clinic_type, so setting a new one clears the old.
  // A real toggle, not a one-way pick - the button used to disappear
  // once an item became the default, so there was no way to unset it
  // short of making a different item default instead. Default is global
  // (one item across the whole price list) now that the doctor's picker
  // also shows the whole list rather than filtering by clinic type.
  async function toggleDefault(item) {
    if (item.is_default) {
      await supabase.from('service_items').update({ is_default: false }).eq('id', item.id)
    } else {
      await supabase.from('service_items').update({ is_default: false }).eq('is_default', true)
      // Force active:true together with is_default - the doctor's picker
      // only ever shows active items, so a default set on a deactivated
      // one is invisible to it and silently falls back to a name-match
      // guess instead. A default that can't actually show up is not a
      // real default.
      await supabase.from('service_items').update({ is_default: true, active: true }).eq('id', item.id)
    }
    load()
  }

  async function deleteItem(item) {
    if (!window.confirm(`Delete "${item.name}" from the price list? This can't be undone.`)) return
    await supabase.from('service_items').delete().eq('id', item.id)
    load()
  }

  function startEdit(item) {
    setEditingId(item.id)
    setEditForm({ name: item.name||'', category: item.category||'', default_price: String(item.default_price ?? '') })
  }

  async function saveEdit(item) {
    if (!editForm.name.trim() || !editForm.default_price) return
    setEditSaving(true)
    await supabase.from('service_items').update({
      name: editForm.name.trim(), category: editForm.category.trim()||'General',
      default_price: parseFloat(editForm.default_price) || 0,
    }).eq('id', item.id)
    setEditSaving(false)
    setEditingId(null)
    load()
  }

  return (
    <PageWrap maxWidth={560}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'8px',textAlign:'center'}}>Price List</h2>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px',textAlign:'center'}}>The service catalog doctors pick from when adding a treatment or charge to a consultation. CSV needs name and default_price per row (category and clinic_type optional - clinic_type defaults to this clinic's own medicine type if left blank).</div>

      <label style={{display:'inline-block',fontSize:'12px',fontWeight:600,padding:'9px 16px',borderRadius:'10px',cursor:'pointer',background:C.card,color:C.textSub,marginBottom:'12px'}}>
        {'↑'} Bulk import price list CSV
        <input type="file" accept=".csv" onChange={handleBulkFile} style={{display:'none'}}/>
      </label>
      {bulkResult&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:C.green}}>
        Imported {bulkResult.imported} of {bulkResult.total} rows.
        {bulkResult.skipped.length>0&&<div style={{marginTop:'4px'}}>Skipped: {bulkResult.skipped.join(', ')}</div>}
      </div>}

      {!adding&&<Btn variant="primary" style={{width:'100%',marginBottom:'16px'}} onClick={()=>setAdding(true)}>+ Add one item</Btn>}
      {adding&&<Card style={{padding:'16px',marginBottom:'16px'}}>
        <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Service name" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}/>
        <input value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="Category (optional)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}/>
        <input type="number" step="0.01" value={form.default_price} onChange={e=>setForm(f=>({...f,default_price:e.target.value}))} placeholder="Price (HK$)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:'8px'}}>
          <Btn style={{flex:1}} onClick={()=>setAdding(false)}>Cancel</Btn>
          <Btn variant="primary" style={{flex:1}} onClick={handleAdd} disabled={saving||!form.name.trim()||!form.default_price}>{saving?'Saving…':'Add'}</Btn>
        </div>
      </Card>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&items.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>No items yet - bulk import a CSV or add one above.</div>}
      {!loading&&items.map(item=>(
        <div key={item.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'8px'}}>
          {editingId===item.id ? (
            <>
              <input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} placeholder="Service name" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px',fontSize:'13px',marginBottom:'6px',boxSizing:'border-box'}}/>
              <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
                <input value={editForm.category} onChange={e=>setEditForm(f=>({...f,category:e.target.value}))} placeholder="Category" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px',fontSize:'12px',boxSizing:'border-box'}}/>
                <input type="number" step="0.01" value={editForm.default_price} onChange={e=>setEditForm(f=>({...f,default_price:e.target.value}))} placeholder="Price" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px',fontSize:'12px',boxSizing:'border-box'}}/>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>setEditingId(null)}>Cancel</Btn>
                <Btn variant="primary" style={{flex:1,fontSize:'12px'}} disabled={editSaving} onClick={()=>saveEdit(item)}>{editSaving?'Saving…':'Save'}</Btn>
              </div>
            </>
          ) : (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{item.name}{item.is_default&&<span style={{marginLeft:'6px',fontSize:'10px',fontWeight:700,color:C.green,background:C.greenXLight,borderRadius:'4px',padding:'2px 6px'}}>DEFAULT</span>}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{item.category} · {item.clinic_type} · HK${item.default_price}</div>
              </div>
              <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                <button onClick={()=>startEdit(item)} style={{padding:'6px 12px',background:C.card,color:C.textSub,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Edit</button>
                <button onClick={()=>toggleDefault(item)} style={{padding:'6px 12px',background:item.is_default?C.green:C.card,color:item.is_default?'#fff':C.textSub,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>{item.is_default?'Default ✓':'Set as default'}</button>
                <button onClick={()=>deleteItem(item)} style={{padding:'6px 12px',background:C.redLight,color:C.red,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </PageWrap>
  )
}

// Bulk-seed icd10_reference, the table the diagnosis typeahead in
// ConsultationScreen already queries - that search box was always
// real, it just had nothing to search because nobody had a way to
// load codes into it.
function DiagnosisCodesScreen() {
  const [codes,setCodes]=useState([])
  const [loading,setLoading]=useState(true)
  const [bulkResult,setBulkResult]=useState(null)
  const [adding,setAdding]=useState(false)
  const [saving,setSaving]=useState(false)
  const [form,setForm]=useState({ code:'', label:'' })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('icd10_reference').select('*').order('code').limit(500)
    setCodes(data||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleBulkFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const rows = parseCSV(text)
    let imported = 0
    const skipped = []
    for (const row of rows) {
      if (!row.code?.trim() || !row.label?.trim()) { skipped.push(`${row.code||'(no code)'} - code and label both required`); continue }
      await supabase.from('icd10_reference').insert({ code: row.code.trim(), label: row.label.trim() })
      imported++
    }
    setBulkResult({ imported, skipped, total: rows.length })
    load()
  }

  async function handleAdd() {
    if (!form.code.trim() || !form.label.trim()) return
    setSaving(true)
    await supabase.from('icd10_reference').insert({ code: form.code.trim(), label: form.label.trim() })
    setSaving(false)
    setAdding(false)
    setForm({ code:'', label:'' })
    load()
  }

  async function handleDelete(c) {
    await supabase.from('icd10_reference').delete().eq('code', c.code)
    load()
  }

  return (
    <PageWrap maxWidth={560}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'8px',textAlign:'center'}}>Diagnosis Codes</h2>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px',textAlign:'center'}}>The ICD-10 reference the diagnosis search box on a consultation suggests from. CSV needs a code and label column per row (e.g. J06.9, Acute upper respiratory infection).</div>

      <label style={{display:'inline-block',fontSize:'12px',fontWeight:600,padding:'9px 16px',borderRadius:'10px',cursor:'pointer',background:C.card,color:C.textSub,marginBottom:'12px'}}>
        {'↑'} Bulk import ICD-10 CSV
        <input type="file" accept=".csv" onChange={handleBulkFile} style={{display:'none'}}/>
      </label>
      {bulkResult&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:C.green}}>
        Imported {bulkResult.imported} of {bulkResult.total} rows.
        {bulkResult.skipped.length>0&&<div style={{marginTop:'4px'}}>Skipped: {bulkResult.skipped.join(', ')}</div>}
      </div>}

      {!adding&&<Btn variant="primary" style={{width:'100%',marginBottom:'16px'}} onClick={()=>setAdding(true)}>+ Add one code</Btn>}
      {adding&&<Card style={{padding:'16px',marginBottom:'16px'}}>
        <input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))} placeholder="ICD-10 code (e.g. J06.9)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}/>
        <input value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} placeholder="Description" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:'8px'}}>
          <Btn style={{flex:1}} onClick={()=>setAdding(false)}>Cancel</Btn>
          <Btn variant="primary" style={{flex:1}} onClick={handleAdd} disabled={saving||!form.code.trim()||!form.label.trim()}>{saving?'Saving…':'Add'}</Btn>
        </div>
      </Card>}

      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}
      {!loading&&codes.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>No codes yet - bulk import a CSV or add one above.</div>}
      {!loading&&codes.length>0&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'8px'}}>{codes.length} code{codes.length===1?'':'s'} loaded{codes.length>=500?' (showing first 500)':''}</div>}
      {!loading&&codes.map(c=>(
        <div key={c.code} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px'}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:600}}>{c.code}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{c.label}</div>
          </div>
          <button onClick={()=>handleDelete(c)} style={{padding:'6px 12px',background:C.redLight,color:C.red,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>Remove</button>
        </div>
      ))}
    </PageWrap>
  )
}

function PracticeManagerStaffScreen({ staffMember, institutionId }) {
  const [tab,setTab]=useState('roster')
  const [staff,setStaff]=useState([])
  const [leaves,setLeaves]=useState([])
  const [showAddLeave,setShowAddLeave]=useState(false)
  const [newLeaveStaffName,setNewLeaveStaffName]=useState('')
  const [newLeaveType,setNewLeaveType]=useState('Annual Leave')
  const [newLeaveStart,setNewLeaveStart]=useState('')
  const [newLeaveEnd,setNewLeaveEnd]=useState('')
  const [newLeaveReason,setNewLeaveReason]=useState('')
  const [addingLeave,setAddingLeave]=useState(false)
  const [loading,setLoading]=useState(true)
  const [showOnboard,setShowOnboard]=useState(false)
  const [newFirstName,setNewFirstName]=useState('')
  const [newLastName,setNewLastName]=useState('')
  const [newRole,setNewRole]=useState('doctor')
  const [newDept,setNewDept]=useState('')
  const [newReg,setNewReg]=useState('')
  const [newRegisteringBody,setNewRegisteringBody]=useState('')
  const [newExpiry,setNewExpiry]=useState('')
  const [newDisciplinary,setNewDisciplinary]=useState('clear')
  const [newSex,setNewSex]=useState('')
  const [newDob,setNewDob]=useState('')
  const [newEpcLink,setNewEpcLink]=useState('')
  const [newHkid,setNewHkid]=useState('')
  const [newEmail,setNewEmail]=useState('')
  const [editingEmailId,setEditingEmailId]=useState(null)
  const [editEmailValue,setEditEmailValue]=useState('')
  const [editingCredentialsId,setEditingCredentialsId]=useState(null)
  const [credEditForm,setCredEditForm]=useState({})
  const [confirmingId,setConfirmingId]=useState(null)

  // Anyone onboarded before the email field existed has no way to use
  // "Forgot password" until this is filled in - lets a practice manager
  // fix that themselves instead of needing a SQL update run for them.
  async function handleSaveEmail(person) {
    await supabase.from('staff_credentials').update({ email: editEmailValue.trim()||null }).eq('id', person.id)
    setEditingEmailId(null)
    load()
  }

  // Practice manager editing someone else's credentials is itself the
  // verification act (same trust level as onboarding them in the first
  // place) - applies immediately, no separate confirm step. Contrast with
  // handleConfirmCredentialUpdate below, for when the STAFF MEMBER edited
  // their own record from My Credentials - that one does need a second
  // set of eyes.
  function startEditCredentials(s) {
    setEditingCredentialsId(s.id)
    setCredEditForm({
      department: s.department||'', registration_number: s.registration_number||'',
      registration_expiry: s.registration_expiry||'', epc_link: s.epc_link||'', hkid: s.hkid||'',
      registering_body: s.registering_body||'',
    })
  }
  async function handleSaveCredentials(person) {
    await supabase.from('staff_credentials').update({
      department: credEditForm.department.trim()||null,
      registration_number: credEditForm.registration_number.trim()||null,
      registration_expiry: credEditForm.registration_expiry||null,
      epc_link: credEditForm.epc_link.trim()||null,
      hkid: credEditForm.hkid.trim()||null,
      registering_body: credEditForm.registering_body.trim()||null,
    }).eq('id', person.id)
    setEditingCredentialsId(null)
    load()
  }

  // Confirms a credential change the STAFF MEMBER submitted themselves
  // (My Credentials → Edit) - verification_status got flipped back to
  // 'pending' the moment they saved it, same signal PractitionerApp
  // already uses for a self-submitted update on an otherwise-active
  // record. This is the practice manager reviewing it and signing off,
  // not re-doing the edit.
  async function handleConfirmCredentialUpdate(person) {
    setConfirmingId(person.id)
    await supabase.from('staff_credentials').update({
      verification_status: 'verified', confirmed_by: staffMember?.name, last_verified_at: new Date().toISOString(),
    }).eq('id', person.id)
    setConfirmingId(null)
    load()
  }
  const [newIsNurse,setNewIsNurse]=useState(false)
  const [newMchkDeclared,setNewMchkDeclared]=useState(false)
  const [newSchemes,setNewSchemes]=useState([])
  const [onboardError,setOnboardError]=useState(null)
  const [bulkImportResult,setBulkImportResult]=useState(null)
  const [newPin,setNewPin]=useState('')
  const [newPinConfirm,setNewPinConfirm]=useState('')
  const [uploadedDocUrl,setUploadedDocUrl]=useState(null)
  const [uploadedDocName,setUploadedDocName]=useState(null)
  const [uploading,setUploading]=useState(false)

  async function handleDocUpload(file) {
    setUploading(true)
    setUploadedDocName(file.name)
    // Requires a Supabase Storage bucket named 'staff-documents' to exist -
    // this is new infrastructure, not previously used anywhere in the app.
    // Create it once in Supabase Dashboard -> Storage -> New bucket.
    const path = `clinic_ops/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('staff-documents').upload(path, file)
    if (!error) {
      // Storing the path, not a public URL - professional registration
      // documents shouldn't be openly accessible to anyone with a link.
      // A signed URL should be generated on demand if/when a real "view
      // document" feature is built - this field is currently write-only,
      // nothing in the app displays it back yet.
      setUploadedDocUrl(path)
    }
    setUploading(false)
  }
  const [saving,setSaving]=useState(false)

  async function load() {
    setLoading(true)
    // Real bug found here: this queried a table (clinic_leave_requests)
    // that was never actually created - the real table is leave_requests
    // (same one the shelved PractitionerApp uses). The query was failing
    // silently every time (setLeaves(l||[]) just became an empty array
    // on error), so this tab always showed "No pending leave requests"
    // regardless of what was actually on file. Also no longer filters to
    // status='pending' only - an approved leave needs to stay visible
    // somewhere so anyone can see who's actually out, not disappear the
    // moment it's approved.
    const [{data:s},{data:l}] = await Promise.all([
      supabase.from('staff_credentials').select(STAFF_CREDENTIALS_SAFE_COLUMNS).eq('institution_source','clinic_ops').eq('status','active').order('full_name'),
      supabase.from('leave_requests').select('*').eq('institution_source','clinic_ops').order('start_date'),
    ])
    setStaff(s||[])
    setLeaves(l||[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const expiringSoon = staff.filter(s => s.registration_expiry && new Date(s.registration_expiry) <= new Date(Date.now()+120*24*60*60*1000))
  const pendingLeaves = leaves.filter(l => l.status==='pending')
  const today = new Date().toISOString().slice(0,10)
  const upcomingLeaves = leaves.filter(l => l.status==='approved' && l.end_date >= today)

  async function handleStaffBulkFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!institutionId) { setBulkImportResult({ imported:0, skipped:0, total:0, error:'Institution not resolved yet - try again in a moment.' }); return }
    const text = await file.text()
    const rows = parseCSV(text)
    let imported=0
    const skippedRows = []
    const newLogins = []
    for (const row of rows) {
      if (!row.full_name || !row.role || !row.department) { skippedRows.push(`${row.full_name||'(no name)'} - missing full_name/role/department`); continue }
      if (!row.email?.trim()) { skippedRows.push(`${row.full_name} - email required (used for password reset)`); continue }
      if (row.role==='doctor' && !row.date_of_birth) { skippedRows.push(`${row.full_name} - doctors require date_of_birth`); continue }
      const rowIsNurse = row.role==='clinic_assistant' && ['true','yes','1'].includes((row.is_nurse||'').toLowerCase())
      // e-PC and HKID required per row for doctors and nurse-flagged
      // assistants - e-PC is the real scan target itself (see epc_link
      // below), HKID + e-PC together are the real identity match used
      // to recognise the same person already onboarded at another
      // clinic, rather than blocking on a repeat e-PC as a "duplicate."
      const rowNeedsEpc = EPC_TRACK_ROLES.includes(row.role) || rowIsNurse
      if (rowNeedsEpc && !row.epc_link?.trim()) { skippedRows.push(`${row.full_name} - e-PC link required for doctors/nurses`); continue }
      if (rowNeedsEpc && !row.hkid?.trim()) { skippedRows.push(`${row.full_name} - HKID required for doctors/nurses`); continue }
      const medsaId = `MED-${Date.now().toString(36).toUpperCase()}-${imported}`
      let practitionerIdentityId = null
      if (rowNeedsEpc) {
        const { data: existingIdentity } = await supabase.from('practitioner_identities')
          .select('id').eq('hkid', row.hkid.trim()).eq('epc_link', row.epc_link.trim()).maybeSingle()
        if (existingIdentity) {
          practitionerIdentityId = existingIdentity.id
        } else {
          const { data: newIdentity, error: identityErr } = await supabase.from('practitioner_identities').insert({
            hkid: row.hkid.trim(), epc_link: row.epc_link.trim(), full_name: row.full_name, registration_number: row.registration_number||null,
          }).select().maybeSingle()
          if (identityErr) { skippedRows.push(`${row.full_name} - ${identityErr.message}`); continue }
          practitionerIdentityId = newIdentity?.id || null
        }
      }
      const { error: insErr } = await supabase.from('staff_credentials').insert({
        institution_source:'clinic_ops', institution_id:institutionId, medsa_id:medsaId,
        full_name:row.full_name, email:row.email.trim(), role:row.role, department:row.department,
        registration_number:row.registration_number||null, registration_expiry:row.registration_expiry||null,
        registering_body: ACCREDITED_REGISTER_ROLES.includes(row.role) ? (row.registering_body||null) : null,
        sex:row.sex||null, date_of_birth:row.date_of_birth||null,
        has_epc: !!row.epc_link?.trim(),
        is_nurse: rowIsNurse,
        epc_link: row.epc_link?.trim() || null,
        hkid: rowNeedsEpc ? row.hkid.trim() : null, practitioner_identity_id: practitionerIdentityId,
        // Deliberately never true via bulk import, regardless of CSV
        // content - this is a personal legal declaration a doctor makes
        // about themselves, not something an admin import can set on
        // their behalf. Each doctor confirms this individually later.
        mchk_declaration_agreed: false, mchk_declaration_timestamp: null,
        schemes: row.role==='doctor' && row.schemes ? row.schemes.split(';').map(s=>s.trim()).filter(Boolean) : null,
        disciplinary_status: row.disciplinary_status||'none', onboarded_by:staffMember?.name, status:'active',
        verification_status:'verified',
        // Automatic at onboarding, not a separate manual grant - the
        // portal should always exist for a doctor or nurse-flagged
        // clinic assistant, whether or not they actually choose to use
        // it. A practice manager can still revoke it later if needed.
        practitioner_portal_enabled: row.role==='doctor' || rowIsNurse,
        practitioner_portal_granted_by: 'onboarding', practitioner_portal_granted_at: new Date().toISOString(),
      })
      if (insErr) { skippedRows.push(`${row.full_name} - ${insErr.message}`); continue }
      // A fixed password shared by every bulk-imported account (as this
      // used to be) is a real credential leak risk - it's sitting in
      // plain sight in the deployed frontend bundle. Each person now
      // gets their own random one-time temp password instead, shown
      // once here for the practice manager to hand off.
      const tempPassword = generateTempPassword()
      await supabase.rpc('set_staff_password', { p_medsa_id: medsaId, p_new_password: tempPassword })
      newLogins.push({ name: row.full_name, medsaId, tempPassword })
      imported++
    }
    setBulkImportResult({ imported, skipped: skippedRows.length, skippedRows, total: rows.length, newLogins })
  }

  async function handleOnboard() {
    if (!newFirstName || !newDept || !newPin) return
    if (!newEmail?.trim()) { setOnboardError('Email is required - it\'s how this person resets their own password later.'); return }
    if (newPin.length < 8) { setOnboardError('Password must be at least 8 characters.'); return }
    if (!/[0-9]/.test(newPin)) { setOnboardError('Password must contain at least one number.'); return }
    if (!/[A-Z]/.test(newPin)) { setOnboardError('Password must contain at least one capital letter.'); return }
    if (!/[^A-Za-z0-9]/.test(newPin)) { setOnboardError('Password must contain at least one special character.'); return }
    if (newPin !== newPinConfirm) { setOnboardError('Password and confirmation don\'t match.'); return }
    if (newRole==='doctor' && !newDob) return
    const needsEpc = EPC_TRACK_ROLES.includes(newRole)||(newRole==='clinic_assistant'&&newIsNurse)
    if (needsEpc && !newEpcLink?.trim()) { setOnboardError('A real e-PC (electronic Practising Certificate) link is required.'); return }
    if (needsEpc && !newHkid?.trim()) { setOnboardError('HKID is required - together with e-PC, it’s how Medsa recognises this is the same real person if they also work at another clinic.'); return }
    if (ACCREDITED_REGISTER_ROLES.includes(newRole) && !newRegisteringBody?.trim()) { setOnboardError('Registering body is required for this profession.'); return }
    setSaving(true)
    setOnboardError(null)

    // HKID + e-PC together are the real identity match - if this exact
    // pair already exists (same person onboarded at another clinic),
    // reuse that identity instead of creating a disconnected new one.
    let practitionerIdentityId = null
    if (needsEpc) {
      const { data: existingIdentity } = await supabase.from('practitioner_identities')
        .select('id').eq('hkid', newHkid.trim()).eq('epc_link', newEpcLink.trim()).maybeSingle()
      if (existingIdentity) {
        practitionerIdentityId = existingIdentity.id
      } else {
        const { data: newIdentity, error: identityErr } = await supabase.from('practitioner_identities').insert({
          hkid: newHkid.trim(), epc_link: newEpcLink.trim(),
          full_name: `${newFirstName}${newLastName?' '+newLastName:''}`, registration_number: newReg||null,
        }).select().maybeSingle()
        if (identityErr) { setSaving(false); setOnboardError(identityErr.message); return }
        practitionerIdentityId = newIdentity?.id || null
      }
    }

    const newMedsaId = `MED-${Date.now().toString(36).toUpperCase()}`
    const { error: onboardErr } = await supabase.from('staff_credentials').insert({
      institution_source:'clinic_ops', institution_id:institutionId, medsa_id:newMedsaId,
      full_name:`${newFirstName}${newLastName?' '+newLastName:''}`, email:newEmail.trim(), role:newRole, department:newDept,
      registration_number:newReg||null, registration_expiry:newExpiry||null,
      registration_doc_url:uploadedDocUrl||null,
      registering_body: ACCREDITED_REGISTER_ROLES.includes(newRole) ? newRegisteringBody.trim() : null,
      sex:newSex||null, date_of_birth:newDob||null,
      has_epc: !!newEpcLink?.trim(), epc_link: newEpcLink?.trim() || null,
      hkid: needsEpc ? newHkid.trim() : null, practitioner_identity_id: practitionerIdentityId,
      is_nurse: newRole==='clinic_assistant' ? newIsNurse : false,
      mchk_declaration_agreed: newRole==='doctor' ? newMchkDeclared : false,
      mchk_declaration_timestamp: (newRole==='doctor' && newMchkDeclared) ? new Date().toISOString() : null,
      schemes: newRole==='doctor' ? newSchemes : null,
      disciplinary_status:newDisciplinary, onboarded_by:staffMember?.name, status:'active',
      verification_status:'verified',
      practitioner_portal_enabled: newRole==='doctor' || (newRole==='clinic_assistant' && newIsNurse),
      practitioner_portal_granted_by: 'onboarding', practitioner_portal_granted_at: new Date().toISOString(),
    })
    if (onboardErr) { setSaving(false); setOnboardError(onboardErr.message); return }
    // Real hashing happens here, server-side inside Postgres - the plain
    // password entered above is never written to any column directly.
    const { error: pwErr } = await supabase.rpc('set_staff_password', { p_medsa_id: newMedsaId, p_new_password: newPin })
    setSaving(false)
    if (pwErr) { setOnboardError(`Staff created, but setting password failed: ${pwErr.message}`); return }
    setShowOnboard(false)
    setNewFirstName('');setNewLastName('');setNewEmail('');setNewDept('');setNewReg('');setNewExpiry('');setNewDisciplinary('clear');setNewPin('');setNewPinConfirm('');setUploadedDocUrl(null);setUploadedDocName(null)
    setNewSex('');setNewDob('');setNewEpcLink('');setNewHkid('');setNewIsNurse(false);setNewMchkDeclared(false);setNewSchemes([]);setNewRegisteringBody('')
    load()
  }

  async function handleOffboard(person) {
    if (!window.confirm(`Offboard ${person.full_name}? This can't be reversed - they'll immediately lose access and drop off every roster/queue. Re-onboarding afterward creates a brand new account, not a restore.`)) return
    await supabase.from('staff_credentials').update({ status:'offboarded', offboarded_by:staffMember?.name, offboarded_at:new Date().toISOString() }).eq('id', person.id)
    load()
  }

  async function handleLeaveDecision(leave, approve) {
    await supabase.from('leave_requests').update({ status: approve?'approved':'denied', reviewed_by:staffMember?.name }).eq('id', leave.id)
    load()
  }

  // Direct way to put someone on leave - there was no way to create a
  // leave entry anywhere in the app at all (only this approve/deny
  // queue existed, with nothing that ever fed it a request). A practice
  // manager creating one directly is its own approval, so it's saved
  // already-approved under their own name rather than needing a second
  // person to approve themselves.
  async function handleAddLeave() {
    if (!newLeaveStaffName || !newLeaveStart || !newLeaveEnd) return
    const person = staff.find(s => s.full_name === newLeaveStaffName)
    setAddingLeave(true)
    await supabase.from('leave_requests').insert({
      institution_source: 'clinic_ops', staff_name: newLeaveStaffName, department: person?.department || 'All departments',
      leave_type: newLeaveType, start_date: newLeaveStart, end_date: newLeaveEnd, reason: newLeaveReason.trim()||null,
      status: 'approved', reviewed_by: staffMember?.name, is_discretionary: true,
    })
    setAddingLeave(false)
    setShowAddLeave(false)
    setNewLeaveStaffName(''); setNewLeaveType('Annual Leave'); setNewLeaveStart(''); setNewLeaveEnd(''); setNewLeaveReason('')
    load()
  }

  return (
    <div>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
        {[['roster','Staff'],['expiring',`Expiring${expiringSoon.length?` (${expiringSoon.length})`:''}`],['leave',`Leave${pendingLeaves.length?` (${pendingLeaves.length})`:''}`]].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{padding:'8px 16px',borderRadius:'8px',fontSize:'13px',fontWeight:500,cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.textSub}}>{l}</div>
        ))}
      </div>

      <label style={{display:'inline-block',fontSize:'12px',fontWeight:600,padding:'9px 16px',borderRadius:'10px',cursor:'pointer',background:C.card,color:C.textSub,marginBottom:'12px'}}>
        {'\u2191'} Bulk import staff CSV
        <input type="file" accept=".csv" onChange={handleStaffBulkFile} style={{display:'none'}}/>
      </label>
      <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px'}}>Requires full_name, email (used for password reset), role (doctor / clinic_assistant / admin), department per row (doctors also require date_of_birth). Doctors and nurse-flagged clinic assistants also require epc_link and hkid - together these are the real identity match: if the same HKID + e-PC is already on file from another clinic, this links to that same practitioner instead of creating a disconnected new one, so they log in once and switch clinics. Add is_nurse (true/false) for a clinic_assistant who's also a credentialed nurse. Everyone imported gets their own real, hashed, random one-time temporary password (shown below after import) - each person changes it themselves once they can log in. Doctors still confirm their own MCHK declaration individually; this is never set on their behalf. Staff without an e-PC (not a doctor or nurse) are onboarded separately by Medsa directly with their own generated QR code.</div>
      {bulkImportResult&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:C.green}}>
        Staff import: {bulkImportResult.imported} of {bulkImportResult.total} rows imported{bulkImportResult.skipped>0?`, ${bulkImportResult.skipped} skipped`:''}.
        {bulkImportResult.skippedRows?.length>0&&<div style={{marginTop:'4px'}}>Skipped: {bulkImportResult.skippedRows.join(', ')}</div>}
        {bulkImportResult.newLogins?.length>0&&<div style={{marginTop:'8px'}}>
          <div style={{fontWeight:600,marginBottom:'4px'}}>One-time temporary passwords - write these down, they won't be shown again:</div>
          {bulkImportResult.newLogins.map(l=>(
            <div key={l.medsaId}>{l.name} ({l.medsaId}): {l.tempPassword}</div>
          ))}
        </div>}
      </div>}

      {loading&&<div style={{padding:'20px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}

      {!loading&&tab==='roster'&&<>
        {!showOnboard&&<button onClick={()=>setShowOnboard(true)} style={{padding:'10px 18px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer',marginBottom:'16px'}}>+ Onboard staff</button>}
        {showOnboard&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'20px',marginBottom:'16px',maxWidth:420}}>
          <input value={newFirstName} onChange={e=>setNewFirstName(e.target.value)} placeholder="First name" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input value={newLastName} onChange={e=>setNewLastName(e.target.value)} placeholder="Last name" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="Email (required - used for password reset)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <select value={newRole==='clinic_assistant'&&newIsNurse ? 'nurse' : newRole} onChange={e=>{
            const v = e.target.value
            if (v==='nurse') { setNewRole('clinic_assistant'); setNewIsNurse(true) }
            else { setNewRole(v); setNewIsNurse(false) }
          }} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px'}}>
            <option value="doctor">Doctor</option>
            <option value="nurse">Nurse</option>
            <option value="clinic_assistant">Clinic Assistant</option>
            <option value="admin">Practice Manager</option>
            <optgroup label="Allied health - statutory board (e-PC)">
              <option value="physiotherapist">Physiotherapist</option>
              <option value="occupational_therapist">Occupational Therapist</option>
              <option value="optometrist">Optometrist</option>
              <option value="radiographer">Radiographer</option>
              <option value="medical_lab_technologist">Medical Laboratory Technologist</option>
            </optgroup>
            <optgroup label="Allied health - accredited register">
              <option value="speech_therapist">Speech Therapist</option>
              <option value="dietitian">Dietitian</option>
              <option value="clinical_psychologist">Clinical Psychologist</option>
            </optgroup>
          </select>
          <input value={newDept} onChange={e=>setNewDept(e.target.value)} placeholder="Speciality (e.g. General, Chinese Medicine, Physio)" list="dept-suggestions" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <datalist id="dept-suggestions">
            {[...new Set(staff.map(s=>s.department).filter(Boolean))].map(d=><option key={d} value={d}/>)}
          </datalist>
          <select value={newSex} onChange={e=>setNewSex(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px'}}>
            <option value="">Sex</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          {newRole==='doctor'&&<>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Date of birth (required for doctors)</div>
            <input type="date" value={newDob} onChange={e=>setNewDob(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          </>}
          <input value={newReg} onChange={e=>setNewReg(e.target.value)} placeholder="Registration number" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          {ACCREDITED_REGISTER_ROLES.includes(newRole)&&<>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Registering body - required. This profession has no government e-PC; their credential is a live status on their own society's voluntary register (e.g. "HKASLT" for a speech therapist).</div>
            <input value={newRegisteringBody} onChange={e=>setNewRegisteringBody(e.target.value)} placeholder="Registering body / society" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          </>}
          {(EPC_TRACK_ROLES.includes(newRole)||(newRole==='clinic_assistant'&&newIsNurse))&&<>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>e-PC (electronic Practising Certificate) - required. This is the real government-issued identifier and the actual scan target itself (MCHK for doctors, the Allied Health Practitioners Council for the 5 statutory-board allied health professions) - not a separate Medsa-generated code.</div>
            <input value={newEpcLink} onChange={e=>setNewEpcLink(e.target.value)} placeholder="e-PC government verification link" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>HKID - required. Together with e-PC, this is how Medsa recognises the same real person if they also work at another clinic, so they log in once and switch clinics instead of getting a second, disconnected account.</div>
            <input value={newHkid} onChange={e=>setNewHkid(e.target.value)} placeholder="HKID" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          </>}
          {newRole==='clinic_assistant'&&!newIsNurse&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{'\u25c7'} No e-PC required - Medsa will onboard this person separately with their own generated QR code (a paid, Medsa-run process, not urgent).</div>}
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>Registration/license expiry</div>
          <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px',marginTop:'-6px'}}>Enter manually for now - no public MCHK API exists yet to cross-check this automatically against live license status.</div>
          <input type="date" value={newExpiry} onChange={e=>setNewExpiry(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>License / registration document, or other relevant copy</div>
          <label style={{display:'block',width:'100%',padding:'10px',border:`1px dashed ${C.border}`,borderRadius:'8px',fontSize:'12px',color:C.textSub,textAlign:'center',cursor:'pointer',marginBottom:'10px',boxSizing:'border-box'}}>
            {uploadedDocName || 'Tap to upload (PDF or image)'}
            <input type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={e=>e.target.files[0]&&handleDocUpload(e.target.files[0])}/>
          </label>
          {uploading&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>Uploading…</div>}
          <input type="password" value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="Password (8+ chars, 1 number, 1 capital, 1 special)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <input type="password" value={newPinConfirm} onChange={e=>setNewPinConfirm(e.target.value)} placeholder="Confirm password" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box',border:newPinConfirm&&newPinConfirm!==newPin?`1px solid ${C.red}`:undefined}}/>
          {newPinConfirm&&newPinConfirm!==newPin&&<div style={{fontSize:'11px',color:C.red,marginTop:'-6px',marginBottom:'10px'}}>Passwords don't match.</div>}
          <select value={newDisciplinary} onChange={e=>setNewDisciplinary(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'14px'}}>
            <option value="clear">Disciplinary: Clear</option>
            <option value="flagged">Disciplinary: Flagged</option>
          </select>
          {newRole==='doctor'&&<label style={{display:'flex',alignItems:'flex-start',gap:'8px',fontSize:'12px',color:C.textSub,marginBottom:'14px',cursor:'pointer',lineHeight:1.4}}>
            <input type="checkbox" checked={newMchkDeclared} onChange={e=>setNewMchkDeclared(e.target.checked)} style={{marginTop:'2px'}}/>
            I confirm that my published service details, fees, and qualifications are accurate, non-exaggerated, and comply with Section 5 and Appendix D of the MCHK Code of Professional Conduct.
          </label>}
          {newRole==='doctor'&&<div style={{marginBottom:'14px'}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Government schemes participated in (self-declared)</div>
            {[['cdcc','Chronic Disease Co-Care (CDCC)'],['dhc_network','District Health Centre Network'],['ehcv','Elderly Health Care Voucher (EHCV)'],['vaccination_subsidy','Vaccination Subsidy Scheme']].map(([key,label])=>(
              <label key={key} style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:C.textSub,marginBottom:'6px',cursor:'pointer'}}>
                <input type="checkbox" checked={newSchemes.includes(key)} onChange={e=>setNewSchemes(s=>e.target.checked?[...s,key]:s.filter(x=>x!==key))}/>
                {label}
              </label>
            ))}
          </div>}
          {onboardError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px',padding:'8px 10px',background:C.redLight,borderRadius:'8px'}}>{onboardError}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>setShowOnboard(false)} style={{flex:1,padding:'10px',background:C.card,border:'none',borderRadius:'8px',cursor:'pointer'}}>Cancel</button>
            <button onClick={handleOnboard} disabled={saving||!newFirstName||!newEmail?.trim()||!newDept||!newPin||newPin!==newPinConfirm||(newRole==='doctor'&&(!newDob||!newMchkDeclared))||((EPC_TRACK_ROLES.includes(newRole)||(newRole==='clinic_assistant'&&newIsNurse))&&(!newEpcLink?.trim()||!newHkid?.trim()))||(ACCREDITED_REGISTER_ROLES.includes(newRole)&&!newRegisteringBody?.trim())} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontWeight:600,cursor:'pointer'}}>{saving?'Saving…':'Onboard'}</button>
          </div>
        </div>}
        {staff.map(s=>(
          <div key={s.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'8px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{s.full_name}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{s.role==='clinic_assistant'&&s.is_nurse?'Nurse':ROLE_LABELS[s.role]||s.role} · {s.department} {s.disciplinary_status==='flagged'&&<span style={{color:C.red}}>· Flagged</span>}</div>
              </div>
              <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                <button onClick={()=>startEditCredentials(s)} style={{padding:'6px 12px',background:C.card,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Edit credentials</button>
                <button onClick={()=>handleOffboard(s)} style={{padding:'6px 12px',background:C.redLight,color:C.red,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Offboard</button>
              </div>
            </div>
            {s.verification_status==='pending'&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'8px',padding:'8px 10px',marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'11px',color:C.amber}}>{'⚠'} {s.full_name} updated their own credentials - review before this counts as verified again.</span>
              <button onClick={()=>handleConfirmCredentialUpdate(s)} disabled={confirmingId===s.id} style={{padding:'5px 10px',background:C.amber,color:'#fff',border:'none',borderRadius:'6px',fontSize:'11px',cursor:'pointer',flexShrink:0}}>{confirmingId===s.id?'…':'Confirm'}</button>
            </div>}
            {editingCredentialsId===s.id&&<div style={{background:C.card,borderRadius:'8px',padding:'10px',marginBottom:'8px'}}>
              <input value={credEditForm.department} onChange={e=>setCredEditForm(f=>({...f,department:e.target.value}))} placeholder="Speciality/department" style={{width:'100%',padding:'7px 8px',fontSize:'12px',marginBottom:'6px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
              <input value={credEditForm.registration_number} onChange={e=>setCredEditForm(f=>({...f,registration_number:e.target.value}))} placeholder="Registration number" style={{width:'100%',padding:'7px 8px',fontSize:'12px',marginBottom:'6px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
              <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'2px'}}>Registration/license expiry</div>
              <input type="date" value={credEditForm.registration_expiry} onChange={e=>setCredEditForm(f=>({...f,registration_expiry:e.target.value}))} style={{width:'100%',padding:'7px 8px',fontSize:'12px',marginBottom:'6px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
              {(EPC_TRACK_ROLES.includes(s.role)||s.is_nurse)&&<>
                <input value={credEditForm.epc_link} onChange={e=>setCredEditForm(f=>({...f,epc_link:e.target.value}))} placeholder="e-PC government verification link" style={{width:'100%',padding:'7px 8px',fontSize:'12px',marginBottom:'6px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
                <input value={credEditForm.hkid} onChange={e=>setCredEditForm(f=>({...f,hkid:e.target.value}))} placeholder="HKID" style={{width:'100%',padding:'7px 8px',fontSize:'12px',marginBottom:'6px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>
              </>}
              {ACCREDITED_REGISTER_ROLES.includes(s.role)&&<input value={credEditForm.registering_body} onChange={e=>setCredEditForm(f=>({...f,registering_body:e.target.value}))} placeholder="Registering body / society" style={{width:'100%',padding:'7px 8px',fontSize:'12px',marginBottom:'6px',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}/>}
              <div style={{display:'flex',gap:'6px'}}>
                <button onClick={()=>handleSaveCredentials(s)} style={{flex:1,padding:'7px',background:C.green,color:'#fff',border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Save</button>
                <button onClick={()=>setEditingCredentialsId(null)} style={{flex:1,padding:'7px',background:C.cream,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Cancel</button>
              </div>
            </div>}
            {editingEmailId===s.id
              ? <div style={{display:'flex',gap:'6px'}}>
                  <input value={editEmailValue} onChange={e=>setEditEmailValue(e.target.value)} placeholder="Email" style={{flex:1,padding:'7px 8px',fontSize:'12px',border:`0.5px solid ${C.border}`,borderRadius:'6px',boxSizing:'border-box'}}/>
                  <button onClick={()=>handleSaveEmail(s)} style={{padding:'7px 12px',background:C.green,color:'#fff',border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Save</button>
                  <button onClick={()=>setEditingEmailId(null)} style={{padding:'7px 12px',background:C.card,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Cancel</button>
                </div>
              : <div onClick={()=>{setEditingEmailId(s.id);setEditEmailValue(s.email||'')}} style={{fontSize:'11px',color:s.email?C.textMuted:C.amber,cursor:'pointer'}}>{s.email || '⚠ No email on file - required for password reset'}{s.email&&' · edit'}</div>}
          </div>
        ))}
      </>}

      {!loading&&tab==='expiring'&&<>
        {expiringSoon.length===0&&<div style={{color:C.textMuted,fontSize:'13px'}}>Nothing expiring within 4 months.</div>}
        {expiringSoon.map(s=>(
          <div key={s.id} style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{s.full_name}</div>
            <div style={{fontSize:'12px',color:C.amber}}>Registration expires {s.registration_expiry}</div>
          </div>
        ))}
      </>}

      {!loading&&tab==='leave'&&<>
        {!showAddLeave&&<Btn variant="primary" style={{marginBottom:'16px'}} onClick={()=>setShowAddLeave(true)}>+ Put staff on leave</Btn>}
        {showAddLeave&&<Card style={{padding:'16px',marginBottom:'16px'}}>
          <select value={newLeaveStaffName} onChange={e=>setNewLeaveStaffName(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'8px'}}>
            <option value="">Select staff member</option>
            {staff.map(s=><option key={s.medsa_id} value={s.full_name}>{s.full_name}</option>)}
          </select>
          <select value={newLeaveType} onChange={e=>setNewLeaveType(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'8px'}}>
            <option>Annual Leave</option>
            <option>Sick Leave</option>
            <option>Maternity/Paternity Leave</option>
            <option>Unpaid Leave</option>
            <option>Other</option>
          </select>
          <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px'}}>Start date</div>
              <input type="date" value={newLeaveStart} onChange={e=>setNewLeaveStart(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',boxSizing:'border-box'}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'4px'}}>End date</div>
              <input type="date" value={newLeaveEnd} onChange={e=>setNewLeaveEnd(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',boxSizing:'border-box'}}/>
            </div>
          </div>
          <input value={newLeaveReason} onChange={e=>setNewLeaveReason(e.target.value)} placeholder="Reason (optional)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>setShowAddLeave(false)} style={{flex:1,padding:'10px',background:C.cream,border:'none',borderRadius:'8px',cursor:'pointer'}}>Cancel</button>
            <button onClick={handleAddLeave} disabled={addingLeave||!newLeaveStaffName||!newLeaveStart||!newLeaveEnd} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:'8px',fontWeight:600,cursor:'pointer'}}>{addingLeave?'Saving…':'Save'}</button>
          </div>
        </Card>}

        <SecLabel>Pending requests</SecLabel>
        {pendingLeaves.length===0&&<div style={{color:C.textMuted,fontSize:'13px',marginBottom:'16px'}}>No pending leave requests.</div>}
        {pendingLeaves.map(l=>(
          <div key={l.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{l.staff_name}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>{l.leave_type} · {l.start_date} to {l.end_date}{l.reason?` · ${l.reason}`:''}</div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>handleLeaveDecision(l,false)} style={{flex:1,padding:'8px',background:C.card,border:'none',borderRadius:'6px',cursor:'pointer'}}>Deny</button>
              <button onClick={()=>handleLeaveDecision(l,true)} style={{flex:1,padding:'8px',background:C.green,color:'#fff',border:'none',borderRadius:'6px',fontWeight:600,cursor:'pointer'}}>Approve</button>
            </div>
          </div>
        ))}

        <SecLabel>Upcoming / current leave</SecLabel>
        {upcomingLeaves.length===0&&<div style={{color:C.textMuted,fontSize:'13px'}}>Nobody has approved leave coming up.</div>}
        {upcomingLeaves.map(l=>(
          <div key={l.id} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{l.staff_name}</div>
            <div style={{fontSize:'12px',color:C.textSub}}>{l.leave_type} · {l.start_date} to {l.end_date}{l.reason?` · ${l.reason}`:''}{l.start_date<=today&&l.end_date>=today?<span style={{color:C.amber,fontWeight:600}}> · currently out</span>:''}</div>
          </div>
        ))}
      </>}
    </div>
  )
}

function WorkingHoursScreen() {
  const [clinicDoctors,setClinicDoctors]=useState([])
  const [selectedDoctor,setSelectedDoctor]=useState('')
  const [hours,setHours]=useState({}) // day_of_week -> {start,end,is_off}
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [slotDuration,setSlotDuration]=useState(30)

  useEffect(() => {
    loadClinicDoctors().then(docs => { setClinicDoctors(docs); if (docs[0]) setSelectedDoctor(docs[0].name) })
  }, [])

  async function loadHours(doctorName) {
    setLoading(true)
    const { data } = await supabase.from('doctor_availability').select('*')
      .eq('doctor_name', doctorName).eq('institution_source', 'clinic_ops')
    const byDay = {}
    for (let d=0; d<7; d++) byDay[d] = { start:'09:00', end:'17:00', is_off: d===0 } // default: closed Sundays
    ;(data||[]).forEach(row => {
      byDay[row.day_of_week] = { start: row.start_time?.slice(0,5)||'09:00', end: row.end_time?.slice(0,5)||'17:00', is_off: row.is_off }
      setSlotDuration(row.slot_duration_minutes || 30)
    })
    setHours(byDay)
    setLoading(false)
  }

  useEffect(() => { loadHours(selectedDoctor) }, [selectedDoctor])

  function updateDay(day, field, value) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const rows = Object.entries(hours).map(([day, h]) => ({
      doctor_name: selectedDoctor, institution_source: 'clinic_ops', day_of_week: parseInt(day),
      start_time: h.start, end_time: h.end, is_off: h.is_off, slot_duration_minutes: slotDuration,
      updated_at: new Date().toISOString(),
    }))
    await supabase.from('doctor_availability').upsert(rows, { onConflict: 'doctor_name,institution_source,day_of_week' })
    setSaving(false)
    setSaved(true)
    setTimeout(()=>setSaved(false), 2500)
  }

  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'6px',textAlign:'center'}}>Working Hours</h2>
      <div style={{fontSize:'12px',color:C.textSub,textAlign:'center',marginBottom:'20px'}}>Sets each doctor's availability - syncs to their schedule and patient booking</div>

      <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
        {clinicDoctors.map(d=>(
          <div key={d.name} onClick={()=>setSelectedDoctor(d.name)} style={{padding:'8px 14px',borderRadius:'20px',fontSize:'12px',fontWeight:500,cursor:'pointer',background:selectedDoctor===d.name?C.green:C.card,color:selectedDoctor===d.name?'#fff':C.textSub}}>{d.name}</div>
        ))}
      </div>

      {loading&&<div style={{textAlign:'center',padding:'30px',color:C.textMuted,fontSize:'13px'}}>Loading…</div>}

      {!loading&&<>
        <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>Appointment slot length</div>
          <div style={{display:'flex',gap:'8px'}}>
            {[15,20,30,45,60].map(m=>(
              <div key={m} onClick={()=>{setSlotDuration(m);setSaved(false)}} style={{flex:1,textAlign:'center',padding:'8px',borderRadius:'8px',fontSize:'12px',fontWeight:500,cursor:'pointer',background:slotDuration===m?C.green:C.card,color:slotDuration===m?'#fff':C.text}}>{m}m</div>
            ))}
          </div>
        </Card>

        {DAY_NAMES.map((dayName,i)=>{
          const h = hours[i] || {start:'09:00',end:'17:00',is_off:false}
          return (
            <Card key={i} style={{padding:'12px 16px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{width:80,fontSize:'13px',fontWeight:500,flexShrink:0}}>{dayName}</div>
              {h.is_off ? (
                <div style={{flex:1,fontSize:'12px',color:C.textMuted}}>Closed</div>
              ) : (
                <div style={{flex:1,display:'flex',gap:'8px',alignItems:'center'}}>
                  <input type="time" value={h.start} onChange={e=>updateDay(i,'start',e.target.value)} style={{border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'6px 8px',fontSize:'12px'}}/>
                  <span style={{color:C.textMuted,fontSize:'12px'}}>to</span>
                  <input type="time" value={h.end} onChange={e=>updateDay(i,'end',e.target.value)} style={{border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'6px 8px',fontSize:'12px'}}/>
                </div>
              )}
              <Toggle checked={!h.is_off} onChange={(on)=>updateDay(i,'is_off',!on)}/>
            </Card>
          )
        })}

        {saved&&<div style={{fontSize:'13px',color:C.green,textAlign:'center',marginBottom:'10px'}}>✓ Saved - synced to {selectedDoctor}'s schedule and patient booking</div>}
        <Btn variant="primary" style={{width:'100%'}} onClick={handleSave} disabled={saving}>{saving?'Saving…':`Save hours for ${selectedDoctor}`}</Btn>
      </>}
    </PageWrap>
  )
}

function ScheduleScreen({ staffMember, onGoToConsultation, onCancelCheckIn, preselectPatient, onConsumedPreselect, onNavNewPatient, onCheckedIn, onPreselectPatientForFollowup, checkInError, clinicQueues=[] }) {
  const [selectedDay,setSelectedDay]=useState(() => new Date())
  // Real current week (today + 6 days ahead) instead of a fixed hardcoded
  // month/week - this is what makes the schedule genuinely testable
  // against real time.
  const weekDates = Array.from({length:7}, (_,i) => {
    const d = new Date()
    d.setDate(d.getDate()+i)
    return d
  })
  const [showNewApptForm,setShowNewApptForm]=useState(false)
  const [newApptSearch,setNewApptSearch]=useState('')
  const [newApptPatient,setNewApptPatient]=useState(null)
  const [newApptTime,setNewApptTime]=useState('')
  const [clinicDoctors,setClinicDoctors]=useState([])
  const [newApptDoctor,setNewApptDoctor]=useState('')
  const [newApptReason,setNewApptReason]=useState('')
  const [newApptSaving,setNewApptSaving]=useState(false)
  const [newApptError,setNewApptError]=useState(null)

  // Real working-hours-based slots for the new-appointment form too - this
  // is the actual point of Working Hours syncing to booking: it should be
  // impossible to book outside a doctor's real hours from here, not just
  // from the reschedule modal.
  const [newApptSlots,setNewApptSlots]=useState([])
  const [newApptSlotsLoading,setNewApptSlotsLoading]=useState(false)

  useEffect(() => {
    loadClinicDoctors().then(docs => { setClinicDoctors(docs); if (docs[0]) setNewApptDoctor(docs[0].name) })
  }, [])

  useEffect(() => {
    async function loadSlots() {
      if (!newApptDoctor) { setNewApptSlots([]); return }
      setNewApptSlotsLoading(true)
      setNewApptTime('')
      const dayOfWeek = selectedDay.getDay()
      const { data } = await supabase.from('doctor_availability').select('*')
        .eq('doctor_name', newApptDoctor).eq('institution_source', 'clinic_ops').eq('day_of_week', dayOfWeek).maybeSingle()
      if (!data || data.is_off) { setNewApptSlots([]); setNewApptSlotsLoading(false); return }
      const slots = []
      const [startH, startM] = (data.start_time||'09:00').split(':').map(Number)
      const [endH, endM] = (data.end_time||'17:00').split(':').map(Number)
      let current = startH*60 + startM
      const end = endH*60 + endM
      while (current < end) {
        slots.push(`${String(Math.floor(current/60)).padStart(2,'0')}:${String(current%60).padStart(2,'0')}`)
        current += data.slot_duration_minutes || 30
      }
      // This form was only ever filtering by the hourly walk-in cap, never
      // actually removing a time another patient already holds - it was
      // possible to pick an already-booked slot here, and only find out it
      // was rejected after tapping Confirm (or, in the rare race, not even
      // then). Exclude any exact time this doctor already has a real,
      // non-cancelled appointment at, same as the reschedule picker and
      // the patient app's own booking screen already do.
      const dayStart = new Date(selectedDay); dayStart.setHours(0,0,0,0)
      const dayEnd = new Date(selectedDay); dayEnd.setHours(23,59,59,999)
      const { data: existingAppts } = await supabase.from('appointments').select('scheduled_at')
        .eq('doctor_name', newApptDoctor).eq('institution_source', 'clinic_ops').neq('status', 'cancelled')
        .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())
      const bookedTimes = new Set((existingAppts||[]).map(a => {
        const d = new Date(a.scheduled_at)
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      }))
      const openSlots = slots.filter(t => !bookedTimes.has(t))
      setNewApptSlots(openSlots)
      setNewApptSlotsLoading(false)
    }
    if (showNewApptForm) loadSlots()
  }, [newApptDoctor, selectedDay, showNewApptForm])

  // Arrived here after registering a new walk-in patient - open the form
  // with them already selected instead of making reception search again.
  // Also arrives here when scheduling a follow-up from the schedule
  // action modal, for the exact same reason - both cases mean the patient
  // is already known and shouldn't need re-searching.
  useEffect(() => {
    if (!preselectPatient) return
    setNewApptPatient(preselectPatient)
    setShowNewApptForm(true)
    onConsumedPreselect?.()
  }, [preselectPatient])

  async function handleNewApptSearch() {
    if (!newApptSearch.trim()) return
    const { data } = await supabase.from('patients').select('*')
      .or(`medsa_id.ilike.%${newApptSearch}%,full_name.ilike.%${newApptSearch}%`).limit(1).maybeSingle()
    setNewApptPatient(data || null)
    setNewApptError(data ? null : 'No patient found matching that name or Medsa ID.')
  }

  async function handleConfirmNewAppt() {
    if (!newApptPatient || !newApptTime) return
    setNewApptSaving(true)
    setNewApptError(null)
    const doctorInfo = clinicDoctors.find(d=>d.name===newApptDoctor)
    const scheduledAt = new Date(selectedDay)
    const [h,m] = newApptTime.split(':').map(Number)
    scheduledAt.setHours(h||9, m||0, 0, 0)
    // The slot picker above already hides times another patient holds, but
    // that's a point-in-time read - two people booking the same slot at
    // nearly the same moment could both pass that check. Re-check right
    // before writing so the second one gets a clear error instead of a
    // silent double-booking.
    const { data: clash } = await supabase.from('appointments').select('id')
      .eq('doctor_name', newApptDoctor).eq('institution_source', 'clinic_ops')
      .eq('scheduled_at', scheduledAt.toISOString()).neq('status', 'cancelled').maybeSingle()
    if (clash) {
      setNewApptSaving(false)
      setNewApptError(`${newApptDoctor} already has another appointment at ${newApptTime}. Pick a different time.`)
      return
    }
    const { error: insErr } = await supabase.from('appointments').insert({
      patient_id: newApptPatient.id,
      doctor_name: newApptDoctor,
      department: doctorInfo?.department || null,
      scheduled_at: scheduledAt.toISOString(),
      appointment_type: newApptReason || 'Consultation',
      status: 'confirmed',
      institution_source: 'clinic_ops',
    })
    setNewApptSaving(false)
    if (insErr) { setNewApptError(insErr.message); return }
    setShowNewApptForm(false)
    setNewApptSearch(''); setNewApptPatient(null); setNewApptTime(''); setNewApptReason('')
    loadRealAppointments(selectedDay)
  }

  const isDoctorView = staffMember?.role==='doctor'
  const [appointments,setAppointments]=useState([])
  const [loadingAppts,setLoadingAppts]=useState(true)

  // Load real appointments booked through PatientApp for whichever day is
  // selected, and merge them with the illustrative demo rows - this is
  // what makes a real patient booking (e.g. through Lisa) actually show
  // up here, which previously it never did since this screen only ever
  // read local hardcoded demo data.
  async function loadRealAppointments(dateObj) {
    setLoadingAppts(true)
    const dayStart = new Date(dateObj); dayStart.setHours(0,0,0,0)
    const dayEnd = new Date(dateObj); dayEnd.setHours(23,59,59,999)
    // Only this clinic's own bookings - ClinicOps and PractitionerApp
    // represent two different institutions and shouldn't see each other's
    // appointments just because they happen to share the same database.
    // Cancelled appointments used to just be excluded outright, so a
    // cancellation (from either side) made the appointment silently
    // vanish from Schedule instead of showing what actually happened to
    // it - kept here now and rendered crossed out/labelled Cancelled,
    // same treatment as a completed one.
    const { data } = await supabase.from('appointments').select('*, patients(full_name, medsa_id)')
      .eq('institution_source', 'clinic_ops')
      .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())
      .order('scheduled_at', {ascending:true})

    const realRows = (data||[]).map(a => ({
      id: a.id,
      time: new Date(a.scheduled_at).toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit',hour12:false}),
      scheduledAt: a.scheduled_at,
      patient: a.patients?.full_name || 'Unknown patient',
      patientId: a.patient_id || null,
      medsaId: a.patients?.medsa_id || null,
      doctor: a.doctor_name || 'Unassigned',
      department: a.department || 'Internal Medicine',
      type: a.appointment_type || 'Consultation',
      status: a.status || 'confirmed',
      notes: a.reason_for_visit || '',
      isReal: true,
    }))

    setAppointments(isDoctorView ? realRows.filter(a=>a.doctor===staffMember.name) : realRows)
    setLoadingAppts(false)
  }

  useEffect(() => { loadRealAppointments(selectedDay) }, [selectedDay])

  const [activeAppt,setActiveAppt]=useState(null)

  // Real per-patient check against the consent window set at booking time
  // (schema_intake_consent.sql) - this is what actually gates data access
  // on the schedule now, not just whether they're physically checked in.
  const [dataWindows,setDataWindows]=useState({}) // medsaId -> {allowed, checked, reason}

  async function checkDataWindow(medsaId, force=false) {
    if (!medsaId || (dataWindows[medsaId]?.checked && !force)) return
    const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
    if (!patientRow) { setDataWindows(prev=>({...prev,[medsaId]:{allowed:false,checked:true,reason:'no_consent'}})); return }
    // Most recent intake row overall, regardless of what it says - not
    // just the most recent one that happens to say consent_given:true.
    // Filtering to consent_given:true before ordering meant a patient's
    // explicit "No" on their latest visit was invisible to this check as
    // long as an older, still-in-window "Yes" existed - that older
    // consent kept being honoured over their actual, more recent choice.
    const { data } = await supabase.from('appointment_intake').select('*').eq('patient_id', patientRow.id).order('created_at',{ascending:false}).limit(1).maybeSingle()
    if (!data || !data.consent_given) { setDataWindows(prev=>({...prev,[medsaId]:{allowed:false,checked:true,reason:'no_consent'}})); return }
    const now = new Date()
    const allowed = now >= new Date(data.access_window_start) && now <= new Date(data.access_window_end)
    setDataWindows(prev=>({...prev,[medsaId]:{allowed,checked:true,reason:allowed?null:'outside_window',patientId:patientRow.id}}))
  }

  useEffect(() => { appointments.forEach(a=>checkDataWindow(a.medsaId)) }, [appointments])

  function withinDataWindow(medsaId) {
    return dataWindows[medsaId]?.allowed || false
  }

  // Clinic-side consent confirmation - for when a patient consents
  // verbally or on paper at check-in rather than through PatientApp
  // themselves. Without this, a patient who never used PatientApp had no
  // way to ever pass the consent check at all.
  async function handleConfirmConsent(appt) {
    if (!appt?.medsaId) return
    const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', appt.medsaId).maybeSingle()
    if (!patientRow) return
    const isWalkIn = !appt.scheduledAt || appt.ticket === 'SCH' // no real booked time - this is a walk-in
    const apptTime = appt.scheduledAt ? new Date(appt.scheduledAt) : new Date()
    // Booked: 24h before AND after the consultation time. Walk-in: no
    // "before" makes sense since there's no scheduled time to count back
    // from - 24h after the actual visit only.
    const windowStart = isWalkIn ? apptTime : new Date(apptTime.getTime() - 24*60*60*1000)
    const windowEnd = new Date(apptTime.getTime() + 24*60*60*1000)
    await supabase.from('appointment_intake').insert({
      patient_id: patientRow.id, appointment_time: apptTime.toISOString(),
      doctor_name: appt.doctor, reason_for_visit: appt.notes||null,
      consent_given: true, consent_given_at: new Date().toISOString(),
      access_window_start: windowStart.toISOString(), access_window_end: windowEnd.toISOString(),
    })
    // Force a fresh check - the cached "checked:true" result was based on
    // there being no consent at all, which is no longer true. force=true
    // because the setDataWindows clear above hasn't landed in state yet
    // by the time checkDataWindow reads it in this same tick (React
    // batches the update) - without force, checkDataWindow would just
    // see the stale checked:true and silently no-op, leaving the button
    // looking like it did nothing even though the insert above succeeded.
    setDataWindows(prev=>{ const next={...prev}; delete next[appt.medsaId]; return next })
    checkDataWindow(appt.medsaId, true)
  }

  // Reschedule, switch-doctor and notes edits used to only ever update
  // local React state here - onSave never actually wrote scheduled_at,
  // doctor_name or reason_for_visit to Supabase, so a "successful" change
  // silently reverted the moment the page reloaded or loadRealAppointments
  // ran again. Now every branch writes through to the database and
  // refreshes from it, and reschedule/switch also re-check for a clash
  // right before writing (the slot picker's own list can go stale between
  // opening the form and confirming).
  async function handleSaveAppt(updated) {
    const original = activeAppt
    if (!original) return { ok: true }

    if (updated.cancelled && updated.isReal && updated.medsaId) {
      // Scoped to this exact appointment id when we have one - the old
      // day-range lookup (no id filter) meant cancelling one of a
      // patient's two same-day appointments cancelled both.
      if (updated.id) {
        await supabase.from('appointments').update({status:'cancelled'}).eq('id', updated.id)
        cancelAppointmentSideEffects(updated.id)
      } else {
        const { data: pRow } = await supabase.from('patients').select('id').eq('medsa_id', updated.medsaId).maybeSingle()
        if (pRow) {
          const dayStart=new Date(selectedDay); dayStart.setHours(0,0,0,0)
          const dayEnd=new Date(selectedDay); dayEnd.setHours(23,59,59,999)
          await supabase.from('appointments').update({status:'cancelled'}).eq('patient_id',pRow.id).eq('institution_source','clinic_ops').gte('scheduled_at',dayStart.toISOString()).lte('scheduled_at',dayEnd.toISOString())
        }
      }
      loadRealAppointments(selectedDay)
      return { ok: true }
    }

    if (updated.id && updated.time && updated.time !== original.time) {
      const scheduledAt = new Date(selectedDay)
      const [h,m] = updated.time.split(':').map(Number)
      scheduledAt.setHours(h||9, m||0, 0, 0)
      const { data: clash } = await supabase.from('appointments').select('id')
        .eq('doctor_name', original.doctor).eq('institution_source','clinic_ops')
        .eq('scheduled_at', scheduledAt.toISOString()).neq('status','cancelled').neq('id', updated.id).maybeSingle()
      if (clash) return { ok:false, error:`${original.doctor} already has another appointment at ${updated.time}. Pick a different time.` }
      const { error } = await supabase.from('appointments').update({ scheduled_at: scheduledAt.toISOString() }).eq('id', updated.id)
      if (error) return { ok:false, error: error.message }
      loadRealAppointments(selectedDay)
      return { ok: true }
    }

    if (updated.id && updated.doctor && updated.doctor !== original.doctor) {
      const { data: clash } = await supabase.from('appointments').select('id')
        .eq('doctor_name', updated.doctor).eq('institution_source','clinic_ops')
        .eq('scheduled_at', original.scheduledAt).neq('status','cancelled').neq('id', updated.id).maybeSingle()
      if (clash) return { ok:false, error:`${updated.doctor} already has another appointment at ${original.time}. Pick a different doctor.` }
      const { error } = await supabase.from('appointments').update({ doctor_name: updated.doctor }).eq('id', updated.id)
      if (error) return { ok:false, error: error.message }
      loadRealAppointments(selectedDay)
      return { ok: true }
    }

    if (updated.id && updated.notes !== undefined && updated.notes !== original.notes) {
      await supabase.from('appointments').update({ reason_for_visit: updated.notes }).eq('id', updated.id)
      loadRealAppointments(selectedDay)
      return { ok: true }
    }

    return { ok: true }
  }
  return (
    <PageWrap maxWidth={640}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h2 style={{fontSize:'20px',fontWeight:700}}>Schedule</h2>
        <Btn variant="primary" onClick={()=>setShowNewApptForm(true)}>+ New appointment</Btn>
      </div>
      <Card style={{padding:'16px',marginBottom:'20px'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'12px'}}>{weekDates[0].toLocaleDateString('en-HK',{month:'long',year:'numeric'})}</div>
        <div style={{display:'flex',gap:'8px'}}>
          {weekDates.map(d=>(
            <div key={d.toISOString()} onClick={()=>setSelectedDay(d)} style={{flex:1,textAlign:'center',padding:'10px',borderRadius:'8px',background:d.toDateString()===selectedDay.toDateString()?C.green:C.card,color:d.toDateString()===selectedDay.toDateString()?'#fff':C.text,cursor:'pointer'}}>
              <div style={{fontSize:'16px',fontWeight:600}}>{d.getDate()}</div>
            </div>
          ))}
        </div>
      </Card>
      <SecLabel>{isDoctorView?`Today's patients · ${staffMember.name}`:'All doctors'} · {selectedDay.toLocaleDateString('en-HK',{weekday:'short',day:'numeric',month:'short'})}</SecLabel>
      {loadingAppts&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,marginBottom:'12px'}}>Loading...</div>}
      <div style={{margin:'0 16px 12px',background:C.blueLight,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'10px 14px',fontSize:'11px',color:C.textSub,lineHeight:1.5}}>
        ◇ Clinical data access is based on each patient's consent window from booking, not just whether they're physically checked in - see the badge on each appointment.
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {[...appointments].sort((a,b)=>a.time.localeCompare(b.time)).map((a,i)=>{
          const isDone = a.status==='completed'
          const isCancelled = a.status==='cancelled'
          const isMuted = isDone || isCancelled
          return (
          <Card key={i} onClick={()=>a.status!=='open'&&setActiveAppt(a)} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',opacity:a.status==='open'?0.6:1,background:isMuted?C.card:undefined,cursor:a.status!=='open'?'pointer':'default'}}>
            <div style={{fontSize:'13px',fontWeight:700,width:48,flexShrink:0,color:isMuted?C.textMuted:C.text}}>{a.time}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'13px',fontWeight:500,color:isCancelled?C.red:isDone?C.textMuted:C.text,textDecoration:isMuted?'line-through':'none'}}>{a.patient}</div>
              <div style={{fontSize:'12px',color:C.textMuted}}>{a.doctor} - {a.type}</div>
            </div>
            {a.status!=='open'&&!isMuted&&<Badge text={withinDataWindow(a.medsaId)?'Data available':'Outside consent window'} type={withinDataWindow(a.medsaId)?'ok':'due'}/>}
            {a.status==='open'
              ?<Btn style={{fontSize:'12px',padding:'6px 12px'}} onClick={()=>setShowNewApptForm(true)}>+ Book</Btn>
              :isCancelled
                ?<Badge text="✕ Cancelled" type="full"/>
              :isDone
                ?<Badge text="✓ Done" type="muted"/>
                :<><Badge text={a.status==='checked_in'?'✓ Checked in':a.status==='confirmed'?'Confirmed':'Pending'} type={a.status==='checked_in'?'ok':a.status==='confirmed'?'ok':'due'}/><span style={{color:C.textMuted,fontSize:'14px'}}>›</span></>}
          </Card>
          )
        })}
      </div>
      <ClinicScheduleActionModal
        appt={activeAppt}
        onClose={()=>setActiveAppt(null)}
        onSave={handleSaveAppt}
        withinDataWindow={activeAppt ? withinDataWindow(activeAppt.medsaId) : false}
        consentReason={activeAppt ? dataWindows[activeAppt.medsaId]?.reason : null}
        onConfirmConsent={handleConfirmConsent}
        onGoToConsultation={onGoToConsultation}
        role={staffMember?.role}
        staffMember={staffMember}
        onCheckedIn={onCheckedIn}
        checkInError={checkInError}
        clinicQueues={clinicQueues}
        onRefreshAppointments={()=>loadRealAppointments(selectedDay)}
        onScheduleFollowup={onPreselectPatientForFollowup}
        onCancelCheckIn={async(appt)=>{
          await onCancelCheckIn(appt)
          // The backend update alone doesn't refresh what's on screen - this
          // was the actual bug: the row would revert in Supabase but the
          // local list kept showing the stale "checked in" state until a
          // manual reload.
          loadRealAppointments(selectedDay)
        }}
      />
      {showNewApptForm&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowNewApptForm(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:400,padding:'24px'}}>
          <div style={{fontSize:'16px',fontWeight:700,marginBottom:'16px'}}>New appointment</div>
          <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
            <input value={newApptSearch} onChange={e=>setNewApptSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleNewApptSearch()} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px',fontSize:'14px',boxSizing:'border-box'}} placeholder="Patient name or Medsa ID"/>
            <Btn onClick={handleNewApptSearch}>Search</Btn>
          </div>
          {newApptPatient&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'8px',padding:'10px',marginBottom:'12px',fontSize:'12px',color:C.green}}>✓ {newApptPatient.full_name} ({newApptPatient.medsa_id})</div>}
          <select value={newApptDoctor} onChange={e=>setNewApptDoctor(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px',fontSize:'14px',marginBottom:'10px'}}>
            {clinicDoctors.map(d=><option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
          {/* Real, working-hours-based time slots - replaces the bare
              <input type="time"> that let front desk book any time at all,
              regardless of whether the doctor actually works then. */}
          {newApptSlotsLoading&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'10px'}}>Loading {newApptDoctor}'s working hours…</div>}
          {!newApptSlotsLoading&&newApptSlots.length===0&&<div style={{fontSize:'12px',color:C.amber,marginBottom:'10px'}}>{'\u26a0'} {newApptDoctor} has no working hours set for {selectedDay.toLocaleDateString('en-HK',{weekday:'long'})} - set them in Working Hours first.</div>}
          {!newApptSlotsLoading&&newApptSlots.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'6px',marginBottom:'12px'}}>
            {newApptSlots.map(t=>(
              <div key={t} onClick={()=>setNewApptTime(t)} style={{border:`0.5px solid ${newApptTime===t?C.green:C.border}`,borderRadius:'8px',padding:'7px',textAlign:'center',fontSize:'12px',cursor:'pointer',background:newApptTime===t?C.green:C.card,color:newApptTime===t?'#fff':C.text}}>{t}</div>
            ))}
          </div>}
          <input value={newApptReason} onChange={e=>setNewApptReason(e.target.value)} placeholder="Reason, e.g. Follow-up" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px',fontSize:'14px',marginBottom:'14px',boxSizing:'border-box'}}/>
          {newApptError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'6px'}}>{newApptError}</div>}
          {newApptError&&<div style={{marginBottom:'10px'}}><span onClick={()=>onNavNewPatient?.(newApptSearch)} style={{fontSize:'12px',color:C.green,fontWeight:600,cursor:'pointer'}}>Register them as a new patient {'\u2192'}</span></div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={handleConfirmNewAppt} disabled={!newApptPatient||!newApptTime||newApptSaving}>{newApptSaving?'Booking…':'Confirm booking'}</Btn>
        </div>
      </div>}
    </PageWrap>
  )
}

function PaymentScreen({ staffMember, institutionId, preselectClaimRef, onConsumedPreselect, preselectRecordId, onConsumedRecordPreselect }) {
  const [tab,setTab]=useState('collect')
  const [method,setMethod]=useState('card')
  // No card/Octopus terminal is actually integrated yet (calculatePaymentProcessingFee
  // is a flat-rate estimate, not a real processor call) - staff on a real
  // standalone terminal today already gets a reference/approval number
  // printed on its receipt slip, so this lets them record that number now
  // for reconciliation. It's optional and never auto-generated - a real
  // terminal integration later would populate the same field from its own
  // response instead of manual entry, no schema change needed.
  const [txnRef,setTxnRef]=useState('')
  const [paid,setPaid]=useState(false)
  const [paidRecord,setPaidRecord]=useState(null)
  const [paidTransaction,setPaidTransaction]=useState(null)
  const [billingTransaction,setBillingTransaction]=useState(null)
  const [receiptSent,setReceiptSent]=useState(false)
  const [printed,setPrinted]=useState(false)
  const [billingRecord,setBillingRecord]=useState(null) // the consultation record being billed, when arriving via preselectRecordId
  const [billingRecordLoading,setBillingRecordLoading]=useState(false)
  const [billingChoice,setBillingChoice]=useState(null) // null | 'direct_payment' | 'insurance' | 'treatment_plan'
  const [eligibleTreatmentPlans,setEligibleTreatmentPlans]=useState(null)
  const [eligibleTreatmentPlansLoading,setEligibleTreatmentPlansLoading]=useState(false)
  const [selectedTreatmentPlan,setSelectedTreatmentPlan]=useState(null)
  const [treatmentPlanShortfallMethod,setTreatmentPlanShortfallMethod]=useState('card')
  const [shortfallTxnRef,setShortfallTxnRef]=useState('')
  const [eligiblePlans,setEligiblePlans]=useState(null)
  const [eligiblePlansLoading,setEligiblePlansLoading]=useState(false)
  const [selectedEligiblePlan,setSelectedEligiblePlan]=useState(null)
  const [submittingClaim,setSubmittingClaim]=useState(false)
  const [billingResult,setBillingResult]=useState(null)
  const [billingTxnError,setBillingTxnError]=useState(null)
  const [claimAdjudication,setClaimAdjudication]=useState(null) // the raw adjudicateClaim result, kept separate from billingResult so we know whether a copay still needs collecting
  const [copayMethod,setCopayMethod]=useState('card')
  const [copayTxnRef,setCopayTxnRef]=useState('')
  const [collectingCopay,setCollectingCopay]=useState(false)
  const [addPlanOpen,setAddPlanOpen]=useState(false)
  const [allPlans,setAllPlans]=useState([])
  const [addPlanSearch,setAddPlanSearch]=useState('')
  const [addingPlan,setAddingPlan]=useState(false)
  const [treatmentPlans,setTreatmentPlans]=useState([])
  const [plansLoading,setPlansLoading]=useState(true)
  const [ledger,setLedger]=useState([])
  const [ledgerLoading,setLedgerLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [pendingPayments,setPendingPayments]=useState([])
  const [pendingLoading,setPendingLoading]=useState(true)
  const [selectedPayment,setSelectedPayment]=useState(null)
  const [paymentSearch,setPaymentSearch]=useState('')
  const [showCreatePlan,setShowCreatePlan]=useState(false)
  const [planStep,setPlanStep]=useState('form') // form | payment | done
  const [planPatientQuery,setPlanPatientQuery]=useState('')
  const [planFoundPatient,setPlanFoundPatient]=useState(null)
  const [planNotFound,setPlanNotFound]=useState(false)
  const [planScanOpen,setPlanScanOpen]=useState(false)
  const [planScanChoices,setPlanScanChoices]=useState([])

  // Real scan hardware isn't wired up anywhere in this app yet (same
  // gap as check-in) - this simulates it by letting staff pick from
  // real patients rather than forcing a full manual name/MedsaID type.
  async function loadPlanScanChoices() {
    const { data } = await supabase.from('patients').select('id,full_name,medsa_id').limit(10)
    setPlanScanChoices(data || [])
    setPlanScanOpen(true)
  }
  function pickPlanScanPatient(p) {
    setPlanFoundPatient(p)
    setPlanPatientQuery(p.full_name)
    setPlanNotFound(false)
    setPlanScanOpen(false)
  }
  const [planName,setPlanName]=useState('')
  const [planSessions,setPlanSessions]=useState('')
  const [planSessionValue,setPlanSessionValue]=useState('')
  const [planPrice,setPlanPrice]=useState('')
  const [planExpiry,setPlanExpiry]=useState('')
  const [planMethod,setPlanMethod]=useState('card')
  const [planTxnRef,setPlanTxnRef]=useState('')
  const [planSaving,setPlanSaving]=useState(false)
  const [newPlanReceipt,setNewPlanReceipt]=useState(null)

  async function loadPendingPayments() {
    setPendingLoading(true)
    // Real, itemized list - claims with a real amount still owed by the
    // patient that haven't been collected yet. Replaces the single
    // hardcoded demo bill this screen used to show.
    const { data } = await supabase.from('insurance_claims')
      .select('*, patients(full_name), insurance_plans(company_name, plan_name)')
      .in('status', ['approved','partially_approved'])
      .is('copay_payment_method', null)
      .order('submitted_at', {ascending:false})
    const withAmountOwed = (data||[]).filter(c => ((c.deductible_applied||0) + (c.patient_copay_amount||0)) > 0)
    setPendingPayments(withAmountOwed)
    setPendingLoading(false)
  }

  async function loadLedger() {
    setLedgerLoading(true)
    const { data } = await supabase.from('transactions').select('*').order('created_at',{ascending:false}).limit(100)
    setLedger(data||[])
    setLedgerLoading(false)
  }

  // Real jsPDF export - shared with the patient app (lib/receiptPdf.js)
  // so a patient's downloaded receipt for a visit is exactly the same
  // document the clinic downloads for it, not a simplified look-alike.
  async function handleDownloadReceipt(t) {
    await fetchAndDownloadConsultationReceipt(supabase, t)
  }

  async function handleCharge() {
    if (!selectedPayment) return
    setSaving(true)
    const amountOwed = (selectedPayment.deductible_applied||0) + (selectedPayment.patient_copay_amount||0)
    const adapter = getInsuranceAdapter(selectedPayment.insurance_plans?.company_name)
    const fees = await adapter.recordCopayPayment(selectedPayment.claim_ref, method)
    // Real fix - fetch the actual consultation record this claim was
    // linked to BEFORE inserting the transaction, so its id can be
    // attached to the transaction row itself. Without that, this was
    // the one billing path where a downloaded receipt could never show
    // itemized charges - the PDF export has nothing to look up without it.
    const { data: linkedRecord } = await supabase.from('medical_records')
      .select('*').eq('insurance_claim_id', selectedPayment.id).maybeSingle()
    // .select() to get the real inserted row back (with its id and
    // created_at) - the "Download receipt" button on the next screen
    // needs the actual saved transaction, not a reconstruction of it,
    // to build a real PDF from.
    const { data: txn } = await supabase.from('transactions').insert({
      institution_id: institutionId,
      patient_name: selectedPayment.patients?.full_name || 'Unknown',
      consultation_fee: selectedPayment.amount,
      insurer_covers: selectedPayment.insurer_covered_amount,
      patient_pays: amountOwed,
      payment_method: method,
      card_processing_fee: fees.paymentProcessingFee,
      claim_ref: selectedPayment.claim_ref,
      medical_record_id: linkedRecord?.id || null, patient_id: selectedPayment.patient_id || null,
      staff_name: staffMember?.name || 'Unknown',
      transaction_ref: txnRef.trim() || null,
    }).select().maybeSingle()
    setPaidTransaction(txn || null)
    setPaidRecord(linkedRecord || null)
    setSaving(false)
    setPaid(true)
    loadLedger()
    loadPendingPayments()
  }

  function exportCSV() {
    if (typeof window === 'undefined') return // SSR safety guard
    const headers = ['Date','Patient','Consultation Fee','Insurer Covers','Patient Pays','Method','Processing Fee','Claim Ref','Clearinghouse Fee','Staff']
    const rows = ledger.map(t => [
      new Date(t.created_at).toLocaleString('en-HK'),
      t.patient_name, t.consultation_fee, t.insurer_covers, t.patient_pays,
      t.payment_method, t.card_processing_fee, t.claim_ref||'', t.clearinghouse_fee||0, t.staff_name,
    ])
    const csv = [headers, ...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medsa-financial-records-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function loadTreatmentPlans() {
    setPlansLoading(true)
    const { data } = await supabase.from('treatment_plans').select('*, patients(full_name)')
    setTreatmentPlans((data||[]).map(p => ({
      id: p.id,
      patient: p.patients?.full_name || 'Unknown',
      plan: p.plan_name,
      paid: p.sessions_paid,
      used: p.sessions_used,
      remaining: p.sessions_paid - p.sessions_used,
      status: p.status,
      expiryDate: p.expiry_date,
      priceTotal: p.price_total,
      sessionValue: p.session_value,
    })))
    setPlansLoading(false)
  }

  useEffect(() => {
    loadTreatmentPlans()
    loadLedger()
    loadPendingPayments()
  }, [])

  // Refetch whenever front desk actually switches to this tab, not
  // just once when the screen first mounted - covers billing that
  // happened in a different session/tab since this one opened.
  useEffect(() => {
    if (tab === 'plans') loadTreatmentPlans()
    if (tab === 'ledger') loadLedger()
  }, [tab])

  // Arrived here via a "Collect in Payment" link from Claims - jump
  // straight to that specific claim instead of making reception search.
  useEffect(() => {
    if (!preselectClaimRef) return
    async function findAndSelect() {
      const { data } = await supabase.from('insurance_claims')
        .select('*, patients(full_name), insurance_plans(company_name, plan_name)')
        .eq('claim_ref', preselectClaimRef).maybeSingle()
      if (data) { setSelectedPayment(data); setTab('collect') }
      onConsumedPreselect?.()
    }
    findAndSelect()
  }, [preselectClaimRef])

  // Arrived here via "Proceed to billing" from the task board - load the
  // real consultation record (diagnosis, itemized line_items, total_fee)
  // and its patient, so the front desk sees the doctor's actual itemized
  // bill rather than needing to rebuild it.
  useEffect(() => {
    if (!preselectRecordId) return
    async function loadRecord() {
      setBillingRecordLoading(true)
      const { data } = await supabase.from('medical_records')
        .select('*, patients(id, full_name, medsa_id)')
        .eq('id', preselectRecordId).maybeSingle()
      setBillingRecord(data || null)
      setBillingRecordLoading(false)
      onConsumedRecordPreselect?.()
    }
    loadRecord()
  }, [preselectRecordId])

  // Real matching engine - only fetched when the front desk actually
  // chooses "insurance", not preemptively, since it requires a network
  // round trip and most visits may just be paid directly.
  useEffect(() => {
    if (billingChoice !== 'insurance' || !billingRecord) return
    async function loadEligible() {
      setEligiblePlansLoading(true)
      const matches = await findEligiblePlans(billingRecord.patient_id, billingRecord.line_items || [])
      setEligiblePlans(matches)
      setEligiblePlansLoading(false)
    }
    loadEligible()
  }, [billingChoice, billingRecord])

  useEffect(() => {
    if (billingChoice !== 'treatment_plan' || !billingRecord) return
    async function loadEligiblePlans() {
      setEligibleTreatmentPlansLoading(true)
      const { data } = await supabase.from('treatment_plans').select('*')
        .eq('patient_id', billingRecord.patient_id).eq('status', 'active')
      setEligibleTreatmentPlans((data||[]).filter(p => (p.sessions_paid - p.sessions_used) > 0))
      setEligibleTreatmentPlansLoading(false)
    }
    loadEligiblePlans()
  }, [billingChoice, billingRecord])

  // A treatment plan session has a real, normal value - session_value,
  // what one session is actually worth, set when the plan was created.
  // A visit doesn't always cost exactly that (extra services, a pricier
  // consultation than the package assumed), so a genuine shortfall - the
  // visit costing MORE than a normal session - still needs collecting.
  //
  // Falls back to price_total/sessions_paid (this plan's own per-session
  // price) whenever session_value isn't set - most plans never had that
  // field filled in (it was added after they were created, and the
  // Create Plan form doesn't require it), and with no fallback at all,
  // shortfall silently came out to 0 for every single one of them: no
  // leftover ever calculated or collectible, on any plan without that
  // one optional field set. A real session_value still take priority
  // when a practice manager has deliberately set one - e.g. for a
  // genuinely discounted package (HK$180 for 3 sessions normally worth
  // HK$100 each), where comparing against the discounted average would
  // claw the discount back at every visit.
  const planPerSessionValue = selectedTreatmentPlan?.session_value
    ?? (selectedTreatmentPlan?.price_total!=null && selectedTreatmentPlan?.sessions_paid>0
      ? selectedTreatmentPlan.price_total / selectedTreatmentPlan.sessions_paid : null)
  const treatmentPlanShortfall = planPerSessionValue!=null && billingRecord
    ? Math.max(0, (billingRecord.total_fee||0) - planPerSessionValue) : 0

  async function handleBillToTreatmentPlan() {
    if (!selectedTreatmentPlan || !billingRecord) return
    setSubmittingClaim(true)
    const shortfall = treatmentPlanShortfall
    const fees = shortfall > 0 ? buildFeeBreakdown(shortfall, 0, shortfall, treatmentPlanShortfallMethod) : { paymentProcessingFee: 0 }
    const newUsed = selectedTreatmentPlan.sessions_used + 1
    const { data: planUpdateRows, error: planUpdateErr } = await supabase.from('treatment_plans').update({
      sessions_used: newUsed,
      status: newUsed >= selectedTreatmentPlan.sessions_paid ? 'completed' : 'active',
    }).eq('id', selectedTreatmentPlan.id).select()
    if (planUpdateErr) setBillingTxnError(planUpdateErr.message)
    else if (!planUpdateRows || planUpdateRows.length === 0) setBillingTxnError('Sessions used could not be updated on the treatment plan (0 rows matched) - check the plan still exists.')
    await supabase.from('medical_records').update({ record_status: 'billed' }).eq('id', billingRecord.id)
    const { data: txn, error: txnErr } = await supabase.from('transactions').insert({
      institution_id: institutionId,
      patient_name: billingRecord.patients?.full_name || 'Unknown',
      consultation_fee: billingRecord.total_fee || 0,
      insurer_covers: 0, patient_pays: shortfall,
      payment_method: shortfall > 0 ? treatmentPlanShortfallMethod : 'treatment_plan', card_processing_fee: fees.paymentProcessingFee,
      treatment_plan_id: selectedTreatmentPlan.id,
      medical_record_id: billingRecord.id, patient_id: billingRecord.patient_id,
      staff_name: staffMember?.name || 'Unknown',
      transaction_ref: shortfall > 0 ? (shortfallTxnRef.trim() || null) : null,
    }).select().maybeSingle()
    if (txnErr) setBillingTxnError(txnErr.message)
    setBillingTransaction(txn || null)
    setBillingResult({ status: 'PAID_TREATMENT_PLAN', planName: selectedTreatmentPlan.plan_name, sessionsRemaining: selectedTreatmentPlan.sessions_paid - newUsed, shortfallCollected: shortfall })
    setSubmittingClaim(false)
    // The Treatment Plans tab only ever loaded once, on mount - without
    // this, the "X of Y used" count stayed frozen at whatever it was
    // when this screen first opened, even though the database update
    // above succeeded, making a real change look like it did nothing.
    loadTreatmentPlans()
    loadLedger()
  }

  async function handleDirectBillingSubmit() {
    if (!selectedEligiblePlan || !billingRecord) return
    setSubmittingClaim(true)
    const adapter = getInsuranceAdapter(selectedEligiblePlan.plan.company_name)
    const items = (billingRecord.line_items || []).map(i => ({ code: i.category, description: i.description, amount: i.fee * i.qty }))
    const result = await adapter.adjudicateClaim({
      patientId: billingRecord.patient_id, policyNumber: selectedEligiblePlan.plan.id,
      clinicId: institutionId, totalGrossAmount: billingRecord.total_fee || 0,
      items, medicalRecordId: billingRecord.id,
    })
    // Real completion signal - marks this consultation as billed so it
    // correctly disappears from the task board. The claim itself is
    // submitted at this point regardless of whether a copay remains -
    // that's now a separate, immediate collection step below, not
    // something the task board needs to keep tracking.
    await supabase.from('medical_records').update({ record_status: 'billed' }).eq('id', billingRecord.id)
    setClaimAdjudication(result)
    // If nothing is owed (fully covered), we're actually done - skip
    // straight to the completion screen rather than showing an empty
    // "collect $0" step. Still needs its own transaction/receipt row -
    // previously this branch recorded nothing at all in the ledger.
    if (!result.fees || result.fees.patientPayableTotal <= 0) {
      const { data: txn } = await supabase.from('transactions').insert({
        institution_id: institutionId,
        patient_name: billingRecord.patients?.full_name || 'Unknown',
        consultation_fee: billingRecord.total_fee || 0,
        insurer_covers: result.fees?.insurerCoveredAmount || billingRecord.total_fee || 0,
        patient_pays: 0, payment_method: 'insurance', card_processing_fee: 0,
        claim_ref: result.claimId,
        medical_record_id: billingRecord.id, patient_id: billingRecord.patient_id,
        staff_name: staffMember?.name || 'Unknown',
      }).select().maybeSingle()
      setBillingTransaction(txn || null)
      setBillingResult(result)
    }
    setSubmittingClaim(false)
  }

  useEffect(() => {
    if (!addPlanOpen || allPlans.length > 0) return
    async function loadPlans() {
      const { data } = await supabase.from('insurance_plans').select('*').eq('status', 'active').order('company_name')
      setAllPlans(data || [])
    }
    loadPlans()
  }, [addPlanOpen])

  async function handleLinkNewPlan(plan) {
    if (!billingRecord) return
    setAddingPlan(true)
    const { error } = await supabase.from('agent_policies').insert({
      patient_id: billingRecord.patient_id, plan_id: plan.id, status: 'active',
    })
    if (error) {
      alert(`Could not link this plan: ${error.message}`)
      setAddingPlan(false)
      return
    }
    setAddPlanOpen(false)
    setAddPlanSearch('')
    setEligiblePlansLoading(true)
    const matches = await findEligiblePlans(billingRecord.patient_id, billingRecord.line_items || [])
    setEligiblePlans(matches)
    setEligiblePlansLoading(false)
    setAddingPlan(false)
  }

  async function handleCollectRemainingCopay() {
    if (!claimAdjudication || !billingRecord) return
    setCollectingCopay(true)
    const adapter = getInsuranceAdapter(selectedEligiblePlan.plan.company_name)
    const fees = await adapter.recordCopayPayment(claimAdjudication.claimId, copayMethod)
    const { data: txn } = await supabase.from('transactions').insert({
      institution_id: institutionId,
      patient_name: billingRecord.patients?.full_name || 'Unknown',
      consultation_fee: billingRecord.total_fee || 0,
      insurer_covers: claimAdjudication.fees.insurerCoveredAmount,
      patient_pays: claimAdjudication.fees.patientPayableTotal,
      payment_method: copayMethod,
      card_processing_fee: fees.paymentProcessingFee,
      claim_ref: claimAdjudication.claimId,
      medical_record_id: billingRecord.id, patient_id: billingRecord.patient_id,
      staff_name: staffMember?.name || 'Unknown',
      transaction_ref: copayTxnRef.trim() || null,
    }).select().maybeSingle()
    setBillingTransaction(txn || null)
    setBillingResult(claimAdjudication)
    setCollectingCopay(false)
  }

  async function handleDirectPaymentSubmit(paymentMethod) {
    if (!billingRecord) return
    setSubmittingClaim(true)
    const fees = buildFeeBreakdown(billingRecord.total_fee || 0, 0, billingRecord.total_fee || 0, paymentMethod)
    await supabase.from('medical_records').update({ record_status: 'billed' }).eq('id', billingRecord.id)
    const { data: txn, error: txnErr } = await supabase.from('transactions').insert({
      institution_id: institutionId,
      patient_name: billingRecord.patients?.full_name || 'Unknown',
      consultation_fee: billingRecord.total_fee || 0,
      insurer_covers: 0, patient_pays: billingRecord.total_fee || 0,
      payment_method: paymentMethod, card_processing_fee: fees.paymentProcessingFee,
      medical_record_id: billingRecord.id, patient_id: billingRecord.patient_id,
      staff_name: staffMember?.name || 'Unknown',
      transaction_ref: txnRef.trim() || null,
    }).select().maybeSingle()
    // A failed insert here (e.g. a column this code expects hasn't
    // been added to the database yet) used to be silently swallowed -
    // the visit was marked billed and the screen said "complete," but
    // no row ever reached Financial Records. Surface it instead.
    if (txnErr) setBillingTxnError(txnErr.message)
    setBillingTransaction(txn || null)
    setBillingResult({ status: 'PAID_DIRECT', fees })
    setSubmittingClaim(false)
  }

  if (preselectRecordId || billingRecord) {
    if (billingRecordLoading) return <PageWrap maxWidth={520}><div style={{textAlign:'center',padding:'60px 20px',color:C.textMuted,fontSize:'13px'}}>Loading consultation...</div></PageWrap>
    if (!billingRecord) return <PageWrap maxWidth={520}><div style={{textAlign:'center',padding:'60px 20px',color:C.textMuted,fontSize:'13px'}}>Consultation record not found.</div></PageWrap>

    if (billingResult) return (
      <PageWrap maxWidth={520}>
        <Card style={{padding:'24px',textAlign:'center'}}>
          <div style={{fontSize:'32px',marginBottom:'10px'}}>{'\u2713'}</div>
          <div style={{fontSize:'16px',fontWeight:700,marginBottom:'6px'}}>Billing complete</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>{billingRecord.patients?.full_name} - HK${(billingRecord.total_fee||0).toFixed(2)}</div>
          {billingResult.claimId&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'16px'}}>Claim {billingResult.claimId} - {billingResult.status}</div>}
          {billingResult.status==='PAID_TREATMENT_PLAN'&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'16px'}}>1 session used from {billingResult.planName} - {billingResult.sessionsRemaining} remaining{billingResult.shortfallCollected>0?` · HK$${billingResult.shortfallCollected.toFixed(2)} collected for the difference not covered by the plan`:''}</div>}
          {billingTxnError&&<div style={{background:C.redLight,border:`0.5px solid ${C.red}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'16px',fontSize:'12px',color:C.red,textAlign:'left'}}>{'⚠'} The visit is marked billed, but recording it failed: {billingTxnError}. It won't appear in Financial Records - let Medsa support know.</div>}
          {billingTransaction&&<Btn style={{width:'100%',marginBottom:'10px'}} onClick={()=>handleDownloadReceipt(billingTransaction)}>Download receipt (PDF)</Btn>}
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setBillingRecord(null);setBillingChoice(null);setEligiblePlans(null);setSelectedEligiblePlan(null);setBillingResult(null);setBillingTxnError(null);setClaimAdjudication(null);setCopayMethod('card');setCopayTxnRef('');setAddPlanOpen(false);setAddPlanSearch('');setEligibleTreatmentPlans(null);setSelectedTreatmentPlan(null);setBillingTransaction(null);setTreatmentPlanShortfallMethod('card');setShortfallTxnRef('');setTxnRef('')}}>Done</Btn>
        </Card>
      </PageWrap>
    )

    return (
      <PageWrap maxWidth={520}>
        <Card style={{padding:'18px',marginBottom:'16px'}}>
          <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>{billingRecord.patients?.full_name}</div>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'12px'}}>{billingRecord.patients?.medsa_id} - {billingRecord.doctor_name}</div>
          {(billingRecord.line_items||[]).map((item,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:'13px'}}>
              <span style={{color:C.textSub}}>{item.description}{item.qty>1&&` x${item.qty}`}</span><span>HK${(item.fee*item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0 0',marginTop:'6px',borderTop:`0.5px solid ${C.border}`,fontWeight:700,fontSize:'16px'}}>
            <span>Total</span><span style={{color:C.green}}>HK${(billingRecord.total_fee||0).toFixed(2)}</span>
          </div>
        </Card>

        {!billingChoice&&<>
          <SecLabel>How is this being paid?</SecLabel>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            <Btn variant="secondary" style={{width:'100%',justifyContent:'flex-start',padding:'14px 16px'}} onClick={()=>setBillingChoice('direct_payment')}>Cash / Card / Octopus</Btn>
            <Btn variant="secondary" style={{width:'100%',justifyContent:'flex-start',padding:'14px 16px'}} onClick={()=>setBillingChoice('insurance')}>Insurance direct billing</Btn>
            <Btn variant="secondary" style={{width:'100%',justifyContent:'flex-start',padding:'14px 16px'}} onClick={()=>setBillingChoice('treatment_plan')}>Bill to treatment plan</Btn>
          </div>
        </>}

        {billingChoice==='treatment_plan'&&<>
          <div onClick={()=>{setBillingChoice(null);setSelectedTreatmentPlan(null);setEligibleTreatmentPlans(null)}} style={{fontSize:'12px',color:C.green,cursor:'pointer',marginBottom:'10px'}}>{'←'} Choose a different payment method</div>
          <SecLabel>Patient's treatment plans</SecLabel>
          {eligibleTreatmentPlansLoading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Checking plans...</div>}
          {!eligibleTreatmentPlansLoading&&eligibleTreatmentPlans&&eligibleTreatmentPlans.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>
            No active treatment plan with sessions remaining for this patient.
            <div onClick={()=>{setBillingChoice('direct_payment');setEligibleTreatmentPlans(null)}} style={{marginTop:'12px',color:C.green,cursor:'pointer',fontWeight:600}}>Bill directly instead (Cash / Card / Octopus) {'→'}</div>
          </div>}
          {!eligibleTreatmentPlansLoading&&eligibleTreatmentPlans&&eligibleTreatmentPlans.map(p=>(
            <div key={p.id} onClick={()=>setSelectedTreatmentPlan(p)} style={{padding:'12px 14px',borderRadius:'8px',border:`1.5px solid ${selectedTreatmentPlan?.id===p.id?C.green:C.border}`,marginBottom:'8px',cursor:'pointer'}}>
              <div style={{fontSize:'13px',fontWeight:600}}>{p.plan_name}</div>
              <div style={{fontSize:'11px',color:C.textSub}}>{p.sessions_paid - p.sessions_used} of {p.sessions_paid} sessions remaining{p.expiry_date?` - expires ${new Date(p.expiry_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}`:''}{p.price_total!=null?` · HK$${(p.price_total/p.sessions_paid).toFixed(2)}/session`:''}</div>
            </div>
          ))}
          {selectedTreatmentPlan&&treatmentPlanShortfall>0&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 14px',marginTop:'8px',marginBottom:'8px'}}>
            <div style={{fontSize:'12px',color:C.amber,fontWeight:600,marginBottom:'8px'}}>{'⚠'} This visit costs HK${(billingRecord.total_fee||0).toFixed(2)}, but a session on this plan only covers HK${planPerSessionValue.toFixed(2)} - HK${treatmentPlanShortfall.toFixed(2)} still needs collecting.</div>
            <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
              {[['card','Card'],['octopus','Octopus'],['cash','Cash']].map(([k,l])=>(
                <div key={k} onClick={()=>setTreatmentPlanShortfallMethod(k)} style={{flex:1,padding:'8px',borderRadius:'6px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:treatmentPlanShortfallMethod===k?C.green:'#fff',color:treatmentPlanShortfallMethod===k?'#fff':C.textSub,border:`1px solid ${C.border}`}}>{l}</div>
              ))}
            </div>
            <TxnRefField method={treatmentPlanShortfallMethod} value={shortfallTxnRef} onChange={setShortfallTxnRef}/>
          </div>}
          {selectedTreatmentPlan&&<Btn variant="primary" style={{width:'100%',marginTop:'8px'}} onClick={handleBillToTreatmentPlan} disabled={submittingClaim}>{submittingClaim?'Processing...':treatmentPlanShortfall>0?`Collect HK$${treatmentPlanShortfall.toFixed(2)} and use 1 session`:'Use 1 session from this plan'}</Btn>}
        </>}

        {billingChoice==='direct_payment'&&<>
          <div onClick={()=>setBillingChoice(null)} style={{fontSize:'12px',color:C.green,cursor:'pointer',marginBottom:'10px'}}>{'←'} Choose a different payment method</div>
          <SecLabel>Payment method</SecLabel>
          <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
            {[['card','Card','\u25c8'],['octopus','Octopus','\u25c9'],['cash','Cash','\u25ce']].map(([k,l,icon])=>(
              <div key={k} onClick={()=>setMethod(k)} style={{flex:1,padding:'14px 8px',borderRadius:'8px',textAlign:'center',cursor:'pointer',background:method===k?C.green:C.card,color:method===k?'#fff':C.text}}>
                <div style={{fontSize:'18px',marginBottom:'4px'}}>{icon}</div><div style={{fontSize:'12px',fontWeight:500}}>{l}</div>
              </div>
            ))}
          </div>
          <TxnRefField method={method} value={txnRef} onChange={setTxnRef}/>
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>handleDirectPaymentSubmit(method)} disabled={submittingClaim}>{submittingClaim?'Processing...':`Collect HK$${(billingRecord.total_fee||0).toFixed(2)}`}</Btn>
        </>}

        {billingChoice==='insurance'&&<>
          <div onClick={()=>{setBillingChoice(null);setSelectedEligiblePlan(null);setEligiblePlans(null);setAddPlanOpen(false);setAddPlanSearch('')}} style={{fontSize:'12px',color:C.green,cursor:'pointer',marginBottom:'10px'}}>{'←'} Choose a different payment method</div>
          <SecLabel>Eligible plans</SecLabel>
          {eligiblePlansLoading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>Checking coverage...</div>}
          {!eligiblePlansLoading&&eligiblePlans&&eligiblePlans.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>
            No held plan covers any item in this visit yet.
            <div onClick={()=>{setBillingChoice('direct_payment');setEligiblePlans(null)}} style={{marginTop:'12px',color:C.green,cursor:'pointer',fontWeight:600}}>Bill directly instead (Cash / Card / Octopus) {'→'}</div>
          </div>}

          {!addPlanOpen&&<div onClick={()=>setAddPlanOpen(true)} style={{fontSize:'12px',color:C.green,cursor:'pointer',padding:'10px 0',textAlign:'center'}}>{'+'} Patient has a plan not on file - add it</div>}
          {addPlanOpen&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'12px',marginBottom:'12px'}}>
            <input value={addPlanSearch} onChange={e=>setAddPlanSearch(e.target.value)} placeholder="Search insurer or plan name" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px'}}/>
            <div style={{maxHeight:180,overflowY:'auto'}}>
              {allPlans.filter(p=>!addPlanSearch||`${p.company_name} ${p.plan_name}`.toLowerCase().includes(addPlanSearch.toLowerCase())).map(p=>(
                <div key={p.id} onClick={()=>!addingPlan&&handleLinkNewPlan(p)} style={{padding:'8px 10px',fontSize:'13px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`}}>
                  {p.plan_name} <span style={{color:C.textMuted}}>({p.company_name})</span>
                </div>
              ))}
              {allPlans.length===0&&<div style={{fontSize:'12px',color:C.textMuted,padding:'8px'}}>Loading plans...</div>}
            </div>
          </div>}
          {!eligiblePlansLoading&&eligiblePlans&&eligiblePlans.map(m=>(
            <Card key={m.plan.id} onClick={()=>setSelectedEligiblePlan(m)} style={{padding:'14px 16px',marginBottom:'8px',border:selectedEligiblePlan?.plan.id===m.plan.id?`1.5px solid ${C.green}`:`0.5px solid ${C.border}`,cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontSize:'13px',fontWeight:600}}>{m.plan.plan_name} ({m.plan.company_name})</div>
                <Badge text={m.fullyCovered?'Fully covered':'Partial'} type={m.fullyCovered?'ok':'due'}/>
              </div>
              {m.uncoveredItems.length>0&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>Not covered: {m.uncoveredItems.join(', ')}</div>}
            </Card>
          ))}
          {selectedEligiblePlan&&<Btn variant="primary" style={{width:'100%',marginTop:'10px'}} onClick={handleDirectBillingSubmit} disabled={submittingClaim}>{submittingClaim?'Submitting...':'Submit claim'}</Btn>}

          {claimAdjudication&&!billingResult&&<div style={{marginTop:'16px'}}>
            <div style={{background:C.greenLight,borderRadius:'10px',padding:'14px 16px',marginBottom:'16px'}}>
              <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'2px'}}>
                HK${claimAdjudication.fees.insurerCoveredAmount.toFixed(2)} is being directly billed to {selectedEligiblePlan.plan.company_name}
              </div>
              <div style={{fontSize:'12px',color:C.textSub}}>Claim {claimAdjudication.claimId}</div>
            </div>
            <SecLabel>Collect the remaining HK${claimAdjudication.fees.patientPayableTotal.toFixed(2)} from the patient</SecLabel>
            <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
              {[['card','Card','\u25c8'],['octopus','Octopus','\u25c9'],['cash','Cash','\u25ce']].map(([k,l,icon])=>(
                <div key={k} onClick={()=>setCopayMethod(k)} style={{flex:1,padding:'14px 8px',borderRadius:'8px',textAlign:'center',cursor:'pointer',background:copayMethod===k?C.green:C.card,color:copayMethod===k?'#fff':C.text}}>
                  <div style={{fontSize:'18px',marginBottom:'4px'}}>{icon}</div><div style={{fontSize:'12px',fontWeight:500}}>{l}</div>
                </div>
              ))}
            </div>
            <TxnRefField method={copayMethod} value={copayTxnRef} onChange={setCopayTxnRef}/>
            <Btn variant="primary" style={{width:'100%'}} onClick={handleCollectRemainingCopay} disabled={collectingCopay}>{collectingCopay?'Processing...':`Collect HK$${claimAdjudication.fees.patientPayableTotal.toFixed(2)}`}</Btn>
          </div>}
        </>}
      </PageWrap>
    )
  }

  if (tab==='ledger') return (
    <PageWrap maxWidth={720}>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px',justifyContent:'center'}}>
        {[['collect','Collect payment'],['plans','Treatment plans'],['ledger','Financial records']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{fontSize:'13px',padding:'9px 18px',borderRadius:'20px',cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <SecLabel>Income & Medsa fees - last 100 transactions</SecLabel>
        <Btn variant="primary" style={{fontSize:'12px'}} onClick={exportCSV} disabled={ledger.length===0}>Export to Excel/CSV</Btn>
      </div>
      <div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>
        {'\u25c7'} This covers income collected through Medsa and Medsa's own fees (card/Octopus processing, claims clearinghouse). It does not track inventory purchases or other clinic expenses paid outside the system.
      </div>
      {ledgerLoading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted}}>Loading...</div>}
      {!ledgerLoading&&ledger.length===0&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,padding:'20px'}}>No transactions recorded yet.</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {ledger.map((t,i)=>(
          <Card key={i} style={{padding:'12px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{t.patient_name}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{new Date(t.created_at).toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} - {t.staff_name}</div>
              </div>
              <div style={{fontSize:'15px',fontWeight:700,color:C.green}}>HK${t.patient_pays}</div>
            </div>
            <div style={{display:'flex',gap:'12px',fontSize:'11px',color:C.textMuted,marginBottom:t.medical_record_id?'8px':0}}>
              <span>Method: {t.payment_method}</span>
              {t.transaction_ref&&<span>Ref: {t.transaction_ref}</span>}
              {t.card_processing_fee>0&&<span>Processing fee (Medsa): HK${t.card_processing_fee}</span>}
              {t.clearinghouse_fee>0&&<span>Clearinghouse fee (Medsa): HK${t.clearinghouse_fee}</span>}
            </div>
            {t.medical_record_id&&<div onClick={()=>handleDownloadReceipt(t)} style={{fontSize:'11px',color:C.green,cursor:'pointer'}}>{'⬇'} Download consultation notes & receipt (PDF)</div>}
          </Card>
        ))}
      </div>
    </PageWrap>
  )

  async function handleFindPlanPatient() {
    // An empty search previously matched every patient (ilike '%%')
    // and .limit(1) silently returned whichever row came back first -
    // looked exactly like a hardcoded result, since it was always the
    // same patient regardless of what (if anything) was typed.
    const term = planPatientQuery.trim()
    if (!term) { setPlanFoundPatient(null); setPlanNotFound(false); return }
    const { data } = await supabase.from('patients').select('id,full_name,medsa_id')
      .or(`full_name.ilike.%${term}%,medsa_id.ilike.%${term}%`).limit(1).maybeSingle()
    setPlanFoundPatient(data||null)
    setPlanNotFound(!data)
  }

  async function handleChargePlan() {
    setPlanSaving(true)
    const { data: newPlan } = await supabase.from('treatment_plans').insert({
      patient_id: planFoundPatient.id, institution_id: institutionId,
      plan_name: planName, sessions_paid: parseInt(planSessions)||0, sessions_used: 0,
      status: 'active', price_total: parseFloat(planPrice)||0,
      session_value: planSessionValue.trim() ? parseFloat(planSessionValue) : null,
      created_by: staffMember?.name,
      expiry_date: planExpiry || null,
    }).select().maybeSingle()
    const fee = calculatePaymentProcessingFee(planMethod, parseFloat(planPrice)||0)
    const { data: txn } = await supabase.from('transactions').insert({
      institution_id: institutionId, patient_name: planFoundPatient.full_name,
      consultation_fee: parseFloat(planPrice)||0, insurer_covers: 0, patient_pays: parseFloat(planPrice)||0,
      payment_method: planMethod, card_processing_fee: fee, treatment_plan_id: newPlan?.id,
      staff_name: staffMember?.name || 'Unknown',
      transaction_ref: planTxnRef.trim() || null,
    }).select().maybeSingle()
    setNewPlanReceipt(newPlan && txn ? { plan: newPlan, txn } : null)
    setPlanSaving(false)
    setPlanStep('done')
    loadTreatmentPlans()
    loadLedger()
  }

  function resetPlanCreation() {
    setShowCreatePlan(false); setPlanStep('form'); setPlanPatientQuery(''); setPlanFoundPatient(null); setPlanNotFound(false)
    setPlanScanOpen(false); setPlanScanChoices([])
    setPlanName(''); setPlanSessions(''); setPlanSessionValue(''); setPlanPrice(''); setPlanExpiry(''); setPlanMethod('card')
    setPlanTxnRef('')
    setNewPlanReceipt(null)
  }

  // A separate receipt from the per-visit consultation receipt - this one
  // is for the treatment plan PURCHASE itself (the package bought up
  // front), not any individual visit. Shared with the patient app
  // (lib/receiptPdf.js) so both sides produce the identical document.
  async function handleDownloadPlanReceipt(planId) {
    await fetchAndDownloadTreatmentPlanReceipt(supabase, planId)
  }

  if (tab==='plans') return (
    <PageWrap maxWidth={640}>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px',justifyContent:'center'}}>
        {[['collect','Collect payment'],['plans','Treatment plans'],['ledger','Financial records']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{fontSize:'13px',padding:'9px 18px',borderRadius:'20px',cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
      {!showCreatePlan&&<Btn variant="primary" style={{width:'100%',marginBottom:'20px'}} onClick={()=>setShowCreatePlan(true)}>+ Create treatment plan</Btn>}

      {showCreatePlan&&planStep==='form'&&<Card style={{padding:'18px',marginBottom:'20px'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'12px'}}>New treatment plan</div>
        <div style={{display:'flex',gap:'8px',marginBottom:planFoundPatient?'10px':'12px'}}>
          <input value={planPatientQuery} onChange={e=>setPlanPatientQuery(e.target.value)} placeholder="Patient name or MedsaID" style={{flex:1,padding:'10px',fontSize:'13px'}}/>
          <Btn onClick={handleFindPlanPatient}>Find</Btn>
          <Btn onClick={loadPlanScanChoices}>{'\u2b21'} Scan ID</Btn>
        </div>
        {planScanOpen&&<div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'8px',marginBottom:'12px',maxHeight:200,overflowY:'auto'}}>
          <div style={{padding:'8px 12px',fontSize:'11px',color:C.textMuted}}>Demo: tap the patient whose card is being scanned</div>
          {planScanChoices.map(p=>(
            <div key={p.id} onClick={()=>pickPlanScanPatient(p)} style={{padding:'10px 14px',cursor:'pointer',borderTop:`0.5px solid ${C.border}`,display:'flex',justifyContent:'space-between',fontSize:'13px'}}>
              <span>{p.full_name}</span><span style={{color:C.textMuted,fontSize:'11px'}}>{p.medsa_id}</span>
            </div>
          ))}
        </div>}
        {planFoundPatient&&<div style={{fontSize:'12px',color:C.green,marginBottom:'12px'}}>{'\u2713'} {planFoundPatient.full_name} ({planFoundPatient.medsa_id})</div>}
        {planNotFound&&<div style={{fontSize:'12px',color:C.amber,marginBottom:'12px'}}>No patient matched that name or Medsa ID.</div>}
        <input value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="Plan name (e.g. Physio - 10 sessions)" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          <input type="number" value={planSessions} onChange={e=>setPlanSessions(e.target.value)} placeholder="Total sessions" style={{flex:1,padding:'10px',fontSize:'13px',boxSizing:'border-box'}}/>
          <input type="number" value={planPrice} onChange={e=>setPlanPrice(e.target.value)} placeholder="Total price (HK$)" style={{flex:1,padding:'10px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>
        <div style={{marginBottom:'6px'}}>
          <label style={{fontSize:'11px',color:C.textSub,display:'block',marginBottom:'4px'}}>Normal price per session (optional - for showing the discount)</label>
          <input type="number" value={planSessionValue} onChange={e=>setPlanSessionValue(e.target.value)} placeholder="e.g. 100 (a single session normally costs this)" style={{width:'100%',padding:'10px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>
        {planSessionValue&&planSessions&&planPrice&&(parseFloat(planSessionValue)*parseInt(planSessions))>parseFloat(planPrice)&&<div style={{fontSize:'12px',color:C.green,marginBottom:'10px',background:C.greenXLight,borderRadius:'8px',padding:'8px 10px'}}>
            Patient pays HK${planPrice} for {planSessions} sessions instead of HK${(parseFloat(planSessionValue)*parseInt(planSessions)).toFixed(2)} - a {(100-(parseFloat(planPrice)/(parseFloat(planSessionValue)*parseInt(planSessions))*100)).toFixed(0)}% discount.
        </div>}
        <div style={{marginBottom:'14px'}}>
          <label style={{fontSize:'11px',color:C.textSub,display:'block',marginBottom:'4px'}}>Expiry date (optional)</label>
          <input type="date" value={planExpiry} onChange={e=>setPlanExpiry(e.target.value)} style={{width:'100%',padding:'10px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <Btn style={{flex:1}} onClick={resetPlanCreation}>Cancel</Btn>
          <Btn variant="primary" style={{flex:1}} onClick={()=>setPlanStep('payment')} disabled={!planFoundPatient||!planName||!planSessions||!planPrice}>Next: collect payment</Btn>
        </div>
      </Card>}

      {showCreatePlan&&planStep==='payment'&&<Card style={{padding:'18px',marginBottom:'20px'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>{planFoundPatient.full_name}</div>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'14px'}}>{planName} - {planSessions} sessions - HK${planPrice}</div>
        <SecLabel>Payment method</SecLabel>
        <div style={{display:'flex',gap:'8px',marginBottom:'18px'}}>
          {[['card','Card','\u25c8'],['octopus','Octopus','\u25c9'],['cash','Cash','\u25ce']].map(([k,l,icon])=>(
            <div key={k} onClick={()=>setPlanMethod(k)} style={{flex:1,padding:'14px 8px',borderRadius:'8px',textAlign:'center',cursor:'pointer',background:planMethod===k?C.green:C.card,color:planMethod===k?'#fff':C.text}}>
              <div style={{fontSize:'18px',marginBottom:'4px'}}>{icon}</div>
              <div style={{fontSize:'12px',fontWeight:500}}>{l}</div>
            </div>
          ))}
        </div>
        <TxnRefField method={planMethod} value={planTxnRef} onChange={setPlanTxnRef}/>
        <Btn variant="primary" style={{width:'100%'}} onClick={handleChargePlan} disabled={planSaving}>{planSaving?'Processing…':`Charge HK$${planPrice}`}</Btn>
      </Card>}

      {showCreatePlan&&planStep==='done'&&<Card style={{padding:'18px',marginBottom:'20px',textAlign:'center'}}>
        <div style={{fontSize:'28px',marginBottom:'8px'}}>{'\u2713'}</div>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>Plan created and paid</div>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px'}}>Logged in Financial Records - {planSessions} sessions ready to use</div>
        {newPlanReceipt&&<Btn style={{width:'100%',marginBottom:'10px'}} onClick={()=>handleDownloadPlanReceipt(newPlanReceipt.plan.id)}>{'\u2b07'} Download plan receipt (PDF)</Btn>}
        <Btn variant="primary" onClick={resetPlanCreation}>Done</Btn>
      </Card>}

      <SecLabel>Ongoing treatment plans - paid, used, remaining</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {treatmentPlans.map((p,i)=>(
          <Card key={i} style={{padding:'16px 18px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:600}}>{p.patient}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{p.plan}</div>
              </div>
              {p.status==='active'&&<Badge text="Active" type="ok"/>}
              {p.status==='completed'&&<Badge text="Completed" type="ok"/>}
              {p.status==='unpaid_renewal'&&<Badge text="Renewal due" type="due"/>}
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <div style={{flex:1,background:C.card,borderRadius:'8px',padding:'8px',textAlign:'center'}}>
                <div style={{fontSize:'11px',color:C.textMuted}}>Sessions used</div>
                <div style={{fontSize:'15px',fontWeight:700}}>{p.used} / {p.paid}</div>
              </div>
              <div style={{flex:1,background:p.remaining>0?C.greenXLight:C.amberLight,borderRadius:'8px',padding:'8px',textAlign:'center'}}>
                <div style={{fontSize:'11px',color:C.textMuted}}>Remaining</div>
                <div style={{fontSize:'15px',fontWeight:700,color:p.remaining>0?C.green:C.amber}}>{p.remaining}</div>
              </div>
            </div>
            {p.expiryDate&&<div style={{fontSize:'11px',color:C.textSub,marginTop:'8px'}}>Expires {new Date(p.expiryDate).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>}
            <div onClick={()=>handleDownloadPlanReceipt(p.id)} style={{fontSize:'11px',color:C.green,cursor:'pointer',marginTop:'8px'}}>{'⬇'} Download plan receipt (PDF)</div>
          </Card>
        ))}
      </div>
    </PageWrap>
  )

  if (paid) return (
    <PageWrap maxWidth={440}>
      <div style={{textAlign:'center',padding:'50px 20px'}}>
        <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Payment received</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px'}}>HK${selectedPayment?((selectedPayment.deductible_applied||0)+(selectedPayment.patient_copay_amount||0)):0} - {selectedPayment?.patients?.full_name||'Unknown'}</div>
        {paidRecord&&<Card style={{padding:'14px',marginBottom:'16px',textAlign:'left'}}>
          {paidRecord.diagnosis&&<div style={{fontSize:'12px',marginBottom:'6px'}}><strong>Diagnosis:</strong> {paidRecord.diagnosis}</div>}
          {(paidRecord.line_items||[]).map((item,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'12px',padding:'3px 0'}}>
              <span>{item.description}{item.qty>1&&` x${item.qty}`}</span><span>HK${(item.fee*item.qty).toFixed(2)}</span>
            </div>
          ))}
        </Card>}
        {!paidRecord&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px'}}>No itemized consultation record linked to this claim.</div>}
        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
          <Btn variant={receiptSent?'secondary':'primary'} disabled={receiptSent||!paidRecord} onClick={async()=>{
            await supabase.from('medical_records').update({receipt_sent_at:new Date().toISOString()}).eq('id',paidRecord.id)
            setReceiptSent(true)
          }}>{receiptSent?"Marked sent to patient's Medsa app":!paidRecord?'No record to send':'Send receipt to Medsa app'}</Btn>
          {/* This used to be window.print() on this bare on-screen div -
              a browser print of unstyled stacked text, not a real
              receipt. Now generates the same properly laid-out PDF as
              Financial Records' download, so there's one receipt design
              in the whole app, not two. */}
          <Btn disabled={!paidTransaction} onClick={()=>{handleDownloadReceipt(paidTransaction);setPrinted(true)}}>{!paidTransaction?'Receipt unavailable':printed?'Downloaded - download again':'Download receipt (PDF)'}</Btn>
        </div>
        {receiptSent&&<div style={{fontSize:'12px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>{'\u25c7'} Receipt, consultation notes, and prescription are now synced to the patient's Medsa cloud record.</div>}
        <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setPaid(false);setReceiptSent(false);setPrinted(false);setSelectedPayment(null);setPaidTransaction(null);setTxnRef('')}}>New payment</Btn>
      </div>
    </PageWrap>
  )

  return (
    <PageWrap maxWidth={440}>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px',justifyContent:'center'}}>
        {[['collect','Collect payment'],['plans','Treatment plans'],['ledger','Financial records']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{fontSize:'13px',padding:'9px 18px',borderRadius:'20px',cursor:'pointer',background:tab===k?C.green:C.card,color:tab===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
      {!selectedPayment&&<>
        <SecLabel>Pending patient payments</SecLabel>
        <input value={paymentSearch} onChange={e=>setPaymentSearch(e.target.value)} placeholder="Search by patient or insurer…" style={{width:'100%',padding:'10px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box'}}/>
        {pendingLoading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,padding:'20px'}}>Loading…</div>}
        {!pendingLoading&&pendingPayments.length===0&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,padding:'20px'}}>No outstanding patient payments right now.</div>}
        {!pendingLoading&&pendingPayments
          .filter(p => !paymentSearch.trim() || (p.patients?.full_name||'').toLowerCase().includes(paymentSearch.toLowerCase()) || (p.insurance_plans?.company_name||'').toLowerCase().includes(paymentSearch.toLowerCase()))
          .map(p=>{
          const owed = (p.deductible_applied||0)+(p.patient_copay_amount||0)
          return (
            <Card key={p.claim_ref} onClick={()=>setSelectedPayment(p)} style={{padding:'14px 16px',marginBottom:'8px',cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:600}}>{p.patients?.full_name||'Unknown'}</div>
                  <div style={{fontSize:'11px',color:C.textSub}}>{p.claim_ref} - {p.insurance_plans?.company_name||'-'} - {p.submitted_at?new Date(p.submitted_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'}):'-'}</div>
                </div>
                <div style={{fontSize:'15px',fontWeight:700,color:C.green}}>HK${owed}</div>
              </div>
            </Card>
          )
        })}
      </>}

      {selectedPayment&&<>
      <div onClick={()=>setSelectedPayment(null)} style={{fontSize:'12px',color:C.green,cursor:'pointer',marginBottom:'12px'}}>{'\u2039'} Back to pending payments</div>
      <Card style={{padding:'18px',marginBottom:'16px'}}>
        <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>{selectedPayment.patients?.full_name||'Unknown'}</div>
        <div style={{fontSize:'11px',color:C.textSub,marginBottom:'12px'}}>{selectedPayment.claim_ref} - {selectedPayment.insurance_plans?.company_name}</div>
        {[['Consultation fee',`HK$${selectedPayment.amount}`],['Insurance covers',`-HK$${selectedPayment.insurer_covered_amount}`],['Patient pays',`HK$${(selectedPayment.deductible_applied||0)+(selectedPayment.patient_copay_amount||0)}`]].map(([l,v],i)=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:i<2?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}>
            <span style={{color:C.textSub}}>{l}</span>
            <span style={{fontWeight:i===2?700:500,fontSize:i===2?'17px':'13px',color:i===2?C.green:C.text}}>{v}</span>
          </div>
        ))}
        <div style={{marginTop:'10px',paddingTop:'10px',borderTop:`0.5px solid ${C.border}`,fontSize:'11px',color:C.textMuted,lineHeight:1.5}}>
          {'\u25c7'} Itemized against claim {selectedPayment.claim_ref}, ready for reconciliation once collected.
        </div>
      </Card>
      <SecLabel>Payment method</SecLabel>
      <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
        {[['card','Card','\u25c8'],['octopus','Octopus','\u25c9'],['cash','Cash','\u25ce']].map(([k,l,icon])=>(
          <div key={k} onClick={()=>setMethod(k)} style={{flex:1,padding:'14px 8px',borderRadius:'8px',textAlign:'center',cursor:'pointer',background:method===k?C.green:C.card,color:method===k?'#fff':C.text}}>
            <div style={{fontSize:'18px',marginBottom:'4px'}}>{icon}</div>
            <div style={{fontSize:'12px',fontWeight:500}}>{l}</div>
          </div>
        ))}
      </div>
      <TxnRefField method={method} value={txnRef} onChange={setTxnRef}/>
      <Btn variant="primary" style={{width:'100%',padding:'14px'}} onClick={handleCharge} disabled={saving}>{saving?'Processing...':`Charge HK$${(selectedPayment.deductible_applied||0)+(selectedPayment.patient_copay_amount||0)}`}</Btn>
      </>}
    </PageWrap>
  )
}

function InventoryScreen({ staffMember, institutionId, medicineType }) {
  const [invTab,setInvTab]=useState('stock') // 'stock' | 'drugs' - order sets moved to its own page, this only ever held stock + drug reference
  const [items,setItems]=useState([])
  const [loading,setLoading]=useState(true)
  const [showReorderOnly,setShowReorderOnly]=useState(false)
  const [drugRefs,setDrugRefs]=useState([])
  const [loadingDrugs,setLoadingDrugs]=useState(true)
  const [drugSearch,setDrugSearch]=useState('')
  const [pendingDelta,setPendingDelta]=useState({}) // itemId -> uncommitted delta
  const [confirming,setConfirming]=useState(null)
  const [importResult,setImportResult]=useState(null)
  const [addItemOpen,setAddItemOpen]=useState(false)
  const [newItemName,setNewItemName]=useState('')
  const [newItemStock,setNewItemStock]=useState('')
  const [newItemUnit,setNewItemUnit]=useState('units')
  const [newItemReorder,setNewItemReorder]=useState('10')
  const [newItemSupplier,setNewItemSupplier]=useState('')
  const [newItemPrice,setNewItemPrice]=useState('')
  const [addingItem,setAddingItem]=useState(false)
  const [addItemError,setAddItemError]=useState(null)
  const [editingPriceId,setEditingPriceId]=useState(null)
  const [editingPriceValue,setEditingPriceValue]=useState('')
  const [savingPrice,setSavingPrice]=useState(false)

  async function handleStockFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!institutionId) { setImportResult({ type:'stock', imported:0, skipped:0, total:0, error:'Institution not resolved yet - try again in a moment.' }); return }
    const text = await file.text()
    const rows = parseCSV(text)
    let imported=0, skipped=0
    for (const row of rows) {
      if (!row.item_name) { skipped++; continue }
      const { data: existing } = await supabase
        .from('clinic_inventory').select('id')
        .eq('item_name', row.item_name).eq('institution_id', institutionId).maybeSingle()

      const rowPrice = row.price?.trim() ? parseFloat(row.price) : undefined
      if (existing) {
        await supabase.from('clinic_inventory').update({
          stock: parseInt(row.stock)||0, unit: row.unit||'units',
          reorder_at: parseInt(row.reorder_at)||10, supplier: row.supplier||null,
          updated_at: new Date().toISOString(),
          ...(rowPrice !== undefined ? { price: rowPrice } : {}),
        }).eq('id', existing.id)
      } else {
        await supabase.from('clinic_inventory').insert({
          item_name: row.item_name, institution_id: institutionId, stock: parseInt(row.stock)||0, unit: row.unit||'units',
          reorder_at: parseInt(row.reorder_at)||10, supplier: row.supplier||null, price: rowPrice ?? null,
        })
      }
      imported++
    }
    setImportResult({ type:'stock', imported, skipped, total: rows.length })
    const { data } = await supabase.from('clinic_inventory').select('*').eq('institution_id', institutionId).order('item_name',{ascending:true})
    setItems((data||[]).map(r=>({ id:r.id, name:r.item_name, stock:r.stock, unit:r.unit, reorderAt:r.reorder_at, supplier:r.supplier, price:r.price })))
  }

  async function handleReferenceFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const rows = parseCSV(text)
    let imported=0, skipped=0
    const skippedForNoCode = []
    for (const row of rows) {
      if (!row.drug_name) { skipped++; continue }
      const hkReg = row.hk_registration_number?.trim() || null
      const atc = row.atc_code?.trim() || null
      if (!hkReg && !atc) { skippedForNoCode.push(row.drug_name); continue }
      const rowType = (row.medicine_type||medicineType||'western').toLowerCase()
      await supabase.from('drug_reference').upsert({
        drug_name: row.drug_name, medicine_type: rowType, effects: row.effects||null, intake_info: row.intake_info||null,
        precautions: row.precautions||null, hk_registration_number: hkReg, atc_code: atc,
        is_dangerous_drug: ['true','yes','1'].includes((row.is_dangerous_drug||'').toLowerCase()),
        updated_by: staffMember?.name||'CSV import',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'drug_name,medicine_type' })
      imported++
    }
    setImportResult({ type:'reference', imported, skipped: skipped+skippedForNoCode.length, skippedForNoCode, total: rows.length })
    loadDrugRefs()
  }

  async function handleAddItem() {
    if (!newItemName.trim()) { setAddItemError('Item name is required.'); return }
    if (!institutionId) { setAddItemError('Institution not resolved yet - try again in a moment.'); return }
    setAddingItem(true)
    setAddItemError(null)
    const { error } = await supabase.from('clinic_inventory').insert({
      item_name: newItemName.trim(), institution_id: institutionId,
      stock: parseInt(newItemStock)||0, unit: newItemUnit||'units',
      reorder_at: parseInt(newItemReorder)||10, supplier: newItemSupplier||null,
      price: newItemPrice.trim() ? parseFloat(newItemPrice)||0 : null,
    })
    if (error) { setAddItemError(error.message); setAddingItem(false); return }
    const { data } = await supabase.from('clinic_inventory').select('*').eq('institution_id', institutionId).order('item_name', { ascending: true })
    setItems((data||[]).map(r => ({ id: r.id, name: r.item_name, stock: r.stock, unit: r.unit, reorderAt: r.reorder_at, supplier: r.supplier, price: r.price })))
    setAddItemOpen(false)
    setNewItemName(''); setNewItemStock(''); setNewItemUnit('units'); setNewItemReorder('10'); setNewItemSupplier(''); setNewItemPrice('')
    setAddingItem(false)
  }

  // Save the price typed into an item's inline editor - this is the
  // real link ConsultationScreen's prescription auto-itemization reads
  // from (matched by drug name against this same clinic_inventory list),
  // so a drug with no price here just never gets auto-added to a bill.
  async function savePrice(item) {
    setSavingPrice(true)
    const price = editingPriceValue.trim() ? parseFloat(editingPriceValue)||0 : null
    await supabase.from('clinic_inventory').update({ price }).eq('id', item.id)
    setItems(prev=>prev.map(i=>i.id===item.id?{...i,price}:i))
    setEditingPriceId(null)
    setSavingPrice(false)
  }

  useEffect(() => {
    async function load() {
      if (!institutionId) return
      setLoading(true)
      const { data } = await supabase.from('clinic_inventory').select('*').eq('institution_id', institutionId).order('item_name', { ascending: true })
      setItems((data||[]).map(r => ({
        id: r.id, name: r.item_name, stock: r.stock, unit: r.unit, reorderAt: r.reorder_at, supplier: r.supplier, price: r.price,
      })))
      setLoading(false)
    }
    load()
  }, [institutionId])

  async function loadDrugRefs() {
    setLoadingDrugs(true)
    const { data } = await supabase.from('drug_reference').select('*').eq('medicine_type', medicineType==='chinese'?'chinese':'western').order('drug_name')
    setDrugRefs(data||[])
    setLoadingDrugs(false)
  }
  useEffect(() => { loadDrugRefs() }, [medicineType])

  const displayed = showReorderOnly ? items.filter(i=>i.stock<=i.reorderAt) : items
  const filteredDrugRefs = drugRefs.filter(d => d.drug_name?.toLowerCase().includes(drugSearch.toLowerCase()))
  const lowStockCount = items.filter(i=>i.stock<=i.reorderAt).length

  function adjustPending(id, delta) {
    setPendingDelta(prev => ({ ...prev, [id]: (prev[id]||0) + delta }))
  }

  async function confirmChange(id) {
    const delta = pendingDelta[id]
    if (!delta) return
    setConfirming(id)
    const item = items.find(i=>i.id===id)
    const newStock = Math.max(0, item.stock + delta)
    const staffName = staffMember?.name || 'Unknown'
    const now = new Date().toISOString()

    await supabase.from('clinic_inventory').update({ stock: newStock, updated_at: now }).eq('id', id)
    await supabase.from('inventory_movements').insert({
      inventory_id: id, item_name: item.name, change_amount: delta,
      new_stock: newStock, reason: 'manual_adjustment', staff_name: staffName,
    })

    setItems(prev=>prev.map(i=>i.id===id?{...i,stock:newStock}:i))
    setPendingDelta(prev => { const next={...prev}; delete next[id]; return next })
    setConfirming(null)
  }

  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'16px',textAlign:'center'}}>Inventory</h2>
      <div style={{display:'flex',gap:'8px',marginBottom:'20px',justifyContent:'center'}}>
        {[['stock','Stock'],['drugs','Drugs']].map(([k,l])=>(
          <div key={k} onClick={()=>setInvTab(k)} style={{fontSize:'13px',padding:'9px 18px',borderRadius:'20px',cursor:'pointer',background:invTab===k?C.green:C.card,color:invTab===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>

      {invTab==='stock'&&<>
      <div style={{display:'flex',gap:'10px',marginBottom:'16px',justifyContent:'center'}}>
        <label style={{fontSize:'13px',fontWeight:600,padding:'11px 18px',borderRadius:'10px',cursor:'pointer',background:C.green,color:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.12)'}}>
          {'\u2191'} Import stock & prices CSV
          <input type="file" accept=".csv" onChange={handleStockFile} style={{display:'none'}}/>
        </label>
      </div>
      {importResult?.type==='stock'&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:C.green,textAlign:'center'}}>
        Stock import: {importResult.imported} of {importResult.total} rows imported{importResult.skipped>0?`, ${importResult.skipped} skipped`:''}.
      </div>}
      <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginBottom:'16px',lineHeight:1.5}}>
        Stock CSV columns: item_name, stock, unit, reorder_at, supplier, price (optional - a drug with a price here is auto-added to the itemized bill when prescribed)
      </div>
      {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,marginBottom:'16px'}}>Loading...</div>}
      {lowStockCount>0&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'16px'}}>
        <span style={{fontSize:'13px',fontWeight:600,color:C.amber}}>{'\u26a0'} {lowStockCount} item(s) at or below reorder level</span>
      </div>}
      <div style={{display:'flex',gap:'8px',marginBottom:'16px',justifyContent:'center'}}>
        {[[false,'All items'],[true,'Needs reorder']].map(([v,l])=>(
          <div key={String(v)} onClick={()=>setShowReorderOnly(v)} style={{fontSize:'12px',padding:'7px 14px',borderRadius:'20px',cursor:'pointer',background:showReorderOnly===v?C.green:C.card,color:showReorderOnly===v?'#fff':C.textSub,fontWeight:500}}>{l}</div>
        ))}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {displayed.map((item)=>{
          const low = item.stock <= item.reorderAt
          const delta = pendingDelta[item.id] || 0
          const previewStock = Math.max(0, item.stock + delta)
          return (
            <Card key={item.id} style={{padding:'14px 18px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'13px',fontWeight:600}}>{item.name}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{item.supplier} - reorder at {item.reorderAt} {item.unit}</div>
                  {editingPriceId===item.id ? (
                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'6px'}}>
                      <span style={{fontSize:'12px',color:C.textSub}}>HK$</span>
                      <input type="number" step="0.01" autoFocus value={editingPriceValue} onChange={e=>setEditingPriceValue(e.target.value)} style={{width:80,border:`0.5px solid ${C.border}`,borderRadius:'6px',padding:'4px 6px',fontSize:'12px'}}/>
                      <button onClick={()=>savePrice(item)} disabled={savingPrice} style={{padding:'4px 8px',background:C.green,color:'#fff',border:'none',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>{savingPrice?'...':'Save'}</button>
                      <button onClick={()=>setEditingPriceId(null)} style={{padding:'4px 8px',background:C.card,color:C.textSub,border:'none',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>Cancel</button>
                    </div>
                  ) : (
                    <div onClick={()=>{setEditingPriceId(item.id);setEditingPriceValue(item.price!=null?String(item.price):'')}} style={{fontSize:'12px',color:item.price!=null?C.green:C.textMuted,marginTop:'4px',cursor:'pointer'}}>
                      {item.price!=null?`HK$${item.price}`:'No price set'} <span style={{textDecoration:'underline'}}>edit</span>
                    </div>
                  )}
                </div>
                {low&&!delta&&<Badge text="Reorder" type="due"/>}
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <button onClick={()=>adjustPending(item.id,-10)} style={{width:28,height:28,borderRadius:'6px',border:`0.5px solid ${C.border}`,background:'#fff',cursor:'pointer'}}>-</button>
                  <div style={{width:70,textAlign:'center'}}>
                    <span style={{fontSize:'15px',fontWeight:700,color:previewStock<=item.reorderAt?C.amber:C.text}}>{previewStock}</span>
                    <span style={{fontSize:'11px',color:C.textMuted}}> {item.unit}</span>
                  </div>
                  <button onClick={()=>adjustPending(item.id,10)} style={{width:28,height:28,borderRadius:'6px',border:`0.5px solid ${C.border}`,background:'#fff',cursor:'pointer'}}>+</button>
                </div>
              </div>
              {delta!==0&&<div style={{marginTop:'10px',paddingTop:'10px',borderTop:`0.5px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:'11px',color:C.amber}}>Unsaved change: {delta>0?'+':''}{delta} {item.unit}</span>
                <div style={{display:'flex',gap:'6px'}}>
                  <Btn style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>setPendingDelta(prev=>{const n={...prev};delete n[item.id];return n})}>Cancel</Btn>
                  <Btn variant="primary" style={{fontSize:'11px',padding:'6px 10px'}} onClick={()=>confirmChange(item.id)} disabled={confirming===item.id}>{confirming===item.id?'Saving...':'Confirm'}</Btn>
                </div>
              </div>}
            </Card>
          )
        })}
      </div>
      {!addItemOpen&&<div style={{textAlign:'center',marginTop:'16px'}}><Btn variant="primary" onClick={()=>setAddItemOpen(true)}>+ Add item</Btn></div>}
      {addItemOpen&&<Card style={{padding:'16px',marginTop:'16px'}}>
        <div style={{fontSize:'13px',fontWeight:600,marginBottom:'10px'}}>Add stock item</div>
        <input value={newItemName} onChange={e=>setNewItemName(e.target.value)} placeholder="Item name" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px'}}/>
        <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
          <input value={newItemStock} onChange={e=>setNewItemStock(e.target.value)} type="number" placeholder="Starting stock" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          <input value={newItemUnit} onChange={e=>setNewItemUnit(e.target.value)} placeholder="Unit (e.g. tablets)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          <input value={newItemReorder} onChange={e=>setNewItemReorder(e.target.value)} type="number" placeholder="Reorder at" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          <input value={newItemSupplier} onChange={e=>setNewItemSupplier(e.target.value)} placeholder="Supplier (optional)" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
        </div>
        <input value={newItemPrice} onChange={e=>setNewItemPrice(e.target.value)} type="number" step="0.01" placeholder="Price (HK$, optional - leave blank if not charged directly)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'10px'}}/>
        {addItemError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{addItemError}</div>}
        <div style={{display:'flex',gap:'8px'}}>
          <Btn style={{flex:1}} onClick={()=>{setAddItemOpen(false);setAddItemError(null)}}>Cancel</Btn>
          <Btn variant="primary" style={{flex:1}} onClick={handleAddItem} disabled={addingItem}>{addingItem?'Adding...':'Add item'}</Btn>
        </div>
      </Card>}
      </>}

      {invTab==='drugs'&&<>
      <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginBottom:'12px',lineHeight:1.5}}>
        This is safety-reference info (effects, precautions, dosing lookup codes) - not stock or pricing. To add a drug's stock level or price (so it can be prescribed and auto-billed), use Stock {'→'} Import stock & prices CSV instead.
      </div>
      <div style={{display:'flex',gap:'10px',marginBottom:'16px',justifyContent:'center'}}>
        <label style={{fontSize:'13px',fontWeight:600,padding:'11px 18px',borderRadius:'10px',cursor:'pointer',background:C.green,color:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.12)'}}>
          {'↑'} Import drug safety-reference CSV
          <input type="file" accept=".csv" onChange={handleReferenceFile} style={{display:'none'}}/>
        </label>
      </div>
      {importResult?.type==='reference'&&<div style={{background:importResult.imported>0?C.greenXLight:C.amberLight,border:`0.5px solid ${importResult.imported>0?C.green:C.amber}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:importResult.imported>0?C.green:C.amber,textAlign:'center'}}>
        Drug info import: {importResult.imported} of {importResult.total} rows imported{importResult.skipped>0?`, ${importResult.skipped} skipped`:''}.
        {importResult.imported===0&&importResult.total>0&&<div style={{marginTop:'4px'}}>All rows skipped usually means this CSV doesn't have a drug_name column, or is a stock/price CSV meant for the Stock tab instead.</div>}
        {importResult.skippedForNoCode?.length>0&&<div style={{marginTop:'4px'}}>Skipped for missing a required HK Registration Number or ATC Code: {importResult.skippedForNoCode.join(', ')}</div>}
      </div>}
      <div style={{fontSize:'11px',color:C.textMuted,textAlign:'center',marginBottom:'16px',lineHeight:1.5}}>
        Drug info CSV columns: drug_name, effects, intake_info, precautions, medicine_type (optional - western or chinese, defaults to this clinic's type). Requires an hk_registration_number or atc_code column per row - this is what lets a real safety database look each drug up; rows without either are skipped, not imported with guessed data.
      </div>
      <input value={drugSearch} onChange={e=>setDrugSearch(e.target.value)} placeholder="Search drugs..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'16px'}}/>
      {loadingDrugs&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,marginBottom:'16px'}}>Loading...</div>}
      {!loadingDrugs&&filteredDrugRefs.length===0&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,padding:'20px'}}>No drugs on file yet - import a drug info CSV above.</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {filteredDrugRefs.map(d=>(
          <Card key={d.id} style={{padding:'12px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'10px'}}>
              <div style={{fontSize:'13px',fontWeight:600}}>{d.drug_name}</div>
              {d.is_dangerous_drug&&<span style={{fontSize:'10px',fontWeight:700,color:C.red,background:C.redLight,borderRadius:'4px',padding:'2px 6px',whiteSpace:'nowrap'}}>DANGEROUS DRUG</span>}
            </div>
            <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{d.hk_registration_number?`HK Reg ${d.hk_registration_number}`:''}{d.hk_registration_number&&d.atc_code?' · ':''}{d.atc_code?`ATC ${d.atc_code}`:''}</div>
            {d.effects&&<div style={{fontSize:'12px',color:C.textSub,marginTop:'6px'}}>{d.effects}</div>}
            {d.precautions&&<div style={{fontSize:'12px',color:C.amber,marginTop:'4px'}}>{'⚠'} {d.precautions}</div>}
          </Card>
        ))}
      </div>
      </>}
    </PageWrap>
  )
}

// Read-only reference for order sets - these previously only ever
// surfaced implicitly, as a safety check fired while actually
// prescribing. A doctor or nurse who just wants to look up "what's the
// safe dose range / hard-stop conditions for this drug" without
// starting a prescription had nowhere to go for that.
function OrderSetsScreen({ institutionId, staffMember }) {
  const [orderSets, setOrderSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  async function load() {
    if (!institutionId) return
    setLoading(true)
    const { data } = await supabase.from('order_sets').select('*').eq('institution_id', institutionId).order('drug_name')
    setOrderSets(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [institutionId])

  // Moved here from Inventory - order sets are per-drug dosing/safety
  // rules (hard-stop/soft-stop conditions, age and dose ranges), a
  // completely different kind of data from stock or drug-reference
  // info, so the upload for them belongs on the page that actually
  // shows what got imported.
  async function handleOrderSetFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (staffMember?.role !== 'admin') { setImportResult({ imported:0, skipped:0, total:0, error:'Only a practice manager can import order sets - this is real safety logic, not inventory.' }); return }
    if (!institutionId) { setImportResult({ imported:0, skipped:0, total:0, error:'Institution not resolved yet - try again in a moment.' }); return }
    const text = await file.text()
    const rows = parseCSV(text).filter(row => row.drug_name)
    // Writes go through a server route, not straight to the database -
    // order sets drive real hard-stop/soft-stop safety logic, so the
    // write itself is re-checked server-side against the caller's
    // actual stored role rather than trusting this client-side check
    // alone.
    const res = await fetch('/api/staff/import-order-sets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medsaId: staffMember.id, institutionId, rows }),
    })
    const result = await res.json()
    if (!res.ok) { setImportResult({ imported:0, skipped:0, total:0, error: result.error || 'Import failed.' }); return }
    setImportResult({ imported: result.imported, skipped: result.skipped, total: result.total })
    load()
  }

  async function deleteOrderSet(o) {
    if (staffMember?.role !== 'admin') return
    if (!window.confirm(`Delete the order set for "${o.drug_name}"? This removes its dosing/safety rules - prescribing this drug will no longer be checked against them.`)) return
    setDeletingId(o.id)
    await supabase.from('order_sets').delete().eq('id', o.id)
    setOrderSets(prev => prev.filter(x => x.id !== o.id))
    if (openId === o.id) setOpenId(null)
    setDeletingId(null)
  }

  const filtered = orderSets.filter(o => o.drug_name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Order Sets</h2>
      {staffMember?.role==='admin'&&<>
      <div style={{display:'flex',justifyContent:'center',marginBottom:'12px'}}>
        <label style={{fontSize:'13px',fontWeight:600,padding:'11px 18px',borderRadius:'10px',cursor:'pointer',background:C.green,color:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.12)'}}>
          {'↑'} Import order sets CSV
          <input type="file" accept=".csv" onChange={handleOrderSetFile} style={{display:'none'}}/>
        </label>
      </div>
      <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px',textAlign:'center'}}>Requires drug_name per row, and every rule is auto-approved under your own name, since who approved it is never optional. Columns: min_dose_per_kg, max_dose_per_kg, dose_unit, min_age_years, max_age_years, renal_adjustment_notes, high_alert, hard_stop_conditions, soft_stop_conditions (semicolon-separated for multiple). Same-drug-name rows in hard_stop_conditions/soft_stop_conditions on another drug's row are what the drug-to-drug interaction check reads at prescribing time.</div>
      {importResult&&<div style={{background:importResult.error?C.amberLight:C.greenXLight,border:`0.5px solid ${importResult.error?C.amber:C.green}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'16px',fontSize:'12px',color:importResult.error?C.amber:C.green,textAlign:'center'}}>
        {importResult.error || `Order sets import: ${importResult.imported} of ${importResult.total} rows imported${importResult.skipped>0?`, ${importResult.skipped} skipped`:''}.`}
      </div>}
      </>}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by drug name..." style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'16px'}}/>
      {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted}}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{textAlign:'center',fontSize:'13px',color:C.textMuted,padding:'20px'}}>{orderSets.length===0?'No order sets imported yet - a practice manager can import a CSV above.':'No drug matches that search.'}</div>}
      {filtered.map(o=>{
        const open = openId === o.id
        return (
        <Card key={o.id} style={{padding:'16px 18px',marginBottom:'10px',cursor:'pointer'}} onClick={()=>setOpenId(open?null:o.id)}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{fontSize:'14px',fontWeight:700}}>{o.drug_name}</div>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              {o.high_alert&&<Badge text="High alert" type="full"/>}
              <span style={{fontSize:'12px',color:C.textMuted}}>{open?'▲':'▼'}</span>
            </div>
          </div>
          {open&&<div onClick={e=>e.stopPropagation()} style={{marginTop:'10px',paddingTop:'10px',borderTop:`0.5px solid ${C.border}`}}>
            {(o.min_dose_per_kg||o.max_dose_per_kg)&&<div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Dose range: {o.min_dose_per_kg||'?'}{'–'}{o.max_dose_per_kg||'?'} {o.dose_unit}/kg</div>}
            {(o.min_age_years!=null||o.max_age_years!=null)&&<div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Age range: {o.min_age_years??'0'}{'–'}{o.max_age_years??'∞'} years</div>}
            {o.renal_adjustment_notes&&<div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>Renal: {o.renal_adjustment_notes}</div>}
            {o.hard_stop_conditions?.length>0&&<div style={{fontSize:'12px',color:C.red,marginBottom:'4px'}}>{'⚠'} Hard stop: {o.hard_stop_conditions.join(', ')}</div>}
            {o.soft_stop_conditions?.length>0&&<div style={{fontSize:'12px',color:C.amber,marginBottom:'4px'}}>{'⚠'} Soft stop: {o.soft_stop_conditions.join(', ')}</div>}
            {!o.min_dose_per_kg&&!o.max_dose_per_kg&&o.min_age_years==null&&o.max_age_years==null&&!o.renal_adjustment_notes&&!o.hard_stop_conditions?.length&&!o.soft_stop_conditions?.length&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'4px'}}>No dosing/safety details filled in for this drug beyond what's shown above.</div>}
            <div style={{fontSize:'11px',color:C.textMuted,marginTop:'6px',marginBottom:'10px'}}>Approved by {o.approved_by}{o.approved_at?` on ${new Date(o.approved_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}`:''}</div>
            {staffMember?.role==='admin'&&<button onClick={()=>deleteOrderSet(o)} disabled={deletingId===o.id} style={{padding:'6px 12px',background:C.redLight,color:C.red,border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>{deletingId===o.id?'Deleting...':'Delete'}</button>}
          </div>}
        </Card>
        )
      })}
    </PageWrap>
  )
}

// ── DRUG SAFETY DATABASE (MIMS) ─────────────────────────────────────────────
// Connects this clinic's real drug-safety database key, so the safety
// check that fires when prescribing (checkDrugSafety, in ConsultationScreen)
// switches from the honest mock to a real one automatically - see
// lib/cdsAdapter.js's getCdsAdapter(). The key itself is never sent back to
// the browser once saved (institutions.mims_api_key has no anon SELECT at
// all) - this screen only ever shows whether one is connected, not what it is.
function MimsSettingsScreen({ staffMember, institutionId, institutionName }) {
  const [connectedAt,setConnectedAt]=useState(null)
  const [connectedBy,setConnectedBy]=useState(null)
  const [loading,setLoading]=useState(true)
  const [apiKeyInput,setApiKeyInput]=useState('')
  const [saving,setSaving]=useState(false)
  const [result,setResult]=useState(null)

  async function load() {
    if (!institutionId) return
    setLoading(true)
    const { data } = await supabase.from('institutions').select('mims_connected_at, mims_connected_by').eq('id', institutionId).maybeSingle()
    setConnectedAt(data?.mims_connected_at || null)
    setConnectedBy(data?.mims_connected_by || null)
    setLoading(false)
  }
  useEffect(() => { load() }, [institutionId])

  async function handleSave(disconnect=false) {
    setSaving(true)
    setResult(null)
    const res = await fetch('/api/staff/set_mims_api_key', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ medsaId: staffMember.id, institutionId, apiKey: disconnect ? '' : apiKeyInput }),
    })
    const data = await res.json()
    if (!res.ok) { setResult({ error: data.error || 'Could not save.' }); setSaving(false); return }
    setResult({ connected: data.connected })
    setApiKeyInput('')
    setSaving(false)
    load()
  }

  return (
    <PageWrap maxWidth={520}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'8px',textAlign:'center'}}>Drug Safety Database</h2>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'20px',textAlign:'center',lineHeight:1.5}}>Connects {institutionName||'this clinic'} to a real drug-safety database (MIMS Integrated or similar) for the check that runs when prescribing. Without one connected, that check runs on built-in test logic only - not a real clinical safety verdict.</div>

      {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,marginBottom:'16px'}}>Loading...</div>}
      {!loading&&<div style={{background:connectedAt?C.greenXLight:C.amberLight,border:`0.5px solid ${connectedAt?C.green:C.amber}`,borderRadius:'10px',padding:'12px 16px',marginBottom:'20px',fontSize:'12px',color:connectedAt?C.green:C.amber}}>
        {connectedAt
          ? `✓ Connected by ${connectedBy} on ${new Date(connectedAt).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} - prescribing safety checks now use this real database.`
          : '⚠ Not connected - prescribing safety checks are running on test logic only, not real clinical data.'}
      </div>}

      <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,marginBottom:'6px'}}>MIMS Integrated API key</div>
      <input type="password" value={apiKeyInput} onChange={e=>setApiKeyInput(e.target.value)} placeholder={connectedAt?'Enter a new key to replace the current one':'Paste your MIMS Integrated API key'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'12px'}}/>
      <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px',lineHeight:1.5}}>This is a real API key issued by MIMS to your clinic under a MIMS Integrated API agreement - not the login for a doctor's personal MIMS account. If your clinic doesn't have one yet, that's a step to take up with MIMS directly, not something this page can create.</div>

      {result?.error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{result.error}</div>}
      {result&&!result.error&&<div style={{fontSize:'12px',color:C.green,marginBottom:'12px'}}>{result.connected?'Connected.':'Disconnected.'}</div>}

      <div style={{display:'flex',gap:'8px'}}>
        <Btn variant="primary" style={{flex:1}} onClick={()=>handleSave(false)} disabled={saving||!apiKeyInput.trim()}>{saving?'Saving...':'Save key'}</Btn>
        {connectedAt&&<Btn style={{flex:1}} onClick={()=>handleSave(true)} disabled={saving}>Disconnect</Btn>}
      </div>
    </PageWrap>
  )
}

// ── RECEIPT BRANDING ─────────────────────────────────────────────────────────
// Lets a practice manager put their own clinic's identity on receipts
// (logo, clinic name, address, phone, footer note) instead of the default
// "Medsa Health" branding - both handleDownloadReceipt (consultation
// receipts) and handleDownloadPlanReceipt (treatment plan receipts) read
// these same institutions columns. Writes go straight from the browser
// (not through a server route) since none of these fields are secret -
// same anon-writable pattern as the rest of institutions' public columns.
const DEFAULT_RECEIPT_BANNER_COLOR = '#006241'

function ReceiptBrandingScreen({ institutionId, institutionName }) {
  const [loading,setLoading]=useState(true)
  const [logoUrl,setLogoUrl]=useState(null)
  const [clinicName,setClinicName]=useState('')
  const [address,setAddress]=useState('')
  const [phone,setPhone]=useState('')
  const [footerNote,setFooterNote]=useState('')
  const [bannerColor,setBannerColor]=useState(DEFAULT_RECEIPT_BANNER_COLOR)
  const [uploading,setUploading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)

  async function load() {
    if (!institutionId) return
    setLoading(true)
    const { data } = await supabase.from('institutions')
      .select('receipt_logo_url, receipt_clinic_name, receipt_address, receipt_phone, receipt_footer_note, receipt_banner_color')
      .eq('id', institutionId).maybeSingle()
    setLogoUrl(data?.receipt_logo_url || null)
    setClinicName(data?.receipt_clinic_name || '')
    setAddress(data?.receipt_address || '')
    setPhone(data?.receipt_phone || '')
    setFooterNote(data?.receipt_footer_note || '')
    setBannerColor(data?.receipt_banner_color || DEFAULT_RECEIPT_BANNER_COLOR)
    setLoading(false)
  }
  useEffect(() => { load() }, [institutionId])

  async function handleLogoFile(file) {
    setUploading(true)
    const path = `${institutionId}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('clinic-branding').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('clinic-branding').getPublicUrl(path)
      setLogoUrl(data.publicUrl)
    }
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true); setSaved(false)
    await supabase.from('institutions').update({
      receipt_logo_url: logoUrl,
      receipt_clinic_name: clinicName.trim() || null,
      receipt_address: address.trim() || null,
      receipt_phone: phone.trim() || null,
      receipt_footer_note: footerNote.trim() || null,
      receipt_banner_color: bannerColor !== DEFAULT_RECEIPT_BANNER_COLOR ? bannerColor : null,
    }).eq('id', institutionId)
    setSaving(false)
    setSaved(true)
  }

  return (
    <PageWrap maxWidth={520}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'8px',textAlign:'center'}}>Receipt Branding</h2>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'20px',textAlign:'center',lineHeight:1.5}}>Puts {institutionName||'your clinic'}'s own logo and details on consultation and treatment plan receipts instead of the default Medsa Health branding. Leave blank to keep using the default.</div>

      {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,marginBottom:'16px'}}>Loading...</div>}

      {!loading&&<>
        <SecLabel>Clinic logo</SecLabel>
        <div style={{display:'flex',alignItems:'center',gap:'14px',marginBottom:'18px'}}>
          {logoUrl
            ? <img src={logoUrl} alt="Clinic logo" style={{width:'64px',height:'64px',objectFit:'contain',borderRadius:'8px',border:`0.5px solid ${C.border}`,background:'#fff'}}/>
            : <div style={{width:'64px',height:'64px',borderRadius:'8px',border:`1px dashed ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:C.textMuted,textAlign:'center'}}>No logo</div>}
          <div style={{flex:1}}>
            <input type="file" accept="image/*" id="receipt-logo-upload" style={{display:'none'}} onChange={e=>{const f=e.target.files[0]; if(f) handleLogoFile(f)}}/>
            <Btn onClick={()=>document.getElementById('receipt-logo-upload').click()} disabled={uploading}>{uploading?'Uploading...':logoUrl?'Replace logo':'Upload logo'}</Btn>
            {logoUrl&&<div onClick={()=>setLogoUrl(null)} style={{fontSize:'11px',color:C.red,cursor:'pointer',marginTop:'8px'}}>Remove logo</div>}
          </div>
        </div>

        <SecLabel>Clinic name on receipt</SecLabel>
        <input value={clinicName} onChange={e=>setClinicName(e.target.value)} placeholder={institutionName || 'e.g. Kowloon Family Clinic'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'12px'}}/>

        <SecLabel>Address</SecLabel>
        <input value={address} onChange={e=>setAddress(e.target.value)} placeholder="e.g. 12/F, Nathan Road, Mong Kok, Kowloon" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'12px'}}/>

        <SecLabel>Phone</SecLabel>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="e.g. +852 2345 6789" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'12px'}}/>

        <SecLabel>Footer note (optional)</SecLabel>
        <input value={footerNote} onChange={e=>setFooterNote(e.target.value)} placeholder="Defaults to a standard system-generated receipt note" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'16px'}}/>

        <SecLabel>Banner color</SecLabel>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'8px'}}>
          <input type="color" value={bannerColor} onChange={e=>setBannerColor(e.target.value)} style={{width:'44px',height:'44px',padding:0,border:`0.5px solid ${C.border}`,borderRadius:'8px',cursor:'pointer'}}/>
          <input value={bannerColor} onChange={e=>{const v=e.target.value; if(/^#[0-9a-fA-F]{0,6}$/.test(v)) setBannerColor(v)}} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
          {bannerColor!==DEFAULT_RECEIPT_BANNER_COLOR&&<Btn onClick={()=>setBannerColor(DEFAULT_RECEIPT_BANNER_COLOR)}>Reset</Btn>}
        </div>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'16px',lineHeight:1.5}}>Colors the header band and accents on both receipt types. Text automatically switches to stay readable, whatever color you pick.</div>

        {saved&&<div style={{fontSize:'12px',color:C.green,marginBottom:'12px'}}>Saved - new receipts will use this branding.</div>}
        <Btn variant="primary" style={{width:'100%'}} onClick={handleSave} disabled={saving||uploading}>{saving?'Saving...':'Save branding'}</Btn>
      </>}
    </PageWrap>
  )
}

// ── ANOMALY REVIEW ───────────────────────────────────────────────────────────
// Shows flags raised by detect_claim_anomalies.js (a daily cron job) -
// patterns like one practitioner logging an implausible number of
// distinct patients in a single day. Never blocks anything on its own -
// this is a review queue for staff to look at and clear, same as the
// existing post-call and order-escalation flag screens elsewhere in this
// file. A flag here is a reason to look closer, not a verdict.
function AnomalyFlagsScreen({ staffMember }) {
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('claim_anomaly_flags').select('*').eq('status', 'active').order('created_at', { ascending: false })
    setFlags(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleClear(flag) {
    await supabase.from('claim_anomaly_flags').update({ status: 'cleared', cleared_at: new Date().toISOString(), cleared_by: staffMember?.name || null }).eq('id', flag.id)
    load()
  }

  return (
    <PageWrap maxWidth={640}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'6px',textAlign:'center'}}>Anomaly Review</h2>
      <div style={{fontSize:'12px',color:C.textSub,marginBottom:'20px',textAlign:'center'}}>Automated volume checks on consultations and claims - nothing here is blocked, just flagged for a look.</div>
      {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted}}>Loading...</div>}
      {!loading&&flags.length===0&&<div style={{textAlign:'center',fontSize:'13px',color:C.textMuted,padding:'20px'}}>No active flags.</div>}
      {flags.map(f=>(
        <Card key={f.id} style={{padding:'16px 18px',marginBottom:'10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
            <div style={{fontSize:'14px',fontWeight:700}}>{f.doctor_name}</div>
            <Badge text={`${f.distinct_patient_count} patients / day`} type="full"/>
          </div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>{f.detail}</div>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>Window: {f.window_date} · Flagged {new Date(f.created_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
          <button onClick={()=>handleClear(f)} style={{padding:'8px 14px',background:C.card,border:`0.5px solid ${C.border}`,borderRadius:'8px',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>Clear — reviewed, no issue</button>
        </Card>
      ))}
    </PageWrap>
  )
}

// ── CLAIMS CLEARINGHOUSE ─────────────────────────────────────────────────────
// Validates claims before they leave the clinic, calculates the per-claim
// Medsa clearinghouse fee, and tracks status through the pipeline. Actual
// transmission to an insurer is a manual/portal handoff until a real insurer
// API or EDI contract exists - this is flagged honestly in the UI itself.
function ClaimsScreen({ onNavPayment }) {
  const [step,setStep]=useState('list')
  const [claimType,setClaimType]=useState('outpatient')
  const [selectedPatient,setSelectedPatient]=useState(null)
  const [selectedPlan,setSelectedPlan]=useState(null)
  const [amount,setAmount]=useState('')
  const [patients,setPatients]=useState([])
  const [plans,setPlans]=useState([])
  const [existingClaims,setExistingClaims]=useState([])
  const [loading,setLoading]=useState(true)
  const [adjudicating,setAdjudicating]=useState(false)
  const [reloadTrigger,setReloadTrigger]=useState(0)
  const [adjudicationResult,setAdjudicationResult]=useState(null)
  const [affiliatedPolicies,setAffiliatedPolicies]=useState(null) // null = not checked yet, [] = checked, none found

  useEffect(() => {
    if (!selectedPatient?.id) { setAffiliatedPolicies(null); return }
    async function loadAffiliations() {
      const { data } = await supabase.from('agent_policies').select('*')
        .eq('patient_id', selectedPatient.id).eq('status', 'active')
      setAffiliatedPolicies(data||[])
    }
    loadAffiliations()
  }, [selectedPatient?.id])

  const [pendingRecord,setPendingRecord]=useState(null)
  useEffect(() => {
    if (!selectedPatient?.id) { setPendingRecord(null); return }
    async function loadRecord() {
      // Also pulls icd10_code/diagnosis now - this is what the claim's
      // items get built from below, instead of the generic claim-type
      // string every claim used to submit regardless of the real coding
      // already captured on the visit.
      const { data } = await supabase.from('medical_records').select('id, icd10_code, diagnosis')
        .eq('patient_id', selectedPatient.id).is('insurance_claim_id', null)
        .order('date_of_record', { ascending: false }).limit(1).maybeSingle()
      setPendingRecord(data || null)
    }
    loadRecord()
  }, [selectedPatient?.id])
  const pendingMedicalRecordId = pendingRecord?.id || null
  const pendingIcd10Codes = (pendingRecord?.icd10_code || '').split(',').map(s=>s.trim()).filter(Boolean)

  const affiliatedPlans = affiliatedPolicies ? plans.filter(pl => affiliatedPolicies.some(ap => ap.plan_id === pl.id)) : plans

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{data:patientRows},{data:consentRows},{data:planRows},{data:claimRows}] = await Promise.all([
        supabase.from('patients').select('id, full_name, medsa_id'),
        supabase.from('patient_consent').select('patient_id').eq('active', true),
        supabase.from('insurance_plans').select('*'),
        supabase.from('insurance_claims').select('*, patients(full_name), insurance_plans(plan_name, company_name)').order('submitted_at', { ascending: false }).limit(10),
      ])
      const consentedIds = new Set((consentRows||[]).map(c=>c.patient_id))
      setPatients((patientRows||[]).map(p => ({
        id: p.id, name: p.full_name, medsaId: p.medsa_id, consented: consentedIds.has(p.id),
      })))
      setPlans(planRows||[])
      setExistingClaims((claimRows||[]).map(c => ({
        ref: c.claim_ref, patient: c.patients?.full_name||'Unknown', insurer: c.insurance_plans?.company_name||'-',
        amount: c.amount, fee: c.platform_claim_fee||0, status: c.status,
        deductibleApplied: c.deductible_applied||0, patientCopayAmount: c.patient_copay_amount||0,
        paymentProcessingFee: c.payment_processing_fee||0, copayPaymentMethod: c.copay_payment_method,
        date: c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'}) : '-',
      })))
      setLoading(false)
    }
    load()
  }, [reloadTrigger])

  const statusMeta = {
    approved: {label:'Approved', type:'ok', desc:'Insurer has approved this claim in full'},
    partially_approved: {label:'Partially approved', type:'due', desc:'Insurer covered part of the claim - patient owes the remainder'},
    rejected: {label:'Rejected', type:'off', desc:'Not covered - patient pays the full amount'},
    pending_review: {label:'Pending review', type:'waiting', desc:'High-value claim - held for manual review before settlement'},
    settled: {label:'Settled', type:'ok', desc:'Payment collected and claim fully closed'},
  }

  if (step==='list') return (
    <PageWrap maxWidth={680}>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'20px',textAlign:'center'}}>Direct Billing Claims</h2>

      <div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
        <div style={{fontSize:'14px',fontWeight:600,color:C.green,marginBottom:'4px'}}>How this works</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Medsa validates each claim - checking patient consent, policy on file, and required documents - before it's sent to the insurer. A small clearinghouse fee is paid by the insurer per validated claim, not by your clinic.</div>
      </div>
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'12px',fontSize:'12px',color:C.textSub,lineHeight:1.5}}>
        {'\u25c7'} This only applies to patients on a direct-billing plan with an in-network insurer. If a patient pays out of pocket and claims reimbursement themselves, that happens entirely through their own insurer's app - there's nothing for this clinic to track, and no claim should be created here for that visit.
      </div>
      <div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'20px',fontSize:'12px',color:C.amber,lineHeight:1.5}}>
        {'\u25c7'} Until Medsa has a direct connection with a given insurer, "Sent to insurer" means the validated package is ready for you to submit through that insurer's existing portal or email - this step automates fully once an insurer partnership is in place.
      </div>

      <SecLabel>Recent claims</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
        {existingClaims.map((c,i)=>{
          const meta = statusMeta[c.status]
          return (
            <Card key={i} style={{padding:'14px 18px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:500}}>{c.ref} - {c.patient}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{c.insurer} - {c.date}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'15px',fontWeight:600,color:C.green}}>HK${c.amount}</div>
                  <Badge text={meta?.label||c.status} type={meta?.type||'waiting'}/>
                </div>
              </div>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>{meta?.desc}</div>
              <div style={{fontSize:'11px',color:C.blue,marginBottom:'10px'}}>Medsa platform claim fee: HK${c.fee} (paid by insurer)</div>
              {(c.status==='approved'||c.status==='partially_approved')&&(c.deductibleApplied+c.patientCopayAmount)>0&&!c.copayPaymentMethod&&
                <Btn variant="primary" style={{width:'100%'}} onClick={()=>onNavPayment?.(c.ref)}>Collect HK${c.deductibleApplied+c.patientCopayAmount} in Payment</Btn>}
              {c.copayPaymentMethod&&<div style={{fontSize:'11px',color:C.textMuted}}>Copay collected via {c.copayPaymentMethod} - processing fee HK${c.paymentProcessingFee}</div>}
            </Card>
          )
        })}
      </div>
      <div style={{textAlign:'center'}}><Btn variant="primary" onClick={()=>setStep('new')}>+ Submit new claim</Btn></div>
    </PageWrap>
  )

  if (step==='new') return (
    <PageWrap maxWidth={560}>
      <div onClick={()=>setStep('list')} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'16px'}}>Back</div>
      <h2 style={{fontSize:'20px',fontWeight:700,marginBottom:'16px',textAlign:'center'}}>New Claim</h2>
      <SecLabel>Select patient</SecLabel>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
        {patients.map((p)=>(
          <Card key={p.id} onClick={()=>p.consented&&setSelectedPatient(p)} style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',opacity:p.consented?1:0.5,border:selectedPatient?.id===p.id?`1.5px solid ${C.green}`:undefined}}>
            <div><div style={{fontSize:'13px',fontWeight:500}}>{p.name}</div><div style={{fontSize:'12px',color:C.textSub}}>{p.medsaId}</div></div>
            {p.consented?<span style={{fontSize:'12px',color:C.green,fontWeight:600}}>Consented</span>:<span style={{fontSize:'12px',color:C.textMuted}}>No consent on file</span>}
          </Card>
        ))}
      </div>
      {selectedPatient&&<>
        <SecLabel>Insurance plan</SecLabel>
        {affiliatedPolicies&&affiliatedPolicies.length===0&&<div style={{fontSize:'12px',color:C.textMuted,padding:'0 16px 10px'}}>No affiliated insurance plan on file for this patient - this claim can't proceed as direct billing.</div>}
        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
          {affiliatedPlans.map(pl=>{
            const realPolicy = affiliatedPolicies?.find(ap=>ap.plan_id===pl.id)
            return (
              <Card key={pl.id} onClick={()=>setSelectedPlan(pl)} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',border:selectedPlan?.id===pl.id?`1.5px solid ${C.green}`:undefined}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:500}}>{pl.plan_name}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{pl.company_name}</div>
                  {realPolicy?.policy_number&&<div style={{fontSize:'11px',color:C.green,marginTop:'2px'}}>Policy: {realPolicy.policy_number}</div>}
                </div>
              </Card>
            )
          })}
        </div>

        <SecLabel>Claim type</SecLabel>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'8px',marginBottom:'20px'}}>
          {['outpatient','hospitalisation','specialist','lab'].map(t=>(
            <div key={t} onClick={()=>setClaimType(t)} style={{padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:claimType===t?C.green:C.card,color:claimType===t?'#fff':C.text,textTransform:'capitalize'}}>{t}</div>
          ))}
        </div>

        <SecLabel>Claim amount</SecLabel>
        <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="HK$" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'20px'}}/>

        <SecLabel>Validation checklist</SecLabel>
        <Card style={{padding:'16px',marginBottom:'20px'}}>
          {[
            {label:'Patient consent on file', ok:selectedPatient.consented},
            {label:'Insurance plan selected', ok:!!selectedPlan},
            {label:'Consultation record attached', ok:!!pendingRecord},
            {label:'Diagnosis on file', ok:!!pendingRecord?.diagnosis},
            {label:'ICD-10 code on file', ok:pendingIcd10Codes.length>0, detail:pendingIcd10Codes.length>0?pendingIcd10Codes.join(', '):null},
          ].map((item,i,arr)=>(
            <div key={i} style={{padding:'6px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{color:item.ok?C.green:C.red,fontSize:'13px'}}>{item.ok?'\u2713':'\u2715'}</span>
                <span style={{fontSize:'13px',color:item.ok?C.text:C.red}}>{item.label}</span>
              </div>
              {/* Shows the actual code(s) that will go on the claim, not
                  just a checkmark - this is what a doctor/front desk
                  actually needs to see to confirm the right coding is
                  about to be submitted, not just that some code exists. */}
              {item.detail&&<div style={{fontSize:'11px',color:C.textMuted,marginLeft:'21px'}}>{item.detail}</div>}
            </div>
          ))}
        </Card>

        {amount&&selectedPlan&&<div style={{background:C.blueLight,borderRadius:'8px',padding:'12px 14px',marginBottom:'20px',fontSize:'12px',color:C.blue}}>
          Medsa clearinghouse fee for this claim: <strong>HK${calculatePlatformClaimFee(amount)}</strong> (paid by {selectedPlan.company_name}, not deducted from your claim)
        </div>}
        {selectedPatient&&<div style={{fontSize:'11px',color:pendingMedicalRecordId?C.textMuted:C.amber,marginBottom:'14px'}}>
          {pendingMedicalRecordId ? 'A consultation record on file will be linked to this claim for the receipt.' : 'No unlinked consultation record found for this patient - the receipt will show payment only, without itemized diagnosis or prescriptions.'}
        </div>}

        <div style={{textAlign:'center'}}>
          <Btn variant="primary" onClick={async ()=>{
            setAdjudicating(true)
            const adapter = getInsuranceAdapter(selectedPlan.company_name)
            // Real ICD-10 codes already captured on the visit go on the
            // claim itself now - was always the generic claim-type string
            // ("outpatient" etc.) before, even when the doctor had coded
            // the diagnosis properly on the consultation.
            const items = pendingIcd10Codes.length>0
              ? [{ code: pendingIcd10Codes[0], description: pendingRecord.diagnosis || pendingIcd10Codes.join(', '), amount: parseFloat(amount), category: claimType, icd10Codes: pendingIcd10Codes }]
              : [{ code: claimType, description: claimType, amount: parseFloat(amount) }]
            const result = await adapter.adjudicateClaim({
              patientId: selectedPatient.id, policyNumber: selectedPlan.id,
              clinicId: 'clinic_ops', totalGrossAmount: parseFloat(amount),
              items,
              medicalRecordId: pendingMedicalRecordId || undefined,
            })
            setAdjudicationResult(result)
            setAdjudicating(false)
            setStep('submitted')
          }} disabled={!selectedPatient.consented||!selectedPlan||!amount||adjudicating}>
            {adjudicating ? 'Checking eligibility & adjudicating…' : `Validate & prepare for ${selectedPlan?.company_name||'insurer'}`}
          </Btn>
        </div>
      </>}
    </PageWrap>
  )

  return (
    <PageWrap maxWidth={480}>
      <div style={{textAlign:'center',padding:'60px 20px'}}>
        <div style={{fontSize:'36px',marginBottom:'12px'}}>{adjudicationResult?.status==='REJECTED'?'\u26a0':'\u2713'}</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>{{APPROVED:'Claim approved',PARTIALLY_APPROVED:'Claim partially approved',REJECTED:'Claim rejected',PENDING_REVIEW:'Pending review',SETTLED:'Approved & settled - fully covered'}[adjudicationResult?.status]||'Claim validated'}</div>
        {adjudicationResult?.verificationFlag&&<div style={{background:C.amberLight||'#fff3e0',borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.amber||'#e65100',textAlign:'left'}}>
          {'\u26a0'} {adjudicationResult.verificationFlag==='referral_required'
            ? 'This plan requires a doctor referral for this practitioner, and none is on file yet - submitted, but held for manual review until a referral is approved.'
            : 'This practitioner isn\u2019t verified (not on a clinic roster, no matching Business Registration) - submitted, but held for manual review rather than auto-settled.'}
        </div>}
        {/* Direct visual confirmation that the ICD-10 code(s) captured on
            the consultation actually made it onto this claim, rather than
            requiring a trip to the insurer/database to check. */}
        {adjudicationResult&&pendingIcd10Codes.length>0&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'8px',padding:'10px 12px',marginBottom:'14px',fontSize:'12px',color:C.green,textAlign:'left'}}>
          {'✓'} ICD-10 code{pendingIcd10Codes.length>1?'s':''} submitted with this claim: <strong>{pendingIcd10Codes.join(', ')}</strong>
        </div>}
        {adjudicationResult&&<div style={{background:C.card,borderRadius:'10px',padding:'14px',marginBottom:'16px',textAlign:'left',fontSize:'12px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span>Gross amount</span><strong>HK${adjudicationResult.fees.grossAmount}</strong></div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span>Deductible applied</span><strong>HK${adjudicationResult.deductibleApplied}</strong></div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span>Insurer covers</span><strong style={{color:C.green}}>HK${adjudicationResult.fees.insurerCoveredAmount}</strong></div>
          <div style={{display:'flex',justifyContent:'space-between',paddingTop:'6px',borderTop:`0.5px solid ${C.border}`,marginBottom:'10px'}}><span>Patient pays total</span><strong>HK${adjudicationResult.fees.patientPayableTotal}</strong></div>
          <div style={{fontSize:'11px',color:C.textMuted,paddingTop:'8px',borderTop:`0.5px solid ${C.border}`}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'2px'}}><span>Platform claim fee (paid by insurer)</span><span>HK${adjudicationResult.fees.platformClaimFee}</span></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>Clinic net payout</span><span>HK${adjudicationResult.fees.clinicNetPayout}</span></div>
          </div>
          <div style={{fontSize:'10px',color:C.textMuted,marginTop:'8px'}}>Authorization: {adjudicationResult.authorizationCode}</div>
        </div>}
        {adjudicationResult&&adjudicationResult.fees.patientPayableTotal>0&&<>
          <Btn variant="primary" style={{width:'100%',marginBottom:'20px'}} onClick={()=>onNavPayment?.(adjudicationResult.claimId)}>Collect HK${adjudicationResult.fees.patientPayableTotal} in Payment</Btn>
        </>}
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'20px'}}>Submission channel: {selectedPlan?.company_name}'s existing claims portal (manual handoff until direct integration is in place)</div>
        <Btn variant="primary" onClick={()=>{setStep('list');setSelectedPatient(null);setSelectedPlan(null);setAmount('');setAdjudicationResult(null)}}>Done</Btn>
      </div>
    </PageWrap>
  )
}

export default function ClinicOpsApp() {
  const [staffMember,setStaffMember]=useState(null)
  const [kickedOutMessage,setKickedOutMessage]=useState(null)

  // Single device at a time per staff account - if another device signs
  // in on this same account, staff_sessions gets overwritten with its
  // token, and this poll notices the mismatch and signs this device out.
  // Fails open on purpose: any error here (most likely the migration not
  // having been run yet) just skips this check rather than locking
  // anyone out.
  useEffect(() => {
    if (!staffMember?.id || !staffMember?.sessionToken) return
    const interval = setInterval(async () => {
      const { data, error } = await supabase.from('staff_sessions').select('session_token').eq('medsa_id', staffMember.id).maybeSingle()
      if (!error && data && data.session_token !== staffMember.sessionToken) {
        setKickedOutMessage('You were signed out because this account was signed in on another device.')
        setStaffMember(null)
        setScreen('overview')
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [staffMember?.id, staffMember?.sessionToken])

  const [checkInError,setCheckInError]=useState(null)
  const [screen,setScreen]=useState('overview')
  const [newPatientOrigin,setNewPatientOrigin]=useState('checkin') // 'checkin' | 'schedule'
  const [newPatientPrefillName,setNewPatientPrefillName]=useState('')
  const [schedulePreselectPatient,setSchedulePreselectPatient]=useState(null)
  const [payPreselectClaimRef,setPayPreselectClaimRef]=useState(null)
  const [payPreselectRecordId,setPayPreselectRecordId]=useState(null)
  const [checkedInQueue,setCheckedInQueue]=useState([])
  const [queueLoading,setQueueLoading]=useState(true)
  const [pendingPrescriptions,setPendingPrescriptions]=useState([])

  // Real, shared queue - was local browser state before, which meant a
  // doctor's tablet and front desk's computer never saw the same thing.
  // Queries medical_records directly instead, transformed into the exact
  // shape the existing label/inventory logic already expects, so that
  // logic didn't need to be rewritten. Polls rather than a single load,
  // since this needs to reach a genuinely different device in real time.
  async function loadTaskBoard() {
    const { data: records } = await supabase.from('medical_records')
      .select('*, patients(full_name, medsa_id)')
      .eq('record_status', 'submitted').eq('source', 'clinic_ops')
      .order('date_of_record', { ascending: false })
    if (!records) return
    const withDrugs = await Promise.all(records.map(async r => {
      const { data: meds } = await supabase.from('medications').select('*').eq('medical_record_id', r.id)
      return {
        id: r.id, recordId: r.id, patientId: r.patient_id,
        patientName: r.patients?.full_name || 'Unknown', patientMedsaId: r.patients?.medsa_id || null,
        doctorName: r.doctor_name || 'Unknown', diagnosis: r.diagnosis, notes: r.notes, icd10Code: r.icd10_code,
        lineItems: r.line_items || [], totalFee: r.total_fee,
        drugs: (meds||[]).map(m => ({ drug: m.medication_name, dosage: m.dosage, frequency: m.frequency, quantity: m.quantity, durationDays: m.duration_days })),
        timestamp: new Date(r.date_of_record).getTime(), status: r.meds_dispensed_at ? 'printed' : 'pending',
      }
    }))
    setPendingPrescriptions(withDrugs)
  }

  useEffect(() => {
    loadTaskBoard()
    const interval = setInterval(loadTaskBoard, 15000)
    return () => clearInterval(interval)
  }, [])
  const [selectedQueueEntry,setSelectedQueueEntry]=useState(null)
  const [institutionId,setInstitutionId]=useState(null)
  const [institutionName,setInstitutionName]=useState('')
  const [medicineType,setMedicineType]=useState('western')
  const [clinicQueues,setClinicQueues]=useState([])
  const [affiliatedClinics,setAffiliatedClinics]=useState([]) // other institutions this same real practitioner is also onboarded at

  // A doctor/nurse who's the same real person (matched by HKID + e-PC at
  // onboarding) at more than one clinic shares one practitioner_identity_id
  // across their separate staff_credentials rows. This looks up their
  // other clinics so "My Credentials" can offer switching without a
  // second password - they already proved who they are once this session.
  useEffect(() => {
    async function loadAffiliated() {
      if (!staffMember?.practitionerIdentityId) { setAffiliatedClinics([]); return }
      const { data } = await supabase.from('staff_credentials')
        .select('medsa_id, full_name, role, department, institution_id, practitioner_portal_enabled, practitioner_identity_id, registration_number, registration_expiry, epc_link, institutions(name)')
        .eq('practitioner_identity_id', staffMember.practitionerIdentityId)
        .eq('status', 'active')
        .neq('institution_id', staffMember.institutionId)
      const roleLabels = { doctor:'Doctor', clinic_assistant:'Clinic Assistant', admin:'Practice Manager' }
      setAffiliatedClinics((data||[]).map(r => ({
        id: r.medsa_id, name: r.full_name, role: r.role, roleLabel: roleLabels[r.role]||r.role, department: r.department,
        institutionId: r.institution_id, institutionName: r.institutions?.name || 'Unknown clinic',
        practitionerPortalEnabled: r.practitioner_portal_enabled, practitionerIdentityId: r.practitioner_identity_id,
        registrationNumber: r.registration_number, registrationExpiry: r.registration_expiry, hasEpc: !!r.epc_link,
      })))
    }
    loadAffiliated()
  }, [staffMember?.practitionerIdentityId, staffMember?.institutionId])

  function switchClinic(clinic) {
    // clinic already carries this row's own real fields (fetched fresh
    // above) - portal access, registration details etc. can legitimately
    // differ per clinic even for the same real person, so this isn't
    // just merging over the old institution's values.
    setStaffMember(clinic)
    setScreen(clinic.role==='doctor' ? 'mypatients' : 'overview')
  }

  async function loadClinicQueues() {
    if (!institutionId) { setClinicQueues([]); return }
    // Backfills any department that doesn't have its own queue yet before
    // reading the list, so newly onboarded doctors/departments show up
    // with a real queue automatically rather than needing a practice
    // manager to set one up first.
    await ensureDepartmentQueues(institutionId)
    const { data } = await supabase.from('clinic_queues').select('*').eq('institution_id', institutionId).eq('active', true).order('created_at')
    setClinicQueues(data||[])
  }
  useEffect(() => { loadClinicQueues() }, [institutionId])

  // Resolve which institution this Medsa Clinic deployment belongs to, and
  // which medicine system it operates under (Western - Pharmacy and
  // Poisons Ordinance, or Chinese - Chinese Medicine Ordinance). These are
  // two separate regulatory systems in Hong Kong, so a clinic's drug
  // reference pool never mixes between them.
 useEffect(() => {
  async function loadInstitution() {
    // Real fix - resolves from whichever institution the logged-in staff
    // member actually belongs to, not a hardcoded clinic name. This was
    // the reason ClinicOps only ever worked for one specific clinic -
    // onboarding a second clinic would have silently mixed their data
    // into the first one's institution.
    if (!staffMember?.institutionId) return
    const { data } = await supabase.from('institutions').select('id, name, medicine_type').eq('id', staffMember.institutionId).maybeSingle()
    if (data) { setInstitutionId(data.id); setInstitutionName(data.name || ''); setMedicineType(data.medicine_type || 'western') }
  }
  loadInstitution()
}, [staffMember])

  // Load today's queue and pending prescriptions from Supabase - now
  // reusable (see effects below), since loading this only once at login
  // meant a doctor already signed in before a check-in happened would
  // never see it without manually logging out and back in.
  async function loadQueueAndPrescriptions() {
      if (!institutionId) return
      setQueueLoading(true)
      // Scoped to this clinic - this had no institution filter at all
      // before, so every clinic on the platform was seeing every other
      // clinic's checked-in patients mixed into one shared queue.
      //
      // Also scoped to TODAY. There was no date bound at all here before -
      // a patient checked in on any past day, never explicitly marked
      // done/no_show, stayed in this list forever and kept showing up
      // mixed into "today's" queue on every later day, indefinitely. The
      // real, physical walk-in queue resets every day (same as the ticket
      // numbering already does); a leftover 'waiting' row from weeks ago
      // isn't still waiting.
      const queueDayStart = new Date(); queueDayStart.setHours(0,0,0,0)
      const queueDayEnd = new Date(); queueDayEnd.setHours(23,59,59,999)
      const { data: queueRows } = await supabase
        .from('clinic_queue')
        .select('*, patients(medsa_id), appointments(scheduled_at)')
        .eq('institution_id', institutionId)
        .gte('checked_in_at', queueDayStart.toISOString())
        .lte('checked_in_at', queueDayEnd.toISOString())
        .order('checked_in_at', { ascending: true })
      setCheckedInQueue((queueRows||[]).map(r => ({
        id: r.id,
        ticket: r.ticket,
        queueId: r.queue_id,
        patientName: r.patient_name,
        patientMedsaId: r.patients?.medsa_id || null,
        doctor: r.doctor_name || 'Unassigned',
        room: r.room || '-',
        checkedInAt: new Date(r.checked_in_at).getTime(),
        // Was missing here entirely - every reload of this list (which is
        // most of the time: opening My Patients, switching screens, the
        // periodic refetch) silently wiped appointmentId from every
        // existing entry, since the one place that DID set it
        // (handleCheckedIn's own optimistic local push, right after
        // check-in) only ever applies once and gets overwritten the next
        // time this runs. That's what broke marking the appointment
        // completed (Schedule never greyed out) for the normal My
        // Patients path, the same-day-appointment-vs-appointment
        // disambiguation in "already checked in" checks, and undo-check-in
        // correctly finding this exact visit's queue ticket instead of
        // falling back to a same-name match.
        appointmentId: r.appointment_id || null,
        appointmentTime: r.appointments?.scheduled_at ? new Date(r.appointments.scheduled_at).getTime() : null,
        department: r.department || 'All departments',
        status: r.status,
        checkinNote: r.checkin_note || null,
      })))

      const { data: rxRows } = await supabase
        .from('medications')
        .select('*, patients(full_name)')
        .not('prescribed_by_staff', 'is', null)
        .order('start_date', { ascending: false })
        .limit(20)
      setPendingPrescriptions((rxRows||[]).map(r => ({
        id: r.id,
        patientName: r.patients?.full_name || 'Unknown patient',
        doctorName: r.prescribed_by_staff,
        drugs: [{ drug: r.medication_name, dosage: r.dosage, frequency: r.frequency, quantity: r.quantity, durationDays: r.duration_days, timesPerDay: r.times_per_day, dosingMode: r.dosing_mode, intervalHours: r.interval_hours }],
        timestamp: new Date(r.start_date).getTime(),
        status: r.dispense_status || 'pending',
      })))
      setQueueLoading(false)
  }

  useEffect(() => {
    if (!staffMember) return
    loadQueueAndPrescriptions()
  }, [staffMember, institutionId])

  // Refresh every time the doctor actually navigates to see their
  // patients - the real, direct fix for check-ins that happened while
  // this session was already open and idle elsewhere.
  useEffect(() => {
    if (!staffMember) return
    if (screen==='mypatients' || screen==='overview') loadQueueAndPrescriptions()
  }, [screen])

  async function handleCheckedIn(patient, force=false, explicitQueueId=undefined, consentAnswer=true, checkinNote=null, targetAppointmentId=null, explicitDoctor=null) {
    // If we know exactly which appointment is being checked in (the
    // Schedule page always knows this), only treat THAT appointment as
    // active - otherwise a patient with two appointments the same day
    // (a follow-up, or two different doctors) would look "already
    // checked in" the moment either one was, and checking in the second
    // one would silently do nothing.
    const alreadyActive = checkedInQueue.some(q =>
      q.patientName === patient.full_name && hoursRemaining(q.checkedInAt) > 0 &&
      (targetAppointmentId ? q.appointmentId === targetAppointmentId : true)
    )
    if (alreadyActive && !force) {
      setCheckInError(`${patient.full_name} is already checked in and still active.`)
      return 'already_active'
    }

    // Look up today's real scheduled appointment BEFORE inserting the queue
    // entry - previously this defaulted to 'Unassigned'/the checking-in
    // staff member's own department, which is almost never the actual
    // treating doctor. This is the real reason a patient checked in by
    // reception never appeared under a doctor's own patients.
    //
    // When the caller knows which specific appointment this is (the
    // Schedule page's patient bubble), match on its id directly. This
    // used to always look up "this patient's appointment today" with no
    // id filter, so a patient with two same-day appointments matched
    // both rows - .maybeSingle() then errored out silently, the whole
    // check-in was treated as a walk-in, and neither appointment's
    // status ever updated (or, when the search screen's own check-in
    // path picked one row arbitrarily, checking in one appointment could
    // end up marking the wrong one - or both, once the search screen's
    // "already in queue" check treated them as the same visit).
    const dayStart = new Date(); dayStart.setHours(0,0,0,0)
    const dayEnd = new Date(); dayEnd.setHours(23,59,59,999)
    const { data: matchingAppt } = targetAppointmentId
      ? await supabase.from('appointments').select('*').eq('id', targetAppointmentId).maybeSingle()
      : await supabase.from('appointments').select('*')
          .eq('patient_id', patient.id).eq('institution_source', 'clinic_ops')
          .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())
          .neq('status', 'checked_in')
          .order('scheduled_at', { ascending: true }).limit(1).maybeSingle()

    // Resolve which queue this ticket belongs to - an explicit choice
    // from the check-in screen's picker when the clinic runs more than
    // one queue, otherwise the doctor/department's own queue (auto-
    // created for every department - see ensureDepartmentQueues),
    // otherwise the clinic's one active queue, otherwise legacy
    // no-queue behaviour (a single shared line, ticket prefix A).
    // Matched on the queue's department field, not its display name, so
    // renaming a queue doesn't break the match.
    let queueId = explicitQueueId
    if (queueId === undefined) {
      if (clinicQueues.length === 1) queueId = clinicQueues[0].id
      else if (clinicQueues.length > 1) {
        const targetDept = matchingAppt?.department || explicitDoctor?.department || staffMember?.department
        const deptMatch = clinicQueues.find(q=>q.department===targetDept)
        queueId = deptMatch ? deptMatch.id : clinicQueues[0].id
      } else queueId = null
    }
    const prefix = clinicQueues.find(q=>q.id===queueId)?.ticket_prefix || 'A'

    // Per-queue, per-day ticket sequencing via a real atomic counter
    // (next_queue_ticket RPC) - this used to SELECT today's highest
    // ticket, compute +1 in JS, then INSERT as a separate step, which let
    // two check-ins happening close together both read the same
    // "highest so far" and both get handed the same ticket number
    // (confirmed happening in production data). The RPC does the
    // read-increment as one atomic UPSERT under Postgres's own row lock,
    // so two concurrent calls can never come back with the same number.
    const todayKey = dayStart.toISOString().slice(0,10)
    const { data: nextNumber, error: ticketErr } = await supabase.rpc('next_queue_ticket', {
      p_queue_key: queueId || 'none', p_day: todayKey,
    })
    if (ticketErr || !nextNumber) {
      setCheckInError(`Could not check in ${patient.full_name}: ${ticketErr?.message || 'could not assign a ticket number'}`)
      return false
    }
    const ticket = prefix + nextNumber

    // checkin_note is a recently-added column - if that migration
    // hasn't been run yet, including it in this insert would fail the
    // WHOLE check-in with no fallback, breaking the single most
    // critical action in this screen over a nice-to-have field. Insert
    // without it first (works on any schema version), then try to
    // attach the note as a separate, best-effort follow-up that can't
    // block check-in if it fails.
    // Extracted once so the "no appointment scheduled" warning below can
    // check the same real assignment the row was written with, rather
    // than re-deriving it from `matchingAppt` alone - a walk-in with no
    // matchingAppt but an explicitly picked doctor (or a doctor checking
    // themselves in) DOES have a real doctor and WILL show up on that
    // doctor's patient list, so the warning shouldn't fire for it.
    const resolvedDoctorName = matchingAppt?.doctor_name || explicitDoctor?.name || (staffMember?.role==='doctor' ? staffMember.name : null)
    const { data, error } = await supabase.from('clinic_queue').insert({
      ticket,
      queue_id: queueId,
      institution_id: staffMember?.institutionId || null,
      patient_id: patient.id,
      patient_name: patient.full_name,
      appointment_id: matchingAppt?.id || null,
      // For a genuine walk-in (no booked appointment), front desk picks
      // the doctor by speciality right at check-in (explicitDoctor) -
      // that's the real assignment, not a guess. Falls back further only
      // when nobody picked one (a doctor checking themself in, or the
      // picker was skipped).
      doctor_name: resolvedDoctorName || 'Unassigned',
      room: '-',
      department: matchingAppt?.department || explicitDoctor?.department || (staffMember?.role==='doctor' ? staffMember.department : null) || 'All departments',
      status: 'waiting',
    }).select().single()

    if (error || !data) {
      setCheckInError(`Could not check in ${patient.full_name}: ${error?.message || 'unknown error'}`)
      return false
    }

    if (checkinNote) {
      supabase.from('clinic_queue').update({ checkin_note: checkinNote }).eq('id', data.id).then(()=>{})
    }

    // Real consent window, created the moment of physical check-in -
    // but ONLY for a genuine walk-in (no matchingAppt). A booked
    // appointment already has its own consent row from when the
    // patient booked (default-on, they could have opted out) - writing
    // a second hardcoded consent_given:true row here would silently
    // overwrite that patient's real choice the moment front desk
    // checks them in. consentAnswer is what was actually asked at the
    // check-in screen for a walk-in; unused for a booked appointment.
    if (!matchingAppt) {
      const checkInTime = new Date()
      await supabase.from('appointment_intake').insert({
        patient_id: patient.id, appointment_time: checkInTime.toISOString(),
        doctor_name: staffMember?.name || null,
        consent_given: consentAnswer, consent_given_at: checkInTime.toISOString(),
        access_window_start: checkInTime.toISOString(), access_window_end: new Date(checkInTime.getTime() + 24*60*60*1000).toISOString(),
      })
    }

    setCheckedInQueue([...checkedInQueue, {
      id: data.id, ticket: data.ticket, queueId: data.queue_id, patientName: data.patient_name,
      doctor: data.doctor_name, room: data.room, checkedInAt: new Date(data.checked_in_at).getTime(),
      department: data.department, status: data.status, checkinNote: data.checkin_note || null,
      appointmentId: matchingAppt?.id || null,
      appointmentTime: matchingAppt?.scheduled_at ? new Date(matchingAppt.scheduled_at).getTime() : null,
    }])
    setCheckInError(null)

    if (matchingAppt) {
      // Separate write from the clinic_queue insert above - this one can
      // fail silently on its own (e.g. an RLS policy on `appointments`
      // blocking the update) without throwing, which is exactly what
      // would leave the Schedule page stuck showing "Confirmed" with the
      // Check-in button still there even though the patient was added to
      // the queue. .select() here so a blocked write comes back as
      // 0 rows instead of looking identical to a successful one.
      const { data: updatedAppt, error: apptUpdateErr } = await supabase.from('appointments')
        .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
        .eq('id', matchingAppt.id).select().maybeSingle()
      if (apptUpdateErr || !updatedAppt) {
        setCheckInError(`${patient.full_name} was added to the queue, but the appointment couldn't be marked checked in${apptUpdateErr?.message ? ' (' + apptUpdateErr.message + ')' : ''} - it may still show as Confirmed on the Schedule page. This usually means a database permission is blocking staff from updating appointments.`)
        return true
      }
    } else if (!resolvedDoctorName) {
      // Only warn when nobody was actually assigned - a walk-in with an
      // explicitly picked doctor (or a doctor checking themselves in)
      // does have a real doctor_name on the queue row and WILL show up
      // on that doctor's patient list, so the warning would be false.
      setCheckInError(`${patient.full_name} was checked in, but has no appointment scheduled today - they won't appear on any doctor's patient list until one is booked.`)
    }

    return true
  }

  // Admin/clinic manager sees every department; everyone else sees only
  // their own. A solo clinic never notices this since every entry shares
  // one department anyway.
  const scopedQueue = (staffMember?.department==='All departments' || !staffMember?.department)
    ? checkedInQueue
    : checkedInQueue.filter(q=>!q.department || q.department===staffMember.department)

  // My Patients is specifically THIS doctor's own bookings, not "anyone
  // checked in in my department" - department scoping (scopedQueue) is
  // right for the front-desk/admin Overview board, but on a doctor's own
  // patient list it was showing every other doctor sharing a department
  // too. A genuine walk-in with no doctor assigned yet won't appear
  // under any specific doctor until front desk assigns one - there's no
  // "my patient" to route it to otherwise.
  const myDoctorQueue = checkedInQueue.filter(q=>q.doctor===staffMember?.name)

  async function handlePrescribed(rx) {
    // The real record is already written to Supabase inside
    // ConsultationScreen's handleSave, and loadTaskBoard's poll would pick
    // it up within 15 seconds regardless - this just reloads immediately
    // so the submitting doctor doesn't have to wait for the next poll to
    // see their own consultation appear.
    await loadTaskBoard()
  }

  async function handleConfirmPrescription(prescription) {
    const id = prescription.id
    const dispensedBy = staffMember?.name || 'Unknown'
    const dispensedAt = new Date().toISOString()
    setPendingPrescriptions(prev=>prev.map(p=>p.id===id?{...p,status:'printed',dispensedBy,dispensedAt}:p))

    const inventoryWarnings = []

    // Deduct each dispensed drug's quantity from inventory and log the
    // movement with who confirmed it and when.
    for (const line of prescription.drugs) {
      const qty = parseInt(line.quantity) || 1
      // Fuzzy match first (handles "Metformin" matching "Metformin 500mg"),
      // falls back to exact case-insensitive match.
      let { data: matches } = await supabase
        .from('clinic_inventory')
        .select('*')
        .eq('institution_id', institutionId)
        .ilike('item_name', `%${line.drug}%`)

      let invItem = matches && matches.length===1 ? matches[0] : null
      if (!invItem && matches && matches.length>1) {
        // Multiple partial matches - prefer an exact (case-insensitive) one
        invItem = matches.find(m => m.item_name.toLowerCase()===line.drug.toLowerCase()) || matches[0]
      }

      if (invItem) {
        const newStock = Math.max(0, invItem.stock - qty)
        await supabase.from('clinic_inventory').update({ stock: newStock, updated_at: dispensedAt }).eq('id', invItem.id)
        await supabase.from('inventory_movements').insert({
          inventory_id: invItem.id, item_name: invItem.item_name, change_amount: -qty,
          new_stock: newStock, reason: 'dispensed', staff_name: dispensedBy,
        })
      } else {
        inventoryWarnings.push(line.drug)
      }
    }

    if (inventoryWarnings.length>0) {
      console.warn('No inventory match found for:', inventoryWarnings.join(', '), '- stock not deducted for these items.')
    }

    // Record dispense attribution on the real medications row if this is a
    // real Supabase-loaded prescription (has a UUID id, not a local Date.now()).
    if (typeof id === 'string') {
      // Bug fix: this previously matched medications.id against id (the
      // parent record's id), which could never match any real medication
      // row - medications.id is each drug's own key. Fixed to update every
      // medication actually linked to this consultation.
      await supabase.from('medications').update({
        dispense_status: 'printed', dispensed_by: dispensedBy, dispensed_at: dispensedAt,
      }).eq('medical_record_id', id)
      // Real, persisted signal - separate from record_status, which must
      // stay 'submitted' so this entry stays on the task board for
      // billing. Previously this only ever lived in local browser state,
      // meaning a different device would never see it was already handled.
      await supabase.from('medical_records').update({ meds_dispensed_at: dispensedAt }).eq('id', id)
      await loadTaskBoard()
    }

    return inventoryWarnings
  }

  // Real ticket lifecycle - the queue previously had a `status` column
  // that was set to 'waiting' at check-in and then never touched again,
  // so there was no way to actually run a walk-in queue: no "who's being
  // seen right now," no skip/no-show, nothing. This is the one place
  // that moves a ticket between waiting/serving/done/no_show.
  async function updateQueueStatus(entry, newStatus) {
    const prevStatus = entry.status
    setCheckedInQueue(prev => prev.map(q => q.id===entry.id ? {...q, status:newStatus} : q))
    const { error } = await supabase.from('clinic_queue').update({ status: newStatus }).eq('id', entry.id)
    if (error) {
      // Roll the optimistic update back - without this, a blocked write
      // (e.g. a permissions issue) still looked like it worked locally
      // even though the database never actually changed, and the status
      // would silently revert on the next reload with no explanation.
      setCheckedInQueue(prev => prev.map(q => q.id===entry.id ? {...q, status:prevStatus} : q))
      setCheckInError(`Could not update ${entry.patientName}'s queue status: ${error.message}`)
      return false
    }
    return true
  }

  async function handleRemoveFromQueue(index) {
    const entry = scopedQueue[index]
    setCheckedInQueue(prev => prev.filter(q => q.id !== entry.id))
    if (entry?.id) {
      await supabase.from('clinic_queue').delete().eq('id', entry.id)
    }
    // Also revert their real appointment back to "confirmed" - undoing a
    // check-in from here should undo both places, same as the Schedule
    // screen's own "Cancel check-in" action. Scoped to the specific
    // appointment this queue entry was created for when known - a
    // patient-name+day lookup would revert a second, unrelated same-day
    // appointment too.
    if (entry?.appointmentId) {
      await supabase.from('appointments').update({status:'confirmed', checked_in_at:null}).eq('id', entry.appointmentId)
    } else if (entry?.patientName) {
      const { data: pRow } = await supabase.from('patients').select('id').eq('full_name', entry.patientName).maybeSingle()
      if (pRow) {
        const dayStart=new Date(); dayStart.setHours(0,0,0,0)
        const dayEnd=new Date(); dayEnd.setHours(23,59,59,999)
        await supabase.from('appointments').update({status:'confirmed', checked_in_at:null}).eq('patient_id',pRow.id).eq('institution_source','clinic_ops').gte('scheduled_at',dayStart.toISOString()).lte('scheduled_at',dayEnd.toISOString())
      }
    }
  }

  async function handleCancelAppointment(appointmentId) {
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointmentId)
    cancelAppointmentSideEffects(appointmentId)
  }

  const pendingCount = pendingPrescriptions.filter(p=>p.status==='pending').length

  const allNavItems = [
    {key:'overview', icon:'dashboard', label:'Overview', roles:['admin','clinic_assistant','doctor']},
    {key:'mypatients', icon:'patients', label:'My Patients', roles:['doctor']},
    {key:'checkin', icon:'scan', label:'Check-in / Search', roles:['admin','clinic_assistant','doctor']},
    {key:'schedule', icon:'calendar', label:'Schedule', roles:['admin','clinic_assistant','doctor']},
    {key:'prescriptions', icon:'prescriptions', label:'Consultations & Charges', roles:['admin','clinic_assistant'], badge: pendingCount},
    {key:'inventory', icon:'inventory', label:'Inventory', roles:['admin','clinic_assistant']},
    {key:'ordersets', icon:'orderset', label:'Order Sets', roles:['admin','doctor']},
    {key:'payment', icon:'payment', label:'Payment', roles:['admin','clinic_assistant']},
    {key:'claims', icon:'claims', label:'Claims', roles:['admin','clinic_assistant']},
    {key:'workinghours', icon:'clock', label:'Working Hours', roles:['admin']},
    {key:'queues', icon:'queue', label:'Queues', roles:['admin']},
    {key:'staff', icon:'family', label:'Staff', roles:['admin']},
    {key:'pricelist', icon:'tag', label:'Price List', roles:['admin']},
    {key:'diagnosiscodes', icon:'records', label:'Diagnosis Codes', roles:['admin']},
    {key:'anomalyflags', icon:'alert', label:'Anomaly Review', roles:['admin']},
    {key:'mimssettings', icon:'alert', label:'Drug Safety Database', roles:['admin']},
    {key:'receiptbranding', icon:'tag', label:'Receipt Branding', roles:['admin']},
    {key:'mycredentials', icon:'badge', label:'My Credentials', roles:['doctor','clinic_assistant']},
    {key:'help', icon:'help', label:'Help', roles:['admin','clinic_assistant','doctor']},
  ]

  if (!staffMember) return <StaffLogin kickedOutMessage={kickedOutMessage} onLogin={(s)=>{setKickedOutMessage(null);setStaffMember(s);setScreen(s.role==='doctor'?'mypatients':s.role==='clinic_assistant'?'checkin':'overview')}}/>

  const navItems = allNavItems.filter(item=>item.roles.includes(staffMember.role) && (!item.portalOnly || staffMember.practitionerPortalEnabled))

  return (
    <div style={{display:'flex',minHeight:'100vh',background:C.beige,fontFamily:'system-ui, -apple-system, sans-serif'}}>
      <Sidebar screen={screen} setScreen={setScreen} staffMember={staffMember} navItems={navItems} onLogout={()=>{
        // Best-effort - clears this device's session row so it doesn't
        // linger as "the active device" for this account after a real
        // logout. Not awaited into the logout itself; a failure here
        // shouldn't stop someone from signing out.
        if (staffMember?.id) supabase.from('staff_sessions').delete().eq('medsa_id', staffMember.id).eq('session_token', staffMember.sessionToken||'').then(()=>{})
        setStaffMember(null);setScreen('overview')
      }}/>
      <div style={{flex:1,padding:'32px 40px',overflowY:'auto'}}>
        {screen==='overview'&&<OverviewScreen queue={scopedQueue} pendingCount={pendingCount} onRemoveFromQueue={handleRemoveFromQueue} onCancelAppointment={handleCancelAppointment} onUpdateStatus={updateQueueStatus} queues={clinicQueues} checkInError={checkInError} staffMember={staffMember} institutionId={institutionId} onNavCredentials={()=>setScreen('mycredentials')} onNavStaff={()=>setScreen('staff')}/>}
        {screen==='mypatients'&&<MyPatientsScreen queue={myDoctorQueue} onSelectPatient={(q)=>{if(q.status==='waiting')updateQueueStatus(q,'serving');setSelectedQueueEntry(q);setScreen('consultation')}} staffMember={staffMember} onRefresh={loadQueueAndPrescriptions}/>}
        {screen==='consultation'&&selectedQueueEntry&&<ConsultationScreen key={`${selectedQueueEntry.patientMedsaId||''}-${selectedQueueEntry.ticket||''}`} queueEntry={selectedQueueEntry} staffMember={staffMember} onPrescribed={handlePrescribed} institutionId={institutionId} medicineType={medicineType}/>}
        {screen==='checkin'&&<CheckInSearchScreen onCheckedIn={handleCheckedIn} onNewPatient={()=>{setNewPatientOrigin('checkin');setScreen('newpatient')}} onNavSchedule={()=>setScreen('schedule')} checkInError={checkInError} onDoneCheckIn={()=>staffMember?.role==='admin'&&setScreen('overview')} staffMember={staffMember}/>}
        {screen==='newpatient'&&<NewPatientScreen
          onBack={()=>setScreen(newPatientOrigin==='schedule'?'schedule':'checkin')}
          prefillName={newPatientPrefillName}
          // Both actions are always offered now regardless of which screen
          // sent the staff member here - registering from Check-In used to
          // only ever check the patient in with no way to book them a
          // future slot instead, and registering from Schedule (before
          // that origin-only fix) used to only ever book with no way to
          // check them in right now. A newly registered patient could
          // need either.
          onCreated={(patient)=>{setSchedulePreselectPatient(patient);setNewPatientPrefillName('');setScreen('schedule')}}
          onCheckInNow={(patient)=>{handleCheckedIn(patient);setNewPatientPrefillName('');setScreen('checkin')}}
        />}
        {screen==='schedule'&&<ScheduleScreen
          staffMember={staffMember}
          onCheckedIn={handleCheckedIn}
          checkInError={checkInError}
          clinicQueues={clinicQueues}
          preselectPatient={schedulePreselectPatient}
          onConsumedPreselect={()=>setSchedulePreselectPatient(null)}
          onPreselectPatientForFollowup={setSchedulePreselectPatient}
          onNavNewPatient={(query)=>{setNewPatientOrigin('schedule');setNewPatientPrefillName(query||'');setScreen('newpatient')}}
          onGoToConsultation={async(appt)=>{
            // Was a bare placeholder with no real id/appointmentId, so
            // submitting a consultation reached from Schedule (rather
            // than My Patients) never actually marked the queue ticket
            // done or the appointment completed - the patient kept
            // showing as waiting/being seen forever, and Schedule never
            // greyed the appointment out once finished. appointmentId is
            // just this appointment's own id; the queue ticket itself
            // still needs a real lookup since this screen never carried
            // one.
            const { data: queueRow } = await supabase.from('clinic_queue').select('id')
              .eq('appointment_id', appt.id).in('status', ['waiting','serving'])
              .order('checked_in_at', { ascending: false }).limit(1).maybeSingle()
            setSelectedQueueEntry({id: queueRow?.id || null, appointmentId: appt.id, patientName:appt.patient, ticket:'SCH', checkedInAt:Date.now(), patientMedsaId: appt.medsaId})
            setScreen('consultation')
          }}
          onCancelCheckIn={async(appt)=>{
            if (!appt?.medsaId) return
            // Scoped to this exact appointment id when we have one - the
            // old day-range lookup (no id filter) meant undoing check-in
            // on one of a patient's two same-day appointments undid both.
            if (appt.id) {
              await supabase.from('appointments').update({status:'confirmed', checked_in_at:null}).eq('id', appt.id)
            } else {
              const { data: pRow } = await supabase.from('patients').select('id').eq('medsa_id', appt.medsaId).maybeSingle()
              if (!pRow) return
              const dayStart=new Date(); dayStart.setHours(0,0,0,0)
              const dayEnd=new Date(); dayEnd.setHours(23,59,59,999)
              await supabase.from('appointments').update({status:'confirmed', checked_in_at:null}).eq('patient_id',pRow.id).eq('institution_source','clinic_ops').gte('scheduled_at',dayStart.toISOString()).lte('scheduled_at',dayEnd.toISOString())
            }
            // Also remove them from today's active clinic_queue, since
            // ClinicOps check-in writes there too - undoing check-in should
            // undo both, not just the appointment status. Prefer matching
            // by the specific appointment id so the other same-day visit's
            // queue entry is left alone.
            const matching = checkedInQueue.find(q=>hoursRemaining(q.checkedInAt)>0 &&
              (appt.id ? q.appointmentId===appt.id : q.patientName===appt.patient))
            if (matching) {
              await supabase.from('clinic_queue').delete().eq('id', matching.id)
              setCheckedInQueue(prev=>prev.filter(q=>q.id!==matching.id))
            }
          }}
        />}
        {screen==='prescriptions'&&<PrescriptionsQueueScreen pending={pendingPrescriptions} onConfirm={handleConfirmPrescription} medicineType={medicineType} onReload={loadTaskBoard} onProceedToBilling={(p)=>{setPayPreselectRecordId(p.recordId);setScreen('payment')}} institutionName={institutionName}/>}
        {screen==='inventory'&&<InventoryScreen staffMember={staffMember} institutionId={institutionId} medicineType={medicineType}/>}
        {screen==='ordersets'&&<OrderSetsScreen institutionId={institutionId} staffMember={staffMember}/>}
        {screen==='payment'&&<PaymentScreen staffMember={staffMember} institutionId={institutionId} preselectClaimRef={payPreselectClaimRef} onConsumedPreselect={()=>setPayPreselectClaimRef(null)} preselectRecordId={payPreselectRecordId} onConsumedRecordPreselect={()=>setPayPreselectRecordId(null)}/>}
        {screen==='claims'&&<ClaimsScreen onNavPayment={(claimRef)=>{setPayPreselectClaimRef(claimRef);setScreen('payment')}}/>}
        {screen==='workinghours'&&<WorkingHoursScreen/>}
        {screen==='queues'&&staffMember?.role==='admin'&&<QueueSettingsScreen institutionId={institutionId} queues={clinicQueues} onRefresh={loadClinicQueues}/>}
        {screen==='staff'&&staffMember?.role==='admin'&&<PracticeManagerStaffScreen staffMember={staffMember} institutionId={institutionId}/>}
        {screen==='pricelist'&&staffMember?.role==='admin'&&<PriceListScreen medicineType={medicineType}/>}
        {screen==='diagnosiscodes'&&staffMember?.role==='admin'&&<DiagnosisCodesScreen/>}
        {screen==='anomalyflags'&&staffMember?.role==='admin'&&<AnomalyFlagsScreen staffMember={staffMember}/>}
        {screen==='mimssettings'&&staffMember?.role==='admin'&&<MimsSettingsScreen staffMember={staffMember} institutionId={institutionId} institutionName={institutionName}/>}
        {screen==='receiptbranding'&&staffMember?.role==='admin'&&<ReceiptBrandingScreen institutionId={institutionId} institutionName={institutionName}/>}
        {screen==='mycredentials'&&<PractitionerCredentialsScreen staffMember={staffMember} institutionName={institutionName} affiliatedClinics={affiliatedClinics} onSwitchClinic={switchClinic}/>}
        {screen==='help'&&<HelpScreen staffMember={staffMember}/>}
      </div>
    </div>
  )
}
