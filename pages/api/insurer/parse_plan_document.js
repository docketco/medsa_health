// pages/api/insurer/parse_plan_document.js
// ─────────────────────────────────────────────────────────────────────────────
// AI-assisted plan-detail extraction for the self-serve Coverage Rules form
// (components/insurance/InsuranceApp.jsx's CoverageRulesManager). An
// unpartnered insurer can upload their real policy/plan document (PDF) and
// have Claude read it and propose values for every Coverage Rules field -
// copay, deductible, categories, per-category sub-limits, network type,
// waiting period, pre-authorization threshold. Same pattern as
// suggest_icd10.js: this only ever returns a proposal for the insurer to
// review and edit before saving - nothing here writes to the database
// directly. Requires ANTHROPIC_API_KEY; without it this returns a clear
// 503 instead of silently doing nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const CATEGORY_LIMIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    category: { type: 'string', description: 'A covered benefit category, e.g. "Outpatient", "Specialist", "Physiotherapy"' },
    annual_limit_hkd: { type: ['number', 'null'], description: 'Annual cap for this category in HKD, null if uncapped/unstated' },
    per_visit_limit_hkd: { type: ['number', 'null'], description: 'Per-visit cap in HKD, null if uncapped/unstated' },
    requires_preauth: { type: 'boolean' },
    requires_referral: { type: 'boolean' },
  },
  required: ['category', 'annual_limit_hkd', 'per_visit_limit_hkd', 'requires_preauth', 'requires_referral'],
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Document auto-fill is not set up yet - ANTHROPIC_API_KEY is missing.' })
  }

  const { documentPath } = req.body || {}
  if (!documentPath) return res.status(400).json({ error: 'documentPath is required' })

  // documentPath is a path already uploaded by the client into the
  // policy-contracts bucket (same bucket AgentApp.jsx uses for signed
  // policy contracts - same document domain, reused rather than creating
  // a parallel bucket). Downloaded server-side with the service role key
  // so this works regardless of the bucket's own RLS.
  const { data: fileBlob, error: dlErr } = await supabase.storage.from('policy-contracts').download(documentPath)
  if (dlErr || !fileBlob) return res.status(400).json({ error: `Could not read the uploaded document: ${dlErr?.message || 'not found'}` })

  const arrayBuffer = await fileBlob.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const isPdf = documentPath.toLowerCase().endsWith('.pdf')
  const mediaType = isPdf ? 'application/pdf'
    : documentPath.toLowerCase().endsWith('.png') ? 'image/png'
    : 'image/jpeg'

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2048,
      output_config: { effort: 'medium' },
      system: 'You are reading a real health insurance policy/plan document for a Hong Kong clinic platform, extracting structured values to pre-fill a claims-adjudication form. Only extract what the document actually states - leave a field null/empty rather than guessing a typical industry figure. This is a proposal a human will review and edit before saving, so it is fine (expected, even) to leave fields blank when the document does not clearly state them.',
      messages: [{
        role: 'user',
        content: [
          { type: isPdf ? 'document' : 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Extract this plan\'s coverage details for our Coverage Rules form.' },
        ],
      }],
      tools: [{
        name: 'extract_plan_details',
        description: 'Return the plan detail fields this document supports, leaving anything not stated as null/empty.',
        strict: true,
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            plan_name: { type: ['string', 'null'] },
            copay_rate_pct: { type: ['number', 'null'], description: 'Patient copay as a percentage, e.g. 10 for 10%' },
            annual_deductible_hkd: { type: ['number', 'null'] },
            overall_annual_limit_hkd: { type: ['number', 'null'] },
            room_board_daily_limit_hkd: { type: ['number', 'null'] },
            network_type: { type: ['string', 'null'], enum: ['any_licensed', 'panel_only', 'hong_kong_only', 'asia_pacific', 'worldwide', null] },
            waiting_period_days: { type: ['number', 'null'] },
            pre_existing_condition_policy: { type: ['string', 'null'], enum: ['excluded', 'covered_after_waiting', 'covered', null] },
            preauth_threshold_hkd: { type: ['number', 'null'] },
            covered_categories: { type: 'array', items: { type: 'string' } },
            category_limits: { type: 'array', items: CATEGORY_LIMIT_SCHEMA },
          },
          required: ['plan_name', 'copay_rate_pct', 'annual_deductible_hkd', 'overall_annual_limit_hkd', 'room_board_daily_limit_hkd', 'network_type', 'waiting_period_days', 'pre_existing_condition_policy', 'preauth_threshold_hkd', 'covered_categories', 'category_limits'],
        },
      }],
      tool_choice: { type: 'tool', name: 'extract_plan_details' },
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse?.input) return res.status(502).json({ error: 'Could not extract details from this document - fill the form in manually.' })
    return res.status(200).json({ extracted: toolUse.input })
  } catch (err) {
    return res.status(502).json({ error: 'Document auto-fill unavailable right now - fill the form in manually.' })
  }
}
