// pages/api/insurer/parse_plan_document.js
// ─────────────────────────────────────────────────────────────────────────────
// AI-assisted plan-detail extraction - the ONLY way a plan gets created in
// PlanManager now (your call: no manual tiers/category/benefit-limit form
// at all - an insurer uploads the real brochure and that's it). Claude
// reads it once and returns everything the plan listing needs: name,
// type, categories, the patient-facing overview (what the product brings,
// not its technical spec - that line is deliberate, see this repo's own
// "bridge and record, not a decision tool" principle), the full age-
// banded premium table, and the older Coverage-Rules-only fields (copay,
// network type, etc.) kept for CoverageRulesManager, which is unreachable
// today but left defined, not deleted. Always a proposal to review and
// edit before saving, same pattern as suggest_icd10.js, never a direct
// write. Requires ANTHROPIC_API_KEY; without it this returns a clear 503
// instead of silently doing nothing.
//
// pricing_variants: a real insurer premium table (e.g. a VHIS-certified
// plan's standardized Premium Table) is a full age-banded rate grid, often
// repeated once per deductible option in the same document - manually
// retyping that one row at a time through PlanManager's tier editor is
// exactly the "too annoying" case this is for. Claude reads the whole
// grid directly off the document (it already reads official rate tables
// like this reliably - clean, well-formatted, one plan per document) and
// returns every age-banded row, grouped by deductible option when the
// document covers more than one. Each deductible option becomes its own
// plan listing in PlanManager (same tiers shape the manual form already
// saves) rather than adding a new dimension to insurance_plan_pricing_
// tiers - a real pricing difference by deductible is a different product
// a patient picks between, not a sub-field of one plan. Only monthly_
// premium is extracted (not annual/semi-annual/quarterly) since that's
// the only frequency this app prices, displays or checks out anywhere -
// extracting the others would have nowhere real to go.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const PRICING_TIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    age_min: { type: 'integer', description: 'Attained age this row starts at, e.g. 0' },
    age_max: { type: 'integer', description: 'Attained age this row ends at (inclusive) - use 120 for an open-ended "and above" row' },
    monthly_premium: { type: 'number', description: 'Monthly premium for this age band, in HKD. If the document only states annual/semi-annual/quarterly for this band, divide to the real monthly figure the document itself shows - do not invent a figure it never states.' },
    semi_private_premium: { type: ['number', 'null'], description: 'Monthly premium for a semi-private/upgraded room at this age band, null if this document has no ward-class price difference' },
    private_premium: { type: ['number', 'null'], description: 'Monthly premium for a private room at this age band, null if not stated' },
  },
  required: ['age_min', 'age_max', 'monthly_premium', 'semi_private_premium', 'private_premium'],
}
const PRICING_VARIANT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    deductible_label: { type: ['string', 'null'], description: 'How this document names the deductible/excess option this rate table is for, e.g. "Deductible HKD8,800" - null if the document only has one pricing structure with no deductible options' },
    pricing_tiers: { type: 'array', items: PRICING_TIER_SCHEMA, description: 'Every age band row the document states for this deductible option - extract all of them, not a sample' },
  },
  required: ['deductible_label', 'pricing_tiers'],
}
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
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      system: 'You are reading a real health insurance policy/plan document or brochure for a Hong Kong clinic platform, and this is the ONLY step that reads it - there is no manual data-entry form afterward, just a review of what you return. Extract: its name, type, the plain benefit categories a patient would recognize (e.g. "Hospitalisation", "Outpatient", "Dental"), a short patient-facing overview in the brochure\'s own voice (what the product brings - not a technical spec sheet; this is the only description a patient will ever see for this plan), the terms a patient should read before buying, whatever coverage-rule figures the document states, and the full age-banded premium table if the document contains one. Only extract what the document actually states - leave a field null/empty rather than guessing a typical industry figure, and never invent a premium number. If a premium table is present, extract every row for every age band it lists (not a sample, not just a few representative rows) - these numbers fill in a form field the insurer will still review before saving, but the whole point is that they should not have to retype a long table by hand, so a partial extraction defeats it. If the table repeats once per deductible/excess option, return one pricing_variants entry per option, each with its own full set of rows. This is a proposal a human will review and edit before saving, so it is fine (expected, even) to leave non-pricing fields blank when the document does not clearly state them.',
      messages: [{
        role: 'user',
        content: [
          { type: isPdf ? 'document' : 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Extract this plan\'s details for our plan listing form.' },
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
            plan_type: { type: ['string', 'null'], description: 'e.g. "Comprehensive", "Critical illness", "Dental" - whatever this document calls the plan category' },
            key_benefits: { type: ['string', 'null'], description: 'A short plain-language summary of what this plan covers, in the document\'s own wording where possible - not every clause, just what a patient browsing plans would want to see' },
            additional_terms: { type: ['string', 'null'], description: 'Exclusions, what counts as a pre-existing condition, how claims are assessed - the real terms a patient should read before buying, summarized from the document' },
            copay_rate_pct: { type: ['number', 'null'], description: 'Patient copay as a percentage, e.g. 10 for 10%' },
            annual_deductible_hkd: { type: ['number', 'null'] },
            overall_annual_limit_hkd: { type: ['number', 'null'] },
            room_board_daily_limit_hkd: { type: ['number', 'null'] },
            network_type: { type: ['string', 'null'], enum: ['any_licensed', 'panel_only', 'hong_kong_only', 'asia_pacific', 'worldwide', null] },
            waiting_period_days: { type: ['number', 'null'] },
            pre_existing_condition_policy: { type: ['string', 'null'], enum: ['excluded', 'covered_after_waiting', 'covered', null] },
            preauth_threshold_hkd: { type: ['number', 'null'] },
            covered_categories: { type: 'array', items: { type: 'string' }, description: 'Plain benefit categories a patient browsing plans would recognize, e.g. "Hospitalisation", "Outpatient", "Dental", "Maternity" - not legal clause names' },
            category_limits: { type: 'array', items: CATEGORY_LIMIT_SCHEMA },
            patient_facing_description: { type: ['string', 'null'], description: 'A short (3-5 sentence) plain-language overview of what this plan brings a patient - its story/positioning, the way the brochure itself pitches it, not a technical spec sheet. This is the ONLY description a patient ever sees for this plan - write it as if that patient never opens the PDF.' },
            pricing_variants: { type: 'array', items: PRICING_VARIANT_SCHEMA, description: 'Empty array if the document has no premium/rate table at all' },
          },
          required: ['plan_name', 'plan_type', 'key_benefits', 'additional_terms', 'copay_rate_pct', 'annual_deductible_hkd', 'overall_annual_limit_hkd', 'room_board_daily_limit_hkd', 'network_type', 'waiting_period_days', 'pre_existing_condition_policy', 'preauth_threshold_hkd', 'covered_categories', 'category_limits', 'patient_facing_description', 'pricing_variants'],
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
