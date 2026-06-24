// ─────────────────────────────────────────────────────────────────────────────
// pages/index.jsx  →  visits medsa.health/
//
// This is the LANDING PAGE — the first thing anyone sees when they visit
// medsa.health. It presents the three portals and routes the user to the
// right one. In production this would also have a marketing section, but
// for now it serves as the entry point for the prototype.
// ─────────────────────────────────────────────────────────────────────────────

import { useRouter } from 'next/router'
import MedsaLogo from '../components/shared/MedsaLogo'

export default function Home() {
  const router = useRouter()

  const portals = [
    {
      key: 'patient',
      icon: '◎',
      label: 'Patient portal',
      sub: 'Your health passport — records, emergency card, insurance, find care',
      color: '#4a7c59',
      bg: '#ddeae1',
      path: '/patient',
    },
    {
      key: 'practitioner',
      icon: '◈',
      label: 'Practitioner portal',
      sub: 'Clock in, log patients, manage schedule — for all healthcare staff',
      color: '#2563eb',
      bg: '#dbeafe',
      path: '/practitioner',
    },
    {
      key: 'institution',
      icon: '⬡',
      label: 'Institution & partner portal',
      sub: 'Hospital admin, insurance partners, schedule and occupancy management',
      color: '#1e3a5f',
      bg: '#dbeafe',
      path: '/institution',
    },
  ]

  return (
    <div style={{
      background: '#f0ede8',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
    }}>
      {/* Logo + tagline */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <MedsaLogo height={36} color="#4a7c59" />
        <div style={{
          fontSize: '13px',
          color: '#6b6560',
          marginTop: '8px',
          letterSpacing: '0.5px',
        }}>
          Your universal health passport
        </div>
      </div>

      {/* Portal selector cards */}
      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {portals.map(p => (
          <div
            key={p.key}
            onClick={() => router.push(p.path)}
            style={{
              background: '#faf8f5',
              border: '0.5px solid #d8d4ce',
              borderRadius: '16px',
              padding: '18px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{
              width: 48,
              height: 48,
              background: p.bg,
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              color: p.color,
              flexShrink: 0,
            }}>
              {p.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a' }}>{p.label}</div>
              <div style={{ fontSize: '12px', color: '#6b6560', marginTop: '2px', lineHeight: 1.4 }}>{p.sub}</div>
            </div>
            <span style={{ fontSize: '20px', color: '#9c9690' }}>›</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '11px', color: '#9c9690', marginTop: '28px', textAlign: 'center' }}>
        medsa.health · Hong Kong · v1.0 prototype
      </div>
    </div>
  )
}
