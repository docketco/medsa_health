// pages/api/cds/suggest_icd10.js
// ─────────────────────────────────────────────────────────────────────────────
// AI-assisted ICD-10 coding help - given a diagnosis/notes description, asks
// Claude to point at the most clinically relevant codes already in Medsa's
// own icd10_reference table. Never invents a code outside that list (the
// candidate set is keyword-narrowed from the real table and cross-checked
// against it again after the model answers), and never adds anything
// itself - the doctor/clinic still clicks a suggestion to add it, same as
// picking one from the manual search. Requires ANTHROPIC_API_KEY to be set
// in the environment; without it this returns a clear 503 instead of
// silently doing nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI coding suggestions are not set up yet - ANTHROPIC_API_KEY is missing.', suggestions: [] })
  }

  const { text } = req.body || {}
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' })

  // Keyword-narrow the reference table first, so the model only ever
  // reasons over real candidates - it's never handed the whole table (which
  // could be large after a bulk CSV import) and never asked to invent one.
  const keywords = [...new Set((text.toLowerCase().match(/[a-z]{4,}/g) || []))].slice(0, 8)
  let candidates = []
  if (keywords.length > 0) {
    const orClause = keywords.map(k => `label.ilike.%${k}%`).join(',')
    const { data } = await supabase.from('icd10_reference').select('code, label').or(orClause).limit(60)
    candidates = data || []
  }
  if (candidates.length === 0) {
    const { data } = await supabase.from('icd10_reference').select('code, label').limit(200)
    candidates = data || []
  }
  if (candidates.length === 0) {
    return res.status(200).json({ suggestions: [], note: 'No ICD-10 codes in the reference set yet - add some under Diagnosis Codes first.' })
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system: 'You are assisting a clinician with ICD-10 coding for a real insurance claim. You may ONLY choose codes from the candidate list provided - never invent a code that is not in it. Pick codes that genuinely match the clinical description; returning zero is correct when nothing matches well. Be conservative - a wrong code on a real claim is worse than no suggestion.',
      messages: [{
        role: 'user',
        content: `Clinical description:\n"""${text.trim()}"""\n\nCandidate ICD-10 codes - choose only from this list:\n${candidates.map(c => `${c.code} - ${c.label}`).join('\n')}`,
      }],
      tools: [{
        name: 'suggest_codes',
        description: 'Return the ICD-10 codes from the candidate list that match the clinical description.',
        strict: true,
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  code: { type: 'string' },
                  reasoning: { type: 'string', description: 'One short sentence on why this code fits.' },
                },
                required: ['code', 'reasoning'],
              },
            },
          },
          required: ['suggestions'],
        },
      }],
      tool_choice: { type: 'tool', name: 'suggest_codes' },
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    const picked = toolUse?.input?.suggestions || []
    // Cross-check against the real candidate set - never trust the model's
    // code string blindly, even though it was instructed to only pick from it.
    const byCode = new Map(candidates.map(c => [c.code, c.label]))
    const suggestions = picked
      .filter(p => byCode.has(p.code))
      .map(p => ({ code: p.code, label: byCode.get(p.code), reasoning: p.reasoning }))

    return res.status(200).json({ suggestions })
  } catch (err) {
    return res.status(502).json({ error: 'AI coding suggestion unavailable right now - pick codes manually.', suggestions: [] })
  }
}
