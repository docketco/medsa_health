// components/patient/EmergencyOverlay.jsx
// The emergency health card overlay — opens when patient (or practitioner)
// taps SOS. Shows blood type, critical conditions, allergies, current
// medications, and emergency contact. No login needed for EMS to scan this.
import C from '../shared/colours'
export default function EmergencyOverlay({ open, onClose, isEn }) {
  if (!open) return null
  const patient = {
    name: 'Wong Mei-ling, Lisa', id: 'MDS-84921-HK', dob: '14 Mar 1988',
    bloodType: 'O+',
    criticalConditions: ['Type 2 Diabetes', 'Iron deficiency anaemia'],
    allergies: ['Penicillin — SEVERE', 'Dust mites — moderate'],
    meds: ['Metformin 500mg — twice daily', 'Aspirin 100mg — daily'],
    emergency: { name: 'Wong Tai (Mother)', phone: '+852 9xxx xxxx' },
    updated: '12 Jun 2025 · QE Hospital',
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.cream, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 440, padding: '24px 24px 32px', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '28px', marginBottom: '6px' }}>🚨</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.red }}>Emergency health card</div>
          <div style={{ fontSize: '12px', color: C.textSub }}>Show this to any medical personnel</div>
        </div>
        <div style={{ background: C.redLight, border: `1px solid ${C.red}`, borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '2px' }}>{patient.name}</div>
          <div style={{ fontSize: '12px', color: C.textSub, marginBottom: '12px' }}>DOB {patient.dob} · {patient.id}</div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <div style={{ flex: 1, background: 'rgba(192,57,43,0.12)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: C.red }}>Blood type</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: C.red }}>{patient.bloodType}</div>
            </div>
            <div style={{ flex: 2, background: 'rgba(192,57,43,0.12)', borderRadius: '10px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: C.red, marginBottom: '4px' }}>Emergency contact</div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{patient.emergency.name}</div>
              <div style={{ fontSize: '12px', color: C.textSub }}>{patient.emergency.phone}</div>
            </div>
          </div>
          {patient.criticalConditions.map((c, i) => <div key={i} style={{ fontSize: '13px', fontWeight: 500, padding: '4px 0', borderTop: i===0?`0.5px solid rgba(192,57,43,0.2)`:undefined, color: C.text }}>◎ {c}</div>)}
          <div style={{ borderTop: `0.5px solid rgba(192,57,43,0.2)`, marginTop: '8px', paddingTop: '8px' }}>
            {patient.allergies.map((a, i) => <div key={i} style={{ fontSize: '13px', fontWeight: 700, color: C.red, padding: '3px 0' }}>⚠ {a}</div>)}
          </div>
          <div style={{ borderTop: `0.5px solid rgba(192,57,43,0.2)`, marginTop: '8px', paddingTop: '8px' }}>
            {patient.meds.map((m, i) => <div key={i} style={{ fontSize: '12px', color: C.textSub, padding: '2px 0' }}>◉ {m}</div>)}
          </div>
        </div>
        <div style={{ background: C.greenXLight, borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: C.green }}>
          ✓ Verified Medsa record · Last updated {patient.updated}
        </div>
        <button onClick={onClose} style={{ width: '100%', background: C.card, border: `0.5px solid ${C.border}`, borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )
}
