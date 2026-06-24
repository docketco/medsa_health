// ─────────────────────────────────────────────────────────────────────────────
// pages/practitioner.jsx  →  visits medsa.health/practitioner
//
// The PRACTITIONER PORTAL entry point.
// All healthcare staff — doctors, nurses, EMS, pharmacists, therapists,
// receptionists, allied health — enter here.
//
// Starts with the clock-in / QR scan screen. Once clocked in, the portal
// adapts to the staff member's role.
// ─────────────────────────────────────────────────────────────────────────────

import PractitionerApp from '../components/practitioner/PractitionerApp'

export default function PractitionerPage() {
  return <PractitionerApp />
}
