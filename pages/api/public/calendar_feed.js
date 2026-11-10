// pages/api/public/calendar_feed.js
// ─────────────────────────────────────────────────────────────────────────────
// Public, unauthenticated by design - same reasoning as emergency_card.js: a
// calendar app (Apple Calendar, Google Calendar, Outlook) polling a
// subscribed feed URL has no Medsa login to send, so the token itself is the
// only credential. Uses the service-role client to bypass RLS for that same
// reason. Always returns a syntactically valid (possibly empty) ICS feed with
// a 200 and text/calendar - never a 404/401/error status or a JSON body -
// because calendar apps treat a non-200 or wrong content-type as "this feed
// is broken" and some will stop polling it entirely, and a missing/wrong
// token should look identical to "no appointments yet," not confirm or deny
// that a token used to be valid.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function icsEscape(s) {
  return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n')
}
function toIcsUtc(d) {
  return new Date(d).toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z'
}
// RFC 5545 requires folding any content line over 75 octets - a long
// appointment/event title or note would otherwise produce a line some
// stricter calendar clients (older Outlook builds especially) reject.
function foldLine(line) {
  if (line.length <= 75) return line
  const parts = []
  let i = 0
  while (i < line.length) { parts.push(line.slice(i, i+74)); i += 74 }
  return parts.join('\r\n ')
}
function buildCalendar(lines) {
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    return res.status(200).send(buildCalendar(['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Medsa//Calendar//EN','END:VCALENDAR']))
  }
  const token = (req.query.t || '').trim()
  const header = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Medsa//Calendar//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:Medsa','X-WR-TIMEZONE:Asia/Hong_Kong']

  if (!token) return res.status(200).send(buildCalendar([...header,'END:VCALENDAR']))

  const { data: patient } = await supabase.from('patients').select('id').eq('calendar_feed_token', token).maybeSingle()
  if (!patient) return res.status(200).send(buildCalendar([...header,'END:VCALENDAR']))

  const [{ data: appts }, { data: events }] = await Promise.all([
    supabase.from('appointments').select('id,scheduled_at,doctor_name,department,institutions(name)').eq('patient_id', patient.id).neq('status','cancelled'),
    supabase.from('patient_calendar_events').select('id,title,event_at,note').eq('patient_id', patient.id),
  ])

  const stamp = toIcsUtc(new Date())
  const body = []
  ;(appts||[]).forEach(a => {
    body.push('BEGIN:VEVENT')
    body.push(`UID:medsa-appt-${a.id}@medsa.health`)
    body.push(`DTSTAMP:${stamp}`)
    body.push(`DTSTART:${toIcsUtc(a.scheduled_at)}`)
    body.push(`DTEND:${toIcsUtc(new Date(new Date(a.scheduled_at).getTime()+30*60000))}`)
    body.push(`SUMMARY:${icsEscape(a.doctor_name ? (a.doctor_name.startsWith('Dr')?a.doctor_name:'Dr '+a.doctor_name) : (a.department||'Medsa appointment'))}`)
    if (a.institutions?.name) body.push(`LOCATION:${icsEscape(a.institutions.name)}`)
    body.push('END:VEVENT')
  })
  ;(events||[]).forEach(e => {
    body.push('BEGIN:VEVENT')
    body.push(`UID:medsa-event-${e.id}@medsa.health`)
    body.push(`DTSTAMP:${stamp}`)
    body.push(`DTSTART:${toIcsUtc(e.event_at)}`)
    body.push(`SUMMARY:${icsEscape(e.title)}`)
    if (e.note) body.push(`DESCRIPTION:${icsEscape(e.note)}`)
    body.push('END:VEVENT')
  })

  return res.status(200).send(buildCalendar([...header, ...body, 'END:VCALENDAR']))
}
