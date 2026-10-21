// lib/agentAssignment.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Only the pure round-robin rule (rankAgentsForAssignment) is tested here -
// the Supabase-backed eligibility lookups and update calls around it follow
// the same convention as every other cron in this repo (guardian_expiry_
// reminders.js, adult_transfer_reminders.js, etc.), none of which have unit
// tests either: they're straightforward query plumbing, not logic worth
// mocking a whole database for.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { rankAgentsForAssignment } from './agentAssignment'

describe('rankAgentsForAssignment', () => {
  it('puts a never-assigned agent ahead of one with real history', () => {
    const ranked = rankAgentsForAssignment([
      { id: 'a', last_assigned_at: '2026-10-01T00:00:00Z' },
      { id: 'b', last_assigned_at: null },
    ])
    expect(ranked[0].id).toBe('b')
  })

  it('orders two assigned agents oldest-assigned-first', () => {
    const ranked = rankAgentsForAssignment([
      { id: 'recent', last_assigned_at: '2026-10-20T00:00:00Z' },
      { id: 'oldest', last_assigned_at: '2026-09-01T00:00:00Z' },
      { id: 'middle', last_assigned_at: '2026-10-10T00:00:00Z' },
    ])
    expect(ranked.map(a => a.id)).toEqual(['oldest', 'middle', 'recent'])
  })

  it('breaks an all-null tie randomly, not deterministically by input order', () => {
    const candidates = Array.from({ length: 6 }, (_, i) => ({ id: `agent-${i}`, last_assigned_at: null }))
    const winners = new Set()
    for (let i = 0; i < 60; i++) {
      winners.add(rankAgentsForAssignment(candidates)[0].id)
    }
    // Not a strict distribution check (that would be flaky) - just confirms
    // the same input order doesn't always resolve to the same winner, which
    // is exactly the bug a naive Array.sort (stable, no tiebreak) would have.
    expect(winners.size).toBeGreaterThan(1)
  })

  it('breaks a same-timestamp tie randomly too, not by array position', () => {
    const tied = '2026-10-15T00:00:00Z'
    const candidates = [
      { id: 'x', last_assigned_at: tied },
      { id: 'y', last_assigned_at: tied },
      { id: 'z', last_assigned_at: tied },
    ]
    const winners = new Set()
    for (let i = 0; i < 60; i++) {
      winners.add(rankAgentsForAssignment(candidates)[0].id)
    }
    expect(winners.size).toBeGreaterThan(1)
  })

  it('does not mutate the input array', () => {
    const input = [
      { id: 'a', last_assigned_at: '2026-10-20T00:00:00Z' },
      { id: 'b', last_assigned_at: null },
    ]
    const copy = [...input]
    rankAgentsForAssignment(input)
    expect(input).toEqual(copy)
  })
})
