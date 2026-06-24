// ─────────────────────────────────────────────────────────────────────────────
// components/shared/UI.jsx
//
// SHARED UI BUILDING BLOCKS — used across all three portals.
//
// Think of these as Lego bricks. Every screen is built from these pieces
// rather than writing the same button or card styles over and over.
//
// Exports:
//   Btn       — button in 5 colour variants
//   Card      — white-cream rounded container with border
//   SecLabel  — small uppercase section label
//   Toggle    — on/off switch
//   InfoRow   — two-column label/value row inside a Card
//   Modal     — bottom-sheet modal overlay
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

// ── Colour palette (duplicated here so UI.jsx is self-contained) ──────────
const C = {
  green:'#4a7c59', greenLight:'#ddeae1', card:'#e8e4de', cream:'#faf8f5',
  text:'#1a1a1a', textSub:'#6b6560', border:'#d8d4ce',
  red:'#c0392b', amber:'#b45309', navy:'#1e3a5f', purple:'#534ab7',
}

// ── Btn ───────────────────────────────────────────────────────────────────
// Usage: <Btn variant="primary" onClick={fn}>Save</Btn>
// Variants: primary (green), secondary (beige), danger (red),
//           amber (orange), navy (dark blue), purple
export function Btn({ children, onClick, variant = 'secondary', style: sx = {}, disabled }) {
  const base = {
    border:'none', borderRadius:'10px', padding:'10px 16px',
    fontSize:'13px', fontWeight:500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily:'inherit',
    display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
    opacity: disabled ? 0.5 : 1,
    ...sx,
  }
  const variants = {
    primary:   { background: C.green,   color: '#fff' },
    secondary: { background: C.card,    color: C.text, border: `0.5px solid ${C.border}` },
    danger:    { background: C.red,     color: '#fff' },
    amber:     { background: C.amber,   color: '#fff' },
    navy:      { background: C.navy,    color: '#fff' },
    purple:    { background: C.purple,  color: '#fff' },
  }
  return (
    <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────
// Usage: <Card>content here</Card>
// Optional onClick makes it a tappable card
export function Card({ children, style: sx = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.cream, border: `0.5px solid ${C.border}`,
        borderRadius: '14px', margin: '0 16px 10px', overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        ...sx,
      }}
    >
      {children}
    </div>
  )
}

// ── SecLabel ──────────────────────────────────────────────────────────────
// Usage: <SecLabel>Recent records</SecLabel>
// Small uppercase grey label above a section
export function SecLabel({ children }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.9px', color: '#9c9690', padding: '16px 16px 8px',
    }}>
      {children}
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────
// Usage: <Toggle checked={true} onChange={fn} />
// An on/off switch. Starts in whatever state checked= is set to.
export function Toggle({ checked = false, onChange }) {
  const [on, setOn] = useState(checked)
  const handle = () => { setOn(!on); onChange && onChange(!on) }
  return (
    <div
      onClick={handle}
      style={{
        width: 34, height: 18, borderRadius: 20,
        background: on ? C.green : C.border,
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 16 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }}/>
    </div>
  )
}

// ── InfoRow ───────────────────────────────────────────────────────────────
// Usage: <InfoRow label="Blood type" value="O+" highlight />
// Used inside a Card to show a label/value pair with a dividing line.
// highlight=true makes the value show in red (for allergies, warnings).
// last=true removes the bottom border on the last row.
export function InfoRow({ label, value, highlight = false, last = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '8px 0',
      borderBottom: last ? 'none' : `0.5px solid ${C.border}`,
      fontSize: '13px',
    }}>
      <span style={{ color: C.textSub, flexShrink: 0, marginRight: '12px' }}>{label}</span>
      <span style={{ fontWeight: 500, color: highlight ? C.red : C.text, textAlign: 'right', maxWidth: '60%' }}>
        {value}
      </span>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────
// Usage: <Modal open={true} onClose={fn} title="Share record">content</Modal>
// A bottom-sheet modal that slides up from the bottom of the screen.
// Click the dark backdrop to close.
export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.cream, borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: 440,
          padding: '24px 24px 32px',
          maxHeight: '88vh', overflowY: 'auto',
        }}
      >
        {title && (
          <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px', color: C.text }}>
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
