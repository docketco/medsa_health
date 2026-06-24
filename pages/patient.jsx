// ─────────────────────────────────────────────────────────────────────────────
// pages/patient.jsx  →  visits medsa.health/patient
//
// The PATIENT PORTAL entry point.
// This page loads the full patient app — home screen, records, doctors,
// calendar, insurance, prescriptions, family controls, and storage tiers.
//
// The actual UI lives in components/patient/ — this page just loads it.
// ─────────────────────────────────────────────────────────────────────────────

import PatientApp from '../components/patient/PatientApp'

export default function PatientPage() {
  return <PatientApp />
}
