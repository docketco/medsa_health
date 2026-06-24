// ─────────────────────────────────────────────────────────────────────────────
// components/institution/InstitutionApp.jsx
//
// ROOT of the INSTITUTION & PARTNER PORTAL.
//
// This single entry point serves two very different organisations:
//
//   1. MEDICAL INSTITUTIONS (hospitals, clinics, practices)
//      → Full admin view: staff, patients, schedules, occupancy, portals
//
//   2. INSURANCE PARTNERS (AIA, Bupa, Blue Cross, etc.)
//      → Plan listings, claims log, sponsored placements
//
// Opens with a portal selector screen so each org type goes to the
// right experience. In production, login credentials would determine
// which portal loads automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import MedsaLogo from '../shared/MedsaLogo'
import C from '../shared/colours'

// Institution portal screens
import InstitutionDashboard from './InstitutionDashboard'
import PractitionerList from './PractitionerList'
import PatientList from './PatientList'
import FullSchedule from './FullSchedule'
import OccupancyScreen from './OccupancyScreen'
import PortalManagement from './PortalManagement'

// Insurance portal screens
import InsuranceDashboard from '../insurance/InsuranceDashboard'
import PlanManager from '../insurance/PlanManager'
import InsuranceAdminClaimsLog from '../insurance/InsuranceAdminClaimsLog'
import SponsoredListings from '../insurance/SponsoredListings'

// ── Portal selector — shown first, before login ────────────────────────────
function PortalSelector({ onSelect }) {
  const options = [
    {
      key: 'institution',
      icon: '◈',
      label: 'Institution portal',
      sub: 'Hospitals, clinics, practices — staff, patients, schedule',
      color: C.green, bg: C.greenLight,
    },
    {
      key: 'insurance',
      icon: '⬡',
      label: 'Insurance partner portal',
      sub: 'List your plans, manage claims, sponsor recommendations',
      color: C.navy, bg: C.navyLight,
    },
  ]

  return (
    <div style={{ background: C.beige, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: C.green, padding: '28px 20px 20px' }}>
        <MedsaLogo height={26} />
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '6px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          institution & partner portal
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 20px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>Select your portal</div>
        <div style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.6, marginBottom: '28px' }}>
          Medsa serves both medical institutions and insurance partners. Select your organisation type to continue.
        </div>

        {options.map(p => (
          <div
            key={p.key}
            onClick={() => onSelect(p.key)}
            style={{
              background: C.cream, border: `0.5px solid ${C.border}`,
              borderRadius: '16px', padding: '20px',
              marginBottom: '12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '16px',
            }}
          >
            <div style={{
              width: 52, height: 52, background: p.bg, borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', color: p.color, flexShrink: 0,
            }}>
              {p.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: C.text }}>{p.label}</div>
              <div style={{ fontSize: '12px', color: C.textSub, marginTop: '2px', lineHeight: 1.4 }}>{p.sub}</div>
            </div>
            <span style={{ fontSize: '20px', color: C.textMuted }}>›</span>
          </div>
        ))}

        <div style={{ background: C.brownLight, border: `0.5px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px', marginTop: '8px' }}>
          <div style={{ fontSize: '12px', color: C.brown, lineHeight: 1.6 }}>
            <strong>New organisation?</strong> Contact Medsa to apply for an institution or partner account. All credentials are verified before portal access is granted.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Institution portal wrapper ─────────────────────────────────────────────
function InstitutionPortal() {
  const [screen, setScreen] = useState('dashboard')

  const titles = {
    dashboard: 'Institution admin', practitioners: 'Practitioners',
    patients: 'Patients', schedule: 'Schedule',
    occupancy: 'Occupancy', portals: 'Portal management',
  }

  const navItems = [
    { key: 'dashboard',     icon: '◈', label: 'Overview'  },
    { key: 'practitioners', icon: '◎', label: 'Staff'     },
    { key: 'patients',      icon: '◇', label: 'Patients'  },
    { key: 'schedule',      icon: '▣', label: 'Schedule'  },
    { key: 'occupancy',     icon: '◉', label: 'Occupancy' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', maxWidth: '440px', margin: '0 auto', background: C.beige }}>
      <div style={{ background: C.green, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: 0, zIndex: 10 }}>
        {screen !== 'dashboard' && (
          <button onClick={() => setScreen('dashboard')} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        )}
        <MedsaLogo height={20} />
        <span style={{ flex: 1, fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{titles[screen]}</span>
        <span style={{ fontSize: '10px', background: C.greenLight, color: C.green, padding: '3px 9px', borderRadius: '20px', fontWeight: 600 }}>⬡ Admin</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {screen === 'dashboard'     && <InstitutionDashboard onNav={setScreen} />}
        {screen === 'practitioners' && <PractitionerList />}
        {screen === 'patients'      && <PatientList />}
        {screen === 'schedule'      && <FullSchedule />}
        {screen === 'occupancy'     && <OccupancyScreen />}
        {screen === 'portals'       && <PortalManagement />}
      </div>

      <div style={{ background: C.cream, borderTop: `0.5px solid ${C.border}`, display: 'flex', padding: '8px 0 6px' }}>
        {navItems.map(item => (
          <div key={item.key} onClick={() => setScreen(item.key)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer', color: screen === item.key ? C.green : C.textMuted, fontSize: '10px' }}>
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Insurance portal wrapper ───────────────────────────────────────────────
function InsurancePortal() {
  const [screen, setScreen] = useState('dashboard')

  const titles = {
    dashboard: 'Insurance partner', plans: 'Plan listings',
    claims: 'Claims log', ads: 'Sponsored listings', analytics: 'Analytics',
  }

  const navItems = [
    { key: 'dashboard', icon: '◈', label: 'Overview'  },
    { key: 'plans',     icon: '▣', label: 'Plans'     },
    { key: 'claims',    icon: '◇', label: 'Claims'    },
    { key: 'ads',       icon: '⬡', label: 'Sponsored' },
    { key: 'analytics', icon: '◎', label: 'Analytics' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', maxWidth: '440px', margin: '0 auto', background: C.beige }}>
      <div style={{ background: C.navy, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: 0, zIndex: 10 }}>
        {screen !== 'dashboard' && (
          <button onClick={() => setScreen('dashboard')} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        )}
        <MedsaLogo height={20} />
        <span style={{ flex: 1, fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{titles[screen]}</span>
        <span style={{ fontSize: '10px', background: C.navyLight, color: C.navy, padding: '3px 9px', borderRadius: '20px', fontWeight: 600 }}>⬡ AIA</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {screen === 'dashboard' && <InsuranceDashboard onNav={setScreen} />}
        {screen === 'plans'     && <PlanManager />}
        {screen === 'claims'    && <InsuranceAdminClaimsLog />}
        {screen === 'ads'       && <SponsoredListings />}
        {screen === 'analytics' && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: C.textSub }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>◈</div>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px', color: C.text }}>Analytics</div>
            <div style={{ fontSize: '13px' }}>Views, referrals, and conversion data — coming in the next build.</div>
          </div>
        )}
      </div>

      <div style={{ background: C.cream, borderTop: `0.5px solid ${C.border}`, display: 'flex', padding: '8px 0 6px' }}>
        {navItems.map(item => (
          <div key={item.key} onClick={() => setScreen(item.key)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer', color: screen === item.key ? C.navy : C.textMuted, fontSize: '10px' }}>
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function InstitutionApp() {
  const [portal, setPortal] = useState(null)
  if (!portal)                return <PortalSelector onSelect={setPortal} />
  if (portal === 'institution') return <InstitutionPortal />
  if (portal === 'insurance')   return <InsurancePortal />
}
