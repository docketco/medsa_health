// pages/api/kids/parse_medication_label.js
// ─────────────────────────────────────────────────────────────────────────────
// kp-02 - AI computer-vision OCR for a photographed medication label
// (prescription or OTC), so a parent logging what they gave their child in
// the symptom/fever log (kids_symptom_logs.medication_given) doesn't have to
// type it out by hand. Same pattern as parse_plan_document.js and
// suggest_icd10.js: this only ever returns a proposal the parent reviews
// and can edit in the text field before saving - nothing is read off the
// label and trusted as a dosing instruction, and nothing here writes to the
// database. Requires ANTHROPIC_API_KEY; without it this returns a clear
// 503 instead of silently doing nothing.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Label scanning is not set up yet - ANTHROPIC_API_KEY is missing.' })
  }

  const { imageBase64, mediaType } = req.body || {}
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' })
  const safeMediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg'

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 512,
      output_config: { effort: 'low' },
      system: 'You are reading a photo of a medication label (prescription or OTC) for a parent logging what they gave their child. Only transcribe what the label actually states - do not infer a typical dose for the condition, and do not add any dosing advice of your own. If the photo is unreadable or is not a medication label, say so plainly instead of guessing.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: safeMediaType, data: imageBase64 } },
          { type: 'text', text: 'Transcribe this medication label for a quick log entry.' },
        ],
      }],
      tools: [{
        name: 'transcribe_label',
        description: 'Return what the label states, or an explanation if it cannot be read.',
        strict: true,
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            readable: { type: 'boolean', description: 'false if the photo is too unclear or is not a medication label' },
            medication_text: { type: ['string', 'null'], description: 'A short line combining name, strength, and form as printed, e.g. "Panadol Baby 1-3 Years Suspension 2.5ml" - null if not readable' },
            issue: { type: ['string', 'null'], description: 'Why it could not be read, if readable is false' },
          },
          required: ['readable', 'medication_text', 'issue'],
        },
      }],
      tool_choice: { type: 'tool', name: 'transcribe_label' },
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse?.input) return res.status(502).json({ error: 'Could not read this label - type it in manually.' })
    if (!toolUse.input.readable) return res.status(422).json({ error: toolUse.input.issue || 'Could not read this label clearly - type it in manually.' })
    return res.status(200).json({ medicationText: toolUse.input.medication_text })
  } catch (err) {
    return res.status(502).json({ error: 'Label scanning unavailable right now - type it in manually.' })
  }
}
