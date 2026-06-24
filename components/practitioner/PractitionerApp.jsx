// ─────────────────────────────────────────────────────────────────────────────
// components/practitioner/PractitionerApp.jsx
//
// ROOT of the PRACTITIONER PORTAL.
//
// Flow:
//   1. Staff arrives at medsa.health/practitioner
//   2. Sees the CLOCK-IN screen — scan your Medsa ID QR at the institution
//   3. Once scanned and role selected → portal unlocks
//   4. Patient data only accessible while clocked in
//   5. Clock out → data locked again, returns to clock-in screen
//
// Screens:
//   id          — practitioner ID card, credentials, permissions
//   patients    — scan patient QR or search, tiered access by role
//   schedule    — personal shifts + live hospital overview (all roles)
//                 department schedule + shift requests (dept heads/admin only)
//   messages    — internal messaging
//   permissions — role permission manager (admin only)
//   help        — support and complaints
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import MedsaLogo from '../shared/MedsaLogo'
import C from '../shared/colours'
import { ROLES } from './roles'
import ClockInScreen from './ClockInScreen'
import PractitionerIDScreen from './PractitionerIDScreen'
import PatientSearchScreen from './PatientSearchScreen'
import ScheduleScreen from './ScheduleScreen'
import MessagesScreen from './MessagesScreen'
import AdminPermissions from './AdminPermissions'
import HelpScreen from './HelpScreen'

export default function PractitionerApp() {
  const [role, setRole] = useState(null)      // null = not clocked in
  const [screen, setScreen] = useState('id')

  // Not clocked in — show scan screen
  if (!role) {
    return <ClockInScreen onLogin={r => { setRole(r); setScreen('id') }} />
  }

  const r = ROLES[role]

  // Bottom nav items — admin gets a Permissions tab, others don't
  const navItems = [
    { key: 'id',          icon: '◈', label: 'My ID'    },
    { key: 'patients',    icon: '◎', label: 'Patients' },
    { key: 'schedule',    icon: '▣', label: 'Schedule' },
    { key: 'messages',    icon: '◇', label: 'Messages' },
    role === 'admin' && { key: 'permissions', icon: '⬡', label: 'Perms' },
    { key: 'help',        icon: '◌', label: 'Help'     },
  ].filter(Boolean)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100vh', maxWidth: '440px',
      margin: '0 auto', background: C.beige,
    }}>
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div style={{
        background: C.green, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: '10px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <MedsaLogo height={20} />
        <span style={{ flex: 1, fontSize: '10px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          practitioner
        </span>
        {/* Role badge */}
        <span style={{
          fontSize: '10px', background: r.bg, color: r.color,
          padding: '3px 9px', borderRadius: '20px', fontWeight: 600,
        }}>
          {r.icon} {r.label}
        </span>
        {/* Clock out */}
        <button
          onClick={() => setRole(null)}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: '#fff', fontSize: '11px',
            padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
          }}
        >
          Clock out
        </button>
      </div>

      {/* ── Screen content ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {screen === 'id'          && <PractitionerIDScreen role={role} />}
        {screen === 'patients'    && <PatientSearchScreen  role={role} />}
        {screen === 'schedule'    && <ScheduleScreen       role={role} />}
        {screen === 'messages'    && <MessagesScreen />}
        {screen === 'permissions' && role === 'admin' && <AdminPermissions />}
        {screen === 'help'        && <HelpScreen />}
      </div>

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <div style={{
        background: C.cream, borderTop: `0.5px solid ${C.border}`,
        display: 'flex', padding: '8px 0 6px',
      }}>
        {navItems.map(item => (
          <div
            key={item.key}
            onClick={() => setScreen(item.key)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '2px',
              cursor: 'pointer',
              color: screen === item.key ? C.green : C.textMuted,
              fontSize: '10px',
            }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
