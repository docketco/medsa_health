import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import PractitionerApp from '../components/practitioner/PractitionerApp'

// Shelved for now - clinics are workstation-based (front desk, consult
// room, each with a computer for uploads anyway), not ward-based like a
// hospital, so a native "walk around" mobile app isn't solving a real
// problem for clinic doctors/nurses today. /clinic-ops already covers
// them for real (real login, real per-clinic data, real writes). This
// page still exists as an unfinished prototype for a bigger future idea
// (hospital-style multi-role wards - EMS, pharmacist, nurse, therapist),
// but nothing on it is wired to real search or real per-patient data -
// it always shows one fixed demo patient. Not deleted, not being built
// out further right now either.

const FALLBACK = {
  patient: {
    full_name: 'Wong Mei-ling, Lisa', medsa_id: 'MDS-84921-HK', date_of_birth: '1988-03-14', blood_type: 'O+',
    emergency_contact_name: 'Wong Tai', emergency_contact_rel: 'Mother', emergency_contact_phone: '+852 9xxx xxxx',
  },
  conditions: [], allergies: [], medications: [], records: [],
}

export default function PractitionerPage() {
  const [liveData, setLiveData] = useState(FALLBACK)

  useEffect(() => {
    async function load() {
      try {
        // Demo: practitioner scans/searches for Lisa Wong — in production this comes from actual QR scan
        const { data: patient } = await supabase.from('patients').select('*').eq('medsa_id','MDS-84921-HK').single()
        if (!patient) return

        const [
          {data:conditions},{data:allergies},{data:medications},{data:records}
        ] = await Promise.all([
          supabase.from('conditions').select('*').eq('patient_id',patient.id).eq('active',true),
          supabase.from('allergies').select('*').eq('patient_id',patient.id),
          supabase.from('medications').select('*').eq('patient_id',patient.id).eq('active',true),
          supabase.from('medical_records').select('*,institutions(name)').eq('patient_id',patient.id).order('date_of_record',{ascending:false}),
        ])

        setLiveData({ patient, conditions:conditions||[], allergies:allergies||[], medications:medications||[], records:records||[] })
      } catch(e) { console.error('Supabase error:', e) }
    }
    load()
  }, [])

  return (
    <>
      <div style={{position:'sticky',top:0,zIndex:500,background:'#7a4a1f',color:'#fff',padding:'8px 16px',fontSize:'12px',textAlign:'center',lineHeight:1.5}}>
        ◇ Preview only, not live yet - doctors and nurses at clinics should use <strong>/clinic-ops</strong> instead, which has real login and real patient data.
      </div>
      <PractitionerApp liveData={liveData} />
    </>
  )
}
