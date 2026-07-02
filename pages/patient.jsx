import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import PatientApp from '../components/patient/PatientApp'

const FALLBACK = {
  patient: { full_name:'Wong Mei-ling, Lisa', preferred_name:'Lisa', medsa_id:'MDS-84921-HK', date_of_birth:'1988-03-14', blood_type:'O+', emergency_card_active:true, emergency_contact_name:'Wong Tai', emergency_contact_rel:'Mother', emergency_contact_phone:'+852 9xxx xxxx', storage_tier:'essential' },
  records:[], conditions:[], allergies:[], medications:[], vaccinations:[], appointments:[], claims:[],
}

export default function PatientPage() {
  const [liveData, setLiveData] = useState(FALLBACK)

  useEffect(() => {
    async function load() {
      try {
        const { data: patient } = await supabase.from('patients').select('*').eq('medsa_id','MDS-84921-HK').single()
        if (!patient) return
        const [
          {data:records},{data:conditions},{data:allergies},
          {data:medications},{data:vaccinations},{data:appointments},{data:claims}
        ] = await Promise.all([
          supabase.from('medical_records').select('*,institutions(name)').eq('patient_id',patient.id).order('date_of_record',{ascending:false}),
          supabase.from('conditions').select('*').eq('patient_id',patient.id).eq('active',true),
          supabase.from('allergies').select('*').eq('patient_id',patient.id),
          supabase.from('medications').select('*').eq('patient_id',patient.id).eq('active',true),
          supabase.from('vaccinations').select('*').eq('patient_id',patient.id).order('date_given',{ascending:false}),
          supabase.from('appointments').select('*,institutions(name),practitioners(full_name)').eq('patient_id',patient.id).order('scheduled_at',{ascending:true}),
          supabase.from('insurance_claims').select('*,insurance_plans(plan_name,company_name),institutions(name)').eq('patient_id',patient.id).order('submitted_at',{ascending:false}),
        ])
        setLiveData({ patient, records:records||[], conditions:conditions||[], allergies:allergies||[], medications:medications||[], vaccinations:vaccinations||[], appointments:appointments||[], claims:claims||[] })
      } catch(e) { console.error('Supabase error:',e) }
    }
    load()
  },[])

  return <PatientApp liveData={liveData} />
}
