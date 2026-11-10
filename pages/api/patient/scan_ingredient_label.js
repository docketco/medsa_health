// pages/api/patient/scan_ingredient_label.js
// ─────────────────────────────────────────────────────────────────────────────
// kc-01, reframed on your call: not a barcode/product-database lookup (no
// such API is wired up here, and there's no free option that covers baby
// formula/OTC the way Open Food Facts covers groceries) - just a photo of
// an ingredient label, read by Claude vision. Reframed again per your
// later call: the AI's job stops at transcribing what's actually on the
// label (OCR, not judgment) - every flag below is a deterministic text
// match computed here against this patient's own allergies, active
// medications/supplements, a verified G6PD avoidance list (Winnipeg RHA
// / BC Children's Hospital reference guides, as supplied), and Medsa's
// own clinic-maintained drug_reference library (same table doctors/
// nurses fill in when prescribing - see LabelSticker in
// ClinicOpsApp.jsx) - never an AI guess at whether something's risky.
// Same propose-don't-auto-apply pattern as every other OCR feature here -
// this only ever returns flags for the patient to read and judge
// themselves, never a block/allow verdict, and nothing here is written
// to the database. A clear result means no match was found against what
// this patient has on file, in Medsa's own text - not a guarantee of
// safety, since none of this is real pharmacological interaction data.
// Requires ANTHROPIC_API_KEY. Subscriber-only (Bump/Guardian) - your own
// call, after noting this is usually a one-off a person can just do
// themselves; the repeat/heavy use (managing several people's health,
// chronic-illness care) is exactly what the subscription is for.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { isActiveSubscriber } from '../../../lib/aiScanQuota'

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Same check PatientApp.jsx's PrescriptionsScreen/CalendarScreen and
// emergency_card.js use for "is this medication actually still active" -
// duplicated here rather than shared since all three already were.
function isMedicationActive(m) {
  if (m.active === false) return false
  const explicitEnd = m.end_date ? new Date(m.end_date) : null
  const computedEnd = (!explicitEnd && m.start_date && m.duration_days != null && m.duration_days > 0)
    ? new Date(new Date(m.start_date).getTime() + m.duration_days * 24 * 60 * 60 * 1000)
    : null
  const effectiveEnd = explicitEnd || computedEnd
  return !(effectiveEnd && effectiveEnd < new Date())
}

// Verified G6PD-deficiency contraindication reference, transcribed from
// the Winnipeg Regional Health Authority Genetics G6PD Reference Guide
// and the BC Children's Hospital G6PD Deficiency Information Sheet (as
// supplied) - not from memory. Only ever consulted when this patient has
// a G6PD-related condition on file; otherwise it plays no role at all.
const G6PD_DEFINITE_RISK = ['nitrofurantoin','nitrofurazone','ciprofloxacin','moxifloxacin','norfloxacin','ofloxacin','nalidixic acid','co-trimoxazole','sulfadiazine','sulfamethoxazole','sulfasalazine','chloramphenicol','primaquine','pamaquine','pentaquine','mepacrine','dapsone','para-aminosalicylic acid','pas','methylene blue','rasburicase','doxorubicin','phenazopyridine','phenylhydrazine','acetylphenylhydrazine','niridazole','stibophen','beta-naphthol']
const G6PD_POSSIBLE_RISK = ['aspirin','acetylsalicylic acid','paracetamol','dipyrone','phenacetin','furazolidone','streptomycin','isoniazid','chloroquine','quinine','quinidine','pyrimethamine','proguanil','fava beans','naphthalene','mothballs','vitamin k','ascorbic acid','colchicine','glibenclamide','phenytoin']

// Singular/plural-tolerant substring match (deterministic matching loses
// the AI's own sense of "fava bean" vs "fava beans" - this covers the
// common case without a full synonym dictionary).
function textVariants(s) {
  const n = (s || '').toLowerCase().trim()
  const variants = new Set([n])
  if (n.endsWith('s')) variants.add(n.slice(0, -1))
  else variants.add(n + 's')
  return [...variants].filter(v => v.length >= 3)
}
function fuzzyIncludes(a, b) {
  for (const va of textVariants(a)) for (const vb of textVariants(b)) {
    if (va.includes(vb) || vb.includes(va)) return true
  }
  return false
}

// Every match below is plain text-matching against this patient's own
// records (or Medsa's own clinic-entered reference data) - never an AI
// judgment call, and never real drug-interaction data. Flags against
// drugReference and activeMeds in particular are "you're already taking/
// on file for this" overlap checks, not pharmacology.
function buildFlags(ingredients, { allergies, g6pdActive, activeMeds, dangerousDrugs }) {
  const flags = []
  for (const ingredient of ingredients) {
    if (!ingredient || ingredient.trim().length < 3) continue
    for (const a of allergies) {
      if (a.allergen && fuzzyIncludes(ingredient, a.allergen)) {
        flags.push({ ingredient, matchedAgainst: 'allergy', detail: `Suspected allergy content - matches your known allergy to ${a.allergen}${a.severity ? ` (${a.severity})` : ''}.` })
      }
    }
    if (g6pdActive) {
      if (G6PD_DEFINITE_RISK.some(r => fuzzyIncludes(ingredient, r))) {
        flags.push({ ingredient, matchedAgainst: 'g6pd_definite', detail: 'On the verified G6PD definite-risk avoidance list.' })
      } else if (G6PD_POSSIBLE_RISK.some(r => fuzzyIncludes(ingredient, r))) {
        flags.push({ ingredient, matchedAgainst: 'g6pd_possible', detail: 'On the verified G6PD possible-risk (use-with-caution) list.' })
      }
    }
    for (const med of activeMeds) {
      if (med.medication_name && fuzzyIncludes(ingredient, med.medication_name)) {
        flags.push({ ingredient, matchedAgainst: 'duplicate_medication', detail: `You're already taking ${med.medication_name} - check you're not duplicating this active ingredient from another source.` })
      }
    }
    for (const d of dangerousDrugs) {
      if (d.drug_name && fuzzyIncludes(ingredient, d.drug_name)) {
        flags.push({ ingredient, matchedAgainst: 'dangerous_drug_reference', detail: d.precautions || `Flagged in Medsa's clinic-maintained drug reference - check with a pharmacist.` })
      }
    }
  }
  // De-dupe identical ingredient+reason pairs (the same ingredient word
  // can appear more than once on a real label).
  const seen = new Set()
  return flags.filter(f => {
    const key = `${f.ingredient}|${f.matchedAgainst}|${f.detail}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

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

  const [{ data: allergies }, { data: conditions }, { data: medications }, { data: dangerousDrugs }] = await Promise.all([
    supabase.from('allergies').select('allergen, severity').eq('patient_id', patientId),
    supabase.from('conditions').select('condition_name').eq('patient_id', patientId).eq('active', true),
    supabase.from('medications').select('medication_name, active, end_date, start_date, duration_days').eq('patient_id', patientId),
    supabase.from('drug_reference').select('drug_name, precautions').eq('is_dangerous_drug', true),
  ])
  const hasG6pd = (conditions || []).some(c => /g6pd|favis/i.test(c.condition_name || ''))
  const activeMeds = (medications || []).filter(isMedicationActive)

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'medium' },
      system: `You are reading a photo of a real ingredient/label (food, formula, OTC medication, or supplement). Transcribe every ingredient actually visible and legible on the label - never guess, infer, or assume an ingredient is present if you can't actually read it. This is pure transcription; nothing here is checked or judged by you.`,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: safeMediaType, data: fileBase64 } },
          { type: 'text', text: 'What ingredients are listed on this label?' },
        ],
      }],
      tools: [{
        name: 'report_label_scan',
        description: 'Return what was read off the label.',
        strict: true,
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            readable: { type: 'boolean', description: 'false if the photo is unreadable or is not an ingredient/label photo' },
            ingredients: { type: 'array', items: { type: 'string' }, description: 'Ingredients actually read off the label' },
            issue: { type: ['string', 'null'], description: 'Why nothing could be read, if readable is false' },
          },
          required: ['readable', 'ingredients', 'issue'],
        },
      }],
      tool_choice: { type: 'tool', name: 'report_label_scan' },
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse?.input) return res.status(502).json({ error: 'Could not read this label - try a clearer photo.' })
    if (!toolUse.input.readable) return res.status(422).json({ error: toolUse.input.issue || 'Could not read this label clearly - try a clearer photo.' })

    const ingredients = toolUse.input.ingredients || []
    const flags = buildFlags(ingredients, { allergies: allergies || [], g6pdActive: hasG6pd, activeMeds, dangerousDrugs: dangerousDrugs || [] })
    return res.status(200).json({
      ingredients, flags,
      disclaimer: 'This only checks plain text matches against what\'s on this patient\'s own Medsa record - not real drug-interaction data. A clear result is not a guarantee of safety. Always check with a doctor or pharmacist if unsure.',
    })
  } catch (err) {
    return res.status(502).json({ error: 'Label scan unavailable right now - try again later.' })
  }
}
