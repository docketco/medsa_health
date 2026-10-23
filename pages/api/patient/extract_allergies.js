// pages/api/patient/extract_allergies.js
// ─────────────────────────────────────────────────────────────────────────────
// Reads a photo of an allergy test result (skin-prick/IgE panel printout,
// a clinic letter, etc.) and proposes allergens to add to My allergies.
// Same posture as every other AI read in this app: this never writes to
// the database itself and never auto-adds anything - it only returns a
// list of candidates for the patient to review, edit, deselect, and
// confirm on the review screen before handleAddAllergy runs per item.
// Still inserted as reported_by:'patient_reported' (not clinically
// confirmed) because the account holder is the one choosing to add it,
// same as typing it in by hand - we only read the document for them.
// Requires ANTHROPIC_API_KEY.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Document import is not set up yet - add allergies manually below.' })
  }

  const { fileBase64, mediaType } = req.body || {}
  if (!fileBase64) return res.status(400).json({ error: 'fileBase64 is required' })
  const safeMediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg'

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system: 'You are reading a photo of an allergy-related document (an allergy test result/panel, a clinic letter, a discharge note mentioning allergies) for a patient who wants to add confirmed allergens to their own record. Only report allergens that are actually stated as positive/present/confirmed on the document - never include items explicitly marked negative, not tested, or only being screened for. Do not infer severity if it is not stated.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: safeMediaType, data: fileBase64 } },
          { type: 'text', text: 'What allergens, if any, does this document show as positive/confirmed for this patient?' },
        ],
      }],
      tools: [{
        name: 'report_allergies',
        description: 'Report the allergens found as positive/confirmed on the document, if any.',
        strict: true,
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            readable: { type: 'boolean', description: 'false if the photo is too unclear or is not an allergy-related document' },
            allergies: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  allergen: { type: 'string' },
                  severity: { type: ['string', 'null'], description: 'Only if stated on the document, e.g. "Severe" or a class/grade - otherwise null' },
                },
                required: ['allergen', 'severity'],
              },
            },
            issue: { type: ['string', 'null'], description: 'Why nothing could be read, if readable is false or allergies is empty' },
          },
          required: ['readable', 'allergies', 'issue'],
        },
      }],
      tool_choice: { type: 'tool', name: 'report_allergies' },
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse?.input?.readable) {
      return res.status(422).json({ error: toolUse?.input?.issue || 'Could not read this document clearly - add allergies manually below.' })
    }
    const allergies = (toolUse.input.allergies || []).filter(a => a.allergen && a.allergen.trim())
    if (allergies.length === 0) {
      return res.status(200).json({ allergies: [], issue: toolUse.input.issue || 'No confirmed allergens found on this document.' })
    }
    return res.status(200).json({ allergies })
  } catch (err) {
    return res.status(502).json({ error: 'Document import unavailable right now - add allergies manually below.' })
  }
}
