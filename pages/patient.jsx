// pages/patient.jsx
// Loads live data from Supabase then passes it to PatientApp

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import PatientApp from '../components/patient/PatientApp'

export default function PatientPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const DEMO_ID = 'MDS-84921-HK'
        const { data: patient, error: err } = await supabase
          .from('patients').select('*').eq('medsa_id', DEMO_ID).single()
        if (err) throw err

        const [
          { data: records },
          { data: conditions },
          { data: allergies },
          { data: medications },
          { data: vaccinations },
          { data: appointments },
          { data: claims },
        ] = await Promise.all([
          supabase.from('medical_records').select('*, institutions(name)').eq('patient_id', patient.id).order('date_of_record', { ascending: false }),
          supabase.from('conditions').select('*').eq('patient_id', patient.id).eq('active', true),
          supabase.from('allergies').select('*').eq('patient_id', patient.id),
          supabase.from('medications').select('*').eq('patient_id', patient.id).eq('active', true),
          supabase.from('vaccinations').select('*').eq('patient_id', patient.id).order('date_given', { ascending: false }),
          supabase.from('appointments').select('*, institutions(name), practitioners(full_name)').eq('patient_id', patient.id).order('scheduled_at', { ascending: true }),
          supabase.from('insurance_claims').select('*, insurance_plans(plan_name, company_name), institutions(name)').eq('patient_id', patient.id).order('submitted_at', { ascending: false }),
        ])

        console.log('Medsa Supabase load:', {
          patient: patient?.full_name,
          records: records?.length,
          conditions: conditions?.length,
          allergies: allergies?.length,
          medications: medications?.length,
          vaccinations: vaccinations?.length,
          appointments: appointments?.length,
          claims: claims?.length,
        })
        setData({
          patient,
          records: records||[],
          conditions: conditions||[],
          allergies: allergies||[],
          medications: medications||[],
          vaccinations: vaccinations||[],
          appointments: appointments||[],
          claims: claims||[],
        })
      } catch (e) {
        console.error(e)
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f0ede8', gap:'16px' }}>
      <div style={{ width:48, height:48, border:'3px solid #ddeae1', borderTop:'3px solid #4a7c59', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
      <div style={{ fontSize:'14px', color:'#6b6560' }}>Loading your health passport…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f0ede8', gap:'12px', padding:'24px' }}>
      <div style={{ fontSize:'32px' }}>◎</div>
      <div style={{ fontSize:'16px', fontWeight:600 }}>Connection error</div>
      <div style={{ fontSize:'13px', color:'#6b6560', textAlign:'center', lineHeight:1.6 }}>Could not connect to Medsa servers. Please check your connection and try again.</div>
      <button onClick={()=>window.location.reload()} style={{ background:'#4a7c59', color:'#fff', border:'none', borderRadius:'10px', padding:'10px 20px', fontSize:'13px', cursor:'pointer' }}>Try again</button>
    </div>
  )

  return <PatientApp liveData={data} />
}
