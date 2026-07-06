import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import PractitionerApp from '../components/practitioner/PractitionerApp'

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

  return <PractitionerApp liveData={liveData} />
}
