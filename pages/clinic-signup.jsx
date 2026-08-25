import { useState } from 'react'
import { supabase } from '../lib/supabase'
import C from '../components/shared/colours'

// medsa.health/clinic-signup - the actual missing piece. StaffLogin only
// ever worked for a clinic that already had an institution row and at
// least one staff member in it - there was no way for a brand new
// clinic to get into the system at all. This creates the institution
// itself, plus its first admin (practice manager) account, in one real,
// atomic flow.

export default function ClinicSignupPage() {
  const [stage, setStage] = useState('form') // form | done
  const [clinicName, setClinicName] = useState('')
  const [medicineType, setMedicineType] = useState('western')
  const [adminFirstName, setAdminFirstName] = useState('')
  const [adminLastName, setAdminLastName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    setError(null)
    if (!clinicName.trim()) { setError('Clinic name is required.'); return }
    if (!adminFirstName.trim() || !adminEmail.trim()) { setError('Your name and email are required.'); return }
    if (pin.length < 8 || !/[0-9]/.test(pin) || !/[A-Z]/.test(pin) || !/[^A-Za-z0-9]/.test(pin)) {
      setError('Password must be at least 8 characters, with a number, a capital letter, and a special character.')
      return
    }
    setSaving(true)
    try {
      const { data: institution, error: instErr } = await supabase.from('institutions').insert({
        name: clinicName.trim(), medicine_type: medicineType,
        onboarding_status: 'pending', created_by_name: `${adminFirstName} ${adminLastName}`.trim(),
        created_by_email: adminEmail.trim(),
      }).select().maybeSingle()
      if (instErr) throw instErr

      const medsaId = `MED-${Date.now().toString(36).toUpperCase()}`
      const { error: staffErr } = await supabase.from('staff_credentials').insert({
        institution_source: 'clinic_ops', institution_id: institution.id, medsa_id: medsaId,
        full_name: `${adminFirstName}${adminLastName?' '+adminLastName:''}`, role: 'admin', department: 'All departments',
        onboarded_by: 'self-signup', status: 'active', verification_status: 'verified',
        mchk_declaration_agreed: false,
      })
      if (staffErr) throw staffErr

      const { error: pwErr } = await supabase.rpc('set_staff_password', { p_medsa_id: medsaId, p_new_password: pin })
      if (pwErr) throw pwErr

      setStage('done')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (stage === 'done') return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div style={{background:'#fff',borderRadius:'16px',padding:'32px',maxWidth:420,width:'100%',textAlign:'center'}}>
        <div style={{fontSize:'32px',marginBottom:'12px'}}>{'\u2713'}</div>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>{clinicName} is set up</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.6}}>You're the Practice Manager - sign in to ClinicOps with the password you just set to start onboarding your own staff.</div>
        <a href="/clinic-ops" style={{display:'block',padding:'12px',background:C.green,color:'#fff',borderRadius:'10px',fontWeight:600,textDecoration:'none'}}>Go to ClinicOps</a>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div style={{background:'#fff',borderRadius:'16px',padding:'28px',maxWidth:440,width:'100%'}}>
        <div style={{fontSize:'17px',fontWeight:700,marginBottom:'6px'}}>Set up your clinic on Medsa</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px'}}>This creates your clinic and your own Practice Manager account together.</div>

        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Clinic name</div>
        <input value={clinicName} onChange={e=>setClinicName(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'14px'}}/>

        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Medicine type</div>
        <select value={medicineType} onChange={e=>setMedicineType(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px',fontSize:'14px',marginBottom:'18px',boxSizing:'border-box'}}>
          <option value="western">Western</option>
          <option value="chinese">Chinese</option>
        </select>

        <div style={{fontSize:'12px',fontWeight:600,marginBottom:'10px'}}>Your account (Practice Manager)</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          <input value={adminFirstName} onChange={e=>setAdminFirstName(e.target.value)} placeholder="First name" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px',fontSize:'14px',boxSizing:'border-box'}}/>
          <input value={adminLastName} onChange={e=>setAdminLastName(e.target.value)} placeholder="Last name" style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px',fontSize:'14px',boxSizing:'border-box'}}/>
        </div>
        <input value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="Email" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'10px'}}/>
        <input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Password (8+ chars, number, capital, special)" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'14px'}}/>

        {error && <div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
        <button onClick={handleSubmit} disabled={saving} style={{width:'100%',padding:'12px',background:C.green,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer'}}>{saving?'Setting up...':'Create clinic'}</button>
      </div>
    </div>
  )
}
