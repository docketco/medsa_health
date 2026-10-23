// pages/api/patient/check_document_name_match.js
// ─────────────────────────────────────────────────────────────────────────────
// Oct 23 - a cheap sanity check for self-uploaded documents, not identity
// verification. Real identity matching for a dependent (especially a
// child, who has no HKID/biometric of their own) already happens the
// same way it does in any real clinic: a staff member checks the person
// in front of them against a specific record at every visit (see
// ClinicOps' CheckInSearchScreen) - that's the actual anchor, repeated
// on every visit, stronger than anything a one-time document check here
// could add. This only catches an honest mistake on the ONE path that
// check doesn't cover - a parent uploading a document themselves,
// outside any clinic visit - by reading whatever name appears on the
// document and flagging it if it looks like a different person
// entirely. Never blocks the upload, just a propose-don't-block note on
// the result screen, same posture as every other AI read in this app.
// Requires ANTHROPIC_API_KEY.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

// Loose on purpose - different documents transliterate Chinese names
// differently, use "Surname Given" vs "Given Surname" order, include a
// middle name sometimes, etc. This only needs to catch an obviously
// different person, not penalize normal spelling variation.
function looselyMatches(expected, found) {
  const norm = s => (s || '').toLowerCase().replace(/[^a-z一-鿿\s]/g, '').split(/\s+/).filter(Boolean)
  const expTokens = norm(expected)
  const foundTokens = norm(found)
  if (expTokens.length === 0 || foundTokens.length === 0) return null
  const overlap = expTokens.filter(t => foundTokens.some(f => f.includes(t) || t.includes(f)))
  return overlap.length >= Math.min(1, expTokens.length) && overlap.length / expTokens.length >= 0.4
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ checked: false, reason: 'Name check unavailable right now.' })
  }

  const { fileBase64, mediaType, expectedName } = req.body || {}
  if (!fileBase64 || !expectedName) return res.status(400).json({ error: 'fileBase64 and expectedName are required' })
  const safeMediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg'

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 256,
      output_config: { effort: 'low' },
      system: 'You are reading a photo of a real medical/health document to find whose name, if any, is printed on it as the patient. Only report a name actually visible on the document - never guess.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: safeMediaType, data: fileBase64 } },
          { type: 'text', text: 'What patient name, if any, is printed on this document?' },
        ],
      }],
      tools: [{
        name: 'report_name_found',
        description: 'Report the patient name found on the document, if any.',
        strict: true,
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            readable: { type: 'boolean' },
            nameFound: { type: ['string', 'null'], description: 'The patient name as printed, or null if none is visible/the document is unreadable' },
          },
          required: ['readable', 'nameFound'],
        },
      }],
      tool_choice: { type: 'tool', name: 'report_name_found' },
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse?.input?.readable || !toolUse.input.nameFound) {
      return res.status(200).json({ checked: true, nameFound: null, matches: null })
    }
    const nameFound = toolUse.input.nameFound
    return res.status(200).json({ checked: true, nameFound, matches: looselyMatches(expectedName, nameFound) })
  } catch (err) {
    return res.status(200).json({ checked: false, reason: 'Name check unavailable right now.' })
  }
}
