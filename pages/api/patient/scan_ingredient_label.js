// pages/api/patient/scan_ingredient_label.js
// ─────────────────────────────────────────────────────────────────────────────
// kc-01, reframed on your call: not a barcode/product-database lookup (no
// such API is wired up here, and there's no free option that covers baby
// formula/OTC the way Open Food Facts covers groceries) - just a photo of
// an ingredient label, read by Claude vision, cross-checked against this
// patient's own allergies/conditions on file plus a verified G6PD
// avoidance list (Winnipeg RHA / BC Children's Hospital reference
// guides, as supplied). Same propose-don't-auto-apply pattern as every
// other OCR feature here - this only ever returns flags for the patient
// to read and judge themselves, never a block/allow verdict, and nothing
// here is written to the database. Requires ANTHROPIC_API_KEY.
// Subscriber-only (Bump/Guardian) - your own call, after noting this is
// usually a one-off a person can just do themselves; the repeat/heavy
// use (managing several people's health, chronic-illness care) is
// exactly what the subscription is for.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { isActiveSubscriber } from '../../../lib/aiScanQuota'

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Verified G6PD-deficiency contraindication reference, transcribed from
// the Winnipeg Regional Health Authority Genetics G6PD Reference Guide
// and the BC Children's Hospital G6PD Deficiency Information Sheet (as
// supplied) - not from memory. Only ever consulted when this patient has
// a G6PD-related condition on file; otherwise it plays no role at all.
const G6PD_DEFINITE_RISK = ['nitrofurantoin','nitrofurazone','ciprofloxacin','moxifloxacin','norfloxacin','ofloxacin','nalidixic acid','co-trimoxazole','sulfadiazine','sulfamethoxazole','sulfasalazine','chloramphenicol','primaquine','pamaquine','pentaquine','mepacrine','dapsone','para-aminosalicylic acid','pas','methylene blue','rasburicase','doxorubicin','phenazopyridine','phenylhydrazine','acetylphenylhydrazine','niridazole','stibophen','beta-naphthol']
const G6PD_POSSIBLE_RISK = ['aspirin','acetylsalicylic acid','paracetamol','dipyrone','phenacetin','furazolidone','streptomycin','isoniazid','chloroquine','quinine','quinidine','pyrimethamine','proguanil','fava beans','naphthalene','mothballs','vitamin k','ascorbic acid','colchicine','glibenclamide','phenytoin']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Ingredient scanning is not set up yet - ANTHROPIC_API_KEY is missing.' })
  }

  const { fileBase64, mediaType, patientId } = req.body || {}
  if (!fileBase64) return res.status(400).json({ error: 'fileBase64 is required' })
  if (!patientId) return res.status(400).json({ error: 'patientId is required' })
  const safeMediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg'

  if (!(await isActiveSubscriber(supabase, patientId))) {
    return res.status(402).json({ error: 'Ingredient scanning is a Medsa Bump/Guardian subscriber feature - subscribe from Account Settings to use it.' })
  }

  const [{ data: allergies }, { data: conditions }] = await Promise.all([
    supabase.from('allergies').select('allergen, severity').eq('patient_id', patientId),
    supabase.from('conditions').select('condition_name').eq('patient_id', patientId).eq('active', true),
  ])
  const hasG6pd = (conditions || []).some(c => /g6pd|favis/i.test(c.condition_name || ''))

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'medium' },
      system: `You are reading a photo of a real ingredient/label (food, formula, OTC medication, or supplement) for a patient, to flag anything that conflicts with their own known allergies or, if relevant, a verified G6PD-deficiency avoidance list. Only flag an ingredient that is actually visible on the label and actually matches - never guess or assume an ingredient is present. This is a proposal for the patient to read and judge, not a block/allow verdict.

Patient's known allergies: ${(allergies||[]).map(a=>`${a.allergen}${a.severity?` (${a.severity})`:''}`).join(', ') || 'none on file'}
${hasG6pd ? `This patient has a G6PD-related condition on file. Flag any ingredient matching this verified avoidance list:\nDefinite risk of hemolysis: ${G6PD_DEFINITE_RISK.join(', ')}\nPossible risk (use with caution): ${G6PD_POSSIBLE_RISK.join(', ')}` : 'This patient has no G6PD-related condition on file - do not apply the G6PD list.'}`,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: safeMediaType, data: fileBase64 } },
          { type: 'text', text: 'What ingredients are on this label, and does anything conflict with the allergies or G6PD list above?' },
        ],
      }],
      tools: [{
        name: 'report_label_scan',
        description: 'Return what was read off the label and any conflicts found.',
        strict: true,
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            readable: { type: 'boolean', description: 'false if the photo is unreadable or is not an ingredient/label photo' },
            ingredients: { type: 'array', items: { type: 'string' }, description: 'Ingredients actually read off the label' },
            flags: {
              type: 'array',
              items: {
                type: 'object', additionalProperties: false,
                properties: {
                  ingredient: { type: 'string' },
                  matchedAgainst: { type: 'string', enum: ['allergy', 'g6pd_definite', 'g6pd_possible'] },
                  detail: { type: 'string', description: 'Short plain-language explanation' },
                },
                required: ['ingredient', 'matchedAgainst', 'detail'],
              },
            },
            issue: { type: ['string', 'null'], description: 'Why nothing could be read, if readable is false' },
          },
          required: ['readable', 'ingredients', 'flags', 'issue'],
        },
      }],
      tool_choice: { type: 'tool', name: 'report_label_scan' },
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse?.input) return res.status(502).json({ error: 'Could not read this label - try a clearer photo.' })
    if (!toolUse.input.readable) return res.status(422).json({ error: toolUse.input.issue || 'Could not read this label clearly - try a clearer photo.' })
    return res.status(200).json({ ingredients: toolUse.input.ingredients || [], flags: toolUse.input.flags || [] })
  } catch (err) {
    return res.status(502).json({ error: 'Label scan unavailable right now - try again later.' })
  }
}
