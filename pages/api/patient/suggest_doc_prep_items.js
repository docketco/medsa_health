// pages/api/patient/suggest_doc_prep_items.js
// ─────────────────────────────────────────────────────────────────────────────
// Document Prep bundles (components/patient/PatientApp.jsx's
// NewDocumentBundleForm) previously only let a patient pick from a fixed
// preset list or type their own checklist items by hand - even when they'd
// just uploaded the insurer's own form stating exactly what it needs. Same
// pattern as parse_plan_document.js/parse_medication_label.js: this only
// ever returns a proposal the patient reviews and can add to/remove from
// before creating the bundle - nothing here writes to the database, and
// nothing is trusted as the final checklist without the patient seeing it
// first. Requires ANTHROPIC_API_KEY; without it this returns a clear 503
// instead of silently doing nothing. Subscriber-only (Bump/Guardian),
// same as the ingredient scanner - your own call, after noting this is
// usually a one-off a person can just do themselves; the repeat/heavy
// use (managing several people's health, chronic-illness care) is
// exactly what the subscription is for.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { isActiveSubscriber } from '../../../lib/aiScanQuota'

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Document suggestions are not set up yet - ANTHROPIC_API_KEY is missing.' })
  }

  const { fileBase64, mediaType, isPdf, patientId } = req.body || {}
  if (!fileBase64) return res.status(400).json({ error: 'fileBase64 is required' })
  if (!patientId) return res.status(400).json({ error: 'patientId is required' })
  const safeMediaType = isPdf ? 'application/pdf' : (['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg')

  if (!(await isActiveSubscriber(supabase, patientId))) {
    return res.status(402).json({ error: 'AI document suggestions are a Medsa Bump/Guardian subscriber feature - subscribe from Account Settings to use it, or add your checklist items manually.' })
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'medium' },
      system: 'You are reading a real insurance form, letter, or instructions a patient received, to propose a document checklist for them to gather. Only propose documents the form actually asks for or clearly implies - do not invent generic items that are not supported by the text. This is a proposal the patient will review and edit before using - it is fine to propose few items if the form is short, and to say so if the document is unreadable or is not this kind of form at all.',
      messages: [{
        role: 'user',
        content: [
          { type: isPdf ? 'document' : 'image', source: { type: 'base64', media_type: safeMediaType, data: fileBase64 } },
          { type: 'text', text: 'What documents does this form/letter ask the patient to provide? Propose a short checklist.' },
        ],
      }],
      tools: [{
        name: 'propose_checklist',
        description: 'Return the document checklist this form supports, or say why none could be determined.',
        strict: true,
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            readable: { type: 'boolean', description: 'false if the file is unreadable or clearly not a form/letter requesting documents' },
            items: { type: 'array', items: { type: 'string' }, description: 'Short labels for each document asked for, e.g. "Referral letter", "Lab result dated within 30 days" - empty if none found' },
            issue: { type: ['string', 'null'], description: 'Why no items were found, if readable is false or items is empty' },
          },
          required: ['readable', 'items', 'issue'],
        },
      }],
      tool_choice: { type: 'tool', name: 'propose_checklist' },
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse?.input) return res.status(502).json({ error: 'Could not read this document - add items manually instead.' })
    if (!toolUse.input.readable) return res.status(422).json({ error: toolUse.input.issue || 'Could not read this document clearly - add items manually instead.' })
    return res.status(200).json({ items: toolUse.input.items || [] })
  } catch (err) {
    return res.status(502).json({ error: 'Document suggestions unavailable right now - add items manually instead.' })
  }
}
