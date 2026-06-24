// ─────────────────────────────────────────────────────────────────────────────
// components/practitioner/roles.js
//
// ROLE DEFINITIONS & DEFAULT ACCESS PERMISSIONS
//
// Every practitioner in Medsa has a role. The role determines:
//   1. What colour/icon appears on their ID card and topbar badge
//   2. What patient data they can access (the DEFAULT_ACCESS map)
//   3. What tabs appear in the bottom nav
//
// The ADMIN can override any of these defaults via the Permissions screen.
// Patient consent always takes final precedence — if a patient hasn't
// consented to share mental health records, no role can see them regardless
// of what permissions say.
//
// ROLES:
//   admin        — institution admin, oversees everything
//   dept_head    — department head/senior doctor
//   doctor       — all doctors (GP, specialist, surgeon, etc.)
//   nurse        — hospital/ward nurse (cannot dispense in HK hospital)
//   clinic_nurse — clinic nurse (CAN dispense — HK clinic standard)
//   receptionist — front desk, admin staff
//   pharmacist   — dispensing only (hospital pharmacist)
//   therapist    — physio, massage, allied therapy
//   ems          — emergency medical services
//   allied       — optometrist, audiologist, other allied health
// ─────────────────────────────────────────────────────────────────────────────

import C from '../shared/colours'

export const ROLES = {
  admin: {
    label: 'Institution Admin',
    color: C.purple, bg: C.purpleLight, icon: '⬡',
  },
  dept_head: {
    label: 'Department Head',
    color: C.green, bg: C.greenLight, icon: '◈',
  },
  doctor: {
    label: 'Doctor',
    color: C.blue, bg: C.blueLight, icon: '◎',
  },
  nurse: {
    label: 'Nurse',
    color: C.green, bg: C.greenLight, icon: '◇',
  },
  clinic_nurse: {
    label: 'Clinic Nurse',
    color: C.green, bg: C.greenLight, icon: '◇',
  },
  receptionist: {
    label: 'Receptionist',
    color: C.brown, bg: C.brownLight, icon: '▣',
  },
  pharmacist: {
    label: 'Pharmacist',
    color: C.amber, bg: C.amberLight, icon: '◉',
  },
  therapist: {
    label: 'Therapist',
    color: C.brown, bg: C.brownLight, icon: '◌',
  },
  ems: {
    label: 'EMS / Emergency',
    color: C.red, bg: C.redLight, icon: '◈',
  },
  allied: {
    label: 'Allied Health',
    color: C.textMuted, bg: C.card, icon: '◫',
  },
}

// ── Default access permissions per role ───────────────────────────────────────
// Each key is a type of patient data.
// true = can see it by default (still subject to patient consent)
// false = cannot see it (admin can unlock via Permissions screen)
export const DEFAULT_ACCESS = {
  admin: {
    identity: true, vitals: true, history: true, medications: true,
    allergies: true, mental: true, imaging: true, labs: true,
    prescribe: false,   // admin can VIEW but not prescribe
    dispense: false,    // admin can VIEW but not dispense
    admin_perms: true,  // can manage role permissions
    admission_reason: true,
  },
  dept_head: {
    identity: true, vitals: true, history: true, medications: true,
    allergies: true, imaging: true, labs: true,
    prescribe: true, dispense: false, admin_perms: false,
    admission_reason: true,
  },
  doctor: {
    identity: true, vitals: true, history: true, medications: true,
    allergies: true, imaging: true, labs: true,
    prescribe: true, dispense: false, admin_perms: false,
    admission_reason: true,
  },
  nurse: {
    identity: true, vitals: true, medications: true, allergies: true,
    tasks: true, history: false, imaging: false, labs: false,
    prescribe: false, dispense: false, admin_perms: false,
    admission_reason: true,  // nurses see why patient is admitted
  },
  clinic_nurse: {
    identity: true, vitals: true, medications: true, allergies: true,
    tasks: true, history: false, imaging: false, labs: false,
    prescribe: false,
    dispense: true,   // HK clinic nurses can dispense medication
    admin_perms: false,
    admission_reason: true,
  },
  receptionist: {
    identity: true, appointments: true, billing: true,
    history: false, vitals: false, medications: false,
    prescribe: false, dispense: false, admin_perms: false,
    admission_reason: false,  // receptionists don't need clinical reason
  },
  pharmacist: {
    identity: true, medications: true, allergies: true,
    history: false, vitals: false, imaging: false,
    prescribe: false, dispense: true, admin_perms: false,
    admission_reason: false,
  },
  therapist: {
    identity: true, vitals: true, musculoskeletal: true, allergies: true,
    history: false, medications: false, imaging: false,
    prescribe: false, dispense: false, admin_perms: false,
    admission_reason: true,  // therapist needs to know why patient is there
  },
  ems: {
    identity: true, vitals: true, emergency: true,
    allergies: true, critical_conditions: true, medications: true,
    history: false, imaging: false,
    prescribe: false, dispense: false, admin_perms: false,
    admission_reason: false,  // EMS sees emergency card, not admission reason
  },
  allied: {
    identity: true, specialty_notes: true, allergies: true,
    history: false, medications: false, vitals: false,
    prescribe: false, dispense: false, admin_perms: false,
    admission_reason: true,
  },
}
