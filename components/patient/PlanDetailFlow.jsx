// components/patient/PlanDetailFlow.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Real rebuild, replacing the old inline "expand the list card a bit" form:
// tapping a plan now opens a dedicated full-screen plan page (PlanDetailPage),
// and declaring runs through a real multi-step declaration
// (HealthDeclarationWizard) modeled directly on a real HK insurer's actual
// application flow (consent screens + a structured ~14-question medical
// questionnaire, mostly yes/no and multi-select - not a freeform chip
// picker where the patient has to already know what's relevant).
//
// Every yes/no or multi-select answer that indicates something real gets
// turned into a declared-condition string and fed into the EXISTING
// matching pipeline (/api/patient/match_plan_suitability) unchanged - this
// file only rebuilds how conditions get COLLECTED, not how they get
// matched (lib/planSuitabilityMatch.js and its dual text+ICD-10 mechanism
// are untouched).
//
// A completed declaration is kept in patient_health_declarations for 30
// real days, reused across every plan without re-asking.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import C from '../shared/colours'
import TermsAgreementModal from '../shared/TermsAgreementModal'

function Btn({ children, onClick, variant='secondary', style:sx={}, disabled }) {
  const base={border:'none',borderRadius:'10px',padding:'12px 18px',fontSize:'14px',fontWeight:600,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:disabled?0.5:1,...sx}
  const V={primary:{background:C.green,color:'#fff'},secondary:{background:'#fff',color:C.text,border:`1px solid ${C.border}`},danger:{background:C.red,color:'#fff'},ghost:{background:'transparent',color:C.textSub,border:'none',padding:'8px 4px'}}
  return <button style={{...base,...V[variant]}} onClick={onClick} disabled={disabled}>{children}</button>
}
function Card({ children, style:sx={} }) {
  return <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:'14px',padding:'18px',marginBottom:'14px',...sx}}>{children}</div>
}

// Real gap found live-testing: a declined verdict on this (new) dedicated
// plan page was a dead end - a "Done" button and nothing else, even
// though the matching engine already computes real alternatives
// (find_alternative_plans.js) and the old inline flow always offered
// them. Same small fetch-on-demand panel PatientApp.jsx's My Inquiries
// uses for the same purpose.
function AlternativePlansPanel({ inquiryId, onViewPlan }) {
  const [loaded, setLoaded] = useState(false)
  const [alternatives, setAlternatives] = useState([])
  const [loading, setLoading] = useState(false)
  async function load() {
    setLoading(true)
    const res = await fetch('/api/patient/find_alternative_plans', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ inquiryId }),
    })
    const data = await res.json()
    setAlternatives(data.alternatives || [])
    setLoading(false)
    setLoaded(true)
  }
  if (!loaded) return <Btn style={{width:'100%',marginTop:'10px'}} disabled={loading} onClick={load}>{loading?'Looking…':'See other plans that might work'}</Btn>
  return (
    <div style={{marginTop:'10px'}}>
      {alternatives.length===0
        ? <div style={{fontSize:'12px',color:C.textMuted}}>No matching alternative found automatically - talking to an agent is your best next step.</div>
        // Real gap found live-testing: these used to just be text - tapping
        // one did nothing, since this page had no way to open a DIFFERENT
        // plan's own page from inside itself. onViewPlan (from PatientApp,
        // which owns the full plan list) makes it a real navigation.
        : alternatives.map(a=>(
          <div key={a.planId} onClick={()=>onViewPlan&&onViewPlan(a.planId)} style={{padding:'10px 12px',background:C.beige,borderRadius:'8px',marginBottom:'6px',cursor:onViewPlan?'pointer':'default',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:'13px',fontWeight:600}}>{a.planName}</div>
              <div style={{fontSize:'11px',color:C.textMuted}}>{a.companyName}{a.sameInsurer?' · same insurer':' · different insurer'}{a.quotedPremium!=null?` · HK$${a.quotedPremium}/mo`:''}</div>
            </div>
            {onViewPlan&&<span style={{fontSize:'12px',color:C.textMuted}}>View →</span>}
          </div>
        ))}
    </div>
  )
}
function YesNo({ value, onChange, label, hint }) {
  return (
    <div style={{marginBottom:'20px'}}>
      <div style={{fontSize:'14px',fontWeight:600,color:C.text,marginBottom:hint?'2px':'10px',lineHeight:1.5}}>{label}</div>
      {hint&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{hint}</div>}
      <div style={{display:'flex',gap:'8px'}}>
        <button onClick={()=>onChange(false)} style={{flex:1,padding:'11px',borderRadius:'10px',fontSize:'13px',fontWeight:600,cursor:'pointer',border:value===false?`2px solid ${C.green}`:`1px solid ${C.border}`,background:value===false?C.greenXLight:'#fff',color:value===false?C.green:C.textSub}}>No</button>
        <button onClick={()=>onChange(true)} style={{flex:1,padding:'11px',borderRadius:'10px',fontSize:'13px',fontWeight:600,cursor:'pointer',border:value===true?`2px solid ${C.amber}`:`1px solid ${C.border}`,background:value===true?C.amberLight:'#fff',color:value===true?C.amber:C.textSub}}>Yes</button>
      </div>
    </div>
  )
}
const EMPTY_CUSTOM_QUESTIONS = { diagnosed: [], current: [], otherSymptoms: [], familyHistory: [] }
const CUSTOM_CATEGORY_KEY = { diagnosed: 'diagnosed', current: 'current', other_symptoms: 'otherSymptoms', family_history: 'familyHistory' }

// A plan's insurer can add their own items to the four list-questions
// below (InsuranceApp.jsx's Plan Manager) - resolved by company name since
// insurance_plans has no company_id FK, just company_name text. Company-
// wide additions (plan_id null) apply alongside this specific plan's own.
async function fetchCustomQuestions(companyName, planId) {
  const grouped = { ...EMPTY_CUSTOM_QUESTIONS }
  const { data: company } = await supabase.from('insurance_companies').select('id').eq('name', companyName).maybeSingle()
  if (!company) return grouped
  const { data: rows } = await supabase.from('insurance_plan_custom_questions')
    .select('category, label, plan_id').eq('company_id', company.id).or(`plan_id.eq.${planId},plan_id.is.null`)
  for (const r of rows || []) {
    const key = CUSTOM_CATEGORY_KEY[r.category]
    if (key) grouped[key].push(r.label)
  }
  return grouped
}

function MultiSelect({ options, selected, onToggle, label, hint }) {
  return (
    <div style={{marginBottom:'20px'}}>
      <div style={{fontSize:'14px',fontWeight:600,color:C.text,marginBottom:hint?'2px':'10px',lineHeight:1.5}}>{label}</div>
      {hint&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{hint}</div>}
      <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
        {options.map(o=>(
          <button key={o} onClick={()=>onToggle(o)} style={{padding:'8px 14px',borderRadius:'20px',fontSize:'12.5px',fontWeight:500,cursor:'pointer',border:selected.includes(o)?`2px solid ${C.amber}`:`1px solid ${C.border}`,background:selected.includes(o)?C.amberLight:'#fff',color:selected.includes(o)?C.amber:C.textSub,textAlign:'left'}}>{o}</button>
        ))}
      </div>
    </div>
  )
}

// ── Real question content, modeled directly on the reference questionnaire ──
const DIAGNOSED_CONDITIONS = [
  'Cancer or carcinoma in situ', 'Brain tumor', 'Heart disease', 'Stroke (including transient ischemic attack)',
  'Hypertension', 'Diabetes mellitus or impaired glucose tolerance', 'Kidney disease',
  'Prolapsed intervertebral disc or degenerative spine condition', 'A condition requiring an implanted medical device or prosthesis',
  'HIV infection', 'Congenital condition', 'Physical defect, impairment, or condition affecting mobility, sight, speech or hearing',
  'Mental health condition (e.g. depression, anxiety, bipolar disorder)', 'Hypercholesterolemia or hyperlipidemia',
  'Liver disorder (e.g. hepatitis B/C, fatty liver, cirrhosis)', 'Multiple sclerosis',
]
const CURRENT_CONDITIONS = [
  'Hernia', 'Breast lesion (tumour/mass/lump/cyst/nodule)', 'Uterine or ovarian lesion',
  'Benign prostatic hypertrophy', 'Gall bladder stone or urinary stone', 'Cataract, glaucoma or retinopathy', 'Arthritis or other joint disorder',
]
const OTHER_SYMPTOMS = [
  'Unintentional weight loss (>5kg in the past year)', 'Abnormal bleeding for at least a month',
  'Other symptom you are seeking or intend to seek medical advice for (e.g. lump, persistent cough, chest pain)',
]
const FAMILY_HISTORY_CONDITIONS = [
  'Cancer', 'Coronary heart disease', 'Diabetes mellitus', 'Motor neuron disease', 'Multiple sclerosis',
  'Stroke', "Parkinson's disease", 'A hereditary disease (e.g. Alzheimer\'s, muscular dystrophy, thalassemia)',
]
const NO_NEED_TO_DISCLOSE = 'Cold/flu, food poisoning (fully recovered), indigestion, acne, a fully-recovered muscle sprain, thrush, a normal routine scan/blood test/health check, a preventive vaccination, or short sightedness/long sightedness.'

function emptyAnswers() {
  return {
    occupation: '', heightCm: '', weightKg: '',
    smoker: null, alcohol: null, drugs: null, hazardousActivities: null, hazardousDetail: '',
    diagnosed: [], current: [], ongoingCare: null, ongoingMedication: null,
    hospitalAdmission: null, daySurgery: null, investigations: null,
    otherSymptoms: [], familyHistory: [],
  }
}

// Flattens every yes/no + multi-select answer into the plain condition-
// string list the existing matching engine already expects - the ONLY
// integration point with lib/planSuitabilityMatch.js's declaredConditions.
function deriveConditions(a) {
  const c = []
  if (a.smoker) c.push('Smoker')
  if (a.alcohol) c.push('Heavy alcohol use')
  if (a.drugs) c.push('Recreational drug use in the last 5 years')
  if (a.hazardousActivities) c.push('High-risk occupation or hobby' + (a.hazardousDetail.trim() ? `: ${a.hazardousDetail.trim()}` : ''))
  c.push(...a.diagnosed)
  c.push(...a.current)
  if (a.ongoingCare) c.push('Ongoing medical follow-up care')
  if (a.ongoingMedication) c.push('Ongoing medication for over 1 month')
  if (a.hospitalAdmission) c.push('Hospital admission in the last 5 years')
  if (a.daySurgery) c.push('Day surgery or procedure in the last 5 years')
  if (a.investigations) c.push('Medical investigations in the last 5 years')
  c.push(...a.otherSymptoms)
  c.push(...a.familyHistory.map(f => `Family history of ${f}`))
  return c
}

// Real 30-day declaration record (patient_health_declarations) - a
// completed wizard is reused across every plan without re-asking
// (aq2-20's intent) for up to DECLARATION_VALIDITY_DAYS, a real
// server-persisted window rather than tied to how long the browser tab
// happens to stay open. Each completed wizard inserts a new row rather
// than overwriting, so old declarations stay on file as a history.
const DECLARATION_VALIDITY_DAYS = 30

async function loadSavedDeclaration(patientId) {
  const { data } = await supabase.from('patient_health_declarations')
    .select('conditions, consent_history_shared, created_at, expires_at')
    .eq('patient_id', patientId).gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!data) return null
  return { conditions: data.conditions || [], consentHistoryShared: data.consent_history_shared, createdAt: data.created_at, expiresAt: data.expires_at }
}
async function saveDeclaration(patientId, answers, conditions, consentHistoryShared) {
  const expiresAt = new Date(Date.now() + DECLARATION_VALIDITY_DAYS * 24 * 3600 * 1000).toISOString()
  const { data } = await supabase.from('patient_health_declarations').insert({
    patient_id: patientId, answers, conditions, consent_history_shared: consentHistoryShared, expires_at: expiresAt,
  }).select('conditions, consent_history_shared, created_at, expires_at').maybeSingle()
  if (!data) return null
  return { conditions: data.conditions || [], consentHistoryShared: data.consent_history_shared, createdAt: data.created_at, expiresAt: data.expires_at }
}

// ── The wizard itself: consent -> questionnaire -> review ───────────────────
function HealthDeclarationWizard({ onComplete, onCancel, initialHeightCm, initialWeightKg, customQuestions = EMPTY_CUSTOM_QUESTIONS, historyMatchingEnabled=true }) {
  const [step, setStep] = useState('consent')
  const [agree1, setAgree1] = useState(false)
  const [agree2, setAgree2] = useState(false)
  const [agree3, setAgree3] = useState(false)
  // Was its own re-asked-every-time checkbox (default off); now a single
  // standing setting in the patient's own Settings (default on, see
  // EditProfileScreen in PatientApp.jsx) - this just reflects that live
  // value rather than asking again on every declaration.
  const consentHistoryShared = historyMatchingEnabled
  // Height/weight default to the patient's most recent clinic-logged
  // vitals (patient_vitals) so they don't have to know these off the top
  // of their head - still a plain editable field, not locked in.
  const [a, setA] = useState(() => ({
    ...emptyAnswers(),
    heightCm: initialHeightCm != null ? String(initialHeightCm) : '',
    weightKg: initialWeightKg != null ? String(initialWeightKg) : '',
  }))
  const set = (k, v) => setA(prev => ({ ...prev, [k]: v }))
  const toggle = (k, item) => setA(prev => ({ ...prev, [k]: prev[k].includes(item) ? prev[k].filter(x => x !== item) : [...prev[k], item] }))

  const answered = a.smoker!=null && a.alcohol!=null && a.drugs!=null && a.hazardousActivities!=null && a.ongoingCare!=null && a.ongoingMedication!=null && a.hospitalAdmission!=null && a.daySurgery!=null && a.investigations!=null

  if (step === 'consent') return (
    <div style={{padding:'20px 16px',maxWidth:560,margin:'0 auto'}}>
      <div style={{fontSize:'18px',fontWeight:700,marginBottom:'4px'}}>Before you apply</div>
      <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'20px'}}>Please read and confirm each of these before continuing.</div>
      <Card>
        <div style={{fontSize:'13px',fontWeight:600,marginBottom:'6px'}}>Health declaration</div>
        <div style={{fontSize:'12.5px',color:C.textSub,lineHeight:1.6,marginBottom:'10px'}}>I will answer to the best of my knowledge and belief, and my answers will be complete, truthful and accurate. If any answer becomes inaccurate before a policy takes effect, I will notify the insurer immediately. I understand that inaccurate, incomplete, or concealed information can lead to a policy being changed, declined, or terminated - even after it's issued.</div>
        <label style={{display:'flex',gap:'8px',alignItems:'flex-start',cursor:'pointer'}}><input type="checkbox" checked={agree1} onChange={e=>setAgree1(e.target.checked)} style={{marginTop:'3px'}}/><span style={{fontSize:'13px',fontWeight:600}}>I agree</span></label>
      </Card>
      <Card>
        <div style={{fontSize:'13px',fontWeight:600,marginBottom:'6px'}}>Authorization to disclose</div>
        <div style={{fontSize:'12.5px',color:C.textSub,lineHeight:1.6,marginBottom:'10px'}}>I authorize the authorities, organisations or individuals who hold my health/medical information to disclose the relevant information for this application's underwriting. Medsa only ever asks about health status when necessary.</div>
        <label style={{display:'flex',gap:'8px',alignItems:'flex-start',cursor:'pointer'}}><input type="checkbox" checked={agree2} onChange={e=>setAgree2(e.target.checked)} style={{marginTop:'3px'}}/><span style={{fontSize:'13px',fontWeight:600}}>I agree</span></label>
      </Card>
      <Card>
        <div style={{fontSize:'13px',fontWeight:600,marginBottom:'6px'}}>Accuracy is my responsibility</div>
        <div style={{fontSize:'12.5px',color:C.textSub,lineHeight:1.6,marginBottom:'10px'}}>Under the principle of Utmost Good Faith, I'm responsible for giving precise, complete information so the underwriting result is accurate - this protects against disputes later, including at claim time.</div>
        <label style={{display:'flex',gap:'8px',alignItems:'flex-start',cursor:'pointer'}}><input type="checkbox" checked={agree3} onChange={e=>setAgree3(e.target.checked)} style={{marginTop:'3px'}}/><span style={{fontSize:'13px',fontWeight:600}}>I agree</span></label>
      </Card>
      <Card>
        <div style={{fontSize:'13px',fontWeight:600,marginBottom:'6px'}}>Visit history in matching</div>
        <div style={{fontSize:'12.5px',color:C.textSub,lineHeight:1.6}}>
          {consentHistoryShared
            ? <>Your own real visit history on this platform is checked against whatever plan you apply for, to see how well it actually suits you - it can only ever flag something for an underwriter to double check, never decline you on its own, and it's never shown to an agent or insurer as raw history.</>
            : <>Off in your Settings - matching will only use what you answer below, not your visit history.</>} Change this any time under Settings &gt; Plan matching.
        </div>
      </Card>
      <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
        <Btn style={{flex:1}} onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" style={{flex:2}} disabled={!agree1||!agree2||!agree3} onClick={()=>setStep('questions')}>Continue</Btn>
      </div>
    </div>
  )

  if (step === 'questions') return (
    <div style={{padding:'20px 16px',maxWidth:560,margin:'0 auto'}}>
      <div style={{fontSize:'18px',fontWeight:700,marginBottom:'4px'}}>Health questionnaire</div>
      <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'20px'}}>Most questions just need a Yes/No answer. This is checked automatically against the plan's own coverage terms - no need to guess what's relevant yourself.</div>

      <Card>
        <div style={{fontSize:'13px',fontWeight:600,marginBottom:'10px'}}>About you</div>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Occupation</div>
        <input value={a.occupation} onChange={e=>set('occupation', e.target.value)} placeholder="e.g. Office worker" style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:'8px'}}>
          <div style={{flex:1}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Height (cm){initialHeightCm!=null&&<span style={{color:C.textMuted}}> · from your last clinic visit, editable</span>}</div>
            <input type="number" value={a.heightCm} onChange={e=>set('heightCm', e.target.value)} style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>Weight (kg){initialWeightKg!=null&&<span style={{color:C.textMuted}}> · from your last clinic visit, editable</span>}</div>
            <input type="number" value={a.weightKg} onChange={e=>set('weightKg', e.target.value)} style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box'}}/>
          </div>
        </div>
      </Card>

      <Card>
        <YesNo label="Do you smoke, or have you smoked in the last year?" hint="Includes cigarettes, cigars, tobacco pipes, chewing tobacco and nicotine replacement products (e.g. e-cigarettes)." value={a.smoker} onChange={v=>set('smoker',v)}/>
        <YesNo label="In the last 12 months, have you drunk alcohol more than 3 times a week on average?" value={a.alcohol} onChange={v=>set('alcohol',v)}/>
        <YesNo label="In the last 5 years, have you used any non-prescribed drugs (excluding supplements) for more than 3 continuous months?" value={a.drugs} onChange={v=>set('drugs',v)}/>
        <YesNo label="In the last or next 12 months, do/did you engage in hazardous sports or activities?" hint="e.g. diving, motor racing, mountaineering, rock climbing, parachuting, skydiving, hang gliding, or flying other than as a fare-paying passenger." value={a.hazardousActivities} onChange={v=>set('hazardousActivities',v)}/>
        {a.hazardousActivities&&<input value={a.hazardousDetail} onChange={e=>set('hazardousDetail', e.target.value)} placeholder="Which activity?" style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginTop:'-10px',marginBottom:'10px'}}/>}
      </Card>

      <Card>
        <div style={{fontSize:'11.5px',color:C.textMuted,marginBottom:'14px',lineHeight:1.6,fontStyle:'italic'}}>You don't need to disclose: {NO_NEED_TO_DISCLOSE}</div>
        <MultiSelect label="Have you ever been diagnosed with any of these?" hint="Select any that apply." options={[...DIAGNOSED_CONDITIONS, ...customQuestions.diagnosed]} selected={a.diagnosed} onToggle={o=>toggle('diagnosed',o)}/>
        <MultiSelect label="Do you currently have any of these?" options={[...CURRENT_CONDITIONS, ...customQuestions.current]} selected={a.current} onToggle={o=>toggle('current',o)}/>
      </Card>

      <Card>
        <YesNo label="In the last 5 years, have you had or been advised to have regular/ongoing follow-up care for any condition?" value={a.ongoingCare} onChange={v=>set('ongoingCare',v)}/>
        <YesNo label="In the last 5 years, has a doctor advised you to take medication for over 1 continuous month?" value={a.ongoingMedication} onChange={v=>set('ongoingMedication',v)}/>
        <YesNo label="In the last 5 years, have you been admitted to a hospital?" value={a.hospitalAdmission} onChange={v=>set('hospitalAdmission',v)}/>
        <YesNo label="In the last 5 years, have you had a surgical procedure (including endoscopy or biopsy) without hospital admission?" value={a.daySurgery} onChange={v=>set('daySurgery',v)}/>
        <YesNo label="In the last 5 years, have you had or been advised to have investigations (blood/urine test, ECG, X-ray, ultrasound, CT/MRI/PET scan, HIV or hepatitis test, etc.)?" value={a.investigations} onChange={v=>set('investigations',v)}/>
      </Card>

      <Card>
        <MultiSelect label="Apart from anything above, do you have any of these?" options={[...OTHER_SYMPTOMS, ...customQuestions.otherSymptoms]} selected={a.otherSymptoms} onToggle={o=>toggle('otherSymptoms',o)}/>
        <MultiSelect label="To your knowledge, have any parents or siblings been diagnosed with any of these at or before age 60?" options={[...FAMILY_HISTORY_CONDITIONS, ...customQuestions.familyHistory]} selected={a.familyHistory} onToggle={o=>toggle('familyHistory',o)}/>
      </Card>

      <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
        <Btn style={{flex:1}} onClick={()=>setStep('consent')}>Back</Btn>
        <Btn variant="primary" style={{flex:2}} disabled={!answered} onClick={()=>{
          const conditions = deriveConditions(a)
          onComplete({ answers: a, conditions, consentHistoryShared })
        }}>Review & submit</Btn>
      </div>
    </div>
  )

  return null
}

// ── The dedicated plan page itself ───────────────────────────────────────────
export default function PlanDetailPage({ plan, patient, isEn=true, onBack, heldPolicies=[], onViewPlan }) {
  const [phase, setPhase] = useState('overview') // overview | wizard | submitting | result | purchasing
  const [mode, setMode] = useState('auto')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [purchaseWardClass, setPurchaseWardClass] = useState('')
  const [purchasePaymentFrequency, setPurchasePaymentFrequency] = useState('monthly')
  const [declarationAck, setDeclarationAck] = useState(false)
  const [termsModalOpen, setTermsModalOpen] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [vitals, setVitals] = useState(null)
  const [customQuestions, setCustomQuestions] = useState(EMPTY_CUSTOM_QUESTIONS)
  const [savedDeclaration, setSavedDeclaration] = useState(null) // null until loaded, or {conditions, consentHistoryShared, createdAt, expiresAt}
  const [agentRequestSent, setAgentRequestSent] = useState(false)
  const [requestingAgent, setRequestingAgent] = useState(false)

  // Real gap found live-testing: this is a long page (wizard -> result),
  // so landing on the result while still scrolled down from the
  // questionnaire made the verdict card invisible until manually
  // scrolled back up - looked like nothing happened. window.scrollTo did
  // nothing because the window itself never scrolls here - PatientApp's
  // shell is a fixed-height column with its own inner scroll container
  // (data-app-scroll-root), same pattern as the insurer portal.
  useEffect(() => { document.querySelector('[data-app-scroll-root]')?.scrollTo(0, 0) }, [phase])

  // Real gap found live-testing: this is a long page (wizard -> result),
  // so landing on the result while still scrolled down from the
  // questionnaire made the verdict card invisible until manually
  // scrolled back up - looked like nothing happened.
  useEffect(() => { window.scrollTo(0, 0) }, [phase])

  useEffect(() => {
    let cancelled = false
    supabase.from('patient_vitals').select('height_cm, weight_kg')
      .eq('patient_id', patient.id).order('logged_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (!cancelled) setVitals(data) })
    return () => { cancelled = true }
  }, [patient.id])

  useEffect(() => {
    let cancelled = false
    fetchCustomQuestions(plan.company, plan.id).then(grouped => { if (!cancelled) setCustomQuestions(grouped) })
    return () => { cancelled = true }
  }, [plan.company, plan.id])

  useEffect(() => {
    let cancelled = false
    loadSavedDeclaration(patient.id).then(d => { if (!cancelled) setSavedDeclaration(d) })
    return () => { cancelled = true }
  }, [patient.id])

  const alreadyHeld = heldPolicies.some(hp => hp.plan_id === plan.id)

  async function runMatch(conditions, consentHistoryShared, chosenMode) {
    setPhase('submitting')
    setError(null)
    try {
      const res = await fetch('/api/patient/match_plan_suitability', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ patientId: patient.id, planId: plan.id, mode: chosenMode, consentHistoryShared, declaredConditions: conditions }),
      })
      const data = await res.json()
      if (data.status !== 'OK') { setError(data.message || 'Something went wrong.'); setPhase('overview'); return }
      setResult({ ...data, declaredConditions: conditions })
      setPhase('result')
    } catch (e) {
      setError('Could not reach the server - try again.')
      setPhase('overview')
    }
  }

  function startFlow(chosenMode, forceNew=false) {
    setMode(chosenMode)
    // Always the patient's CURRENT Settings value, not whatever was true
    // when this declaration was first saved - it's a live standing
    // preference now, not a per-declaration snapshot.
    if (!forceNew && savedDeclaration) { runMatch(savedDeclaration.conditions, patient.history_matching_enabled !== false, chosenMode); return }
    setPhase('wizard')
  }

  async function onWizardComplete({ conditions, consentHistoryShared }) {
    const saved = await saveDeclaration(patient.id, {}, conditions, consentHistoryShared)
    if (saved) setSavedDeclaration(saved)
    runMatch(conditions, consentHistoryShared, mode)
  }

  // Real gap: re-running the full match on "talk to an agent about this
  // instead" re-showed the exact same decline screen (deterministic
  // engine, same declaration) - looked like the button did nothing, even
  // though a real agent-mode inquiry was created behind it. This posts
  // directly and shows a plain confirmation instead of re-rendering the
  // result.
  async function requestAgentForDecline() {
    if (!savedDeclaration) return
    setRequestingAgent(true)
    try {
      await fetch('/api/patient/match_plan_suitability', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ patientId: patient.id, planId: plan.id, mode: 'agent', consentHistoryShared: patient.history_matching_enabled !== false, declaredConditions: savedDeclaration.conditions }),
      })
      setAgentRequestSent(true)
    } finally {
      setRequestingAgent(false)
    }
  }

  async function handlePurchase() {
    if (!declarationAck) return
    setPurchasing(true)
    try {
      const res = await fetch('/api/patient/complete_auto_purchase', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ inquiryId: result.inquiryId, patientId: patient.id, planId: plan.id, wardClass: purchaseWardClass||null, paymentFrequency: purchasePaymentFrequency, healthDeclarationAcknowledged: declarationAck }),
      })
      const data = await res.json()
      if (data.status === 'REDIRECT' && data.checkoutUrl) { window.location.href = data.checkoutUrl; return }
      if (data.status !== 'OK') { setError(data.message || 'Could not complete the purchase.'); setPurchasing(false); return }
      setPhase('purchased')
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige}}>
      <div style={{padding:'16px',borderBottom:`1px solid ${C.border}`,background:'#fff',position:'sticky',top:0,zIndex:5}}>
        <Btn variant="ghost" onClick={onBack}>← Back to plans</Btn>
      </div>

      {phase === 'overview' && (
        <div style={{padding:'20px 16px',maxWidth:560,margin:'0 auto'}}>
          <div style={{fontSize:'22px',fontWeight:700,marginBottom:'2px'}}>{plan.name}</div>
          <div style={{fontSize:'14px',color:C.textSub,marginBottom:'18px'}}>{plan.company}</div>
          <Card>
            <div style={{fontSize:'12px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',marginBottom:'10px'}}>Coverage</div>
            {(plan.covers||[]).map(c=><span key={c} style={{display:'inline-block',fontSize:'12px',background:C.card,color:C.textSub,padding:'4px 10px',borderRadius:'20px',marginRight:'6px',marginBottom:'6px'}}>{c}</span>)}
            {plan.waitingPeriodDays!=null&&<div style={{fontSize:'12px',color:C.textMuted,marginTop:'10px'}}>Waiting period: {plan.waitingPeriodDays} days for new conditions.</div>}
            {plan.price!=null&&<div style={{fontSize:'18px',fontWeight:700,color:C.navy,marginTop:'12px'}}>Estimated HK${plan.price}/mo</div>}
          </Card>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
          {alreadyHeld
            ? <div style={{fontSize:'13px',color:C.green,fontWeight:600}}>✓ You already hold this plan - see "Policy on file".</div>
            /* Real gap found live-testing: a sponsored, TPA-only
               insurer's plan (noTiersAtAll) still sent the patient
               through the whole health-declaration flow and ended on a
               dead end - "approved", no price, no agent who could ever
               claim it, nothing to actually buy. Medsa has no real
               sellable relationship for this plan at all, so the honest
               next step is the insurer's own contact, not either button. */
            : plan.noTiersAtAll
            ? <Card style={{background:C.amberLight,border:`1px solid ${C.amber}`}}>
                <div style={{fontSize:'13px',fontWeight:600,color:C.amber,marginBottom:'6px'}}>Not sold through Medsa</div>
                <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6,marginBottom:'10px'}}>{plan.company} hasn't set this plan up to be quoted or bought on Medsa - contact them directly for a real quote.</div>
                {plan.companyContactEmail&&<a href={`mailto:${plan.companyContactEmail}`} style={{display:'block',fontSize:'13px',color:C.navy,fontWeight:600,marginBottom:'4px'}}>✉ {plan.companyContactEmail}</a>}
                {plan.companyContactPhone&&<a href={`tel:${plan.companyContactPhone}`} style={{display:'block',fontSize:'13px',color:C.navy,fontWeight:600}}>☎ {plan.companyContactPhone}</a>}
                {!plan.companyContactEmail&&!plan.companyContactPhone&&<div style={{fontSize:'12px',color:C.textMuted}}>No contact on file yet - check back later.</div>}
              </Card>
            : <>
              <Btn variant="primary" style={{width:'100%',marginBottom:'10px'}} disabled={plan.requiresAgent} onClick={()=>startFlow('auto')}>{plan.requiresAgent?'Automated quote not offered for this plan':'Quote immediately'}</Btn>
              <Btn style={{width:'100%'}} onClick={()=>startFlow('agent')}>Talk to an agent</Btn>
              {/* Real gap: commission/referral-fee figures were computed
                  throughout the agent/insurer/admin screens but never
                  disclosed to the patient actually paying for the
                  policy - added per your call. Generic here since no
                  specific agent is assigned yet; the real HK$ figure
                  shows once a policy is actually issued (see the held-
                  policy card). */}
              <div style={{fontSize:'10px',color:C.textMuted,textAlign:'center',marginTop:'8px',lineHeight:1.5}}>If an agent helps you with this plan, the insurer may pay them (and Medsa) a commission - this is never added to your premium.</div>
              {savedDeclaration&&<div style={{textAlign:'center',marginTop:'12px'}}>
                <div style={{fontSize:'11px',color:C.textMuted}}>Using your health declaration from {new Date(savedDeclaration.createdAt).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} - valid until {new Date(savedDeclaration.expiresAt).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}.</div>
                <span onClick={()=>setPhase('wizard')} style={{fontSize:'12px',color:C.textMuted,cursor:'pointer',textDecoration:'underline'}}>Update your health declaration</span>
              </div>}
            </>}
        </div>
      )}

      {phase === 'wizard' && <HealthDeclarationWizard onComplete={onWizardComplete} onCancel={()=>setPhase('overview')} initialHeightCm={vitals?.height_cm} initialWeightKg={vitals?.weight_kg} customQuestions={customQuestions} historyMatchingEnabled={patient.history_matching_enabled !== false}/>}
      {phase === 'submitting' && <div style={{textAlign:'center',padding:'60px 20px',color:C.textMuted}}>Checking against this plan…</div>}

      {phase === 'result' && result && (
        <div style={{padding:'20px 16px',maxWidth:560,margin:'0 auto'}}>
          <Card style={{background:result.verdict==='declined'?C.redLight:result.verdict==='flagged'?C.amberLight:C.greenXLight,border:`1px solid ${result.verdict==='declined'?C.red:result.verdict==='flagged'?C.amber:C.greenLight}`}}>
            <div style={{fontSize:'15px',fontWeight:700,marginBottom:'8px',color:result.verdict==='declined'?C.red:result.verdict==='flagged'?C.amber:C.green}}>
              {result.verdict==='approved'&&'✓ Looks suitable for you'}
              {result.verdict==='flagged'&&'⚠ Sent for a quick underwriter review'}
              {result.verdict==='declined'&&"✕ Not suitable under this plan's terms"}
            </div>
            {result.quotedPremium!=null&&result.verdict!=='declined'&&<div style={{fontSize:'16px',fontWeight:700,color:C.navy,marginBottom:'8px'}}>Estimated HK${result.quotedPremium}/mo</div>}
            <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>{result.summary}</div>
            {result.verdict==='flagged'&&<div style={{fontSize:'12px',color:C.textSub,marginTop:'8px'}}>An underwriter usually decides within 2-3 business days. Check back under "My inquiries".</div>}
            <div style={{fontSize:'11px',color:C.textMuted,marginTop:'8px'}}>Rule-based match against this plan's own coverage terms - no AI used.</div>
          </Card>

          {/* Real gap found live-testing: "Talk to an agent" with a clean
              (approved, non-pending) verdict showed this exact same
              self-checkout panel - no mention of an agent anywhere, no way
              to reach the conversation the mode='agent' inquiry already
              created behind the scenes. Self-checkout is the auto path's
              job only; agent mode always hands off to a human instead,
              same as the declined branch below already did. */}
          {mode==='agent'&&result.verdict!=='declined'&&!purchasing&&phase!=='purchased'&&(
            <Card>
              <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'4px'}}>✓ Sent to an agent</div>
              <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5}}>An agent will review this and reach out shortly - check "My inquiries" to follow the conversation once they do.</div>
            </Card>
          )}
          {mode==='auto'&&result.verdict!=='declined'&&!result.underwriterPending&&!purchasing&&phase!=='purchased'&&(
            <Card>
              <div style={{fontSize:'13px',fontWeight:600,marginBottom:'12px'}}>Complete your purchase</div>
              <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
                <select value={purchaseWardClass} onChange={e=>setPurchaseWardClass(e.target.value)} style={{flex:1,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'9px'}}>
                  <option value="">Ward class (General)</option>
                  <option value="general">General</option><option value="semi_private">Semi-private</option><option value="private">Private</option>
                </select>
                <select value={purchasePaymentFrequency} onChange={e=>setPurchasePaymentFrequency(e.target.value)} style={{flex:1,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'9px'}}>
                  <option value="monthly">Monthly</option><option value="annual">Annually</option>
                </select>
              </div>
              {/* Ward class is a real price lever, not just a label - this
                  updates live as it's picked, before the patient commits,
                  per your own note that they should see the real price
                  before the end of the flow, not after. */}
              {result.quotedPremiumByWard&&<div style={{fontSize:'15px',fontWeight:700,color:C.navy,marginBottom:'12px'}}>HK${result.quotedPremiumByWard[purchaseWardClass||'general']}/mo</div>}
              {declarationAck
                ? <div style={{fontSize:'12px',color:C.green,fontWeight:600,marginBottom:'10px'}}>✓ Health declaration & terms reviewed and accepted.</div>
                : <Btn style={{width:'100%',marginBottom:'10px'}} onClick={()=>setTermsModalOpen(true)}>Review & accept health declaration</Btn>}
              <TermsAgreementModal open={termsModalOpen} onClose={()=>setTermsModalOpen(false)} isEn={isEn} planName={plan.name} companyName={plan.company} declaredConditions={result.declaredConditions} waitingPeriodDays={plan.waitingPeriodDays} preExistingConditionPolicy={plan.preExistingConditionPolicy} additionalTerms={plan.additionalTerms} onAccept={()=>{setDeclarationAck(true);setTermsModalOpen(false)}}/>
              {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'8px'}}>{error}</div>}
              <Btn variant="primary" style={{width:'100%'}} disabled={!declarationAck||purchasing} onClick={handlePurchase}>{purchasing?'Confirming…':'Confirm & checkout'}</Btn>
            </Card>
          )}
          {result.underwriterPending&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center'}}>Waiting on a quick sign-off before this can be purchased - check "My inquiries".</div>}
          {/* Real gap: a decline used to be a dead end here (just "Done")
              - the patient has two real next steps instead: a plan that
              would actually approve them, or a human who can look at the
              specific exclusion. Only offered for the auto path - "talk to
              an agent" already took them to a human the first time. */}
          {result.verdict==='declined'&&<Card>
            <div style={{fontSize:'13px',fontWeight:600,marginBottom:'4px'}}>What now?</div>
            <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5,marginBottom:'4px'}}>This plan's own exclusion rule means it can't be sold automatically with what's declared above - that doesn't mean every plan is off the table.</div>
            <AlternativePlansPanel inquiryId={result.inquiryId} onViewPlan={onViewPlan}/>
            {mode==='auto'&&(agentRequestSent
              ? <div style={{fontSize:'12px',color:C.green,fontWeight:600,marginTop:'8px'}}>✓ Sent - an agent will review this personally and reach out. Check "My inquiries".</div>
              : <Btn style={{width:'100%',marginTop:'8px'}} disabled={requestingAgent} onClick={requestAgentForDecline}>{requestingAgent?'Sending…':'Talk to an agent about this instead'}</Btn>)}
          </Card>}
          <Btn style={{width:'100%',marginTop:'8px'}} onClick={onBack}>Done</Btn>
        </div>
      )}

      {phase === 'purchased' && (
        <div style={{padding:'40px 16px',maxWidth:560,margin:'0 auto',textAlign:'center'}}>
          <div style={{fontSize:'20px',fontWeight:700,color:C.green,marginBottom:'8px'}}>✓ Purchased</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px'}}>See it under "Policy on file".</div>
          <Btn variant="primary" style={{width:'100%'}} onClick={onBack}>Back to plans</Btn>
        </div>
      )}
    </div>
  )
}
