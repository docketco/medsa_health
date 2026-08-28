// Clean line-style vector icons shared across the patient app, ClinicOps,
// and Medsa Admin - replacing the placeholder geometric glyphs (◎ ▣ ◈
// etc) that were standing in for real iconography. Inherits colour from
// the parent via currentColor, so it drops straight into any existing
// coloured icon tile.
const ICON_PATHS = {
  home: <path d="M4 11.5 12 4l8 7.5M6 10v9.5a1 1 0 0 0 1 1h3.5V15h3v5.5H17a1 1 0 0 0 1-1V10"/>,
  records: <><path d="M6 3.5h9l3 3V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14.5 3.5V7h3.5"/><path d="M8 12h8M8 15h8M8 9h4"/></>,
  insurance: <path d="M12 3 5 6v5.5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6l-7-3Zm-2.5 8.5 1.8 1.8 3.7-3.7"/>,
  prescriptions: <><path d="m6.5 17.5 8-8a3 3 0 1 1 4 4l-8 8a3 3 0 0 1-4-4Z"/><path d="m13 7 4 4"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></>,
  doctors: <><path d="M9 3v4a3 3 0 0 0 6 0V3"/><path d="M9 5H7a2 2 0 0 0-2 2v3a6 6 0 0 0 12 0V7a2 2 0 0 0-2-2h-2"/><circle cx="18.5" cy="16.5" r="2.5"/><path d="M18.5 13v-1.5"/></>,
  family: <><circle cx="8.5" cy="8" r="3"/><circle cx="16" cy="9" r="2.4"/><path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h2A4.5 4.5 0 0 1 14 18.5V20"/><path d="M15.7 14.3A4 4 0 0 1 19 18v2"/></>,
  alert: <><path d="M12 3 3 8v5c0 4.5 3.6 7.6 9 9 5.4-1.4 9-4.5 9-9V8l-9-5Z"/><path d="M12 8v5"/><circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none"/></>,
  storage: <><path d="M12 4c-4.4 0-7 1.6-7 3s2.6 3 7 3 7-1.6 7-3-2.6-3-7-3Z"/><path d="M5 7v5c0 1.4 2.6 3 7 3s7-1.6 7-3V7"/><path d="M5 12v5c0 1.4 2.6 3 7 3s7-1.6 7-3v-5"/></>,
  community: <path d="M12 4c4.4 0 8 2.8 8 6.3S16.4 16.6 12 16.6c-.8 0-1.6-.1-2.3-.3L6 18l1-3.2C5.7 13.5 5 12 5 10.3 5 6.8 7.6 4 12 4Z"/>,
  dashboard: <><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2"/><rect x="13" y="3.5" width="7.5" height="4.5" rx="1.2"/><rect x="13" y="10" width="7.5" height="10.5" rx="1.2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.2"/></>,
  patients: <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20v-1.3A4.7 4.7 0 0 1 8.2 14h1.6a4.7 4.7 0 0 1 4.7 4.7V20"/><path d="M15.5 6.5h4M17.5 4.5v4"/></>,
  scan: <><path d="M4 8V5.5a1.5 1.5 0 0 1 1.5-1.5H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M4 12h16"/></>,
  inventory: <><path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4Z"/><path d="M3.5 7.5 12 11.5m0 0 8.5-4M12 11.5v9"/></>,
  orderset: <><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  payment: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18"/><path d="M7 15h4"/></>,
  claims: <><path d="M6 3.5h9l3 3V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="m8.5 12.5 2 2 4-4.5"/></>,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
  queue: <><circle cx="6" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="6" cy="17" r="1.2" fill="currentColor" stroke="none"/><path d="M10 7h10M10 12h10M10 17h10"/></>,
  tag: <><path d="M12.5 3.5H6a1 1 0 0 0-1 1v6.5a1 1 0 0 0 .3.7l8.5 8.5a1 1 0 0 0 1.4 0l6.2-6.2a1 1 0 0 0 0-1.4l-8.5-8.5a1 1 0 0 0-.4-.3Z"/><circle cx="9" cy="8" r="1.3" fill="currentColor" stroke="none"/></>,
  badge: <><circle cx="12" cy="9" r="4.5"/><path d="m8.5 13-1.5 7 5-2.5 5 2.5-1.5-7"/></>,
  help: <><circle cx="12" cy="12" r="8.5"/><path d="M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.8.5-1.2 1-1.2 2"/><circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none"/></>,
  slides: <><rect x="3.5" y="4.5" width="17" height="12" rx="1.5"/><path d="m3.5 13 4.5-4 3.5 3 4-4.5 4.5 4.5"/><path d="M8.5 20.5h7"/></>,
  shield: <path d="M12 3 5 6v5.5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6l-7-3Z"/>,
  building: <><rect x="4.5" y="3.5" width="9" height="17" rx="1"/><path d="M13.5 9.5H18a1.5 1.5 0 0 1 1.5 1.5v9"/><path d="M7.5 7.5h2M7.5 11h2M7.5 14.5h2M15.5 13h2M15.5 16.5h2"/></>,
}
export default function Icon({ name, size=20, style }) {
  const body = ICON_PATHS[name]
  if (!body) return null
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={style}>{body}</svg>
}
