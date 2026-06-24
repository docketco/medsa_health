// ─────────────────────────────────────────────────────────────────────────────
// pages/institution.jsx  →  visits medsa.health/institution
//
// The INSTITUTION & PARTNER PORTAL entry point.
// Serves two types of organisations:
//   1. Medical institutions (hospitals, clinics) — admin view
//   2. Insurance partners — plan listings, claims log, sponsored placements
//
// Opens with a portal selector so each org type goes to the right experience.
// ─────────────────────────────────────────────────────────────────────────────

import InstitutionApp from '../components/institution/InstitutionApp'

export default function InstitutionPage() {
  return <InstitutionApp />
}
