// lib/videoCallSignal.js
// ─────────────────────────────────────────────────────────────────────────────
// Real-time "the doctor is calling" signal for video consultations, shared
// between the doctor side (ClinicOpsApp.jsx / PractitionerApp.jsx) and the
// patient app. Uses a plain Supabase Realtime broadcast channel keyed by the
// patient's own medsa_id - no new table, no RLS to configure (broadcast
// messages aren't persisted, just relayed live to whoever's subscribed to
// the same channel name at that moment). This is the first Realtime usage
// in this codebase - everywhere else "live" data is periodic polling, which
// is fine for a queue board but not for something meant to feel like an
// actual incoming call.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

function channelName(patientMedsaId) {
  return `video-call-${patientMedsaId}`
}

/**
 * Called by a doctor's "Video call" button. Opens its own subscription just
 * long enough to send the broadcast, then tears it down - a broadcast sent
 * before the channel reports SUBSCRIBED is silently dropped, so this waits
 * for that before calling send(). Broadcast has no persistence at all - a
 * patient whose own subscription (see subscribeIncomingCalls) hasn't fully
 * joined the same channel topic at that exact moment simply never gets it,
 * no error either side - so this resends a couple more times over ~2s
 * rather than a single fire-and-forget, to cover a patient reconnecting a
 * beat late (e.g. their tab was briefly backgrounded). This does not help
 * a patient who isn't on the app at all, or whose browser tab is running
 * stale code from before this feature shipped - both still need the app
 * open and up to date, same as any call.
 */
export function broadcastIncomingCall(patientMedsaId, doctorName, roomId) {
  if (!patientMedsaId) return
  const channel = supabase.channel(channelName(patientMedsaId))
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      const payload = { doctorName: doctorName || 'Your doctor', roomId, startedAt: Date.now() }
      const send = () => channel.send({ type: 'broadcast', event: 'incoming_call', payload })
      send()
      setTimeout(send, 800)
      setTimeout(send, 1800)
      setTimeout(() => { supabase.removeChannel(channel) }, 2800)
    }
  })
}

/**
 * Called once by the patient app while signed in and open, regardless of
 * which screen is active - an incoming call should interrupt whatever
 * they're doing, same as a real phone call. Returns an unsubscribe function.
 */
export function subscribeIncomingCalls(patientMedsaId, onCall) {
  if (!patientMedsaId) return () => {}
  const channel = supabase.channel(channelName(patientMedsaId))
  channel.on('broadcast', { event: 'incoming_call' }, ({ payload }) => onCall(payload)).subscribe()
  return () => { supabase.removeChannel(channel) }
}
