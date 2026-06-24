// ─────────────────────────────────────────────────────────────────────────────
// components/patient/PatientApp.jsx
//
// ROOT of the PATIENT PORTAL.
//
// This component manages which screen the patient is currently looking at.
// Think of it like a TV remote — it switches between channels (screens)
// but the TV itself (this component) stays the same.
//
// Screens managed here:
//   home          — the main dashboard (QR card, quick access, message board)
//   records       — medical records, vaccinations, sharing, upload
//   doctors       — find doctors/clinics, book, pay, wait times
//   calendar      — appointments, medication alarms
//   insurance     — plans, AI recommendations, claims, agents
//   prescriptions — active meds, drug info, refills
//   family        — guardian controls for minors/seniors/disability
//   storage       — subscription tiers and cloud storage
//
// The TOPBAR (green bar at top) and BOTTOM NAV are persistent — they appear
// on every screen. The SOS emergency card is always accessible from the topbar.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import MedsaLogo from '../shared/MedsaLogo'
import C from '../shared/colours'
import HomeScreen from './HomeScreen'
import RecordsScreen from './RecordsScreen'
import DoctorsScreen from './DoctorsScreen'
import CalendarScreen from './CalendarScreen'
import InsuranceScreen from './InsuranceScreen'
import PrescriptionsScreen from './PrescriptionsScreen'
import FamilyScreen from './FamilyScreen'
import StorageScreen from './StorageScreen'
import EmergencyOverlay from './EmergencyOverlay'

export default function PatientApp() {
  const [screen, setScreen] = useState('home')
  const [isEn, setIsEn] = useState(true)
  const [emergencyOpen, setEmergencyOpen] = useState(false)

  // Screen title shown in the topbar
  const titles = {
    home:          'medsa',
    records:       isEn ? 'Medical records'   : '醫療記錄',
    doctors:       isEn ? 'Doctors & clinics' : '醫生與診所',
    calendar:      isEn ? 'Calendar'          : '日曆',
    insurance:     isEn ? 'Insurance'         : '保險',
    prescriptions: isEn ? 'Prescriptions'     : '處方',
    family:        isEn ? 'Family & guardians': '家庭與監護',
    storage:       isEn ? 'Storage & plan'    : '儲存與計劃',
  }

  // Bottom nav items
  const navItems = [
    { key: 'home',      icon: '◎', labelEn: 'Home',     labelZh: '主頁'  },
    { key: 'records',   icon: '▣', labelEn: 'Records',  labelZh: '記錄'  },
    { key: 'doctors',   icon: '◈', labelEn: 'Find care',labelZh: '尋找'  },
    { key: 'calendar',  icon: '◇', labelEn: 'Calendar', labelZh: '日曆'  },
    { key: 'insurance', icon: '◉', labelEn: 'Insurance',labelZh: '保險'  },
  ]

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
        {/* Back arrow — only shows when not on home */}
        {screen !== 'home' && (
          <button
            onClick={() => setScreen('home')}
            style={{
              background: 'rgba(255,255,255,0.18)', border: 'none',
              color: '#fff', width: 32, height: 32, borderRadius: '50%',
              cursor: 'pointer', fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >←</button>
        )}
        {/* Logo (home) or title (other screens) */}
        {screen === 'home'
          ? <MedsaLogo height={20} />
          : <span style={{ fontSize: '17px', fontWeight: 500, color: '#fff' }}>{titles[screen]}</span>
        }
        <div style={{ flex: 1 }} />
        {/* SOS button — always visible, opens emergency card */}
        <button
          onClick={() => setEmergencyOpen(true)}
          style={{
            background: C.red, border: 'none', color: '#fff',
            fontSize: '11px', fontWeight: 700,
            padding: '5px 10px', borderRadius: '20px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#ff9999', display: 'inline-block',
            animation: 'pulse 2s infinite',
          }}/>
          SOS
        </button>
        {/* Language toggle */}
        <button
          onClick={() => setIsEn(!isEn)}
          style={{
            background: 'rgba(255,255,255,0.18)', border: 'none',
            color: '#fff', fontSize: '11px',
            padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
          }}
        >
          {isEn ? '廣東話' : 'EN'}
        </button>
      </div>

      {/* ── Screen content ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {screen === 'home'          && <HomeScreen          onNav={setScreen} isEn={isEn} />}
        {screen === 'records'       && <RecordsScreen       isEn={isEn} />}
        {screen === 'doctors'       && <DoctorsScreen       isEn={isEn} />}
        {screen === 'calendar'      && <CalendarScreen      isEn={isEn} />}
        {screen === 'insurance'     && <InsuranceScreen     isEn={isEn} />}
        {screen === 'prescriptions' && <PrescriptionsScreen isEn={isEn} />}
        {screen === 'family'        && <FamilyScreen        isEn={isEn} />}
        {screen === 'storage'       && <StorageScreen       isEn={isEn} />}
      </div>

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <div style={{
        background: C.cream, borderTop: `0.5px solid ${C.border}`,
        display: 'flex', padding: '8px 0 6px',
        position: 'sticky', bottom: 0,
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
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{item.icon}</span>
            <span>{isEn ? item.labelEn : item.labelZh}</span>
          </div>
        ))}
      </div>

      {/* ── Emergency overlay — appears over everything when SOS tapped ── */}
      <EmergencyOverlay open={emergencyOpen} onClose={() => setEmergencyOpen(false)} isEn={isEn} />

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
