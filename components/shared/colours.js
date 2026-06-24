// ─────────────────────────────────────────────────────────────────────────────
// components/shared/colours.js
//
// SINGLE SOURCE OF TRUTH for all Medsa colours.
//
// Import this in any component file that needs colours:
//   import C from '../shared/colours'
//   then use: C.green, C.beige, C.red etc.
//
// If you ever want to change a colour across the whole app,
// change it here once and it updates everywhere.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  // ── Brand greens ──────────────────────────────────────────────────────────
  green:       '#4a7c59',   // primary brand green — buttons, topbars, active states
  greenMid:    '#6b9e7a',   // mid green — gradients
  greenLight:  '#ddeae1',   // light green — tag backgrounds, icon backgrounds
  greenXLight: '#eef4f0',   // very light green — notice bars, card tints

  // ── Warm neutral backgrounds ───────────────────────────────────────────────
  beige:       '#f0ede8',   // page background — the main app background colour
  card:        '#e8e4de',   // card surface — slightly darker than cream
  cream:       '#faf8f5',   // elevated surface — topbar, bottom nav, card bg

  // ── Brown earth tones ──────────────────────────────────────────────────────
  brown:       '#6b5344',   // brown text and icons
  brownLight:  '#ede8e3',   // brown background — notice bars, manual upload tags

  // ── Text ──────────────────────────────────────────────────────────────────
  text:        '#1a1a1a',   // primary text — headings, values
  textSub:     '#6b6560',   // secondary text — labels, sub-headings
  textMuted:   '#9c9690',   // muted text — timestamps, hints

  // ── Borders ───────────────────────────────────────────────────────────────
  border:      '#d8d4ce',   // all dividing lines and card outlines

  // ── Status colours ────────────────────────────────────────────────────────
  red:         '#c0392b',   // danger, error, emergency
  redLight:    '#fdecea',   // red background
  amber:       '#b45309',   // warning, due soon, pending
  amberLight:  '#fef3e2',   // amber background
  blue:        '#2563eb',   // info, doctor role
  blueLight:   '#dbeafe',   // blue background
  navy:        '#1e3a5f',   // insurance portal, dark headings
  navyLight:   '#dbeafe',   // navy background
  purple:      '#534ab7',   // admin role
  purpleLight: '#eeedfe',   // purple background
}

export default C
