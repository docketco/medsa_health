// pages/api/insurer/generate_plan_description.js
// ─────────────────────────────────────────────────────────────────────────────
// Parking Lot item, built per your call: a patient reading about a plan
// shouldn't have to leave Medsa's own experience to read the insurer's
// raw page/PDF - that's the selling point lost. Medsa's AI takes
// whatever raw info the insurer has already typed into Plan Manager
// (name, type, benefits, categories, terms - the same fields the form
// already collects, nothing new to upload) and writes Medsa's own
// patient-facing description from it: the insurer gives data, Medsa
// owns the presentation. Same propose-don't-auto-apply pattern as
// every other AI feature here (suggest_icd10, parse_plan_document,
// suggest_doc_prep_items) - this only ever returns a draft for a human
// to review and edit before saving, never writes to the database
// itself. Requires ANTHROPIC_API_KEY; without it, a clear 503.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI description writing is not set up yet - ANTHROPIC_API_KEY is missing.' })
  }

  const { planName, planType, keyBenefits, coveredCategories, additionalTerms } = req.body || {}
  if (!planName?.trim()) return res.status(400).json({ error: 'planName is required.' })

  const rawInfo = [
    `Plan name: ${planName}`,
    planType ? `Plan type: ${planType}` : null,
    keyBenefits ? `Key benefits (insurer's own words): ${keyBenefits}` : null,
    (coveredCategories||[]).length ? `Covered categories: ${coveredCategories.join(', ')}` : null,
    additionalTerms ? `Additional terms: ${additionalTerms}` : null,
  ].filter(Boolean).join('\n')

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'medium' },
      system: 'You write short, clear, patient-facing descriptions of health insurance plans for a Hong Kong health app, from raw benefit information an insurer has already provided. Only use what is given - never invent a benefit, limit, or term the insurer did not state. Plain language a patient can actually understand, not insurance jargon. This is a draft a human reviews and edits before it is shown to anyone, so it is fine to keep it short and skip anything not stated.',
      messages: [{
        role: 'user',
        content: `Write a patient-facing description for this plan, from only the raw info below:\n\n${rawInfo}`,
      }],
      tools: [{
        name: 'write_plan_description',
        description: 'Return a short patient-facing summary and 3-5 benefit highlights.',
        strict: true,
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            summary: { type: 'string', description: 'A 1-2 sentence plain-language overview of who this plan is for and what it broadly covers.' },
            highlights: { type: 'array', items: { type: 'string' }, description: '3-5 short benefit bullet points, plain language, each one real fact from the given info.' },
          },
          required: ['summary', 'highlights'],
        },
      }],
      tool_choice: { type: 'tool', name: 'write_plan_description' },
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse?.input) return res.status(502).json({ error: 'Could not draft a description - write one in manually.' })
    const { summary, highlights } = toolUse.input
    const draft = [summary, ...(highlights||[]).map(h => `• ${h}`)].join('\n\n')
    return res.status(200).json({ draft })
  } catch (err) {
    return res.status(502).json({ error: 'AI description writing unavailable right now - write one in manually.' })
  }
}
