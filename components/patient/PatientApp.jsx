import { useState, useEffect, useRef, useCallback, useContext, createContext, isValidElement, cloneElement, Children } from 'react'
import { supabase } from '../../lib/supabase'
import { STAFF_CREDENTIALS_SAFE_COLUMNS } from '../../lib/staffCredentialsColumns'
import { hkWallTimeToUTC, hkParts, hkHHMM, hkDayBounds, isSameHkDay } from '../../lib/hkTime'
import { fetchAndDownloadConsultationReceipt, fetchAndDownloadTreatmentPlanReceipt } from '../../lib/receiptPdf'
import { subscribeIncomingCalls } from '../../lib/videoCallSignal'
import { ageDaysBetween, percentileBands, growthPercentile } from '../../lib/whoGrowth'
import MedsaLogo from '../shared/MedsaLogo'
import C from '../shared/colours'
import Icon from '../shared/Icon'
import TermsAgreementModal from '../shared/TermsAgreementModal'
import PlanDetailPage from './PlanDetailFlow'

// Brand-color override while Medsa Bump is active - every screen in this
// file normally reads C.green/greenMid/greenLight/greenXLight directly, so
// this Context (provided once at the PatientApp root) lets every one of
// them switch to the same baby-pink palette without prop-drilling through
// 30+ separate components.
const ThemeContext = createContext({ accent: C.green, accentMid: C.greenMid, accentLight: C.greenLight, accentXLight: C.greenXLight })

// ── TRADITIONAL → SIMPLIFIED CHINESE CONVERSION ─────────────────────────────
// Every Chinese string in this file is already written in Traditional
// Chinese (the correct written register - not spoken Cantonese slang).
// Rather than hand-duplicate every string into a second Simplified
// version, this converts on the fly at render time, so the exact same
// source text serves both. Covers the characters actually used across
// this app's medical/UI vocabulary.
const TRAD_TO_SIMP = {
  '醫':'医','療':'疗','記':'记','錄':'录','藥':'药','這':'这','說':'说','話':'话','語':'语','內':'内',
  '麼':'么','來':'来','時':'时','間':'间','會':'会','為':'为','後':'后','與':'与','國':'国','門':'门',
  '開':'开','關':'关','電':'电','號':'号','線':'线','緊':'紧','險':'险','個':'个','們':'们','經':'经',
  '過':'过','還':'还','現':'现','實':'实','發':'发','見':'见','種':'种','應':'应','當':'当','點':'点',
  '較':'较','將':'将','動':'动','務':'务','員':'员','單':'单','歷':'历','歲':'岁','長':'长','級':'级',
  '萬':'万','兒':'儿','兩':'两','價':'价','樣':'样','據':'据','態':'态','狀':'状','層':'层','導':'导',
  '護':'护','診':'诊','劑':'剂','檢':'检','驗':'验','測':'测','壓':'压','齡':'龄','術':'术','傷':'伤',
  '癒':'愈','癌':'癌','腫':'肿','瘤':'瘤','嚴':'严','極':'极','複':'复','雜':'杂','類':'类','數':'数',
  '總':'总','約':'约','報':'报','觀':'观','視':'视','聽':'听','讀':'读','寫':'写','劃':'划','設':'设',
  '備':'备','準':'准','確':'确','認':'认','証':'证','證':'证','試':'试','題':'题','選':'选','擇':'择',
  '買':'买','賣':'卖','費':'费','貴':'贵','賬':'账','帳':'账','財':'财','產':'产','業':'业','營':'营',
  '銷':'销','購':'购','贈':'赠','資':'资','質':'质','獨':'独','親':'亲','屬':'属','衛':'卫','請':'请',
  '讓':'让','謝':'谢','歡':'欢','樂':'乐','漢':'汉','華':'华','灣':'湾','區':'区','縣':'县','鄉':'乡',
  '鎮':'镇','網':'网','絡':'络','連':'连','車':'车','機':'机','場':'场','館':'馆','廳':'厅','樓':'楼',
  '梯':'梯','窗':'窗','鎖':'锁','鑰':'钥','匙':'匙','鐘':'钟','錶':'表','錢':'钱','幣':'币','兌':'兑',
  '換':'换','轉':'转','運':'运','輸':'输','達':'达','適':'适','該':'该','須':'须','義':'义','責':'责',
  '擔':'担','負':'负','擁':'拥','養':'养','飲':'饮','飼':'饲','餵':'喂','飽':'饱','飢':'饥','餓':'饿',
  '渴':'渴','醒':'醒','睡':'睡','眠':'眠','夢':'梦','覺':'觉','聞':'闻','聲':'声','響':'响','靜':'静',
  '鬆':'松','張':'张','緩':'缓','急':'急','慢':'慢','快':'快','遲':'迟','早':'早','晚':'晚','週':'周',
  '曆':'历','嬰':'婴','孕':'孕','婦':'妇','童':'童','幼':'幼','學':'学','習':'习','校':'校','師':'师',
  '課':'课','練':'练','書':'书','籍':'籍','冊':'册','頁':'页','篇':'篇','章':'章','節':'节','興':'兴',
  '趣':'趣','愛':'爱','厭':'厌','惡':'恶','怒':'怒','痛':'痛','癢':'痒','脹':'胀','燒':'烧','熱':'热',
  '溫':'温','涼':'凉','濕':'湿','燥':'燥','乾':'干','淨':'净','髒':'脏','齒':'齿','喉':'喉','嚨':'咙',
  '臉':'脸','頰':'颊','額':'额','頭':'头','腦':'脑','頸':'颈','肩':'肩','臟':'脏','腸':'肠','腎':'肾',
  '肺':'肺','膽':'胆','脾':'脾','膀':'膀','胱':'胱','陰':'阴','陽':'阳','舊':'旧','鮮':'鲜','農':'农',
  '漁':'渔','牧':'牧','園':'园','傳':'传','儲':'储','償':'偿','偽':'伪','倫':'伦','偵':'侦','側':'侧',
  '僑':'侨','傾':'倾','偷':'偷','偏':'偏','停':'停','假':'假','爭':'争','虧':'亏','於':'于','頻':'频',
  '症':'症','斷':'断','保':'保','賠':'赔','索':'索','核':'核','投':'投','預':'预','掛':'挂','排':'排',
  '隊':'队','等':'等','候':'候','叫':'叫','取':'取','消':'消','更':'更','改':'改','期':'期','姓':'姓',
  '名':'名','性':'性','別':'别','出':'出','生':'生','日':'日','身':'身','份':'份','碼':'码','址':'址',
  '郵':'邮','箱':'箱','聯':'联','繫':'系','糖':'糖','脂':'脂','氧':'氧','率':'率','敏':'敏','物':'物',
  '反':'反','副':'副','作':'作','用':'用','禁':'禁','忌':'忌','理':'理','史':'史','家':'家','族':'族',
  '手':'手','查':'查','化':'化','告':'告','結':'结','果':'果','常':'常','異':'异','升':'升','高':'高',
  '降':'降','住':'住','院':'院','留':'留','床':'床','入':'入',
}
function simplifyText(str) {
  if (typeof str !== 'string') return str
  let out = ''
  for (const ch of str) out += TRAD_TO_SIMP[ch] || ch
  return out
}
// Recursively walks a React node tree, converting any string leaves to
// Simplified Chinese - this is what lets us reuse every existing
// Traditional Chinese string without touching hundreds of lines by hand.
// Prop names used across this app's own reusable components to carry
// plain display text (Badge's `text`, InfoRow's `label`/`value`, etc.) -
// converting only these specific names avoids touching functional props
// like `type`, `variant`, or `key` that happen to also be strings.
const SIMPLIFY_PROP_NAMES = new Set(['text','label','value','sub','placeholder'])

function deepSimplify(node) {
  if (typeof node === 'string') return simplifyText(node)
  if (Array.isArray(node)) return Children.map(node, deepSimplify)
  if (isValidElement(node)) {
    const props = node.props || {}
    const propOverrides = {}
    for (const name of SIMPLIFY_PROP_NAMES) {
      if (typeof props[name] === 'string') propOverrides[name] = simplifyText(props[name])
    }
    const children = props.children
    if (children !== undefined) propOverrides.children = deepSimplify(children)
    if (Object.keys(propOverrides).length === 0) return node
    return cloneElement(node, { key: node.key, ...propOverrides })
  }
  return node
}

function Btn({ children, onClick, variant='secondary', style:sx={}, disabled }) {
  const __theme = useContext(ThemeContext)
  const base={border:'none',borderRadius:'10px',padding:'10px 16px',fontSize:'13px',fontWeight:500,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:disabled?0.5:1,...sx}
  const V={primary:{background:__theme.accent,color:'#fff'},secondary:{background:C.card,color:C.text,border:`0.5px solid ${C.border}`},danger:{background:C.red,color:'#fff'},amber:{background:C.amber,color:'#fff'},navy:{background:C.navy,color:'#fff'}}
  return <button style={{...base,...V[variant]}} onClick={onClick} disabled={disabled}>{children}</button>
}
function Card({ children, style:sx={}, onClick }) {
  return <div onClick={onClick} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',margin:'0 16px 10px',overflow:'hidden',cursor:onClick?'pointer':'default',...sx}}>{children}</div>
}
function SecLabel({ children }) {
  return <div style={{fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.9px',color:C.textMuted,padding:'16px 16px 8px'}}>{children}</div>
}
function Toggle({ checked=false, onChange, disabled=false }) {
  const __theme = useContext(ThemeContext)
  const [on,setOn]=useState(checked)
  useEffect(() => { setOn(checked) }, [checked])
  return <div onClick={()=>{if(disabled)return;setOn(!on);onChange&&onChange(!on)}} style={{width:34,height:18,borderRadius:20,background:on?__theme.accent:C.border,cursor:disabled?'default':'pointer',opacity:disabled?0.6:1,position:'relative',transition:'background 0.2s',flexShrink:0}}><div style={{position:'absolute',top:2,left:on?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/></div>
}
function Badge({ text, type }) {
  const __theme = useContext(ThemeContext)
  const map={ok:[__theme.accentLight,__theme.accent],due:[C.amberLight,C.amber],full:[C.redLight,C.red]}
  const [bg,fg]=map[type]||map.ok
  return <span style={{fontSize:'10px',background:bg,color:fg,padding:'3px 9px',borderRadius:'20px',fontWeight:500,whiteSpace:'nowrap'}}>{text}</span>
}

// ── EMERGENCY CARD SETUP + CONSENT FLOW ──────────────────────────────────────
// This is shown to PATIENTS only for setup/consent — not for showing to EMS.
// EMS access the emergency card automatically via QR scan in the practitioner portal.
function EmergencyCardSetup({ open, onClose, consented, onConsent, liveConditions=[], liveAllergies=[], liveMedications=[], patient }) {
  const __theme = useContext(ThemeContext)
  const p = patient
  const [step, setStep] = useState(consented ? 'view' : 'intro')
  if (!open) return null
  if (!p) return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:'16px',padding:'24px',maxWidth:320,textAlign:'center',fontSize:'13px',color:C.textMuted}}>
        Patient data isn't loaded yet - try again in a moment.
      </div>
    </div>
  )
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:440,padding:'24px',maxHeight:'90vh',overflowY:'auto'}}>

        {/* Step 1 — intro / not yet consented */}
        {step==='intro'&&<>
          <div style={{textAlign:'center',marginBottom:'20px'}}>
            <div style={{fontSize:'36px',marginBottom:'10px'}}>🛡️</div>
            <div style={{fontSize:'18px',fontWeight:700,color:C.text,marginBottom:'6px'}}>Emergency health card</div>
            <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>When activated, verified emergency personnel can instantly access your critical medical info by scanning your Medsa QR — even if you can't speak or respond.</div>
          </div>
          <div style={{background:__theme.accentXLight,border:`0.5px solid ${__theme.accentLight}`,borderRadius:'14px',padding:'16px',marginBottom:'16px'}}>
            <div style={{fontSize:'12px',fontWeight:600,color:__theme.accent,marginBottom:'10px'}}>What emergency personnel will see:</div>
            {['Blood type','Critical conditions','Severe allergies','Current medications','Emergency contact'].map((item,i)=>(
              <div key={i} style={{fontSize:'13px',color:C.text,padding:'4px 0',display:'flex',alignItems:'center',gap:'8px'}}><span style={{color:__theme.accent,fontSize:'10px'}}>✓</span>{item}</div>
            ))}
          </div>
          <div style={{background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',marginBottom:'16px',fontSize:'12px',color:C.brown,lineHeight:1.6}}>
            ◇ This information is auto-populated from your verified medical records and updates automatically. You cannot selectively hide fields — this ensures accuracy in a life-critical moment. You can deactivate the card at any time.
          </div>
          <Btn variant="primary" style={{width:'100%',marginBottom:'8px',padding:'14px'}} onClick={()=>setStep('consent')}>Set up my emergency card</Btn>
          <Btn style={{width:'100%'}} onClick={onClose}>Not now</Btn>
        </>}

        {/* Step 2 — consent */}
        {step==='consent'&&<>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'16px'}}>One-time consent</div>
          <div style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'16px',marginBottom:'16px',fontSize:'13px',color:C.text,lineHeight:1.8}}>
            I, <strong>{p.full_name}</strong>, consent to Medsa making my critical medical information accessible to verified emergency medical personnel (EMS, A&E staff, and Medsa-registered practitioners in an emergency context) via QR scan.<br/><br/>
            I understand that:<br/>
            · This information is sourced from my verified medical records<br/>
            · It updates automatically as my records are updated<br/>
            · I cannot selectively withhold fields from the emergency card<br/>
            · I can deactivate this consent at any time from Settings<br/>
            · Medsa is not liable for information on any physical card I self-complete
          </div>
          <Btn variant="primary" style={{width:'100%',marginBottom:'8px',padding:'14px'}} onClick={()=>{onConsent();setStep('view')}}>I agree — activate my emergency card</Btn>
          <Btn style={{width:'100%'}} onClick={()=>setStep('intro')}>Back</Btn>
        </>}

        {/* Step 3 — active card view (for patient reference) */}
        {step==='view'&&<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <div>
              <div style={{fontSize:'17px',fontWeight:700}}>Emergency card</div>
              <div style={{fontSize:'12px',color:__theme.accent,marginTop:'2px'}}>● Active · Auto-updating from records</div>
            </div>
            <span style={{fontSize:'10px',background:__theme.accentLight,color:__theme.accent,padding:'3px 10px',borderRadius:'20px',fontWeight:600}}>Consented ✓</span>
          </div>
          <div style={{background:C.redLight,border:`1px solid ${C.red}`,borderRadius:'14px',padding:'16px',marginBottom:'14px'}}>
            <div style={{fontSize:'13px',color:C.red,fontWeight:600,marginBottom:'10px',textTransform:'uppercase',letterSpacing:'0.5px'}}>What EMS sees on scan</div>
            <div style={{fontSize:'16px',fontWeight:700,marginBottom:'2px'}}>{p.full_name}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>DOB {new Date(p.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} · {p.medsa_id}</div>
            <div style={{display:'flex',gap:'10px',marginBottom:'12px'}}>
              <div style={{flex:1,background:'rgba(192,57,43,0.12)',borderRadius:'10px',padding:'10px',textAlign:'center'}}>
                <div style={{fontSize:'10px',color:C.red}}>Blood type</div>
                <div style={{fontSize:'28px',fontWeight:800,color:C.red}}>{p.blood_type}</div>
              </div>
              <div style={{flex:2,background:'rgba(192,57,43,0.12)',borderRadius:'10px',padding:'10px'}}>
                <div style={{fontSize:'10px',color:C.red,marginBottom:'4px'}}>Emergency contact</div>
                <div style={{fontSize:'13px',fontWeight:600}}>{p.emergency_contact_name ? `${p.emergency_contact_name} (${p.emergency_contact_rel||'Contact'})` : 'Not set yet'}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{p.emergency_contact_phone || 'Add one in your profile'}</div>
              </div>
            </div>
            {liveConditions.length>0
              ? liveConditions.map((c,i)=>(
                  <div key={i} style={{fontSize:'13px',fontWeight:500,padding:'4px 0',borderTop:i===0?`0.5px solid rgba(192,57,43,0.2)`:undefined}}>◎ {c.condition_name}{c.severity?` (${c.severity})`:''}</div>
                ))
              : <div style={{fontSize:'12px',color:C.textSub,padding:'4px 0'}}>No active conditions on file</div>}
            <div style={{borderTop:`0.5px solid rgba(192,57,43,0.2)`,marginTop:'8px',paddingTop:'8px'}}>
              {liveAllergies.length>0
                ? liveAllergies.map((a,i)=>(
                    <div key={i} style={{padding:'3px 0',display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
                      <span style={{fontSize:'13px',fontWeight:700,color:C.red}}>⚠ {a.allergen}{a.severity?` — ${a.severity}`:''}</span>
                      {a.reported_by==='patient_reported'&&<span style={{fontSize:'9px',padding:'1px 6px',borderRadius:'20px',background:'rgba(212,160,23,0.15)',color:C.amber,fontWeight:600}}>Self-reported</span>}
                    </div>
                  ))
                : <div style={{fontSize:'12px',color:C.textSub,padding:'3px 0'}}>No known allergies on file</div>}
            </div>
            <div style={{borderTop:`0.5px solid rgba(192,57,43,0.2)`,marginTop:'8px',paddingTop:'8px'}}>
              {liveMedications.length>0
                ? liveMedications.map((m,i)=>(
                    <div key={i} style={{fontSize:'12px',color:C.textSub,padding:'2px 0'}}>◉ {m.medication_name}{m.dosage?` ${m.dosage}`:''}{m.frequency?` — ${m.frequency}`:''}</div>
                  ))
                : <div style={{fontSize:'12px',color:C.textSub,padding:'2px 0'}}>No current medications on file</div>}
            </div>
          </div>
          <div style={{background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',marginBottom:'14px',fontSize:'12px',color:C.brown,lineHeight:1.5}}>
            ◇ <strong>Physical card:</strong> Medsa provides a blank courtesy card with your QR pre-printed. Fill in fields by hand from the information above. Keep it in your wallet. Note: you are responsible for keeping the handwritten fields accurate. Scanning the QR always retrieves live verified data.
          </div>
          <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
            <button onClick={()=>alert('Add your Medsa Emergency Card to Apple Wallet — coming in Phase 3.')} style={{flex:1,border:'none',borderRadius:'10px',padding:'11px',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',background:'#000',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="white"><path d="M11.5 0C9.6 0 8.8 1 7.5 1 6.2 1 5.2 0 3.5 0 1.6 0 0 1.7 0 4.2c0 3.8 3.2 8.8 5.5 8.8.8 0 1.4-.5 2-.5s1.3.5 2 .5C12 13 15 8.5 15 4.2 15 1.7 13.4 0 11.5 0zM7.5 2.5c-.1-1.2.9-2.3 1.5-2.5.1 1.2-.9 2.3-1.5 2.5z"/></svg>
              Apple Wallet
            </button>
            <button onClick={()=>alert('Add your Medsa Emergency Card to Google Wallet — coming in Phase 3.')} style={{flex:1,border:'0.5px solid #4285f4',borderRadius:'10px',padding:'11px',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',background:'#fff',color:'#4285f4',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#4285f4" strokeWidth="1.5"/><text x="8" y="12" textAnchor="middle" fontSize="9" fill="#4285f4" fontWeight="bold">G</text></svg>
              Google Wallet
            </button>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>alert('Request a physical courtesy card from Medsa — coming soon.')}>Request physical card</Btn>
            <Btn variant="danger" style={{flex:1,fontSize:'12px'}} onClick={()=>{onConsent(false);setStep('intro')}}>Deactivate card</Btn>
          </div>
          <Btn style={{width:'100%',marginTop:'8px'}} onClick={onClose}>Close</Btn>
        </>}
      </div>
    </div>
  )
}

// ── PULL TO REFRESH — real touch gesture, not a library ─────────────────────
function PullToRefresh({ onRefresh, children }) {
  const [pullDistance,setPullDistance]=useState(0)
  const [refreshing,setRefreshing]=useState(false)
  const startY = useRef(null)
  const dragging = useRef(false)
  const containerRef = useRef(null)
  const THRESHOLD = 70

  function start(clientY) {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = clientY
      dragging.current = true
    }
  }
  function move(clientY) {
    if (startY.current === null || refreshing || !dragging.current) return
    const delta = clientY - startY.current
    if (delta > 0 && containerRef.current && containerRef.current.scrollTop === 0) {
      setPullDistance(Math.min(delta * 0.5, 100))
    }
  }
  async function end() {
    if (!dragging.current) return
    dragging.current = false
    if (pullDistance > THRESHOLD && !refreshing) {
      setRefreshing(true)
      await onRefresh()
      setRefreshing(false)
    }
    setPullDistance(0)
    startY.current = null
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={e=>start(e.touches[0].clientY)}
      onTouchMove={e=>move(e.touches[0].clientY)}
      onTouchEnd={end}
      onMouseDown={e=>start(e.clientY)}
      onMouseMove={e=>move(e.clientY)}
      onMouseUp={end}
      onMouseLeave={end}
      style={{overflowY:'auto',height:'100%',position:'relative',cursor:pullDistance>0?'grabbing':'default'}}
    >
      <div style={{height: refreshing?50:pullDistance, transition: pullDistance===0?'height 0.2s':'none', display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
        <div style={{fontSize:'11px',color:C.textMuted}}>
          {refreshing ? '⟳ Refreshing…' : pullDistance>THRESHOLD ? '↓ Release to refresh' : pullDistance>10 ? '↓ Pull to refresh' : ''}
        </div>
      </div>
      {children}
    </div>
  )
}

function HomeScreen({ onNav, onOpenInquiry, isEn, onOpenEmergencySetup, onOpenShare, onOpenSignUp, emergencyConsented, patient={}, appointments=[], claims=[], onRefreshData, themeAccent=C.green, themeAccentMid=C.greenMid, themeAccentLight=C.greenLight, themeAccentXLight=C.greenXLight, bumpActive=false }) {
  // Live queue position - reads from the real `clinic_queue` table that
  // ClinicOpsApp writes to on check-in, so this updates the moment front
  // desk checks the patient in, and clears once their status is no longer
  // waiting/in_room.
  const [queueStatus,setQueueStatus]=useState({ checkedIn:false })
  const [manualRefreshing,setManualRefreshing]=useState(false)
  const [doctorMessages,setDoctorMessages]=useState([])
  const [messagesLoading,setMessagesLoading]=useState(true)
  const [openThread,setOpenThread]=useState(null) // array of messages in one conversation, shown in a modal
  const [homePatientId,setHomePatientId]=useState(null)
  const [replyBody,setReplyBody]=useState('')
  const [replying,setReplying]=useState(false)
  const [replyError,setReplyError]=useState(null)
  const [carouselItems,setCarouselItems]=useState([])
  const [openCarouselItem,setOpenCarouselItem]=useState(null)
  const [carouselIndex,setCarouselIndex]=useState(0)
  const carouselScrollRef=useRef(null)
  // The MCHC reminder (bb-02) only ever showed inside the Kids growth
  // screen's own tab - easy to miss since you have to go looking for it.
  // Fetched here too so it surfaces on Home like the clinic appointment
  // reminder below does.
  const [nextMchcAppt,setNextMchcAppt]=useState(null)
  useEffect(() => {
    if (!patient?.id) { setNextMchcAppt(null); return }
    supabase.from('kids_mchc_appointments').select('*').eq('patient_id', patient.id)
      .gt('appointment_at', new Date(Date.now() - 24*60*60*1000).toISOString())
      .order('appointment_at', { ascending: true }).limit(1).maybeSingle()
      .then(({ data }) => setNextMchcAppt(data || null))
  }, [patient?.id])
  function handleCarouselScroll(e) {
    const el = e.target
    const cardWidth = el.firstChild ? el.firstChild.offsetWidth + 10 : 1
    setCarouselIndex(Math.round(el.scrollLeft / cardWidth))
  }

  useEffect(() => {
    async function loadCarousel() {
      const now = new Date().toISOString()
      const { data } = await supabase.from('home_carousel_items').select('*')
        .eq('active', true).order('display_order')
      // Scheduling window checked client-side, not in the query - keeps
      // this simple to read and the table is small (a handful of cards,
      // not thousands of rows).
      setCarouselItems((data||[]).filter(c => (!c.starts_at || c.starts_at <= now) && (!c.ends_at || c.ends_at >= now)))
    }
    loadCarousel()
  }, [])

  function msgThreadKey(m) { return m.thread_id || m.id }

  async function loadDoctorMessages() {
    setMessagesLoading(true)
    const medsaId = patient?.medsa_id
    if (!medsaId) { setMessagesLoading(false); return [] }
    const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
    if (!patientRow) { setMessagesLoading(false); return [] }
    setHomePatientId(patientRow.id)
    // Only load messages from the last 90 days - older ones are cleaned up
    // by a scheduled job (see schema_message_expiry.sql) so this doesn't
    // grow unbounded in storage.
    const cutoff = new Date(Date.now() - 90*24*60*60*1000).toISOString()
    const { data } = await supabase.from('patient_messages').select('*').eq('patient_id', patientRow.id).gte('created_at', cutoff).order('created_at',{ascending:false})
    setDoctorMessages(data||[])
    setMessagesLoading(false)
    return data||[]
  }

  useEffect(() => { loadDoctorMessages() }, [patient?.medsa_id])

  // Unread messages on the patient's own insurance inquiries (agent or
  // underwriter replies) - same shared inquiry_messages thread the My
  // Inquiries tab reads/writes, surfaced here too so a reply doesn't sit
  // invisible until the patient happens to reopen that specific inquiry.
  const [inquiryThreadsUnread,setInquiryThreadsUnread]=useState([]) // [{inquiryId, planName, companyName, count, preview}]
  async function loadInquiryMessageSummary(patientRowId) {
    if (!patientRowId) return
    const { data: myInquiries } = await supabase.from('plan_inquiries')
      .select('id, insurance_plans(plan_name, company_name)').eq('patient_id', patientRowId)
    const ids = (myInquiries||[]).map(i=>i.id)
    if (ids.length===0) { setInquiryThreadsUnread([]); return }
    const { data: unreadMsgs } = await supabase.from('inquiry_messages').select('inquiry_id, body, attachment_name, created_at')
      .in('inquiry_id', ids).eq('read_by_patient', false).order('created_at',{ascending:true})
    const byInquiry = {}
    for (const m of (unreadMsgs||[])) {
      if (!byInquiry[m.inquiry_id]) byInquiry[m.inquiry_id] = { count: 0, preview: null }
      byInquiry[m.inquiry_id].count += 1
      byInquiry[m.inquiry_id].preview = m.body || (m.attachment_name ? `📎 ${m.attachment_name}` : '')
    }
    const planById = Object.fromEntries((myInquiries||[]).map(i=>[i.id, i.insurance_plans]))
    setInquiryThreadsUnread(Object.entries(byInquiry).map(([inquiryId, v]) => ({
      inquiryId, count: v.count, preview: v.preview,
      planName: planById[inquiryId]?.plan_name, companyName: planById[inquiryId]?.company_name,
    })))
  }
  const inquiryUnreadTotal = inquiryThreadsUnread.reduce((sum,t)=>sum+t.count, 0)

  // One entry per conversation, latest message first - this feeds both the
  // message board list and the urgent banner at the top.
  const doctorThreadsLatestFirst = Object.values(
    doctorMessages.reduce((acc,m)=>{
      const key = msgThreadKey(m)
      if (!acc[key] || new Date(m.created_at) > new Date(acc[key].created_at)) acc[key] = m
      return acc
    }, {})
  ).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))

  const urgentMessages = doctorThreadsLatestFirst.filter(m=>m.urgent && !m.read_by_patient)

  useEffect(() => { loadInquiryMessageSummary(homePatientId) }, [homePatientId])

  function getThreadFrom(list, m) {
    const key = msgThreadKey(m)
    return list.filter(x=>msgThreadKey(x)===key).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
  }

  async function handleOpenDoctorMsg(m) {
    const thread = getThreadFrom(doctorMessages, m)
    setOpenThread(thread)
    const unreadIds = thread.filter(x=>!x.read_by_patient).map(x=>x.id)
    if (unreadIds.length>0) {
      await supabase.from('patient_messages').update({ read_by_patient: true }).in('id', unreadIds)
      setDoctorMessages(prev=>prev.map(x=>unreadIds.includes(x.id)?{...x,read_by_patient:true}:x))
    }
  }

  async function handleReplyToDoctor() {
    if (!replyBody.trim() || !openThread) return
    setReplying(true)
    setReplyError(null)
    const rootMsg = openThread[0]
    const { error: insErr } = await supabase.from('patient_messages').insert({
      patient_id: homePatientId,
      doctor_name: rootMsg.doctor_name,
      body: replyBody,
      sender_type: 'patient',
      thread_id: msgThreadKey(rootMsg),
      read_by_patient: true,
    })
    setReplying(false)
    if (insErr) { setReplyError(insErr.message); return }
    setReplyBody('')
    const fresh = await loadDoctorMessages()
    setOpenThread(getThreadFrom(fresh, rootMsg))
  }

  async function handleDeleteOwnReply(id) {
    // Patients can only delete their own replies, never the doctor's
    // original message, since that may be clinically important to keep.
    await supabase.from('patient_messages').delete().eq('id', id).eq('sender_type', 'patient')
    const fresh = await loadDoctorMessages()
    if (openThread) {
      const remaining = getThreadFrom(fresh, openThread[0])
      setOpenThread(remaining.length>0 ? remaining : null)
    }
  }

  async function handleDeleteConversation(m) {
    // Unlike the single-message delete, this removes the whole thread -
    // the doctor's messages included - since deleting "this row" on the
    // board is naturally understood as deleting the whole conversation.
    const thread = getThreadFrom(doctorMessages, m)
    await supabase.from('patient_messages').delete().in('id', thread.map(x=>x.id))
    loadDoctorMessages()
    if (openThread && msgThreadKey(openThread[0])===msgThreadKey(m)) setOpenThread(null)
  }

  async function loadQueueStatus() {
    const medsaId = patient?.medsa_id
    if (!medsaId) return
    const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
    if (!patientRow) return

    // 'in_room' was never a real clinic_queue status (ClinicOps only ever
    // writes waiting/serving/done/no_show) - this meant the moment a
    // patient was actually called in (status flips to 'serving'), this
    // query found nothing and the whole banner silently vanished instead
    // of showing they're now being seen.
    //
    // Also scoped to TODAY - there was no date bound here at all before,
    // so a queue ticket from a past day that never got explicitly marked
    // done/no_show (e.g. the doctor never submitted a consultation) kept
    // showing this patient as "checked in" and counting other patients
    // ahead of them forever, well past the day it actually happened.
    const dayStart = new Date(); dayStart.setHours(0,0,0,0)
    const dayEnd = new Date(); dayEnd.setHours(23,59,59,999)
    const { data: myEntry } = await supabase
      .from('clinic_queue')
      .select('*, institutions(name), appointments(scheduled_at)')
      .eq('patient_id', patientRow.id)
      .in('status', ['waiting','serving'])
      .gte('checked_in_at', dayStart.toISOString())
      .lte('checked_in_at', dayEnd.toISOString())
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!myEntry) { setQueueStatus({ checkedIn:false }); return }

    if (myEntry.status === 'serving') {
      setQueueStatus({
        checkedIn: true, beingSeen: true, position: 0,
        ticket: myEntry.ticket, clinic: myEntry.institutions?.name || 'Clinic', doctor: myEntry.doctor_name || 'Unassigned',
      })
      return
    }

    // Same rule ClinicOps's own queue board uses (queuePosition there) -
    // an on-time/early booked patient queues near their appointment time
    // rather than pure check-in order, so this doesn't disagree with what
    // front desk is actually looking at. Also scoped to this patient's
    // own queue only, not every other doctor's line at this clinic -
    // counting institution-wide is what made this show inflated numbers
    // once a clinic runs more than one queue.
    const myCheckedInAt = new Date(myEntry.checked_in_at).getTime()
    const myApptTime = myEntry.appointments?.scheduled_at ? new Date(myEntry.appointments.scheduled_at).getTime() : null
    const myPosition = (myApptTime && myCheckedInAt <= myApptTime) ? myApptTime : myCheckedInAt

    let othersQuery = supabase.from('clinic_queue').select('checked_in_at, appointments(scheduled_at)')
      .eq('status', 'waiting').neq('id', myEntry.id)
    othersQuery = myEntry.queue_id
      ? othersQuery.eq('queue_id', myEntry.queue_id)
      : othersQuery.eq('institution_id', myEntry.institution_id).is('queue_id', null)
    const { data: others } = await othersQuery

    const aheadCount = (others||[]).filter(o => {
      const oCheckedInAt = new Date(o.checked_in_at).getTime()
      const oApptTime = o.appointments?.scheduled_at ? new Date(o.appointments.scheduled_at).getTime() : null
      const oPosition = (oApptTime && oCheckedInAt <= oApptTime) ? oApptTime : oCheckedInAt
      return oPosition < myPosition
    }).length

    setQueueStatus({
      checkedIn: true, beingSeen: false,
      position: aheadCount,
      ticket: myEntry.ticket,
      clinic: myEntry.institutions?.name || 'Clinic',
      doctor: myEntry.doctor_name || 'Unassigned',
    })
  }

  useEffect(() => {
    loadQueueStatus()
    const interval = setInterval(loadQueueStatus, 30000) // refresh every 30s while on this screen
    return () => clearInterval(interval)
  }, [patient?.medsa_id])

  return (
    <PullToRefresh onRefresh={async ()=>{ await Promise.all([loadDoctorMessages(), loadQueueStatus(), onRefreshData?.()]) }}>
    <div style={{background:C.beige,flex:1,paddingBottom:'20px'}}>

      {/* A real, always-visible, clickable refresh - pull-to-refresh is
          a drag gesture that's unreliable on desktop/mouse and easy to
          miss even on touch. This works the same way every time,
          regardless of device. */}
      <div style={{display:'flex',justifyContent:'flex-end',padding:'10px 16px 0'}}>
        <div onClick={async()=>{ if(manualRefreshing) return; setManualRefreshing(true); await Promise.all([loadDoctorMessages(), loadQueueStatus(), onRefreshData?.()]); setManualRefreshing(false) }} style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'11px',color:C.textSub,cursor:'pointer'}}>
          <span style={{display:'inline-block',transition:'transform 0.5s',transform:manualRefreshing?'rotate(360deg)':'none'}}>{'⟳'}</span>
          {manualRefreshing?(isEn?'Refreshing…':'刷新中…'):(isEn?'Refresh':'刷新')}
        </div>
      </div>

      {/* ── Urgent doctor messages — most prominent alert on the home screen ── */}
      {urgentMessages.length>0&&(
        <div onClick={()=>handleOpenDoctorMsg(urgentMessages[0])} style={{margin:'14px 16px 0',background:C.red,borderRadius:'14px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer'}}>
          <span style={{fontSize:'20px'}}>⚠</span>
          <div style={{flex:1}}>
            <div style={{fontSize:'13px',fontWeight:700,color:'#fff'}}>{isEn?`${urgentMessages.length} urgent message${urgentMessages.length>1?'s':''} from your doctor`:`${urgentMessages.length}則來自醫生的緊急訊息`}</div>
            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)',marginTop:'2px'}}>{urgentMessages[0].doctor_name} · {urgentMessages[0].subject||urgentMessages[0].body}</div>
          </div>
          <span style={{color:'#fff',fontSize:'16px'}}>›</span>
        </div>
      )}

      {/* ── Live queue position — shown only while checked in at a clinic ── */}
      {queueStatus.checkedIn&&(
        <div style={{margin:'14px 16px 0',background:C.navy,borderRadius:'14px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{width:44,height:44,borderRadius:'12px',background:'rgba(255,255,255,0.15)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            {queueStatus.beingSeen
              ? <div style={{fontSize:'20px'}}>◉</div>
              : <><div style={{fontSize:'16px',fontWeight:800,color:'#fff',lineHeight:1}}>{queueStatus.position}</div><div style={{fontSize:'8px',color:'rgba(255,255,255,0.7)'}}>{isEn?'ahead':'位在前'}</div></>}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>{queueStatus.beingSeen ? (isEn?'You’re being seen now':'您正在接受診症') : (isEn?`${queueStatus.position} people ahead of you`:`您前面有${queueStatus.position}位`)}</div>
            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.7)',marginTop:'2px'}}>{queueStatus.ticket} · {queueStatus.clinic} · {queueStatus.doctor}</div>
          </div>
        </div>
      )}

      {/* ── Emergency card reminder banner (shown until consented) ── */}
      {!emergencyConsented&&(
        <div onClick={onOpenEmergencySetup} style={{margin:'14px 16px 0',background:`linear-gradient(135deg,${C.amber} 0%,#c87000 100%)`,borderRadius:'14px',padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{width:36,height:36,background:'rgba(255,255,255,0.2)',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0}}>🛡️</div>
          <div style={{flex:1}}>
            <div style={{fontSize:'13px',fontWeight:700,color:'#fff'}}>{isEn?'Set up your emergency card':'設置緊急健康卡'}</div>
            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)',marginTop:'2px'}}>{isEn?'Let verified EMS access your critical info instantly on scan':'讓緊急人員即時掃描獲取您的關鍵資訊'}</div>
          </div>
          <span style={{color:'rgba(255,255,255,0.8)',fontSize:'18px'}}>›</span>
        </div>
      )}

      {/* ── QR Health Passport — hero element ── */}
      <div onClick={()=>onNav('editprofile')} style={{margin:'14px 16px 0',background:`linear-gradient(135deg,${themeAccent} 0%,${themeAccentMid} 100%)`,borderRadius:'16px',padding:'20px',cursor:'pointer'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}}>
          <div>
            <div style={{fontSize:'17px',fontWeight:500,color:'#fff'}}>{isEn?`Good morning, ${patient?.preferred_name || patient?.full_name?.split(',')[1]?.trim() || patient?.full_name?.split(' ')[0] || 'there'}`:`早晨，${patient?.preferred_name || patient?.full_name || ''}`}</div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.8)',marginTop:'2px'}}>{isEn?'Your health passport':'您的健康護照'}</div>
            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.6)',marginTop:'6px',letterSpacing:'1px'}}>{patient?.medsa_id||'—'} · Verified ✓</div>
            {onOpenSignUp&&<div onClick={(e)=>{e.stopPropagation();onOpenSignUp()}} style={{fontSize:'10px',color:'rgba(255,255,255,0.7)',marginTop:'6px',textDecoration:'underline',cursor:'pointer'}}>{isEn?'Not you? Claim or register a profile':'不是您？認領或註冊個人檔案'}</div>}
          </div>
          {/* Emergency card status badge */}
          <div onClick={(e)=>{e.stopPropagation();onOpenEmergencySetup()}} style={{cursor:'pointer'}}>
            {emergencyConsented
              ?<span style={{fontSize:'10px',background:'rgba(255,255,255,0.2)',color:'#fff',padding:'4px 10px',borderRadius:'20px',fontWeight:600,display:'flex',alignItems:'center',gap:'4px'}}><span style={{width:6,height:6,borderRadius:'50%',background:'#7fff7f',display:'inline-block'}}/>Emergency card ✓</span>
              :<span style={{fontSize:'10px',background:'rgba(255,180,0,0.3)',color:'#ffe066',padding:'4px 10px',borderRadius:'20px',fontWeight:600}}>Emergency card — set up ›</span>
            }
          </div>
        </div>
        {/* QR Code — large and centred, the hero */}
        <div style={{background:'#fff',borderRadius:'14px',padding:'20px',display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'}}>
          <svg width="140" height="140" viewBox="0 0 48 48" fill="none">
            <rect x="2" y="2" width="18" height="18" rx="2" fill={themeAccent}/><rect x="6" y="6" width="10" height="10" rx="1" fill="white"/>
            <rect x="28" y="2" width="18" height="18" rx="2" fill={themeAccent}/><rect x="32" y="6" width="10" height="10" rx="1" fill="white"/>
            <rect x="2" y="28" width="18" height="18" rx="2" fill={themeAccent}/><rect x="6" y="32" width="10" height="10" rx="1" fill="white"/>
            <rect x="28" y="28" width="4" height="4" fill={themeAccent}/><rect x="34" y="28" width="4" height="4" fill={themeAccent}/>
            <rect x="40" y="28" width="6" height="4" fill={themeAccent}/><rect x="28" y="34" width="6" height="4" fill={themeAccent}/>
            <rect x="36" y="34" width="4" height="4" fill={themeAccent}/><rect x="28" y="40" width="4" height="6" fill={themeAccent}/>
            <rect x="34" y="42" width="12" height="4" fill={themeAccent}/>
          </svg>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'12px',fontWeight:600,color:C.text}}>{isEn?'Show this to any Medsa-registered provider':'向任何Medsa註冊醫療人員出示'}</div>
            <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{isEn?'They see what their role permits · You control the rest':'他們只看到其職責所允許的內容'}</div>
          </div>
        </div>
      </div>
      <div onClick={onOpenShare} style={{margin:'10px 16px 0',background:C.card,borderRadius:'12px',padding:'12px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:'10px'}}>
        <span style={{fontSize:'16px',color:C.textSub}}>{'\u25c7'}</span>
        <div style={{flex:1}}>
          <div style={{fontSize:'12px',fontWeight:600}}>{isEn?'Share for this visit':'為此次診症分享'}</div>
          <div style={{fontSize:'11px',color:C.textMuted}}>{isEn?"For a clinic that doesn't use Medsa - choose what to share":'為未使用Medsa的診所選擇分享內容'}</div>
        </div>
        <span style={{color:C.textMuted,fontSize:'14px'}}>{'\u203a'}</span>
      </div>

{carouselItems.length>0&&<div style={{margin:'14px 0 0'}}>
  <div ref={carouselScrollRef} onScroll={handleCarouselScroll} style={{overflowX:'auto',display:'flex',gap:'10px',padding:'0 16px',scrollSnapType:'x mandatory'}}>
    {carouselItems.map(item=>(
      // Tapping always opens the in-app article now - an outbound link
      // is a call-to-action button inside that article, not something
      // that yanks you out of the app the instant you tap the card.
      <div key={item.id} onClick={()=>setOpenCarouselItem(item)}
        style={{flex:'0 0 82%',maxWidth:280,scrollSnapAlign:'start',cursor:'pointer',borderRadius:'14px',overflow:'hidden',background:C.cream,border:`0.5px solid ${C.border}`}}>
        {item.image_url&&<img src={item.image_url} alt="" style={{width:'100%',height:110,objectFit:'cover',display:'block'}}/>}
        <div style={{padding:'12px 14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
            <span style={{fontSize:'9px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',color:item.item_type==='ad'?C.amber:themeAccent}}>{item.item_type==='ad'?(item.sponsor_name?`Sponsored · ${item.sponsor_name}`:'Sponsored'):'Newsletter'}</span>
          </div>
          <div style={{fontSize:'13px',fontWeight:600,marginBottom:'2px'}}>{item.title}</div>
          {item.subtitle&&<div style={{fontSize:'11px',color:C.textSub,lineHeight:1.4}}>{item.subtitle}</div>}
        </div>
      </div>
    ))}
  </div>
  {/* Scroll-position dots - the card width leaves a deliberate peek of
      the next card, but a swipeable row with no indicator at all still
      reads as "only however many fit on screen," not "swipe for more." */}
  {carouselItems.length>1&&<div style={{display:'flex',justifyContent:'center',gap:'5px',marginTop:'8px'}}>
    {carouselItems.map((item,i)=>(
      <div key={item.id} style={{width:6,height:6,borderRadius:'50%',background:i===carouselIndex?themeAccent:C.border}}/>
    ))}
  </div>}
</div>}

      <SecLabel>{isEn?'Your health':'您的健康'}</SecLabel>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',padding:'0 16px'}}>
        {[
          {key:'records',icon:'records',label:isEn?'Medical records':'醫療記錄',sub:isEn?'History, vaccinations, share':'病歷、疫苗、分享',bg:themeAccentLight,badge:null},
          {key:'insurance',icon:'insurance',label:isEn?'Insurance':'保險',sub:isEn?'Plans, claims, agents':'計劃、索賠、代理人',bg:themeAccentLight,badge:inquiryUnreadTotal>0?String(inquiryUnreadTotal):null},
          {key:'prescriptions',icon:'prescriptions',label:isEn?'Prescriptions':'處方',sub:isEn?'Meds, drug info':'藥物、資訊',bg:themeAccentLight,badge:null},
          {key:'calendar',icon:'calendar',label:isEn?'Calendar':'日曆',sub:isEn?'Appointments, alarms':'預約、提醒',bg:themeAccentLight,badge:'1'},
          // Only shown while switched into a child dependent's own profile -
          // growth/feeding tracking (and the Blue-Book-style combined
          // record below) doesn't make sense on the adult account or a
          // non-child dependent.
          ...(patient?.account_type==='kids' && (patient?.dependent_relationship==null||patient?.dependent_relationship==='child') ? [
            {key:'kidsgrowth',icon:'growth',label:isEn?'Growth & feeding':'生長與餵養',sub:isEn?'Weight, height, milk log':'體重、身高、餵奶記錄',bg:themeAccentLight,badge:null},
          ] : []),
          // Only shown while Bump is active on the main account - never
          // makes sense on a dependent profile (never pregnant, same
          // reasoning as the pink theme itself).
          ...(bumpActive ? [
            {key:'bumphealth',icon:'pulse',label:isEn?'Pregnancy health log':'孕期健康記錄',sub:isEn?'Blood pressure, glucose, kicks':'血壓、血糖、胎動',bg:themeAccentLight,badge:null},
            {key:'bumpcohort',icon:'family',label:isEn?'Birth club':'待產小組',sub:isEn?'Chat with your due-month cohort':'與同月預產家長交流',bg:themeAccentLight,badge:null},
          ] : []),
        ].map(item=>(
          <div key={item.key} onClick={()=>onNav(item.key)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'16px',cursor:'pointer',position:'relative'}}>
            <div style={{width:36,height:36,background:item.bg,borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'10px',color:themeAccent}}><Icon name={item.icon}/></div>
            <div style={{fontSize:'13px',fontWeight:500,marginBottom:'3px'}}>{item.label}</div>
            <div style={{fontSize:'11px',color:C.textSub,lineHeight:1.4}}>{item.sub}</div>
            {item.badge&&<span style={{position:'absolute',top:10,right:10,background:C.red,color:'#fff',fontSize:'10px',width:18,height:18,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>{item.badge}</span>}
          </div>
        ))}
      </div>
      {/* Community bubble - pulled out of the list below into its own
          floating pill so it's not missed the way it was buried as just
          another row. Not shown on a Kids profile - your call, a product-
          review board for adult supplements/products isn't relevant on a
          child's own profile. */}
      {!(patient?.account_type==='kids' && (patient?.dependent_relationship==null||patient?.dependent_relationship==='child')) && <div style={{padding:'4px 16px 4px'}}>
        <div onClick={()=>onNav('forum')} style={{background:`linear-gradient(135deg, ${themeAccent} 0%, ${themeAccentMid} 100%)`,borderRadius:'999px',padding:'14px 20px',cursor:'pointer',display:'flex',alignItems:'center',gap:'12px',boxShadow:'0 4px 14px rgba(0,0,0,0.18)'}}>
          <div style={{width:38,height:38,background:'rgba(255,255,255,0.2)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',flexShrink:0}}><Icon name="community"/></div>
          <div style={{flex:1}}>
            <div style={{fontSize:'14px',fontWeight:700,color:'#fff'}}>{isEn?'Community':'社群'}</div>
            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)'}}>{isEn?'Discuss supplements & products, anonymously':'匿名討論保健品與產品'}</div>
          </div>
          <span style={{color:'#fff',fontSize:'18px'}}>›</span>
        </div>
      </div>}
      <SecLabel>{isEn?'Find care & manage':'尋找醫療'}</SecLabel>
      <div style={{padding:'0 16px'}}>
        {[
          {key:'doctors',icon:'doctors',bg:themeAccentLight,label:isEn?'Doctors & clinics':'醫生與診所',sub:isEn?'Search, book, pay':'搜索、預約、付款'},
          {key:'editprofile',icon:'alert',bg:themeAccentLight,label:isEn?'Emergency contact & allergies':'緊急聯絡人與過敏',sub:isEn?'Edit your info':'編輯您的資料'},
        ].map(item=>(
          <div key={item.key} onClick={()=>onNav(item.key)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:'14px',marginBottom:'10px'}}>
            <div style={{width:40,height:40,background:item.bg,borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',color:themeAccent,flexShrink:0}}><Icon name={item.icon}/></div>
            <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{item.label}</div><div style={{fontSize:'12px',color:C.textSub}}>{item.sub}</div></div>
            <span style={{color:C.textMuted,fontSize:'18px'}}>›</span>
          </div>
        ))}
      </div>
      <SecLabel>{isEn?'Message board':'訊息板'}</SecLabel>
      <Card>
        <div style={{background:themeAccentXLight,padding:'10px 14px',borderBottom:`0.5px solid ${C.border}`,fontSize:'13px',fontWeight:500,color:themeAccent}}>◈ {isEn?'Alerts & updates':'警報與更新'}</div>
        {(() => {
          const realAlerts = []
          // Real upcoming appointment reminder - within the next 48 hours,
          // replacing a hardcoded "Dr Chan, Room 3B" that showed for every
          // patient regardless of what was actually scheduled.
          const soon = appointments.find(a => {
            const t = new Date(a.scheduled_at).getTime()
            return t > Date.now() && t < Date.now() + 48*60*60*1000 && a.status !== 'cancelled'
          })
          if (soon) realAlerts.push({
            dot:'#d4a017',
            title: isEn?`Reminder: Dr ${soon.doctor_name||'—'} — ${new Date(soon.scheduled_at).toLocaleString('en-HK',{weekday:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})}`:`提醒：${soon.doctor_name||'—'}醫生`,
            body: isEn?`${soon.department||'Clinic'} appointment.`:`${soon.department||'診所'}預約。`,
          })
          // MCHC reminder (bb-02) - same "upcoming within N days" shape as
          // the clinic appointment reminder above, surfaced here too so
          // it's not only visible from inside the Kids growth tab.
          if (nextMchcAppt && new Date(nextMchcAppt.appointment_at).getTime() - Date.now() < 7*24*60*60*1000) realAlerts.push({
            dot:C.amber,
            title: isEn?`MCHC appointment — ${new Date(nextMchcAppt.appointment_at).toLocaleString('en-HK',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})}`:`母嬰健康院預約 — ${new Date(nextMchcAppt.appointment_at).toLocaleString('zh-HK',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})}`,
            body: nextMchcAppt.note || (isEn?'Maternal and Child Health Centre visit.':'母嬰健康院就診。'),
          })
          // Real recently-approved/settled claim, replacing a hardcoded
          // fake claim number and dollar amount.
          const recentClaim = [...claims].filter(c=>['approved','settled'].includes(c.status))
            .sort((a,b)=>new Date(b.adjudicated_at||b.submitted_at)-new Date(a.adjudicated_at||a.submitted_at))[0]
          if (recentClaim) realAlerts.push({
            dot:themeAccent,
            title: isEn?'Insurance claim approved':'保險索賠已批准',
            body: isEn?`Claim ${recentClaim.claim_ref} — HK$${recentClaim.insurer_covered_amount||recentClaim.amount} approved.`:`索賠 ${recentClaim.claim_ref} 已批准。`,
          })
          // Flu advisory kept as genuinely non-patient-specific public
          // health content, not fake data about this specific patient.
          realAlerts.push({dot:C.red,title:isEn?'Flu season advisory':'流感季節公告',body:isEn?'HKDOH recommends vaccination before Oct 31.':'衞生署建議於10月31日前接種疫苗。'})
          return realAlerts
        })().map((m,i)=>(
          <div key={i} style={{padding:'10px 14px',borderBottom:`0.5px solid ${C.border}`,display:'flex',gap:'10px',alignItems:'flex-start'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:m.dot,marginTop:'5px',flexShrink:0}}/>
            <div><div style={{fontSize:'12px',fontWeight:500}}>{m.title}</div><div style={{fontSize:'11px',color:C.textSub,marginTop:'2px',lineHeight:1.4}}>{m.body}</div></div>
          </div>
        ))}
        <div style={{padding:'10px 14px',borderBottom:`0.5px solid ${C.border}`,fontSize:'13px',fontWeight:500,color:themeAccent}}>◉ {isEn?'Messages from your doctor':'醫生的訊息'}</div>
        {messagesLoading&&<div style={{padding:'14px',textAlign:'center',fontSize:'11px',color:C.textMuted}}>{isEn?'Loading…':'載入中…'}</div>}
        {!messagesLoading&&doctorThreadsLatestFirst.length===0&&<div style={{padding:'14px',textAlign:'center',fontSize:'11px',color:C.textMuted}}>{isEn?'No messages yet.':'暫無訊息。'}</div>}
        {doctorThreadsLatestFirst.map((m,i)=>(
          <div key={m.id} onClick={()=>handleOpenDoctorMsg(m)} style={{padding:'10px 14px',borderBottom:i<doctorThreadsLatestFirst.length-1?`0.5px solid ${C.border}`:'none',display:'flex',gap:'10px',alignItems:'flex-start',cursor:'pointer',background:m.urgent&&!m.read_by_patient?C.redLight:'transparent'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:m.urgent?C.red:(!m.read_by_patient?themeAccent:C.border),marginTop:'5px',flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                <span style={{fontSize:'12px',fontWeight:!m.read_by_patient?700:500}}>{m.doctor_name}</span>
                {m.urgent&&<span style={{fontSize:'8px',background:C.red,color:'#fff',padding:'1px 6px',borderRadius:'20px',fontWeight:700,textTransform:'uppercase'}}>Urgent</span>}
              </div>
              <div style={{fontSize:'11px',color:C.textSub,marginTop:'2px',lineHeight:1.4}}>{m.sender_type==='patient'?(isEn?'You: ':'您：')+m.body:(m.subject||m.body)}</div>
            </div>
            <span style={{fontSize:'10px',color:C.textMuted,flexShrink:0}}>{new Date(m.created_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})}</span>
            <span onClick={(e)=>{e.stopPropagation();handleDeleteConversation(m)}} style={{fontSize:'12px',color:C.textMuted,cursor:'pointer',flexShrink:0,marginLeft:'4px'}} title={isEn?'Delete conversation':'刪除對話'}>✕</span>
          </div>
        ))}
        {/* Real gap found live-testing: a reply from an agent or
            underwriter on an insurance inquiry (PatientInquiryThread,
            same shared inquiry_messages table) never showed anywhere on
            the home screen - only inside that one inquiry's own card in
            My Inquiries, which nothing here pointed to. Same
            dot/preview/tap-to-open pattern as the doctor messages above,
            tapping jumps straight into that inquiry's conversation. */}
        {inquiryThreadsUnread.length>0&&<>
          <div style={{padding:'10px 14px',borderBottom:`0.5px solid ${C.border}`,fontSize:'13px',fontWeight:500,color:themeAccent}}>◉ {isEn?'Messages about your applications':'關於您申請的訊息'}</div>
          {inquiryThreadsUnread.map((t,i)=>(
            <div key={t.inquiryId} onClick={()=>onOpenInquiry&&onOpenInquiry(t.inquiryId)} style={{padding:'10px 14px',borderBottom:i<inquiryThreadsUnread.length-1?`0.5px solid ${C.border}`:'none',display:'flex',gap:'10px',alignItems:'flex-start',cursor:'pointer'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:themeAccent,marginTop:'5px',flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:'12px',fontWeight:700}}>{t.planName||''}{t.companyName?` - ${t.companyName}`:''}</div>
                <div style={{fontSize:'11px',color:C.textSub,marginTop:'2px',lineHeight:1.4}}>{t.preview}</div>
              </div>
              <span style={{background:C.red,color:'#fff',fontSize:'10px',fontWeight:700,borderRadius:'10px',minWidth:18,height:18,padding:'0 5px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{t.count}</span>
            </div>
          ))}
        </>}
      </Card>
      <div style={{margin:'0 16px 16px',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'12px 14px',display:'flex',gap:'10px',alignItems:'center'}}>
        <span style={{color:C.brown}}>◇</span>
        <div>
          <div style={{fontSize:'12px',fontWeight:600,color:C.brown}}>{isEn?'You control your records':'您掌控自己的記錄'}</div>
          <div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>{isEn?'Choose what each provider sees — anytime.':'隨時選擇每位醫療提供者可查看的內容。'}</div>
        </div>
      </div>

      {openThread&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={()=>setOpenThread(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:440,padding:'20px',maxHeight:'85vh',overflowY:'auto'}}>
            <div onClick={()=>setOpenThread(null)} style={{fontSize:'12px',color:themeAccent,cursor:'pointer',marginBottom:'14px'}}>{isEn?'← Close':'← 關閉'}</div>
            {openThread.map((m)=>(
              <Card key={m.id} style={{padding:'14px 16px',marginBottom:'8px',background:m.sender_type==='patient'?themeAccentXLight:(m.urgent?C.redLight:'#fff')}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                    <span style={{fontSize:'13px',fontWeight:700}}>{m.sender_type==='patient'?(isEn?'You':'您'):m.doctor_name}</span>
                    {m.urgent&&<span style={{fontSize:'9px',background:C.red,color:'#fff',padding:'2px 7px',borderRadius:'20px',fontWeight:700,textTransform:'uppercase'}}>Urgent</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{fontSize:'11px',color:C.textMuted}}>{new Date(m.created_at).toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                    {m.sender_type==='patient'&&<span onClick={()=>handleDeleteOwnReply(m.id)} style={{fontSize:'12px',color:C.red,cursor:'pointer'}} title={isEn?'Delete your reply':'刪除您的回覆'}>✕</span>}
                  </div>
                </div>
                {m.subject&&<div style={{fontSize:'13px',fontWeight:600,marginBottom:'6px'}}>{m.subject}</div>}
                <div style={{fontSize:'13px',color:C.text,lineHeight:1.6}}>{m.body}</div>
              </Card>
            ))}
            <Card style={{padding:'14px 16px'}}>
              <textarea value={replyBody} onChange={e=>setReplyBody(e.target.value)} rows={3} placeholder={isEn?'Write a reply…':'撰寫回覆…'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginBottom:'10px',boxSizing:'border-box'}}/>
              {replyError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'10px'}}>{replyError}</div>}
              <Btn variant="primary" style={{width:'100%'}} onClick={handleReplyToDoctor} disabled={replying}>{replying?(isEn?'Sending…':'傳送中…'):(isEn?'Send reply':'傳送回覆')}</Btn>
            </Card>
          </div>
        </div>
      )}

      {openCarouselItem&&(
        <CarouselArticleView item={openCarouselItem} allItems={carouselItems} isEn={isEn}
          onClose={()=>setOpenCarouselItem(null)} onOpenItem={setOpenCarouselItem}/>
      )}
    </div>
    </PullToRefresh>
  )
}

// Real article-style detail page for a carousel card - hero image, body
// text with images interspersed (content_blocks, one entry per paragraph
// or image, in the order the sponsor/admin arranged them), other cards
// woven in as small sponsored slots every couple of paragraphs, a CTA
// button for the outbound link (never an instant redirect on tap), and
// related cards by subtitle at the bottom. Falls back to the old flat
// `content` text field (split on blank lines into paragraphs) for any
// card created before content_blocks existed.
function CarouselArticleView({ item, allItems=[], isEn, onClose, onOpenItem }) {
  const __theme = useContext(ThemeContext)
  const blocks = item.content_blocks?.length > 0
    ? item.content_blocks
    : (item.content ? item.content.split(/\n\s*\n/).filter(Boolean).map(text=>({type:'paragraph',text})) : [])

  const others = allItems.filter(o=>o.id!==item.id)
  let paragraphCount = 0

  return (
    <div style={{position:'fixed',inset:0,background:C.beige,zIndex:300,overflowY:'auto'}}>
      <div style={{position:'sticky',top:0,background:C.beige,padding:'14px 16px',zIndex:1}}>
        <div onClick={onClose} style={{fontSize:'12px',color:__theme.accent,cursor:'pointer',fontWeight:600}}>{isEn?'← Back':'← 返回'}</div>
      </div>
      <div style={{maxWidth:520,margin:'0 auto',paddingBottom:'32px'}}>
        {item.image_url&&<img src={item.image_url} alt="" style={{width:'100%',height:220,objectFit:'cover',display:'block'}}/>}
        <div style={{padding:'0 16px'}}>
          <div style={{marginTop:'16px'}}>
            <span style={{fontSize:'10px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',color:item.item_type==='ad'?C.amber:__theme.accent}}>{item.item_type==='ad'?(item.sponsor_name?`Sponsored · ${item.sponsor_name}`:'Sponsored'):'Newsletter'}</span>
          </div>
          <div style={{fontSize:'22px',fontWeight:700,margin:'8px 0 4px',lineHeight:1.3}}>{item.title}</div>
          {item.subtitle&&<div style={{fontSize:'14px',color:C.textSub,marginBottom:'20px',lineHeight:1.5}}>{item.subtitle}</div>}

          {blocks.length===0&&<div style={{fontSize:'13px',color:C.textMuted,marginBottom:'20px'}}>{isEn?'No further content on this one yet.':'暫無更多內容。'}</div>}

          {blocks.map((blk,i)=>{
            const rendered = blk.type==='image'
              ? <img key={i} src={blk.url} alt="" style={{width:'100%',borderRadius:'12px',margin:'16px 0',display:'block'}}/>
              : <p key={i} style={{fontSize:'15px',color:C.text,lineHeight:1.8,margin:'0 0 16px'}}>{blk.text}</p>

            if (blk.type==='paragraph') paragraphCount++
            // A small sponsored slot every 2 paragraphs, pulled from
            // other live cards - swipeable if there's more than one to
            // show, same "slide to the next one" idea as the home feed.
            const showAdSlot = blk.type==='paragraph' && paragraphCount>0 && paragraphCount%2===0 && others.length>0
            const adSlotItems = showAdSlot ? others.slice(0, 3) : []

            return (
              <div key={i}>
                {rendered}
                {showAdSlot&&<div style={{margin:'4px 0 16px',overflowX:'auto',display:'flex',gap:'8px',scrollSnapType:'x mandatory'}}>
                  {adSlotItems.map(ad=>(
                    <div key={ad.id} onClick={()=>onOpenItem(ad)} style={{flex:'0 0 auto',width:180,scrollSnapAlign:'start',cursor:'pointer',borderRadius:'10px',overflow:'hidden',background:C.cream,border:`0.5px solid ${C.border}`}}>
                      {ad.image_url&&<img src={ad.image_url} alt="" style={{width:'100%',height:80,objectFit:'cover',display:'block'}}/>}
                      <div style={{padding:'8px 10px'}}>
                        <div style={{fontSize:'9px',fontWeight:700,color:C.amber,textTransform:'uppercase'}}>{ad.item_type==='ad'?'Sponsored':'Newsletter'}</div>
                        <div style={{fontSize:'12px',fontWeight:600,marginTop:'2px'}}>{ad.title}</div>
                      </div>
                    </div>
                  ))}
                </div>}
              </div>
            )
          })}

          {item.link_url&&<a href={item.link_url} target="_blank" rel="noopener noreferrer" style={{display:'block',textAlign:'center',padding:'13px',background:__theme.accent,color:'#fff',borderRadius:'10px',fontSize:'14px',fontWeight:600,textDecoration:'none',margin:'8px 0 28px'}}>{item.cta_label || (isEn?'Learn more':'了解更多')} ↗</a>}

          {others.length>0&&<>
            <div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>{isEn?'More from Medsa':'更多內容'}</div>
            {others.map(o=>(
              <div key={o.id} onClick={()=>onOpenItem(o)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',marginBottom:'8px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px'}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:600}}>{o.title}</div>
                  {o.subtitle&&<div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>{o.subtitle}</div>}
                </div>
                <span style={{color:C.textMuted,fontSize:'16px',flexShrink:0}}>›</span>
              </div>
            ))}
          </>}
        </div>
      </div>
    </div>
  )
}

// Shared PDF layout for a patient-downloaded record (single record or a
// bundle) - both the single "Download" button and "Download PDF" bundle
// export used to just stack plain doc.text() calls with no color, no
// header, no visual hierarchy at all (literally just "Label: value" on
// every line). One real design, reused by both, instead of two different
// bare-text layouts.
function drawPdfHeader(doc, pageWidth, subtitle) {
  const GREEN = [0,98,65]
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, pageWidth, 28, 'F')
  doc.setTextColor(255,255,255)
  doc.setFontSize(17); doc.setFont(undefined,'bold')
  doc.text('Medsa Health', 16, 14)
  doc.setFontSize(9); doc.setFont(undefined,'normal')
  doc.text(subtitle, 16, 21)
  doc.setTextColor(20,20,20)
}
function drawPdfFooter(doc, pageWidth, pageHeight) {
  const BORDER = [222,220,214], GRAY = [130,130,130]
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3)
  doc.line(16, pageHeight-14, pageWidth-16, pageHeight-14)
  doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(...GRAY)
  doc.text('Medsa Health · Patient-generated record', 16, pageHeight-9)
  doc.text(new Date().toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}), pageWidth-16, pageHeight-9, {align:'right'})
}
// Draws one record's card (title, institution/date, each detail field,
// and a highlighted receipt line if paid) starting at y, returning the
// y position just after it. Adds a page (with header/footer) if the
// card wouldn't fit.
function drawPdfRecordCard(doc, y, pageWidth, pageHeight, { title, dateInstitution, details, receiptText, subtitle, accentColor }) {
  const GREEN = accentColor || [0,98,65], GRAY = [120,120,120], INK = [26,26,26], BORDER = [224,222,216]
  const left = 16, right = pageWidth-16
  if (y > pageHeight - 40) { drawPdfFooter(doc, pageWidth, pageHeight); doc.addPage(); drawPdfHeader(doc, pageWidth, subtitle); y = 40 }
  doc.setFontSize(13); doc.setFont(undefined,'bold'); doc.setTextColor(...GREEN)
  doc.text(title || 'Consultation', left, y); y += 6
  doc.setFontSize(9.5); doc.setFont(undefined,'normal'); doc.setTextColor(...GRAY)
  doc.text(dateInstitution, left, y); y += 6
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3)
  doc.line(left, y, right, y); y += 7
  for (const [label, value] of details) {
    if (y > pageHeight - 30) { drawPdfFooter(doc, pageWidth, pageHeight); doc.addPage(); drawPdfHeader(doc, pageWidth, subtitle); y = 40 }
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(...GRAY)
    doc.text(label.toUpperCase(), left, y); y += 4.5
    doc.setFontSize(10); doc.setFont(undefined,'normal'); doc.setTextColor(...INK)
    const lines = doc.splitTextToSize(String(value||'—'), pageWidth-32)
    doc.text(lines, left, y); y += lines.length*5 + 3
  }
  if (receiptText) {
    doc.setFillColor(234,243,239)
    doc.roundedRect(left, y-4, right-left, 9, 1.5, 1.5, 'F')
    doc.setFontSize(9.5); doc.setFont(undefined,'bold'); doc.setTextColor(...GREEN)
    doc.text(receiptText, left+3, y+1.5)
    y += 12
  }
  y += 4
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3)
  doc.line(left, y, right, y)
  return y + 10
}

function RecordsScreen({ isEn, records=[], conditions=[], vaccinations=[], patient={}, transactions=[], onShareBundle, deepLinkRecordId=null, onConsumeDeepLink }) {
  const __theme = useContext(ThemeContext)
  const [bundleMode,setBundleMode]=useState(false)
  const [selectedIds,setSelectedIds]=useState(new Set())
  const [bundleFilter,setBundleFilter]=useState('')
  const [generatingPdf,setGeneratingPdf]=useState(false)
  const [accessRequests,setAccessRequests]=useState([])
  const [accessRequestsLoading,setAccessRequestsLoading]=useState(true)

  async function loadAccessRequests() {
    if (!patient?.id) { setAccessRequestsLoading(false); return }
    const { data } = await supabase.from('record_access_requests').select('*').eq('patient_id', patient.id).eq('status','pending').order('created_at',{ascending:false})
    setAccessRequests(data||[])
    setAccessRequestsLoading(false)
  }
  useEffect(() => { loadAccessRequests() }, [patient?.id])

  async function handleAccessDecision(req, approve) {
    await supabase.from('record_access_requests').update({ status: approve?'approved':'denied', resolved_at:new Date().toISOString() }).eq('id', req.id)
    setAccessRequests(prev=>prev.filter(r=>r.id!==req.id))
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAllMatching() {
    const q = bundleFilter.toLowerCase().trim()
    if (!q) return
    const matching = records.filter(r =>
      r.title?.toLowerCase().includes(q) || r.diagnosis?.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q))
    setSelectedIds(new Set(matching.map(r=>r.id)))
  }

  async function downloadBundle() {
    const selected = records.filter(r => selectedIds.has(r.id))
    if (selected.length === 0) return
    setGeneratingPdf(true)
    // jsPDF - real, client-side PDF generation. Requires `npm install
    // jspdf` if not already in the project.
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const subtitle = `${patient.full_name || ''} · ${patient.medsa_id || ''} · Record Bundle`
    drawPdfHeader(doc, pageWidth, subtitle)
    let y = 40

    for (const r of selected) {
      const receipt = transactions.find(t => t.medical_record_id === r.id)
      const details = [
        ...(r.diagnosis ? [['Diagnosis', r.diagnosis]] : []),
        ...(r.icd10_code ? [['ICD-10', r.icd10_code]] : []),
        ...(r.notes ? [['Notes', r.notes]] : []),
      ]
      y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
        title: r.title || 'Consultation',
        dateInstitution: `${r.date_of_record ? new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}) : ''} · ${r.institutions?.name || 'Medsa'}`,
        details,
        receiptText: receipt ? `Paid HK$${(receipt.patient_pays||0).toFixed(2)} via ${receipt.payment_method?.replace(/_/g,' ')} on ${new Date(receipt.created_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}` : null,
        subtitle,
      })
    }
    drawPdfFooter(doc, pageWidth, pageHeight)

    // Explicit blob + anchor download rather than jsPDF's built-in
    // save() shortcut - some mobile/in-app browsers mishandle that
    // shortcut's internals and save the file as plain text instead of
    // a real PDF. This forces the correct MIME type.
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Medsa-Record-Bundle-${patient.medsa_id || 'export'}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setGeneratingPdf(false)
  }

  // A separate receipt from any consultation record - this one is for the
  // treatment plan PURCHASE itself (the prepaid session package). Shared
  // with the clinic app (lib/receiptPdf.js) so this is the exact same
  // document a clinic staff member would download for the same plan, not
  // a simplified look-alike.
  async function handleDownloadPlanReceipt(p) {
    await fetchAndDownloadTreatmentPlanReceipt(supabase, p.id)
  }

  const [myUploads,setMyUploads]=useState([])
  const [uploading,setUploading]=useState(false)
  const [uploadError,setUploadError]=useState(null)

  // Treatment plans (prepaid session packages, e.g. a physio course) were
  // creatable and billable entirely on the clinic side (Payment >
  // Treatment plans) but never surfaced to the patient anywhere at all -
  // no way to see what they'd paid for or how many sessions were left.
  const [treatmentPlans,setTreatmentPlans]=useState([])
  const [treatmentPlansLoading,setTreatmentPlansLoading]=useState(true)
  useEffect(() => {
    if (!patient?.id) { setTreatmentPlansLoading(false); return }
    async function loadTreatmentPlans() {
      setTreatmentPlansLoading(true)
      const { data } = await supabase.from('treatment_plans').select('*, institutions(name)')
        .eq('patient_id', patient.id).order('created_at', { ascending: false })
      setTreatmentPlans(data || [])
      setTreatmentPlansLoading(false)
    }
    loadTreatmentPlans()
  }, [patient?.id])

  useEffect(() => {
    if (!patient?.id) return
    async function loadUploads() {
      const { data } = await supabase.from('medical_record_attachments').select('*')
        .eq('patient_id', patient.id).order('uploaded_at', { ascending: false })
      setMyUploads(data || [])
    }
    loadUploads()
  }, [patient?.id])

  // ── Clinic verification for patient uploads ──────────────────────────────
  // Same underlying design as the out-of-network clinic verification used
  // in share.jsx (the "clinic verifying itself" side of this) - not a
  // second, parallel system. Reuses the exact same real registry table
  // (`directory_clinics`, sourced from Companies Registry + ORPHF open
  // data) that Find Care already queries, rather than inventing a new one.
  // Freshness window matches the agreed 365 days (same as e-PC renewal).
  // NOTE: assumes `directory_clinics` carries (or is extended with)
  // `verification_status` and `last_verified_at` columns, and that a
  // `clinic_verification_requests` table exists for the pending/email-sent
  // state - reconcile these exact names with share.jsx's real schema once
  // that file is rebuilt, so the two never drift into two different systems.
  const [pendingUploadFile,setPendingUploadFile]=useState(null)
  const [uploadStage,setUploadStage]=useState('idle') // idle | identify_clinic | confirm | done
  const [clinicSearch,setClinicSearch]=useState('')
  const [clinicPhone,setClinicPhone]=useState('')
  const [clinicMatches,setClinicMatches]=useState([])
  const [selectedClinic,setSelectedClinic]=useState(null)
  const [verifyingClinic,setVerifyingClinic]=useState(false)
  const [uploadOutcome,setUploadOutcome]=useState(null) // {status:'verified'|'pending'|'unverified', clinicName?}

  function handlePickFile(file) {
    if (!file) return
    setPendingUploadFile(file)
    setUploadStage('identify_clinic')
    setClinicSearch(''); setClinicPhone(''); setClinicMatches([]); setSelectedClinic(null); setUploadOutcome(null)
  }

  async function searchUploadClinic(term) {
    setClinicSearch(term)
    setSelectedClinic(null)
    if (!term.trim()) { setClinicMatches([]); return }
    const { data } = await supabase.from('directory_clinics').select('*').ilike('name', `%${term}%`).limit(6)
    setClinicMatches(data || [])
  }

  function phonesLooselyMatch(a, b) {
    if (!a || !b) return null // nothing typed yet - not a mismatch, just unconfirmed
    const digitsA = a.replace(/\D/g,'').slice(-8)
    const digitsB = b.replace(/\D/g,'').slice(-8)
    return digitsA && digitsB ? digitsA === digitsB : null
  }

  async function proceedWithUpload({ clinicId=null, verificationStatus }) {
    if (!pendingUploadFile || !patient?.id) return
    setUploading(true)
    setUploadError(null)
    const path = `${patient.medsa_id || patient.id}/${Date.now()}-${pendingUploadFile.name}`
    const { error: uploadErr } = await supabase.storage.from('patient-uploaded-records').upload(path, pendingUploadFile)
    if (uploadErr) { setUploadError(uploadErr.message); setUploading(false); return }
    // Storing the path, not a public URL - this bucket should be private,
    // with a signed, expiring URL generated only when actually viewed
    // (same pattern already used for policy-contracts elsewhere in this
    // app). A permanent public URL for medical documents would mean
    // anyone with the link could view them without ever authenticating.
    const { error: insErr } = await supabase.from('medical_record_attachments').insert({
      patient_id: patient.id, category: 'other', file_url: path, file_name: pendingUploadFile.name,
      verification_status: verificationStatus, verified_clinic_id: clinicId,
    })
    if (insErr) { setUploadError(insErr.message); setUploading(false); return }
    const { data } = await supabase.from('medical_record_attachments').select('*')
      .eq('patient_id', patient.id).order('uploaded_at', { ascending: false })
    setMyUploads(data || [])
    setUploading(false)
    setUploadStage('idle')
    setPendingUploadFile(null)
  }

  async function handleConfirmClinic(clinic) {
    setSelectedClinic(clinic)
    setVerifyingClinic(true)
    const alreadyVerified = clinic.verification_status === 'verified'
      && clinic.last_verified_at
      && (Date.now() - new Date(clinic.last_verified_at).getTime()) < 365*24*60*60*1000

    if (alreadyVerified) {
      await proceedWithUpload({ clinicId: clinic.id, verificationStatus: 'verified' })
      setVerifyingClinic(false)
      setUploadOutcome({ status:'verified', clinicName: clinic.name })
      setUploadStage('done')
      return
    }

    // Not yet verified, or verification has gone stale - send a real
    // confirmation request to the clinic's own listed contact (never
    // anything the patient typed), same as the clinic-side flow. The
    // clinic confirms/denies against their real records; a phone-call
    // reminder only follows after ~3 days with no response, and it's
    // system-initiated, never routed through the patient.
    const code = Math.random().toString(36).slice(2,8).toUpperCase()
    await supabase.from('clinic_verification_requests').insert({
      clinic_id: clinic.id, patient_id: patient.id, code,
      contact_email_used: clinic.contact_email || null,
      patient_name: patient.full_name || null,
      requested_at: new Date().toISOString(), status: 'pending',
    })
    await proceedWithUpload({ clinicId: clinic.id, verificationStatus: 'pending' })
    setVerifyingClinic(false)
    setUploadOutcome({ status:'pending', clinicName: clinic.name })
    setUploadStage('done')
  }

  async function handleClinicNotListed() {
    // No registry match at all - the upload still isn't blocked (a
    // patient shouldn't lose access to their own document over an
    // automated-matching miss), but it's honestly marked unverified
    // rather than silently treated as confirmed.
    await proceedWithUpload({ clinicId: null, verificationStatus: 'unverified' })
    setUploadOutcome({ status:'unverified' })
    setUploadStage('done')
  }

  function resetUploadFlow() {
    setUploadStage('idle'); setPendingUploadFile(null); setClinicSearch(''); setClinicPhone('')
    setClinicMatches([]); setSelectedClinic(null); setUploadOutcome(null)
  }
  // Real records only - the honest empty state below handles the
  // no-data case, no demo fallback needed.
  const hasLiveData = records.length > 0
  const [tab,setTab]=useState('all')
  const [expanded,setExpanded]=useState(null)

  // Deep-link from Calendar's "View record" - land straight on this
  // record, expanded, with its real "Download" button right there ready
  // to tap (not auto-triggered - arriving here shouldn't itself start a
  // download the patient didn't ask for). Waits for `records` to actually
  // contain it (this screen's own data can still be loading on first
  // navigation) rather than firing once and giving up.
  useEffect(() => {
    if (!deepLinkRecordId) return
    const raw = records.find(r => r.id === deepLinkRecordId)
    if (!raw) return
    setTab('all')
    setExpanded(deepLinkRecordId)
    onConsumeDeepLink?.()
  }, [deepLinkRecordId, records])

  // Real vaccination records, grouped by vaccine name into the same shape
  // the UI already renders - was previously a hardcoded array of 5
  // vaccines shown identically to every patient regardless of the real
  // `vaccinations` prop this component already receives (and previously
  // ignored entirely). Assumes a `vaccinations` row per dose:
  // {vaccine_name, dose_label, administered_date, status, status_label}.
  const vaccineGroups = Object.values(
    vaccinations.reduce((acc, v) => {
      const key = v.vaccine_name
      if (!acc[key]) acc[key] = { name: v.vaccine_name, status: v.status||'ok', label: v.status_label||'On file', doses: [] }
      acc[key].doses.push([v.dose_label || 'Dose', v.administered_date ? new Date(v.administered_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}) : '—'])
      // The most recent dose's status reflects the vaccine's current
      // standing (e.g. a booster due date), so let a later row's status
      // override an earlier one rather than freezing on the first seen.
      acc[key].status = v.status || acc[key].status
      acc[key].label = v.status_label || acc[key].label
      return acc
    }, {})
  )
  const providers=[] // No real data-sharing consent system exists yet
  // to back this list (which institutions/doctors can see this patient's
  // records) - was previously hardcoded identically for every patient,
  // including toggles that didn't actually control anything real.
  // Medical record and vaccination titles/labels were never translated -
  // shown in English regardless of selected language. One dictionary
  // covers records, vaccines, and providers since they share phrasing.
  const MED_TERM_ZH = {
    'Blood panel — full CBC':'血液檢查——全血細胞計數','General check-up':'一般身體檢查','Chest X-ray':'胸部X光',
    'Allergy test results':'過敏測試結果','Queen Elizabeth Hospital':'伊利沙伯醫院','Lab':'化驗所',
    'Matilda International':'明德國際醫院','Visit':'診症','Ruttonjee Hospital':'律敦治醫院','Imaging':'影像檢查',
    'Uploaded manually':'手動上傳','PDF':'PDF','Synced':'已同步','Manual':'手動',
    'Haemoglobin':'血紅蛋白','WBC':'白血球','Glucose':'血糖','Ordered by':'醫囑醫生',
    'Blood pressure':'血壓','BMI':'身高體重指數','Heart rate':'心率','Notes':'備註',
    'Findings':'檢查結果','No active TB. Lungs clear.':'沒有活躍肺結核,肺部清晰。','Radiologist':'放射科醫生',
    'Penicillin':'青黴素','⚠ Severe allergy':'⚠ 嚴重過敏','Verified by':'核實人','Pending review':'待審核',
    'Mild iron deficiency':'輕度缺鐵',
    'COVID-19':'2019冠狀病毒病','Influenza (seasonal)':'季節性流感','Hepatitis B':'乙型肝炎','HPV (Gardasil 9)':'HPV(加衛苗9)',
    'Tetanus / Td booster':'破傷風/Td加強劑','Up to date':'已完成','Due soon':'即將到期','Complete':'已完成','Overdue':'已逾期',
    'Dose 1 — BioNTech':'第1劑——BioNTech','Dose 2 — BioNTech':'第2劑——BioNTech','Booster 1':'第1劑加強劑','Booster 2 — XBB':'第2劑加強劑——XBB',
    '2023–24 Quadrivalent':'2023–24四價疫苗','2024–25 — Book now':'2024–25——立即預約','Recommended':'建議接種',
    'Dose 1':'第1劑','Dose 2':'第2劑','Dose 3':'第3劑','Last booster':'上次加強劑',
    'Next due — every 10 yrs':'下次應接種——每10年一次','Overdue 2023':'2023年已逾期',
    'Medsa partner':'Medsa合作夥伴','Private practitioner':'私人執業醫生','Valley Fitness Clinic':'谷澤健身診所',
    'Non-Medsa':'非Medsa','Link share':'連結分享','On file':'已記錄',
  }
  function mt(term) {
    if (isEn || !term) return term
    return String(term).split(' · ').map(part => MED_TERM_ZH[part] || part).join(' · ')
  }
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:__theme.accentXLight,borderBottom:`0.5px solid ${__theme.accentLight}`,padding:'10px 16px',display:'flex',gap:'8px',alignItems:'center'}}>
        <span style={{color:__theme.accent}}>◇</span>
        <span style={{fontSize:'12px',color:__theme.accent}}>{isEn?'You control exactly what each provider sees.':'您完全掌控每位醫療提供者可查看的內容。'}</span>
      </div>
      <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`,overflowX:'auto'}}>
        {[['all',isEn?'All records':'所有記錄'],['vax',isEn?'Vaccinations':'疫苗'],['plans',isEn?'Treatment plans':'療程計劃'],['sharing',isEn?'Sharing':'分享'],['upload',isEn?'Upload':'上傳']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'11px 8px',fontSize:'12px',fontWeight:500,color:tab===k?__theme.accent:C.textSub,textAlign:'center',borderBottom:`2px solid ${tab===k?__theme.accent:'transparent'}`,cursor:'pointer',whiteSpace:'nowrap'}}>{l}</div>
        ))}
      </div>
      {tab==='all'&&<>
        <SecLabel>{isEn?'Recent records':'最近記錄'}</SecLabel>
        {hasLiveData&&<div style={{padding:'0 16px 12px'}}>
          {!bundleMode&&<div onClick={()=>setBundleMode(true)} style={{fontSize:'12px',color:__theme.accent,cursor:'pointer'}}>{'\u2295'} {isEn?'Bundle records to share or export':'合併記錄以分享或匯出'}</div>}
          {bundleMode&&<Card style={{padding:'12px 14px'}}>
            <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
              <input value={bundleFilter} onChange={e=>setBundleFilter(e.target.value)} placeholder={isEn?'e.g. cancer - filter and select matching records':'例如癌症 - 篩選並選取相關記錄'} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'12px',boxSizing:'border-box'}}/>
              <Btn style={{fontSize:'12px'}} onClick={selectAllMatching}>{isEn?'Select matching':'選取相關'}</Btn>
            </div>
            <div style={{fontSize:'11px',color:C.textSub,marginBottom:'8px'}}>{selectedIds.size} {isEn?'selected':'項已選取'}</div>
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>{setBundleMode(false);setSelectedIds(new Set());setBundleFilter('')}}>{isEn?'Cancel':'取消'}</Btn>
              <Btn style={{flex:1,fontSize:'12px'}} disabled={selectedIds.size===0} onClick={()=>onShareBundle(Array.from(selectedIds))}>{isEn?'Share':'分享'}</Btn>
              <Btn variant="primary" style={{flex:1,fontSize:'12px'}} disabled={selectedIds.size===0||generatingPdf} onClick={downloadBundle}>{generatingPdf?(isEn?'Generating...':'生成中...'):(isEn?'Download PDF':'下載 PDF')}</Btn>
            </div>
          </Card>}
        </div>}
        {!hasLiveData&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'No records yet - these appear once a clinic logs a visit.':'暫無記錄 - 診所記錄就診後將顯示於此。'}</div>}
        {hasLiveData&&records.map(r=>{
          const receipt = transactions.find(t => t.medical_record_id === r.id)
          return {
          id: r.id,
          icon: r.record_type==='lab'?'◉':r.record_type==='imaging'?'▣':r.record_type==='procedure'?'◇':'◎',
          bg: r.record_type==='lab'?C.blueLight:r.record_type==='imaging'?C.amberLight:r.record_type==='procedure'?C.brownLight:__theme.accentLight,
          title: r.title,
          sub: `${r.institutions?.name||'Unknown'} · ${r.record_type}`,
          date: new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}),
          src: r.source==='synced'?'Synced':'Manual',
          details: [
            ['Diagnosis',r.diagnosis||'—'], ['Notes',r.notes||'—'], ['Department',r.department||'—'],
            ...(receipt ? [['Receipt', `HK$${(receipt.patient_pays||0).toFixed(2)} paid via ${receipt.payment_method} on ${new Date(receipt.created_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}`]] : []),
          ],
          receiptTxn: receipt,
        }}).map(r=>(
          <Card key={r.id} onClick={()=>bundleMode?toggleSelect(r.id):setExpanded(expanded===r.id?null:r.id)}>
            <div style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
              {bundleMode&&<div style={{width:20,height:20,borderRadius:5,border:`1.5px solid ${selectedIds.has(r.id)?__theme.accent:C.border}`,background:selectedIds.has(r.id)?__theme.accent:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'2px',color:'#fff',fontSize:'12px'}}>{selectedIds.has(r.id)?'\u2713':''}</div>}
              <div style={{width:38,height:38,borderRadius:'10px',background:r.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',color:__theme.accent,flexShrink:0}}>{r.icon}</div>
              <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{mt(r.title)}</div><div style={{fontSize:'12px',color:C.textSub}}>{mt(r.sub)}</div></div>
              <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:'11px',color:C.textMuted}}>{r.date}</div><span style={{fontSize:'10px',background:r.src==='Synced'?__theme.accentLight:C.brownLight,color:r.src==='Synced'?__theme.accent:C.brown,padding:'2px 8px',borderRadius:'20px',fontWeight:500}}>{mt(r.src)}</span></div>
            </div>
            {expanded===r.id&&<div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}>
              {r.details.map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}><span style={{color:C.textSub}}>{mt(l)}</span><span style={{fontWeight:500}}>{mt(v)}</span></div>)}
              <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
                <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>{
                  const text = `${r.title}\n${r.details.map(([l,v])=>`${l}: ${v}`).join('\n')}`
                  if (navigator.share) navigator.share({title:r.title, text})
                  else { navigator.clipboard.writeText(text); alert(isEn?'Copied to clipboard':'已複製到剪貼簿') }
                }}>Share</Btn>
                <Btn variant="primary" style={{flex:1,fontSize:'12px'}} onClick={async ()=>{
                  // A visit that was actually billed gets the exact same
                  // receipt design the clinic downloads for it (shared
                  // lib/receiptPdf.js) - medications, itemized charges,
                  // treatment plan usage banner, clinic branding, all of
                  // it. Only a record with no linked transaction (never
                  // billed - e.g. a manually-added record) falls back to
                  // the simpler record-only PDF, since there's no payment
                  // data to build a real receipt from.
                  if (r.receiptTxn) {
                    await fetchAndDownloadConsultationReceipt(supabase, r.receiptTxn)
                    return
                  }
                  const { jsPDF } = await import('jspdf')
                  const doc = new jsPDF()
                  const pageWidth = doc.internal.pageSize.getWidth()
                  const pageHeight = doc.internal.pageSize.getHeight()
                  const subtitle = `${patient.full_name || ''} · ${patient.medsa_id || ''} · Patient Record`
                  drawPdfHeader(doc, pageWidth, subtitle)
                  drawPdfRecordCard(doc, 40, pageWidth, pageHeight, {
                    title: r.title || 'Consultation',
                    dateInstitution: `${r.date || ''}${r.sub?` · ${r.sub}`:''}`,
                    details: r.details.filter(([l])=>l!=='Receipt'),
                    receiptText: null,
                    subtitle,
                  })
                  drawPdfFooter(doc, pageWidth, pageHeight)
                  const blob = doc.output('blob')
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `${r.title.replace(/[^a-z0-9]/gi,'_')}.pdf`
                  document.body.appendChild(a); a.click(); document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                }}>Download</Btn>
              </div>
            </div>}
          </Card>
        ))}
      </>}
      {tab==='vax'&&<>
        <SecLabel>{isEn?'Vaccination passport':'疫苗接種護照'}</SecLabel>
        {vaccineGroups.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'No vaccination records yet - these appear once a clinic logs one.':'暫無疫苗記錄 - 診所記錄後將顯示於此。'}</div>}
        {vaccineGroups.map(v=>(
          <Card key={v.name}>
            <div style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'14px',fontWeight:500}}>{mt(v.name)}</span><Badge text={mt(v.label)} type={v.status}/></div>
            <div style={{padding:'0 16px 14px'}}>
              {v.doses.map(([d,date],i)=>(
                <div key={i} style={{display:'flex',gap:'10px',alignItems:'center',padding:'5px 0',borderTop:`0.5px solid ${C.border}`}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:v.status==='full'?C.amber:__theme.accent,flexShrink:0}}/>
                  <div style={{flex:1,fontSize:'12px',color:C.textSub}}><strong style={{color:C.text}}>{mt(d)}</strong></div>
                  <span style={{fontSize:'11px',color:C.textMuted}}>{date}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
        {vaccineGroups.length>0&&<div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}}>📅 {isEn?'Book overdue vaccinations':'預約逾期疫苗'}</Btn></div>}
      </>}
      {tab==='plans'&&<>
        <SecLabel>{isEn?'Treatment plans':'療程計劃'}</SecLabel>
        {treatmentPlansLoading&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'Loading...':'載入中...'}</div>}
        {!treatmentPlansLoading&&treatmentPlans.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'No treatment plans yet - these appear once a clinic sets one up for you.':'暫無療程計劃 - 診所為您設立後將顯示於此。'}</div>}
        {treatmentPlans.map(p=>{
          const remaining = (p.sessions_paid||0) - (p.sessions_used||0)
          const expired = p.expiry_date && new Date(p.expiry_date) < new Date()
          const badgeType = p.status==='completed' ? 'full' : expired ? 'due' : 'ok'
          const badgeLabel = p.status==='completed' ? (isEn?'Completed':'已完成') : expired ? (isEn?'Expired':'已過期') : (isEn?'Active':'使用中')
          return (
            <Card key={p.id} style={{padding:'14px 16px',marginBottom:'8px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                <div>
                  <div style={{fontSize:'14px',fontWeight:600}}>{mt(p.plan_name)}</div>
                  <div style={{fontSize:'11px',color:C.textSub}}>{p.institutions?.name||'Medsa'}</div>
                </div>
                <Badge text={badgeLabel} type={badgeType}/>
              </div>
              <div style={{display:'flex',gap:'16px',marginBottom:'6px'}}>
                <div><div style={{fontSize:'10px',color:C.textMuted}}>{isEn?'Sessions remaining':'剩餘節數'}</div><div style={{fontSize:'15px',fontWeight:700,color:remaining>0?__theme.accent:C.amber}}>{remaining} / {p.sessions_paid||0}</div></div>
                {p.price_total!=null&&<div><div style={{fontSize:'10px',color:C.textMuted}}>{isEn?'Total paid':'總付款'}</div><div style={{fontSize:'13px',fontWeight:600}}>HK${(p.price_total||0).toFixed(2)}</div></div>}
              </div>
              {p.expiry_date&&<div style={{fontSize:'11px',color:C.textSub,marginBottom:'8px'}}>{isEn?'Expires':'到期日'} {new Date(p.expiry_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>}
              <div onClick={()=>handleDownloadPlanReceipt(p)} style={{fontSize:'11px',color:__theme.accent,cursor:'pointer',marginTop:'4px'}}>{'⬇'} {isEn?'Download plan receipt (PDF)':'下載療程收據 (PDF)'}</div>
            </Card>
          )
        })}
      </>}
      {tab==='sharing'&&<>
        {!accessRequestsLoading&&accessRequests.length>0&&<>
          <SecLabel>{isEn?'Pending access requests':'待處理的存取請求'}</SecLabel>
          {accessRequests.map(req=>(
            <Card key={req.id} style={{padding:'14px 16px',marginBottom:'8px'}}>
              <div style={{fontSize:'13px',fontWeight:600,marginBottom:'2px'}}>{req.requesting_clinic||req.requesting_staff}</div>
              <div style={{fontSize:'11px',color:C.textSub,marginBottom:'10px'}}>{isEn?'Requesting your records':'要求查看您的記錄'}{req.reason?` - ${req.reason}`:''}</div>
              <div style={{display:'flex',gap:'8px'}}>
                <Btn variant="primary" style={{flex:1,fontSize:'12px'}} onClick={()=>handleAccessDecision(req,true)}>{isEn?'Approve':'批准'}</Btn>
                <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>handleAccessDecision(req,false)}>{isEn?'Deny':'拒絕'}</Btn>
              </div>
            </Card>
          ))}
        </>}
        <SecLabel>{isEn?'Who can see your records':'誰可以查看您的記錄'}</SecLabel>
        {providers.length===0&&<div style={{margin:'0 16px 10px',padding:'20px',textAlign:'center',color:C.textMuted,fontSize:'13px'}}>{isEn?'No access controls set up yet.':'尚未設定存取控制。'}</div>}
        <Card>
          {providers.map((p,i)=>(
            <div key={p.init} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center',borderBottom:i<providers.length-1?`0.5px solid ${C.border}`:'none'}}>
              <div style={{width:36,height:36,borderRadius:'10px',background:__theme.accentLight,color:__theme.accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:600,flexShrink:0}}>{p.init}</div>
              <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:500}}>{mt(p.name)}</div><div style={{fontSize:'11px',color:C.textSub}}>{mt(p.sub)}</div></div>
              <Toggle checked={p.on}/>
            </div>
          ))}
        </Card>
        <SecLabel>{isEn?'Record type controls':'記錄類型控制'}</SecLabel>
        <Card>
          {['Lab results','Visit summaries','Imaging','Surgical history','Vaccinations','Mental health records','Allergy info'].map((item,i,arr)=>(
            <div key={item} style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none',fontSize:'13px'}}>
              <span>{item}</span><Toggle checked={item!=='Mental health records'&&item!=='Surgical history'}/>
            </div>
          ))}
        </Card>
        <div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}}>◇ {isEn?'Create one-time access link':'建立一次性存取連結'}</Btn></div>
      </>}
      {tab==='upload'&&<>
        <SecLabel>{isEn?'Upload a record':'上傳記錄'}</SecLabel>

        {uploadStage==='idle'&&<>
          <label style={{margin:'0 16px 10px',border:`1.5px dashed ${C.border}`,borderRadius:'14px',padding:'28px 20px',textAlign:'center',background:C.cream,cursor:'pointer',display:'block'}}>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.csv" style={{display:'none'}} onChange={e=>handlePickFile(e.target.files[0])}/>
            <div style={{fontSize:'32px',color:__theme.accent,marginBottom:'10px'}}>◈</div>
            <div style={{fontSize:'14px',fontWeight:500,marginBottom:'4px'}}>{isEn?'Tap to upload':'點擊上傳'}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>{isEn?'Non-Medsa hospitals, overseas providers, personal files':'非Medsa醫院、海外醫療機構或個人文件'}</div>
            <div style={{display:'flex',gap:'6px',justifyContent:'center',flexWrap:'wrap'}}>
              {['PDF','JPG/PNG','CSV'].map(t=><span key={t} style={{fontSize:'10px',background:__theme.accentLight,color:__theme.accent,padding:'3px 10px',borderRadius:'20px'}}>{t}</span>)}
            </div>
          </label>
          <div style={{margin:'0 16px 10px',fontSize:'11px',color:C.textMuted,lineHeight:1.5}}>{isEn?"You'll be asked which clinic this is from, so we can verify it against the real registry - same check used for out-of-network clinic access.":'系統會詢問此文件來自哪間診所，以便與真實登記冊核對——與非Medsa診所存取所用的核實方式相同。'}</div>
        </>}

        {uploadStage==='identify_clinic'&&<Card style={{padding:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,marginBottom:'6px'}}>{isEn?'Which clinic is this record from?':'此記錄來自哪間診所？'}</div>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'12px',lineHeight:1.5}}>{isEn?"We check this against the real government clinic registry, not what you type - this just helps us find the right one.":'我們會核對真實的政府診所登記冊，而非您輸入的內容——此步驟只是協助尋找正確的診所。'}</div>
          <input value={clinicSearch} onChange={e=>searchUploadClinic(e.target.value)} placeholder={isEn?'Clinic name':'診所名稱'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}/>
          <input value={clinicPhone} onChange={e=>setClinicPhone(e.target.value)} placeholder={isEn?'Phone number (as you remember it)':'電話號碼（憑記憶填寫）'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box'}}/>
          {clinicMatches.length>0&&<div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'12px'}}>
            {clinicMatches.map(c=>{
              const match = phonesLooselyMatch(clinicPhone, c.contact_phone)
              return (
                <div key={c.id} onClick={()=>handleConfirmClinic(c)} style={{padding:'12px',background:C.card,borderRadius:'10px',cursor:'pointer'}}>
                  <div style={{fontSize:'13px',fontWeight:600}}>{c.name}</div>
                  <div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>{c.contact_phone||(isEn?'No phone on file':'無電話記錄')}</div>
                  {match===false&&<div style={{fontSize:'10px',color:C.amber,marginTop:'2px'}}>{isEn?"Doesn't match what you typed - check this is the right clinic":'與您輸入的不符 - 請確認是否為正確診所'}</div>}
                  {match===true&&<div style={{fontSize:'10px',color:__theme.accent,marginTop:'2px'}}>{isEn?'✓ Phone matches':'✓ 電話相符'}</div>}
                </div>
              )
            })}
          </div>}
          {clinicSearch.trim()&&clinicMatches.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'12px'}}>{isEn?'No match in the registry yet.':'登記冊中暫無相符結果。'}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={resetUploadFlow}>{isEn?'Cancel':'取消'}</Btn>
            <Btn style={{flex:1}} onClick={handleClinicNotListed} disabled={uploading}>{isEn?"Can't find it - upload anyway":'找不到 - 仍然上傳'}</Btn>
          </div>
        </Card>}

        {uploadStage==='done'&&uploadOutcome&&<Card style={{padding:'16px',textAlign:'center'}}>
          <div style={{fontSize:'28px',marginBottom:'8px'}}>{uploadOutcome.status==='verified'?'✓':uploadOutcome.status==='pending'?'◇':'◈'}</div>
          {uploadOutcome.status==='verified'&&<div style={{fontSize:'13px',color:__theme.accent,fontWeight:600,marginBottom:'6px'}}>{isEn?`Uploaded - ${uploadOutcome.clinicName} is already verified`:`已上傳 - ${uploadOutcome.clinicName}已完成核實`}</div>}
          {uploadOutcome.status==='pending'&&<>
            <div style={{fontSize:'13px',color:C.amber,fontWeight:600,marginBottom:'6px'}}>{isEn?'Uploaded - verification pending':'已上傳 - 核實中'}</div>
            <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5}}>{isEn?`We've sent a verification request to ${uploadOutcome.clinicName}'s registered contact. Your document is saved now and will be marked verified once they confirm - this usually takes a few days.`:`已向${uploadOutcome.clinicName}的登記聯絡方式發送核實請求。您的文件已儲存，待對方確認後將標示為已核實 - 通常需時數天。`}</div>
          </>}
          {uploadOutcome.status==='unverified'&&<>
            <div style={{fontSize:'13px',color:C.textSub,fontWeight:600,marginBottom:'6px'}}>{isEn?'Uploaded - unverified':'已上傳 - 未經核實'}</div>
            <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5}}>{isEn?"We couldn't automatically match this to a registered clinic. It's saved and marked unverified - Medsa may follow up to confirm.":'無法自動配對至已登記的診所。文件已儲存並標示為未經核實 - Medsa可能會跟進確認。'}</div>
          </>}
          <Btn variant="primary" style={{width:'100%',marginTop:'14px'}} onClick={resetUploadFlow}>{isEn?'Done':'完成'}</Btn>
        </Card>}

        {uploadError&&<div style={{margin:'0 16px 10px',fontSize:'12px',color:C.red}}>{uploadError}</div>}
        <SecLabel>{isEn?'Your uploads':'您的上傳'}</SecLabel>
        {myUploads.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>{isEn?'No files uploaded yet.':'尚未上傳任何文件。'}</div>}
        {myUploads.map(u=>(
          <Card key={u.id} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center',marginBottom:'8px'}}>
            <div style={{width:36,height:36,borderRadius:'10px',background:__theme.accentLight,display:'flex',alignItems:'center',justifyContent:'center',color:__theme.accent,fontSize:'18px'}}>◈</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'13px',fontWeight:500}}>{u.file_name}</div>
              <div style={{fontSize:'11px',color:C.textSub}}>{isEn?'Uploaded':'已上傳'} {new Date(u.uploaded_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})}</div>
              {u.verification_status&&<span style={{fontSize:'10px',padding:'1px 7px',borderRadius:'20px',fontWeight:600,background:u.verification_status==='verified'?__theme.accentLight:u.verification_status==='pending'?C.amberLight:C.card,color:u.verification_status==='verified'?__theme.accent:u.verification_status==='pending'?C.amber:C.textMuted}}>
                {u.verification_status==='verified'?(isEn?'Verified':'已核實'):u.verification_status==='pending'?(isEn?'Pending verification':'核實中'):(isEn?'Unverified':'未經核實')}
              </span>}
            </div>
            <Btn style={{fontSize:'11px',padding:'6px 10px'}} onClick={async()=>{
              const { data, error } = await supabase.storage.from('patient-uploaded-records').createSignedUrl(u.file_url, 300)
              if (error) { alert(`Could not open file: ${error.message}`); return }
              window.open(data.signedUrl,'_blank')
            }}>{isEn?'View':'查看'}</Btn>
          </Card>
        ))}
      </>}
    </div>
  )
}

// ── VIDEO CONSULTATION MODAL ─────────────────────────────────────────────────
// Matches iMeddy's model: video call + medical certificate/referral issuance
// Real, working video call via Jitsi Meet's public server - opens in a new
// browser tab, same mechanism and exact room-naming formula (medsa-{id}-
// {today's date}) as the doctor side in ClinicOpsApp.jsx/PractitionerApp.jsx's
// own startVideoCall - a patient and their doctor calling with the same
// medsaId on the same day land in the same room. Was a fully simulated
// "Connecting…" / fake "Live" placeholder before (VideoCallModal, removed) -
// it never opened a real call, so a patient who booked a video consultation
// had no actual way to have it.
function joinPatientVideoCall(patientDisplayName, roomId) {
  if (!roomId) return
  const roomName = `medsa-${roomId.toString().replace(/[^a-zA-Z0-9]/g,'')}-${new Date().toISOString().slice(0,10)}`
  const name = encodeURIComponent(patientDisplayName || 'Patient')
  window.open(`https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&userInfo.displayName=%22${name}%22`, '_blank', 'noopener')
}

// Real incoming-call screen - fires when the doctor taps "Video call" on
// their end (see lib/videoCallSignal.js), not just a passive button the
// patient has to remember to go find. Rendered once at the root of the app
// (not inside Calendar) so it interrupts whatever screen the patient is on,
// same as a real phone call. Auto-dismisses after a ring timeout so it
// doesn't sit there forever if the patient's away from their device.
function IncomingCallOverlay({ call, isEn, patient, onDismiss }) {
  const __theme = useContext(ThemeContext)
  useEffect(() => {
    if (!call) return
    const t = setTimeout(onDismiss, 45000)
    return () => clearTimeout(t)
  }, [call, onDismiss])

  if (!call) return null

  function answer() {
    joinPatientVideoCall(patient?.full_name, call.roomId)
    onDismiss()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(10,20,15,0.92)',zIndex:500,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#fff',padding:'24px'}}>
      <style>{`@keyframes ringPulse{0%,100%{transform:scale(1);opacity:0.55}50%{transform:scale(1.18);opacity:0}}`}</style>
      <div style={{position:'relative',width:100,height:100,marginBottom:'20px',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{position:'absolute',inset:0,borderRadius:'50%',background:__theme.accent,animation:'ringPulse 1.4s ease-out infinite'}}/>
        <div style={{position:'relative',width:88,height:88,borderRadius:'50%',background:__theme.accentLight,color:__theme.accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',fontWeight:700}}>{'◈'}</div>
      </div>
      <div style={{fontSize:'12px',opacity:0.75,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'1px'}}>{isEn?'Video consultation':'視像診症'}</div>
      <div style={{fontSize:'22px',fontWeight:700,marginBottom:'6px',textAlign:'center'}}>{call.doctorName}</div>
      <div style={{fontSize:'13px',opacity:0.7,marginBottom:'40px'}}>{isEn?'is calling…':'來電中…'}</div>
      <div style={{display:'flex',gap:'28px'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'8px'}}>
          <button onClick={onDismiss} style={{width:60,height:60,borderRadius:'50%',background:C.red,border:'none',color:'#fff',fontSize:'22px',cursor:'pointer'}}>{'✕'}</button>
          <span style={{fontSize:'11px',opacity:0.7}}>{isEn?'Decline':'拒接'}</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'8px'}}>
          <button onClick={answer} style={{width:60,height:60,borderRadius:'50%',background:__theme.accent,border:'none',color:'#fff',fontSize:'22px',cursor:'pointer'}}>{'✓'}</button>
          <span style={{fontSize:'11px',opacity:0.7}}>{isEn?'Answer':'接聽'}</span>
        </div>
      </div>
    </div>
  )
}

function DoctorsScreen({ isEn, patient={} }) {
  const __theme = useContext(ThemeContext)
  const [outstandingClaims,setOutstandingClaims]=useState([])
  const [claimsLoading,setClaimsLoading]=useState(true)

  useEffect(() => {
    if (!patient?.id) return
    async function loadClaims() {
      const { data } = await supabase.from('insurance_claims')
        .select('*, insurance_plans(company_name)')
        .eq('patient_id', patient.id).in('status', ['approved','partially_approved'])
        .order('submitted_at', { ascending: false })
      setOutstandingClaims(data || [])
      setClaimsLoading(false)
    }
    loadClaims()
  }, [patient?.id])
  const [tab,setTab]=useState('search')
  const [selTime,setSelTime]=useState('10:30am')
  const [selLang,setSelLang]=useState('廣東話')
  const [booked,setBooked]=useState(false)
  const [whatsappReminder,setWhatsappReminder]=useState(true)
  const [selectedDoctor,setSelectedDoctor]=useState(null)
  const [consultType,setConsultType]=useState('in-person') // 'in-person' | 'video'
  const [reasonForVisit,setReasonForVisit]=useState('')
  const [symptoms,setSymptoms]=useState('')
  const [currentMeds,setCurrentMeds]=useState('')
  const [intakeConsent,setIntakeConsent]=useState(true) // opt-out: consented by default, patient can uncheck
  const [intakeSaving,setIntakeSaving]=useState(false)
  const [intakeError,setIntakeError]=useState(null)
  const [searchQuery,setSearchQuery]=useState('')
  // No sortBy state - the old 'Nearest'/'Top rated' toggle never actually
  // controlled the sort (sortedDoctors always sorted by distance/name
  // regardless of which was selected), and "Top rated" specifically is
  // exactly the promotional sorting label MCHK-safe neutral search design
  // means to avoid - removed rather than fixed, since automatic
  // distance-then-alphabetical sorting is already the objective behaviour
  // this screen should have.
  const [doctors,setDoctors]=useState([])
  const [doctorsLoading,setDoctorsLoading]=useState(true)
  const [filterSpecialty,setFilterSpecialty]=useState('')
  const [filterDistrict,setFilterDistrict]=useState('')
  const [filterPartnerOnly,setFilterPartnerOnly]=useState(false)
  const [filterOwnership,setFilterOwnership]=useState('')
  const [filterFacilityType,setFilterFacilityType]=useState('')
  const [filterScheme,setFilterScheme]=useState('')
  const [userLocation,setUserLocation]=useState(null) // {lat,lng} once granted
  const [locationError,setLocationError]=useState(null)

  function requestLocation() {
    if (!navigator.geolocation) { setLocationError('Location not supported on this device.'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocationError(null) },
      () => setLocationError('Location permission denied - showing all results without distance.'),
    )
  }

  function distanceKm(lat1, lng1, lat2, lng2) {
    if (lat1==null||lng1==null||lat2==null||lng2==null) return null
    const R = 6371
    const dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
    return R * 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }

  // Real, unified search - both real Medsa doctors (staff_credentials, live
  // availability via doctor_availability) and directory listings (real
  // contact info, no live booking claimed since nothing's actually
  // connected for those).
  useEffect(() => {
    async function loadDoctors() {
      setDoctorsLoading(true)
      // MCHK Appendix D gate - a doctor cannot appear in Find Care at all
      // unless they've agreed to the compliance declaration. Filtered in
      // the query itself, not just hidden in the UI.
      //
      // directory_clinics now holds well over 1000 real rows after this
      // session's imports - Supabase caps an unpaginated select() at 1000
      // by default, so a plain .select('*') would silently drop most of
      // tonight's data. fetchAllRows pages through in batches until done.
      async function fetchAllRows(query) {
        const PAGE = 1000
        let all = [], from = 0
        while (true) {
          const { data, error } = await query.range(from, from + PAGE - 1)
          if (error || !data || data.length === 0) break
          all = all.concat(data)
          if (data.length < PAGE) break
          from += PAGE
        }
        return all
      }
      const [medsaRes, institutionsData, dirResData, clinicsWithDoctorsData, allClinicsData] = await Promise.all([
        supabase.from('staff_credentials').select(STAFF_CREDENTIALS_SAFE_COLUMNS).eq('role','doctor').eq('status','active').eq('mchk_declaration_agreed', true),
        // Fetched separately from staff_credentials rather than as a nested
        // institutions(...) embed - an embed ties the whole doctor query's
        // success to every embedded column already being live in
        // PostgREST's schema cache, which isn't guaranteed to be
        // instant right after a migration. A plain top-level select has
        // no such dependency, and institutions is a small table anyway.
        supabase.from('institutions').select('id, name, name_tc, video_consult_enabled, video_consult_expires_at'),
        fetchAllRows(supabase.from('directory_doctors').select('*, directory_clinics(*)').eq('mchk_declaration_agreed', true)),
        fetchAllRows(supabase.from('directory_doctors').select('clinic_id')),
        filterPartnerOnly ? Promise.resolve([]) : fetchAllRows(supabase.from('directory_clinics').select('*')),
      ])
      const dirRes = { data: dirResData }
      const allClinicsRes = { data: allClinicsData }
      const clinicIdsWithDoctors = new Set(clinicsWithDoctorsData.map(d=>d.clinic_id))
      const institutionById = {}
      ;(institutionsData.data||[]).forEach(inst => { institutionById[inst.id] = inst })
      const todayStr = new Date().toISOString().slice(0,10)
      const medsaDoctors = (medsaRes.data||[]).map(d => {
        const inst = institutionById[d.institution_id]
        return sanitizeMCHKDisplayData({
        source:'medsa', id: d.id, init: d.full_name?.[0]||'?', name: d.full_name, sex: d.sex,
        spec: d.department||'General Practice', specialties: [d.department||'General Practice'],
        clinic: inst?.name || (d.institution_source==='clinic_ops'?'Medsa Clinic':'Medsa Hospital'), clinicTc: inst?.name_tc,
        institution: d.institution_source, institutionId: d.institution_id, district: null, lat:null, lng:null,
        phone:null, email:null, isPartnered:true, registrationNumber: d.registration_number,
        languages: d.languages_spoken, feeMin: d.fee_range_min, feeMax: d.fee_range_max, affiliatedHospitals: d.affiliated_hospitals,
        ownershipType: 'private', facilityType: d.institution_source==='clinic_ops'?'small_practice_clinic':'hospital', schemes: d.schemes||[],
        // Video consultation is a paid, annual, per-clinic feature - only
        // real for a doctor whose own institution has actually paid for
        // it and hasn't lapsed, never assumed just because they're
        // online-bookable.
        videoConsultEnabled: !!(inst?.video_consult_enabled && (!inst?.video_consult_expires_at || inst.video_consult_expires_at >= todayStr)),
      })})
      // Non-partnered listings are shown at clinic level only - no
      // individual doctor name, specialty, or profile is displayed for a
      // clinic Medsa has no real relationship with, matching the
      // directory data-boundary decision: public institutional info
      // (name, address, phone) only, never an individual practitioner's
      // personal profile without their own verification/consent. Doctors
      // at these clinics are aggregated into the clinic's own available
      // specialties instead of being listed as named individuals.
      const nonPartneredDoctorRows = filterPartnerOnly ? [] : (dirRes.data||[])
        .filter(d => d.directory_clinics?.partnership_status!=='medsa_partnered')
      const specialtiesByClinicId = {}
      nonPartneredDoctorRows.forEach(d => {
        const cid = d.clinic_id
        if (!cid) return
        if (!specialtiesByClinicId[cid]) specialtiesByClinicId[cid] = new Set()
        ;(d.specialties||['General Practice']).forEach(s => specialtiesByClinicId[cid].add(s))
      })
      const clinicRowById = {}
      nonPartneredDoctorRows.forEach(d => { if (d.clinic_id && d.directory_clinics) clinicRowById[d.clinic_id] = d.directory_clinics })
      const nonPartneredClinicsWithDoctors = Object.keys(specialtiesByClinicId).map(cid => {
        const c = clinicRowById[cid] || {}
        return sanitizeMCHKDisplayData({
          source:'clinic', id: cid, init: c.name?.[0]||'?', name: c.name||'—', nameTc: c.name_tc,
          specialties: Array.from(specialtiesByClinicId[cid]), clinic: c.name||'—', clinicTc: c.name_tc,
          institution: null, institutionId: null,
          district: c.district||null, lat: c.latitude, lng: c.longitude,
          address: c.address||null, addressTc: c.address_tc||null,
          phone: c.contact_phone, email: c.contact_email, isPartnered: false, noNamedDoctor: true,
          ownershipType: c.ownership_type||null, facilityType: c.facility_type||null, schemes: c.schemes||[],
        })
      })
      // Clinics with no named individual doctor listed at all (public
      // health programs, walk-in clinics) - same clinic-level shape.
      const clinicOnlyListings = (allClinicsRes.data||[])
        .filter(c => !clinicIdsWithDoctors.has(c.id) && c.partnership_status!=='medsa_partnered')
        .map(c => sanitizeMCHKDisplayData({
          source:'clinic', id: c.id, init: c.name?.[0]||'?', name: c.name, nameTc: c.name_tc,
          specialties: [], clinic: c.name, clinicTc: c.name_tc, institution: null, institutionId: null, district: c.district, lat: c.latitude, lng: c.longitude,
          address: c.address||null, addressTc: c.address_tc||null,
          phone: c.contact_phone, email: c.contact_email, isPartnered: false, noNamedDoctor: true,
          ownershipType: c.ownership_type||null, facilityType: c.facility_type||null, schemes: c.schemes||[],
        }))
      setDoctors([...medsaDoctors, ...nonPartneredClinicsWithDoctors, ...clinicOnlyListings])
      setDoctorsLoading(false)
    }
    loadDoctors()
  }, [filterPartnerOnly])

  // Real sanitizer - restricts displayed doctor data to exactly what MCHK's
  // Guidelines on Doctors Directories permits, whitelist-style rather than
  // trusting call sites to remember not to add anything else. Every entry
  // carries a `specialties` array now (even partnered doctors get a
  // single-item array) so filtering and the specialty dropdown work off
  // one consistent shape regardless of whether this is a named doctor or
  // an aggregated clinic-level listing.
  // institutionId is carried through even though it's never shown in the
  // UI itself - it's what lets booking attribute an appointment to the
  // doctor's real institution (see handleConfirmBooking) instead of a
  // hardcoded clinic name.
  function sanitizeMCHKDisplayData(d) {
    return {
      source: d.source, id: d.id, init: d.init, name: d.name, sex: d.sex||null,
      spec: d.spec||null, specialties: d.specialties||[], clinic: d.clinic, institution: d.institution, institutionId: d.institutionId||null,
      district: d.district, lat: d.lat, lng: d.lng, phone: d.phone, email: d.email,
      isPartnered: d.isPartnered, registrationNumber: d.registrationNumber||null,
      languages: d.languages||null, feeMin: d.feeMin||null, feeMax: d.feeMax||null,
      affiliatedHospitals: d.affiliatedHospitals||null, noNamedDoctor: d.noNamedDoctor||false,
      ownershipType: d.ownershipType||null, facilityType: d.facilityType||null, schemes: d.schemes||[],
      nameTc: d.nameTc||null, clinicTc: d.clinicTc||null,
      address: d.address||null, addressTc: d.addressTc||null,
      videoConsultEnabled: d.videoConsultEnabled||false,
    }
  }

  // Doctor specialty and clinic/location terms were never translated -
  // shown in English regardless of selected language. Translated here at
  // render time rather than restructuring the whole doctors array.
  const DR_TERM_ZH = {
    'General Practice':'全科','Cardiologist':'心臟科專科醫生','Internal Medicine':'內科','TCM Practitioner':'中醫師',
    'Psychiatrist':'精神科專科醫生','Dentist':'牙醫',
    'Wan Chai':'灣仔','Yau Ma Tei':'油麻地','Sham Shui Po':'深水埗','Central':'中環','Causeway Bay':'銅鑼灣',
  }
  function dt(term) {
    if (isEn || !term) return term
    return term.split(' · ').map(part => DR_TERM_ZH[part] || part).join(' · ')
  }
  const searchedDoctors = doctors.filter(d => {
    const q = searchQuery.toLowerCase().trim()
    if (q && !(d.name?.toLowerCase().includes(q) || (d.specialties||[]).some(s=>s.toLowerCase().includes(q)) || d.clinic?.toLowerCase().includes(q))) return false
    if (filterSpecialty && !(d.specialties||[]).includes(filterSpecialty)) return false
    if (filterDistrict && d.district !== filterDistrict) return false
    if (filterPartnerOnly && !d.isPartnered) return false
    if (filterOwnership && d.ownershipType !== filterOwnership) return false
    if (filterFacilityType && d.facilityType !== filterFacilityType) return false
    if (filterScheme && !(d.schemes||[]).includes(filterScheme)) return false
    return true
  }).map(d => ({ ...d, distanceKm: userLocation ? distanceKm(userLocation.lat, userLocation.lng, d.lat, d.lng) : null }))
  const sortedDoctors = [...searchedDoctors].sort((a,b) => {
    if (userLocation && a.distanceKm!=null && b.distanceKm!=null) return a.distanceKm - b.distanceKm
    if (userLocation && a.distanceKm!=null) return -1
    if (userLocation && b.distanceKm!=null) return 1
    return (a.name||'').localeCompare(b.name||'')
  })
  const availableSpecialties = [...new Set(doctors.flatMap(d=>d.specialties||[]))].sort()
  const availableDistricts = [...new Set(doctors.map(d=>d.district).filter(Boolean))].sort()
  const availableFacilityTypes = [...new Set(doctors.map(d=>d.facilityType).filter(Boolean))].sort()
  const availableSchemes = [...new Set(doctors.flatMap(d=>d.schemes||[]))].sort()
  const SCHEME_LABELS = {
    public_gopc: 'Public Outpatient Clinic (GOPC)',
    public_dh: 'Department of Health Clinic',
    cap633_licensed: 'Licensed Private Facility',
    general_private: 'Private Practice',
    cdcc: 'Chronic Disease Co-Care Scheme',
    dhc_network: 'District Health Centre Network',
    ehcv: 'Elderly Health Care Voucher',
    vaccination_subsidy: 'Vaccination Subsidy Scheme',
  }
  const schemeLabel = (s) => SCHEME_LABELS[s] || s.replace(/_/g,' ')
  // Real upcoming dates starting today, not a fixed hardcoded month - this
  // is what makes the 48-hour consent window actually testable against
  // the real current time, instead of always landing in the past.
  //
  // "Today" (i=0) has to be Hong Kong's today, not the device's - a
  // patient testing from Canada is often still on their own "yesterday"
  // by their local clock when it's already tomorrow in Hong Kong (HK is
  // 12-16 hours ahead of North America). This is exactly how a booking
  // for "today, 4:30pm" ended up scheduled_at a real Hong Kong day in the
  // past: hkParts(new Date()) below reads the correct HK calendar date;
  // new Date(year, month-1, day) then uses the LOCAL Date constructor, so
  // every later .getFullYear()/.getMonth()/.getDate()/.getDay() read off
  // this object (handleConfirmBooking, loadAvailability, the confirmation
  // summary) returns exactly that Hong Kong date back, regardless of the
  // device's own timezone - unlike building the array from a plain
  // new Date() and shifting it with setDate(), which starts from
  // whatever day the device's clock says "today" is.
  const DAY_LABELS=['SUN','MON','TUE','WED','THU','FRI','SAT']
  const todayHk = hkParts(new Date())
  const DAYS = Array.from({length:5}, (_,i) => {
    const d = new Date(todayHk.year, todayHk.month-1, todayHk.day+i)
    return { label: DAY_LABELS[d.getDay()], date: d.getDate(), fullDate: d }
  })
  const [selDay,setSelDay]=useState(DAYS[0].fullDate)
  // No fallback to doctors[0] - that silently put whichever doctor
  // happened to be first in the list into the booking form if a patient
  // navigated to the Book tab directly without picking anyone, making it
  // look like a doctor had already been chosen for them.
  const activeDoctor = selectedDoctor

  // Real availability, synced from what an admin actually set up for this
  // doctor - replacing the previous hardcoded/pseudo-random time list.
  const [availableSlots,setAvailableSlots]=useState([])
  const [slotsLoading,setSlotsLoading]=useState(true)
  const [dayClosed,setDayClosed]=useState(false)
  const [slotsLoadError,setSlotsLoadError]=useState(null)

  function formatTime12h(timeStr) {
    const [h,m] = timeStr.split(':').map(Number)
    const period = h>=12 ? 'pm' : 'am'
    const h12 = h%12===0 ? 12 : h%12
    return `${h12}:${String(m).padStart(2,'0')}${period}`
  }

  // Wrapped in try/catch/finally - previously any failure partway through
  // (a network blip, a query erroring) left setSlotsLoading(true) as the
  // last thing that ran, so the "Loading availability…" spinner spun
  // forever with no error shown anywhere. Now any failure surfaces a real
  // message with a retry, and the spinner always resolves one way or the
  // other.
  async function loadAvailability(doctor, dateObj) {
    setSlotsLoading(true)
    setDayClosed(false)
    setSlotsLoadError(null)
    try {
      if (!doctor?.institution) {
        // Specialists outside the two core institutions (TCM, dentist, etc.)
        // don't yet have admin-configured hours - fall back to a reasonable
        // fixed default rather than showing nothing at all.
        setAvailableSlots(['9:00am','9:30am','10:00am','10:30am','11:00am','2:00pm','2:30pm','3:00pm'])
        return
      }
      const { data: availRow, error: availErr } = await supabase.from('doctor_availability').select('*')
        .eq('doctor_name', doctor.name).eq('institution_source', doctor.institution).eq('day_of_week', dateObj.getDay()).maybeSingle()
      if (availErr) throw availErr

      if (!availRow || availRow.is_off) {
        setDayClosed(true)
        setAvailableSlots([])
        return
      }

      // Generate every slot between start and end at the configured duration.
      const [startH,startM] = availRow.start_time.slice(0,5).split(':').map(Number)
      const [endH,endM] = availRow.end_time.slice(0,5).split(':').map(Number)
      const duration = availRow.slot_duration_minutes || 30
      const slots = []
      let cur = startH*60+startM
      const end = endH*60+endM
      while (cur < end) {
        slots.push(formatTime12h(`${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`))
        cur += duration
      }

      // Exclude times already booked for this doctor on this exact date.
      // Bounded by the Hong Kong calendar day, and the booked time read back
      // in Hong Kong wall-clock time - scheduled_at is a real UTC instant,
      // and reading it apart with the device's own local time (getHours/
      // getMinutes) silently returns the wrong slot for anyone outside
      // Hong Kong, both undercounting and overcounting what's actually free.
      const { start: dayStart, end: dayEnd } = hkDayBounds(dateObj)
      const { data: existing, error: existingErr } = await supabase.from('appointments').select('scheduled_at')
        .eq('doctor_name', doctor.name).eq('institution_source', doctor.institution).neq('status','cancelled')
        .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())
      if (existingErr) throw existingErr
      const bookedTimes = new Set((existing||[]).map(a => formatTime12h(hkHHMM(a.scheduled_at))))

      const finalSlots = slots.filter(s => !bookedTimes.has(s))
      setAvailableSlots(finalSlots)
      if (!finalSlots.includes(selTime) && finalSlots.length>0) setSelTime(finalSlots[0])
    } catch (err) {
      setSlotsLoadError(err?.message || (isEn ? 'Could not load availability - try again.' : '無法載入可預約時段,請重試。'))
      setAvailableSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }

  useEffect(() => { if (activeDoctor) loadAvailability(activeDoctor, selDay) }, [activeDoctor?.name, selDay])

  function handleBookClick(doc, type) {
    setSelectedDoctor(doc)
    setConsultType(type)
    setBooked(false)
    setTab('book')
  }

  async function handleConfirmBooking() {
    // Declining consent no longer blocks booking - it only means the
    // clinic won't be able to read past records for this visit. Only a
    // real save failure should stop the booking from going through.
    setIntakeSaving(true)
    setIntakeError(null)
    try {
      const medsaId = patient?.medsa_id
      const { data: patientRow } = await supabase.from('patients').select('id,email,full_name,notify_email,phone,notify_sms').eq('medsa_id', medsaId).maybeSingle()
      if (!patientRow) throw new Error('Could not find your profile - try again in a moment.')

      // Build the actual appointment datetime from the selected day/time.
      // Every slot on screen (availability, "9:00am", the day strip) is a
      // Hong Kong clinic time, not whatever timezone the patient's own
      // device happens to be in - setHours() on a plain Date uses the
      // device's local time, which silently stored the wrong UTC instant
      // for anyone browsing from outside Hong Kong (confirmed: a patient
      // testing from Canada had their selected time land hours off once
      // it was displayed back in Hong Kong time). hkWallTimeToUTC treats
      // the selected day+time as Hong Kong wall-clock time explicitly,
      // regardless of the device's own timezone.
      const timeMatch = selTime.match(/(\d+):(\d+)(am|pm)/i)
      let hour = timeMatch ? parseInt(timeMatch[1]) : 10
      const minute = timeMatch ? parseInt(timeMatch[2]) : 0
      if (timeMatch && timeMatch[3].toLowerCase()==='pm' && hour!==12) hour += 12
      if (timeMatch && timeMatch[3].toLowerCase()==='am' && hour===12) hour = 0
      const apptDate = hkWallTimeToUTC(selDay.getFullYear(), selDay.getMonth()+1, selDay.getDate(), hour, minute)

      // The full window is genuinely 48 hours: 12 hours before the
      // appointment day starts, the entire appointment day itself (24h),
      // and 12 hours after the appointment day ends - not just 12h either
      // side of the exact appointment minute. Bounded by the Hong Kong
      // calendar day, same reasoning as above.
      const { start: dayStart, end: dayEnd } = hkDayBounds(apptDate)
      const windowStart = new Date(dayStart.getTime() - 12*60*60*1000)
      const windowEnd = new Date(dayEnd.getTime() + 12*60*60*1000)

      const { error: insErr } = await supabase.from('appointment_intake').insert({
        patient_id: patientRow.id,
        appointment_time: apptDate.toISOString(),
        doctor_name: activeDoctor.name,
        reason_for_visit: reasonForVisit || null,
        symptoms: symptoms || null,
        current_medications: currentMeds || null,
        consent_given: intakeConsent,
        consent_given_at: new Date().toISOString(),
        access_window_start: windowStart.toISOString(),
        access_window_end: windowEnd.toISOString(),
      })
      if (insErr) throw insErr

      // Real fix - this used to look up an institution by a hardcoded
      // literal name ("Pacific Medical Group"), regardless of which
      // doctor or clinic was actually being booked, meaning every booking
      // through this screen got attributed to one specific clinic no
      // matter who the patient actually chose. activeDoctor.institutionId
      // is now carried through directly from the real staff_credentials
      // row (see sanitizeMCHKDisplayData) - no lookup needed, and it's
      // correct for whichever doctor this booking is actually for.
      const { data: practitionerRow } = await supabase.from('practitioners').select('id').ilike('full_name', `%${activeDoctor.name.replace('Dr ','')}%`).maybeSingle()

      // Real conflict check - nothing stopped two different patients (or
      // the same patient twice) from booking the identical doctor at the
      // identical time before this. Cancelled slots don't block a rebook.
      const { data: clash } = await supabase.from('appointments').select('id')
        .eq('doctor_name', activeDoctor.name).eq('scheduled_at', apptDate.toISOString())
        .neq('status', 'cancelled').limit(1).maybeSingle()
      if (clash) {
        setIntakeError('That slot was just taken by another booking - please pick a different time.')
        setIntakeSaving(false)
        return
      }

      const { error: apptErr } = await supabase.from('appointments').insert({
        patient_id: patientRow.id,
        practitioner_id: practitionerRow?.id || null,
        institution_id: activeDoctor.institutionId || null,
        institution_source: activeDoctor.institution || null,
        doctor_name: activeDoctor.name,
        department: activeDoctor.spec || null,
        scheduled_at: apptDate.toISOString(),
        appointment_type: reasonForVisit || activeDoctor.spec || 'Consultation',
        consult_type: consultType,
        status: 'confirmed',
        reason_for_visit: reasonForVisit || null,
        // No fabricated fee - real billing happens at the clinic after
        // the visit (Payment screen), not a guessed amount at booking.
      })
      if (apptErr) throw apptErr
      setBooked(true)
      // Best-effort - respects the patient's own toggles (Edit profile ->
      // Notifications), both default on. Never blocks the booking itself,
      // which already succeeded above. Email and SMS are independent -
      // send whichever is still opted in, even if the other's turned off.
      const wantsEmail = patientRow.notify_email !== false && patientRow.email
      const wantsSms = patientRow.notify_sms !== false && patientRow.phone
      if (wantsEmail || wantsSms) {
        fetch('/api/appointments/notify_booking', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            email: wantsEmail ? patientRow.email : null,
            phone: wantsSms ? patientRow.phone : null,
            patientName: patientRow.full_name,
            doctorName: activeDoctor.name, scheduledAt: apptDate.toISOString(),
          }),
        }).catch(()=>{})
      }
    } catch (e) {
      // 23505 = unique_violation - the rare case where two bookings for
      // the same slot both passed the earlier check before either
      // insert landed. The database-level constraint is the real
      // guarantee; this just keeps the message a patient can act on.
      setIntakeError(e.code === '23505' ? 'That slot was just taken by another booking - please pick a different time.' : e.message)
    } finally {
      setIntakeSaving(false)
    }
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:__theme.accent,padding:'0 16px 14px'}}>
        <div style={{position:'relative',display:'flex',alignItems:'center'}}>
          <span style={{position:'absolute',left:'10px',fontSize:'16px',color:__theme.accent}}>◎</span>
          <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); setTab('search') } }} style={{width:'100%',background:'rgba(255,255,255,0.95)',border:'none',borderRadius:'10px',padding:'10px 12px 10px 34px',fontSize:'14px',outline:'none'}} placeholder={isEn?'Search by name, specialty, clinic…':'按名稱、專科搜尋…'}/>
        </div>
        <div style={{display:'flex',gap:'6px',marginTop:'8px',flexWrap:'wrap'}}>
          <div onClick={requestLocation} style={{padding:'6px 12px',borderRadius:'20px',fontSize:'11px',fontWeight:500,cursor:'pointer',background:userLocation?'#fff':'rgba(255,255,255,0.2)',color:userLocation?__theme.accent:'#fff'}}>
            {'\u25c9'} {userLocation?(isEn?'Sorted by distance':'按距離排序'):(isEn?'Use my location':'使用我的位置')}
          </div>
          <select value={filterSpecialty} onChange={e=>setFilterSpecialty(e.target.value)} style={{padding:'6px 10px',borderRadius:'20px',fontSize:'11px',border:'none',background:filterSpecialty?'#fff':'rgba(255,255,255,0.2)',color:filterSpecialty?C.text:'#fff'}}>
            <option value="">{isEn?'Any specialty':'任何專科'}</option>
            {availableSpecialties.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterDistrict} onChange={e=>setFilterDistrict(e.target.value)} style={{padding:'6px 10px',borderRadius:'20px',fontSize:'11px',border:'none',background:filterDistrict?'#fff':'rgba(255,255,255,0.2)',color:filterDistrict?C.text:'#fff'}}>
            <option value="">{isEn?'Any district':'任何地區'}</option>
            {availableDistricts.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterFacilityType} onChange={e=>setFilterFacilityType(e.target.value)} style={{padding:'6px 10px',borderRadius:'20px',fontSize:'11px',border:'none',background:filterFacilityType?'#fff':'rgba(255,255,255,0.2)',color:filterFacilityType?C.text:'#fff'}}>
            <option value="">{isEn?'Any facility type':'任何機構類型'}</option>
            {availableFacilityTypes.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
          <select value={filterScheme} onChange={e=>setFilterScheme(e.target.value)} style={{padding:'6px 10px',borderRadius:'20px',fontSize:'11px',border:'none',background:filterScheme?'#fff':'rgba(255,255,255,0.2)',color:filterScheme?C.text:'#fff'}}>
            <option value="">{isEn?'Any scheme':'任何計劃'}</option>
            {availableSchemes.map(s=><option key={s} value={s}>{schemeLabel(s)}</option>)}
          </select>
          <select value={filterOwnership} onChange={e=>setFilterOwnership(e.target.value)} style={{padding:'6px 10px',borderRadius:'20px',fontSize:'11px',border:'none',background:filterOwnership?'#fff':'rgba(255,255,255,0.2)',color:filterOwnership?C.text:'#fff'}}>
            <option value="">{isEn?'Public/Private/Subsidized':'公立/私立/資助'}</option>
            <option value="public">{isEn?'Public':'公立'}</option>
            <option value="private">{isEn?'Private':'私立'}</option>
            <option value="subsidized">{isEn?'Subsidized':'資助'}</option>
          </select>
          <div onClick={()=>setFilterPartnerOnly(!filterPartnerOnly)} style={{padding:'6px 12px',borderRadius:'20px',fontSize:'11px',fontWeight:500,cursor:'pointer',background:filterPartnerOnly?'#fff':'rgba(255,255,255,0.2)',color:filterPartnerOnly?__theme.accent:'#fff'}}>
            {isEn?'Online booking':'網上預約'}
          </div>
        </div>
        {locationError&&<div style={{fontSize:'10px',color:'#ffe066',marginTop:'6px'}}>{locationError}</div>}
      </div>
      <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`}}>
        {[['search',isEn?'Find doctors':'尋找醫生'],['book',isEn?'Book':'預約'],['payments',isEn?'Payments':'付款']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'11px 8px',fontSize:'12px',fontWeight:500,color:tab===k?__theme.accent:C.textSub,textAlign:'center',borderBottom:`2px solid ${tab===k?__theme.accent:'transparent'}`,cursor:'pointer'}}>{l}</div>
        ))}
      </div>
      {tab==='search'&&<>
        <SecLabel>{isEn?'Near you':'附近'}</SecLabel>
        {sortedDoctors.map((doc,i)=>(
          <Card key={i}>
            <div style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
              <div style={{width:48,height:48,borderRadius:'12px',background:__theme.accentLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:600,color:__theme.accent,flexShrink:0}}>{doc.init}</div>
              <div style={{flex:1}}>
                {/* Headline is the doctor's name for a real, partnered practitioner -
                    or the clinic's name for any non-partnered listing, since
                    individual non-partnered doctor profiles aren't shown at all. */}
                <div style={{fontSize:'14px',fontWeight:500}}>{!isEn && doc.nameTc ? doc.nameTc : doc.name}</div>
                {doc.noNamedDoctor
                  ? (doc.specialties?.length>0 && <div style={{fontSize:'12px',color:__theme.accent,fontWeight:500}}>{doc.specialties.map(s=>dt(s)).join(', ')}</div>)
                  : <div style={{fontSize:'12px',color:__theme.accent,fontWeight:500}}>{dt(doc.spec)}</div>}
                {!doc.noNamedDoctor && <div style={{fontSize:'12px',color:C.textSub}}>{!isEn && doc.clinicTc ? doc.clinicTc : dt(doc.clinic)}{doc.district?` · ${doc.district}`:''}{doc.distanceKm!=null?` · ${doc.distanceKm.toFixed(1)}km`:''}</div>}
                {doc.noNamedDoctor && <div style={{fontSize:'12px',color:C.textSub}}>{doc.district?doc.district:''}{doc.distanceKm!=null?` · ${doc.distanceKm.toFixed(1)}km`:''}</div>}
                {doc.address&&<div onClick={(e)=>{e.stopPropagation(); const q = (doc.lat&&doc.lng) ? `${doc.lat},${doc.lng}` : encodeURIComponent(doc.address); window.open(`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank')}} style={{fontSize:'11px',color:__theme.accent,marginTop:'2px',cursor:'pointer',textDecoration:'underline'}}>{!isEn && doc.addressTc ? doc.addressTc : doc.address}</div>}
                {(doc.feeMin||doc.languages||doc.registrationNumber)&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>
                  {doc.feeMin&&`HK$${doc.feeMin}-${doc.feeMax||doc.feeMin}`}
                  {doc.languages&&doc.languages.length>0&&`${doc.feeMin?' · ':''}${doc.languages.join(', ')}`}
                  {doc.registrationNumber&&` · MCHK ${doc.registrationNumber}`}
                </div>}
                {doc.videoConsultEnabled&&<div style={{fontSize:'10px',color:C.blue,fontWeight:600,marginTop:'4px'}}>{'◈ '}{isEn?'Video consultation available':'提供視像診症'}</div>}
                {(doc.schemes||[]).filter(s=>['cdcc','dhc_network','ehcv','vaccination_subsidy'].includes(s)).length>0&&<div style={{display:'flex',gap:'8px',marginTop:'4px',alignItems:'center',flexWrap:'wrap'}}>
                  {(doc.schemes||[]).filter(s=>['cdcc','dhc_network','ehcv','vaccination_subsidy'].includes(s)).map(s=>(
                    <span key={s} style={{fontSize:'10px',background:C.card,color:C.textMuted,padding:'2px 8px',borderRadius:'20px',fontWeight:500}}>{schemeLabel(s)}</span>
                  ))}
                </div>}
              </div>
            </div>
            {/* The CTA itself is the only status signal now - no separate
                "verified"/"unverified" badge. A patient sees exactly one of
                two real, functional differences: book online now, or call
                the clinic directly - nothing framed as endorsement. */}
            <div style={{borderTop:`0.5px solid ${C.border}`,padding:'10px 16px',display:'flex',gap:'8px'}}>
              {doc.isPartnered
                ? <Btn variant="primary" style={{flex:1,fontSize:'12px'}} onClick={()=>handleBookClick(doc, 'in-person')}>{isEn?'Book Appointment':'預約診症'}</Btn>
                : doc.phone
                  ? <Btn variant="primary" style={{flex:1,fontSize:'12px'}} onClick={()=>window.location.href=`tel:${doc.phone}`}>{'\u260e'} {isEn?'Call Clinic':'致電診所'}</Btn>
                  : doc.email
                    ? <Btn variant="primary" style={{flex:1,fontSize:'12px'}} onClick={()=>window.location.href=`mailto:${doc.email}`}>{'\u2709'} {isEn?'Email Clinic':'電郵診所'}</Btn>
                    : <Btn style={{flex:1,fontSize:'12px'}} disabled>{isEn?'No contact info':'無聯絡資料'}</Btn>}
            </div>
          </Card>
        ))}
        <div style={{margin:'12px 16px 20px',fontSize:'11px',color:C.textMuted,lineHeight:1.5,textAlign:'center'}}>
          {isEn
            ? 'Directory listings and technical integrations do not constitute a medical endorsement or recommendation of any practitioner.'
            : '目錄列表及技術整合並不構成對任何醫護人員的醫療認可或推薦。'}
        </div>
      </>}
      {tab==='book'&&!activeDoctor&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'Select a doctor first to book an appointment.':'請先選擇醫生以預約。'}</div>}
      {tab==='book'&&activeDoctor&&<>
        <SecLabel>{isEn?'New appointment':'新預約'}</SecLabel>
        <Card style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:__theme.accentLight,color:__theme.accent,fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>✓</div>
          <div><div style={{fontSize:'14px',fontWeight:500}}>{activeDoctor.name}</div><div style={{fontSize:'12px',color:C.textSub}}>{dt(activeDoctor.spec)} · {dt(activeDoctor.clinic)}</div></div>
        </Card>

        {/* Was gated behind doc.videoAvail, a field nothing in the app
            ever populated - so this toggle, and any way to book a video
            consultation at all, was permanently dead. Real gate now:
            video consultation is a paid, annual, per-clinic feature - only
            shown when this doctor's own institution has actually paid for
            it and it hasn't lapsed (see the practice manager's Video
            Consultations settings card). */}
        {activeDoctor.videoConsultEnabled&&<Card style={{padding:'14px 16px'}}>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>{isEn?'Consultation type':'診症方式'}</div>
          <div style={{display:'flex',gap:'8px'}}>
            {[['in-person',isEn?'In-person':'親身診症'],['video',isEn?'Video call':'視像診症']].map(([k,l])=>(
              <div key={k} onClick={()=>setConsultType(k)} style={{flex:1,padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:consultType===k?__theme.accent:C.card,color:consultType===k?'#fff':C.text}}>{l}</div>
            ))}
          </div>
        </Card>}

        <Card>
          <div style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}><div style={{width:28,height:28,borderRadius:'50%',background:__theme.accent,color:'#fff',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>2</div><div style={{fontSize:'14px',fontWeight:500}}>{isEn?'Date & time':'日期與時間'}</div></div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}>
            <div style={{display:'flex',gap:'8px',overflowX:'auto',marginBottom:'12px'}}>
              {DAYS.map(({label,date,fullDate})=>{
                const isSel = fullDate.toDateString()===selDay.toDateString()
                return (
                <div key={fullDate.toISOString()} onClick={()=>setSelDay(fullDate)} style={{flexShrink:0,textAlign:'center',padding:'8px 14px',borderRadius:'10px',background:isSel?__theme.accent:C.card,color:isSel?'#fff':C.text,cursor:'pointer',border:`0.5px solid ${isSel?__theme.accent:C.border}`}}>
                  <div style={{fontSize:'10px',opacity:0.8}}>{label}</div><div style={{fontSize:'16px',fontWeight:600}}>{date}</div>
                </div>
                )
              })}
            </div>
            {slotsLoading&&<div style={{textAlign:'center',padding:'20px',fontSize:'12px',color:C.textMuted}}>{isEn?'Loading availability…':'載入可預約時段…'}</div>}
            {!slotsLoading&&slotsLoadError&&<div style={{textAlign:'center',padding:'20px'}}>
              <div style={{fontSize:'12px',color:C.red,marginBottom:'8px'}}>{slotsLoadError}</div>
              <Btn style={{fontSize:'12px'}} onClick={()=>loadAvailability(activeDoctor, selDay)}>{isEn?'Retry':'重試'}</Btn>
            </div>}
            {!slotsLoading&&!slotsLoadError&&dayClosed&&<div style={{textAlign:'center',padding:'20px',fontSize:'12px',color:C.textMuted}}>{isEn?`${activeDoctor.name} isn't available on this day.`:`${activeDoctor.name}此日不應診。`}</div>}
            {!slotsLoading&&!slotsLoadError&&!dayClosed&&availableSlots.length===0&&<div style={{textAlign:'center',padding:'20px',fontSize:'12px',color:C.textMuted}}>{isEn?'No slots left for this day - try another date.':'此日已無可預約時段,請選擇其他日期。'}</div>}
            {!slotsLoading&&!dayClosed&&availableSlots.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
              {availableSlots.map(time=>{const s=time===selTime;return(
                <div key={time} onClick={()=>setSelTime(time)} style={{border:`0.5px solid ${s?__theme.accent:C.border}`,borderRadius:'8px',padding:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:s?__theme.accent:C.card,color:s?'#fff':C.text}}>{time}</div>
              )})}
            </div>}
          </div>
        </Card>
        <Card>
          <div style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}><div style={{width:28,height:28,borderRadius:'50%',background:__theme.accent,color:'#fff',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>3</div><div style={{fontSize:'14px',fontWeight:500}}>{isEn?'Language':'語言'}</div></div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
            {['廣東話','English','普通話','日本語'].map(l=>(
              <div key={l} onClick={()=>setSelLang(l)} style={{border:`0.5px solid ${selLang===l?__theme.accent:C.border}`,borderRadius:'8px',padding:'10px',textAlign:'center',fontSize:'13px',fontWeight:500,cursor:'pointer',background:selLang===l?__theme.accent:C.card,color:selLang===l?'#fff':C.text}}>{l}</div>
            ))}
          </div></div>
        </Card>
        <Card>
          <div style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}><div style={{width:28,height:28,borderRadius:'50%',background:__theme.accent,color:'#fff',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>4</div><div style={{fontSize:'14px',fontWeight:500}}>{isEn?'Intake form':'問診表'}</div></div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>{isEn?'Reason for visit':'求診原因'}</div>
            <input value={reasonForVisit} onChange={e=>setReasonForVisit(e.target.value)} placeholder={isEn?'e.g. Persistent cough':'例如：持續咳嗽'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box'}}/>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>{isEn?'Symptoms':'症狀'}</div>
            <textarea value={symptoms} onChange={e=>setSymptoms(e.target.value)} rows={3} placeholder={isEn?"Describe what you're experiencing…":'描述您的症狀…'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box',resize:'none',fontFamily:'inherit'}}/>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>{isEn?'Current medications (optional)':'目前藥物（可選）'}</div>
            <input value={currentMeds} onChange={e=>setCurrentMeds(e.target.value)} placeholder={isEn?'e.g. Metformin 500mg':'例如：二甲雙胍 500mg'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'14px',boxSizing:'border-box'}}/>

            <div style={{background:C.blueLight,borderRadius:'8px',padding:'10px 12px',marginBottom:'10px',fontSize:'11px',color:C.navy,lineHeight:1.5}}>
              {(() => {
                const dayStart = new Date(selDay); dayStart.setHours(0,0,0,0)
                const dayEnd = new Date(selDay); dayEnd.setHours(23,59,59,999)
                const wStart = new Date(dayStart.getTime() - 12*60*60*1000)
                const wEnd = new Date(dayEnd.getTime() + 12*60*60*1000)
                const fmt = (d) => d.toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
                return isEn
                  ? `Access window for this booking: ${fmt(wStart)} → ${fmt(wEnd)}`
                  : `此次預約的查閱時段：${fmt(wStart)} → ${fmt(wEnd)}`
              })()}
            </div>
            <div onClick={()=>setIntakeConsent(!intakeConsent)} style={{display:'flex',gap:'10px',alignItems:'flex-start',padding:'12px',background:intakeConsent?__theme.accentXLight:C.card,border:`0.5px solid ${intakeConsent?__theme.accent:C.border}`,borderRadius:'10px',cursor:'pointer'}}>
              <div style={{width:18,height:18,borderRadius:'4px',border:`1.5px solid ${intakeConsent?__theme.accent:C.border}`,background:intakeConsent?__theme.accent:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'#fff',flexShrink:0,marginTop:'1px'}}>{intakeConsent?'\u2713':''}</div>
              <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>
                {isEn
                  ? 'I consent to a 48-hour data access window around this appointment: 12 hours before, the full day of the appointment, and 12 hours after. My treating doctor can only access my relevant records during this window - access ends automatically outside it.'
                  : '我同意一個48小時的資料查閱時段：預約前12小時、預約當日全日、以及預約後12小時。主診醫生只能在此時段內查閱我的相關記錄，時段以外將自動停止查閱。'}
              </div>
            </div>
            {intakeError&&<div style={{fontSize:'12px',color:C.red,marginTop:'10px'}}>{intakeError}</div>}
          </div>
        </Card>
        <Card>
          <div style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}><div style={{width:28,height:28,borderRadius:'50%',background:__theme.accent,color:'#fff',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>5</div><div style={{fontSize:'14px',fontWeight:500}}>{isEn?'Confirm appointment':'確認預約'}</div></div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}>
            {/* No fee/payment breakdown here - it was a fabricated fixed
                HK$380/AIA-covers-$300/you-pay-$80 line shown to every
                patient regardless of their real doctor's fee or their
                actual insurer, if any. Billing happens for real at the
                clinic after the visit, not here. */}
            <div style={{background:__theme.accentXLight,borderRadius:'10px',padding:'14px',marginBottom:'12px'}}>
              {[[isEn?'Doctor':'醫生',activeDoctor.name],[isEn?'Type':'診症方式',consultType==='video'?(isEn?'Video call':'視像診症'):(isEn?'In-person':'親身診症')],[isEn?'Date':'日期',`${selDay.toLocaleDateString('en-HK',{weekday:'short',day:'numeric',month:'short'})} · ${selTime}`],[isEn?'Language':'語言',selLang]].map(([l,v],i,arr)=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:'13px'}}><span style={{color:__theme.accent,fontWeight:500}}>{l}</span><span style={{fontWeight:i===arr.length-1?700:400}}>{v}</span></div>
              ))}
            </div>
            <div onClick={()=>setWhatsappReminder(!whatsappReminder)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:C.card,borderRadius:'10px',marginBottom:'12px',cursor:'pointer'}}>
              <div style={{width:34,height:18,borderRadius:20,background:whatsappReminder?__theme.accent:C.border,position:'relative',flexShrink:0}}>
                <div style={{position:'absolute',top:2,left:whatsappReminder?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:500}}>{isEn?'WhatsApp reminders':'WhatsApp提醒'}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{isEn?'Get appointment reminders via WhatsApp':'透過WhatsApp接收預約提醒'}</div>
              </div>
              <span style={{fontSize:'18px',color:'#25D366'}}>◈</span>
            </div>
            {!intakeConsent&&<div style={{fontSize:'11px',color:C.amber,marginBottom:'10px',textAlign:'center'}}>{isEn?"Booking will proceed, but the clinic won't be able to see your past records for this visit":'預約仍會繼續，但診所將無法查看您此次就診的過往記錄'}</div>}
            <Btn variant="primary" style={{width:'100%'}} onClick={handleConfirmBooking} disabled={intakeSaving}>{intakeSaving?(isEn?'Confirming…':'確認中…'):(isEn?'Confirm appointment':'確認預約')}</Btn>
          </div>
        </Card>
        {booked&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:C.cream,borderRadius:'20px',width:'90%',maxWidth:380,padding:'32px 24px',textAlign:'center'}}>
            <div style={{fontSize:'40px',marginBottom:'12px'}}>✓</div>
            <div style={{fontSize:'18px',fontWeight:700,marginBottom:'8px'}}>{isEn?'Appointment confirmed':'預約已確認'}</div>
            <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.5}}>{activeDoctor.name} · {selDay.toLocaleDateString('en-HK',{weekday:'short',day:'numeric',month:'short'})} at {selTime}</div>
            {consultType==='video'&&<div style={{background:C.blueLight,borderRadius:'10px',padding:'12px 14px',marginBottom:'14px',fontSize:'12px',color:C.navy,lineHeight:1.6,textAlign:'left'}}>
              {'◈ '}{isEn
                ? "This is a video consultation. You don't need to do anything now - when it's time, your doctor will call you right here in Medsa and it'll ring like an incoming call. You can also open Calendar and tap this appointment to join yourself."
                : '這是一次視像診症。您現在無需任何操作 - 到時間醫生會直接在Medsa內致電您，會像來電一樣響鈴。您亦可在「日曆」中點選此預約自行加入。'}
            </div>}
            <Btn variant="primary" style={{width:'100%'}} onClick={()=>setBooked(false)}>Done</Btn>
          </div>
        </div>}
      </>}
      {tab==='payments'&&<>
        <SecLabel>{isEn?'Outstanding':'待付款'}</SecLabel>
        {claimsLoading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'Loading...':'載入中...'}</div>}
        {!claimsLoading&&outstandingClaims.length===0&&<div style={{textAlign:'center',padding:'30px 20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'No outstanding balance.':'沒有未付款項。'}</div>}
        {outstandingClaims.map(c=>{
          const owed = (c.deductible_applied||0) + (c.patient_copay_amount||0)
          return (
          <Card key={c.id} style={{padding:'14px 16px',marginBottom:'8px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><div style={{fontSize:'14px',fontWeight:500}}>{c.insurance_plans?.company_name||'Claim'} — {new Date(c.submitted_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})}</div><Badge text={`Due HK$${owed.toFixed(2)}`} type="due"/></div>
            {[['Consultation fee',`HK$${(c.amount||0).toFixed(2)}`],[`${c.insurance_plans?.company_name||'Insurer'} covered`,`−HK$${(c.insurer_covered_amount||0).toFixed(2)}`],['Balance',`HK$${owed.toFixed(2)}`]].map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:'12px',padding:'3px 0'}}><span style={{color:C.textSub}}>{l}</span><span style={{fontWeight:500}}>{v}</span></div>)}
            <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
              <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>alert(`${c.claim_ref}\n${isEn?'Consultation fee':'診金'}: HK$${(c.amount||0).toFixed(2)}\n${isEn?'Insurer covered':'保險公司支付'}: HK$${(c.insurer_covered_amount||0).toFixed(2)}\n${isEn?'Balance due':'應付餘額'}: HK$${owed.toFixed(2)}`)}>Receipt</Btn>
              <Btn variant="primary" style={{flex:1,fontSize:'12px'}} onClick={()=>alert(isEn?'Online payment is not yet available - please pay at the clinic.':'網上付款暫未開通，請於診所付款。')}>{isEn?`Pay HK$${owed.toFixed(2)}`:`付款 HK$${owed.toFixed(2)}`}</Btn>
            </div>
          </Card>
          )
        })}
        <SecLabel>{isEn?'Recent payments':'最近付款'}</SecLabel>
        {[{title:'Ruttonjee Hospital — Feb 18',amount:'HK$1,200',status:'Paid',type:'ok'},{title:'Matilda International — May 3',amount:'HK$680',status:'Refund pending',type:'due'}].map((p,i)=>(
          <Card key={i} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:'13px',fontWeight:500}}>{p.title}</div></div>
            <div style={{textAlign:'right'}}><div style={{fontSize:'14px',fontWeight:600,color:__theme.accent}}>{p.amount}</div><Badge text={p.status} type={p.type}/></div>
          </Card>
        ))}
      </>}
    </div>
  )
}

// Generates evenly-spaced reminder times across a day from a start time
// and an interval - e.g. start 08:00, every 6h -> 08:00, 14:00, 20:00,
// 02:00. Wraps past midnight on purpose, same as a real "every N hours"
// dosing schedule does.
function generateIntervalTimes(startTime, intervalHours) {
  if (!startTime || !intervalHours) return []
  const [h,m] = startTime.split(':').map(Number)
  const startMin = h*60+m
  const count = Math.max(1, Math.round(24/intervalHours))
  const times = []
  for (let i=0;i<count;i++) {
    const mins = (startMin + i*intervalHours*60) % (24*60)
    times.push(`${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`)
  }
  return times.sort()
}

// Real multi-time reminders, not just one fixed alarm - a patient on an
// interval schedule (e.g. every 4h) needs several reminders a day, not
// one. Auto-generates them from the prescription's own dosing rule when
// there is one, but manual add/remove always works regardless of mode -
// the generated set is just a starting point, not a constraint.
function MedAlarmCard({ medId, med, schedule, dosingMode, intervalHours, defaultOn, defaultTimes, defaultStartTime, isEn }) {
  const __theme = useContext(ThemeContext)
  const [on,setOn]=useState(defaultOn)
  const [times,setTimes]=useState(defaultTimes&&defaultTimes.length>0?defaultTimes:['08:00'])
  const [startTime,setStartTime]=useState(defaultStartTime||'08:00')
  const [newTime,setNewTime]=useState('')
  const [saving,setSaving]=useState(false)

  async function toggleAlarm() {
    const newOn = !on
    setOn(newOn)
    setSaving(true)
    await supabase.from('medications').update({ alarm_enabled: newOn, alarm_time: newOn ? (times[0]||null) : null }).eq('id', medId)
    setSaving(false)
  }
  async function persist(newTimes) {
    setSaving(true)
    await supabase.from('medications').update({ alarm_times: newTimes, alarm_time: newTimes[0]||null }).eq('id', medId)
    setSaving(false)
  }
  async function useIntervalRule() {
    const generated = generateIntervalTimes(startTime, intervalHours)
    setTimes(generated)
    setSaving(true)
    await supabase.from('medications').update({ alarm_times: generated, alarm_start_time: startTime, alarm_time: generated[0]||null }).eq('id', medId)
    setSaving(false)
  }
  function addManualTime() {
    if (!newTime || times.includes(newTime)) return
    const updated = [...times, newTime].sort()
    setTimes(updated); setNewTime('')
    persist(updated)
  }
  function removeTime(tm) {
    const updated = times.filter(x=>x!==tm)
    setTimes(updated)
    persist(updated)
  }

  return (
    <Card style={{padding:'14px 16px'}}>
      <div style={{display:'flex',gap:'12px',alignItems:'center',marginBottom:on?'12px':'0'}}>
        <div style={{width:36,height:36,borderRadius:'10px',background:C.brownLight,display:'flex',alignItems:'center',justifyContent:'center',color:C.brown,fontSize:'18px'}}>◉</div>
        <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:500}}>{med}</div><div style={{fontSize:'11px',color:C.textSub}}>{schedule}</div></div>
        <div onClick={toggleAlarm} style={{width:34,height:18,borderRadius:20,background:on?__theme.accent:C.border,cursor:saving?'wait':'pointer',position:'relative',transition:'background 0.2s',flexShrink:0,opacity:saving?0.6:1}}><div style={{position:'absolute',top:2,left:on?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/></div>
      </div>
      {on&&<div style={{paddingTop:'10px',borderTop:`0.5px solid ${C.border}`}}>
        {dosingMode==='interval'&&intervalHours>0&&<div style={{marginBottom:'10px'}}>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>{isEn?`Prescribed every ${intervalHours}h - start from:`:`處方每${intervalHours}小時一次 - 開始時間：`}</div>
          <div style={{display:'flex',gap:'8px'}}>
            <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'6px 10px',fontSize:'13px',background:C.beige,outline:'none'}}/>
            <button onClick={useIntervalRule} disabled={saving} style={{flex:1,padding:'6px 10px',background:__theme.accent,color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>{isEn?`Use this - ${Math.max(1,Math.round(24/intervalHours))} reminders/day`:`使用 - 每日${Math.max(1,Math.round(24/intervalHours))}次提醒`}</button>
          </div>
        </div>}
        <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>{isEn?'Reminder times':'提醒時間'}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'8px'}}>
          {times.map(tm=>(
            <div key={tm} style={{padding:'5px 10px',borderRadius:'16px',fontSize:'12px',background:__theme.accentLight,color:__theme.accent,display:'flex',alignItems:'center',gap:'6px'}}>
              {tm}<span onClick={()=>removeTime(tm)} style={{cursor:'pointer',fontWeight:700}}>×</span>
            </div>
          ))}
          {times.length===0&&<span style={{fontSize:'11px',color:C.textMuted}}>{isEn?'No reminder times set':'未設定提醒時間'}</span>}
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'6px 10px',fontSize:'13px',background:C.beige,outline:'none'}}/>
          <button onClick={addManualTime} disabled={!newTime} style={{padding:'6px 14px',background:C.card,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>+ {isEn?'Add':'新增'}</button>
        </div>
      </div>}
    </Card>
  )
}

function CalendarScreen({ isEn, appointments=[], medications=[], records=[], patient, onCancelled, onReload, onViewRecord }) {
  const __theme = useContext(ThemeContext)
  const [addReminderOpen,setAddReminderOpen]=useState(false)
  const [addingReminderId,setAddingReminderId]=useState(null)
  const withoutAlarm = medications.filter(m=>!m.alarm_enabled)

  // A patient previously had no way to cancel a booking from the app at
  // all - this screen only ever displayed appointments, with no click
  // handler on the card. Cancelling here is a real status flip (same
  // 'cancelled' status ClinicOps itself uses), which is also what
  // automatically frees the slot back up: every availability check
  // (this app's own booking flow and ClinicOps's) already excludes
  // cancelled appointments, so nothing extra is needed to "reopen" it.
  const [activeAppt,setActiveAppt]=useState(null)
  const [cancelling,setCancelling]=useState(false)

  // Best match for a completed appointment's consultation record.
  // appointment_id (set going forward - see ClinicOpsApp's consultation
  // save) is exact; older rows written before that column existed fall
  // back to same Hong Kong day + same patient, since medical_records has
  // no other link back to the appointment that produced it.
  function findRecordForAppt(appt) {
    const byId = records.find(r => r.appointment_id === appt.id)
    if (byId) return byId
    return records.find(r => r.date_of_record && isSameHkDay(new Date(`${r.date_of_record}T12:00:00+08:00`), new Date(appt.scheduled_at)))
  }
  const [cancelledMsg,setCancelledMsg]=useState(null)

  async function handleCancelAppointment(appt) {
    setCancelling(true)
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id)
    // If this appointment was already checked in, cancelling it left the
    // queue ticket itself untouched - the patient kept showing as
    // waiting/being seen on both the front desk board and their own
    // queue banner here, even though the visit was just called off.
    if (!error) {
      await supabase.from('clinic_queue').update({ status: 'no_show' })
        .eq('appointment_id', appt.id).in('status', ['waiting','serving'])
    }
    setCancelling(false)
    if (error) { setCancelledMsg(isEn?`Could not cancel: ${error.message}`:`無法取消：${error.message}`); return }
    setActiveAppt(null)
    setCancelledMsg(isEn?'Appointment cancelled.':'預約已取消。')
    setTimeout(()=>setCancelledMsg(null), 4000)
    onCancelled?.()
    // Best-effort, same opt-in/no-op-safe pattern as the booking
    // confirmation email/SMS - never blocks the cancellation itself,
    // which already succeeded above.
    const wantsEmail = patient?.notify_email !== false && patient?.email
    const wantsSms = patient?.notify_sms !== false && patient?.phone
    if (wantsEmail || wantsSms) {
      fetch('/api/appointments/notify_cancellation', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          email: wantsEmail ? patient.email : null,
          phone: wantsSms ? patient.phone : null,
          patientName: patient.full_name,
          doctorName: appt.doctor_name, scheduledAt: appt.scheduled_at,
        }),
      }).catch(()=>{})
    }
  }

  async function handleAddReminder(m) {
    setAddingReminderId(m.id)
    await supabase.from('medications').update({ alarm_enabled: true, alarm_time: '08:00', alarm_times: ['08:00'] }).eq('id', m.id)
    setAddingReminderId(null)
    setAddReminderOpen(false)
    // The medications list is a prop from the parent's own fetch - it
    // never refreshed after this write, so the medication just enabled
    // stayed showing as "no reminder yet" (its cached alarm_enabled was
    // still false) regardless of dosing_mode/interval_hours already
    // being correct underneath - closing and reopening this panel alone
    // never actually re-fetched anything.
    onReload?.()
  }
  // "Today" for the calendar defaults to Hong Kong's today, not the
  // device's - same root cause and same fix as the booking day-picker
  // (see DAYS above): hkParts reads the real HK calendar date, then the
  // local Date constructor makes every later local getter (.getDate(),
  // .getMonth(), isSameDay's comparisons) return that HK date back
  // regardless of the device's own timezone.
  const todayHkForCalendar = hkParts(new Date())
  const [viewMonth,setViewMonth]=useState(() => new Date(todayHkForCalendar.year, todayHkForCalendar.month-1, 1))
  const [selectedDate,setSelectedDate]=useState(() => new Date(todayHkForCalendar.year, todayHkForCalendar.month-1, todayHkForCalendar.day))

  function changeMonth(delta) {
    setViewMonth(prev => { const d=new Date(prev); d.setMonth(d.getMonth()+delta); return d })
  }

  const monthLabel = viewMonth.toLocaleDateString(isEn?'en-HK':'zh-HK',{month:'long',year:'numeric'})
  const firstWeekday = (viewMonth.getDay()+6)%7 // Monday-first grid
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 0).getDate()
  const today = new Date(todayHkForCalendar.year, todayHkForCalendar.month-1, todayHkForCalendar.day)
  const isSameDay = (a,b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()

  // Days that have something scheduled - marked with a dot, pulled from
  // real appointment data when available.
  const markedDays = new Set(appointments.map(a=>new Date(a.scheduled_at).getDate()).filter(d=>{
    const apptDate = new Date(appointments.find(a=>new Date(a.scheduled_at).getDate()===d)?.scheduled_at)
    return apptDate.getMonth()===viewMonth.getMonth() && apptDate.getFullYear()===viewMonth.getFullYear()
  }))

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:C.cream,border:`0.5px solid ${C.border}`,margin:'16px 16px 0',borderRadius:'14px',padding:'16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
          <span style={{fontSize:'15px',fontWeight:600}}>{monthLabel}</span>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>changeMonth(-1)} style={{background:C.card,border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'14px'}}>‹</button>
            <button onClick={()=>changeMonth(1)} style={{background:C.card,border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'14px'}}>›</button>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'8px'}}>
          {(isEn?['M','T','W','T','F','S','S']:['一','二','三','四','五','六','日']).map((d,i)=><div key={i} style={{textAlign:'center',fontSize:'11px',color:C.textMuted,fontWeight:600}}>{d}</div>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px'}}>
          {Array.from({length:firstWeekday}).map((_,i)=><div key={`pad-${i}`}/>)}
          {Array.from({length:daysInMonth},(_, i)=>i+1).map(d=>{
            const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d)
            const isToday = isSameDay(cellDate, today)
            const isSelected = isSameDay(cellDate, selectedDate)
            const hasEvent = markedDays.has(d)
            return (
              <div key={d} onClick={()=>setSelectedDate(cellDate)} style={{textAlign:'center',fontSize:'13px',padding:'6px 2px',borderRadius:'50%',cursor:'pointer',background:isSelected?__theme.accent:isToday?__theme.accentLight:'transparent',color:isSelected?'#fff':hasEvent?__theme.accent:C.text,fontWeight:isSelected||isToday?600:400}}>
                {d}
                {hasEvent&&!isSelected&&<div style={{width:4,height:4,borderRadius:'50%',background:__theme.accent,margin:'2px auto 0'}}/>}
              </div>
            )
          })}
        </div>
      </div>
      <SecLabel>{isSameDay(selectedDate,today) ? (isEn?"Today's appointments":'今天的預約') : selectedDate.toLocaleDateString(isEn?'en-HK':'zh-HK',{weekday:'long',day:'numeric',month:'long'})}</SecLabel>
      {cancelledMsg&&<div style={{margin:'0 16px 10px',background:__theme.accentXLight,border:`0.5px solid ${__theme.accent}`,borderRadius:'10px',padding:'10px 14px',fontSize:'12px',color:__theme.accent}}>{'✓'} {cancelledMsg}</div>}
      {(() => {
        // A real rundown of the selected day - not a global "upcoming"
        // feed. Includes completed and past appointments for that day
        // (crossed out, not hidden) since a patient tapping today's date
        // wants to see everything that happened today, not just what's
        // still ahead. Cancelled ones stay excluded - there's nothing to
        // show for a visit that didn't happen. Tap any date on the
        // calendar above to see that day's own rundown.
        // isSameHkDay, not the local-only isSameDay above - scheduled_at
        // is a real UTC instant, and comparing it against the clicked
        // calendar tile using the device's own local calendar date put an
        // appointment on the wrong day for anyone browsing outside Hong
        // Kong (an HKT-morning appointment can fall on the previous local
        // calendar day several timezones west).
        const dayAppts = appointments.filter(a => a.status!=='cancelled' && isSameHkDay(new Date(a.scheduled_at), selectedDate))
          .sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at))
        if (dayAppts.length===0) return <div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'No appointments this day.':'這天沒有預約。'}</div>
        return dayAppts.map((appt,i)=>{
          const dt = new Date(appt.scheduled_at)
          const timeStr = dt.toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})
          const drName = appt.practitioners?.full_name ? 'Dr '+appt.practitioners.full_name.split(',')[0] : (appt.doctor_name || appt.appointment_type)
          const isDone = appt.status==='completed'
          return(
            <Card key={i} onClick={()=>setActiveAppt(appt)} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center',cursor:'pointer',opacity:isDone?0.65:1}}>
              <div style={{width:40,height:40,borderRadius:'12px',background:isDone?C.card:__theme.accentLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:isDone?C.textMuted:__theme.accent,flexShrink:0}}>{isDone?'✓':'◎'}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'14px',fontWeight:500,textDecoration:isDone?'line-through':'none',color:isDone?C.textMuted:C.text}}>{drName}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{appt.institutions?.name||'—'}</div>
                <span style={{fontSize:'10px',background:isDone?C.card:appt.status==='confirmed'?__theme.accentLight:C.amberLight,color:isDone?C.textMuted:appt.status==='confirmed'?__theme.accent:C.amber,padding:'1px 8px',borderRadius:'20px',fontWeight:500}}>{appt.status}</span>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:'12px',fontWeight:600}}>{timeStr}</div>
                {appt.patient_pays>0&&<div style={{fontSize:'11px',color:C.amber}}>HK${appt.patient_pays} due</div>}
              </div>
              <span style={{color:C.textMuted,fontSize:'16px'}}>{'›'}</span>
            </Card>
          )
        })
      })()}
      {activeAppt&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setActiveAppt(null)}>
        <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'16px',width:'100%',maxWidth:380,margin:'0 16px',padding:'24px'}}>
          <div style={{fontSize:'16px',fontWeight:700,marginBottom:'6px'}}>{activeAppt.practitioners?.full_name ? 'Dr '+activeAppt.practitioners.full_name.split(',')[0] : (activeAppt.doctor_name || activeAppt.appointment_type)}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'18px'}}>{new Date(activeAppt.scheduled_at).toLocaleString('en-HK',{dateStyle:'full',timeStyle:'short',timeZone:'Asia/Hong_Kong'})}</div>
          {activeAppt.status==='completed'&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'10px'}}>{'✓'} {isEn?'This visit is complete.':'此診症已完成。'}</div>}
          {activeAppt.status==='completed'&&(() => {
            const rec = findRecordForAppt(activeAppt)
            // Goes straight to the Records tab with this exact record open
            // and its real PDF triggered - not a second, simplified
            // knockoff view living here in Calendar. Records is the one
            // real source for a consultation's PDF (same document a
            // clinic would download for it), so "view the record" means
            // landing there, not reading a duplicate summary inline.
            return rec
              ? <Btn variant="primary" style={{width:'100%',marginBottom:'8px'}} onClick={()=>{onViewRecord?.(rec.id);setActiveAppt(null)}}>{isEn?'View record':'查看記錄'}</Btn>
              : <div style={{fontSize:'11px',color:C.textMuted,fontStyle:'italic',marginBottom:'10px'}}>{isEn?'No consultation record on file yet.':'暫無此次診症的記錄。'}</div>
          })()}
          {activeAppt.status!=='completed'&&activeAppt.consult_type==='video'&&<Btn variant="primary" style={{width:'100%',marginBottom:'8px'}} onClick={()=>joinPatientVideoCall(patient?.full_name, patient?.medsa_id)}>{isEn?'Join video call':'加入視像通話'}</Btn>}
          {activeAppt.status!=='completed'&&<Btn variant="danger" style={{width:'100%'}} disabled={cancelling} onClick={()=>handleCancelAppointment(activeAppt)}>{cancelling?(isEn?'Cancelling…':'取消中…'):(isEn?'Cancel appointment':'取消預約')}</Btn>}
          <Btn style={{width:'100%',marginTop:'8px'}} onClick={()=>setActiveAppt(null)}>{isEn?'Close':'關閉'}</Btn>
        </div>
      </div>}
      <SecLabel>{isEn?'Medication alarms':'用藥鬧鐘'}</SecLabel>
      {medications.length>0 ? medications.filter(m=>m.alarm_enabled||m.alarm_time).map((m,i)=>(
        <MedAlarmCard key={i} medId={m.id} med={`${m.medication_name} ${m.dosage||''}`.trim()} schedule={m.frequency||'As prescribed'} dosingMode={m.dosing_mode} intervalHours={m.interval_hours} defaultOn={m.alarm_enabled||false} defaultTimes={(m.alarm_times&&m.alarm_times.length>0)?m.alarm_times:(m.alarm_time?[m.alarm_time.slice(0,5)]:['08:00'])} defaultStartTime={m.alarm_start_time?.slice(0,5)||'08:00'} isEn={isEn}/>
      )) : <div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'No medication reminders yet.':'暫無用藥提醒。'}</div>}
      {!addReminderOpen&&<div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}} onClick={()=>setAddReminderOpen(true)}>+ {isEn?'Add reminder':'新增提醒'}</Btn></div>}
      {addReminderOpen&&<div style={{padding:'0 16px 16px'}}>
        <Card style={{padding:'14px'}}>
          <div style={{fontSize:'13px',fontWeight:600,marginBottom:'10px'}}>{isEn?'Choose a medication':'選擇藥物'}</div>
          {withoutAlarm.length===0&&<div style={{fontSize:'12px',color:C.textMuted}}>{isEn?'All your medications already have a reminder.':'您的所有藥物都已設有提醒。'}</div>}
          {withoutAlarm.map(m=>(
            <div key={m.id} onClick={()=>addingReminderId?null:handleAddReminder(m)} style={{padding:'10px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'13px',cursor:'pointer',display:'flex',justifyContent:'space-between'}}>
              <span>{m.medication_name} {m.dosage||''}</span>
              <span style={{color:__theme.accent,fontSize:'11px'}}>{addingReminderId===m.id?(isEn?'Adding...':'新增中...'):(isEn?'+ Add':'+ 新增')}</span>
            </div>
          ))}
          <Btn style={{width:'100%',marginTop:'10px'}} onClick={()=>setAddReminderOpen(false)}>{isEn?'Close':'關閉'}</Btn>
        </Card>
      </div>}
    </div>
  )
}

// ── MY INQUIRIES TAB ─────────────────────────────────────────────────────────
// Same inquiry_messages thread the agent side (AgentApp.jsx) reads and
// writes - not a separate system. If the patient wants a different
// agent, this just releases the claim (clears claimed_by_agent_id) so
// the inquiry re-enters the same first-come-first-served pool for
// another agent to pick up, rather than routing through Medsa Admin.
// A message's attachment is either an old-style public URL (agent-side
// uploads, and anything sent before this existed) or a reference to a
// medical_record_attachments row (everything the patient sends now,
// below) - that bucket is private by design, so viewing it means a
// fresh signed URL each time, same pattern as "Your uploads" already
// uses, never a permanent public link to a medical document.
function InquiryMessageAttachment({ m }) {
  const __theme = useContext(ThemeContext)
  const [opening,setOpening]=useState(false)
  async function openLinkedRecord() {
    setOpening(true)
    const { data: rec } = await supabase.from('medical_record_attachments').select('file_url').eq('id', m.attachment_record_id).maybeSingle()
    if (rec?.file_url) {
      const { data, error } = await supabase.storage.from('patient-uploaded-records').createSignedUrl(rec.file_url, 300)
      if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank')
    }
    setOpening(false)
  }
  if (m.attachment_record_id) {
    return <span onClick={openLinkedRecord} style={{fontSize:'12px',color:__theme.accent,cursor:'pointer'}}>{'📎'} {opening?'Opening…':(m.attachment_name||'Attachment')}</span>
  }
  if (m.attachment_url) {
    return <a href={m.attachment_url} target="_blank" rel="noreferrer" style={{fontSize:'12px',color:__theme.accent}}>{'📎'} {m.attachment_name||'Attachment'}</a>
  }
  return null
}

function PatientInquiryThread({ inquiry, patientName, patientId }) {
  const __theme = useContext(ThemeContext)
  const [messages,setMessages]=useState([])
  const [loading,setLoading]=useState(true)
  const [body,setBody]=useState('')
  const [sending,setSending]=useState(false)
  const [attachment,setAttachment]=useState(null) // {recordId, name}
  const [uploading,setUploading]=useState(false)
  const [uploadError,setUploadError]=useState(null)
  const [pickerOpen,setPickerOpen]=useState(false)
  const [myFiles,setMyFiles]=useState([])
  const [loadingMyFiles,setLoadingMyFiles]=useState(false)

  async function load() {
    const { data } = await supabase.from('inquiry_messages').select('*').eq('inquiry_id', inquiry.id).order('created_at',{ascending:true})
    setMessages(data||[])
    setLoading(false)
    // Opening the thread is what "reading" it means here - clears the
    // unread badge on the message board the moment the patient actually
    // sees the conversation, same as the doctor-messages thread already does.
    const unreadIds = (data||[]).filter(m=>!m.read_by_patient).map(m=>m.id)
    if (unreadIds.length>0) await supabase.from('inquiry_messages').update({ read_by_patient: true }).in('id', unreadIds)
  }
  useEffect(() => { load() }, [inquiry.id])

  // Real gap this closes: an underwriter's "Request report" had no way
  // for the patient to actually hand over a document in response -
  // only a plain upload, every time, even when the exact file they'd
  // send (a past receipt, a doctor's letter already on file) was
  // already sitting in their own profile. Picking one of those just
  // references the existing medical_record_attachments row - uploading
  // fresh here lands in that same profile list too (same pattern as
  // "Your uploads" elsewhere), unverified until an insurer actually
  // confirms it against something real (see the claim-approval flow).
  async function openPicker() {
    setPickerOpen(o=>!o)
    if (!pickerOpen && myFiles.length===0) {
      setLoadingMyFiles(true)
      const { data } = await supabase.from('medical_record_attachments').select('*').eq('patient_id', patientId).order('uploaded_at',{ascending:false})
      setMyFiles(data||[])
      setLoadingMyFiles(false)
    }
  }
  function pickExistingFile(f) {
    setAttachment({ recordId: f.id, name: f.file_name })
    setPickerOpen(false)
  }

  async function handleFile(file) {
    setUploading(true)
    setUploadError(null)
    const path = `${patientId}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('patient-uploaded-records').upload(path, file)
    if (error) { setUploadError(error.message); setUploading(false); return }
    const { data: rec, error: insErr } = await supabase.from('medical_record_attachments').insert({
      patient_id: patientId, category: 'underwriting', file_url: path, file_name: file.name, verification_status: 'unverified',
    }).select().maybeSingle()
    if (insErr || !rec) { setUploadError(insErr?.message||'Could not save this file.'); setUploading(false); return }
    setAttachment({ recordId: rec.id, name: file.name })
    setUploading(false)
  }

  async function handleSend() {
    if (!body.trim() && !attachment) return
    setSending(true)
    await supabase.from('inquiry_messages').insert({
      inquiry_id: inquiry.id, sender_type: 'patient', sender_name: patientName,
      body: body.trim()||null, attachment_record_id: attachment?.recordId||null, attachment_name: attachment?.name||null,
      read_by_patient: true, read_by_agent: false,
    })
    setBody(''); setAttachment(null); setSending(false)
    load()
  }

  return (
    <div style={{marginTop:'10px',borderTop:`0.5px solid ${C.border}`,paddingTop:'10px'}}>
      {loading&&<div style={{fontSize:'12px',color:C.textMuted}}>Loading messages…</div>}
      {!loading&&messages.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginBottom:'8px'}}>No messages yet.</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'10px',maxHeight:260,overflowY:'auto'}}>
        {messages.map(m=>(
          <div key={m.id} style={{alignSelf:m.sender_type==='patient'?'flex-end':'flex-start',maxWidth:'80%',background:m.sender_type==='patient'?__theme.accentLight:C.card,borderRadius:'8px',padding:'8px 10px'}}>
            <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'2px'}}>{m.sender_name||(m.sender_type==='patient'?'You':m.sender_type==='underwriter'?'Underwriter':'Agent')} · {new Date(m.created_at).toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
            {m.body&&<div style={{fontSize:'13px'}}>{m.body}</div>}
            <InquiryMessageAttachment m={m}/>
          </div>
        ))}
      </div>
      <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Type a message..." rows={2} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px',fontSize:'13px',boxSizing:'border-box',marginBottom:'6px',fontFamily:'inherit'}}/>
      {pickerOpen&&<div style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px',marginBottom:'6px',maxHeight:160,overflowY:'auto'}}>
        {loadingMyFiles&&<div style={{fontSize:'11px',color:C.textMuted}}>Loading your files…</div>}
        {!loadingMyFiles&&myFiles.length===0&&<div style={{fontSize:'11px',color:C.textMuted}}>No files in your profile yet - upload one instead.</div>}
        {myFiles.map(f=>(
          <div key={f.id} onClick={()=>pickExistingFile(f)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 4px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}>
            <span>{f.file_name}</span>
            <span style={{fontSize:'10px',padding:'1px 7px',borderRadius:'20px',fontWeight:600,background:f.verification_status==='verified'?__theme.accentLight:C.card,color:f.verification_status==='verified'?__theme.accent:C.textMuted}}>{f.verification_status==='verified'?'Verified':'Unverified'}</span>
          </div>
        ))}
      </div>}
      <div style={{display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap'}}>
        <label style={{fontSize:'11px',color:C.textSub,cursor:'pointer',padding:'8px 10px',border:`0.5px solid ${C.border}`,borderRadius:'6px'}}>
          {uploading?'Uploading…':(attachment?`✓ ${attachment.name}`:'Upload file')}
          <input type="file" style={{display:'none'}} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])}/>
        </label>
        <Btn style={{fontSize:'11px',padding:'8px 10px'}} onClick={openPicker}>{pickerOpen?'Hide my files':'Choose from my files'}</Btn>
        <Btn style={{flex:1}} onClick={handleSend} disabled={sending||uploading}>{sending?'Sending…':'Send'}</Btn>
      </div>
      {uploadError&&<div style={{fontSize:'11px',color:C.red,marginTop:'6px'}}>Attachment failed: {uploadError}</div>}
    </div>
  )
}

// The one place a patient can come back to an 'auto' inquiry days later -
// suitabilityResults in the Compare Plans tab is session-only state, so
// without this, a case that gets approved by an underwriter after the
// patient has closed the app had nowhere to ever be bought (aq2-14: the
// patient can proceed straight to billing from a pending-approval item
// here, not just in the same session they declared).
// aq2-08/aq2-13 - a decline is never a dead end. System-matched
// alternatives (never an agent's judgment - see find_alternative_plans.js),
// labeled same-insurer vs. cross-insurer, plus the fallback to a real agent.
function AlternativePlansPanel({ isEn, inquiryId, onViewPlan }) {
  const [loaded,setLoaded]=useState(false)
  const [alternatives,setAlternatives]=useState([])
  const [loading,setLoading]=useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/patient/find_alternative_plans', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ inquiryId }),
    })
    const data = await res.json()
    setAlternatives(data.alternatives||[])
    setLoading(false)
    setLoaded(true)
  }

  if (!loaded) return <Btn style={{width:'100%',marginTop:'10px',fontSize:'12px'}} disabled={loading} onClick={load}>{loading?(isEn?'Looking…':'搜尋中…'):(isEn?'See other plans that might work':'查看其他合適計劃')}</Btn>

  return (
    <div style={{marginTop:'10px'}}>
      {alternatives.length===0
        ? <div style={{fontSize:'11px',color:C.textMuted}}>{isEn?'No matching alternative found automatically - talking to an agent is your best next step.':'未能自動找到合適的替代計劃 - 建議聯絡代理跟進。'}</div>
        // Real gap found live-testing: these were inert text - tapping one
        // did nothing (and this copy of the panel wasn't even wired up
        // when the same fix landed on the plan-page one, since it's a
        // separate component used here in My Inquiries).
        : alternatives.map(a=>(
          <div key={a.planId} onClick={()=>onViewPlan&&onViewPlan(a.planId)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'#fff',borderRadius:'8px',marginBottom:'6px',cursor:onViewPlan?'pointer':'default'}}>
            <div>
              <div style={{fontSize:'12px',fontWeight:600}}>{a.planName}</div>
              <div style={{fontSize:'11px',color:C.textMuted}}>{a.companyName}{a.sameInsurer?(isEn?' · same insurer':' · 同一保險公司'):(isEn?' · different insurer':' · 不同保險公司')}{a.quotedPremium!=null?` · HK$${a.quotedPremium}/mo`:''}</div>
            </div>
            {onViewPlan&&<span style={{fontSize:'11px',color:C.textMuted}}>{isEn?'View →':'查看 →'}</span>}
          </div>
        ))}
    </div>
  )
}

function AutoInquiryPurchasePanel({ isEn, inquiry, patient, onPurchased }) {
  const __theme = useContext(ThemeContext)
  const [open,setOpen]=useState(false)
  const [wardClass,setWardClass]=useState('')
  const [paymentFrequency,setPaymentFrequency]=useState('monthly')
  const [declarationAck,setDeclarationAck]=useState(false)
  const [termsModalOpen,setTermsModalOpen]=useState(false)
  const [purchasing,setPurchasing]=useState(false)
  const [error,setError]=useState(null)

  async function handlePurchase() {
    if (!declarationAck) return
    setPurchasing(true); setError(null)
    try {
      const res = await fetch('/api/patient/complete_auto_purchase', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          inquiryId: inquiry.id, patientId: patient.id, planId: inquiry.plan_id,
          wardClass: wardClass || null, paymentFrequency, healthDeclarationAcknowledged: declarationAck,
        }),
      })
      const data = await res.json()
      if (data.status === 'REDIRECT' && data.checkoutUrl) { window.location.href = data.checkoutUrl; return }
      if (data.status !== 'OK') { setError(data.message || 'Could not complete the purchase.'); return }
      onPurchased()
    } finally {
      setPurchasing(false)
    }
  }

  if (!open) return <Btn variant="primary" style={{width:'100%',marginTop:'10px',fontSize:'12px'}} onClick={()=>setOpen(true)}>{isEn?'Proceed to buy':'繼續購買'}</Btn>

  return (
    <div style={{marginTop:'10px',background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'12px'}}>
      {/* Real gap found live-testing: this confirm-and-pay step never
          showed a price anywhere, even though one was already quoted and
          on file - a patient was asked to "Confirm & activate" blind.
          Ward class is a real price lever (private can run 2-3x general),
          so the number here updates live as it's picked, before
          confirming - not revealed only after. */}
      {inquiry.quoted_premium_hkd_by_ward
        ? <div style={{fontSize:'16px',fontWeight:700,color:C.navy,marginBottom:'10px'}}>{isEn?'Estimated':'預計'} HK${inquiry.quoted_premium_hkd_by_ward[wardClass||'general']}/mo</div>
        : inquiry.quoted_premium_hkd!=null&&<div style={{fontSize:'16px',fontWeight:700,color:C.navy,marginBottom:'10px'}}>{isEn?'Estimated':'預計'} HK${inquiry.quoted_premium_hkd}/mo</div>}
      <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
        <select value={wardClass} onChange={e=>setWardClass(e.target.value)} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px',fontSize:'12px'}}>
          <option value="">{isEn?'Ward class (General)':'病房等級(普通)'}</option>
          <option value="general">{isEn?'General ward':'普通病房'}</option>
          <option value="semi_private">{isEn?'Semi-private':'半私家'}</option>
          <option value="private">{isEn?'Private':'私家'}</option>
        </select>
        <select value={paymentFrequency} onChange={e=>setPaymentFrequency(e.target.value)} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px',fontSize:'12px'}}>
          <option value="monthly">{isEn?'Pay monthly':'每月繳付'}</option>
          <option value="annual">{isEn?'Pay annually':'每年繳付'}</option>
        </select>
      </div>
      {declarationAck
        ? <div style={{fontSize:'11px',color:__theme.accent,fontWeight:600,marginBottom:'10px'}}>✓ {isEn?'Health declaration & terms reviewed and accepted.':'已審閱並接受健康聲明及條款。'}</div>
        : <Btn style={{width:'100%',marginBottom:'10px',fontSize:'12px'}} onClick={()=>setTermsModalOpen(true)}>{isEn?'Review & accept health declaration':'審閱並接受健康聲明'}</Btn>}
      <TermsAgreementModal open={termsModalOpen} onClose={()=>setTermsModalOpen(false)} isEn={isEn}
        planName={inquiry.insurance_plans?.plan_name} companyName={inquiry.insurance_plans?.company_name}
        declaredConditions={inquiry.declared_conditions||[]}
        waitingPeriodDays={inquiry.insurance_plans?.waiting_period_days} preExistingConditionPolicy={inquiry.insurance_plans?.pre_existing_condition_policy}
        additionalTerms={inquiry.insurance_plans?.additional_terms}
        onAccept={()=>{setDeclarationAck(true);setTermsModalOpen(false)}}/>
      {error&&<div style={{fontSize:'11px',color:C.red,marginBottom:'8px'}}>{error}</div>}
      <div style={{display:'flex',gap:'8px'}}>
        <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>setOpen(false)}>{isEn?'Cancel':'取消'}</Btn>
        <Btn variant="primary" style={{flex:1,fontSize:'12px'}} disabled={purchasing||!declarationAck} onClick={handlePurchase}>{purchasing?(isEn?'Confirming…':'確認中…'):(isEn?'Confirm & checkout':'確認並結賬')}</Btn>
      </div>
    </div>
  )
}

function MyInquiriesTab({ isEn, patient={}, onViewPlan, initialExpandedId=null, onConsumeDeepLink }) {
  const __theme = useContext(ThemeContext)
  const [inquiries,setInquiries]=useState([])
  const [agentQuotes,setAgentQuotes]=useState([])
  const [loading,setLoading]=useState(true)
  const [expandedId,setExpandedId]=useState(null)
  const [switching,setSwitching]=useState(null)
  const [showAllInquiries,setShowAllInquiries]=useState(false)
  // Kept separate from the initialExpandedId prop, which the parent
  // clears (via onConsumeDeepLink) right after this fires - the ring
  // highlight below needs to survive that, not vanish the instant the
  // deep link is consumed.
  const [justLinkedId,setJustLinkedId]=useState(null)

  // Arriving here via the home screen's "message about your application"
  // tap (or an unread badge) - jump straight to that inquiry's card.
  // Real gap found live-testing: this used to force showAllInquiries
  // open, which dumped every past declaration for every plan into view
  // at once - with "a lot of inquiries for the same plan" all showing
  // the same plan/company header, there was no way to tell which one the
  // link actually meant. Fixed at the declutter list itself (see
  // visibleInquiries above) to add only this one inquiry as an
  // exception, never the whole hidden set - so this effect now only
  // needs to expand it and scroll it into view, not blow open the list.
  useEffect(() => {
    if (!initialExpandedId || loading) return
    if (!inquiries.find(i=>i.id===initialExpandedId)) return
    setExpandedId(initialExpandedId)
    setJustLinkedId(initialExpandedId)
    onConsumeDeepLink && onConsumeDeepLink()
    setTimeout(() => {
      document.querySelector(`[data-inquiry-id="${initialExpandedId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }, [initialExpandedId, loading, inquiries])

  async function load() {
    if (!patient?.id) { setLoading(false); return }
    const { data } = await supabase.from('plan_inquiries')
      .select('*, insurance_plans(plan_name, company_name, waiting_period_days, pre_existing_condition_policy, additional_terms), agents:claimed_by_agent_id(full_name)')
      .eq('patient_id', patient.id).order('created_at',{ascending:false})
    setInquiries(data||[])
    // Real gap: an agent building a policy directly (Issue Policy / Quote)
    // never showed up anywhere in the patient's own app - the plain
    // inquiry card above (when one even exists) shows the plan/company/
    // agent badge, never the actual quoted premium. A "quote" (not yet
    // active) now shows here regardless of whether it's linked back to a
    // real plan_inquiries row - excluding the linked ones was the actual
    // bug found live-testing: those never showed their premium anywhere
    // either, since the plain inquiry card doesn't carry it.
    // Once "talk to an agent" vs the automated path (lib/planSuitability.js)
    // gets its own upload/matching rebuild, this should be revisited -
    // an auto-issued policy is meant to land under a real "My plans" view
    // instead, not this list.
    const { data: quotes } = await supabase.from('agent_policies')
      .select('*, institutions(name), agents(full_name)')
      .eq('patient_id', patient.id).eq('status', 'quote')
      .order('created_at', { ascending: false })
    setAgentQuotes(quotes || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [patient?.id])

  async function handleRequestSwitch(i) {
    setSwitching(i.id)
    await supabase.from('plan_inquiries').update({
      claimed_by_agent_id: null, claimed_at: null, switch_requested_at: new Date().toISOString(),
    }).eq('id', i.id)
    setSwitching(null)
    load()
  }

  // Real gap found live-testing: re-declaring against the same plan
  // several times left every past attempt stacked in this list forever,
  // with no simple, predictable rule for which one was "the" result for
  // that plan. match_plan_suitability.js now blocks the duplicate at the
  // source instead (amends the one open, non-converted inquiry in place
  // rather than inserting a new row every time) - a pending underwriter
  // case can no longer get silently buried by a newer declaration the
  // way it could before, because there's only ever one open row per
  // plan to begin with. That means the declutter rule here can go back
  // to the simple, obviously-correct one: inquiries already arrive
  // newest-first, so the first one seen per plan_id IS the newest -
  // always the latest quote result, in real chronological order.
  const shownIdPerPlan = new Map()
  for (const i of inquiries) {
    if (!shownIdPerPlan.has(i.plan_id)) shownIdPerPlan.set(i.plan_id, i.id)
  }
  // Real gap found live-testing: the message-board deep link forced
  // showAllInquiries open to guarantee the targeted inquiry was in the
  // list - but that dumped every past declaration for every plan at
  // once, so "a lot of inquiries for the same plan" with identical
  // headers made it impossible to tell which one the link actually
  // meant. The fix is narrower: add ONLY the specific deep-linked
  // inquiry as an exception to the declutter, never the whole hidden set.
  const visibleInquiries = showAllInquiries ? inquiries : inquiries.filter(i => shownIdPerPlan.get(i.plan_id) === i.id || i.id === initialExpandedId)
  const hiddenCount = inquiries.length - visibleInquiries.length

  return (
    <div style={{padding:'16px'}}>
      {loading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'Loading...':'載入中...'}</div>}
      {!loading&&inquiries.length===0&&agentQuotes.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'No plan inquiries yet - ask about a plan from Compare plans.':'暫無計劃查詢 - 請於「比較計劃」查詢。'}</div>}
      {agentQuotes.length>0&&<div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:inquiries.length>0?'16px':0}}>
        {agentQuotes.map(q=>(
          <Card key={q.id}>
            <div style={{padding:'14px 16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:'14px',fontWeight:500}}>{q.plan_name}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{q.institutions?.name||''}{q.premium?` - HK$${q.premium}/mo`:''}</div>
                </div>
                <span style={{fontSize:'11px',background:__theme.accentLight,color:__theme.accent,padding:'4px 10px',borderRadius:'20px',fontWeight:500}}>{isEn?'Agent':'代理'}: {q.agents?.full_name||'—'}</span>
              </div>
              <div style={{fontSize:'12px',color:C.textMuted,marginTop:'8px'}}>{isEn?'A licensed agent has quoted this plan for you - not active yet, still a quote.':'持牌代理已為您報價此計劃 - 尚未生效,仍為報價階段。'}</div>
            </div>
          </Card>
        ))}
      </div>}
      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {visibleInquiries.map(i=>{
          // A patient's real return path to a flagged/pending 'auto'
          // inquiry (aq2-14) - suitabilityResults in Compare Plans is
          // session-only, so this is the only place a case that got
          // decided after the patient closed the app can be found again.
          const isAuto = i.mode === 'auto'
          const isPurchased = i.status === 'converted'
          const isDeclined = i.suitability_verdict === 'declined'
          const isPending = i.underwriter_status === 'pending'
          const isApprovedToBuy = !isDeclined && !isPending
          return (
          <Card key={i.id} data-inquiry-id={i.id} onClick={()=>setExpandedId(expandedId===i.id?null:i.id)} style={i.id===justLinkedId?{boxShadow:`0 0 0 2px ${__theme.accent}`}:undefined}>
            <div style={{padding:'14px 16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:'14px',fontWeight:500}}>{i.insurance_plans?.plan_name}</div>
                  <div style={{fontSize:'12px',color:C.textSub}}>{i.insurance_plans?.company_name}</div>
                  {/* Real gap found live-testing: several inquiries for
                      the same plan render with an identical header - with
                      more than one visible at once there was no way to
                      tell them apart. A submission date makes each one
                      distinguishable at a glance. */}
                  <div style={{fontSize:'10px',color:C.textMuted,marginTop:'2px'}}>{new Date(i.created_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</div>
                </div>
                {isAuto
                  ? <div style={{textAlign:'right',flexShrink:0}}>
                      <span style={{fontSize:'11px',fontWeight:500,padding:'4px 10px',borderRadius:'20px',whiteSpace:'nowrap',background:isPurchased?__theme.accentLight:isDeclined?C.redLight:isPending?C.amberLight:__theme.accentLight,color:isPurchased?__theme.accent:isDeclined?C.red:isPending?C.amber:__theme.accent}}>
                        {isPurchased?(isEn?'✓ Purchased':'✓ 已購買'):isDeclined?(isEn?'✕ Declined':'✕ 已拒絕'):isPending?(isEn?'⚠ Pending approval':'⚠ 待批核'):(isEn?'✓ Approved':'✓ 已批核')}
                      </span>
                      {/* Real gap found live-testing: a clean/approved case
                          never showed its price anywhere on this card - only
                          buried in the expanded summary sentence - so a
                          patient deciding whether to tap in and buy had no
                          price to go on. */}
                      {!isDeclined&&i.quoted_premium_hkd!=null&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>HK${i.quoted_premium_hkd}/mo</div>}
                    </div>
                  : (i.agents?.full_name
                    ? <span style={{fontSize:'11px',background:__theme.accentLight,color:__theme.accent,padding:'4px 10px',borderRadius:'20px',fontWeight:500}}>{isEn?'Agent':'代理'}: {i.agents.full_name}</span>
                    : <span style={{fontSize:'11px',background:C.amberLight,color:C.amber,padding:'4px 10px',borderRadius:'20px',fontWeight:500}}>{isEn?'Waiting for an agent':'等待代理'}</span>)}
              </div>
              {expandedId===i.id&&<div onClick={e=>e.stopPropagation()}>
                {isAuto ? (
                  <>
                    <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6,marginTop:'10px'}}>{i.suitability_summary}</div>
                    {isPending&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'6px'}}>{isEn?'An underwriter usually decides within 2-3 business days - check back here any time.':'核保員一般於2-3個工作天內作出決定 - 可隨時回來查看。'}</div>}
                    {/* Real gap found live-testing: an underwriter's "Request
                        report" was a one-way field with no patient-facing
                        surface at all - a patient asked for more detail
                        just saw "Pending". A static banner fixed visibility
                        but not the actual ask: "it should be a bubble for
                        chat, or a way to select/send medical history or
                        upload a document." It's now the same real
                        inquiry_messages thread + upload PatientInquiryThread
                        already gives an agent-mode inquiry (decide.js seeds
                        the underwriter's request into this same thread) -
                        an uploaded file is only ever on file, never
                        auto-validated, same as any document an underwriter
                        reviews themselves in a real application. */}
                    {isPending&&i.requested_report_note&&<div style={{marginTop:'8px'}}>
                      <div style={{fontWeight:600,fontSize:'12px',color:C.text}}>{isEn?'Your underwriter has asked for more detail':'核保員要求更多資料'}</div>
                      <PatientInquiryThread inquiry={i} patientName={patient.full_name} patientId={patient.id}/>
                    </div>}
                    {isDeclined&&i.underwriter_decision_reason&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'6px'}}>{i.underwriter_decision_reason}</div>}
                    {isDeclined&&<AlternativePlansPanel isEn={isEn} inquiryId={i.id} onViewPlan={onViewPlan}/>}
                    {isApprovedToBuy&&!isPurchased&&<AutoInquiryPurchasePanel isEn={isEn} inquiry={i} patient={patient} onPurchased={load}/>}
                  </>
                ) : (i.agents?.full_name
                  ? <>
                    <PatientInquiryThread inquiry={i} patientName={patient.full_name} patientId={patient.id}/>
                    <div onClick={()=>handleRequestSwitch(i)} style={{fontSize:'12px',color:C.textMuted,textAlign:'center',cursor:'pointer',marginTop:'10px'}}>{switching===i.id?(isEn?'Requesting...':'請求中...'):(isEn?'Request a different agent':'請求更換代理')}</div>
                  </>
                  : <div style={{fontSize:'12px',color:C.textMuted,marginTop:'10px'}}>{isEn?'An agent will claim this inquiry and reach out shortly.':'代理將認領此查詢並盡快聯繫您。'}</div>)}
              </div>}
            </div>
          </Card>
        )})}
        {!showAllInquiries&&hiddenCount>0&&<div onClick={()=>setShowAllInquiries(true)} style={{textAlign:'center',fontSize:'12px',color:C.textMuted,cursor:'pointer',padding:'8px',textDecoration:'underline'}}>{isEn?`Show ${hiddenCount} earlier inquir${hiddenCount===1?'y':'ies'}`:`顯示${hiddenCount}個較早的查詢`}</div>}
        {showAllInquiries&&hiddenCount>0&&<div onClick={()=>setShowAllInquiries(false)} style={{textAlign:'center',fontSize:'12px',color:C.textMuted,cursor:'pointer',padding:'8px',textDecoration:'underline'}}>{isEn?'Hide earlier inquiries':'隱藏較早的查詢'}</div>}
      </div>
    </div>
  )
}

// ── DOCUMENT PREP TAB ────────────────────────────────────────────────────────
// Real gap: a patient facing an insurer's pre-authorization or application
// form (GOP request, a specific claim, whatever) had no way to assemble the
// right documents in one place before sending them off manually. This isn't
// claims adjudication or a live insurer connection - no API exists for
// either yet - it's a checklist: name what's needed, attach what's already
// on file or upload what isn't, see what's still missing. Works standalone
// today; if/when a real insurer or partner connection exists later, this is
// the exact shape that would feed it.
const DOC_PREP_PRESETS = [
  'Policy ID / membership card', 'Referral letter', 'Diagnosis / medical report',
  'Lab result', 'Receipt / invoice', 'Prescription',
  'NIPT / T21 screening report', '20-week structural ultrasound', 'OGTT glucose result',
  'GBS swab result', 'Antenatal history card',
]
function DocumentPrepTab({ isEn, patient={} }) {
  const [bundles,setBundles]=useState([])
  const [loading,setLoading]=useState(true)
  const [creating,setCreating]=useState(false)
  const [openBundleId,setOpenBundleId]=useState(null)

  async function loadBundles() {
    if (!patient?.id) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('document_prep_bundles').select('*').eq('patient_id', patient.id).order('created_at',{ascending:false})
    setBundles(data||[])
    setLoading(false)
  }
  useEffect(() => { loadBundles() }, [patient?.id])

  const openBundle = bundles.find(b=>b.id===openBundleId) || null

  function completeness(b) {
    const items = b.items||[]
    if (items.length===0) return { done:0, total:0 }
    return { done: items.filter(i=>i.attachment_id).length, total: items.length }
  }

  async function updateBundleItems(bundleId, newItems) {
    const allReady = newItems.length>0 && newItems.every(i=>i.attachment_id)
    const { data } = await supabase.from('document_prep_bundles')
      .update({ items: newItems, status: allReady?'ready':'in_progress', updated_at: new Date().toISOString() })
      .eq('id', bundleId).select().maybeSingle()
    if (data) setBundles(prev => prev.map(b=>b.id===bundleId?data:b))
  }

  if (openBundle) return <DocumentPrepBundleDetail isEn={isEn} patient={patient} bundle={openBundle} onBack={()=>setOpenBundleId(null)} onItemsChange={newItems=>updateBundleItems(openBundle.id, newItems)}/>

  return (
    <div>
      <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.navy,lineHeight:1.6}}>
        ◈ {isEn
          ? "Build a checklist of what an insurer needs (a pre-authorization, an application, anything else), then attach what you already have on file or upload what's missing."
          : '為保險公司所需的文件建立清單(預先授權、申請或其他),然後附上已存檔的文件或上傳缺少的文件。'}
      </div>

      <SecLabel>{isEn?'Document bundles':'文件組合'}</SecLabel>
      {loading&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,padding:'16px'}}>{isEn?'Loading…':'載入中…'}</div>}
      {!loading&&bundles.length===0&&!creating&&<div style={{margin:'0 16px',textAlign:'center',fontSize:'12px',color:C.textMuted,padding:'20px 0'}}>{isEn?'No document bundles yet.':'暫無文件組合。'}</div>}
      {!loading&&bundles.map(b=>{
        const { done, total } = completeness(b)
        return (
          <Card key={b.id} style={{padding:'14px 16px',cursor:'pointer'}} onClick={()=>setOpenBundleId(b.id)}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{b.title}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{b.insurer_name||(isEn?'No insurer named':'未指定保險公司')}</div>
              </div>
              <Badge text={b.status==='ready'?(isEn?'Ready':'已就緒'):`${done}/${total}`} type={b.status==='ready'?'ok':'due'}/>
            </div>
          </Card>
        )
      })}

      {!creating
        ? <div style={{padding:'0 16px 20px'}}><Btn style={{width:'100%'}} onClick={()=>setCreating(true)}>+ {isEn?'New document bundle':'新增文件組合'}</Btn></div>
        : <NewDocumentBundleForm isEn={isEn} patient={patient} onCancel={()=>setCreating(false)} onCreated={b=>{setCreating(false);setBundles(prev=>[b,...prev]);setOpenBundleId(b.id)}}/>}
    </div>
  )
}

function NewDocumentBundleForm({ isEn, patient, onCancel, onCreated }) {
  const __theme = useContext(ThemeContext)
  const [title,setTitle]=useState('')
  const [insurerName,setInsurerName]=useState('')
  const [selectedPresets,setSelectedPresets]=useState(new Set())
  const [customItem,setCustomItem]=useState('')
  const [customItems,setCustomItems]=useState([])
  const [sourceFormFile,setSourceFormFile]=useState(null)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)

  function togglePreset(label) {
    setSelectedPresets(prev => { const next = new Set(prev); next.has(label)?next.delete(label):next.add(label); return next })
  }
  function addCustom() {
    const v = customItem.trim()
    if (!v || customItems.includes(v)) return
    setCustomItems(prev => [...prev, v])
    setCustomItem('')
  }

  async function handleCreate() {
    const labels = [...selectedPresets, ...customItems]
    if (!title.trim() || labels.length===0 || !patient?.id) return
    setSaving(true); setError(null)
    // The insurer's own form/instructions, kept as a reference alongside
    // the checklist it's for - not parsed, just attached so the patient
    // (or whoever eventually submits this) can check the bundle against
    // what the form actually asks for.
    let sourceFormAttachmentId = null
    if (sourceFormFile) {
      const path = `${patient.medsa_id || patient.id}/docprep-form-${Date.now()}-${sourceFormFile.name}`
      const { error: upErr } = await supabase.storage.from('patient-uploaded-records').upload(path, sourceFormFile)
      if (upErr) { setError(upErr.message); setSaving(false); return }
      const { data: formAtt, error: attErr } = await supabase.from('medical_record_attachments').insert({
        patient_id: patient.id, category: 'claim_document', file_url: path, file_name: sourceFormFile.name, verification_status: 'unverified',
      }).select().maybeSingle()
      if (attErr) { setError(attErr.message); setSaving(false); return }
      sourceFormAttachmentId = formAtt?.id || null
    }
    const items = labels.map(label => ({ label, attachment_id: null }))
    const { data, error: insErr } = await supabase.from('document_prep_bundles').insert({
      patient_id: patient.id, title: title.trim(), insurer_name: insurerName.trim()||null, items,
      source_form_attachment_id: sourceFormAttachmentId,
    }).select().maybeSingle()
    if (insErr) { setError(insErr.message); setSaving(false); return }
    onCreated(data)
  }

  return (
    <Card style={{margin:'0 16px 20px',padding:'16px'}}>
      <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'4px'}}>{isEn?'What is this for?':'此組合用途'}</div>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder={isEn?'e.g. AIA pre-authorization request':'例如:AIA預先授權申請'} style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'10px'}}/>
      <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'4px'}}>{isEn?'Insurer (optional)':'保險公司(可選)'}</div>
      <input value={insurerName} onChange={e=>setInsurerName(e.target.value)} placeholder={isEn?'e.g. AIA':'例如:AIA'} style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'14px'}}/>

      <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'4px'}}>{isEn?"The insurer's form or instructions (optional)":'保險公司表格或指示(可選)'}</div>
      <label style={{display:'block'}}>
        <div style={{textAlign:'left',border:`1px dashed ${C.border}`,borderRadius:'8px',padding:'10px 12px',cursor:'pointer',fontSize:'12px',color:sourceFormFile?C.text:C.textMuted,marginBottom:'14px'}}>
          {sourceFormFile ? `📄 ${sourceFormFile.name}` : (isEn?'+ Attach the form/letter you received, if any':'+ 附上收到的表格或信件(如有)')}
        </div>
        <input type="file" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0]; if(f) setSourceFormFile(f)}}/>
      </label>

      <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'6px'}}>{isEn?'What documents are needed?':'需要哪些文件?'}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
        {DOC_PREP_PRESETS.map(label=>(
          <div key={label} onClick={()=>togglePreset(label)} style={{padding:'6px 10px',borderRadius:'16px',fontSize:'11px',cursor:'pointer',background:selectedPresets.has(label)?__theme.accent:C.beige,color:selectedPresets.has(label)?'#fff':C.textSub}}>{label}</div>
        ))}
      </div>
      {customItems.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
        {customItems.map(label=>(
          <div key={label} style={{padding:'6px 10px',borderRadius:'16px',fontSize:'11px',background:C.navy,color:'#fff',display:'flex',alignItems:'center',gap:'6px'}}>
            {label}<span onClick={()=>setCustomItems(prev=>prev.filter(l=>l!==label))} style={{cursor:'pointer',fontWeight:700}}>×</span>
          </div>
        ))}
      </div>}
      <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
        <input value={customItem} onChange={e=>setCustomItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addCustom())} placeholder={isEn?'Other document (type your own)':'其他文件(自行輸入)'} style={{flex:1,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'12px',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
        <button onClick={addCustom} disabled={!customItem.trim()} style={{padding:'0 14px',background:C.beige,border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>+ {isEn?'Add':'新增'}</button>
      </div>

      {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'8px'}}>{error}</div>}
      <div style={{display:'flex',gap:'8px'}}>
        <Btn style={{flex:1}} onClick={onCancel}>{isEn?'Cancel':'取消'}</Btn>
        <Btn variant="primary" style={{flex:1}} disabled={saving||!title.trim()||(selectedPresets.size===0&&customItems.length===0)} onClick={handleCreate}>{saving?(isEn?'Creating…':'建立中…'):(isEn?'Create':'建立')}</Btn>
      </div>
    </Card>
  )
}

function DocumentPrepBundleDetail({ isEn, patient, bundle, onBack, onItemsChange }) {
  const [attachments,setAttachments]=useState([])
  const [pickerForIdx,setPickerForIdx]=useState(null)
  const [uploading,setUploading]=useState(false)

  async function loadAttachments() {
    if (!patient?.id) return
    const { data } = await supabase.from('medical_record_attachments')
      .select('id, category, file_name, uploaded_at').eq('patient_id', patient.id).order('uploaded_at',{ascending:false})
    setAttachments(data||[])
  }
  useEffect(() => { loadAttachments() }, [patient?.id])

  function setItemAttachment(idx, attachmentId) {
    const next = (bundle.items||[]).map((it,i)=> i===idx ? { ...it, attachment_id: attachmentId } : it)
    onItemsChange(next)
    setPickerForIdx(null)
  }

  async function uploadForItem(idx, file) {
    if (!file || !patient?.id) return
    setUploading(true)
    const path = `${patient.medsa_id || patient.id}/docprep-${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('patient-uploaded-records').upload(path, file)
    if (upErr) { setUploading(false); return }
    const { data: newAtt } = await supabase.from('medical_record_attachments').insert({
      patient_id: patient.id, category: 'claim_document', file_url: path, file_name: file.name, verification_status: 'unverified',
    }).select().maybeSingle()
    setUploading(false)
    if (newAtt) { await loadAttachments(); setItemAttachment(idx, newAtt.id) }
  }

  async function viewAttachment(attachmentId) {
    const att = attachments.find(a=>a.id===attachmentId)
    if (!att) return
    const { data: full } = await supabase.from('medical_record_attachments').select('file_url').eq('id', attachmentId).maybeSingle()
    if (!full?.file_url) return
    const { data } = await supabase.storage.from('patient-uploaded-records').createSignedUrl(full.file_url, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const items = bundle.items||[]
  const done = items.filter(i=>i.attachment_id).length

  return (
    <div>
      <div style={{padding:'16px 16px 0'}}>
        <span onClick={onBack} style={{fontSize:'12px',color:C.textMuted,cursor:'pointer'}}>← {isEn?'Back':'返回'}</span>
      </div>
      <div style={{padding:'10px 16px 0'}}>
        <div style={{fontSize:'17px',fontWeight:700}}>{bundle.title}</div>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'4px'}}>{bundle.insurer_name||(isEn?'No insurer named':'未指定保險公司')} · {done}/{items.length} {isEn?'attached':'已附上'}</div>
        {bundle.source_form_attachment_id&&<span onClick={()=>viewAttachment(bundle.source_form_attachment_id)} style={{fontSize:'12px',color:C.navy,cursor:'pointer'}}>📄 {isEn?"View the insurer's form you uploaded":'查看已上傳的保險公司表格'} →</span>}
      </div>

      {items.map((item,idx)=>(
        <Card key={idx} style={{margin:'10px 16px 0',padding:'12px 14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:item.attachment_id||pickerForIdx===idx?'10px':0}}>
            <div style={{fontSize:'13px',fontWeight:500}}>{item.label}</div>
            {item.attachment_id
              ? <Badge text={isEn?'Attached':'已附上'} type="ok"/>
              : <Badge text={isEn?'Missing':'缺少'} type="due"/>}
          </div>
          {item.attachment_id && <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span onClick={()=>viewAttachment(item.attachment_id)} style={{fontSize:'12px',color:C.navy,cursor:'pointer'}}>📄 {attachments.find(a=>a.id===item.attachment_id)?.file_name||(isEn?'View file':'查看文件')}</span>
            <span onClick={()=>setItemAttachment(idx,null)} style={{fontSize:'11px',color:C.textMuted,cursor:'pointer'}}>{isEn?'Remove':'移除'}</span>
          </div>}
          {!item.attachment_id && pickerForIdx!==idx && <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>setPickerForIdx(idx)}>{isEn?'Choose existing':'選擇已有文件'}</Btn>
            <label style={{flex:1}}>
              <div style={{textAlign:'center',border:`1px dashed ${C.border}`,borderRadius:'10px',padding:'9px',cursor:uploading?'default':'pointer',fontSize:'12px',fontWeight:500,opacity:uploading?0.6:1}}>{uploading?(isEn?'Uploading…':'上傳中…'):(isEn?'+ Upload':'+ 上傳')}</div>
              <input type="file" style={{display:'none'}} disabled={uploading} onChange={e=>{const f=e.target.files?.[0]; e.target.value=''; if(f) uploadForItem(idx,f)}}/>
            </label>
          </div>}
          {pickerForIdx===idx && <div style={{marginTop:'6px'}}>
            {attachments.length===0
              ? <div style={{fontSize:'12px',color:C.textMuted,fontStyle:'italic'}}>{isEn?'No files on file yet - upload one instead.':'暫無已存檔文件 - 請改為上傳。'}</div>
              : attachments.map(a=>(
                <div key={a.id} onClick={()=>setItemAttachment(idx,a.id)} style={{padding:'8px 0',borderBottom:`0.5px solid ${C.border}`,cursor:'pointer',fontSize:'12px'}}>{a.file_name||a.category}</div>
              ))}
            <span onClick={()=>setPickerForIdx(null)} style={{fontSize:'11px',color:C.textMuted,cursor:'pointer',display:'block',marginTop:'6px'}}>{isEn?'Cancel':'取消'}</span>
          </div>}
        </Card>
      ))}

      <div style={{margin:'16px 16px 20px',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.amber,lineHeight:1.6}}>
        ⚠ {isEn
          ? 'This organizes your own documents for you to send yourself - Medsa does not submit this to any insurer automatically yet.'
          : '此功能僅為您整理文件,供您自行發送 - Medsa目前尚未自動將文件提交予任何保險公司。'}
      </div>
    </div>
  )
}

// ── CLAIMS TAB ───────────────────────────────────────────────────────────────
// Two real submission paths:
// 1) A visit already on file at a Medsa-connected clinic - receipt and
//    diagnosis are already real structured data (medical_records), so
//    submitting is just picking the visit and confirming the amount.
// 2) An out-of-network receipt - genuinely nothing on file, so the
//    patient uploads it directly, right here, and can name the clinic
//    so it's checked against clinics Medsa already knows about (network
//    partners, TPA-registered clinics, HK-government-registered
//    clinics) - the same trust check the TPA portal itself runs, just
//    initiated from the patient's side instead of the clinic's.
function ClaimsTab({ isEn, claims=[], patient={}, records=[], activePolicy=null, heldPolicies=[] }) {
  const __theme = useContext(ThemeContext)
  const hasLiveClaims = claims.length > 0
  const [claimSearch,setClaimSearch]=useState('')
  const [claimPlanFilter,setClaimPlanFilter]=useState('')
  // Real gap this closes: with claims now syncing automatically from
  // every submission path (ClinicOps, TPA portal, patient upload), a
  // patient holding more than one policy had no way to find one claim,
  // or narrow the list down to just one plan, without scrolling past
  // everything else.
  const claimPlanOptions = [...new Map(claims.filter(c=>c.insurance_plans).map(c=>[c.plan_id, c.insurance_plans.plan_name])).entries()]
  const visibleClaims = claims.filter(c => {
    if (claimPlanFilter && c.plan_id !== claimPlanFilter) return false
    const q = claimSearch.trim().toLowerCase()
    if (!q) return true
    return [c.claim_ref, c.institutions?.name, c.insurance_plans?.plan_name, c.claim_type].filter(Boolean).some(s => s.toLowerCase().includes(q))
  })

  const [attachments,setAttachments]=useState([])
  const [uploadingReceipt,setUploadingReceipt]=useState(false)
  const [uploadError,setUploadError]=useState(null)

  // Every claim already on file for this patient, keyed by id, so a
  // visit already claimed under one plan can still show that plan's
  // name instead of just vanishing - and so submitting the SAME visit
  // again under a DIFFERENT plan (coordination of benefits between two
  // insurers) is a warned choice, not a silent duplicate.
  const [existingClaimsById,setExistingClaimsById]=useState({})
  useEffect(() => {
    const claimIds = [...new Set(records.map(r=>r.insurance_claim_id).filter(Boolean))]
    if (claimIds.length===0) { setExistingClaimsById({}); return }
    supabase.from('insurance_claims').select('id, plan_id, amount, insurer_covered_amount, insurance_plans(plan_name)').in('id', claimIds)
      .then(({data}) => setExistingClaimsById(Object.fromEntries((data||[]).map(c=>[c.id,c]))))
  }, [records])

  const [selectedVisitId,setSelectedVisitId]=useState('')
  const [visitPlanId,setVisitPlanId]=useState(activePolicy?.plan_id || '')
  const [visitAmount,setVisitAmount]=useState('')
  const [visitSubmitting,setVisitSubmitting]=useState(false)
  const [visitSubmitError,setVisitSubmitError]=useState(null)
  const [visitSubmitSuccess,setVisitSubmitSuccess]=useState(null)

  const [manualSelectedIds,setManualSelectedIds]=useState(new Set())
  const [manualAmount,setManualAmount]=useState('')
  const [manualServiceDate,setManualServiceDate]=useState('')
  const [manualClinicName,setManualClinicName]=useState('')
  const [manualClinicCheck,setManualClinicCheck]=useState(null) // null=not checked, 'checking', {verified,label}
  const [manualPlanId,setManualPlanId]=useState(activePolicy?.plan_id || '')
  const [manualSubmitting,setManualSubmitting]=useState(false)
  const [manualSubmitError,setManualSubmitError]=useState(null)
  const [manualSubmitSuccess,setManualSubmitSuccess]=useState(null)

  async function loadAttachments() {
    if (!patient?.id) return
    const { data } = await supabase.from('medical_record_attachments')
      .select('id, category, file_name, uploaded_at, insurance_claim_id').eq('patient_id', patient.id)
      .is('insurance_claim_id', null).order('uploaded_at',{ascending:false})
    setAttachments(data||[])
  }
  useEffect(() => { loadAttachments() }, [patient?.id])

  // Visits with real receipt/diagnosis data - shown regardless of prior
  // claim status now (the dropdown itself explains why an already-claimed
  // one needs care), rather than silently disappearing once claimed.
  const visitsWithData = records.filter(r => r.total_fee!=null || r.diagnosis)
  const selectedVisit = records.find(r=>r.id===selectedVisitId) || null
  const selectedVisitExistingClaim = selectedVisit?.insurance_claim_id ? existingClaimsById[selectedVisit.insurance_claim_id] : null
  // A true duplicate only when the SAME plan is picked again - a
  // different plan than the one already on the claim is a real,
  // legitimate coordination-of-benefits submission to a second insurer,
  // not a duplicate, so it's warned rather than blocked.
  const isDuplicateForSelectedPlan = selectedVisitExistingClaim && selectedVisitExistingClaim.plan_id === visitPlanId
  // Real coordination-of-benefits rule this was missing: a second
  // insurer only ever owes what the FIRST one left unpaid on the same
  // bill, never the full amount again - otherwise claiming the same
  // visit against two policies pays out more than the visit actually
  // cost. This isn't something that varies by policy wording the way
  // waiting periods or deductibles do - every indemnity health policy's
  // "other insurance" clause works this way, so it's applied here
  // unconditionally rather than as a per-plan setting.
  const isCoordinationClaim = selectedVisitExistingClaim && !isDuplicateForSelectedPlan
  const billTotal = visitAmount.trim() ? Number(visitAmount) : (selectedVisit?.total_fee ?? 0)
  const alreadyCoveredByFirstInsurer = selectedVisitExistingClaim?.insurer_covered_amount ?? 0
  const coordinationCappedAmount = isCoordinationClaim ? Math.max(0, billTotal - alreadyCoveredByFirstInsurer) : billTotal
  // Real timely-filing rule this was missing: a claim for a visit that
  // happened long ago should be flagged, not quietly accepted as if it
  // were submitted the same week - real plans almost universally require
  // filing within a set window of the service date (often ~90 days).
  // Platform default, same idea as the deductible/copay defaults in
  // lib/insuranceAdapter.js - not yet a per-plan setting.
  const CLAIM_FILING_DEADLINE_DAYS = 90
  const visitDaysOld = selectedVisit?.date_of_record ? Math.floor((Date.now() - new Date(selectedVisit.date_of_record).getTime()) / (1000*60*60*24)) : null
  const visitPastFilingDeadline = visitDaysOld != null && visitDaysOld > CLAIM_FILING_DEADLINE_DAYS

  function pickVisit(id) {
    setSelectedVisitId(id)
    setVisitSubmitSuccess(null); setVisitSubmitError(null)
    const v = records.find(r=>r.id===id)
    setVisitAmount(v?.total_fee!=null ? String(v.total_fee) : '')
  }

  async function handleSubmitFromVisit() {
    if (!selectedVisit || !visitPlanId || !patient?.id || isDuplicateForSelectedPlan) return
    if (visitPastFilingDeadline) { setVisitSubmitError(`This visit was ${visitDaysOld} days ago - past the ${CLAIM_FILING_DEADLINE_DAYS}-day filing window, so it can't be submitted here. Contact the insurer directly if you believe an exception applies.`); return }
    setVisitSubmitting(true); setVisitSubmitError(null)
    const claimRef = `CLM-${Date.now().toString(36).toUpperCase()}`
    const { data: newClaim, error: claimErr } = await supabase.from('insurance_claims').insert({
      claim_ref: claimRef, patient_id: patient.id, plan_id: visitPlanId,
      claim_type: selectedVisit.record_type || 'outpatient',
      // Coordination of benefits: a second insurer on the same visit only
      // ever owes what the first left unpaid, never the full bill again.
      amount: coordinationCappedAmount,
      service_date: selectedVisit.date_of_record || null,
      status: 'pending_review', submitted_at: new Date().toISOString(),
      source_type: 'patient_unverified_upload', verification_flag: 'patient_unverified_receipt',
      institution_id: selectedVisit.institution_id || null,
    }).select().maybeSingle()
    if (claimErr) { setVisitSubmitError(claimErr.message); setVisitSubmitting(false); return }
    // Only overwrites the visit's OWN claim link when this is its first
    // claim - a second claim under a different plan (coordination of
    // benefits) is real, but medical_records can only point at one claim
    // at a time, so the newest one wins for "what does Records show."
    await supabase.from('medical_records').update({ insurance_claim_id: newClaim.id }).eq('id', selectedVisit.id)
    setVisitSubmitSuccess(claimRef)
    setVisitSubmitting(false)
  }

  // Real upload, right on this screen - no more "go upload it somewhere
  // else first."
  async function handleUploadReceipt(file) {
    if (!file || !patient?.id) return
    setUploadingReceipt(true); setUploadError(null)
    const path = `${patient.medsa_id || patient.id}/claim-${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('patient-uploaded-records').upload(path, file)
    if (upErr) { setUploadError(upErr.message); setUploadingReceipt(false); return }
    const { data: newAtt, error: insErr } = await supabase.from('medical_record_attachments').insert({
      patient_id: patient.id, category: 'claim_document', file_url: path, file_name: file.name,
      verification_status: 'unverified',
    }).select().maybeSingle()
    if (insErr) { setUploadError(insErr.message); setUploadingReceipt(false); return }
    await loadAttachments()
    if (newAtt) setManualSelectedIds(prev => new Set(prev).add(newAtt.id))
    setUploadingReceipt(false)
  }

  function toggleManualAttachment(id) {
    setManualSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  // Same trust check the TPA portal's own onboarding runs, just against
  // what the patient typed instead of what a clinic registered with -
  // a name that matches a real Medsa-network clinic, a TPA-registered
  // clinic, or an HK-government-registered clinic (business registration/
  // ORPHF) is a real signal for the reviewer, not just the patient's word.
  async function checkClinicName(name) {
    const q = name.trim()
    if (!q) { setManualClinicCheck(null); return }
    setManualClinicCheck('checking')
    const [{data:inst},{data:ext},{data:ver}] = await Promise.all([
      supabase.from('institutions').select('id, name').ilike('name', `%${q}%`).limit(1),
      supabase.from('external_clinics').select('id, clinic_name').eq('status','active').ilike('clinic_name', `%${q}%`).limit(1),
      supabase.from('verified_clinics').select('id, clinic_name_declared').or(`clinic_name_declared.ilike.%${q}%,clinic_name_matched_br.ilike.%${q}%`).limit(1),
    ])
    if (inst?.length) setManualClinicCheck({verified:true, label:'Matches a Medsa-network clinic'})
    else if (ext?.length) setManualClinicCheck({verified:true, label:'Matches a TPA-registered clinic'})
    else if (ver?.length) setManualClinicCheck({verified:true, label:'Matches an HK-government-registered clinic'})
    else setManualClinicCheck({verified:false, label:'Not found in our clinic records'})
  }

  async function handleSubmitManualClaim() {
    if (!manualPlanId || manualSelectedIds.size===0 || !patient?.id) return
    // Same filing-window rule as the visit-based path above - this form
    // has no linked visit record to read a date from, so it asks for one
    // directly instead of silently skipping the check.
    if (manualServiceDate) {
      const daysOld = Math.floor((Date.now() - new Date(manualServiceDate).getTime()) / (1000*60*60*24))
      if (daysOld > CLAIM_FILING_DEADLINE_DAYS) { setManualSubmitError(`That date was ${daysOld} days ago - past the ${CLAIM_FILING_DEADLINE_DAYS}-day filing window. Contact the insurer directly if you believe an exception applies.`); return }
    }
    setManualSubmitting(true); setManualSubmitError(null)
    const claimRef = `CLM-${Date.now().toString(36).toUpperCase()}`
    const { data: newClaim, error: claimErr } = await supabase.from('insurance_claims').insert({
      claim_ref: claimRef, patient_id: patient.id, plan_id: manualPlanId,
      claim_type: 'outpatient', amount: manualAmount.trim() ? Number(manualAmount) : null,
      service_date: manualServiceDate || null,
      status: 'pending_review', submitted_at: new Date().toISOString(),
      source_type: 'patient_unverified_upload', verification_flag: 'patient_unverified_receipt',
      claimed_clinic_name: manualClinicName.trim() || null,
      claimed_clinic_verified: manualClinicCheck?.verified ?? null,
    }).select().maybeSingle()
    if (claimErr) { setManualSubmitError(claimErr.message); setManualSubmitting(false); return }
    const ids = Array.from(manualSelectedIds)
    const { error: linkErr } = await supabase.from('medical_record_attachments').update({ insurance_claim_id: newClaim.id }).in('id', ids)
    if (linkErr) { setManualSubmitError(linkErr.message); setManualSubmitting(false); return }
    await loadAttachments()
    setManualSelectedIds(new Set()); setManualAmount(''); setManualServiceDate(''); setManualClinicName(''); setManualClinicCheck(null)
    setManualSubmitSuccess(claimRef)
    setManualSubmitting(false)
  }

  return (
    <div>
      {/* Real claims already sync automatically the moment a clinic on
          Medsa (or the direct insurer API) adjudicates one. */}
      <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.navy,lineHeight:1.6}}>
        ◈ Claims submitted through a Medsa-connected clinic sync here automatically - status updates and approvals reflect what your insurer has decided. You can also submit a claim yourself below.
      </div>

      <SecLabel>{isEn?'Claims':'索賠'}</SecLabel>
      {hasLiveClaims&&<div style={{margin:'0 16px 10px',display:'flex',gap:'8px'}}>
        <input value={claimSearch} onChange={e=>setClaimSearch(e.target.value)} placeholder={isEn?'Search claims…':'搜尋索償…'} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:'#fff',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
        {claimPlanOptions.length>1&&<select value={claimPlanFilter} onChange={e=>setClaimPlanFilter(e.target.value)} style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 10px',fontSize:'12px',background:'#fff',outline:'none',fontFamily:'inherit',flexShrink:0,maxWidth:'40%'}}>
          <option value="">{isEn?'All plans':'所有計劃'}</option>
          {claimPlanOptions.map(([planId,name])=><option key={planId} value={planId}>{name}</option>)}
        </select>}
      </div>}
      {!hasLiveClaims&&<div style={{margin:'0 16px 8px',textAlign:'center',fontSize:'12px',color:C.textMuted,padding:'20px 0'}}>{isEn?'No claims yet.':'暫無索償記錄。'}</div>}
      {hasLiveClaims&&visibleClaims.length===0&&<div style={{margin:'0 16px 8px',textAlign:'center',fontSize:'12px',color:C.textMuted,padding:'20px 0'}}>{isEn?'No claims match your search.':'沒有符合搜尋的索償。'}</div>}
      {hasLiveClaims && visibleClaims.map((c,i)=>{
        const statusType = c.status==='approved'||c.status==='settled'?'ok':c.status==='rejected'?'full':'due'
        const date = new Date(c.submitted_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})
        const covered = c.insurer_covered_amount ?? c.plan_covers ?? 0
        return(
          <Card key={i} style={{padding:'14px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:500}}>{c.claim_ref}{c.institutions?.name?` · ${c.institutions.name}`:''}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{[c.insurance_plans?.plan_name||c.insurance_plans?.company_name, c.claim_type].filter(Boolean).join(' · ')}</div>
                <div style={{fontSize:'11px',color:C.textMuted}}>Submitted {date}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'14px',fontWeight:600,color:__theme.accent}}>HK${covered.toLocaleString()}</div>
                <Badge text={c.status.charAt(0).toUpperCase()+c.status.slice(1)} type={statusType}/>
              </div>
            </div>
            {c.verification_flag==='patient_unverified_receipt'&&<div style={{fontSize:'11px',color:C.amber,marginTop:'6px'}}>{isEn?'Submitted by you - your insurer verifies this independently.':'由您提交 - 您的保險公司將自行核實此索償。'}</div>}
          </Card>
        )
      })}

      {!activePolicy&&<div style={{margin:'16px 16px 0',fontSize:'12px',color:C.textMuted,fontStyle:'italic'}}>{isEn?'Add your policy above first - a claim needs a policy to submit against.':'請先在上方新增您的保單 - 索償需要對應保單。'}</div>}

      {/* Path 1: a visit Medsa already has real data for. The headline
          action on this tab - a highlighted card, not a plain section,
          since this covers the common case (a Medsa-network visit) with
          nothing to upload at all. */}
      {activePolicy&&<div style={{margin:'16px 16px 0',background:`linear-gradient(135deg,${C.navy} 0%,${C.blue} 100%)`,borderRadius:'16px',padding:'18px',color:'#fff'}}>
        <div style={{fontSize:'15px',fontWeight:700,marginBottom:'4px'}}>{isEn?'Submit a claim from a visit on file':'從已存檔的診症提交索償'}</div>
        <div style={{fontSize:'12px',opacity:0.85,marginBottom:'14px',lineHeight:1.5}}>{isEn?'For a visit at a Medsa-connected clinic - the receipt and diagnosis are already on file, nothing to upload.':'適用於在Medsa診所的診症 - 收據及診斷已存檔,無需上傳任何文件。'}</div>

        {visitsWithData.length===0
          ? <div style={{fontSize:'12px',opacity:0.8,fontStyle:'italic'}}>{isEn?'No visits on file yet.':'暫無已存檔的診症記錄。'}</div>
          : <select value={selectedVisitId} onChange={e=>pickVisit(e.target.value)} style={{width:'100%',border:'none',borderRadius:'8px',padding:'11px 12px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:selectedVisitId?'12px':0,background:'#fff',color:C.text}}>
              <option value="">{isEn?'Select a visit…':'選擇診症…'}</option>
              {visitsWithData.map(v=>{
                const claimed = v.insurance_claim_id ? existingClaimsById[v.insurance_claim_id] : null
                const label = `${v.date_of_record?new Date(v.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}):''} · ${v.diagnosis||v.title||'Visit'}${v.total_fee!=null?` · HK$${v.total_fee}`:''}${claimed?` · already claimed (${claimed.insurance_plans?.plan_name||'a plan'})`:''}`
                return <option key={v.id} value={v.id}>{label}</option>
              })}
            </select>}

        {selectedVisit&&<div style={{background:'rgba(255,255,255,0.12)',borderRadius:'10px',padding:'14px'}}>
          {selectedVisit.icd10_code&&<div style={{fontSize:'11px',opacity:0.8,marginBottom:'8px'}}>ICD-10: {selectedVisit.icd10_code}</div>}

          {heldPolicies.length>1
            ? <>
                <div style={{fontSize:'11px',opacity:0.8,marginBottom:'4px'}}>{isEn?'Bill against which policy?':'向哪份保單提交?'}</div>
                <select value={visitPlanId} onChange={e=>setVisitPlanId(e.target.value)} style={{width:'100%',border:'none',borderRadius:'8px',padding:'9px 12px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'10px',background:'#fff',color:C.text}}>
                  {heldPolicies.map(p=><option key={p.id} value={p.plan_id}>{p.plan_name}</option>)}
                </select>
              </>
            : <div style={{fontSize:'12px',opacity:0.85,marginBottom:'10px'}}>{isEn?`Submitting against ${activePolicy.plan_name}`:`提交至 ${activePolicy.plan_name}`}</div>}

          {selectedVisitExistingClaim&&(isDuplicateForSelectedPlan
            ? <div style={{background:'rgba(255,255,255,0.2)',borderRadius:'8px',padding:'10px 12px',marginBottom:'10px',fontSize:'12px'}}>{'⚠'} {isEn?`Already claimed against ${selectedVisitExistingClaim.insurance_plans?.plan_name||'this plan'} - can't submit the same visit twice under the same plan.`:`此診症已向${selectedVisitExistingClaim.insurance_plans?.plan_name||'此計劃'}提交索償 - 不能就同一計劃重複提交。`}</div>
            : <div style={{background:'rgba(255,255,255,0.2)',borderRadius:'8px',padding:'10px 12px',marginBottom:'10px',fontSize:'12px'}}>{'◇'} {isEn?`Already claimed against ${selectedVisitExistingClaim.insurance_plans?.plan_name||'another plan'} - that insurer already covered HK$${alreadyCoveredByFirstInsurer}, so this one can only claim the remaining HK$${coordinationCappedAmount} of the bill, never the full amount again.`:`此診症已向${selectedVisitExistingClaim.insurance_plans?.plan_name||'另一計劃'}提交索償 - 該保險公司已支付HK$${alreadyCoveredByFirstInsurer},故此次只可就餘下的HK$${coordinationCappedAmount}提出索償,不可重複索取全額。`}</div>)}
          {visitPastFilingDeadline&&<div style={{background:'rgba(255,255,255,0.2)',borderRadius:'8px',padding:'10px 12px',marginBottom:'10px',fontSize:'12px'}}>{'⚠'} {isEn?`This visit was ${visitDaysOld} days ago - past the ${CLAIM_FILING_DEADLINE_DAYS}-day filing window most plans allow. Contact the insurer directly if you believe an exception applies.`:`此診症已過去${visitDaysOld}天 - 超出大部分計劃的${CLAIM_FILING_DEADLINE_DAYS}天提交期限。如認為適用例外情況,請直接聯絡保險公司。`}</div>}

          <input value={visitAmount} onChange={e=>setVisitAmount(e.target.value)} type="number" placeholder={isEn?'Amount you’re claiming, HK$':'索償金額(港幣)'} style={{width:'100%',border:'none',borderRadius:'8px',padding:'9px 12px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'10px',background:'#fff',color:C.text}}/>
          {visitSubmitError&&<div style={{fontSize:'12px',color:'#ffb3b3',marginBottom:'8px'}}>{visitSubmitError}</div>}
          {visitSubmitSuccess
            ? <div style={{background:'#fff',borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:__theme.accent,fontWeight:600}}>✓ {isEn?`Submitted as ${visitSubmitSuccess}. Your insurer will verify it independently.`:`已提交,索償編號 ${visitSubmitSuccess}。您的保險公司將自行核實。`}</div>
            : <Btn variant="primary" style={{width:'100%',background:'#fff',color:C.navy}} disabled={visitSubmitting||isDuplicateForSelectedPlan||visitPastFilingDeadline} onClick={handleSubmitFromVisit}>{visitSubmitting?(isEn?'Submitting…':'提交中…'):(isEn?'Submit this visit as a claim':'提交此診症索償')}</Btn>}
        </div>}
      </div>}

      {/* Path 2: genuinely out-of-network. Same headline-card treatment as
          Path 1 above (colored background, white content box for the
          form) - a plain white Card sitting right under a bold gradient
          one read as "the real option and the afterthought," when both
          are equally legitimate, equally common ways to submit a claim.
          A different gradient (green, not navy) keeps the two visually
          distinguishable as different flows without one outranking the
          other. */}
      {activePolicy&&<div style={{margin:'16px 16px 0',background:`linear-gradient(135deg,${__theme.accent} 0%,${__theme.accentMid} 100%)`,borderRadius:'16px',padding:'18px',color:'#fff'}}>
        <div style={{fontSize:'15px',fontWeight:700,marginBottom:'4px'}}>{isEn?'Submit an out-of-network receipt':'提交非Medsa診所收據'}</div>
        <div style={{fontSize:'12px',opacity:0.85,marginBottom:'14px',lineHeight:1.5}}>{isEn
          ?'For a clinic not on Medsa - upload a receipt (and diagnosis letter, if it\'s a separate document).'
          :'適用於非Medsa診所 - 上傳收據(如診斷證明為獨立文件,請一併上傳)。'}</div>

        <div style={{background:'rgba(255,255,255,0.12)',borderRadius:'10px',padding:'14px'}}>
          <div style={{fontSize:'11px',opacity:0.8,marginBottom:'4px'}}>{isEn?'Clinic name':'診所名稱'}</div>
          <input value={manualClinicName} onChange={e=>setManualClinicName(e.target.value)} onBlur={()=>checkClinicName(manualClinicName)} placeholder={isEn?'e.g. Matilda International Hospital':'例如:明德國際醫院'} style={{width:'100%',border:'none',borderRadius:'8px',padding:'9px 12px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'4px',background:'#fff',color:C.text}}/>
          {manualClinicCheck==='checking'&&<div style={{fontSize:'11px',opacity:0.75,marginBottom:'10px'}}>{isEn?'Checking…':'檢查中…'}</div>}
          {manualClinicCheck&&manualClinicCheck!=='checking'&&<div style={{fontSize:'11px',opacity:manualClinicCheck.verified?1:0.75,fontWeight:manualClinicCheck.verified?600:400,marginBottom:'10px'}}>{manualClinicCheck.verified?'✓':'◇'} {manualClinicCheck.label}</div>}

          <label style={{display:'block',textAlign:'center',border:'1.5px dashed rgba(255,255,255,0.5)',borderRadius:'10px',padding:'16px',cursor:uploadingReceipt?'default':'pointer',marginBottom:'10px',fontSize:'13px',fontWeight:500,opacity:uploadingReceipt?0.6:1}}>
            {uploadingReceipt?(isEn?'Uploading…':'上傳中…'):(isEn?'+ Upload a receipt or document':'+ 上傳收據或文件')}
            <input type="file" style={{display:'none'}} disabled={uploadingReceipt} onChange={e=>{const f=e.target.files?.[0]; e.target.value=''; if(f) handleUploadReceipt(f)}}/>
          </label>
          {uploadError&&<div style={{fontSize:'12px',color:'#ffb3b3',marginBottom:'8px'}}>{uploadError}</div>}
          {attachments.length===0
            ? <div style={{fontSize:'12px',opacity:0.7,fontStyle:'italic',marginBottom:'10px'}}>{isEn?'No unclaimed uploads yet.':'暫無未提交的上傳文件。'}</div>
            : attachments.map(a=>(
              <div key={a.id} onClick={()=>toggleManualAttachment(a.id)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'0.5px solid rgba(255,255,255,0.25)',cursor:'pointer'}}>
                <div style={{width:18,height:18,borderRadius:'5px',border:`1.5px solid ${manualSelectedIds.has(a.id)?'#fff':'rgba(255,255,255,0.5)'}`,background:manualSelectedIds.has(a.id)?'#fff':'transparent',color:__theme.accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',flexShrink:0,fontWeight:700}}>{manualSelectedIds.has(a.id)?'✓':''}</div>
                <div style={{fontSize:'13px'}}>{a.file_name||a.category}</div>
              </div>
            ))}

          {heldPolicies.length>1&&<>
            <div style={{fontSize:'11px',opacity:0.8,margin:'10px 0 4px'}}>{isEn?'Bill against which policy?':'向哪份保單提交?'}</div>
            <select value={manualPlanId} onChange={e=>setManualPlanId(e.target.value)} style={{width:'100%',border:'none',borderRadius:'8px',padding:'9px 12px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',background:'#fff',color:C.text}}>
              {heldPolicies.map(p=><option key={p.id} value={p.plan_id}>{p.plan_name}</option>)}
            </select>
          </>}

          <div style={{fontSize:'11px',opacity:0.8,margin:'10px 0 4px'}}>{isEn?'Date of service':'診症日期'}</div>
          <input value={manualServiceDate} onChange={e=>setManualServiceDate(e.target.value)} type="date" max={new Date().toISOString().slice(0,10)} style={{width:'100%',border:'none',borderRadius:'8px',padding:'9px 12px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'10px',background:'#fff',color:C.text}}/>
          <input value={manualAmount} onChange={e=>setManualAmount(e.target.value)} type="number" placeholder={isEn?'Amount you’re claiming, HK$ (optional)':'索償金額(港幣,可留空)'} style={{width:'100%',border:'none',borderRadius:'8px',padding:'9px 12px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',margin:'10px 0',background:'#fff',color:C.text}}/>
          {manualSubmitError&&<div style={{fontSize:'12px',color:'#ffb3b3',marginBottom:'8px'}}>{manualSubmitError}</div>}
          {manualSubmitSuccess
            ? <div style={{background:'#fff',borderRadius:'8px',padding:'10px 12px',fontSize:'12px',color:__theme.accent,fontWeight:600}}>✓ {isEn?`Submitted as ${manualSubmitSuccess}. Your insurer will verify it independently.`:`已提交,索償編號 ${manualSubmitSuccess}。您的保險公司將自行核實。`}</div>
            : <Btn variant="primary" style={{width:'100%',background:'#fff',color:__theme.accent}} disabled={manualSelectedIds.size===0||manualSubmitting} onClick={handleSubmitManualClaim}>{manualSubmitting?(isEn?'Submitting…':'提交中…'):(isEn?'Submit for insurer review':'提交予保險公司審核')}</Btn>}
        </div>
      </div>}

      {/* Medsa disclaimer */}
      <div style={{margin:'12px 16px 16px',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.amber,lineHeight:1.6}}>
        ⚠ <strong>{isEn?'Important:':'重要提示:'}</strong> {isEn
          ? 'Medsa flags what you submit and passes it to your insurer - it never verifies the receipt or calculates a payout itself. Requirements vary by insurer and plan; when in doubt, contact your assigned agent or insurer directly before submitting.'
          : 'Medsa會標記您提交的內容並轉交您的保險公司 - Medsa本身不會核實收據或計算賠付金額。要求因保險公司及計劃而異;如有疑問,請於提交前直接聯絡您的代理人或保險公司。'}
      </div>
    </div>
  )
}

// ── COMMUNITY FORUM ─────────────────────────────────────────────────────────
// Anonymous product discussion - every patient here has already gone
// through real ID verification for their portfolio, so posting still
// ties to a real patient_id for moderation, but only a stable pseudonym
// (generated once, reused forever) ever shows on screen.
//
// One thread per product, search-first creation - same pattern already
// used in claim-clinic.jsx (search before you can create, so an exact
// match never gets duplicated). For a near-miss that isn't an exact
// match ("Panadol" vs "Panadol Extra"), the new thread still gets
// created - never blocked - but a forum_duplicate_flags row goes to a
// Medsa employee to confirm/merge in content-manager.jsx. No auto-merge.

// A blocklist check, not a content-moderation model - catches plain
// profanity in English and common Cantonese/Chinese slurs, not clever
// misspellings or context-dependent abuse. That gap is exactly what the
// existing per-post "Report" button and the moderation queue in
// medsa-admin.jsx are there to cover.
const FORUM_BLOCKED_WORDS = ['fuck','shit','bitch','asshole','cunt','faggot','retard','nigger','diu','7up','on9','on show','sei9','sei lo','屌','X你','仆街','冚家鏟','戇鳩','傻鳩','9up']

function containsProfanity(text) {
  const lower = (text||'').toLowerCase()
  return FORUM_BLOCKED_WORDS.some(w => lower.includes(w.toLowerCase()))
}

const FORUM_FILLER_WORDS = new Set(['extra','strength','tablets','tablet','capsules','capsule','caps','softgel','softgels','mg','ml','plus','the','a','an'])

function normalizeProductName(name) {
  return (name||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/)
    .filter(w=>w && !FORUM_FILLER_WORDS.has(w) && !/^\d+$/.test(w)).sort().join(' ')
}

function levenshtein(a, b) {
  const dp = Array.from({length:a.length+1},()=>new Array(b.length+1).fill(0))
  for (let i=0;i<=a.length;i++) dp[i][0]=i
  for (let j=0;j<=b.length;j++) dp[0][j]=j
  for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++)
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1])
  return dp[a.length][b.length]
}

function nameSimilarity(a, b) {
  const wordsA = new Set(a.split(' ').filter(Boolean))
  const wordsB = new Set(b.split(' ').filter(Boolean))
  if (wordsA.size===0 || wordsB.size===0) return 0
  const intersection = [...wordsA].filter(w=>wordsB.has(w)).length
  const union = new Set([...wordsA,...wordsB]).size
  const jaccard = intersection/union
  // Word-overlap alone misses a typo-duplicate like "panadol" vs
  // "panadoll" - zero shared whole words, but one extra letter. A
  // character-level distance on the full normalized string catches
  // this; taking the max with Jaccard means neither check has to carry
  // cases the other handles better.
  const dist = levenshtein(a, b)
  const charSim = 1 - dist / Math.max(a.length, b.length, 1)
  return Math.max(jaccard, charSim)
}

async function getOrCreateForumIdentity(patientId) {
  const { data: existing } = await supabase.from('forum_identities').select('pseudonym').eq('patient_id', patientId).maybeSingle()
  if (existing) return existing.pseudonym
  const ADJ = ['Calm','Bright','Steady','Quiet','Gentle','Curious','Hopeful','Patient','Kind','Wise']
  const NOUN = ['Panda','Maple','River','Harbor','Lotus','Cedar','Falcon','Willow','Comet','Orchid']
  const pseudonym = `${ADJ[Math.floor(Math.random()*ADJ.length)]} ${NOUN[Math.floor(Math.random()*NOUN.length)]} ${Math.floor(100+Math.random()*900)}`
  const { data: inserted, error } = await supabase.from('forum_identities').insert({ patient_id: patientId, pseudonym }).select('pseudonym').maybeSingle()
  // A unique-constraint collision on pseudonym is rare but possible -
  // whoever lost the race just re-reads the winning row rather than
  // erroring out.
  if (error) {
    const { data: winner } = await supabase.from('forum_identities').select('pseudonym').eq('patient_id', patientId).maybeSingle()
    return winner?.pseudonym || pseudonym
  }
  return inserted?.pseudonym || pseudonym
}

function ForumScreen({ isEn, patient={} }) {
  const __theme = useContext(ThemeContext)
  const [view,setView]=useState('list') // list | thread
  const [search,setSearch]=useState('')
  const [products,setProducts]=useState([])
  const [loading,setLoading]=useState(true)
  const [activeProduct,setActiveProduct]=useState(null)
  const [posts,setPosts]=useState([])
  const [postBody,setPostBody]=useState('')
  const [posting,setPosting]=useState(false)
  const [patientId,setPatientId]=useState(null)
  const [creating,setCreating]=useState(false)
  const [postRating,setPostRating]=useState(null)
  const [postError,setPostError]=useState(null)

  useEffect(() => {
    async function resolvePatient() {
      if (!patient?.medsa_id) return
      const { data } = await supabase.from('patients').select('id').eq('medsa_id', patient.medsa_id).maybeSingle()
      setPatientId(data?.id || null)
    }
    resolvePatient()
  }, [patient?.medsa_id])

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase.from('forum_products').select('*').order('sponsored_by',{ascending:false,nullsFirst:false}).order('post_count',{ascending:false})
    setProducts(data||[])
    setLoading(false)
  }
  useEffect(() => { loadProducts() }, [])

  const searchNorm = normalizeProductName(search)
  const matches = search.trim() ? products.filter(p=>p.canonical_name.toLowerCase().includes(search.toLowerCase().trim())) : products

  async function handleOpenThread(product) {
    setActiveProduct(product)
    setView('thread')
    const { data } = await supabase.from('forum_posts').select('*').eq('product_id', product.id).order('created_at')
    setPosts(data||[])
    // Each entry is its own timestamped note, never overwritten - the
    // compose box always starts blank for a new note. The star rating
    // still carries forward as a starting point (most people aren't
    // changing their rating with every update), but only applies once
    // they actually submit.
    const mine = (data||[]).filter(p=>p.patient_id===patientId)
    setPostBody('')
    setPostRating(mine.length>0 ? mine[mine.length-1].rating||null : null)
  }

  async function handleCreateProduct() {
    if (!search.trim() || !patientId) return
    if (containsProfanity(search)) { setPostError(isEn?'Please remove inappropriate language from the product name.':'請移除產品名稱中的不當用語。'); return }
    setPostError(null)
    setCreating(true)
    const normalized = searchNorm
    // Likely-duplicate check - flags for review, never blocks creation.
    let bestMatch = null, bestScore = 0
    for (const p of products) {
      const score = nameSimilarity(normalized, p.normalized_name)
      if (score > bestScore) { bestScore = score; bestMatch = p }
    }
    const { data: newProduct, error } = await supabase.from('forum_products').insert({
      canonical_name: search.trim(), normalized_name: normalized, created_by_patient_id: patientId,
    }).select().maybeSingle()
    setCreating(false)
    if (error || !newProduct) return
    if (bestMatch && bestScore >= 0.5) {
      await supabase.from('forum_duplicate_flags').insert({
        product_id_a: newProduct.id, product_id_b: bestMatch.id,
        similarity_reason: `${Math.round(bestScore*100)}% word overlap: "${newProduct.canonical_name}" vs "${bestMatch.canonical_name}"`,
      })
    }
    setSearch('')
    await loadProducts()
    handleOpenThread(newProduct)
  }

  async function handlePost() {
    if (!postBody.trim() || !activeProduct || !patientId) return
    if (containsProfanity(postBody)) { setPostError(isEn?'Please remove inappropriate language before posting.':'請移除不當用語後再發佈。'); return }
    setPostError(null)
    setPosting(true)
    // Always a new, timestamped entry - never overwrites a prior one.
    // If this patient already has entries here, this one is grouped
    // under their first (thread_root_id), and the rating aggregate
    // moves by the difference from whatever their most recent rating
    // was, so their own updates don't get double-counted.
    const mine = posts.filter(p=>p.patient_id===patientId)
    const rootId = mine.length>0 ? (mine[0].thread_root_id || mine[0].id) : null
    const pseudonym = mine.length>0 ? mine[0].pseudonym : await getOrCreateForumIdentity(patientId)

    await supabase.from('forum_posts').insert({
      product_id: activeProduct.id, patient_id: patientId, pseudonym, body: postBody.trim(),
      rating: postRating || null, thread_root_id: rootId,
    })

    const oldRating = mine.length>0 ? (mine[mine.length-1].rating||0) : 0
    const newRating = postRating || 0
    const ratingCountDelta = (oldRating>0?1:0) !== (newRating>0?1:0) ? (newRating>0?1:-1) : 0
    const updatedFields = {
      post_count: (activeProduct.post_count||0)+1,
      rating_sum: (activeProduct.rating_sum||0) - oldRating + newRating,
      rating_count: (activeProduct.rating_count||0) + ratingCountDelta,
    }
    await supabase.from('forum_products').update(updatedFields).eq('id', activeProduct.id)
    setActiveProduct(prev=>({...prev, ...updatedFields}))

    setPostBody('')
    setPosting(false)
    const { data } = await supabase.from('forum_posts').select('*').eq('product_id', activeProduct.id).order('created_at')
    setPosts(data||[])
  }

  async function handleReport(post) {
    await supabase.from('forum_posts').update({ flagged_for_review: true }).eq('id', post.id)
    setPosts(prev=>prev.map(p=>p.id===post.id?{...p,flagged_for_review:true}:p))
  }

  if (view==='thread'&&activeProduct) return (
    <div>
      <div style={{padding:'16px',display:'flex',alignItems:'center',gap:'10px'}}>
        <div onClick={()=>setView('list')} style={{fontSize:'12px',color:__theme.accent,cursor:'pointer'}}>{isEn?'← All discussions':'← 所有討論'}</div>
      </div>
      <div style={{padding:'0 16px 10px'}}>
        {activeProduct.image_url&&<img src={activeProduct.image_url} alt="" style={{width:'100%',height:140,objectFit:'cover',borderRadius:'12px',marginBottom:'12px'}}/>}
        <div style={{fontSize:'17px',fontWeight:700}}>{activeProduct.canonical_name}</div>
        {activeProduct.sponsored_by&&<div style={{fontSize:'11px',color:C.amber,fontWeight:600,marginTop:'2px'}}>{'◇'} {isEn?'Sponsored by':'贊助商'} {activeProduct.sponsored_by}</div>}
        {activeProduct.rating_count>0&&<div style={{fontSize:'12px',color:'#d4a017',marginTop:'4px'}}>{'★'.repeat(Math.round(activeProduct.rating_sum/activeProduct.rating_count))}{'☆'.repeat(5-Math.round(activeProduct.rating_sum/activeProduct.rating_count))} <span style={{color:C.textMuted}}>{(activeProduct.rating_sum/activeProduct.rating_count).toFixed(1)} ({activeProduct.rating_count})</span></div>}
        <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{posts.length} {isEn?'posts · posted anonymously, verified accounts only':'則貼文 · 匿名發佈，僅限已驗證帳戶'}</div>
      </div>
      <div style={{padding:'0 16px'}}>
        {posts.length===0&&<div style={{textAlign:'center',padding:'30px 0',color:C.textMuted,fontSize:'13px'}}>{isEn?'No posts yet - be the first to share.':'尚無貼文 - 成為第一個分享的人。'}</div>}
        {(() => {
          // Group into one block per reviewer, in the order each first
          // posted - every later entry from the same patient is a new,
          // timestamped note under their own heading, never a silent
          // overwrite of an earlier one.
          const seen = new Set(), groups = []
          for (const p of posts) {
            if (seen.has(p.patient_id)) continue
            seen.add(p.patient_id)
            groups.push({ patientId: p.patient_id, pseudonym: p.pseudonym, entries: posts.filter(x=>x.patient_id===p.patient_id) })
          }
          return groups.map(g => {
            const isMine = g.patientId===patientId
            return (
              <Card key={g.patientId} style={{padding:'14px 16px',marginBottom:'8px'}}>
                <div style={{fontSize:'12px',fontWeight:700,color:C.textSub,marginBottom:'8px'}}>{g.pseudonym}{isMine?` · ${isEn?'You':'您'}`:''}</div>
                {g.entries.map((p,i) => (
                  <div key={p.id} style={{marginBottom:i<g.entries.length-1?'12px':0,paddingBottom:i<g.entries.length-1?'12px':0,borderBottom:i<g.entries.length-1?`0.5px solid ${C.border}`:'none'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                      <span style={{fontSize:'10px',color:C.textMuted}}>{i===0?(isEn?'Original':'原始評論'):(isEn?'Update':'更新')} · {new Date(p.created_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</span>
                    </div>
                    {p.rating&&<div style={{fontSize:'12px',color:'#d4a017',marginBottom:'4px'}}>{'★'.repeat(p.rating)}{'☆'.repeat(5-p.rating)}</div>}
                    <div style={{fontSize:'13px',color:C.text,lineHeight:1.6}}>{p.body}</div>
                    {!isMine&&!p.flagged_for_review&&<div onClick={()=>handleReport(p)} style={{fontSize:'10px',color:C.textMuted,marginTop:'6px',cursor:'pointer'}}>{isEn?'Report':'檢舉'}</div>}
                    {!isMine&&p.flagged_for_review&&<div style={{fontSize:'10px',color:C.amber,marginTop:'6px'}}>{isEn?'Reported - under review':'已檢舉 - 審核中'}</div>}
                  </div>
                ))}
              </Card>
            )
          })
        })()}
      </div>
      <div style={{padding:'12px 16px 24px'}}>
        <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>{isEn?'Rate this product (optional):':'為此產品評分（可選）：'}</div>
        <div style={{display:'flex',gap:'6px',marginBottom:'10px'}}>
          {[1,2,3,4,5].map(n=><div key={n} onClick={()=>setPostRating(postRating===n?null:n)} style={{fontSize:'22px',cursor:'pointer',opacity:postRating&&postRating>=n?1:0.25}}>★</div>)}
        </div>
        <textarea value={postBody} onChange={e=>setPostBody(e.target.value)} rows={3} placeholder={posts.some(p=>p.patient_id===patientId)?(isEn?'Add an update to your review...':'為您的評論新增更新...'):(isEn?'Share your experience, anonymously...':'匿名分享您的經驗...')} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px',fontFamily:'inherit',resize:'none'}}/>
        {postError&&<div style={{fontSize:'12px',color:C.red,marginBottom:'8px'}}>{postError}</div>}
        <Btn variant="primary" style={{width:'100%'}} onClick={handlePost} disabled={posting||!postBody.trim()}>
          {posting?(isEn?'Posting...':'發佈中...'):(posts.some(p=>p.patient_id===patientId)?(isEn?'Add update':'新增更新'):(isEn?'Post your review':'發佈評論'))}
        </Btn>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{padding:'16px'}}>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px',lineHeight:1.5}}>{isEn?'Discuss supplements and healthcare products with other verified Medsa patients - anonymously.':'與其他已驗證的Medsa患者匿名討論保健品和醫療產品。'}</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={isEn?'Search a product to discuss...':'搜尋想討論的產品...'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
        {!loading&&products.length===0&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'8px'}}>{isEn?'Nothing here yet - try searching something like "Vitamin C" or "Fish Oil" to start the first discussion.':'暫時未有內容 - 試試搜尋「維他命C」或「魚油」開始第一個討論。'}</div>}
      </div>
      <div style={{padding:'0 16px'}}>
        {loading&&<div style={{textAlign:'center',color:C.textMuted,fontSize:'13px',padding:'20px'}}>{isEn?'Loading...':'載入中...'}</div>}
        {!loading&&matches.map(p=>(
          <Card key={p.id} onClick={()=>handleOpenThread(p)} style={{padding:'14px 16px',marginBottom:'8px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px'}}>
            {p.image_url&&<img src={p.image_url} alt="" style={{width:44,height:44,objectFit:'cover',borderRadius:'8px',flexShrink:0}}/>}
            <div style={{flex:1}}>
              <div style={{fontSize:'13px',fontWeight:600}}>{p.canonical_name}</div>
              {p.sponsored_by&&<div style={{fontSize:'10px',color:C.amber,fontWeight:600,marginTop:'2px'}}>{'◇'} {isEn?'Sponsored by':'贊助商'} {p.sponsored_by}</div>}
              {p.rating_count>0&&<div style={{fontSize:'11px',color:'#d4a017',marginTop:'2px'}}>{'★'} {(p.rating_sum/p.rating_count).toFixed(1)} <span style={{color:C.textMuted}}>({p.rating_count})</span></div>}
            </div>
            <span style={{fontSize:'11px',color:C.textMuted,flexShrink:0}}>{p.post_count||0} {isEn?'posts':'貼文'}</span>
          </Card>
        ))}
        {!loading&&search.trim()&&matches.every(p=>p.canonical_name.toLowerCase()!==search.toLowerCase().trim())&&(
          <Card onClick={handleCreateProduct} style={{padding:'14px 16px',cursor:'pointer',border:`1px dashed ${__theme.accent}`,background:'transparent'}}>
            <div style={{fontSize:'13px',fontWeight:600,color:__theme.accent}}>{creating?(isEn?'Starting...':'建立中...'):`${isEn?'Start a new discussion for':'開始新討論：'} "${search.trim()}"`}</div>
          </Card>
        )}
        {postError&&<div style={{fontSize:'12px',color:C.red,marginTop:'8px'}}>{postError}</div>}
      </div>
    </div>
  )
}

function InsuranceScreen({ isEn, claims=[], patient={}, records=[], deepLinkInquiryId=null, onConsumeInquiryDeepLink }) {
  const __theme = useContext(ThemeContext)
  const hasLiveClaims = claims.length > 0
  const [tab,setTab]=useState('plans')
  // Jumping straight to a specific inquiry's conversation from the home
  // screen's message board - switching tabs is this screen's job,
  // MyInquiriesTab itself expands the right card once its own list loads.
  useEffect(() => { if (deepLinkInquiryId) setTab('inquiries') }, [deepLinkInquiryId])
  const [viewingPlanIndex,setViewingPlanIndex]=useState(null)
  const [anonRating,setAnonRating]=useState(null)
  const [feedbackText,setFeedbackText]=useState('')
  const [feedbackSubmitted,setFeedbackSubmitted]=useState(false)
  const [feedbackSubmitting,setFeedbackSubmitting]=useState(false)
  const [worksWithAgents,setWorksWithAgents]=useState([])
  const [worksWithAgentsLoading,setWorksWithAgentsLoading]=useState(true)
  const [selectedFeedbackAgentId,setSelectedFeedbackAgentId]=useState(null)

  // Only an agent this patient has a real policy with (any status - past
  // or present) is eligible to be rated. Rating requires having actually
  // worked with them, same principle as a verified purchase review.
  useEffect(() => {
    async function loadWorksWithAgents() {
      const medsaId = patient?.medsa_id
      if (!medsaId) { setWorksWithAgentsLoading(false); return }
      const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
      if (!patientRow) { setWorksWithAgentsLoading(false); return }
      const { data } = await supabase.from('agent_policies').select('agent_id, agents(id, name)').eq('patient_id', patientRow.id)
      const distinct = Object.values((data||[]).reduce((acc,row)=>{
        if (row.agents) acc[row.agent_id] = row.agents
        return acc
      }, {}))
      setWorksWithAgents(distinct)
      setWorksWithAgentsLoading(false)
    }
    loadWorksWithAgents()
  }, [patient?.medsa_id])

  // Real save - no patient_id stored, matching the "never stored" promise
  // already shown in the form's copy. Eligibility (has this patient
  // actually worked with this agent) is checked before this ever runs,
  // not enforced by the insert itself.
  async function handleSubmitFeedback() {
    if (!anonRating || !selectedFeedbackAgentId) return
    setFeedbackSubmitting(true)
    await supabase.from('agent_feedback').insert({
      agent_id: selectedFeedbackAgentId, rating: anonRating, comment: feedbackText.trim()||null,
    })
    setFeedbackSubmitting(false)
    setFeedbackSubmitted(true)
  }
  const [activePolicy,setActivePolicy]=useState(null)
  // Real gap found live-testing (UX audit item 3): "where do I stand on
  // insurance" had no single answer - the Home tile badge, My Inquiries,
  // and Policy on file each showed a different slice with no one place
  // that just says "here's everything." This summary (+ localJumpId,
  // combined with the deep-link prop below) is that one place - tapping
  // a pending/unread row jumps straight into My Inquiries with that
  // exact inquiry already open, the same mechanism the home screen's
  // message board already uses.
  const [coverageSummary,setCoverageSummary]=useState({ pendingCount:0, unreadCount:0, firstPendingId:null })
  const [localJumpId,setLocalJumpId]=useState(null)
  async function loadCoverageSummary() {
    const medsaId = patient?.medsa_id
    if (!medsaId) return
    const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
    if (!patientRow) return
    const { data: inquiries } = await supabase.from('plan_inquiries').select('id, underwriter_status, status')
      .eq('patient_id', patientRow.id).neq('status', 'converted').neq('status', 'superseded')
    const pending = (inquiries||[]).filter(i=>i.underwriter_status==='pending')
    const ids = (inquiries||[]).map(i=>i.id)
    let unreadCount = 0
    if (ids.length>0) {
      const { count } = await supabase.from('inquiry_messages').select('id',{count:'exact',head:true}).in('inquiry_id', ids).eq('read_by_patient', false)
      unreadCount = count || 0
    }
    setCoverageSummary({ pendingCount: pending.length, unreadCount, firstPendingId: pending[0]?.id || null })
  }
  useEffect(() => { loadCoverageSummary() }, [patient?.medsa_id])
  const [heldPolicies,setHeldPolicies]=useState([]) // every held policy, not just the one shown up top - a patient can hold more than one, and ClaimsTab needs all of them to let the patient pick which to bill
  const [lapsedPolicies,setLapsedPolicies]=useState([]) // a monthly self-serve policy whose recurring premium stopped clearing - shown separately so it doesn't just silently vanish
  // Compact-by-default: once "Policy on file" could show several real
  // cards (see comment below), a full card per policy made the list too
  // long to scan. Only one expands at a time, collapsed by default.
  const [expandedPolicyId,setExpandedPolicyId]=useState(null)
  const [policyLoading,setPolicyLoading]=useState(true)
  const [renewalRequested,setRenewalRequested]=useState(false)
  const [companyLogos,setCompanyLogos]=useState({}) // company_name -> logo_url, for the held-policy cards

  async function loadPolicy() {
    const medsaId = patient?.medsa_id
    if (!medsaId) { setPolicyLoading(false); return }
    const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
    if (!patientRow) { setPolicyLoading(false); return }
    const { data: all } = await supabase.from('agent_policies').select('*, institutions(name), insurance_plans(billing_model, company_name, logo_url)').eq('patient_id', patientRow.id).in('status',['active','renewal_in_progress']).order('renewal_date',{ascending:true})
    setHeldPolicies(all||[])
    const data = (all||[])[0]
    setActivePolicy(data||null)
    setRenewalRequested(!!data?.patient_requested_renewal_at)
    setPolicyLoading(false)
    // Real life: a monthly-billed self-serve policy whose recurring
    // premium stopped clearing doesn't just vanish once it lapses - the
    // patient needs to actually see that it ended and why, not have it
    // silently disappear from "Policy on file" with no explanation.
    const { data: lapsed } = await supabase.from('agent_policies').select('id, plan_name, lapsed_at, insurance_plans(company_name)').eq('patient_id', patientRow.id).eq('status','lapsed').order('lapsed_at',{ascending:false})
    setLapsedPolicies(lapsed||[])
    const companyNames = [...new Set((all||[]).map(p=>p.insurance_plans?.company_name).filter(Boolean))]
    if (companyNames.length>0) {
      const { data: companies } = await supabase.from('insurance_companies').select('name, logo_url').in('name', companyNames)
      setCompanyLogos(Object.fromEntries((companies||[]).filter(c=>c.logo_url).map(c=>[c.name, c.logo_url])))
    }
  }
  useEffect(() => {
    loadPolicy()
    const interval = setInterval(loadPolicy, 30000) // keep renewal status live without a manual reload
    return () => clearInterval(interval)
  }, [patient?.medsa_id])

  // Self-serve link to a plan the patient already holds outside Medsa's
  // own marketplace flow - the "Compare plans" tab below only ever
  // surfaces plans that agreed to be sold/matched on Medsa
  // (self_serve_only:false or sponsored), by design (see
  // CoverageRulesManager's own comment on the same scope decision). A
  // patient holding a TPA-claims-only insurer's policy has no other way
  // to get it linked for real claims processing short of a clinic front
  // desk doing it during a visit's billing step - this is that same
  // agent_policies insert, just reachable from the patient's own side,
  // for a policy that's genuinely already theirs (not a purchase).
  const [showLinkForm,setShowLinkForm]=useState(false)
  const [linkSearch,setLinkSearch]=useState('')
  const [linkResults,setLinkResults]=useState([])
  const [linkSearching,setLinkSearching]=useState(false)
  const [linkSelectedPlan,setLinkSelectedPlan]=useState(null)
  const [linkPolicyNumber,setLinkPolicyNumber]=useState('')
  const [linking,setLinking]=useState(false)
  const [linkError,setLinkError]=useState(null)

  async function searchLinkPlans(q) {
    setLinkSearch(q)
    if (!q.trim()) { setLinkResults([]); return }
    setLinkSearching(true)
    const { data } = await supabase.from('insurance_plans').select('id, plan_name, company_name, self_serve_only')
      .eq('status','active').or(`plan_name.ilike.%${q.trim()}%,company_name.ilike.%${q.trim()}%`).limit(15)
    setLinkResults(data||[])
    setLinkSearching(false)
  }

  async function handleLinkPlan() {
    if (!linkSelectedPlan) return
    // Policy number is required, not optional - a patient could otherwise
    // save a plan with nothing to actually identify their policy, then
    // reasonably believe they're "linked" when there's no real proof on
    // file at all. It's also exactly what a roster/API-verified insurer's
    // claim check needs to have anything to check against later.
    if (!linkPolicyNumber.trim()) { setLinkError(isEn?'Enter your policy number.':'請輸入您的保單編號。'); return }
    setLinking(true); setLinkError(null)
    const medsaId = patient?.medsa_id
    const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
    if (!patientRow) { setLinkError(isEn?'Could not find your patient record.':'找不到您的病人記錄。'); setLinking(false); return }
    const { error } = await supabase.from('agent_policies').insert({
      patient_id: patientRow.id, plan_id: linkSelectedPlan.id, plan_name: linkSelectedPlan.plan_name,
      policy_number: linkPolicyNumber.trim(), status: 'active', start_date: new Date().toISOString().slice(0,10),
    })
    setLinking(false)
    if (error) { setLinkError(error.message); return }
    setShowLinkForm(false); setLinkSearch(''); setLinkResults([]); setLinkSelectedPlan(null); setLinkPolicyNumber('')
    loadPolicy()
  }

  async function handleRequestRenewal(policy) {
    const target = policy || activePolicy
    if (!target) return
    setRenewalRequested(true)
    await supabase.from('agent_policies').update({ patient_requested_renewal_at: new Date().toISOString() }).eq('id', target.id)
    loadPolicy()
  }

  // Cancellation is a request, not a self-service instant action - HK's
  // Insurance Authority only guarantees a full refund within a 21-day
  // cooling-off/free-look period from when the policy took effect; after
  // that, cancelling requires 30 days' notice, and an agent needs to
  // actually process it with the insurer either way. This just records
  // the request and which window applies, for the agent to act on.
  const [cancelTargetId,setCancelTargetId]=useState(null)
  const [cancelling,setCancelling]=useState(false)
  function cancellationWindow(policy) {
    const startedAt = policy?.start_date || policy?.created_at
    if (!startedAt) return { withinFreeLook: false, daysInto: null }
    const daysInto = Math.floor((Date.now() - new Date(startedAt).getTime()) / (1000*60*60*24))
    return { withinFreeLook: daysInto <= 21, daysInto }
  }
  async function handleRequestCancellation(policy) {
    setCancelling(true)
    await supabase.from('agent_policies').update({ cancellation_requested_at: new Date().toISOString() }).eq('id', policy.id)
    setCancelling(false)
    setCancelTargetId(null)
    loadPolicy()
  }
  // Free-look is the policyholder's unconditional right, so it shouldn't
  // wait on an agent the way a normal (past-21-day) cancellation genuinely
  // needs to - this refunds a real Stripe charge directly and cancels on
  // the spot when there's one on file, instead of just recording a request.
  const [freeLookError,setFreeLookError]=useState(null)
  async function handleFreeLookCancel(policy) {
    setCancelling(true); setFreeLookError(null)
    try {
      const res = await fetch('/api/patient/cancel_free_look', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ policyId: policy.id, patientId: patient.id }),
      })
      const data = await res.json()
      if (data.status !== 'OK') { setFreeLookError(data.message || 'Could not cancel this policy.'); setCancelling(false); return }
      setCancelTargetId(null)
      loadPolicy()
    } finally {
      setCancelling(false)
    }
  }
  // A self-linked policy (see handleLinkPlan) was never sold through
  // Medsa and has no agent attached - agent_id is null. Real gap found
  // live-testing: the agent-mediated cancellation flow below silently
  // went nowhere for one of these, since there's no agent to receive
  // it. Medsa has no standing with that insurer for a policy it never
  // sold, so "cancelling" it here can only ever mean removing Medsa's
  // own record of it, not actually cancelling coverage - the patient
  // still has to contact that insurer directly for that.
  async function handleRemoveSelfLinkedPolicy(policy) {
    setCancelling(true)
    await supabase.from('agent_policies').update({ status: 'removed' }).eq('id', policy.id)
    setCancelling(false)
    setCancelTargetId(null)
    loadPolicy()
  }
  function renderCancelAction(policy, light) {
    const textColor = light ? 'rgba(255,255,255,0.85)' : C.textMuted
    const isSelfLinked = !policy.agent_id
    if (policy.cancellation_requested_at) {
      return <div style={{marginTop:'10px',fontSize:'11px',color:textColor}}>{isEn?'✓ Cancellation requested - your agent will confirm once processed.':'✓ 已請求取消 - 代理人處理後將確認。'}</div>
    }
    if (cancelTargetId !== policy.id) {
      return <div onClick={()=>setCancelTargetId(policy.id)} style={{marginTop:'10px',fontSize:'11px',color:light?'rgba(255,255,255,0.7)':C.textMuted,textDecoration:'underline',cursor:'pointer'}}>{isSelfLinked?(isEn?'Remove this policy from my file':'從我的檔案中移除此保單'):(isEn?'Request cancellation':'請求取消保單')}</div>
    }
    if (isSelfLinked) {
      return (
        <div style={{marginTop:'10px',background:light?'rgba(255,255,255,0.15)':C.beige,borderRadius:'8px',padding:'10px 12px',fontSize:'11px',lineHeight:1.5,color:textColor}}>
          {isEn?"This just removes Medsa's own record of the policy - it was never sold through Medsa, so we can't cancel your actual coverage. Contact the insurer directly for that.":'此操作僅移除Medsa存檔的保單記錄 - 此保單並非透過Medsa銷售,故我們無法取消您的實際保障,請直接聯絡保險公司處理。'}
          <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
            <Btn style={{flex:1,fontSize:'11px',padding:'6px 10px',...(light?{background:'rgba(255,255,255,0.15)',color:'#fff',border:'0.5px solid rgba(255,255,255,0.3)'}:{})}} onClick={()=>setCancelTargetId(null)}>{isEn?'Never mind':'不用了'}</Btn>
            <Btn variant="primary" style={{flex:1,fontSize:'11px',padding:'6px 10px'}} disabled={cancelling} onClick={()=>handleRemoveSelfLinkedPolicy(policy)}>{cancelling?(isEn?'Removing…':'移除中…'):(isEn?'Remove it':'移除')}</Btn>
          </div>
        </div>
      )
    }
    const { withinFreeLook, daysInto } = cancellationWindow(policy)
    const hasStripePayment = !!(policy.stripe_subscription_id || policy.stripe_checkout_session_id)
    return (
      <div style={{marginTop:'10px',background:light?'rgba(255,255,255,0.15)':C.beige,borderRadius:'8px',padding:'10px 12px',fontSize:'11px',lineHeight:1.5,color:textColor}}>
        {withinFreeLook
          ? (isEn?`You're within the 21-day cooling-off period (day ${daysInto ?? 0}) - cancelling now qualifies for a full premium refund${hasStripePayment?', issued right away':' - your agent will arrange it with the insurer, since this wasn\'t paid through Medsa'}.`:`您仍在21天冷靜期內(第${daysInto ?? 0}天)- 現在取消可獲全額保費退還${hasStripePayment?',並即時處理':' - 由於並非透過Medsa付款,代理人將與保險公司安排退款'}。`)
          : (isEn?"You're past the 21-day cooling-off period, so cancellation needs 30 days' notice and isn't instant - your agent will confirm the effective date with the insurer.":'您已超過21天冷靜期,取消保單需提前30天通知,並非即時生效 - 代理人將與保險公司確認生效日期。')}
        {freeLookError&&<div style={{marginTop:'8px',color:light?'#ffb3b3':C.red}}>{freeLookError}</div>}
        <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
          <Btn style={{flex:1,fontSize:'11px',padding:'6px 10px',...(light?{background:'rgba(255,255,255,0.15)',color:'#fff',border:'0.5px solid rgba(255,255,255,0.3)'}:{})}} onClick={()=>setCancelTargetId(null)}>{isEn?'Never mind':'不用了'}</Btn>
          <Btn variant="primary" style={{flex:1,fontSize:'11px',padding:'6px 10px'}} disabled={cancelling} onClick={()=>withinFreeLook&&hasStripePayment?handleFreeLookCancel(policy):handleRequestCancellation(policy)}>{cancelling?(isEn?'Processing…':'處理中…'):(withinFreeLook&&hasStripePayment?(isEn?'Cancel & refund now':'立即取消並退款'):(isEn?'Confirm request':'確認請求'))}</Btn>
        </div>
      </div>
    )
  }

  // Real gap this closes: previously only ever acted on activePolicy
  // (heldPolicies[0]) - fine while a contract-sign step only ever
  // happened during a renewal (rare, one policy at a time in practice),
  // but now every newly-issued policy can carry one too, so signing the
  // wrong held policy's contract was a real risk once more than one is
  // ever awaiting signature at once.
  async function handleSignContract(policy) {
    const target = policy || activePolicy
    if (!target) return
    const signedAt = new Date().toISOString()
    await supabase.from('agent_policies').update({ patient_signed_at: signedAt }).eq('id', target.id)
    loadPolicy()
  }

  const [viewError,setViewError]=useState(null)
  async function handleViewContract(policy) {
    const target = policy || activePolicy
    if (!target?.contract_file_path) return
    setViewError(null)
    const { data, error } = await supabase.storage.from('policy-contracts').createSignedUrl(target.contract_file_path, 300) // link valid 5 minutes
    if (error || !data?.signedUrl) { setViewError('Could not open the contract - ask your agent to check the upload.'); return }
    window.open(data.signedUrl, '_blank')
  }

  const [plans,setPlans]=useState([])
  const [plansLoading,setPlansLoading]=useState(true)
  const [planSearch,setPlanSearch]=useState('')
  const [patientConditions,setPatientConditions]=useState([])
  // "Find me a plan" (aq2-09) - the guided entry point, matching your
  // original design intent: one declaration up front, matched
  // recommendations back, instead of browsing every plan blind.
  const [findPlanOpen,setFindPlanOpen]=useState(false)
  const [findPlanConditions,setFindPlanConditions]=useState([])
  const [findPlanLoading,setFindPlanLoading]=useState(false)
  const [findPlanResults,setFindPlanResults]=useState(null)

  useEffect(() => {
    async function loadPlansAndMatch() {
      setPlansLoading(true)
      const medsaId = patient?.medsa_id
      let conditionNames = []
      if (medsaId) {
        const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
        if (patientRow) {
          const { data: conds } = await supabase.from('conditions').select('condition_name').eq('patient_id', patientRow.id).eq('active', true)
          conditionNames = (conds||[]).map(c => c.condition_name?.toLowerCase()).filter(Boolean)
        }
      }
      setPatientConditions(conditionNames)
      // self_serve_only excludes TPA-claims-only insurers' plans from
      // general browsing - they registered coverage rules for claims
      // processing, never agreed to be sold on Medsa's marketplace. The
      // one carved-out exception is a plan they've explicitly paid to
      // promote (sponsored:true) - that's a deliberate, priced placement,
      // same as a partnered insurer's sponsored listing.
      const { data: realPlans } = await supabase.from('insurance_plans').select('*, insurance_plan_pricing_tiers(*)').eq('status','active').or('self_serve_only.eq.false,sponsored.eq.true')

      // Real gap found live-testing: a sponsored, TPA-only insurer's plan
      // (noTiersAtAll below) still sent the patient through the full
      // "Quote immediately"/"Talk to an agent" declaration flow even
      // though Medsa has no real sellable relationship for it at all -
      // no pricing tiers, no agents onboarded for that company, nothing
      // for an agent-mode inquiry to ever be claimed by. The only honest
      // next step for one of these is the insurer's own real contact -
      // same company_name join every other screen already uses.
      const companyNames = [...new Set((realPlans||[]).map(p=>p.company_name).filter(Boolean))]
      const { data: companyContacts } = companyNames.length>0
        ? await supabase.from('insurance_companies').select('name, contact_email, contact_phone').in('name', companyNames)
        : { data: [] }
      const contactByCompany = Object.fromEntries((companyContacts||[]).map(c=>[c.name, c]))

      // Real age from the patient's actual date of birth - this is what
      // determines which tier's price actually applies to them.
      const patientAge = patient?.date_of_birth
        ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25*24*60*60*1000))
        : null
      const todayStr = new Date().toISOString().slice(0,10)

      const mapped = (realPlans||[])
        // A lapsed sponsorship (sponsored_until in the past) shouldn't keep
        // a self-serve plan visible - the .or() above can only filter on
        // the raw sponsored flag, not the date, so re-check the expiry here.
        .filter(p => !p.self_serve_only || (p.sponsored && p.sponsored_until && p.sponsored_until >= todayStr))
        .map(p => {
        const coveredLower = (p.covered_conditions||[]).map(c=>c.toLowerCase())
        // Real matching: does the patient have a condition this plan explicitly
        // covers? This is deterministic overlap-checking, not AI - see chat.
        const matchedConditions = conditionNames.filter(c => coveredLower.some(cov => cov.includes(c) || c.includes(cov)))
        const tiers = p.insurance_plan_pricing_tiers || []
        const myTier = patientAge!=null ? tiers.find(t => patientAge>=t.age_min && patientAge<=t.age_max) : null
        return {
          id: p.id, name: p.plan_name, company: p.company_name, type: p.plan_type,
          price: myTier ? myTier.monthly_premium : null,
          limit: myTier ? myTier.annual_limit : null,
          priceUnavailable: !myTier,
          // A self-serve/Coverage-Rules plan (a TPA-tier insurer's, never
          // sold on the marketplace) has zero pricing tiers on principle -
          // it will NEVER have a price here, for any patient of any age.
          // "No pricing for your age" told every patient this was an
          // age-tier gap specific to them, when it's really "Medsa
          // doesn't sell this plan at all, sponsored or not."
          noTiersAtAll: tiers.length===0,
          sponsored: p.sponsored && p.sponsored_until && p.sponsored_until >= todayStr,
          sponsorDescription: p.sponsor_description||null, sponsorThumbnailUrl: p.sponsor_thumbnail_url||null,
          criteria: p.covered_conditions||[], covers: p.covered_categories||[],
          matchedConditions, isMatched: matchedConditions.length > 0,
          requiresAgent: !!p.requires_agent,
          waitingPeriodDays: p.waiting_period_days ?? null,
          preExistingConditionPolicy: p.pre_existing_condition_policy || null,
          additionalTerms: p.additional_terms || null,
          companyContactEmail: contactByCompany[p.company_name]?.contact_email || null,
          companyContactPhone: contactByCompany[p.company_name]?.contact_phone || null,
          // The insurer's own uploaded brochure/T&Cs (policy-contracts
          // bucket) - was collected via PlanManager but never surfaced to
          // the patient anywhere. Rather than Medsa writing and
          // maintaining its own copy of each plan's full legal detail,
          // link out to the insurer's real document for that - keep only
          // a short comparable summary in Medsa's own UI.
          policyDocumentPath: p.policy_document_path || null,
          keyBenefits: p.key_benefits || null,
        }
      })
      // Real bug this fixes: every insurer-facing screen (Sponsored
      // Listings, the self-serve Promote tab) promises a sponsored plan
      // "priority placement in patient searches" - what an insurer is
      // actually paying HK$3,000/month for - but this sort never once
      // checked the sponsored flag, only isMatched. A sponsored-but-
      // unmatched plan landed wherever the database happened to return
      // it, mixed in with everything else, same as if nothing was ever
      // paid for. Sponsored now wins first (that's the paid placement),
      // matched breaks ties within each group second.
      mapped.sort((a,b) => {
        if (a.sponsored !== b.sponsored) return b.sponsored ? 1 : -1
        return (b.isMatched?1:0) - (a.isMatched?1:0)
      })
      setPlans(mapped)
      setPlansLoading(false)
    }
    loadPlansAndMatch()
  }, [patient?.medsa_id])

  // These plan terms were never translated at all - shown in English
  // regardless of selected language. Rather than restructure the whole
  // plans array, this translates the known phrases at render time.
  const PLAN_TERM_ZH = {
    'Comprehensive':'全面型','Hospital focus':'住院為主','Premium + travel':'尊尚 + 旅遊','Critical illness':'危疾',
    'Covers diabetes management':'涵蓋糖尿病管理','Includes outpatient visits':'包括門診就診','Includes lab tests':'包括化驗檢查',
    'Hospitalisation-focused':'以住院為主','Lower monthly cost':'每月費用較低','Limited outpatient coverage':'門診保障有限',
    'Includes travel emergency cover':'包括旅遊緊急保障','Includes mental health':'包括精神健康','Higher monthly cost':'每月費用較高',
    'Lump sum on diagnosis':'確診後一筆過賠償','57 covered conditions':'保障57種疾病','Add-on, not standalone':'附加保障,非獨立計劃',
    'Hospitalisation':'住院','Outpatient':'門診','Specialist':'專科','Labs & imaging':'化驗與影像檢查','Dental (basic)':'牙科(基本)',
    'Surgery':'手術','Travel emergency':'旅遊緊急','Mental health':'精神健康','Critical illness lump sum':'危疾一筆過賠償',
  }
  function pt(term) { return isEn ? term : (PLAN_TERM_ZH[term] || term) }

  // Real search, not just a decorative box - filters the same real plan
  // list above by name, company, type, or covered category/condition, so
  // "search all plans" broadens what's visible beyond just the
  // health-matched set instead of doing nothing when typed into.
  const planSearchLower = planSearch.trim().toLowerCase()
  const visiblePlans = planSearchLower
    ? plans.filter(p => [p.name, p.company, p.type, ...(p.covers||[]), ...(p.criteria||[])].some(s => (s||'').toLowerCase().includes(planSearchLower)))
    : plans

  // Real gap found live-testing: a declined plan's "see other plans that
  // might work" list was pure text - tapping an alternative did nothing,
  // since PlanDetailPage had no way to open a DIFFERENT plan's own page
  // from inside itself. Clears any active search first so the index
  // below (into the unfiltered list) lines up.
  function viewPlanById(planId) {
    setPlanSearch('')
    const idx = plans.findIndex(p => p.id === planId)
    if (idx >= 0) setViewingPlanIndex(idx)
  }

  // Real rebuild: tapping a plan now opens its OWN full page
  // (PlanDetailFlow.jsx) - a real multi-step health declaration
  // (consent + a structured questionnaire modeled on a real insurer's
  // actual application, not a chip-picker) instead of expanding a small
  // form inline on the list card. This short-circuits the whole tab
  // view, same as navigating to a different page would.
  if (viewingPlanIndex != null && visiblePlans[viewingPlanIndex]) {
    return <PlanDetailPage plan={visiblePlans[viewingPlanIndex]} patient={patient} isEn={isEn} heldPolicies={heldPolicies} onBack={()=>{setViewingPlanIndex(null);loadPolicy()}} onViewPlan={viewPlanById}/>
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      {/* Active plan banner - real data from agent_policies */}
      {policyLoading&&<div style={{margin:'16px 16px 0',textAlign:'center',fontSize:'12px',color:C.textMuted}}>{isEn?'Loading your plan...':'載入您的計劃中...'}</div>}
      {!policyLoading&&!activePolicy&&<div style={{margin:'16px 16px 0',background:C.card,borderRadius:'16px',padding:'20px',textAlign:'center',fontSize:'13px',color:C.textMuted}}>No active plan on file yet. Inquire about a plan below to get started.</div>}
      {/* Real gap this closes: "too long" was still true after the first
          compacting pass - each card repeated its own "Policy on file"
          label, and 16px of top margin per card added up fast with
          several held policies. One shared label now, tighter spacing
          between cards, no repeated label per row. */}
      {/* Real life: once a monthly self-serve policy's recurring premium
          genuinely stops clearing (Stripe's own retries exhausted),
          coverage actually ends - reinstating isn't a billing fix, it
          needs a fresh application. Shown plainly rather than letting
          the policy just disappear with no trace. */}
      {!policyLoading&&lapsedPolicies.length>0&&<div style={{margin:'0 16px 10px'}}>
        {lapsedPolicies.map(p=><div key={p.id} style={{background:C.redLight,border:`0.5px solid ${C.red}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'6px'}}>
          <div style={{fontSize:'12px',fontWeight:600,color:C.red}}>{isEn?`${p.plan_name} - coverage ended`:`${p.plan_name} - 保障已終止`}</div>
          <div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>{isEn?`Your card payment couldn't be collected and coverage lapsed on ${new Date(p.lapsed_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}. To get covered again, you'll need to apply and be screened as a new application.`:`信用卡付款未能成功扣取,保障已於${new Date(p.lapsed_at).toLocaleDateString('zh-HK',{day:'numeric',month:'short',year:'numeric'})}終止。如需重新投保,須以新申請重新辦理。`}</div>
        </div>)}
      </div>}
      {!policyLoading&&heldPolicies.length>0&&<SecLabel>{isEn?'Policy on file':'已存檔保單'}</SecLabel>}
      {/* Horizontally scrollable row of cards - a patient holding several
          policies used to see them stacked full-width, one per row, which
          got long fast. Each card is now a fixed-width tile carrying the
          insurer's own logo (CompanyLogoUploader in the insurer portal),
          swiped through instead of scrolled past. */}
      {!policyLoading&&heldPolicies.length>0&&<div style={{display:'flex',gap:'10px',overflowX:'auto',padding:'0 16px 8px',WebkitOverflowScrolling:'touch'}}>
      {/* A policy linked via "I already have insurance" below (self-serve,
          out-of-network) has no premium/renewal_date - it was never sold
          through Medsa, just recorded so claims can process. The full
          premium/renewal card below assumes a Medsa-issued policy, so a
          self-linked one gets its own simpler card instead. */}
      {heldPolicies.filter(p=>p.premium==null).map(policy=>{
        const expanded = expandedPolicyId===policy.id
        const logoUrl = policy.insurance_plans?.logo_url || companyLogos[policy.insurance_plans?.company_name]
        return (
        <div key={policy.id} style={{flexShrink:0,width:'240px',background:C.card,border:`0.5px solid ${C.border}`,borderRadius:'12px',overflow:'hidden'}}>
          <div onClick={()=>setExpandedPolicyId(expanded?null:policy.id)} style={{padding:'10px 14px',display:'flex',alignItems:'center',gap:'10px',cursor:'pointer'}}>
            {logoUrl
              ? <img src={logoUrl} alt="" style={{width:'22px',height:'22px',objectFit:'contain',borderRadius:'5px',flexShrink:0,background:'#fff',border:`0.5px solid ${C.border}`}}/>
              : <div style={{width:'22px',height:'22px',borderRadius:'5px',background:C.beige,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:C.textMuted}}>{(policy.insurance_plans?.company_name||'?')[0]}</div>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:'13px',fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{policy.plan_name}</div>
            </div>
            <span style={{fontSize:'10px',color:C.textMuted,flexShrink:0}}>{expanded?(isEn?'Hide ▲':'收起 ▲'):(isEn?'Details ▼':'詳情 ▼')}</span>
          </div>
          {expanded&&<div style={{padding:'0 14px 14px'}}>
            {policy.policy_number&&<div style={{fontSize:'12px',color:C.textSub,marginTop:'2px'}}>{isEn?'Policy #':'保單編號'} {policy.policy_number}</div>}
            {/* Real gap this closes: nothing on this screen ever told a
                patient whether their own plan bills the clinic directly or
                requires them to pay in full and claim it back - the single
                biggest thing that changes what happens at checkout. */}
            <div style={{fontSize:'11px',fontWeight:600,marginTop:'8px',color:policy.insurance_plans?.billing_model==='reimbursement'?C.amber:__theme.accent}}>
              {policy.insurance_plans?.billing_model==='reimbursement'
                ? (isEn?'Reimbursement plan - you pay in full at the clinic, then claim it back':'自付墊款計劃 - 您需於診所全額付款,其後自行申請索償')
                : (isEn?'Direct billing - your clinic bills this plan, you pay only the copay':'直接賬單計劃 - 診所直接向此計劃收費,您只需支付自付額')}
            </div>
            <div style={{fontSize:'11px',color:C.textMuted,marginTop:'6px',lineHeight:1.5}}>{isEn?'Added by you - this lets a Medsa clinic process claims against it. It\'s not a Medsa-sold plan, so there\'s no premium or renewal to track here.':'由您自行新增 - 讓Medsa診所可根據此保單處理索償。此保單並非由Medsa銷售,故此處不會顯示保費或續保資料。'}</div>
            {renderCancelAction(policy, false)}
          </div>}
        </div>
        )
      })}
      {/* Real gap found live-testing: this used to only ever render
          activePolicy (heldPolicies[0]) - a patient holding more than one
          real Medsa-sold policy only ever saw the first. Now renders
          every held policy of this kind as its own card. */}
      {heldPolicies.filter(p=>p.premium!=null).map(policy=>{
        const daysLeft = Math.ceil((new Date(policy.renewal_date).getTime() - Date.now()) / (1000*60*60*24))
        const inProgress = policy.status==='renewal_in_progress'
        // Not renewal-gated any more - a freshly-issued policy (agent-
        // sold, contract already on file at issuance) needs the exact
        // same sign step a renewal does, not just a renewal in progress.
        const readyToSign = !!policy.contract_ready_at && !policy.patient_signed_at
        const waitingOnAgent = inProgress && !policy.contract_ready_at
        const activePolicy = policy
        const expanded = expandedPolicyId===policy.id
        // A short status word for the collapsed row - so a policy that
        // needs the patient's attention (sign, renewal in progress) is
        // visible without expanding, but everything else stays compact.
        const statusLabel = readyToSign ? (isEn?'Sign required':'需要簽署')
          : waitingOnAgent ? (isEn?'Renewal in progress':'續保處理中')
          : (isEn?'Active':'生效中')
        const logoUrl = activePolicy.insurance_plans?.logo_url || companyLogos[activePolicy.insurance_plans?.company_name]
        return (
        <div key={policy.id} style={{flexShrink:0,width:'240px',background:`linear-gradient(135deg,#1e3a5f 0%,${C.blue} 100%)`,borderRadius:'12px',overflow:'hidden',color:'#fff'}}>
          <div onClick={()=>setExpandedPolicyId(expanded?null:policy.id)} style={{padding:'10px 14px',display:'flex',alignItems:'center',gap:'10px',cursor:'pointer'}}>
            {logoUrl
              ? <img src={logoUrl} alt="" style={{width:'22px',height:'22px',objectFit:'contain',borderRadius:'5px',flexShrink:0,background:'#fff'}}/>
              : <div style={{width:'22px',height:'22px',borderRadius:'5px',background:'rgba(255,255,255,0.15)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700}}>{(activePolicy.insurance_plans?.company_name||'?')[0]}</div>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:'10px',opacity:0.7,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activePolicy.plan_name}</div>
              <div style={{display:'flex',alignItems:'baseline',gap:'8px',marginTop:'2px'}}>
                <div style={{fontSize:'15px',fontWeight:700}}>HK${activePolicy.premium}/mo</div>
              </div>
              <div style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'20px',background:readyToSign?'rgba(255,200,0,0.25)':'rgba(255,255,255,0.15)',display:'inline-block',marginTop:'4px'}}>{statusLabel}</div>
              {/* Real gap this closes: a policy bought via a real Stripe
                  charge and one billed directly by the insurer (no money
                  through Medsa at all) used to render identically here -
                  no way to tell, from this card, whether a payment
                  actually happened on Medsa's side. */}
              {activePolicy.amount_paid_hkd!=null&&<div style={{fontSize:'10px',opacity:0.8,marginTop:'2px'}}>{isEn?`✓ Paid by card - HK$${activePolicy.amount_paid_hkd}`:`✓ 已透過信用卡付款 - HK$${activePolicy.amount_paid_hkd}`}</div>}
              {/* Real life: a missed recurring premium doesn't lapse
                  coverage instantly - there's a grace period while
                  Stripe keeps retrying the card. This is that warning,
                  not a "coverage already ended" notice (see
                  lapsedPolicies below for that). */}
              {activePolicy.payment_past_due_since&&<div style={{fontSize:'10px',fontWeight:700,color:'#ffd966',marginTop:'2px'}}>{isEn?'⚠ Card payment failed - update your card to avoid losing coverage':'⚠ 卡片付款失敗 - 請更新付款方式以免失去保障'}</div>}
            </div>
            <span style={{fontSize:'10px',opacity:0.8,flexShrink:0}}>{expanded?(isEn?'Hide ▲':'收起 ▲'):(isEn?'Details ▼':'詳情 ▼')}</span>
          </div>
          {expanded&&<div style={{padding:'0 14px 14px'}}>
          <div style={{fontSize:'12px',opacity:0.8}}>{isEn?`Renews ${new Date(activePolicy.renewal_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}`:`續保日期 ${new Date(activePolicy.renewal_date).toLocaleDateString('zh-HK',{day:'numeric',month:'short',year:'numeric'})}`}</div>
          <div style={{fontSize:'11px',fontWeight:600,marginTop:'8px',opacity:0.9}}>
            {activePolicy.insurance_plans?.billing_model==='reimbursement'
              ? (isEn?'⚠ Reimbursement plan - you pay in full at the clinic, then claim it back':'⚠ 自付墊款計劃 - 您需於診所全額付款,其後自行申請索償')
              : (isEn?'✓ Direct billing - your clinic bills this plan, you pay only the copay':'✓ 直接賬單計劃 - 診所直接向此計劃收費,您只需支付自付額')}
          </div>
          {/* Real gap: commission was computed throughout the
              agent/insurer/admin screens but never disclosed to the
              patient who actually pays for the policy - added per your
              call. The real figure, not a generic line, since this
              policy is already issued and the amount is on file. */}
          {activePolicy.broker_commission_hkd!=null&&<div style={{fontSize:'11px',opacity:0.8,marginTop:'6px'}}>{isEn?`This policy includes an agent commission of HK$${activePolicy.broker_commission_hkd}, paid by the insurer - never added to your premium.`:`此保單包含HK$${activePolicy.broker_commission_hkd}的代理佣金,由保險公司支付 - 不會加入您的保費。`}</div>}
          {/* Industry-standard protection most policies carry (an
              "incontestable clause") - after 2 years of continuous cover,
              an insurer can no longer void the whole policy over an
              honest (non-fraudulent) mistake on the original application;
              only outright fraud stays contestable forever. */}
          {activePolicy.start_date&&(() => {
            const contestableUntil = new Date(activePolicy.start_date); contestableUntil.setFullYear(contestableUntil.getFullYear()+2)
            const stillContestable = Date.now() < contestableUntil.getTime()
            return <div style={{fontSize:'11px',opacity:0.75,marginTop:'6px'}}>{stillContestable
              ? (isEn?`Contestable for an honest non-disclosure until ${contestableUntil.toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} - after that, only outright fraud can void this policy.`:`如申請時有誠實的遺漏,保險公司可於${contestableUntil.toLocaleDateString('zh-HK',{day:'numeric',month:'short',year:'numeric'})}前就此爭議 - 之後僅欺詐行為可令保單失效。`)
              : (isEn?'Past its 2-year contestability period - only outright fraud can void this policy now.':'已超過2年可爭議期 - 現時僅欺詐行為可令保單失效。')}</div>
          })()}

          {waitingOnAgent&&<div style={{marginTop:'14px',background:'rgba(255,255,255,0.15)',borderRadius:'10px',padding:'10px 12px',fontSize:'12px',lineHeight:1.5}}>
            {'\u25c7'} {isEn?`Your agent is preparing your renewal with ${activePolicy.institutions?.name||'your insurer'}.`:'您的代理人正在為您準備續保。'}
          </div>}

          {readyToSign&&<div style={{marginTop:'14px',background:'rgba(255,255,255,0.15)',borderRadius:'10px',padding:'12px 14px'}}>
            <div style={{fontSize:'12px',fontWeight:600,marginBottom:'8px'}}>{isEn?'Your new contract is ready':'您的新合約已準備就緒'}</div>
            <div style={{fontSize:'11px',opacity:0.85,marginBottom:'10px',lineHeight:1.5}}>{isEn?"Review the document below, then confirm once you're ready to sign.":'請先查閱以下文件，準備好後確認簽署。'}</div>
            {viewError&&<div style={{fontSize:'11px',color:'#ffb3b3',marginBottom:'10px'}}>{viewError}</div>}
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1,background:'rgba(255,255,255,0.15)',color:'#fff',border:'0.5px solid rgba(255,255,255,0.3)',fontSize:'12px'}} onClick={()=>handleViewContract(policy)}>{isEn?'View contract':'查看合約'}</Btn>
              <Btn variant="primary" style={{flex:1,background:'#fff',color:C.navy,fontSize:'12px'}} onClick={()=>handleSignContract(policy)}>{isEn?"I've reviewed and signed":'我已檢閱並簽署'}</Btn>
            </div>
          </div>}

          {activePolicy.patient_signed_at&&inProgress&&<div style={{marginTop:'14px',background:'rgba(255,255,255,0.15)',borderRadius:'10px',padding:'10px 12px',fontSize:'12px'}}>
            ✓ {isEn?'Signed — your agent will confirm the renewal shortly.':'已簽署 — 代理人將盡快確認續保。'}
          </div>}

          {!inProgress&&<div style={{display:'flex',gap:'16px',marginTop:'14px',alignItems:'center'}}>
            <div><div style={{fontSize:'11px',opacity:0.7}}>{isEn?'Days left':'剩餘天數'}</div><div style={{fontSize:'16px',fontWeight:600}}>{daysLeft>=0?daysLeft:'Overdue'}</div></div>
            <div style={{flex:1}}/>
            {daysLeft<=45&&(policy.patient_requested_renewal_at
              ?<div style={{fontSize:'11px',background:'rgba(255,255,255,0.2)',padding:'6px 12px',borderRadius:'20px'}}>✓ {isEn?'Renewal requested':'已請求續保'}</div>
              :<Btn variant="primary" style={{fontSize:'11px',padding:'8px 14px',background:'#fff',color:C.navy}} onClick={()=>handleRequestRenewal(policy)}>{isEn?'Request renewal':'請求續保'}</Btn>)}
          </div>}
          {!inProgress&&renderCancelAction(policy, true)}
          </div>}
        </div>
        )
      })}
      </div>}

      {/* Self-serve link to a plan already held outside Medsa's own
          marketplace - see comment on handleLinkPlan above. Always
          offered, not just when there's no active policy, since a
          patient can hold more than one real policy. */}
      <div style={{margin:'10px 16px 0'}}>
        {!showLinkForm&&<div onClick={()=>setShowLinkForm(true)} style={{background:C.card,border:`0.5px dashed ${C.border}`,borderRadius:'14px',padding:'14px 16px',textAlign:'center',fontSize:'12px',color:__theme.accent,fontWeight:600,cursor:'pointer'}}>+ {isEn?'Already insured elsewhere? Add your policy':'已在其他地方投保?新增您的保單'}</div>}
        {showLinkForm&&<Card style={{margin:0,padding:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,marginBottom:'6px'}}>{isEn?'Add a policy you already hold':'新增您已持有的保單'}</div>
          <div style={{fontSize:'11px',color:C.textSub,marginBottom:'10px',lineHeight:1.5}}>{isEn?'For an insurer not sold through Medsa (e.g. a TPA-claims-only plan) - this just records it so a Medsa clinic can process claims against it, nothing is purchased.':'適用於並非透過Medsa銷售的保險公司(例如僅處理索償的TPA計劃)- 此操作僅作記錄,以便Medsa診所可根據此保單處理索償,並非購買計劃。'}</div>
          {!linkSelectedPlan&&<>
            <input value={linkSearch} onChange={e=>searchLinkPlans(e.target.value)} placeholder={isEn?'Search insurer or plan name':'搜尋保險公司或計劃名稱'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'8px'}}/>
            {linkSearching&&<div style={{fontSize:'11px',color:C.textMuted,padding:'6px 0'}}>{isEn?'Searching…':'搜尋中…'}</div>}
            {!linkSearching&&linkSearch.trim()&&linkResults.length===0&&<div style={{fontSize:'11px',color:C.textMuted,padding:'6px 0'}}>{isEn?'No matching plan found.':'找不到相符的計劃。'}</div>}
            {linkResults.map(p=>(
              <div key={p.id} onClick={()=>setLinkSelectedPlan(p)} style={{padding:'9px 10px',borderRadius:'8px',cursor:'pointer',fontSize:'12px',background:C.beige,marginBottom:'6px'}}>
                <div style={{fontWeight:600}}>{p.plan_name}</div>
                <div style={{color:C.textMuted,fontSize:'11px'}}>{p.company_name}</div>
              </div>
            ))}
          </>}
          {linkSelectedPlan&&<>
            <div style={{background:C.beige,borderRadius:'8px',padding:'10px 12px',marginBottom:'10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontSize:'12px',fontWeight:600}}>{linkSelectedPlan.plan_name}</div><div style={{fontSize:'11px',color:C.textMuted}}>{linkSelectedPlan.company_name}</div></div>
              <span onClick={()=>setLinkSelectedPlan(null)} style={{fontSize:'11px',color:__theme.accent,cursor:'pointer'}}>{isEn?'Change':'更改'}</span>
            </div>
            <input value={linkPolicyNumber} onChange={e=>setLinkPolicyNumber(e.target.value)} placeholder={isEn?'Your policy number (required)':'保單編號(必填)'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'9px 12px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'10px'}}/>
          </>}
          {linkError&&<div style={{fontSize:'11px',color:C.red,marginBottom:'8px'}}>{linkError}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <Btn style={{flex:1}} onClick={()=>{setShowLinkForm(false);setLinkSearch('');setLinkResults([]);setLinkSelectedPlan(null);setLinkPolicyNumber('');setLinkError(null)}}>{isEn?'Cancel':'取消'}</Btn>
            <Btn variant="primary" style={{flex:1}} onClick={handleLinkPlan} disabled={!linkSelectedPlan||!linkPolicyNumber.trim()||linking}>{linking?(isEn?'Adding…':'新增中…'):(isEn?'Add policy':'新增保單')}</Btn>
          </div>
        </Card>}
      </div>

      {/* "Your coverage" - one consolidated answer, see loadCoverageSummary above */}
      {(heldPolicies.length>0||lapsedPolicies.length>0||coverageSummary.pendingCount>0||coverageSummary.unreadCount>0)&&<div style={{margin:'12px 16px 0',background:'#fff',border:`1.5px solid ${__theme.accent}`,borderRadius:'14px',padding:'14px'}}>
        <div style={{fontSize:'10px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:C.textMuted,marginBottom:'8px'}}>{isEn?'Your coverage':'您的保障'}</div>
        {heldPolicies.map(p=>(
          <div key={p.id} style={{padding:'8px 0',borderBottom:`0.5px solid ${__theme.accentXLight}`}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{p.plan_name}</div>
            <div style={{fontSize:'11px',color:__theme.accent,fontWeight:600}}>✓ {isEn?'Active':'生效中'}{p.premium!=null?` — HK$${p.premium}/mo`:''}</div>
          </div>
        ))}
        {lapsedPolicies.map(p=>(
          <div key={p.id} style={{padding:'8px 0',borderBottom:`0.5px solid ${__theme.accentXLight}`}}>
            <div style={{fontSize:'13px',fontWeight:600}}>{p.plan_name}</div>
            <div style={{fontSize:'11px',color:C.red,fontWeight:600}}>✕ {isEn?'Coverage ended':'保障已終止'}</div>
          </div>
        ))}
        {coverageSummary.pendingCount>0&&<div onClick={()=>{setLocalJumpId(coverageSummary.firstPendingId);setTab('inquiries')}} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:coverageSummary.unreadCount>0?`0.5px solid ${__theme.accentXLight}`:'none',cursor:'pointer'}}>
          <div style={{fontSize:'12px',color:C.amber,fontWeight:600}}>⚠ {coverageSummary.pendingCount} {isEn?'pending underwriter review':'等待核保'}</div>
          <span style={{color:C.textMuted,fontSize:'14px'}}>›</span>
        </div>}
        {coverageSummary.unreadCount>0&&<div onClick={()=>{setLocalJumpId(coverageSummary.firstPendingId);setTab('inquiries')}} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',cursor:'pointer'}}>
          <div style={{fontSize:'12px',color:C.textSub}}>{coverageSummary.unreadCount} {isEn?'unread message(s)':'則未讀訊息'}</div>
          <span style={{color:__theme.accent,fontSize:'11px',fontWeight:600}}>{isEn?'See all →':'查看全部 →'}</span>
        </div>}
      </div>}

      {/* Tabs */}
      <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`,marginTop:'12px'}}>
        {[['plans',isEn?'Compare plans':'比較計劃'],['inquiries',isEn?'My inquiries':'我的查詢'],['claims',isEn?'Claims':'索賠'],['documents',isEn?'Document prep':'文件準備'],['agents',isEn?'Agent ratings':'代理人評分']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'11px 4px',fontSize:'11px',fontWeight:500,color:tab===k?__theme.accent:C.textSub,textAlign:'center',borderBottom:`2px solid ${tab===k?__theme.accent:'transparent'}`,cursor:'pointer'}}>{l}</div>
        ))}
      </div>

      {/* ── PLANS & COMPARISON ── */}
      {tab==='plans'&&<>
        {/* How Medsa connects patients to insurers — neutral comparison, not advice */}
        <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px 16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:C.navy,marginBottom:'6px'}}>◈ {isEn?'How Medsa connects you to insurers':'Medsa如何連接您與保險公司'}</div>
          <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.7}}>
            {isEn
              ? 'Medsa is designed to filter plans against your verified health records once insurers have signed on — for now, this shows a general comparison across available plans, not a personalised match. No questionnaires, no cold calls. This is a neutral comparison, not personal advice; you decide what fits. When you inquire, your details are forwarded directly to the insurer or a licensed intermediary. Once insurers integrate with Medsa, personalised filtering, agent assignment, claims, and status updates will all work automatically — one place for everything health.'
              : 'Medsa的設計目標是在保險公司完成系統整合後,根據您已核實的健康記錄篩選方案——目前顯示的是各方案的一般比較,並非個人化配對。無需填寫問卷,亦無需接聽推銷電話。這是中立的比較,並非個人建議;最終選擇由您決定。當您提出查詢後,您的資料將直接轉發予保險公司或持牌中介人。一旦保險公司與Medsa完成系統整合,個人化篩選、代理人分配、索償及狀態更新將自動運作——所有健康相關事務,一站式處理。'}
          </div>
        </div>

        <div style={{margin:'10px 16px 0',background:__theme.accentXLight,border:`0.5px solid ${__theme.accentLight}`,borderRadius:'14px',padding:'14px 16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:__theme.accent,marginBottom:'4px'}}>◈ {isEn?'Plan comparison, not advice':'方案比較,並非建議'}</div>
          <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>{isEn?'Plans are filtered against your verified health records and shown with the criteria they meet. Medsa doesn’t rank plans or tell you which is "best" — that’s a decision for you or a licensed agent. Sponsored plans are clearly labelled and filtered the same way as any other plan.':'方案根據您已核實的健康記錄篩選,並列明其符合的條件。Medsa不會為方案排名,亦不會告知何者「最佳」——此決定應由您或持牌代理人作出。贊助方案會清楚標示,並與其他方案採用相同的篩選方式。'}</div>
        </div>

        {/* "Find me a plan" (aq2-09) - guided entry matching the original
            design intent: declare once, consent to screening, get matched
            recommendations up front instead of browsing every plan blind.
            Patients are still welcome to browse the full list below either
            way - this is an addition, not a gate. */}
        <div style={{margin:'10px 16px 0'}}>
          {!findPlanOpen
            ? <Btn variant="primary" style={{width:'100%'}} onClick={()=>setFindPlanOpen(true)}>✨ {isEn?'Find me a plan':'為我配對方案'}</Btn>
            : <Card style={{padding:'16px'}}>
                <div style={{fontSize:'13px',fontWeight:600,marginBottom:'10px'}}>{isEn?'Find me a plan':'為我配對方案'}</div>
                {!findPlanResults ? <>
                  {/* Was its own re-asked-every-time checkbox (default off);
                      now reflects the standing Settings preference instead
                      (default on, see EditProfileScreen) - one line here
                      rather than asking again on every search. */}
                  <div style={{fontSize:'11px',color:C.textSub,marginBottom:'10px',lineHeight:1.5}}>
                    {patient.history_matching_enabled !== false
                      ? (isEn?'Your visit history on this platform will be checked against every plan\'s coverage, as set in your Settings.':'您在平台上的就診記錄將與各方案的保障範圍核對，設定見您的Settings。')
                      : (isEn?'Visit history is off in your Settings - matching will only use what you select below.':'您的Settings已關閉就診記錄配對 - 配對只會根據下方所選項目。')}
                  </div>
                  <div style={{fontSize:'11px',color:C.textSub,marginBottom:'6px'}}>{isEn?'Do any of these apply to you?':'以下是否適用於您?'}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'14px'}}>
                    {[...new Set(plans.flatMap(p=>p.criteria||[]))].slice(0,20).concat(['Smoker','Heavy alcohol use','High-risk occupation or hobby','Family history of a serious condition']).map(c=>(
                      <span key={c} onClick={()=>setFindPlanConditions(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c])} style={{fontSize:'11px',padding:'5px 10px',borderRadius:'20px',cursor:'pointer',background:findPlanConditions.includes(c)?__theme.accent:C.card,color:findPlanConditions.includes(c)?'#fff':C.textSub,border:`0.5px solid ${findPlanConditions.includes(c)?__theme.accent:C.border}`}}>{c}</span>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:'8px'}}>
                    <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>{setFindPlanOpen(false);setFindPlanConditions([])}}>{isEn?'Cancel':'取消'}</Btn>
                    <Btn variant="primary" style={{flex:1,fontSize:'12px'}} disabled={findPlanLoading} onClick={async()=>{
                      setFindPlanLoading(true)
                      const res = await fetch('/api/patient/find_me_a_plan', {
                        method:'POST', headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ patientId: patient.id, declaredConditions: findPlanConditions, consentHistoryShared: patient.history_matching_enabled !== false }),
                      })
                      const data = await res.json()
                      setFindPlanResults(data.matches||[])
                      setFindPlanLoading(false)
                    }}>{findPlanLoading?(isEn?'Matching…':'配對中…'):(isEn?'Show my matches':'顯示配對結果')}</Btn>
                  </div>
                </> : <>
                  {findPlanResults.length===0
                    ? <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'12px'}}>{isEn?'No automated match right now - browse the full list below, or talk to an agent from any plan.':'暫時未有自動配對結果 - 可瀏覽下方完整列表,或聯絡任何方案的代理。'}</div>
                    : <div style={{marginBottom:'12px'}}>
                        {findPlanResults.map(m=>{
                          const idx = plans.findIndex(p=>p.id===m.planId)
                          return (
                            <div key={m.planId} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:C.beige,borderRadius:'8px',marginBottom:'6px'}}>
                              <div>
                                <div style={{fontSize:'12px',fontWeight:600}}>{m.planName}</div>
                                <div style={{fontSize:'11px',color:C.textMuted}}>{m.companyName}{m.quotedPremium!=null?` · HK$${m.quotedPremium}/mo`:''}</div>
                              </div>
                              {/* Confirmed dead code found & removed this round: this
                                  used to open an inline declaration form that no
                                  longer exists (and, it turned out, never actually
                                  rendered even before removal) - a result here now
                                  goes straight to the plan's own real page, same as
                                  every other "view a specific plan" entry point. */}
                              {idx>=0&&<Btn style={{fontSize:'11px',padding:'6px 12px'}} onClick={()=>{
                                viewPlanById(m.planId)
                                setFindPlanOpen(false); setFindPlanResults(null)
                              }}>{isEn?'View':'查看'}</Btn>}
                            </div>
                          )
                        })}
                      </div>}
                  <Btn style={{width:'100%',fontSize:'12px'}} onClick={()=>{setFindPlanResults(null)}}>{isEn?'Start over':'重新開始'}</Btn>
                </>}
              </Card>}
        </div>

        <SecLabel>{isEn?'Plans matching your profile':'符合您狀況的計劃'}</SecLabel>
        {plansLoading&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>{isEn?'Loading plans…':'載入計劃中…'}</div>}
        {!plansLoading&&plans.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>{isEn?'No plans available yet.':'暫無可用計劃。'}</div>}
        {!plansLoading&&plans.length>0&&visiblePlans.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.textMuted,fontSize:'12px'}}>{isEn?`No plans match "${planSearch}".`:`沒有符合「${planSearch}」的計劃。`}</div>}
        {!plansLoading&&visiblePlans.map((plan,i)=>(
          <Card key={i} style={{padding:'14px 16px'}}>
            {plan.sponsored&&plan.sponsorThumbnailUrl&&<img src={plan.sponsorThumbnailUrl} alt="" style={{width:'100%',height:100,objectFit:'cover',borderRadius:'10px',marginBottom:'10px'}}/>}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
                  {plan.isMatched&&<span style={{fontSize:'10px',background:__theme.accentLight,color:__theme.accent,padding:'1px 7px',borderRadius:'20px',fontWeight:600}}>{isEn?'Matches your records':'符合您的記錄'}</span>}
                  {plan.sponsored&&<span style={{fontSize:'10px',background:C.amberLight,color:C.amber,padding:'1px 7px',borderRadius:'20px',fontWeight:600}}>{isEn?'Sponsored':'贊助'}</span>}
                  <span style={{fontSize:'10px',background:C.card,color:C.textSub,padding:'1px 7px',borderRadius:'20px'}}>{pt(plan.type)}</span>
                </div>
                <div style={{fontSize:'15px',fontWeight:700}}>{plan.name}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{plan.company}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                {plan.priceUnavailable
                  ? <div style={{fontSize:'11px',color:C.textMuted}}>{plan.noTiersAtAll
                      ? (isEn?'Not sold through Medsa - contact the insurer directly':'Medsa不銷售此計劃 - 請直接聯絡保險公司')
                      : (isEn?'No pricing for your age':'無您年齡的價格')}</div>
                  : <>
                      <div style={{fontSize:'14px',fontWeight:700,color:C.navy}}>HK${plan.price}{isEn?'/mo':'/月'}</div>
                      <div style={{fontSize:'11px',color:C.textMuted}}>{isEn?'Annual limit':'年度限額'}: HK${plan.limit}</div>
                    </>}
              </div>
            </div>
            {plan.sponsored&&plan.sponsorDescription&&<div style={{fontSize:'12px',color:C.text,marginBottom:'10px',lineHeight:1.5}}>{plan.sponsorDescription}</div>}
            {/* Objective criteria met - no ranking, no score */}
            <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
              {plan.criteria.map(c=><span key={c} style={{fontSize:'11px',background:C.card,color:C.textSub,padding:'3px 10px',borderRadius:'20px'}}>{pt(c)}</span>)}
            </div>
            {/* Real rebuild: this card is now just for browsing/comparing -
                declaring and quoting happens on the plan's own dedicated
                page (PlanDetailFlow.jsx), opened by "View plan" below.
                Everything that used to live inline here (the consent+
                condition-chip form, the result card, the inline buy
                panel) moved there as a real multi-step flow. Held-plan
                and requires-agent messaging still shown here since
                they're about browsing, not declaring. Tapping the card
                goes straight to the plan's own page - no separate
                "see details" step first. */}
            {heldPolicies.some(hp=>hp.plan_id===plan.id)
              ? <div style={{background:C.beige,borderRadius:'8px',padding:'10px 12px',fontSize:'11px',color:C.textSub,lineHeight:1.5,marginBottom:'10px'}}>{isEn?'✓ You already hold this plan.':'✓ 您已持有此計劃。'}</div>
              : <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'6px',lineHeight:1.4}}>{plan.requiresAgent?`${plan.company} only takes inquiries for this plan through an agent.`:''}</div>}
            <Btn variant="primary" style={{width:'100%',fontSize:'12px'}} onClick={()=>setViewingPlanIndex(i)}>View plan →</Btn>
          </Card>
        ))}

        {/* Search all plans */}
        <SecLabel>{isEn?'Search all plans':'搜尋所有計劃'}</SecLabel>
        <div style={{padding:'0 16px 10px'}}>
          <div style={{position:'relative',display:'flex',alignItems:'center'}}>
            <span style={{position:'absolute',left:'10px',fontSize:'16px',color:__theme.accent}}>◎</span>
            <input value={planSearch} onChange={e=>setPlanSearch(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'10px 12px 10px 34px',fontSize:'13px',background:C.cream,outline:'none',fontFamily:'inherit'}} placeholder={isEn?'Search e.g. dental, travel, critical illness…':'按關鍵字搜尋…'}/>
          </div>
        </div>
        <div style={{padding:'0 16px 16px'}}>
          <div style={{background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.brown,lineHeight:1.6}}>
            ◇ {isEn
              ? "Sponsored plans are clearly labelled and filtered the same way as any other plan — sponsorship never changes what's shown. This is a comparison tool, not financial advice. Medsa earns a referral fee from insurers or licensed intermediaries for enquiries sent through this screen."
              : '贊助方案會清楚標示,並與其他方案採用相同的篩選方式——贊助狀態不會影響顯示內容。此為比較工具,並非財務建議。Medsa會就透過此頁面發出的查詢,向保險公司或持牌中介人收取轉介費用。'}
          </div>
        </div>
      </>}

      {/* ── MY INQUIRIES ── */}
      {tab==='inquiries'&&<MyInquiriesTab isEn={isEn} patient={patient} onViewPlan={viewPlanById} initialExpandedId={deepLinkInquiryId||localJumpId} onConsumeDeepLink={()=>{onConsumeInquiryDeepLink&&onConsumeInquiryDeepLink();setLocalJumpId(null)}}/>}

      {/* ── CLAIMS ── */}
      {tab==='claims'&&<ClaimsTab isEn={isEn} claims={claims} patient={patient} records={records} activePolicy={activePolicy} heldPolicies={heldPolicies}/>}

      {/* ── DOCUMENT PREP ── */}
      {tab==='documents'&&<DocumentPrepTab isEn={isEn} patient={patient}/>}

      {/* ── AGENT RATINGS ── */}
      {tab==='agents'&&<>
        <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px 16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:C.navy,marginBottom:'6px'}}>◈ Agent ratings — coming with insurer integration</div>
          <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.7}}>
            Once your insurer integrates with Medsa, verified agents will appear here with ratings, languages, specialties, and availability. You will be able to browse, choose, and switch agents directly. All ratings are anonymous and based on verified interactions only.
          </div>
        </div>

        {/* Anonymous feedback explainer */}
        <SecLabel>{isEn?'How feedback works':'如何提交評價'}</SecLabel>
        <Card style={{padding:'14px 16px'}}>
          {[
            {icon:'◎',title:'Anonymous by default',body:'Your name is never attached to ratings or comments. Agents and insurers cannot identify who left feedback.'},
            {icon:'◈',title:'Verified interactions only',body:'You can only rate an agent after a confirmed interaction — prevents fake reviews.'},
            {icon:'◇',title:'Separate from complaints',body:'Ratings are public and anonymous. Formal complaints are named, private, and go to the insurer and Medsa support.'},
          ].map((item,i,arr)=>(
            <div key={i} style={{display:'flex',gap:'12px',padding:'10px 0',borderBottom:i<arr.length-1?`0.5px solid ${C.border}`:'none'}}>
              <span style={{fontSize:'18px',color:__theme.accent,flexShrink:0}}>{item.icon}</span>
              <div><div style={{fontSize:'13px',fontWeight:500,marginBottom:'3px'}}>{item.title}</div><div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5}}>{item.body}</div></div>
            </div>
          ))}
        </Card>

        {/* Preview of what agent ratings will look like */}
        <SecLabel>{isEn?'Preview — agent ratings once live':'預覽 — 代理人評分上線後'}</SecLabel>
        <div style={{margin:'0 16px',background:C.card,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'16px',opacity:0.6}}>
          <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'12px',textAlign:'center',fontStyle:'italic'}}>This is a preview — agent profiles will be verified and live once your insurer integrates with Medsa</div>
          {[
            {init:'張',name:'Agent A',company:'AIA',rating:4.9,reviews:62,spec:'Health + critical illness',langs:['廣東話','English'],avail:'Available'},
            {init:'李',name:'Agent B',company:'Prudential',rating:4.8,reviews:41,spec:'Family & travel plans',langs:['English','普通話'],avail:'Busy'},
          ].map((a,i)=>(
            <div key={i} style={{display:'flex',gap:'12px',alignItems:'center',padding:'10px 0',borderTop:i>0?`0.5px solid ${C.border}`:'none'}}>
              <div style={{width:40,height:40,borderRadius:'10px',background:__theme.accentLight,color:__theme.accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:600,flexShrink:0}}>{a.init}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:500}}>{a.name}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{a.company} · {a.spec}</div>
                <div style={{fontSize:'12px',color:'#d4a017'}}>{'★'.repeat(Math.round(a.rating))} <span style={{fontSize:'11px',color:C.textMuted}}>{a.rating} ({a.reviews})</span></div>
                <div style={{display:'flex',gap:'4px',marginTop:'4px',flexWrap:'wrap'}}>
                  {a.langs.map(l=><span key={l} style={{fontSize:'10px',background:__theme.accentLight,color:__theme.accent,padding:'1px 7px',borderRadius:'20px'}}>{l}</span>)}
                  <span style={{fontSize:'10px',background:a.avail==='Available'?__theme.accentLight:C.amberLight,color:a.avail==='Available'?__theme.accent:C.amber,padding:'1px 7px',borderRadius:'20px'}}>{a.avail}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Anonymous feedback form — available now for patients who have interacted */}
        <SecLabel>{isEn?'Leave anonymous feedback':'留下匿名評價'}</SecLabel>
        <Card style={{padding:'16px'}}>
          {worksWithAgentsLoading&&<div style={{textAlign:'center',padding:'10px',color:C.textMuted,fontSize:'12px'}}>Loading…</div>}
          {!worksWithAgentsLoading&&!feedbackSubmitted&&worksWithAgents.length===0&&
            <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.5,textAlign:'center',padding:'10px 0'}}>You haven't worked with an agent through Medsa yet - feedback opens up once you have a real policy with one.</div>}
          {!worksWithAgentsLoading&&!feedbackSubmitted&&worksWithAgents.length>0&&<>
            <div style={{fontSize:'13px',color:C.textSub,marginBottom:'12px',lineHeight:1.5}}>Had a recent interaction with an agent through Medsa? Leave anonymous feedback — your identity will never be revealed.</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>Which agent?</div>
            <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'12px'}}>
              {worksWithAgents.map(a=>(
                <div key={a.id} onClick={()=>setSelectedFeedbackAgentId(a.id)} style={{padding:'10px 12px',borderRadius:'8px',border:`1.5px solid ${selectedFeedbackAgentId===a.id?__theme.accent:C.border}`,background:selectedFeedbackAgentId===a.id?__theme.accentXLight:C.cream,cursor:'pointer',fontSize:'13px',fontWeight:selectedFeedbackAgentId===a.id?600:400}}>{a.name}</div>
              ))}
            </div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>Your rating:</div>
            <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
              {[1,2,3,4,5].map(n=><div key={n} onClick={()=>setAnonRating(n)} style={{flex:1,textAlign:'center',fontSize:'24px',cursor:'pointer',opacity:anonRating&&anonRating>=n?1:0.25}}>★</div>)}
            </div>
            <textarea value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginBottom:'10px'}} rows={3} placeholder="Optional comment — anonymous, never attributed to you…"/>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>◇ Your name and account details are never stored with this feedback.</div>
            <Btn variant="primary" style={{width:'100%'}} disabled={!anonRating||!selectedFeedbackAgentId||feedbackSubmitting} onClick={handleSubmitFeedback}>{feedbackSubmitting?'Submitting…':'Submit anonymously'}</Btn>
          </>}
          {feedbackSubmitted&&<>
            <div style={{textAlign:'center',padding:'16px 0'}}>
              <div style={{fontSize:'28px',marginBottom:'10px'}}>✓</div>
              <div style={{fontSize:'14px',fontWeight:600,color:__theme.accent,marginBottom:'6px'}}>Feedback submitted anonymously</div>
              <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>Thank you. Your feedback helps other patients make informed choices. It will appear on the agent's public profile once insurer integration is live.</div>
            </div>
          </>}
        </Card>

        {/* Complaint vs feedback distinction */}
        <div style={{margin:'0 16px 16px',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.brown,lineHeight:1.6}}>
          ◇ <strong>Feedback is anonymous and public.</strong> If you need to raise a formal complaint about an agent or insurer, use the Help section — complaints are named, private, and directed to Medsa support and the relevant insurer.
        </div>
      </>}
    </div>
  )
}

// Real WHO Child Growth Standards percentile curves (3rd/15th/50th/85th/97th)
// as five thin reference lines - the familiar shape of an actual printed
// growth chart, not a shaded band - with the child's own measurements as
// the one accent-colored series on top. No preterm correction (see
// lib/whoGrowth.js) - every percentile here assumes a full-term birth.
function WhoGrowthChart({ logs, valueKey, indicator, sex, dobISO, unit, accentColor, isEn }) {
  const points = logs.filter(g=>g[valueKey]!=null).map(g=>({ ageDays: ageDaysBetween(dobISO, g.recorded_at), value: g[valueKey] }))
  if (!sex) return <div style={{fontSize:'11px',color:C.textMuted,padding:'16px 0',textAlign:'center'}}>{isEn?"Set this profile's sex (Account Settings) to see the WHO percentile chart.":'請在帳戶設定中設定性別以查看WHO生長百分比圖。'}</div>
  if (points.length===0) return <div style={{fontSize:'11px',color:C.textMuted,padding:'16px 0',textAlign:'center'}}>{isEn?'No entries yet':'暫無記錄'}</div>

  const todayAgeDays = ageDaysBetween(dobISO, new Date().toISOString().slice(0,10))
  const maxAgeDays = Math.max(todayAgeDays, ...points.map(p=>p.ageDays), 30)
  const bands = percentileBands(indicator, sex, maxAgeDays, 24)

  const W=300, H=150, padL=4, padR=26, padT=10, padB=18
  const allVals = [...bands.flatMap(b=>[b.p3,b.p97]), ...points.map(p=>p.value)]
  const minV = Math.min(...allVals), maxV = Math.max(...allVals)
  const vRange = (maxV-minV) || 1
  const sx = ageDays => padL + (ageDays/maxAgeDays)*(W-padL-padR)
  const sy = v => H-padB - ((v-minV)/vRange)*(H-padT-padB)

  const bandLine = key => bands.map((b,i)=>`${i===0?'M':'L'}${sx(b.ageDays)},${sy(b[key])}`).join(' ')
  const childPath = points.map((p,i)=>`${i===0?'M':'L'}${sx(p.ageDays)},${sy(p.value)}`).join(' ')
  const monthGridlines = [0,6,12,24,36,48,60].filter(m=>m*30.44<=maxAgeDays)

  return (
    <svg width="100%" height={H+14} viewBox={`0 0 ${W} ${H+14}`} preserveAspectRatio="none">
      {monthGridlines.map(m=>{
        const x = sx(m*30.44)
        return <g key={m}><line x1={x} y1={padT} x2={x} y2={H-padB} stroke={C.border} strokeWidth="1"/><text x={x} y={H+10} fontSize="8" fill={C.textMuted} textAnchor="middle">{m}mo</text></g>
      })}
      {['p3','p15','p50','p85','p97'].map(key=>(
        <g key={key}>
          <path d={bandLine(key)} fill="none" stroke={C.border} strokeWidth="1"/>
          <text x={W-padR+3} y={sy(bands[bands.length-1][key])+3} fontSize="7.5" fill={C.textMuted}>{key.slice(1)}</text>
        </g>
      ))}
      <path d={childPath} fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {points.map((p,i)=><circle key={i} cx={sx(p.ageDays)} cy={sy(p.value)} r="4" fill={accentColor} stroke="#fff" strokeWidth="2"/>)}
      <text x={padL} y={padT-2} fontSize="8" fill={C.textMuted}>{Math.round(maxV*10)/10}{unit}</text>
      <text x={padL} y={H-padB+8} fontSize="8" fill={C.textMuted}>{Math.round(minV*10)/10}{unit}</text>
    </svg>
  )
}

const FEEDING_TYPES = [
  { value: 'breast', label: { en: 'Breast', zh: '母乳' } },
  { value: 'formula', label: { en: 'Formula', zh: '配方奶' } },
  { value: 'solid', label: { en: 'Solid food', zh: '固體食物' } },
]

// Growth + feeding tracking, framed as Medsa's digital equivalent of the
// Hong Kong Maternal & Child Health Centre "Blue Book" - that booklet's
// own three pillars are growth charts, feeding/development notes, and
// vaccination records. Vaccinations already live in RecordsScreen (the
// "History, vaccinations, share" tile) - this screen covers the other
// two and links across rather than duplicating that part.
// The real Hong Kong Department of Health (MCHC "Blue Book") milestone
// table, as given directly - not sourced from memory or guessed, so none
// of the WHO-growth-chart sourcing caution applies here. Domain labels
// match the DoH's own three categories.
const MILESTONES = [
  { key:'m02-motor', ageBand:{en:'0–2 Months',zh:'0–2個月'}, domain:{en:'Gross / Fine Motor Skills',zh:'大肌肉/小肌肉動作'}, en:'Holds head up briefly when on tummy; opens hands.', zh:'俯臥時能短暫抬頭;會張開手掌。' },
  { key:'m02-lang', ageBand:{en:'0–2 Months',zh:'0–2個月'}, domain:{en:'Hearing, Language & Vision',zh:'聽覺、語言與視覺'}, en:'Startles at loud noises; tracks objects with eyes; coos.', zh:'對大聲響有驚嚇反應;眼睛能追視物件;會發出咕咕聲。' },
  { key:'m02-social', ageBand:{en:'0–2 Months',zh:'0–2個月'}, domain:{en:'Social & Self-Care',zh:'社交與自理'}, en:'Smiles at primary caregivers (social smile).', zh:'會對主要照顧者微笑(社交性微笑)。' },

  { key:'m46-motor', ageBand:{en:'4–6 Months',zh:'4–6個月'}, domain:{en:'Gross / Fine Motor Skills',zh:'大肌肉/小肌肉動作'}, en:'Rolls over (front-to-back); reaches out and grasps objects with both hands.', zh:'會翻身(俯臥轉仰臥);會伸手並用雙手抓取物件。' },
  { key:'m46-lang', ageBand:{en:'4–6 Months',zh:'4–6個月'}, domain:{en:'Hearing, Language & Vision',zh:'聽覺、語言與視覺'}, en:'Turns head toward sounds; babble sounds ("ba-ba", "ma-ma").', zh:'會轉頭尋找聲源;發出"爸爸"、"媽媽"等疊音。' },
  { key:'m46-social', ageBand:{en:'4–6 Months',zh:'4–6個月'}, domain:{en:'Social & Self-Care',zh:'社交與自理'}, en:'Recognizes familiar faces; responds to own name.', zh:'認得熟悉的面孔;對自己的名字有反應。' },

  { key:'m912-motor', ageBand:{en:'9–12 Months',zh:'9–12個月'}, domain:{en:'Gross / Fine Motor Skills',zh:'大肌肉/小肌肉動作'}, en:'Sits unsupported; pulls self up to stand; uses pincer grasp (thumb and index finger).', zh:'能獨立坐穩;會拉扶站立;會用拇指和食指捏取物件。' },
  { key:'m912-lang', ageBand:{en:'9–12 Months',zh:'9–12個月'}, domain:{en:'Hearing, Language & Vision',zh:'聽覺、語言與視覺'}, en:'Understands simple words like "No" or "Bye-Bye"; says 1–2 simple words.', zh:'明白簡單字詞如"不"或"再見";會說1-2個簡單字詞。' },
  { key:'m912-social', ageBand:{en:'9–12 Months',zh:'9–12個月'}, domain:{en:'Social & Self-Care',zh:'社交與自理'}, en:'Waves goodbye; plays simple games like Peek-a-boo.', zh:'會揮手說再見;會玩簡單遊戲如躲貓貓。' },

  { key:'m1824-motor', ageBand:{en:'18–24 Months',zh:'18–24個月'}, domain:{en:'Gross / Fine Motor Skills',zh:'大肌肉/小肌肉動作'}, en:'Walks independently; kicks a ball; scribbles spontaneously.', zh:'能獨立行走;會踢球;會自發塗畫。' },
  { key:'m1824-lang', ageBand:{en:'18–24 Months',zh:'18–24個月'}, domain:{en:'Hearing, Language & Vision',zh:'聽覺、語言與視覺'}, en:'Uses 10+ words; points to objects/body parts when named; combines 2 words.', zh:'會說10個以上字詞;被問及會指出物件/身體部位;能組合2個字詞。' },
  { key:'m1824-social', ageBand:{en:'18–24 Months',zh:'18–24個月'}, domain:{en:'Social & Self-Care',zh:'社交與自理'}, en:'Uses a spoon/cup; imitates adult actions; shows independence.', zh:'會使用匙羹/杯子;會模仿大人動作;表現獨立性。' },

  { key:'m35y-motor', ageBand:{en:'3–5 Years',zh:'3–5歲'}, domain:{en:'Gross / Fine Motor Skills',zh:'大肌肉/小肌肉動作'}, en:'Runs smoothly, hops, stands on one foot; holds a pencil with a tripod grip.', zh:'能順暢跑動、單腳跳、單腳站立;能以三指握筆。' },
  { key:'m35y-lang', ageBand:{en:'3–5 Years',zh:'3–5歲'}, domain:{en:'Hearing, Language & Vision',zh:'聽覺、語言與視覺'}, en:'Speaks in full sentences; answers "Who/What/Where" questions clearly.', zh:'能說出完整句子;能清楚回答"誰/什麼/哪裡"等問題。' },
  { key:'m35y-social', ageBand:{en:'3–5 Years',zh:'3–5歲'}, domain:{en:'Social & Self-Care',zh:'社交與自理'}, en:'Dresses self; engages in cooperative group play; toilet trained.', zh:'能自行穿衣;能參與群體合作遊戲;已完成大小便訓練。' },
]
const MILESTONE_AGE_BANDS = [...new Set(MILESTONES.map(m=>m.ageBand.en))]

// bb-01 - the real Hong Kong Childhood Immunisation Programme (HKCIP)
// schedule, transcribed verbatim from the user's own copy: "Updated
// schedule of the Hong Kong Childhood Immunisation Programme (HKCIP)
// recommended by the Scientific Committee on Vaccine Preventable
// Diseases of the Centre for Health Protection, Department of Health
// (as of 9 October 2024)". ageMonths is only set for the clean,
// birthday-math bands (Newborn through 18 months) - the Primary 1/5/6
// bands depend on Hong Kong school-year placement rules, not a fixed
// age in months, so those are left without a computed "due" date rather
// than guessing at school-year cutoff logic.
const HKCIP_SCHEDULE = [
  { ageMonths:0, ageLabel:{en:'Newborn',zh:'出生時'}, doses:[
    { key:'bcg', vaccine:{en:'B.C.G. Vaccine',zh:'卡介苗'}, dose:{en:'',zh:''} },
    { key:'hepb1', vaccine:{en:'Hepatitis B Vaccine',zh:'乙型肝炎疫苗'}, dose:{en:'First dose',zh:'第一劑'} },
  ]},
  { ageMonths:1, ageLabel:{en:'1 month',zh:'1個月'}, doses:[
    { key:'hepb2', vaccine:{en:'Hepatitis B Vaccine',zh:'乙型肝炎疫苗'}, dose:{en:'Second dose',zh:'第二劑'} },
  ]},
  { ageMonths:2, ageLabel:{en:'2 months',zh:'2個月'}, doses:[
    { key:'dtapipv1', vaccine:{en:'DTaP-IPV Vaccine',zh:'白喉、破傷風、無細胞百日咳及不活化小兒麻痺混合疫苗'}, dose:{en:'First dose',zh:'第一劑'} },
    { key:'pcv15-1', vaccine:{en:'15-valent Pneumococcal Conjugate Vaccine (PCV15)',zh:'15價肺炎球菌結合疫苗'}, dose:{en:'First dose',zh:'第一劑'} },
  ]},
  { ageMonths:4, ageLabel:{en:'4 months',zh:'4個月'}, doses:[
    { key:'dtapipv2', vaccine:{en:'DTaP-IPV Vaccine',zh:'白喉、破傷風、無細胞百日咳及不活化小兒麻痺混合疫苗'}, dose:{en:'Second dose',zh:'第二劑'} },
    { key:'pcv15-2', vaccine:{en:'15-valent Pneumococcal Conjugate Vaccine (PCV15)',zh:'15價肺炎球菌結合疫苗'}, dose:{en:'Second dose',zh:'第二劑'} },
  ]},
  { ageMonths:6, ageLabel:{en:'6 months',zh:'6個月'}, doses:[
    { key:'dtapipv3', vaccine:{en:'DTaP-IPV Vaccine',zh:'白喉、破傷風、無細胞百日咳及不活化小兒麻痺混合疫苗'}, dose:{en:'Third dose',zh:'第三劑'} },
    { key:'hepb3', vaccine:{en:'Hepatitis B Vaccine',zh:'乙型肝炎疫苗'}, dose:{en:'Third dose',zh:'第三劑'} },
  ]},
  { ageMonths:12, ageLabel:{en:'12 months',zh:'12個月'}, doses:[
    { key:'mmr1', vaccine:{en:'MMR Vaccine (Measles, Mumps & Rubella)',zh:'麻疹、腮腺炎及德國麻疹混合疫苗'}, dose:{en:'First dose',zh:'第一劑'} },
    { key:'pcv15-booster', vaccine:{en:'15-valent Pneumococcal Conjugate Vaccine (PCV15)',zh:'15價肺炎球菌結合疫苗'}, dose:{en:'Booster dose',zh:'加強劑'} },
    { key:'varicella1', vaccine:{en:'Varicella Vaccine',zh:'水痘疫苗'}, dose:{en:'First dose',zh:'第一劑'} },
  ]},
  { ageMonths:18, ageLabel:{en:'18 months',zh:'18個月'}, doses:[
    { key:'dtapipv-booster', vaccine:{en:'DTaP-IPV Vaccine',zh:'白喉、破傷風、無細胞百日咳及不活化小兒麻痺混合疫苗'}, dose:{en:'Booster dose',zh:'加強劑'} },
    { key:'mmrv2', vaccine:{en:'MMRV Vaccine (Measles, Mumps, Rubella & Varicella)',zh:'麻疹、腮腺炎、德國麻疹及水痘混合疫苗'}, dose:{en:'Second dose - children born on or after 1.7.2018, given at MCHC. Children born 1.1.2013-30.6.2018 instead receive this in Primary 1 via the School Immunisation Team.',zh:'第二劑 - 2018年7月1日或以後出生的兒童於母嬰健康院接種。2013年1月1日至2018年6月30日出生的兒童則於小學一年級由學校免疫注射小組接種。'} },
  ]},
  { ageMonths:null, ageLabel:{en:'Primary 1',zh:'小學一年級'}, doses:[
    { key:'dtapipv-p1', vaccine:{en:'DTaP-IPV Vaccine',zh:'白喉、破傷風、無細胞百日咳及不活化小兒麻痺混合疫苗'}, dose:{en:'Booster dose',zh:'加強劑'} },
  ]},
  { ageMonths:null, ageLabel:{en:'Primary 5',zh:'小學五年級'}, doses:[
    { key:'hpv1', vaccine:{en:'9-valent Human Papillomavirus (HPV) Vaccine',zh:'9價人類乳頭瘤病毒疫苗'}, dose:{en:'First dose',zh:'第一劑'} },
  ]},
  { ageMonths:null, ageLabel:{en:'Primary 6',zh:'小學六年級'}, doses:[
    { key:'dtipv-p6', vaccine:{en:'Diphtheria (reduced dose), Tetanus, acellular Pertussis (reduced dose) & Inactivated Poliovirus Vaccine',zh:'低劇量白喉、破傷風、無細胞百日咳及不活化小兒麻痺混合疫苗'}, dose:{en:'Booster dose',zh:'加強劑'} },
    { key:'hpv2', vaccine:{en:'9-valent HPV Vaccine',zh:'9價人類乳頭瘤病毒疫苗'}, dose:{en:'Second dose',zh:'第二劑'} },
  ]},
]

function KidsGrowthScreen({ isEn, patient={}, onNav, onPatientUpdated }) {
  const __theme = useContext(ThemeContext)
  const [growthLogs,setGrowthLogs]=useState([])
  const [feedingLogs,setFeedingLogs]=useState([])
  const [milestoneChecks,setMilestoneChecks]=useState([])
  const [loading,setLoading]=useState(true)
  const [gForm,setGForm]=useState({ recordedAt: new Date().toISOString().slice(0,10), weightKg:'', heightCm:'', headCm:'' })
  const [fForm,setFForm]=useState({ type:'breast', amountMl:'', durationMin:'', note:'' })
  const [saving,setSaving]=useState(false)
  const [mchcAppointments,setMchcAppointments]=useState([])
  const [mchcForm,setMchcForm]=useState({ appointmentAt:'', note:'' })
  const [symptomLogs,setSymptomLogs]=useState([])
  const [symptomForm,setSymptomForm]=useState({ temperatureC:'', symptoms:'', medicationGiven:'' })
  const [exportingSymptomPdf,setExportingSymptomPdf]=useState(false)
  const [diaperLogs,setDiaperLogs]=useState([])
  const [exportingErPdf,setExportingErPdf]=useState(false)
  const [scanningLabel,setScanningLabel]=useState(false)
  const [labelScanError,setLabelScanError]=useState('')
  const [labelScanFilled,setLabelScanFilled]=useState(false)
  const [sleepLogs,setSleepLogs]=useState([])
  const [sleepForm,setSleepForm]=useState({ sleepType:'nap' })
  const [sleepSession,setSleepSession]=useState(null) // {startedAt, sleepType} while a sleep is in progress
  const [sleepTick,setSleepTick]=useState(0) // forces a re-render every 30s so the live elapsed time moves
  const [immunizationChecks,setImmunizationChecks]=useState([])

  // Same flash fix as BumpHealthScreen - only the first load shows the
  // full "Loading…" screen, not every reload after an add/delete.
  async function load(isInitial=false) {
    if (!patient?.id) { setLoading(false); return }
    if (isInitial) setLoading(true)
    const [{ data: g }, { data: f }, { data: m }, { data: mchc }, { data: sym }, { data: diaper }, { data: sleep }, { data: imm }] = await Promise.all([
      supabase.from('kids_growth_logs').select('*').eq('patient_id', patient.id).order('recorded_at',{ascending:true}),
      supabase.from('kids_feeding_logs').select('*').eq('patient_id', patient.id).order('fed_at',{ascending:false}).limit(30),
      supabase.from('kids_milestone_checks').select('*').eq('patient_id', patient.id),
      supabase.from('kids_mchc_appointments').select('*').eq('patient_id', patient.id).order('appointment_at',{ascending:true}),
      supabase.from('kids_symptom_logs').select('*').eq('patient_id', patient.id).order('recorded_at',{ascending:false}).limit(30),
      supabase.from('kids_diaper_logs').select('*').eq('patient_id', patient.id).order('logged_at',{ascending:false}).limit(30),
      supabase.from('kids_sleep_logs').select('*').eq('patient_id', patient.id).order('started_at',{ascending:false}).limit(30),
      supabase.from('kids_immunization_checks').select('*').eq('patient_id', patient.id),
    ])
    setGrowthLogs(g||[])
    setFeedingLogs(f||[])
    setMilestoneChecks(m||[])
    setMchcAppointments(mchc||[])
    setSymptomLogs(sym||[])
    setDiaperLogs(diaper||[])
    setSleepLogs(sleep||[])
    setImmunizationChecks(imm||[])
    setLoading(false)
  }
  useEffect(() => { load(true) }, [patient?.id])

  // bb-01 - the real HKCIP schedule you supplied, as a manual checklist
  // (not auto-matched against the generic vaccinations table - see the
  // migration note for why).
  async function toggleImmunizationDose(key) {
    const existing = immunizationChecks.find(c=>c.dose_key===key)
    if (existing) {
      await supabase.from('kids_immunization_checks').delete().eq('id', existing.id)
    } else {
      await supabase.from('kids_immunization_checks').insert({ patient_id: patient.id, dose_key: key })
    }
    load()
  }
  const ageInMonths = patient.date_of_birth ? (Date.now() - new Date(patient.date_of_birth)) / (1000*60*60*24*30.44) : null
  const dueImmunizationBand = ageInMonths!=null ? HKCIP_SCHEDULE.find(band => band.ageMonths!=null && ageInMonths >= band.ageMonths && band.doses.some(d=>!immunizationChecks.some(c=>c.dose_key===d.key))) : null

  // Sleep log - the clearest gap against every benchmarked baby tracker
  // (BabyCenter, Ovia Parenting, etc.), which all log sleep alongside
  // feeding/diaper as a core entry. A live start/stop session, same
  // pattern as the kick counter (bump_kick_logs) - a parent starting this
  // the moment the baby falls asleep doesn't have to remember or re-enter
  // a time later, and the duration is computed automatically rather than
  // typed in.
  function startSleepSession() { setSleepSession({ startedAt:new Date(), sleepType:sleepForm.sleepType }) }
  async function finishSleepSession() {
    if (!sleepSession || !patient?.id) return
    setSaving(true)
    await supabase.from('kids_sleep_logs').insert({
      patient_id: patient.id,
      started_at: sleepSession.startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      sleep_type: sleepSession.sleepType,
    })
    setSleepSession(null)
    await load(); setSaving(false)
  }
  async function deleteSleepLog(id) { await supabase.from('kids_sleep_logs').delete().eq('id', id); load() }
  useEffect(() => {
    if (!sleepSession) return
    const interval = setInterval(() => setSleepTick(t=>t+1), 30000)
    return () => clearInterval(interval)
  }, [sleepSession])

  async function addDiaperLog(diaperType) {
    if (!patient?.id) return
    await supabase.from('kids_diaper_logs').insert({ patient_id: patient.id, diaper_type: diaperType })
    load()
  }
  async function deleteDiaperLog(id) { await supabase.from('kids_diaper_logs').delete().eq('id', id); load() }

  // kp-05 - pediatric ER prep package: the same export mechanism as kp-04,
  // just a tighter 24-hour window and pulling in feeding + diaper output
  // too, since that's what an ER/urgent-care intake actually asks a
  // parent for ("when did they last eat/drink/wet a diaper") on top of
  // the fever/medication picture kp-04 already covers.
  async function downloadErPrepPackage() {
    if (!patient?.id) return
    setExportingErPdf(true)
    const YELLOW = [232,164,0]
    const cutoff = Date.now() - 24*60*60*1000
    const recentSymptoms = symptomLogs.filter(s => new Date(s.recorded_at).getTime() > cutoff)
    const recentFeeds = feedingLogs.filter(f => new Date(f.fed_at).getTime() > cutoff)
    const recentDiapers = diaperLogs.filter(d => new Date(d.logged_at).getTime() > cutoff)
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const subtitle = `${patient.full_name||''} · ${patient.medsa_id||''} · ER / Urgent Care Prep - Last 24 Hours`
    drawPdfHeader(doc, pageWidth, subtitle)
    let y = 40

    y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Fever & medication (last 24h)', subtitle, accentColor: YELLOW,
      dateInstitution: `${patient.date_of_birth?`DOB ${new Date(patient.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} · `:''}Generated ${new Date().toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`,
      details: recentSymptoms.length>0
        ? [...recentSymptoms].reverse().map(s=>[
            new Date(s.recorded_at).toLocaleString('en-HK',{hour:'2-digit',minute:'2-digit'}),
            [[s.temperature_c!=null?`${s.temperature_c}°C`:null, s.symptoms].filter(Boolean).join(' · ') || '—', s.medication_given].filter(Boolean).join('\n'),
          ])
        : [['No entries in the last 24 hours', '—']],
    })

    y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Feeding (last 24h)', subtitle, accentColor: YELLOW,
      dateInstitution: `${recentFeeds.length} feeding${recentFeeds.length===1?'':'s'} logged`,
      details: recentFeeds.length>0
        ? [...recentFeeds].reverse().map(f=>{
            const t = FEEDING_TYPES.find(t=>t.value===f.feeding_type)
            return [new Date(f.fed_at).toLocaleString('en-HK',{hour:'2-digit',minute:'2-digit'}), `${t?t.label.en:f.feeding_type}${f.amount_ml!=null?` · ${f.amount_ml}ml`:''}`]
          })
        : [['No feedings logged', '—']],
    })

    y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Diaper output (last 24h)', subtitle, accentColor: YELLOW,
      dateInstitution: `${recentDiapers.length} change${recentDiapers.length===1?'':'s'} logged`,
      details: recentDiapers.length>0
        ? [...recentDiapers].reverse().map(d=>[new Date(d.logged_at).toLocaleString('en-HK',{hour:'2-digit',minute:'2-digit'}), d.diaper_type||'—'])
        : [['No diaper changes logged', '—']],
    })

    drawPdfFooter(doc, pageWidth, pageHeight)
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Medsa-Kids-ER-Prep-${patient.medsa_id||'export'}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExportingErPdf(false)
  }

  // kp-04 - fever/symptom log a parent keeps at home, with a one-click
  // "doctor packet" PDF export of the recent entries for a private
  // pediatric visit. "Recent" = last 14 days, same cutoff a doctor would
  // actually want context on for an acute visit.
  async function addSymptomLog() {
    if (!patient?.id || (!symptomForm.temperatureC && !symptomForm.symptoms)) return
    setSaving(true)
    await supabase.from('kids_symptom_logs').insert({
      patient_id: patient.id,
      temperature_c: symptomForm.temperatureC?Number(symptomForm.temperatureC):null,
      symptoms: symptomForm.symptoms||null,
      medication_given: symptomForm.medicationGiven||null,
    })
    setSymptomForm({ temperatureC:'', symptoms:'', medicationGiven:'' })
    await load(); setSaving(false)
  }
  async function deleteSymptomLog(id) { await supabase.from('kids_symptom_logs').delete().eq('id', id); load() }

  // kp-02 - AI OCR for a photographed medication label, so "medication
  // given" doesn't have to be typed by hand. Only ever fills the text
  // field for the parent to review/edit before saving - never written to
  // the database directly, same posture as parse_plan_document.js.
  async function scanMedicationLabel(file) {
    if (!file) return
    setScanningLabel(true); setLabelScanError(''); setLabelScanFilled(false)
    try {
      const imageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/kids/parse_medication_label', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType: file.type }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not read this label')
      setSymptomForm(f => ({ ...f, medicationGiven: json.medicationText || f.medicationGiven }))
      setLabelScanFilled(true)
    } catch (e) {
      setLabelScanError(e.message)
    } finally {
      setScanningLabel(false)
    }
  }
  async function downloadDoctorPacket() {
    if (!patient?.id) return
    setExportingSymptomPdf(true)
    const YELLOW = [232,164,0]
    const recent = symptomLogs.filter(s => new Date(s.recorded_at).getTime() > Date.now() - 14*24*60*60*1000)
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const subtitle = `${patient.full_name||''} · ${patient.medsa_id||''} · Doctor Packet - Symptom & Fever Log`
    drawPdfHeader(doc, pageWidth, subtitle)
    let y = 40
    y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Symptom & fever log (last 14 days)', subtitle, accentColor: YELLOW,
      dateInstitution: `${patient.date_of_birth?`DOB ${new Date(patient.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} · `:''}Generated ${new Date().toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}`,
      details: recent.length>0
        ? [...recent].reverse().map(s=>[
            new Date(s.recorded_at).toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),
            [[s.temperature_c!=null?`${s.temperature_c}°C`:null, s.symptoms].filter(Boolean).join(' · ') || '—', s.medication_given].filter(Boolean).join('\n'),
          ])
        : [['No entries in the last 14 days', '—']],
    })
    drawPdfFooter(doc, pageWidth, pageHeight)
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Medsa-Kids-Doctor-Packet-${patient.medsa_id||'export'}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExportingSymptomPdf(false)
  }

  // bb-02 - MCHC (Maternal and Child Health Centre) appointment reminders.
  // MCHC booking is a separate HK government system with no integration
  // here, so this is a parent-entered date + a visible reminder, same
  // "upcoming within N" banner shape as the clinic appointment reminder on
  // the Home screen's alert feed, just a longer window since MCHC visits
  // are scheduled weeks out, not booked same-week.
  async function addMchcAppointment() {
    if (!patient?.id || !mchcForm.appointmentAt) return
    setSaving(true)
    // mchcForm.appointmentAt is a <input type="datetime-local"> value
    // ("YYYY-MM-DDTHH:MM") with no timezone of its own - `new Date(...)` on
    // that string is interpreted in the DEVICE's local timezone, the exact
    // root cause the appointment-booking time bug traced back to (see
    // lib/hkTime.js). An MCHC visit is a Hong Kong wall-clock time
    // regardless of what timezone the phone entering it happens to be set
    // to, so this goes through hkWallTimeToUTC like every other
    // date+time picked in this app.
    const [datePart, timePart] = mchcForm.appointmentAt.split('T')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hour, minute] = (timePart||'00:00').split(':').map(Number)
    const appointmentAtUTC = hkWallTimeToUTC(year, month, day, hour, minute)
    await supabase.from('kids_mchc_appointments').insert({ patient_id: patient.id, appointment_at: appointmentAtUTC.toISOString(), note: mchcForm.note||null })
    setMchcForm({ appointmentAt:'', note:'' })
    await load(); setSaving(false)
  }
  async function deleteMchcAppointment(id) { await supabase.from('kids_mchc_appointments').delete().eq('id', id); load() }
  const nextMchcAppointment = mchcAppointments.find(a => new Date(a.appointment_at).getTime() > Date.now() - 24*60*60*1000)
  const mchcAppointmentSoon = nextMchcAppointment && (new Date(nextMchcAppointment.appointment_at).getTime() - Date.now() < 7*24*60*60*1000)

  async function toggleMilestone(key) {
    const existing = milestoneChecks.find(m=>m.milestone_key===key)
    if (existing) {
      await supabase.from('kids_milestone_checks').delete().eq('id', existing.id)
    } else {
      await supabase.from('kids_milestone_checks').insert({ patient_id: patient.id, milestone_key: key, achieved_at: new Date().toISOString().slice(0,10) })
    }
    await load()
  }

  const [exportingPdf,setExportingPdf]=useState(false)
  // bb-04 - one PDF combining the two things a kindergarten/nursery
  // enrollment form actually asks for: proof of immunization and a
  // developmental summary. Vaccinations already exist generically in
  // Records; this is the first place that reads them specifically for
  // this child rather than the parent's own history.
  async function downloadEnrollmentSummary() {
    if (!patient?.id) return
    setExportingPdf(true)
    const { data: vacc } = await supabase.from('vaccinations').select('*').eq('patient_id', patient.id).order('date_given',{ascending:true})
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const subtitle = `${patient.full_name||''} · ${patient.medsa_id||''} · Kindergarten/Nursery Enrollment Summary`
    drawPdfHeader(doc, pageWidth, subtitle)
    let y = 40

    y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Immunization record',
      dateInstitution: `${patient.date_of_birth?`DOB ${new Date(patient.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} · `:''}As of ${new Date().toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}`,
      details: (vacc||[]).length>0
        ? vacc.map(v=>[`${v.vaccine_name}${v.dose_label?` (${v.dose_label})`:v.dose_number?` (dose ${v.dose_number})`:''}`, v.date_given ? new Date(v.date_given).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}) + (v.institution?` · ${v.institution}`:'') : (v.status||'—')])
        : [['No vaccinations on file yet', '—']],
      subtitle,
    })

    for (const band of MILESTONE_AGE_BANDS) {
      const bandMilestones = MILESTONES.filter(m=>m.ageBand.en===band)
      const achievedCount = bandMilestones.filter(m=>milestoneChecks.some(c=>c.milestone_key===m.key)).length
      y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
        title: `Developmental milestones - ${band}`,
        dateInstitution: `${achievedCount}/${bandMilestones.length} achieved (HK DoH/MCHC standard)`,
        details: bandMilestones.map(m=>[m.domain.en, (milestoneChecks.some(c=>c.milestone_key===m.key)?'✓ ':'— ') + m.en]),
        subtitle,
      })
    }
    drawPdfFooter(doc, pageWidth, pageHeight)

    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Medsa-Kids-Enrollment-Summary-${patient.medsa_id||'export'}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExportingPdf(false)
  }

  async function addGrowthLog() {
    if (!patient?.id || !gForm.recordedAt) return
    setSaving(true)
    await supabase.from('kids_growth_logs').insert({
      patient_id: patient.id, recorded_at: gForm.recordedAt,
      weight_kg: gForm.weightKg?Number(gForm.weightKg):null,
      height_cm: gForm.heightCm?Number(gForm.heightCm):null,
      head_circumference_cm: gForm.headCm?Number(gForm.headCm):null,
    })
    setGForm({ recordedAt: new Date().toISOString().slice(0,10), weightKg:'', heightCm:'', headCm:'' })
    await load()
    setSaving(false)
  }
  async function deleteGrowthLog(id) { await supabase.from('kids_growth_logs').delete().eq('id', id); load() }

  async function addFeedingLog() {
    if (!patient?.id) return
    setSaving(true)
    await supabase.from('kids_feeding_logs').insert({
      patient_id: patient.id, feeding_type: fForm.type,
      amount_ml: fForm.amountMl?Number(fForm.amountMl):null,
      duration_min: fForm.durationMin?Number(fForm.durationMin):null,
      note: fForm.note||null,
    })
    setFForm({ type:'breast', amountMl:'', durationMin:'', note:'' })
    await load()
    setSaving(false)
  }
  async function deleteFeedingLog(id) { await supabase.from('kids_feeding_logs').delete().eq('id', id); load() }

  const [settingSex,setSettingSex]=useState(false)
  async function setSex(sex) {
    setSettingSex(true)
    await supabase.from('patients').update({ sex }).eq('id', patient.id)
    setSettingSex(false)
    onPatientUpdated && onPatientUpdated()
  }

  const todayStr = new Date().toISOString().slice(0,10)
  const todaysFeedings = feedingLogs.filter(f=>f.fed_at?.slice(0,10)===todayStr)
  const todaysMl = todaysFeedings.filter(f=>f.amount_ml!=null).reduce((s,f)=>s+Number(f.amount_ml),0)
  // Daily digest - pulls together feeding/diaper/sleep/symptoms into one
  // glance, since those are currently four separate cards with no at-a-
  // glance view, unlike the dashboard every benchmarked baby tracker has.
  const todaysDiapers = diaperLogs.filter(d=>d.logged_at?.slice(0,10)===todayStr)
  const todaysSleep = sleepLogs.filter(s=>s.started_at?.slice(0,10)===todayStr || s.ended_at?.slice(0,10)===todayStr)
  const todaysSleepMinutes = todaysSleep.reduce((sum,s)=>sum+Math.round((new Date(s.ended_at)-new Date(s.started_at))/60000), 0)
  const todaysSymptomCount = symptomLogs.filter(s=>s.recorded_at?.slice(0,10)===todayStr).length

  if (loading) return <div style={{padding:'40px',textAlign:'center',fontSize:'12px',color:C.textMuted}}>{isEn?'Loading…':'載入中…'}</div>

  return (
    <div style={{padding:'0 16px 24px'}}>
      <div style={{margin:'16px 0',padding:'14px 16px',background:__theme.accentXLight,border:`0.5px solid ${__theme.accentLight}`,borderRadius:'12px'}}>
        <div style={{fontSize:'13px',fontWeight:700,color:__theme.accent,marginBottom:'4px'}}>{isEn?'Growth, feeding & health record':'生長、餵養及健康記錄'}</div>
        <div style={{fontSize:'11.5px',color:C.textSub,lineHeight:1.6}}>{isEn?"Medsa's digital equivalent of the MCHC Blue Book's growth and feeding pages. Vaccinations are tracked separately in":'Medsa的數碼版母嬰健康院「健康記錄手冊」生長及餵養頁面。疫苗記錄請見'} <span onClick={()=>onNav&&onNav('records')} style={{color:__theme.accent,textDecoration:'underline',cursor:'pointer'}}>{isEn?'Medical records':'醫療記錄'}</span>{isEn?'.':'。'}</div>
      </div>

      <SecLabel>{isEn?"Today at a glance":'今日概覽'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
          <div style={{background:__theme.accentXLight,borderRadius:'10px',padding:'10px 12px'}}>
            <div style={{fontSize:'17px',fontWeight:700,color:__theme.accent}}>{todaysFeedings.length}</div>
            <div style={{fontSize:'10.5px',color:C.textSub}}>{isEn?`feeding${todaysFeedings.length===1?'':'s'}${todaysMl?` · ${todaysMl}ml`:''}`:`次餵養${todaysMl?` · ${todaysMl}ml`:''}`}</div>
          </div>
          <div style={{background:__theme.accentXLight,borderRadius:'10px',padding:'10px 12px'}}>
            <div style={{fontSize:'17px',fontWeight:700,color:__theme.accent}}>{todaysDiapers.length}</div>
            <div style={{fontSize:'10.5px',color:C.textSub}}>{isEn?'diaper changes':'次換尿布'}</div>
          </div>
          <div style={{background:__theme.accentXLight,borderRadius:'10px',padding:'10px 12px'}}>
            <div style={{fontSize:'17px',fontWeight:700,color:__theme.accent}}>{todaysSleepMinutes>0?`${Math.floor(todaysSleepMinutes/60)}h${todaysSleepMinutes%60?` ${todaysSleepMinutes%60}m`:''}`:'—'}</div>
            <div style={{fontSize:'10.5px',color:C.textSub}}>{isEn?`sleep, ${todaysSleep.length} session${todaysSleep.length===1?'':'s'}`:`睡眠, ${todaysSleep.length}次`}</div>
          </div>
          <div style={{background:todaysSymptomCount>0?C.amberLight:__theme.accentXLight,borderRadius:'10px',padding:'10px 12px'}}>
            <div style={{fontSize:'17px',fontWeight:700,color:todaysSymptomCount>0?C.amber:__theme.accent}}>{todaysSymptomCount}</div>
            <div style={{fontSize:'10.5px',color:C.textSub}}>{isEn?`symptom entr${todaysSymptomCount===1?'y':'ies'}`:'次症狀記錄'}</div>
          </div>
        </div>
      </Card>

      {!patient.sex&&<div style={{margin:'0 0 16px',padding:'12px 14px',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px'}}>
        <div style={{fontSize:'12px',color:C.amber,fontWeight:600,marginBottom:'8px'}}>{isEn?"Set this profile's sex to see the WHO growth percentile chart - the reference curves differ by sex.":'請設定此檔案的性別以查看WHO生長百分比圖 - 參考曲線因性別而異。'}</div>
        <div style={{display:'flex',gap:'8px'}}>
          <Btn style={{flex:1}} disabled={settingSex} onClick={()=>setSex('male')}>{isEn?'Male':'男'}</Btn>
          <Btn style={{flex:1}} disabled={settingSex} onClick={()=>setSex('female')}>{isEn?'Female':'女'}</Btn>
        </div>
      </div>}

      {mchcAppointmentSoon&&<div style={{margin:'0 0 16px',padding:'12px 14px',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px'}}>
        <div style={{fontSize:'12px',color:C.amber,fontWeight:700}}>{isEn?`Reminder: MCHC appointment ${new Date(nextMchcAppointment.appointment_at).toLocaleString('en-HK',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})}`:`提醒：母嬰健康院預約 ${new Date(nextMchcAppointment.appointment_at).toLocaleString('zh-HK',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})}`}</div>
        {nextMchcAppointment.note&&<div style={{fontSize:'11.5px',color:C.textSub,marginTop:'3px'}}>{nextMchcAppointment.note}</div>}
      </div>}

      {dueImmunizationBand&&<div style={{margin:'0 0 16px',padding:'12px 14px',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px'}}>
        <div style={{fontSize:'12px',color:C.amber,fontWeight:700}}>{isEn?`Immunisation due: ${dueImmunizationBand.ageLabel.en}`:`疫苗接種提醒：${dueImmunizationBand.ageLabel.zh}`}</div>
        <div style={{fontSize:'11.5px',color:C.textSub,marginTop:'3px'}}>{isEn?'See the HKCIP schedule below.':'請參閱下方HKCIP疫苗接種時間表。'}</div>
      </div>}

      <SecLabel>{isEn?'MCHC appointments':'母嬰健康院預約'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{isEn?"Medsa doesn't book MCHC visits - enter a date here after booking with the centre and we'll remind you as it approaches.":'Medsa並不代為預約母嬰健康院 - 預約後在此輸入日期,我們會在預約臨近時提醒您。'}</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px',flexWrap:'wrap'}}>
          <input type="datetime-local" value={mchcForm.appointmentAt} onChange={e=>setMchcForm({...mchcForm,appointmentAt:e.target.value})} style={{flex:'1 1 170px',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
          <input value={mchcForm.note} onChange={e=>setMchcForm({...mchcForm,note:e.target.value})} placeholder={isEn?'Note (optional)':'備註(可選)'} style={{flex:'1 1 120px',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
        </div>
        <Btn variant="primary" style={{width:'100%'}} disabled={saving||!mchcForm.appointmentAt} onClick={addMchcAppointment}>{isEn?'Add appointment':'新增預約'}</Btn>
        <div style={{marginTop:'12px'}}>
          {mchcAppointments.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'8px 0'}}>{isEn?'No MCHC appointments on file.':'暫無母嬰健康院預約記錄。'}</div>}
          {mchcAppointments.map(a=>{
            const past = new Date(a.appointment_at).getTime() < Date.now()
            return (
              <div key={a.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px',opacity:past?0.55:1}}>
                <span style={{color:C.textMuted,width:130,flexShrink:0}}>{new Date(a.appointment_at).toLocaleString('en-HK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})}</span>
                <span style={{flex:1}}>{a.note||(isEn?'MCHC visit':'母嬰健康院就診')}</span>
                <span onClick={()=>deleteMchcAppointment(a.id)} style={{color:C.textMuted,cursor:'pointer',fontSize:'13px'}}>✕</span>
              </div>
            )
          })}
        </div>
      </Card>

      <SecLabel>{isEn?'Symptom & fever log':'症狀及發燒記錄'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{isEn?"Keep a quick log while your child is unwell, then export it as a doctor packet for the visit.":'孩子不適時快速記錄,就診前匯出為醫生摘要。'}</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px',flexWrap:'wrap'}}>
          <input type="number" step="0.1" value={symptomForm.temperatureC} onChange={e=>setSymptomForm({...symptomForm,temperatureC:e.target.value})} placeholder={isEn?'Temp (°C, optional)':'體溫(°C,可選)'} style={{flex:'1 1 110px',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
          <input value={symptomForm.medicationGiven} onChange={e=>{setSymptomForm({...symptomForm,medicationGiven:e.target.value}); setLabelScanFilled(false)}} placeholder={isEn?'Medication given (optional)':'已給藥物(可選)'} style={{flex:'1 1 140px',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
          <label style={{display:'flex',alignItems:'center',justifyContent:'center',width:40,height:36,flexShrink:0,background:scanningLabel?C.border:__theme.accent,borderRadius:'8px',cursor:scanningLabel?'wait':'pointer',fontSize:'16px'}} title={isEn?'Scan medication label':'掃描藥物標籤'}>
            <input type="file" accept="image/*" capture="environment" style={{display:'none'}} disabled={scanningLabel} onChange={e=>{const f=e.target.files?.[0]; e.target.value=''; if(f) scanMedicationLabel(f)}}/>
            📷
          </label>
        </div>
        <div style={{fontSize:'10.5px',color:C.textMuted,marginBottom:'10px'}}>{isEn?'Tap 📷 above to photograph a label instead of typing it.':'點擊上方📷拍攝標籤代替手動輸入。'}</div>
        {scanningLabel&&<div style={{fontSize:'11px',color:__theme.accent,marginBottom:'8px'}}>{isEn?'Reading label…':'讀取標籤中…'}</div>}
        {labelScanFilled&&<div style={{fontSize:'11px',color:C.textMuted,marginBottom:'8px'}}>{isEn?'Filled in from the label photo - review before saving.':'已從標籤相片填入 - 請核對後儲存。'}</div>}
        {labelScanError&&<div style={{fontSize:'11px',color:C.red,marginBottom:'8px'}}>{labelScanError}</div>}
        <textarea value={symptomForm.symptoms} onChange={e=>setSymptomForm({...symptomForm,symptoms:e.target.value})} rows={2} placeholder={isEn?'Symptoms (e.g. cough, runny nose, poor appetite)':'症狀(如咳嗽、流鼻水、食慾不振)'} style={{width:'100%',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px',marginBottom:'10px',resize:'none',fontFamily:'inherit'}}/>
        <Btn variant="primary" style={{width:'100%'}} disabled={saving||(!symptomForm.temperatureC&&!symptomForm.symptoms)} onClick={addSymptomLog}>{isEn?'Add entry':'新增記錄'}</Btn>
        <div onClick={exportingSymptomPdf?undefined:downloadDoctorPacket} style={{fontSize:'12px',fontWeight:600,color:__theme.accent,marginTop:'12px',cursor:exportingSymptomPdf?'wait':'pointer',textDecoration:'underline'}}>{exportingSymptomPdf?(isEn?'Generating…':'生成中…'):(isEn?'⬇ Export doctor packet PDF (last 14 days)':'⬇ 匯出醫生摘要PDF(過去14天)')}</div>
        <div onClick={exportingErPdf?undefined:downloadErPrepPackage} style={{fontSize:'12px',fontWeight:600,color:__theme.accent,marginTop:'6px',cursor:exportingErPdf?'wait':'pointer',textDecoration:'underline'}}>{exportingErPdf?(isEn?'Generating…':'生成中…'):(isEn?'⬇ Export ER / urgent care prep PDF (last 24 hours)':'⬇ 匯出急症室準備PDF(過去24小時)')}</div>
        <div style={{marginTop:'12px'}}>
          {symptomLogs.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'8px 0'}}>{isEn?'No symptom entries on file.':'暫無症狀記錄。'}</div>}
          {symptomLogs.map(s=>(
            <div key={s.id} style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'7px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}>
              <span style={{color:C.textMuted,width:100,flexShrink:0}}>{new Date(s.recorded_at).toLocaleString('en-HK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})}</span>
              <span style={{flex:1}}>
                <div>{[s.temperature_c!=null?`${s.temperature_c}°C`:null, s.symptoms].filter(Boolean).join(' · ')||'—'}</div>
                {s.medication_given&&<div style={{color:C.textSub,marginTop:'1px'}}>{s.medication_given}</div>}
              </span>
              <span onClick={()=>deleteSymptomLog(s.id)} style={{color:C.textMuted,cursor:'pointer',fontSize:'13px'}}>✕</span>
            </div>
          ))}
        </div>
      </Card>

      <SecLabel>{isEn?'Diaper log':'尿布記錄'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{isEn?"Why this matters: a sudden drop in wet diapers (possible dehydration) or diarrhea is one of the first things an ER doctor or nurse asks about - tap here as it happens so you have an exact answer, not a guess, under stress.":'為何重要：排尿突然減少(可能脫水)或腹瀉,是急症室醫護最先詢問的事項之一 - 事發時輕觸記錄,緊急時刻就有確實答案,而非憑印象猜測。'}</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
          <div onClick={()=>addDiaperLog('wet')} style={{flex:1,textAlign:'center',padding:'10px',borderRadius:'8px',fontSize:'12px',fontWeight:600,cursor:'pointer',background:C.cream,border:`0.5px solid ${C.border}`}}>{isEn?'💧 Wet':'💧 濕'}</div>
          <div onClick={()=>addDiaperLog('dirty')} style={{flex:1,textAlign:'center',padding:'10px',borderRadius:'8px',fontSize:'12px',fontWeight:600,cursor:'pointer',background:C.cream,border:`0.5px solid ${C.border}`}}>{isEn?'💩 Dirty':'💩 大便'}</div>
          <div onClick={()=>addDiaperLog('both')} style={{flex:1,textAlign:'center',padding:'10px',borderRadius:'8px',fontSize:'12px',fontWeight:600,cursor:'pointer',background:C.cream,border:`0.5px solid ${C.border}`}}>{isEn?'Both':'兩者'}</div>
        </div>
        <div>
          {diaperLogs.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'8px 0'}}>{isEn?'No diaper changes logged yet.':'暫無尿布記錄。'}</div>}
          {diaperLogs.slice(0,10).map(d=>(
            <div key={d.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}>
              <span style={{color:C.textMuted,width:100,flexShrink:0}}>{new Date(d.logged_at).toLocaleString('en-HK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})}</span>
              <span style={{flex:1,textTransform:'capitalize'}}>{d.diaper_type}</span>
              <span onClick={()=>deleteDiaperLog(d.id)} style={{color:C.textMuted,cursor:'pointer',fontSize:'13px'}}>✕</span>
            </div>
          ))}
        </div>
      </Card>

      <SecLabel>{isEn?'Sleep log':'睡眠記錄'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        {!sleepSession&&<>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{isEn?'Start when baby falls asleep, stop when they wake - the duration is calculated for you.':'寶寶入睡時按開始,醒來時按停止 - 系統會自動計算睡眠時長。'}</div>
          <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
            {[{value:'nap',en:'Nap',zh:'小睡'},{value:'night',en:'Night sleep',zh:'夜間睡眠'}].map(t=>(
              <div key={t.value} onClick={()=>setSleepForm({...sleepForm,sleepType:t.value})} style={{flex:1,textAlign:'center',padding:'9px',borderRadius:'8px',fontSize:'12px',fontWeight:500,cursor:'pointer',background:sleepForm.sleepType===t.value?__theme.accent:C.card,color:sleepForm.sleepType===t.value?'#fff':C.text}}>{isEn?t.en:t.zh}</div>
            ))}
          </div>
          <Btn variant="primary" style={{width:'100%'}} onClick={startSleepSession}>{isEn?'Start sleep':'開始睡眠'}</Btn>
        </>}
        {sleepSession&&<div style={{textAlign:'center',padding:'16px 0'}}>
          <div style={{fontSize:'30px',fontWeight:700,color:__theme.accent}}>{Math.round((Date.now()-sleepSession.startedAt)/60000)}<span style={{fontSize:'14px',fontWeight:500}}>{isEn?' min':'分鐘'}</span></div>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'14px'}}>{isEn?`${sleepSession.sleepType==='nap'?'Nap':'Night sleep'} started ${sleepSession.startedAt.toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}`:`${sleepSession.sleepType==='nap'?'小睡':'夜間睡眠'}開始於${sleepSession.startedAt.toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}`}</div>
          <Btn variant="primary" style={{width:'100%'}} disabled={saving} onClick={finishSleepSession}>{isEn?'Wake up / stop':'醒來 / 停止'}</Btn>
        </div>}
        <div style={{marginTop:'12px'}}>
          {sleepLogs.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'8px 0'}}>{isEn?'No sleep logged yet.':'暫無睡眠記錄。'}</div>}
          {sleepLogs.map(s=>{
            const minutes = Math.round((new Date(s.ended_at)-new Date(s.started_at))/60000)
            return (
              <div key={s.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}>
                <span style={{color:C.textMuted,width:100,flexShrink:0}}>{new Date(s.started_at).toLocaleString('en-HK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})}</span>
                <span style={{flex:1}}>{s.sleep_type==='night'?(isEn?'Night sleep':'夜間睡眠'):(isEn?'Nap':'小睡')} · {minutes>=60?`${Math.floor(minutes/60)}h${minutes%60?` ${minutes%60}m`:''}`:`${minutes}m`}</span>
                <span onClick={()=>deleteSleepLog(s.id)} style={{color:C.textMuted,cursor:'pointer',fontSize:'13px'}}>✕</span>
              </div>
            )
          })}
        </div>
      </Card>

      <SecLabel>{isEn?'Growth':'生長'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px',flexWrap:'wrap'}}>
          <input type="date" value={gForm.recordedAt} max={todayStr} onChange={e=>setGForm({...gForm,recordedAt:e.target.value})} style={{flex:'1 1 120px',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
          <input type="number" value={gForm.weightKg} onChange={e=>setGForm({...gForm,weightKg:e.target.value})} placeholder={isEn?'Weight (kg)':'體重(kg)'} style={{flex:'1 1 90px',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
          <input type="number" value={gForm.heightCm} onChange={e=>setGForm({...gForm,heightCm:e.target.value})} placeholder={isEn?'Height (cm)':'身高(cm)'} style={{flex:'1 1 90px',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
          <input type="number" value={gForm.headCm} onChange={e=>setGForm({...gForm,headCm:e.target.value})} placeholder={isEn?'Head circ. (cm, optional)':'頭圍(cm,可選)'} style={{flex:'1 1 120px',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
        </div>
        <Btn variant="primary" style={{width:'100%'}} disabled={saving||(!gForm.weightKg&&!gForm.heightCm&&!gForm.headCm)} onClick={addGrowthLog}>{isEn?'Add entry':'新增記錄'}</Btn>

        {growthLogs.length>0&&<>
          <div style={{fontSize:'11px',color:C.textMuted,marginTop:'16px',marginBottom:'2px'}}>{isEn?'Weight-for-age (WHO percentiles)':'年齡體重(WHO百分比)'}</div>
          <WhoGrowthChart logs={growthLogs} valueKey="weight_kg" indicator="wfa" sex={patient.sex} dobISO={patient.date_of_birth} unit="kg" accentColor={__theme.accent} isEn={isEn}/>
          <div style={{fontSize:'11px',color:C.textMuted,marginTop:'10px',marginBottom:'2px'}}>{isEn?'Length/height-for-age (WHO percentiles)':'年齡身高(WHO百分比)'}</div>
          <WhoGrowthChart logs={growthLogs} valueKey="height_cm" indicator="lhfa" sex={patient.sex} dobISO={patient.date_of_birth} unit="cm" accentColor={C.blue} isEn={isEn}/>
          <div style={{fontSize:'10px',color:C.textMuted,marginTop:'6px',lineHeight:1.5}}>{isEn?'Reference curves assume a full-term birth - no preterm correction applied.':'參考曲線假設足月出生,未作早產矯正。'}</div>
          <div style={{marginTop:'14px'}}>
            {[...growthLogs].reverse().map(g=>{
              const ageDays = patient.date_of_birth ? ageDaysBetween(patient.date_of_birth, g.recorded_at) : null
              const wResult = (patient.sex && ageDays!=null && g.weight_kg!=null) ? growthPercentile('wfa', g.weight_kg, patient.sex, ageDays) : null
              const hResult = (patient.sex && ageDays!=null && g.height_cm!=null) ? growthPercentile('lhfa', g.height_cm, patient.sex, ageDays) : null
              return (
                <div key={g.id} style={{padding:'7px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    <span style={{color:C.textMuted,width:80,flexShrink:0}}>{g.recorded_at}</span>
                    <span style={{flex:1}}>{g.weight_kg!=null?`${g.weight_kg}kg`:''}{g.height_cm!=null?`  ·  ${g.height_cm}cm`:''}{g.head_circumference_cm!=null?`  ·  ${isEn?'head':'頭圍'} ${g.head_circumference_cm}cm`:''}</span>
                    <span onClick={()=>deleteGrowthLog(g.id)} style={{color:C.textMuted,cursor:'pointer',fontSize:'13px'}}>✕</span>
                  </div>
                  {(wResult||hResult)&&<div style={{marginLeft:90,fontSize:'10.5px',color:__theme.accent,marginTop:'2px'}}>
                    {wResult&&(isEn?`Weight: ${Math.round(wResult.percentile)}th percentile`:`體重:第${Math.round(wResult.percentile)}百分位`)}
                    {wResult&&hResult?'  ·  ':''}
                    {hResult&&(isEn?`Height: ${Math.round(hResult.percentile)}th percentile`:`身高:第${Math.round(hResult.percentile)}百分位`)}
                  </div>}
                </div>
              )
            })}
          </div>
        </>}
      </Card>

      <SecLabel>{isEn?'Feeding (milk) log':'餵養(奶量)記錄'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          {FEEDING_TYPES.map(t=>(
            <div key={t.value} onClick={()=>setFForm({...fForm,type:t.value})} style={{flex:1,textAlign:'center',padding:'9px',borderRadius:'8px',fontSize:'12px',fontWeight:500,cursor:'pointer',background:fForm.type===t.value?__theme.accent:C.card,color:fForm.type===t.value?'#fff':C.text}}>{isEn?t.label.en:t.label.zh}</div>
          ))}
        </div>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          {fForm.type!=='solid'&&<input type="number" value={fForm.amountMl} onChange={e=>setFForm({...fForm,amountMl:e.target.value})} placeholder={isEn?'Amount (ml, optional)':'份量(ml,可選)'} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>}
          {fForm.type==='breast'&&<input type="number" value={fForm.durationMin} onChange={e=>setFForm({...fForm,durationMin:e.target.value})} placeholder={isEn?'Minutes (optional)':'分鐘(可選)'} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>}
        </div>
        <input value={fForm.note} onChange={e=>setFForm({...fForm,note:e.target.value})} placeholder={isEn?'Note (optional)':'備註(可選)'} style={{width:'100%',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px',marginBottom:'10px'}}/>
        <Btn variant="primary" style={{width:'100%'}} disabled={saving} onClick={addFeedingLog}>{isEn?'Log feeding':'記錄餵養'}</Btn>

        <div style={{fontSize:'12px',fontWeight:600,color:__theme.accent,marginTop:'16px',marginBottom:'6px'}}>{isEn?`Today - ${todaysFeedings.length} feeding${todaysFeedings.length===1?'':'s'}${todaysMl?`, ${todaysMl}ml`:''}`:`今天 - ${todaysFeedings.length}次餵養${todaysMl?`, ${todaysMl}ml`:''}`}</div>
        {feedingLogs.map(f=>{
          const t = FEEDING_TYPES.find(t=>t.value===f.feeding_type)
          return (
            <div key={f.id} style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'7px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}>
              <span style={{color:C.textMuted,width:100,flexShrink:0}}>{new Date(f.fed_at).toLocaleString('en-HK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})}</span>
              <span style={{flex:1}}>
                <div>{t?(isEn?t.label.en:t.label.zh):f.feeding_type}{f.amount_ml!=null?` · ${f.amount_ml}ml`:''}{f.duration_min!=null?` · ${f.duration_min}min`:''}</div>
                {f.note&&<div style={{color:C.textSub,marginTop:'1px'}}>{f.note}</div>}
              </span>
              <span onClick={()=>deleteFeedingLog(f.id)} style={{color:C.textMuted,cursor:'pointer',fontSize:'13px'}}>✕</span>
            </div>
          )
        })}
      </Card>

      <SecLabel>{isEn?'HKCIP immunisation schedule':'HKCIP疫苗接種時間表'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{isEn?'Hong Kong Childhood Immunisation Programme, as recommended by the Scientific Committee on Vaccine Preventable Diseases, Centre for Health Protection, Department of Health (as of 9 Oct 2024). Check off each dose once given.':'香港兒童免疫接種計劃,由衞生防護中心疫苗可預防疾病科學委員會建議(截至2024年10月9日)。每劑接種後請勾選。'}</div>
        <div style={{fontSize:'11px',color:C.amber,fontWeight:600,marginBottom:'12px',lineHeight:1.5,padding:'8px 10px',background:C.amberLight,borderRadius:'8px'}}>{isEn?"This checklist is for your own tracking and prepping only - it is not the official record. Ask your doctor or clinic to upload the official immunisation record to Medical records.":'此清單僅供您個人追蹤及準備之用,並非官方記錄。請要求醫生或診所將官方疫苗接種記錄上載至醫療記錄。'}</div>
        {HKCIP_SCHEDULE.map(band=>{
          const checkedCount = band.doses.filter(d=>immunizationChecks.some(c=>c.dose_key===d.key)).length
          return (
            <div key={band.ageLabel.en} style={{marginBottom:'14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                <div style={{fontSize:'12px',fontWeight:700,color:__theme.accent}}>{isEn?band.ageLabel.en:band.ageLabel.zh}</div>
                <div style={{fontSize:'10.5px',color:C.textMuted}}>{checkedCount}/{band.doses.length}</div>
              </div>
              {band.doses.map(d=>{
                const checked = immunizationChecks.some(c=>c.dose_key===d.key)
                return (
                  <div key={d.key} onClick={()=>toggleImmunizationDose(d.key)} style={{display:'flex',gap:'10px',alignItems:'flex-start',padding:'6px 0',cursor:'pointer'}}>
                    <div style={{width:18,height:18,borderRadius:'4px',border:`1.5px solid ${checked?__theme.accent:C.border}`,background:checked?__theme.accent:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'#fff',flexShrink:0,marginTop:'1px'}}>{checked?'✓':''}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'12.5px',color:C.text,lineHeight:1.4,textDecoration:checked?'line-through':'none',textDecorationColor:C.textMuted}}>{isEn?d.vaccine.en:d.vaccine.zh}{(isEn?d.dose.en:d.dose.zh)?` - ${isEn?d.dose.en:d.dose.zh}`:''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </Card>

      <SecLabel>{isEn?'Developmental milestones':'發展里程碑'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{isEn?"Hong Kong DoH / MCHC standard milestones, Birth to Primary 1. Every child is different - this isn't a race, just a record.":'香港衛生署/母嬰健康院標準發展里程碑,出生至小學一年級。每個孩子發展步伐不同,這並非競賽,只是記錄。'}</div>
        <div onClick={exportingPdf?undefined:downloadEnrollmentSummary} style={{fontSize:'12px',fontWeight:600,color:__theme.accent,marginBottom:'14px',cursor:exportingPdf?'wait':'pointer',textDecoration:'underline'}}>{exportingPdf?(isEn?'Generating…':'生成中…'):(isEn?'⬇ Export enrollment summary (immunizations + milestones) PDF':'⬇ 匯出入學摘要(疫苗+里程碑)PDF')}</div>
        {MILESTONE_AGE_BANDS.map(band=>{
          const bandMilestones = MILESTONES.filter(m=>m.ageBand.en===band)
          const bandLabel = bandMilestones[0].ageBand
          const checkedCount = bandMilestones.filter(m=>milestoneChecks.some(c=>c.milestone_key===m.key)).length
          return (
            <div key={band} style={{marginBottom:'14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                <div style={{fontSize:'12px',fontWeight:700,color:__theme.accent}}>{isEn?bandLabel.en:bandLabel.zh}</div>
                <div style={{fontSize:'10.5px',color:C.textMuted}}>{checkedCount}/{bandMilestones.length}</div>
              </div>
              {bandMilestones.map(m=>{
                const checked = milestoneChecks.some(c=>c.milestone_key===m.key)
                return (
                  <div key={m.key} onClick={()=>toggleMilestone(m.key)} style={{display:'flex',gap:'10px',alignItems:'flex-start',padding:'6px 0',cursor:'pointer'}}>
                    <div style={{width:18,height:18,borderRadius:'4px',border:`1.5px solid ${checked?__theme.accent:C.border}`,background:checked?__theme.accent:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'#fff',flexShrink:0,marginTop:'1px'}}>{checked?'✓':''}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'9.5px',fontWeight:600,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.3px'}}>{isEn?m.domain.en:m.domain.zh}</div>
                      <div style={{fontSize:'12.5px',color:C.text,lineHeight:1.4,textDecoration:checked?'line-through':'none',textDecorationColor:C.textMuted}}>{isEn?m.en:m.zh}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </Card>
    </div>
  )
}

const GLUCOSE_CONTEXTS = [
  { value:'fasting', en:'Fasting', zh:'空腹' },
  { value:'1hr_postprandial', en:'1hr after eating', zh:'餐後1小時' },
  { value:'2hr_postprandial', en:'2hr after eating', zh:'餐後2小時' },
]
// IADPSG (International Association of Diabetes and Pregnancy Study
// Groups, 2010) consensus cutoffs for a 75g oral glucose tolerance test -
// the one internationally standardized gestational-diabetes threshold
// set, by far the most widely adopted (HK public/private OBGYN practice
// commonly follows it too). Explicitly scoped to the 75g OGTT: an older
// 100g 3-hour test (Carpenter-Coustan) uses different numbers entirely,
// which is exactly why this was left unflagged until asked for - picking
// the wrong protocol's cutoff would be worse than no flag at all.
const GLUCOSE_IADPSG_MGDL = { fasting: 92, '1hr_postprandial': 180, '2hr_postprandial': 153 }
function isGlucoseFlagged(contextValue, mgdl) {
  const threshold = GLUCOSE_IADPSG_MGDL[contextValue]
  return threshold != null && mgdl != null && mgdl >= threshold
}
// "Fourth trimester" postpartum recovery topics - standard patient-
// education checklist items (what a 6-week postpartum visit typically
// covers), not a diagnosis or dosing instruction, so safe to author
// directly. The last item is a plain prompt, not the real EPDS
// screening instrument - see the note on bc-05 in the QA checklist for
// why that stays blocked until a verified source is on hand.
const POSTPARTUM_RECOVERY_ITEMS = [
  { key:'incision_healing', en:"Incision/perineal healing checked by a provider", zh:'傷口/會陰癒合情況已由醫護檢查' },
  { key:'bleeding_normal', en:'Postpartum bleeding (lochia) back to normal, nothing concerning', zh:'產後出血(惡露)已回復正常,無異常情況' },
  { key:'pelvic_floor', en:'Pelvic floor exercises started', zh:'已開始盤底肌肉訓練' },
  { key:'six_week_checkup', en:'6-week postpartum check-up completed', zh:'已完成產後6週檢查' },
  { key:'contraception', en:'Contraception plan discussed', zh:'已討論避孕計劃' },
  { key:'feeding_support', en:'Breastfeeding/feeding support arranged, if needed', zh:'如有需要,已安排餵哺支援' },
  { key:'rest_support', en:'Sleep & rest support from family/helper discussed', zh:'已與家人/傭工討論睡眠及休息支援' },
  { key:'mood_checkin', en:"Checked in on how you're feeling emotionally - if low mood, anxiety, or anything feels off lasts more than 2 weeks, contact your doctor", zh:'已檢視自己的情緒狀態 - 若情緒低落、焦慮或任何不適持續超過2週,請聯絡醫生' },
]
// bc-05 - the real Edinburgh Postnatal Depression Scale (EPDS), transcribed
// verbatim from the text the user supplied (a Perinatal Services BC
// distribution copy; original: Cox JL, Holden JM, Sagovsky R. "Detection of
// postnatal depression: development of the 10-item Edinburgh Postnatal
// Depression Scale." Br J Psychiatry. 1987;150:782-786. (c) The Royal College
// of Psychiatrists, reprinted with permission). Each option's point value is
// exactly as printed next to it - no re-deriving ascending/descending order,
// since getting that backwards on a self-harm item would be a real-harm bug,
// not a cosmetic one. For use 28-32 weeks antenatal and 6-8 weeks postpartum,
// per the instrument's own header - not gated to postpartum like the
// recovery checklist above. English only for now: a Chinese translation
// exists (the source page points to perinatalservicesbc.ca for one) but
// isn't in hand here, and this is exactly the kind of wording where an
// unverified machine translation of a validated instrument could shift
// what's actually being asked - not guessing it.
const EPDS_ITEMS = [
  { key:1, en:'I have been able to laugh and see the funny side of things', options:[
    {points:0, en:'As much as I always could'}, {points:1, en:'Not quite so much now'}, {points:2, en:'Definitely not so much now'}, {points:3, en:'Not at all'},
  ]},
  { key:2, en:'I have looked forward with enjoyment to things', options:[
    {points:0, en:'As much as I ever did'}, {points:1, en:'Rather less than I used to'}, {points:2, en:'Definitely less than I used to'}, {points:3, en:'Hardly at all'},
  ]},
  { key:3, en:'I have blamed myself unnecessarily when things went wrong', options:[
    {points:3, en:'Yes, most of the time'}, {points:2, en:'Yes, some of the time'}, {points:1, en:'Not very often'}, {points:0, en:'No, never'},
  ]},
  { key:4, en:'I have been anxious or worried for no good reason', options:[
    {points:0, en:'No, not at all'}, {points:1, en:'Hardly ever'}, {points:2, en:'Yes, sometimes'}, {points:3, en:'Yes, very often'},
  ]},
  { key:5, en:'I have felt scared or panicky for no very good reason', options:[
    {points:3, en:'Yes, quite a lot'}, {points:2, en:'Yes, sometimes'}, {points:1, en:'No, not much'}, {points:0, en:'No, not at all'},
  ]},
  { key:6, en:'Things have been getting on top of me', options:[
    {points:3, en:"Yes, most of the time I haven't been able to cope"}, {points:2, en:"Yes, sometimes I haven't been coping as well as usual"}, {points:1, en:'No, most of the time I have coped quite well'}, {points:0, en:'No, I have been coping as well as ever'},
  ]},
  { key:7, en:'I have been so unhappy that I have had difficulty sleeping', options:[
    {points:3, en:'Yes, most of the time'}, {points:2, en:'Yes, sometimes'}, {points:1, en:'Not very often'}, {points:0, en:'No, not at all'},
  ]},
  { key:8, en:'I have felt sad or miserable', options:[
    {points:3, en:'Yes, most of the time'}, {points:2, en:'Yes, quite often'}, {points:1, en:'Not very often'}, {points:0, en:'No, not at all'},
  ]},
  { key:9, en:'I have been so unhappy that I have been crying', options:[
    {points:3, en:'Yes, most of the time'}, {points:2, en:'Yes, quite often'}, {points:1, en:'Only occasionally'}, {points:0, en:'No, never'},
  ]},
  { key:10, en:'The thought of harming myself has occurred to me', options:[
    {points:3, en:'Yes, quite often'}, {points:2, en:'Sometimes'}, {points:1, en:'Hardly ever'}, {points:0, en:'Never'},
  ]},
]
// High-risk maternal monitoring (bm-03) - gestational diabetes glucose
// log with meal-tagging, pre-eclampsia BP tracking (flagged at the
// 140/90 mmHg threshold given directly in the feature doc), and
// kick-count sessions. Glucose is flagged against the IADPSG 75g-OGTT
// consensus cutoffs above - added on your explicit go-ahead, since the
// right cutoff depends on which test protocol was actually used and a
// wrong guess here would be worse than the no-flag default this shipped
// with originally.
function BumpHealthScreen({ isEn, patient={}, bumpSubscriptionId }) {
  const __theme = useContext(ThemeContext)
  const [bumpRow,setBumpRow]=useState(null)
  const [bpLogs,setBpLogs]=useState([])
  const [glucoseLogs,setGlucoseLogs]=useState([])
  const [kickLogs,setKickLogs]=useState([])
  const [documents,setDocuments]=useState([])
  const [loading,setLoading]=useState(true)
  const [bpForm,setBpForm]=useState({systolic:'',diastolic:''})
  const [glucoseForm,setGlucoseForm]=useState({value:'',context:'fasting'})
  const [saving,setSaving]=useState(false)
  const [kickSession,setKickSession]=useState(null) // {startedAt, count} while a count is in progress
  const [exportingPdf,setExportingPdf]=useState(false)
  const [exportingHandoff,setExportingHandoff]=useState(false)
  const [allergies,setAllergies]=useState([])
  const [conditions,setConditions]=useState([])
  const [medications,setMedications]=useState([])
  const [recoveryChecks,setRecoveryChecks]=useState([])
  const [epdsScreens,setEpdsScreens]=useState([])
  const [epdsAnswers,setEpdsAnswers]=useState({})
  const [epdsSaving,setEpdsSaving]=useState(false)
  const [epdsResult,setEpdsResult]=useState(null)
  const [activePolicy,setActivePolicy]=useState(null)
  const [exportingAdmission,setExportingAdmission]=useState(false)
  const [biometryLogs,setBiometryLogs]=useState([])
  const [biometryForm,setBiometryForm]=useState({ scanDate:'', efw:'' })

  // Only the very first load shows the full "Loading…" screen - every
  // reload after adding/deleting an entry used to set loading=true again
  // too, which unmounted the whole screen for a frame and looked like a
  // flash/refresh glitch rather than a quiet background update.
  async function load(isInitial=false) {
    if (!bumpSubscriptionId) { setLoading(false); return }
    if (isInitial) setLoading(true)
    const [{data:sub},{data:bp},{data:g},{data:k},{data:docs},{data:allergyRows},{data:condRows},{data:medRows},{data:recovery},{data:epds},{data:policies},{data:biometry}] = await Promise.all([
      supabase.from('bump_subscriptions').select('*').eq('id',bumpSubscriptionId).maybeSingle(),
      supabase.from('bump_bp_logs').select('*').eq('bump_subscription_id',bumpSubscriptionId).order('recorded_at',{ascending:false}).limit(30),
      supabase.from('bump_glucose_logs').select('*').eq('bump_subscription_id',bumpSubscriptionId).order('recorded_at',{ascending:false}).limit(30),
      supabase.from('bump_kick_logs').select('*').eq('bump_subscription_id',bumpSubscriptionId).order('started_at',{ascending:false}).limit(20),
      patient?.id ? supabase.from('medical_record_attachments').select('*').eq('patient_id',patient.id).in('category', BUMP_DOC_TYPES.map(t=>t.value)).order('uploaded_at',{ascending:false}) : Promise.resolve({data:[]}),
      patient?.id ? supabase.from('allergies').select('*').eq('patient_id',patient.id) : Promise.resolve({data:[]}),
      patient?.id ? supabase.from('conditions').select('*').eq('patient_id',patient.id).eq('active',true) : Promise.resolve({data:[]}),
      patient?.id ? supabase.from('medications').select('*').eq('patient_id',patient.id) : Promise.resolve({data:[]}),
      supabase.from('bump_recovery_checklist').select('*').eq('bump_subscription_id',bumpSubscriptionId),
      supabase.from('bump_epds_screens').select('*').eq('bump_subscription_id',bumpSubscriptionId).order('completed_at',{ascending:false}),
      patient?.id ? supabase.from('agent_policies').select('*, insurance_plans(company_name)').eq('patient_id',patient.id).in('status',['active','renewal_in_progress']).order('renewal_date',{ascending:true}).limit(1) : Promise.resolve({data:[]}),
      supabase.from('bump_fetal_biometry').select('*').eq('bump_subscription_id',bumpSubscriptionId).order('scan_date',{ascending:false}),
    ])
    setBumpRow(sub||null)
    setBpLogs(bp||[]); setGlucoseLogs(g||[]); setKickLogs(k||[]); setDocuments(docs||[])
    setAllergies(allergyRows||[]); setConditions(condRows||[]); setMedications(medRows||[])
    setRecoveryChecks(recovery||[])
    setEpdsScreens(epds||[])
    setActivePolicy((policies||[])[0]||null)
    setBiometryLogs(biometry||[])
    setLoading(false)
  }
  useEffect(() => { load(true) }, [bumpSubscriptionId])

  // bc-03 (simplified, on your call) - just logs the estimated fetal
  // weight a patient's own ultrasound report already states, tracked
  // over time like every other Bump log. Dropped the Hadlock-formula
  // calculator (computing EFW from raw BPD/HC/AC/FL) - most patients'
  // own ultrasound machine already computes and prints this, so
  // recomputing it in Medsa solved a problem few patients actually have.
  async function addBiometry() {
    if (!bumpSubscriptionId || !biometryForm.scanDate || !biometryForm.efw) return
    setSaving(true)
    await supabase.from('bump_fetal_biometry').insert({
      bump_subscription_id: bumpSubscriptionId, scan_date: biometryForm.scanDate, efw_grams: Number(biometryForm.efw),
    })
    setBiometryForm({ scanDate:'', efw:'' })
    await load(); setSaving(false)
  }
  async function deleteBiometry(id) { await supabase.from('bump_fetal_biometry').delete().eq('id', id); load() }

  // gop-01 - the "1-click pre-admission packet" from the GOP feature doc.
  // "1-click" just means one export button compiling what's already on
  // file, same mechanism as bm-01/bm-02 - NOT the auto-submit-to-insurer
  // half of that idea (gop-02), which stays blocked on a real insurer/
  // hospital partnership that doesn't exist. This is the concise, walk-
  // into-L&D version: identity, blood type if on file, gestational age,
  // allergies/conditions/meds, insurance reference if a policy is on
  // file, and the antenatal documents - not the full BP/glucose log
  // (that's what bm-01's full ledger is for).
  async function downloadAdmissionPacket() {
    if (!bumpSubscriptionId) return
    setExportingAdmission(true)
    const PINK = [244,143,167]
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const subtitle = `${patient.full_name||''} · ${patient.medsa_id||''} · Hospital Pre-Admission Packet`
    drawPdfHeader(doc, pageWidth, subtitle)
    let y = 40

    const weeksUntilDue = bumpRow?.predicted_due_date ? Math.ceil((new Date(bumpRow.predicted_due_date) - new Date()) / (7*24*60*60*1000)) : null
    const gestationalWeek = weeksUntilDue!=null ? 40-weeksUntilDue : null

    y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Patient & pregnancy', subtitle, accentColor: PINK,
      dateInstitution: `Generated ${new Date().toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} - for hospital admission ahead of delivery`,
      details: [
        ['Patient', `${patient.full_name||''} (${patient.medsa_id||''})`],
        ...(patient.date_of_birth ? [['Date of birth', new Date(patient.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})]] : []),
        ...(patient.blood_type ? [['Blood type', patient.blood_type]] : []),
        ...(gestationalWeek!=null ? [['Gestational age', `${Math.max(0,gestationalWeek)} weeks (estimated as of today)`]] : []),
        ...(bumpRow?.predicted_due_date ? [['Predicted due date', new Date(bumpRow.predicted_due_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})]] : []),
      ],
    })

    y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Allergies, conditions & medications', subtitle, accentColor: PINK,
      dateInstitution: 'As recorded on the patient\'s Medsa profile',
      details: [
        ['Known allergies', allergies.length>0 ? allergies.map(a=>a.allergen||a.name).filter(Boolean).join(', ') : 'None on file'],
        ['Active conditions', conditions.length>0 ? conditions.map(c=>c.condition_name).filter(Boolean).join(', ') : 'None on file'],
        ['Current medications', medications.length>0 ? medications.map(m=>m.name||m.medication_name).filter(Boolean).join(', ') : 'None on file'],
      ],
    })

    y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Insurance', subtitle, accentColor: PINK,
      dateInstitution: 'For admissions desk reference',
      details: activePolicy
        ? [
            ['Insurer', activePolicy.insurance_plans?.company_name || 'Not named'],
            ['Plan', activePolicy.plan_name || '—'],
            ...(activePolicy.policy_number ? [['Policy number', activePolicy.policy_number]] : []),
          ]
        : [['Policy on file', 'None - self-pay, or bring insurance card/details at admission']],
    })

    if (documents.length>0) y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Uploaded antenatal documents', subtitle, accentColor: PINK,
      dateInstitution: `${documents.length} document${documents.length===1?'':'s'} on file - see Account Settings to view the actual files`,
      details: documents.map(d=>{
        const t = BUMP_DOC_TYPES.find(t=>t.value===d.category)
        return [t?t.label.en:d.category, d.file_name]
      }),
    })

    drawPdfFooter(doc, pageWidth, pageHeight)
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Medsa-Bump-Admission-Packet-${patient.medsa_id||'export'}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExportingAdmission(false)
  }

  // bc-05 - the real EPDS, now unblocked with the verbatim text you
  // supplied (see EPDS_ITEMS above for the sourcing note). Scored exactly
  // as printed on each option, summed across all 10 items (0-30). No
  // numeric "likely depression" cutoff is asserted here - the instrument
  // text you gave me doesn't print one, it only says to discuss answers
  // with a health care provider, so that's exactly what this does too.
  // Item 10 (self-harm) always gets an immediate safety callout on any
  // non-zero answer, regardless of total score - standard practice for
  // this instrument, and not something to wait on a total-score
  // threshold for.
  async function submitEpds() {
    if (EPDS_ITEMS.some(item => epdsAnswers[item.key]==null)) return
    setEpdsSaving(true)
    const responses = EPDS_ITEMS.map(item => epdsAnswers[item.key])
    const totalScore = responses.reduce((s,v)=>s+v, 0)
    const item10Flagged = epdsAnswers[10] > 0
    await supabase.from('bump_epds_screens').insert({
      bump_subscription_id: bumpSubscriptionId, responses, total_score: totalScore, item10_flagged: item10Flagged,
    })
    setEpdsResult({ totalScore, item10Flagged })
    setEpdsAnswers({})
    await load(); setEpdsSaving(false)
  }
  async function deleteEpdsScreen(id) { await supabase.from('bump_epds_screens').delete().eq('id', id); load() }

  // Postpartum "fourth trimester" recovery checklist - general patient-
  // education topics (not a diagnosis or dosing instruction), safe to
  // author directly, unlike the EPDS mental-health self-screen (bc-05)
  // which stays blocked pending the real validated instrument text.
  async function toggleRecoveryItem(key) {
    const existing = recoveryChecks.find(r=>r.item_key===key)
    if (existing) {
      await supabase.from('bump_recovery_checklist').delete().eq('id', existing.id)
    } else {
      await supabase.from('bump_recovery_checklist').insert({ bump_subscription_id: bumpSubscriptionId, item_key: key })
    }
    load()
  }

  // bm-01 - the "continuous maternal ledger" the feature doc describes:
  // one exportable PDF combining the pregnancy's own documents (already
  // uploaded under Account Settings) with everything logged on this
  // screen, for handing to an OBGYN or a public HA hospital at a visit.
  async function downloadMaternalSummary() {
    if (!bumpSubscriptionId) return
    setExportingPdf(true)
    const PINK = [244,143,167]
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const subtitle = `${patient.full_name||''} · ${patient.medsa_id||''} · Maternal Health Summary`
    drawPdfHeader(doc, pageWidth, subtitle)
    let y = 40

    y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Pregnancy', subtitle, accentColor: PINK,
      dateInstitution: bumpRow?.started_at ? `Medsa Bump started ${new Date(bumpRow.started_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}` : '',
      details: [
        ...(bumpRow?.predicted_due_date ? [['Predicted due date', new Date(bumpRow.predicted_due_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})]] : []),
        ...(bumpRow?.discovered_pregnant_at ? [['Discovered pregnant', new Date(bumpRow.discovered_pregnant_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})]] : []),
      ],
    })

    if (bpLogs.length>0) y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Blood pressure log', subtitle, accentColor: PINK,
      dateInstitution: `${bpLogs.length} reading${bpLogs.length===1?'':'s'} · readings at or above 140/90 mmHg are flagged`,
      details: [...bpLogs].reverse().map(b=>[
        new Date(b.recorded_at).toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),
        `${b.systolic}/${b.diastolic} mmHg${(b.systolic>=140||b.diastolic>=90)?'\n⚠ Flagged (≥140/90)':''}`,
      ]),
    })

    if (glucoseLogs.length>0) y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Blood glucose log', subtitle, accentColor: PINK,
      dateInstitution: `${glucoseLogs.length} reading${glucoseLogs.length===1?'':'s'} · flagged against IADPSG 75g-OGTT consensus cutoffs (fasting ≥92, 1hr ≥180, 2hr ≥153 mg/dL)`,
      details: [...glucoseLogs].reverse().map(g=>{
        const ctx = GLUCOSE_CONTEXTS.find(c=>c.value===g.context)
        return [
          new Date(g.recorded_at).toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),
          `${g.glucose_mg_dl} mg/dL${ctx?` (${ctx.en})`:''}${isGlucoseFlagged(g.context,g.glucose_mg_dl)?'\n⚠ Flagged (IADPSG cutoff)':''}`,
        ]
      }),
    })

    if (kickLogs.length>0) y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Kick-count sessions', subtitle, accentColor: PINK,
      dateInstitution: `${kickLogs.length} session${kickLogs.length===1?'':'s'}`,
      details: [...kickLogs].reverse().map(k=>[new Date(k.started_at).toLocaleString('en-HK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}), `${k.kick_count} kicks${k.ended_at?` over ${Math.round((new Date(k.ended_at)-new Date(k.started_at))/60000)} min`:''}`]),
    })

    if (documents.length>0) y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Uploaded documents', subtitle, accentColor: PINK,
      dateInstitution: `${documents.length} document${documents.length===1?'':'s'} - see Account Settings to view the actual files`,
      details: documents.map(d=>{
        const t = BUMP_DOC_TYPES.find(t=>t.value===d.category)
        return [t?t.label.en:d.category, d.file_name]
      }),
    })

    drawPdfFooter(doc, pageWidth, pageHeight)
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Medsa-Bump-Maternal-Summary-${patient.medsa_id||'export'}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExportingPdf(false)
  }

  // bm-02 - private↔public handoff formatting: a mother seeing a private
  // OBGYN who delivers at a public HA hospital needs a short, standardized
  // intake summary a doctor meeting her for the first time can actually use
  // - not the full chronological ledger bm-01 exports. Allergies/active
  // conditions/current medications come from the same tables every other
  // part of the app already uses, not anything Bump-specific.
  async function downloadHandoffSummary() {
    if (!bumpSubscriptionId) return
    setExportingHandoff(true)
    const PINK = [244,143,167]
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const subtitle = `${patient.full_name||''} · ${patient.medsa_id||''} · Antenatal Handoff Summary`
    drawPdfHeader(doc, pageWidth, subtitle)
    let y = 40

    const weeksUntilDue = bumpRow?.predicted_due_date ? Math.ceil((new Date(bumpRow.predicted_due_date) - new Date()) / (7*24*60*60*1000)) : null
    const gestationalWeek = weeksUntilDue!=null ? 40-weeksUntilDue : null
    const lastBp = bpLogs[0]
    const flaggedBpCount = bpLogs.filter(b=>b.systolic>=140||b.diastolic>=90).length
    const lastGlucose = glucoseLogs[0]
    const flaggedGlucoseCount = glucoseLogs.filter(g=>isGlucoseFlagged(g.context,g.glucose_mg_dl)).length

    y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Patient & pregnancy', subtitle, accentColor: PINK,
      dateInstitution: `Summary generated ${new Date().toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})} - for handoff from a private OBGYN to a receiving hospital/clinic`,
      details: [
        ['Patient', `${patient.full_name||''} (${patient.medsa_id||''})`],
        ...(patient.date_of_birth ? [['Date of birth', new Date(patient.date_of_birth).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})]] : []),
        ...(gestationalWeek!=null ? [['Gestational age', `${Math.max(0,gestationalWeek)} weeks (estimated as of today)`]] : []),
        ...(bumpRow?.predicted_due_date ? [['Predicted due date', new Date(bumpRow.predicted_due_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})]] : []),
      ],
    })

    y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Allergies, conditions & medications', subtitle, accentColor: PINK,
      dateInstitution: 'As recorded on the patient\'s Medsa profile',
      details: [
        ['Known allergies', allergies.length>0 ? allergies.map(a=>a.allergen||a.name).filter(Boolean).join(', ') : 'None on file'],
        ['Active conditions', conditions.length>0 ? conditions.map(c=>c.condition_name).filter(Boolean).join(', ') : 'None on file'],
        ['Current medications', medications.length>0 ? medications.map(m=>m.name||m.medication_name).filter(Boolean).join(', ') : 'None on file'],
      ],
    })

    y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Monitoring summary', subtitle, accentColor: PINK,
      dateInstitution: `${bpLogs.length} BP reading${bpLogs.length===1?'':'s'} (${flaggedBpCount} at/above 140/90), ${glucoseLogs.length} glucose reading${glucoseLogs.length===1?'':'s'} (${flaggedGlucoseCount} at/above IADPSG cutoff)`,
      details: [
        ...(lastBp ? [['Most recent BP', `${lastBp.systolic}/${lastBp.diastolic} mmHg (${new Date(lastBp.recorded_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})})${(lastBp.systolic>=140||lastBp.diastolic>=90)?'\n⚠ Flagged (≥140/90)':''}`]] : []),
        ...(lastGlucose ? [['Most recent glucose', `${lastGlucose.glucose_mg_dl} mg/dL (${new Date(lastGlucose.recorded_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})})${isGlucoseFlagged(lastGlucose.context,lastGlucose.glucose_mg_dl)?'\n⚠ Flagged (IADPSG cutoff)':''}`]] : []),
        ...(kickLogs.length>0 ? [['Kick-count sessions logged', String(kickLogs.length)]] : []),
        ['Full readings log', 'See the attached maternal health summary export for every logged reading'],
      ],
    })

    if (documents.length>0) y = drawPdfRecordCard(doc, y, pageWidth, pageHeight, {
      title: 'Uploaded antenatal documents', subtitle, accentColor: PINK,
      dateInstitution: `${documents.length} document${documents.length===1?'':'s'} on file - see Account Settings to view the actual files`,
      details: documents.map(d=>{
        const t = BUMP_DOC_TYPES.find(t=>t.value===d.category)
        return [t?t.label.en:d.category, d.file_name]
      }),
    })

    drawPdfFooter(doc, pageWidth, pageHeight)
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Medsa-Bump-Handoff-Summary-${patient.medsa_id||'export'}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExportingHandoff(false)
  }

  async function addBp() {
    if (!bumpSubscriptionId || !bpForm.systolic || !bpForm.diastolic) return
    setSaving(true)
    await supabase.from('bump_bp_logs').insert({ bump_subscription_id:bumpSubscriptionId, systolic:Number(bpForm.systolic), diastolic:Number(bpForm.diastolic) })
    setBpForm({systolic:'',diastolic:''})
    await load(); setSaving(false)
  }
  async function deleteBp(id) { await supabase.from('bump_bp_logs').delete().eq('id', id); load() }

  async function addGlucose() {
    if (!bumpSubscriptionId || !glucoseForm.value) return
    setSaving(true)
    await supabase.from('bump_glucose_logs').insert({ bump_subscription_id:bumpSubscriptionId, glucose_mg_dl:Number(glucoseForm.value), context:glucoseForm.context })
    setGlucoseForm({value:'',context:'fasting'})
    await load(); setSaving(false)
  }
  async function deleteGlucose(id) { await supabase.from('bump_glucose_logs').delete().eq('id', id); load() }

  function startKickSession() { setKickSession({ startedAt:new Date(), count:0 }) }
  function addKick() { setKickSession(prev => prev ? {...prev, count:prev.count+1} : prev) }
  async function finishKickSession() {
    if (!kickSession || !bumpSubscriptionId) return
    await supabase.from('bump_kick_logs').insert({ bump_subscription_id:bumpSubscriptionId, started_at:kickSession.startedAt.toISOString(), ended_at:new Date().toISOString(), kick_count:kickSession.count })
    setKickSession(null)
    await load()
  }
  async function deleteKick(id) { await supabase.from('bump_kick_logs').delete().eq('id', id); load() }

  if (loading) return <div style={{padding:'40px',textAlign:'center',fontSize:'12px',color:C.textMuted}}>{isEn?'Loading…':'載入中…'}</div>

  return (
    <div style={{padding:'0 16px 24px'}}>
      <div style={{margin:'16px 0',padding:'14px 16px',background:__theme.accentXLight,border:`0.5px solid ${__theme.accentLight}`,borderRadius:'12px'}}>
        <div style={{fontSize:'13px',fontWeight:700,color:__theme.accent,marginBottom:'4px'}}>{isEn?'Pregnancy health log':'孕期健康記錄'}</div>
        <div style={{fontSize:'11.5px',color:C.textSub,lineHeight:1.6,marginBottom:'10px'}}>{isEn?'For high-risk monitoring your OBGYN has asked you to track - not a substitute for a scheduled check-up.':'用於記錄您的婦產科醫生要求監察的數據 - 並非取代既定的檢查。'}</div>
        <div onClick={exportingPdf?undefined:downloadMaternalSummary} style={{fontSize:'12px',fontWeight:600,color:__theme.accent,cursor:exportingPdf?'wait':'pointer',textDecoration:'underline'}}>{exportingPdf?(isEn?'Generating…':'生成中…'):(isEn?'⬇ Export maternal health summary PDF':'⬇ 匯出孕產健康摘要PDF')}</div>
        <div onClick={exportingHandoff?undefined:downloadHandoffSummary} style={{fontSize:'12px',fontWeight:600,color:__theme.accent,cursor:exportingHandoff?'wait':'pointer',textDecoration:'underline',marginTop:'6px'}}>{exportingHandoff?(isEn?'Generating…':'生成中…'):(isEn?'⬇ Export handoff summary for a new doctor/hospital':'⬇ 匯出轉介摘要（供新醫生／醫院使用）')}</div>
        <div onClick={exportingAdmission?undefined:downloadAdmissionPacket} style={{fontSize:'12px',fontWeight:600,color:__theme.accent,cursor:exportingAdmission?'wait':'pointer',textDecoration:'underline',marginTop:'6px'}}>{exportingAdmission?(isEn?'Generating…':'生成中…'):(isEn?'⬇ Export hospital pre-admission packet':'⬇ 匯出醫院入院前摘要')}</div>
      </div>

      <SecLabel>{isEn?'Mental health check-in (EPDS)':'情緒健康檢視（EPDS）'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{isEn?'The Edinburgh Postnatal Depression Scale, meant for use at 28-32 weeks of pregnancy and again at 6-8 weeks postpartum. This is a screening tool to discuss with your health care provider - not a diagnosis. English only for now. © The Royal College of Psychiatrists, from Cox, Holden & Sagovsky (1987), reprinted with permission.':'愛丁堡產後抑鬱量表,建議於懷孕28-32週及產後6-8週使用。此為篩查工具,用於與您的醫護人員討論 - 並非診斷。暫時僅提供英文版本。© The Royal College of Psychiatrists,出自Cox, Holden & Sagovsky (1987),已獲授權轉載。'}</div>

        {epdsResult&&<div style={{margin:'0 0 14px',padding:'12px 14px',background:epdsResult.item10Flagged?C.redLight:__theme.accentXLight,border:`0.5px solid ${epdsResult.item10Flagged?C.red:__theme.accentLight}`,borderRadius:'10px'}}>
          <div style={{fontSize:'13px',fontWeight:700,color:epdsResult.item10Flagged?C.red:__theme.accent}}>{isEn?`Score: ${epdsResult.totalScore} / 30`:`分數：${epdsResult.totalScore} / 30`}</div>
          <div style={{fontSize:'11.5px',color:C.textSub,marginTop:'4px',lineHeight:1.6}}>{isEn?'Talk about your answers to these questions with your health care provider.':'請與您的醫護人員討論您的答案。'}</div>
          {epdsResult.item10Flagged&&<div style={{fontSize:'12px',color:C.red,fontWeight:600,marginTop:'8px',lineHeight:1.6}}>{isEn?"You answered that thoughts of harming yourself have occurred to you. Please talk to someone now - contact your OBGYN, midwife, or GP today, or if you're in immediate danger, call 999 or go to your nearest A&E.":'您回答曾出現傷害自己的想法。請立即向人求助 - 今天聯絡您的婦產科醫生、助產士或家庭醫生,若有即時危險,請致電999或前往最近的急症室。'}</div>}
        </div>}

        {!epdsResult&&<>
          {EPDS_ITEMS.map(item=>(
            <div key={item.key} style={{marginBottom:'14px'}}>
              <div style={{fontSize:'12.5px',fontWeight:600,color:C.text,marginBottom:'6px'}}>{item.key}. {item.en}</div>
              {item.options.map((opt,i)=>(
                <div key={i} onClick={()=>setEpdsAnswers({...epdsAnswers,[item.key]:opt.points})} style={{display:'flex',alignItems:'center',gap:'8px',padding:'5px 0',cursor:'pointer'}}>
                  <div style={{width:16,height:16,borderRadius:'50%',border:`1.5px solid ${epdsAnswers[item.key]===opt.points?__theme.accent:C.border}`,background:epdsAnswers[item.key]===opt.points?__theme.accent:'#fff',flexShrink:0}}/>
                  <div style={{fontSize:'12.5px',color:C.text}}>{opt.en}</div>
                </div>
              ))}
            </div>
          ))}
          <Btn variant="primary" style={{width:'100%'}} disabled={epdsSaving||EPDS_ITEMS.some(item=>epdsAnswers[item.key]==null)} onClick={submitEpds}>{epdsSaving?(isEn?'Saving…':'儲存中…'):(isEn?'See my score':'查看分數')}</Btn>
        </>}
        {epdsResult&&<Btn style={{width:'100%',marginTop:'4px'}} onClick={()=>setEpdsResult(null)}>{isEn?'Take it again':'重新進行'}</Btn>}

        {epdsScreens.length>0&&<div style={{marginTop:'16px'}}>
          <div style={{fontSize:'10px',color:C.textMuted,marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}}>{isEn?'Past check-ins':'過往記錄'}</div>
          {epdsScreens.map(e=>(
            <div key={e.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}>
              <span style={{color:C.textMuted,width:100,flexShrink:0}}>{new Date(e.completed_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</span>
              <span style={{flex:1,fontWeight:e.item10_flagged?700:400,color:e.item10_flagged?C.red:C.text}}>{e.total_score} / 30{e.item10_flagged?(isEn?' ⚠ self-harm item flagged':' ⚠ 已標示傷害自己項目'):''}</span>
              <span onClick={()=>deleteEpdsScreen(e.id)} style={{color:C.textMuted,cursor:'pointer',fontSize:'13px'}}>✕</span>
            </div>
          ))}
        </div>}
      </Card>

      {bumpRow?.child_dob&&<>
        <SecLabel>{isEn?'Postpartum recovery':'產後復原'}</SecLabel>
        <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{isEn?"The topics a 6-week postpartum check-up usually covers - check off what's been addressed. The last one is a feelings check-in, not a clinical depression screen.":'一般產後6週檢查會涵蓋的項目 - 請勾選已處理的項目。最後一項為情緒自我檢視,並非臨床抑鬱症篩查。'}</div>
          {POSTPARTUM_RECOVERY_ITEMS.map(item=>{
            const checked = recoveryChecks.some(r=>r.item_key===item.key)
            return (
              <div key={item.key} onClick={()=>toggleRecoveryItem(item.key)} style={{display:'flex',gap:'10px',alignItems:'flex-start',padding:'6px 0',cursor:'pointer'}}>
                <div style={{width:18,height:18,borderRadius:'4px',border:`1.5px solid ${checked?__theme.accent:C.border}`,background:checked?__theme.accent:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'#fff',flexShrink:0,marginTop:'1px'}}>{checked?'✓':''}</div>
                <div style={{fontSize:'12.5px',color:C.text,lineHeight:1.4,textDecoration:checked?'line-through':'none',textDecorationColor:C.textMuted}}>{isEn?item.en:item.zh}</div>
              </div>
            )
          })}
        </Card>
      </>}

      <SecLabel>{isEn?'Blood pressure':'血壓'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          <input type="number" value={bpForm.systolic} onChange={e=>setBpForm({...bpForm,systolic:e.target.value})} placeholder={isEn?'Systolic':'收縮壓'} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
          <input type="number" value={bpForm.diastolic} onChange={e=>setBpForm({...bpForm,diastolic:e.target.value})} placeholder={isEn?'Diastolic':'舒張壓'} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
        </div>
        <Btn variant="primary" style={{width:'100%'}} disabled={saving||!bpForm.systolic||!bpForm.diastolic} onClick={addBp}>{isEn?'Add reading':'新增讀數'}</Btn>
        <div style={{marginTop:'12px'}}>
          {bpLogs.map(b=>{
            const flagged = b.systolic>=140 || b.diastolic>=90
            return (
              <div key={b.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}>
                <span style={{color:C.textMuted,width:120,flexShrink:0}}>{new Date(b.recorded_at).toLocaleString('en-HK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                <span style={{flex:1,fontWeight:flagged?700:400,color:flagged?C.red:C.text}}>{b.systolic}/{b.diastolic} mmHg{flagged?(isEn?'  ⚠ at or above 140/90':'  ⚠ 達或超過140/90'):''}</span>
                <span onClick={()=>deleteBp(b.id)} style={{color:C.textMuted,cursor:'pointer',fontSize:'13px'}}>✕</span>
              </div>
            )
          })}
        </div>
      </Card>

      <SecLabel>{isEn?'Blood glucose':'血糖'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <div style={{fontSize:'10.5px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{isEn?'Readings at or above the IADPSG 75g-OGTT consensus cutoffs are flagged (fasting ≥92, 1hr ≥180, 2hr ≥153 mg/dL) - if your OBGYN used a different test, ask them directly rather than relying on this flag.':'達到或超過IADPSG 75克口服葡萄糖耐量測試共識標準的讀數會被標示(空腹≥92、餐後1小時≥180、餐後2小時≥153 mg/dL) - 若您的婦產科醫生採用不同測試,請直接向醫生查詢,毋須依賴此標示。'}</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
          <input type="number" value={glucoseForm.value} onChange={e=>setGlucoseForm({...glucoseForm,value:e.target.value})} placeholder={isEn?'mg/dL':'mg/dL'} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
          <select value={glucoseForm.context} onChange={e=>setGlucoseForm({...glucoseForm,context:e.target.value})} style={{flex:1.3,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px',background:'#fff'}}>
            {GLUCOSE_CONTEXTS.map(c=><option key={c.value} value={c.value}>{isEn?c.en:c.zh}</option>)}
          </select>
        </div>
        <Btn variant="primary" style={{width:'100%'}} disabled={saving||!glucoseForm.value} onClick={addGlucose}>{isEn?'Add reading':'新增讀數'}</Btn>
        <div style={{marginTop:'12px'}}>
          {glucoseLogs.map(g=>{
            const ctx = GLUCOSE_CONTEXTS.find(c=>c.value===g.context)
            const flagged = isGlucoseFlagged(g.context, g.glucose_mg_dl)
            return (
              <div key={g.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}>
                <span style={{color:C.textMuted,width:120,flexShrink:0}}>{new Date(g.recorded_at).toLocaleString('en-HK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                <span style={{flex:1,fontWeight:flagged?700:400,color:flagged?C.red:C.text}}>{g.glucose_mg_dl} mg/dL{ctx?` · ${isEn?ctx.en:ctx.zh}`:''}{flagged?(isEn?'  ⚠ at or above IADPSG cutoff':'  ⚠ 達或超過IADPSG標準'):''}</span>
                <span onClick={()=>deleteGlucose(g.id)} style={{color:C.textMuted,cursor:'pointer',fontSize:'13px'}}>✕</span>
              </div>
            )
          })}
        </div>
      </Card>

      <SecLabel>{isEn?'Kick counts':'胎動次數'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        {!kickSession&&<Btn variant="primary" style={{width:'100%'}} onClick={startKickSession}>{isEn?'Start counting':'開始計算'}</Btn>}
        {kickSession&&<>
          <div style={{textAlign:'center',padding:'16px 0'}}>
            <div style={{fontSize:'36px',fontWeight:700,color:__theme.accent}}>{kickSession.count}</div>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'14px'}}>{isEn?`Started ${kickSession.startedAt.toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}`:`開始於${kickSession.startedAt.toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})}`}</div>
            <div style={{display:'flex',gap:'10px'}}>
              <Btn variant="primary" style={{flex:2,fontSize:'16px',padding:'16px'}} onClick={addKick}>{isEn?'+ Kick':'+ 胎動'}</Btn>
              <Btn style={{flex:1}} onClick={finishKickSession}>{isEn?'Done':'完成'}</Btn>
            </div>
          </div>
        </>}
        <div style={{marginTop:'12px'}}>
          {kickLogs.map(k=>(
            <div key={k.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}>
              <span style={{color:C.textMuted,width:120,flexShrink:0}}>{new Date(k.started_at).toLocaleString('en-HK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
              <span style={{flex:1}}>{isEn?`${k.kick_count} kicks`:`${k.kick_count}次胎動`}{k.ended_at?` · ${Math.round((new Date(k.ended_at)-new Date(k.started_at))/60000)}min`:''}</span>
              <span onClick={()=>deleteKick(k.id)} style={{color:C.textMuted,cursor:'pointer',fontSize:'13px'}}>✕</span>
            </div>
          ))}
        </div>
      </Card>

      <SecLabel>{isEn?'Fetal growth (ultrasound)':'胎兒生長（超聲波）'}</SecLabel>
      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px',lineHeight:1.5}}>{isEn?"After an ultrasound scan, enter the estimated fetal weight your doctor's report gives you, to keep one running record across your pregnancy.":'超聲波檢查後,輸入醫生報告上的估計胎兒體重,以保留整個孕期的連續記錄。'}</div>
        <div style={{display:'flex',gap:'8px',marginBottom:'10px',flexWrap:'wrap'}}>
          <input type="date" value={biometryForm.scanDate} max={new Date().toISOString().slice(0,10)} onChange={e=>setBiometryForm({...biometryForm,scanDate:e.target.value})} style={{flex:'1 1 140px',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
          <input type="number" value={biometryForm.efw} onChange={e=>setBiometryForm({...biometryForm,efw:e.target.value})} placeholder={isEn?'Estimated weight (g)':'估計體重 (克)'} style={{flex:'1 1 140px',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'8px 10px',fontSize:'13px'}}/>
        </div>
        <Btn variant="primary" style={{width:'100%'}} disabled={saving||!biometryForm.scanDate||!biometryForm.efw} onClick={addBiometry}>{isEn?'Add scan':'新增記錄'}</Btn>
        <div style={{marginTop:'12px'}}>
          {biometryLogs.length===0&&<div style={{fontSize:'12px',color:C.textMuted,textAlign:'center',padding:'8px 0'}}>{isEn?'No scans logged yet.':'暫無超聲波記錄。'}</div>}
          {biometryLogs.map(b=>(
            <div key={b.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}>
              <span style={{color:C.textMuted,width:90,flexShrink:0}}>{new Date(b.scan_date).toLocaleDateString('en-HK',{day:'numeric',month:'short'})}</span>
              <span style={{flex:1}}>{b.efw_grams}g</span>
              <span onClick={()=>deleteBiometry(b.id)} style={{color:C.textMuted,cursor:'pointer',fontSize:'13px'}}>✕</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// bc-04 - due-date "birth club" cohorts, scoped down from the original
// brief: a real discussion space grouped by predicted due-date month,
// since the existing Community tab (forum_products/forum_posts) is a
// product-review board keyed by product name, not a general discussion
// space, and doesn't fit this. The "verified badge for a participating
// lactation consultant or midwife" half of the brief is NOT built here -
// that needs a real admin-side professional-verification workflow that
// doesn't exist yet, and a "Verified" badge with no actual verification
// behind it would be worse than no badge at all. Posts show a stable,
// anonymous per-poster handle rather than the patient's real name, same
// "anonymously" framing as the product Community tab.
function BumpCohortScreen({ isEn, patient={} }) {
  const __theme = useContext(ThemeContext)
  const [cohortKey,setCohortKey]=useState(undefined) // undefined = loading, null = no due date on file
  const [posts,setPosts]=useState([])
  const [loading,setLoading]=useState(true)
  const [newPost,setNewPost]=useState('')
  const [saving,setSaving]=useState(false)
  const [openReplies,setOpenReplies]=useState({}) // postId -> replies array
  const [replyDrafts,setReplyDrafts]=useState({})

  function pseudonym(patientId) {
    return (isEn?'Parent ·':'家長 ·') + (patientId||'').replace(/-/g,'').slice(-4).toUpperCase()
  }

  async function load(isInitial=false) {
    if (isInitial) setLoading(true)
    const { data: sub } = await supabase.from('bump_subscriptions').select('predicted_due_date').eq('patient_id',patient.id).is('graduated_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle()
    const key = sub?.predicted_due_date ? sub.predicted_due_date.slice(0,7) : null
    setCohortKey(key)
    if (key) {
      const { data } = await supabase.from('bump_cohort_posts').select('*').eq('cohort_key',key).order('created_at',{ascending:false}).limit(50)
      setPosts(data||[])
    }
    setLoading(false)
  }
  useEffect(() => { load(true) }, [patient?.id])

  async function addPost() {
    if (!newPost.trim() || !cohortKey) return
    setSaving(true)
    await supabase.from('bump_cohort_posts').insert({ cohort_key: cohortKey, patient_id: patient.id, body: newPost.trim() })
    setNewPost('')
    await load(); setSaving(false)
  }
  async function deletePost(id) { await supabase.from('bump_cohort_posts').delete().eq('id', id); load() }

  async function toggleReplies(postId) {
    if (openReplies[postId]) { setOpenReplies(prev => { const next={...prev}; delete next[postId]; return next }) ; return }
    const { data } = await supabase.from('bump_cohort_replies').select('*').eq('post_id',postId).order('created_at',{ascending:true})
    setOpenReplies(prev => ({ ...prev, [postId]: data||[] }))
  }
  async function addReply(postId) {
    const text = (replyDrafts[postId]||'').trim()
    if (!text) return
    await supabase.from('bump_cohort_replies').insert({ post_id: postId, patient_id: patient.id, body: text })
    setReplyDrafts(prev => ({ ...prev, [postId]: '' }))
    const { data } = await supabase.from('bump_cohort_replies').select('*').eq('post_id',postId).order('created_at',{ascending:true})
    setOpenReplies(prev => ({ ...prev, [postId]: data||[] }))
  }
  async function deleteReply(postId, id) {
    await supabase.from('bump_cohort_replies').delete().eq('id', id)
    const { data } = await supabase.from('bump_cohort_replies').select('*').eq('post_id',postId).order('created_at',{ascending:true})
    setOpenReplies(prev => ({ ...prev, [postId]: data||[] }))
  }

  if (loading) return <div style={{padding:'40px',textAlign:'center',fontSize:'12px',color:C.textMuted}}>{isEn?'Loading…':'載入中…'}</div>

  if (!cohortKey) return (
    <div style={{padding:'0 16px 24px'}}>
      <div style={{margin:'16px 0',padding:'14px 16px',background:__theme.accentXLight,border:`0.5px solid ${__theme.accentLight}`,borderRadius:'12px'}}>
        <div style={{fontSize:'13px',fontWeight:700,color:__theme.accent,marginBottom:'4px'}}>{isEn?'Birth club':'待產小組'}</div>
        <div style={{fontSize:'11.5px',color:C.textSub,lineHeight:1.6}}>{isEn?"Set a predicted due date from Account Settings to join your birth-month cohort.":'請於帳戶設定中輸入預產期,以加入您的待產月份小組。'}</div>
      </div>
    </div>
  )

  const cohortLabel = new Date(cohortKey+'-01T00:00:00Z').toLocaleDateString(isEn?'en-HK':'zh-HK',{month:'long',year:'numeric',timeZone:'UTC'})

  return (
    <div style={{padding:'0 16px 24px'}}>
      <div style={{margin:'16px 0',padding:'14px 16px',background:__theme.accentXLight,border:`0.5px solid ${__theme.accentLight}`,borderRadius:'12px'}}>
        <div style={{fontSize:'13px',fontWeight:700,color:__theme.accent,marginBottom:'4px'}}>{isEn?`${cohortLabel} birth club`:`${cohortLabel}待產小組`}</div>
        <div style={{fontSize:'11.5px',color:C.textSub,lineHeight:1.6}}>{isEn?'Everyone due the same month as you, posting anonymously - no real names shown.':'與您同月預產的其他家長,匿名發帖 - 不會顯示真實姓名。'}</div>
      </div>

      <Card style={{padding:'14px 16px',marginBottom:'16px'}}>
        <textarea value={newPost} onChange={e=>setNewPost(e.target.value)} rows={3} placeholder={isEn?"Ask a question or share something with your cohort…":'向您的小組提問或分享…'} style={{width:'100%',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'10px',resize:'none',fontFamily:'inherit'}}/>
        <Btn variant="primary" style={{width:'100%'}} disabled={saving||!newPost.trim()} onClick={addPost}>{isEn?'Post':'發帖'}</Btn>
      </Card>

      {posts.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'No posts yet - be the first in your cohort.':'暫無發帖 - 成為小組第一位發帖者。'}</div>}
      {posts.map(p=>(
        <Card key={p.id} style={{padding:'14px 16px',marginBottom:'10px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
            <span style={{fontSize:'11px',fontWeight:700,color:__theme.accent}}>{pseudonym(p.patient_id)}</span>
            <span style={{fontSize:'10px',color:C.textMuted}}>{new Date(p.created_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})}</span>
            {p.patient_id===patient.id&&<span onClick={()=>deletePost(p.id)} style={{marginLeft:'auto',fontSize:'12px',color:C.textMuted,cursor:'pointer'}}>✕</span>}
          </div>
          <div style={{fontSize:'13px',color:C.text,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{p.body}</div>
          <div onClick={()=>toggleReplies(p.id)} style={{fontSize:'11px',fontWeight:600,color:__theme.accent,marginTop:'8px',cursor:'pointer'}}>{openReplies[p.id]?(isEn?'Hide replies':'隱藏回覆'):(isEn?'Reply / view replies':'回覆／查看回覆')}</div>
          {openReplies[p.id]&&<div style={{marginTop:'8px',paddingTop:'8px',borderTop:`0.5px solid ${C.border}`}}>
            {openReplies[p.id].map(r=>(
              <div key={r.id} style={{marginBottom:'8px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <span style={{fontSize:'10.5px',fontWeight:700,color:__theme.accent}}>{pseudonym(r.patient_id)}</span>
                  <span style={{fontSize:'9.5px',color:C.textMuted}}>{new Date(r.created_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})}</span>
                  {r.patient_id===patient.id&&<span onClick={()=>deleteReply(p.id,r.id)} style={{marginLeft:'auto',fontSize:'11px',color:C.textMuted,cursor:'pointer'}}>✕</span>}
                </div>
                <div style={{fontSize:'12.5px',color:C.text,lineHeight:1.4,marginTop:'2px',whiteSpace:'pre-wrap'}}>{r.body}</div>
              </div>
            ))}
            <div style={{display:'flex',gap:'6px',marginTop:'6px'}}>
              <input value={replyDrafts[p.id]||''} onChange={e=>setReplyDrafts(prev=>({...prev,[p.id]:e.target.value}))} placeholder={isEn?'Write a reply…':'輸入回覆…'} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'7px 10px',fontSize:'12px'}}/>
              <Btn style={{flexShrink:0,padding:'7px 14px',fontSize:'12px'}} disabled={!(replyDrafts[p.id]||'').trim()} onClick={()=>addReply(p.id)}>{isEn?'Send':'傳送'}</Btn>
            </div>
          </div>}
        </Card>
      ))}
    </div>
  )
}

function PrescriptionsScreen({ isEn, medications=[], onNav }) {
  const __theme = useContext(ThemeContext)
  const [drugInfoFor,setDrugInfoFor]=useState(null) // holds {name, effects, intake_info, precautions} | 'loading' | 'none'
  const [drugSearch,setDrugSearch]=useState('')
  const [drugSearchResults,setDrugSearchResults]=useState([])

  async function searchDrugRef(term) {
    if (!term.trim()) { setDrugSearchResults([]); return }
    const { data } = await supabase.from('drug_reference').select('*').ilike('drug_name', `%${term}%`).limit(10)
    setDrugSearchResults(data || [])
  }

  async function showDrugInfo(m) {
    setDrugInfoFor('loading')
    const { data } = await supabase.from('drug_reference').select('*')
      .eq('drug_name', m.medication_name).eq('medicine_type', m.medicine_type||'western').maybeSingle()
    setDrugInfoFor(data || 'none')
  }

  // Refills are no longer their own concept - a patient wanting more of a
  // medication just books a normal consultation, same as any other visit.
  // This replaces the old request/approve/deny flow (which charged a
  // standalone HK$150) with a direct hand-off to Find Care, where a real
  // appointment gets booked against the doctor's actual schedule.
  const hasLiveMeds = medications.length > 0
  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>{isEn?'Active prescriptions':'有效處方'}</SecLabel>
      {(hasLiveMeds ? medications.map((m,idx)=>({
        raw:m,
        name:`${m.medication_name} ${m.dosage||''}`.trim(),
        dose:m.frequency||'As prescribed',
        dr:m.prescribed_by||'—',
        refills:`${m.institution||''} · ${m.start_date?'Since '+new Date(m.start_date).toLocaleDateString('en-HK',{month:'short',year:'numeric'}):''}`.trim().replace(/^·\s*/,''),
        icon:['◉','◈','◇','◎','▣'][idx%5],
        bg:[__theme.accentLight,C.brownLight,C.amberLight,C.blueLight,__theme.accentLight][idx%5],
      })) : []).map((rx,i)=>(
        <Card key={i}>
          <div style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
            <div style={{width:40,height:40,borderRadius:'12px',background:rx.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:__theme.accent,flexShrink:0}}>{rx.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'14px',fontWeight:500}}>{rx.name}</div>
              <div style={{fontSize:'12px',color:C.textSub,marginTop:'2px'}}>{rx.dose}</div>
              <div style={{fontSize:'11px',color:__theme.accent,marginTop:'4px'}}>{rx.dr}</div>
              <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{rx.refills}</div>
            </div>
          </div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'10px 16px',display:'flex',gap:'8px'}}>
            <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>showDrugInfo(rx.raw)}>{isEn?'Drug info':'藥物資訊'}</Btn>
            <Btn variant="primary" style={{flex:1,fontSize:'12px'}} onClick={()=>onNav?.('doctors')}>{isEn?'Book a consultation':'預約診症'}</Btn>
          </div>
        </Card>
      ))}
      {!hasLiveMeds&&<div style={{textAlign:'center',padding:'40px 20px',color:C.textMuted,fontSize:'13px'}}>{isEn?'No active prescriptions on file.':'暫無有效處方記錄。'}</div>}
      <SecLabel>{isEn?'Drug reference':'藥物參考'}</SecLabel>
      <Card style={{padding:'14px 16px'}}>
        <div style={{position:'relative',display:'flex',alignItems:'center'}}>
          <span style={{position:'absolute',left:'10px',fontSize:'16px',color:__theme.accent}}>◎</span>
          <input value={drugSearch} onChange={e=>{setDrugSearch(e.target.value);searchDrugRef(e.target.value)}} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px 10px 34px',fontSize:'13px',background:C.beige,outline:'none'}} placeholder={isEn?'Search any drug name…':'搜尋任何藥物名稱…'}/>
        </div>
        <div style={{fontSize:'12px',color:C.textSub,marginTop:'10px'}}>{isEn?'Check dosage guidance, intake instructions, and precautions on file.':'查看已記錄的劑量指引、服用方法及注意事項。'}</div>
        {drugSearchResults.map(d=>(
          <div key={d.id} onClick={()=>setDrugInfoFor(d)} style={{padding:'8px 0',borderTop:`0.5px solid ${C.border}`,fontSize:'13px',cursor:'pointer'}}>{d.drug_name}</div>
        ))}
        {drugSearch&&drugSearchResults.length===0&&<div style={{fontSize:'12px',color:C.textMuted,marginTop:'8px'}}>{isEn?'No reference on file for this drug yet.':'此藥物暫無記錄。'}</div>}
      </Card>
      {drugInfoFor&&<div onClick={()=>setDrugInfoFor(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:'16px',width:'90%',maxWidth:360,padding:'20px'}}>
          {drugInfoFor==='loading'&&<div style={{textAlign:'center',fontSize:'13px',color:C.textMuted,padding:'20px'}}>{isEn?'Loading...':'載入中...'}</div>}
          {drugInfoFor==='none'&&<div style={{textAlign:'center',fontSize:'13px',color:C.textMuted,padding:'20px'}}>{isEn?'No reference on file for this drug yet.':'此藥物暫無記錄。'}</div>}
          {drugInfoFor&&typeof drugInfoFor==='object'&&<>
            <div style={{fontSize:'15px',fontWeight:700,marginBottom:'12px'}}>{drugInfoFor.drug_name}</div>
            {drugInfoFor.effects&&<div style={{marginBottom:'10px'}}><div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase'}}>{isEn?'Effects':'作用'}</div><div style={{fontSize:'13px'}}>{drugInfoFor.effects}</div></div>}
            {drugInfoFor.intake_info&&<div style={{marginBottom:'10px'}}><div style={{fontSize:'11px',fontWeight:600,color:C.textMuted,textTransform:'uppercase'}}>{isEn?'How to take':'服用方法'}</div><div style={{fontSize:'13px'}}>{drugInfoFor.intake_info}</div></div>}
            {drugInfoFor.precautions&&<div><div style={{fontSize:'11px',fontWeight:600,color:C.red,textTransform:'uppercase'}}>{isEn?'Precautions':'注意事項'}</div><div style={{fontSize:'13px'}}>{drugInfoFor.precautions}</div></div>}
          </>}
          <Btn style={{width:'100%',marginTop:'16px'}} onClick={()=>setDrugInfoFor(null)}>{isEn?'Close':'關閉'}</Btn>
        </div>
      </div>}
    </div>
  )
}

function EditProfileScreen({ isEn, patient={}, onSaved, onSignOut }) {
  const __theme = useContext(ThemeContext)
  const [contact,setContact]=useState({
    name: patient.emergency_contact_name||'', rel: patient.emergency_contact_rel||'', phone: patient.emergency_contact_phone||'',
  })
  const [savingContact,setSavingContact]=useState(false)
  const [contactSaved,setContactSaved]=useState(false)

  // Defaults to on for email (matches every confirmation this app
  // already sends real email for elsewhere - forgot-password OTP,
  // sponsor submissions). SMS has no provider connected yet (would
  // need Twilio or similar) so it stays off and disabled rather than
  // offering a toggle that can't actually do anything.
  const [notifyEmail,setNotifyEmail]=useState(patient.notify_email !== false)
  const [savingNotify,setSavingNotify]=useState(false)
  async function handleToggleNotifyEmail() {
    const next = !notifyEmail
    setNotifyEmail(next)
    setSavingNotify(true)
    await supabase.from('patients').update({ notify_email: next }).eq('id', patient.id)
    setSavingNotify(false)
    onSaved?.()
  }

  // Default on for everyone (patients table default), one standing
  // setting instead of a checkbox re-asked on every single plan
  // declaration - PlanDetailFlow.jsx and the "Find me a plan" flow both
  // now read this instead of showing their own consent checkbox. Off
  // never hides any plan from a patient - it only stops the matching
  // engine from folding their on-platform visit history into the
  // suitability check, so matching falls back to declared answers alone.
  const [historyMatchingEnabled,setHistoryMatchingEnabled]=useState(patient.history_matching_enabled !== false)
  const [savingHistoryMatching,setSavingHistoryMatching]=useState(false)
  async function handleToggleHistoryMatching() {
    const next = !historyMatchingEnabled
    setHistoryMatchingEnabled(next)
    setSavingHistoryMatching(true)
    await supabase.from('patients').update({ history_matching_enabled: next }).eq('id', patient.id)
    setSavingHistoryMatching(false)
    onSaved?.()
  }

  const [myAllergies,setMyAllergies]=useState([])
  const [loadingAllergies,setLoadingAllergies]=useState(true)
  const [newAllergen,setNewAllergen]=useState('')
  const [newSeverity,setNewSeverity]=useState('')
  const [savingAllergy,setSavingAllergy]=useState(false)

  async function loadMyAllergies() {
    if (!patient.id) return
    setLoadingAllergies(true)
    const { data } = await supabase.from('allergies').select('*').eq('patient_id', patient.id)
    setMyAllergies(data||[])
    setLoadingAllergies(false)
  }
  useEffect(() => { loadMyAllergies() }, [patient.id])

  async function handleSaveContact() {
    setSavingContact(true)
    await supabase.from('patients').update({
      emergency_contact_name: contact.name||null,
      emergency_contact_rel: contact.rel||null,
      emergency_contact_phone: contact.phone||null,
    }).eq('id', patient.id)
    setSavingContact(false)
    setContactSaved(true)
    onSaved?.()
  }

  async function handleAddAllergy() {
    if (!newAllergen.trim()) return
    setSavingAllergy(true)
    await supabase.from('allergies').insert({
      patient_id: patient.id, allergen: newAllergen, severity: newSeverity||null,
      reported_by: 'patient_reported',
    })
    setNewAllergen(''); setNewSeverity('')
    setSavingAllergy(false)
    loadMyAllergies()
    onSaved?.()
  }

  async function handleRemoveAllergy(id) {
    await supabase.from('allergies').delete().eq('id', id)
    loadMyAllergies()
    onSaved?.()
  }

  return (
    <div style={{background:C.beige,flex:1,padding:'0 16px 24px'}}>
      <SecLabel>{isEn?'Emergency contact':'緊急聯絡人'}</SecLabel>
      <Card style={{padding:'16px',marginBottom:'20px'}}>
        <input value={contact.name} onChange={e=>{setContact({...contact,name:e.target.value});setContactSaved(false)}} placeholder={isEn?'Name':'姓名'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}/>
        <input value={contact.rel} onChange={e=>{setContact({...contact,rel:e.target.value});setContactSaved(false)}} placeholder={isEn?'Relationship (e.g. Mother)':'關係（例如：母親）'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}/>
        <input value={contact.phone} onChange={e=>{setContact({...contact,phone:e.target.value});setContactSaved(false)}} placeholder={isEn?'Phone number':'電話號碼'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box'}}/>
        <Btn variant="primary" style={{width:'100%'}} onClick={handleSaveContact} disabled={savingContact}>{savingContact?'Saving…':contactSaved?'✓ Saved':(isEn?'Save':'儲存')}</Btn>
      </Card>

      <SecLabel>{isEn?'Notifications':'通知'}</SecLabel>
      <Card style={{padding:'16px',marginBottom:'20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:500}}>{isEn?'Email confirmations':'電郵確認'}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{isEn?'Booking confirmations and updates sent to your email':'預約確認及更新將發送至您的電郵'}</div>
          </div>
          <Toggle checked={notifyEmail} onChange={handleToggleNotifyEmail} disabled={savingNotify}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',opacity:0.5}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:500}}>{isEn?'Text (SMS) confirmations':'短訊確認'}</div>
            <div style={{fontSize:'11px',color:C.textSub}}>{isEn?'Not connected yet - coming once Medsa has an SMS provider':'尚未連接 - Medsa 接入短訊服務後開放'}</div>
          </div>
          <Toggle checked={false} onChange={()=>{}} disabled/>
        </div>
      </Card>

      <SecLabel>{isEn?'Plan matching':'方案配對'}</SecLabel>
      <Card style={{padding:'16px',marginBottom:'20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:500}}>{isEn?'Use my visit history to help match plans':'使用我的就診記錄協助配對方案'}</div>
            <div style={{fontSize:'11px',color:C.textSub,lineHeight:1.5}}>{isEn?"On by default. When on, your own on-platform visit history is folded into checking which plans suit you - it can only ever flag something for an underwriter to double check, never auto-decline you on its own. Off, matching uses only what you declare yourself. Either way, no insurer or agent ever sees your raw visit history - only the verdict it produces.":'預設開啟。開啟時，您在平台上的就診記錄會用於核對哪些方案適合您 - 最多只會標記予核保員再次核實，絕不會據此自動拒保。關閉後，配對只會根據您自行申報的內容。無論開關，保險公司或代理均不會看到您的原始就診記錄 - 只會看到配對結果。'}</div>
          </div>
          <Toggle checked={historyMatchingEnabled} onChange={handleToggleHistoryMatching} disabled={savingHistoryMatching}/>
        </div>
      </Card>

      <MedsaBumpSection isEn={isEn} patient={patient}/>

      <SecLabel>{isEn?'My allergies':'我的過敏'}</SecLabel>
      <div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',fontSize:'11px',color:C.amber,lineHeight:1.5}}>
        {isEn?"Allergies you add here are self-reported by you, not confirmed by a clinician - they're clearly labelled as such wherever shown, including on your emergency card.":'您在此新增的過敏為自行申報，並非由醫護人員確認 - 於所有顯示位置（包括緊急卡）均會清楚標示。'}
      </div>
      {loadingAllergies&&<div style={{textAlign:'center',fontSize:'12px',color:C.textMuted,padding:'10px'}}>{isEn?'Loading…':'載入中…'}</div>}
      {!loadingAllergies&&myAllergies.map(a=>(
        <Card key={a.id} style={{padding:'10px 14px',marginBottom:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:'13px',fontWeight:600}}>{a.allergen}{a.severity?` — ${a.severity}`:''}</div>
            <span style={{fontSize:'10px',padding:'1px 7px',borderRadius:'20px',background:a.reported_by==='patient_reported'?C.amberLight:__theme.accentLight,color:a.reported_by==='patient_reported'?C.amber:__theme.accent,fontWeight:600}}>
              {a.reported_by==='patient_reported'?(isEn?'Self-reported':'自行申報'):(isEn?'Clinically confirmed':'臨床確認')}
            </span>
          </div>
          {a.reported_by==='patient_reported'&&<span onClick={()=>handleRemoveAllergy(a.id)} style={{fontSize:'12px',color:C.red,cursor:'pointer'}}>{isEn?'Remove':'移除'}</span>}
        </Card>
      ))}
      <Card style={{padding:'14px',marginTop:'10px'}}>
        <input value={newAllergen} onChange={e=>setNewAllergen(e.target.value)} placeholder={isEn?'Allergen (e.g. Penicillin)':'過敏原（例如：青黴素）'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'8px',boxSizing:'border-box'}}/>
        <input value={newSeverity} onChange={e=>setNewSeverity(e.target.value)} placeholder={isEn?'Severity (optional, e.g. Severe)':'嚴重程度（選填，例如：嚴重）'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'10px',boxSizing:'border-box'}}/>
        <Btn variant="primary" style={{width:'100%'}} onClick={handleAddAllergy} disabled={savingAllergy||!newAllergen.trim()}>{savingAllergy?'Adding…':(isEn?'+ Add allergy':'+ 新增過敏')}</Btn>
      </Card>

      {onSignOut&&<div style={{margin:'24px 16px 0',textAlign:'center'}}>
        <span onClick={onSignOut} style={{fontSize:'13px',color:C.red,cursor:'pointer'}}>{isEn?'Sign out':'登出'}</span>
      </div>}
    </div>
  )
}

// ── MEDSA BUMP (account settings entry point) ──────────────────────────────
// Pink, per the brand note. Lives under Account Settings, pays directly to
// Medsa via Stripe (this is Medsa's own revenue - not an insurance premium,
// which is bank transfer between agent/insurer and out of scope here), and
// starts right away on payment, during pregnancy rather than after birth -
// predicted due date and how far along the patient is are collected up
// front so there's something to track against immediately.
// Your call - a flat "upload a check-up" pile made a specialist report
// (an OB-GYN ultrasound, a referral from a cardiologist for a high-risk
// pregnancy, etc.) indistinguishable from a routine check-up. Stored as a
// distinct medical_record_attachments.category value per type - that
// column already exists and is already used this way (birth_certificate,
// dependent_relationship_doc), so this is just more values on the same
// mechanism, not a schema change.
const BUMP_DOC_TYPES = [
  { value: 'bump_general_checkup', label: { en: 'General check-up', zh: '一般檢查' } },
  { value: 'bump_scan', label: { en: 'Ultrasound / scan', zh: '超聲波/掃描' } },
  { value: 'bump_specialist_report', label: { en: 'Specialist report / referral', zh: '專科報告/轉介' } },
  { value: 'bump_lab_result', label: { en: 'Lab result', zh: '化驗結果' } },
]

// Weekly "baby is about the size of a ___" card - pure fun content, no
// clinical stakes (unlike the WHO growth charts, getting a comparison
// slightly off has zero health consequence), same convention every major
// pregnancy app uses. Text + an emoji instead of a real 3D/illustrated
// asset - see the checklist note this came from: that gets most of the
// engagement value without a licensed art pipeline Medsa doesn't have.
const WEEKLY_SIZE_COMPARISONS = {
  4:{emoji:'🌱',en:'a poppy seed',zh:'一顆罌粟籽'}, 5:{emoji:'🌱',en:'a sesame seed',zh:'一顆芝麻'},
  6:{emoji:'🫘',en:'a lentil',zh:'一顆扁豆'}, 7:{emoji:'🫐',en:'a blueberry',zh:'一顆藍莓'},
  8:{emoji:'🍓',en:'a raspberry',zh:'一顆紅莓'}, 9:{emoji:'🍇',en:'a grape',zh:'一顆葡萄'},
  10:{emoji:'🍊',en:'a kumquat',zh:'一顆金橘'}, 11:{emoji:'🍇',en:'a fig',zh:'一顆無花果'},
  12:{emoji:'🍋',en:'a lime',zh:'一顆青檬'}, 13:{emoji:'🍋',en:'a lemon',zh:'一顆檸檬'},
  14:{emoji:'🍑',en:'a peach',zh:'一顆桃子'}, 15:{emoji:'🍎',en:'an apple',zh:'一顆蘋果'},
  16:{emoji:'🥑',en:'an avocado',zh:'一顆牛油果'}, 17:{emoji:'🥔',en:'a turnip',zh:'一顆蕪菁'},
  18:{emoji:'🫑',en:'a bell pepper',zh:'一個甜椒'}, 19:{emoji:'🍅',en:'a tomato',zh:'一顆番茄'},
  20:{emoji:'🍌',en:'a banana',zh:'一條香蕉'}, 21:{emoji:'🥕',en:'a carrot',zh:'一條紅蘿蔔'},
  22:{emoji:'🥭',en:'a papaya',zh:'一個木瓜'}, 23:{emoji:'🍈',en:'a grapefruit',zh:'一個葡萄柚'},
  24:{emoji:'🌽',en:'an ear of corn',zh:'一條玉米'}, 25:{emoji:'🥦',en:'a head of cauliflower',zh:'一個椰菜花'},
  26:{emoji:'🥬',en:'a head of lettuce',zh:'一個生菜'}, 27:{emoji:'🥥',en:'a rutabaga',zh:'一顆蕪菁甘藍'},
  28:{emoji:'🍆',en:'an eggplant',zh:'一條茄子'}, 29:{emoji:'🎃',en:'a butternut squash',zh:'一個南瓜'},
  30:{emoji:'🥬',en:'a cabbage',zh:'一個椰菜'}, 31:{emoji:'🥥',en:'a coconut',zh:'一個椰子'},
  32:{emoji:'🥥',en:'a jicama',zh:'一個涼薯'}, 33:{emoji:'🍍',en:'a pineapple',zh:'一個菠蘿'},
  34:{emoji:'🍈',en:'a cantaloupe',zh:'一個哈密瓜'}, 35:{emoji:'🍈',en:'a honeydew melon',zh:'一個蜜瓜'},
  36:{emoji:'🥬',en:'a head of romaine lettuce',zh:'一個羅馬生菜'}, 37:{emoji:'🥬',en:'a bunch of swiss chard',zh:'一束瑞士菜'},
  38:{emoji:'🥬',en:'a leek',zh:'一條韭蔥'}, 39:{emoji:'🍉',en:'a mini watermelon',zh:'一個小西瓜'},
  40:{emoji:'🎃',en:'a small pumpkin',zh:'一個小南瓜'},
}
function weeklySizeComparison(gestationalWeek) {
  const w = Math.max(4, Math.min(40, Math.round(gestationalWeek)))
  return WEEKLY_SIZE_COMPARISONS[w]
}

function MedsaBumpSection({ isEn, patient }) {
  const [activeBump,setActiveBump]=useState(undefined) // undefined=loading, null=none, object=active
  const [dueDate,setDueDate]=useState('')
  const [weeksNow,setWeeksNow]=useState('')
  const [discoveredAt,setDiscoveredAt]=useState('')
  const [checkupFiles,setCheckupFiles]=useState([])
  const [docType,setDocType]=useState('bump_general_checkup')
  const [uploading,setUploading]=useState(false)
  const [starting,setStarting]=useState(false)
  const [error,setError]=useState(null)
  const [recordingBirth,setRecordingBirth]=useState(false)
  const [birthForm,setBirthForm]=useState({dob:'',fullName:''})
  const [savingBirth,setSavingBirth]=useState(false)
  const [birthDobError,setBirthDobError]=useState(false)
  const twoYearsAgoStr = (() => { const d=new Date(); d.setFullYear(d.getFullYear()-2); return d.toISOString().slice(0,10) })()
  const [graduationNotice,setGraduationNotice]=useState(null) // holds the new Kids profile just created, if graduation just ran

  // Checkout verification on return (session_id from Stripe, webhook
  // confirmed unreliable elsewhere in this app) now happens once at the
  // PatientApp root, the moment the page loads back from Stripe - not
  // here. This section only ever mounts once the patient navigates into
  // Account Settings, which could be well after that redirect (React
  // state resets to the Home screen on that fresh page load), so the old
  // approach of verifying here meant a real payment could sit
  // unconfirmed until they happened to click back into this exact
  // screen. Simple mount-time load is enough now - by the time this
  // renders, the root has already verified and written the real row.
  async function loadBump() {
    if (!patient?.id) { setActiveBump(null); return }
    const { data } = await supabase.from('bump_subscriptions').select('*').eq('patient_id', patient.id).is('graduated_at', null).order('created_at',{ascending:false}).limit(1).maybeSingle()
    // Two separate timers, decoupled on your call: the CHILD graduates to
    // their own Medsa Kids profile immediately once a birth is on file -
    // matching how every benchmarked app (BabyCenter/Ovia/etc.) hands a
    // baby's own feeding/diaper/growth tracking off right at birth, not
    // months later. The Bump PASS itself stays open for 12 months
    // postpartum for the MOTHER's own tools (BP monitoring, recovery
    // checklist) - that's graduated_at below, unrelated to the child fork.
    if (data?.child_dob && !data.child_graduated_at) { await graduateChildToKids(data); return }
    if (data?.child_dob) {
      const monthsSinceBirth = (Date.now() - new Date(data.child_dob)) / (1000*60*60*24*30.44)
      if (monthsSinceBirth >= 12) { await closeBumpPass(data); return }
    }
    setActiveBump(data||null)
  }
  useEffect(() => { loadBump() }, [patient?.id])

  // Forks the baby's own Medsa Kids profile - now fires immediately once
  // a birth is recorded, not waiting 12 months. Sets child_graduated_at
  // only; graduated_at (the whole Bump pass closing) is separate, see
  // closeBumpPass below.
  async function graduateChildToKids(bump) {
    const medsaId = 'MDS-' + Math.floor(10000+Math.random()*89999) + '-HK'
    const { data: child } = await supabase.from('patients').insert({
      medsa_id: medsaId, full_name: bump.child_full_name || (isEn?'Baby':'寶寶'), date_of_birth: bump.child_dob,
      account_type: 'kids', parent_patient_id: patient.id, registration_path: 'bump_graduation', dependent_relationship: 'child',
    }).select().maybeSingle()
    if (child) {
      await supabase.from('bump_subscriptions').update({ child_graduated_at: new Date().toISOString(), graduated_child_patient_id: child.id }).eq('id', bump.id)
      setGraduationNotice(child)
    }
    await loadBump()
  }

  // Closes the Bump pass itself, 12 months after birth - the end of the
  // postpartum window this pass tracks the mother's own recovery through.
  // The child graduated separately, immediately at birth (see above).
  async function closeBumpPass(bump) {
    await supabase.from('bump_subscriptions').update({ graduated_at: new Date().toISOString() }).eq('id', bump.id)
    await loadBump()
  }

  // Real bug found live-testing: the date input had a `max` (no future
  // birthdays) but no floor, so a mistyped/short year (e.g. "0006" instead
  // of "2026") sailed straight through as a valid date. Downstream,
  // monthsSinceBirth treats that as ~2000 years postpartum and instantly
  // fires the 12-month pass closure - silently locking the parent out of
  // Bump with no error shown. Guarding here, not just the input's `min`,
  // since this field is also reachable without the picker.
  function recordBirth() {
    if (!activeBump?.id || !birthForm.dob) return
    const dob = new Date(birthForm.dob)
    const twoYearsAgo = new Date(); twoYearsAgo.setFullYear(twoYearsAgo.getFullYear()-2)
    if (dob < twoYearsAgo || dob > new Date()) { setBirthDobError(true); return }
    setBirthDobError(false)
    return (async () => {
      setSavingBirth(true)
      await supabase.from('bump_subscriptions').update({ child_dob: birthForm.dob, child_full_name: birthForm.fullName||null }).eq('id', activeBump.id)
      setSavingBirth(false); setRecordingBirth(false)
      await loadBump()
    })()
  }

  async function uploadCheckup(file) {
    if (!file || !patient?.id) return
    setUploading(true)
    const path = `${patient.medsa_id || patient.id}/bump-checkup-${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('patient-uploaded-records').upload(path, file)
    if (upErr) { setUploading(false); return }
    const { data: newAtt } = await supabase.from('medical_record_attachments').insert({
      patient_id: patient.id, category: docType, file_url: path, file_name: file.name, verification_status: 'unverified',
    }).select().maybeSingle()
    setUploading(false)
    if (newAtt) setCheckupFiles(prev => [...prev, newAtt])
  }

  async function handleStart() {
    setStarting(true); setError(null)
    try {
      const res = await fetch('/api/patient/create_bump_checkout', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ patientId: patient.id, predictedDueDate: dueDate||null, gestationalWeeksAtSignup: weeksNow?Number(weeksNow):null, discoveredPregnantAt: discoveredAt||null }),
      })
      const data = await res.json()
      if (data.status==='CREATED' && data.paymentUrl) { window.location.href = data.paymentUrl; return }
      setError(data.message || (isEn?'Could not start checkout.':'無法啟動付款程序。'))
    } catch {
      setError(isEn?'Could not reach the server - try again.':'無法連接伺服器,請重試。')
    }
    setStarting(false)
  }

  // Real feedback: "Medsa Bump" was a small grey label floating above the
  // card, same treatment as every other section - but Bump is the one
  // thing on this screen with its own brand color, so it should look like
  // it, not blend in. A bold gradient card with a real white title inside
  // (same shape as the Home screen's hero card) instead of a plain pale
  // card with a tiny grey heading above it.
  const bumpGradient = 'linear-gradient(135deg,#F48FB1 0%,#F8BBD0 100%)'

  const graduationBanner = graduationNotice && (
    <div style={{margin:'0 0 16px',padding:'14px 16px',background:'#FFF3CD',border:'0.5px solid #FEF3E2',borderRadius:'10px'}}>
      <div style={{fontSize:'13px',fontWeight:700,color:'#B8860B',marginBottom:'4px'}}>🎉 {isEn?`${graduationNotice.full_name} just graduated to Medsa Kids!`:`${graduationNotice.full_name}已轉入Medsa Kids!`}</div>
      <div style={{fontSize:'11.5px',color:C.textSub,lineHeight:1.6}}>{isEn?"Their own profile (growth, feeding, records) is ready - switch to it from your profile icon. Your Bump pass stays open for your own postpartum recovery tracking for the next 12 months.":'他們的個人檔案(生長、餵養、記錄)已就緒 - 可從個人圖示切換。您的Medsa Bump將繼續用於追蹤您未來12個月的產後復原狀況。'}</div>
    </div>
  )

  if (activeBump===undefined) return (
    <Card style={{padding:'16px',marginBottom:'20px'}}><div style={{fontSize:'12px',color:C.textMuted}}>{isEn?'Loading…':'載入中…'}</div></Card>
  )

  if (activeBump) {
    // 40 weeks is the standard due-date convention - computed fresh from
    // predicted_due_date rather than carried forward from gestational_
    // weeks_at_signup, so it stays current regardless of how long ago
    // Bump was actually started.
    const weeksUntilDue = activeBump.predicted_due_date ? Math.ceil((new Date(activeBump.predicted_due_date) - new Date()) / (7*24*60*60*1000)) : null
    const gestationalWeek = weeksUntilDue!=null ? 40-weeksUntilDue : null
    const sizeComparison = gestationalWeek!=null ? weeklySizeComparison(gestationalWeek) : null
    const monthsOld = activeBump.child_dob ? Math.floor((Date.now() - new Date(activeBump.child_dob)) / (1000*60*60*24*30.44)) : null
    return (<>
    {graduationBanner}
    <Card style={{padding:'20px',marginBottom:'20px',background:bumpGradient,border:'none'}}>
      <div style={{fontSize:'19px',fontWeight:700,color:'#fff',marginBottom:'2px'}}>Medsa Bump</div>
      <div style={{fontSize:'13px',fontWeight:700,color:'#fff',opacity:0.95,marginBottom:'10px'}}>{isEn?'Active':'已啟用'}</div>
      <div style={{fontSize:'12px',color:'rgba(255,255,255,0.85)',lineHeight:1.6}}>
        {isEn?'Started':'開始於'} {new Date(activeBump.started_at).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}
        {!activeBump.child_dob&&activeBump.predicted_due_date&&<><br/>{isEn?'Predicted due date':'預產期'}: {new Date(activeBump.predicted_due_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}</>}
        {activeBump.child_dob&&<><br/>{isEn?'Born':'出生於'} {new Date(activeBump.child_dob).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}{activeBump.child_full_name?` (${activeBump.child_full_name})`:''}</>}
      </div>

      {!activeBump.child_dob&&sizeComparison&&<div style={{marginTop:'14px',background:'rgba(255,255,255,0.2)',borderRadius:'10px',padding:'12px 14px',display:'flex',alignItems:'center',gap:'10px'}}>
        <span style={{fontSize:'26px'}}>{sizeComparison.emoji}</span>
        <div>
          <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)'}}>{isEn?`Week ${gestationalWeek}`:`第${gestationalWeek}週`}</div>
          <div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>{isEn?`Your baby is about the size of ${sizeComparison.en}`:`您的寶寶現時大約是${sizeComparison.zh}的大小`}</div>
        </div>
      </div>}

      {/* Postpartum (4th trimester) state - the real gap found building
          this: nothing ever actually recorded a birth, so child_dob sat
          unused and the 12-month graduation this depends on could never
          fire. This is that missing step. */}
      {!activeBump.child_dob&&!recordingBirth&&<div onClick={()=>setRecordingBirth(true)} style={{marginTop:'14px',fontSize:'12px',color:'#fff',textDecoration:'underline',cursor:'pointer'}}>{isEn?'👶 Baby arrived? Record the birth':'👶 寶寶已出生?記錄出生資料'}</div>}
      {!activeBump.child_dob&&recordingBirth&&<div style={{marginTop:'14px',background:'rgba(255,255,255,0.15)',borderRadius:'10px',padding:'14px'}}>
        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)',marginBottom:'4px'}}>{isEn?"Baby's date of birth":'寶寶出生日期'}</div>
        <input type="date" value={birthForm.dob} min={twoYearsAgoStr} max={new Date().toISOString().slice(0,10)} onChange={e=>{setBirthForm({...birthForm,dob:e.target.value}); setBirthDobError(false)}} style={{width:'100%',border:'none',borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'10px',background:'#fff'}}/>
        {birthDobError&&<div style={{fontSize:'11px',color:'#fff',background:'rgba(200,0,0,0.3)',borderRadius:'6px',padding:'7px 10px',marginBottom:'10px'}}>{isEn?"That doesn't look like a valid birth date - please check the year.":'出生日期看來不正確 - 請檢查年份。'}</div>}
        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)',marginBottom:'4px'}}>{isEn?"Baby's full name (optional, can add later)":'寶寶全名(可選,可稍後補充)'}</div>
        <input value={birthForm.fullName} onChange={e=>setBirthForm({...birthForm,fullName:e.target.value})} style={{width:'100%',border:'none',borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'10px',background:'#fff'}}/>
        <Btn style={{width:'100%',background:'#fff',color:'#F48FB1'}} disabled={savingBirth||!birthForm.dob} onClick={recordBirth}>{savingBirth?(isEn?'Saving…':'儲存中…'):(isEn?'Save':'儲存')}</Btn>
      </div>}
      {activeBump.child_dob&&monthsOld!=null&&<div style={{marginTop:'14px',background:'rgba(255,255,255,0.2)',borderRadius:'10px',padding:'12px 14px'}}>
        <div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>{isEn?`${monthsOld} month${monthsOld===1?'':'s'} postpartum`:`產後${monthsOld}個月`}</div>
        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)',marginTop:'2px'}}>{isEn?`Their own Medsa Kids profile is already set up. This Bump pass stays open for your own recovery tracking until 12 months postpartum${monthsOld<12?` - ${12-monthsOld} to go`:''}.`:`寶寶的Medsa Kids個人檔案已設立。此Medsa Bump將持續追蹤您的產後復原狀況,直至產後12個月${monthsOld<12?` - 還差${12-monthsOld}個月`:''}。`}</div>
      </div>}
    </Card>
    </>)}

  return (<>
    {graduationBanner}
    <Card style={{padding:'20px',marginBottom:'20px',background:bumpGradient,border:'none'}}>
      <div style={{fontSize:'19px',fontWeight:700,color:'#fff',marginBottom:'10px'}}>Medsa Bump</div>
      <div style={{fontSize:'12px',color:'rgba(255,255,255,0.9)',lineHeight:1.6,marginBottom:'8px'}}>
        {isEn?"Maternal care tracking through pregnancy and 12 months postpartum - your baby gets their own Medsa Kids profile right at birth.":'由懷孕期至產後12個月的孕產照護追蹤 - 寶寶出生後將立即擁有自己的Medsa Kids個人檔案。'}
      </div>
      {/* Real gap: the actual Stripe charge is the quoted price grossed up
          to cover the card processing fee (see lib/paymentFees.js) - the
          patient was never told this anywhere before reaching Stripe's own
          checkout page, where a non-round total (e.g. HK$921.69 for a
          quoted HK$888) looked like an unexplained discrepancy rather than
          a disclosed fee. */}
      <div style={{fontSize:'12px',color:'#fff',fontWeight:600,marginBottom:'2px'}}>{isEn?'HK$888 one-time':'一次性HK$888'}</div>
      <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)',lineHeight:1.5,marginBottom:'14px'}}>
        {isEn?"HK$710.40 automatically if you've used Medsa Bump before. A card processing fee is added at checkout, so the total shown on the payment page will be slightly higher - that's expected, not an extra charge.":'如曾使用Medsa Bump,將自動收取HK$710.40。付款頁面會額外加上信用卡手續費,因此總金額會略高 - 這是正常現象,並非額外收費。'}
      </div>
      <div style={{background:'rgba(255,255,255,0.15)',borderRadius:'10px',padding:'14px'}}>
        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)',marginBottom:'4px'}}>{isEn?'Predicted due date':'預產期'}</div>
        <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={{width:'100%',border:'none',borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'10px',background:'#fff'}}/>
        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)',marginBottom:'4px'}}>{isEn?'How many weeks pregnant are you now? (optional)':'現時懷孕多少週?(可選)'}</div>
        <input type="number" value={weeksNow} onChange={e=>setWeeksNow(e.target.value)} placeholder={isEn?'e.g. 12':'例如:12'} style={{width:'100%',border:'none',borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'10px',background:'#fff'}}/>
        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)',marginBottom:'4px'}}>{isEn?'When did you find out you were pregnant? (optional)':'您何時發現懷孕?(可選)'}</div>
        <input type="date" value={discoveredAt} onChange={e=>setDiscoveredAt(e.target.value)} style={{width:'100%',border:'none',borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'12px',background:'#fff'}}/>

        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.85)',marginBottom:'4px'}}>{isEn?'Upload any existing check-ups (optional)':'上傳現有檢查報告(可選)'}</div>
        <select value={docType} onChange={e=>setDocType(e.target.value)} style={{width:'100%',border:'none',borderRadius:'8px',padding:'9px 12px',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px',background:'#fff'}}>
          {BUMP_DOC_TYPES.map(t=><option key={t.value} value={t.value}>{isEn?t.label.en:t.label.zh}</option>)}
        </select>
        <label style={{display:'block'}}>
          <div style={{textAlign:'center',border:'1px dashed rgba(255,255,255,0.5)',borderRadius:'8px',padding:'10px',cursor:uploading?'default':'pointer',fontSize:'12px',opacity:uploading?0.6:1,marginBottom:'8px',color:'#fff'}}>{uploading?(isEn?'Uploading…':'上傳中…'):(isEn?'+ Upload this document':'+ 上傳此文件')}</div>
          <input type="file" style={{display:'none'}} disabled={uploading} onChange={e=>{const f=e.target.files?.[0]; e.target.value=''; if(f) uploadCheckup(f)}}/>
        </label>
        {checkupFiles.length>0&&<div style={{marginBottom:'12px'}}>
          {checkupFiles.map(f=>{
            const t = BUMP_DOC_TYPES.find(t=>t.value===f.category)
            return <div key={f.id} style={{fontSize:'11px',color:'rgba(255,255,255,0.85)',padding:'4px 0'}}>📄 {f.file_name}{t?` — ${isEn?t.label.en:t.label.zh}`:''}</div>
          })}
        </div>}

        {error&&<div style={{fontSize:'12px',color:'#ffcdd2',marginBottom:'8px'}}>{error}</div>}
        <Btn style={{width:'100%',background:'#fff',color:'#F48FB1'}} disabled={starting} onClick={handleStart}>{starting?(isEn?'Starting…':'啟動中…'):(isEn?'Start Medsa Bump':'開始 Medsa Bump')}</Btn>
      </div>
    </Card>
  </>)
}

// ── SIGN-UP GATE — two paths into Medsa ──────────────────────────────────────
// Path A: a clinic already created a placeholder profile (CSV import or
// manual registration). A claim code sent only to the phone/email the
// CLINIC already had on file proves the real patient is claiming it.
// Path B: no institution record exists yet. Since there's no prior anchor,
// this requires document + liveness verification instead.
function LoginFlow({ onBack, onComplete }) {
  const __theme = useContext(ThemeContext)
  const [hkid,setHkid]=useState('')
  const [phone,setPhone]=useState('')
  const [error,setError]=useState(null)
  const [checking,setChecking]=useState(false)

  async function handleLogin() {
    setChecking(true)
    setError(null)
    // A real account is either claimed (came from a clinic record) or
    // self-registered - self-registered accounts never set claimed_at,
    // so filtering on that alone (as this used to) meant someone who
    // registered directly could never log back in at all.
    const { data, error: qErr } = await supabase.from('patients').select('*')
      .eq('hkid', hkid).eq('phone', phone)
      .or('claimed_at.not.is.null,registration_path.eq.self_registered')
      .maybeSingle()
    setChecking(false)
    if (qErr || !data) { setError('No account matches that HKID and phone number.'); return }
    onComplete(data)
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div onClick={onBack} style={{fontSize:'13px',color:__theme.accent,cursor:'pointer',marginBottom:'16px'}}>{'\u2190'} Back</div>
        <div style={{fontSize:'18px',fontWeight:700,marginBottom:'6px'}}>Log back in</div>
        <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'20px',lineHeight:1.5}}>{'\u25c7'} This checks your HKID and phone against your claimed record - a real production version would use a proper password or SMS one-time code instead of this alone.</div>
        <input value={hkid} onChange={e=>setHkid(e.target.value)} placeholder="HKID" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'10px',boxSizing:'border-box'}}/>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone number on file" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'11px 14px',fontSize:'14px',marginBottom:'16px',boxSizing:'border-box'}}/>
        {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'12px'}}>{error}</div>}
        <Btn variant="primary" style={{width:'100%'}} onClick={handleLogin} disabled={checking||!hkid||!phone}>{checking?'Checking…':'Log in'}</Btn>
      </div>
    </div>
  )
}

// ── PROFILE SWITCHER (Instagram-style) ──────────────────────────────────────
// Clicking your own profile icon shows every profile switchable from this
// login: yourself plus any dependent linked under you (patients.
// parent_patient_id) - a child, parent, elderly relative, or anyone else
// you're the caretaker of, all stored the same way (account_type still
// says 'kids' under the hood; dependent_relationship is what actually
// says who they are). Switching just re-points signedInPatient at a
// different real row - everything downstream already keys off its id, no
// separate "active profile" concept needed. The managing adult is derived
// from whichever profile is currently active (itself, if it's the top-
// level account, or its parent_patient_id if it's a dependent), so this
// works correctly even mid-session as a different profile.
function ProfileSwitcherModal({ open, onClose, activePatient, onSwitch, onAddChild, onOpenSettings, onOpenEmergency }) {
  const __theme = useContext(ThemeContext)
  const [profiles,setProfiles]=useState([])
  const [managingAdult,setManagingAdult]=useState(null)
  const [loading,setLoading]=useState(true)
  const [subscribing,setSubscribing]=useState(false)
  const [subscribeError,setSubscribeError]=useState(null)

  useEffect(() => {
    if (!open || !activePatient?.id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const adultId = activePatient.account_type==='kids' ? activePatient.parent_patient_id : activePatient.id
      const [{ data: adult }, { data: kids }] = await Promise.all([
        supabase.from('patients').select('*').eq('id', adultId).maybeSingle(),
        supabase.from('patients').select('*').eq('parent_patient_id', adultId).order('created_at',{ascending:true}),
      ])
      if (cancelled) return
      setManagingAdult(adult||null)
      setProfiles([adult, ...(kids||[])].filter(Boolean))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [open, activePatient?.id])

  if (!open) return null
  // Real-time check, not just "was Guardian active when this kid was
  // added" - a lapsed subscription actually locks access to any kid
  // beyond the first free one, re-checked every time this opens. Same
  // active+expiry combination already used elsewhere in this app for a
  // paid add-on (see claims_plugin_enabled/_expires_at in medsa-admin.jsx).
  const today = new Date().toISOString().slice(0,10)
  const guardianActive = !!managingAdult?.guardian_subscription_active && (!managingAdult?.guardian_subscription_expires_at || managingAdult.guardian_subscription_expires_at >= today)
  // Index 0 is always the adult, free. Index 1 (the first linked kid) is
  // free too. Anything beyond that needs an active Guardian subscription
  // right now, not just at the moment it was added.
  const isLocked = (idx) => idx >= 2 && !guardianActive
  const canAddFree = profiles.length <= 1

  async function handleSubscribeGuardian() {
    if (!managingAdult?.id) return
    setSubscribing(true); setSubscribeError(null)
    try {
      const res = await fetch('/api/patient/create_guardian_checkout', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ patientId: managingAdult.id }),
      })
      const data = await res.json()
      if (data.status==='CREATED' && data.paymentUrl) { window.location.href = data.paymentUrl; return }
      setSubscribeError(data.message || 'Could not start checkout.')
    } catch {
      setSubscribeError('Could not reach the server - try again.')
    }
    setSubscribing(false)
  }

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:50,display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'20px 16px 24px',width:'100%',maxWidth:440,margin:'0 auto',maxHeight:'70vh',overflowY:'auto'}}>
        <div style={{width:36,height:4,background:C.border,borderRadius:2,margin:'0 auto 16px'}}/>
        <div style={{fontSize:'15px',fontWeight:700,marginBottom:'14px'}}>Switch profile</div>
        {loading&&<div style={{fontSize:'12px',color:C.textMuted,padding:'12px'}}>Loading…</div>}
        {!loading&&profiles.map((p,idx)=>{
          // Fixed colors, not __theme - this row is about whose profile it
          // IS, not which theme happens to be active for whoever you're
          // currently viewing. A kid dependent reads as yellow (a kid
          // always follows a parent, so no separate "dependent" signal is
          // needed - yellow alone is different enough from green); any
          // OTHER dependent (parent, elderly, disabled) reads as light
          // green specifically to flag "not the main profile," since
          // those don't carry an obviously-a-kid visual cue otherwise.
          const isDependentRow = !!p.parent_patient_id
          const isKidRow = isDependentRow && (p.dependent_relationship==null || p.dependent_relationship==='child')
          const locked = isLocked(idx)
          const relLabel = DEPENDENT_RELATIONSHIPS.find(r=>r.value===p.dependent_relationship)?.label || 'Dependent'
          return (
            <div key={p.id} onClick={()=>{ if (locked) { handleSubscribeGuardian(); return } onSwitch(p);onClose()}} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 6px',cursor:'pointer',background:p.id===activePatient.id?__theme.accentXLight:'transparent',borderRadius:'10px',opacity:locked?0.55:1}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:isKidRow?'#FFF3CD':isDependentRow?'#E3F3EA':C.greenLight,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'15px',color:isKidRow?'#E8A400':isDependentRow?'#43A879':C.green,flexShrink:0}}>{(p.preferred_name||p.full_name||'?')[0]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'14px',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.preferred_name||p.full_name}</div>
                <div style={{fontSize:'11px',color:C.textMuted}}>{locked?'Locked - needs Medsa Guardian':isDependentRow?relLabel:'You'}</div>
              </div>
              {locked ? <span style={{fontSize:'14px',flexShrink:0}}>🔒</span> : p.id===activePatient.id&&<span style={{color:__theme.accent,fontSize:'16px',flexShrink:0}}>✓</span>}
            </div>
          )
        })}
        {subscribeError&&<div style={{fontSize:'12px',color:C.red,margin:'8px 6px 0'}}>{subscribeError}</div>}

        {/* Real gap reported live-testing: Account Settings (where Medsa
            Bump lives) and the Emergency card were only reachable by
            scrolling Home's own menu list - the profile icon only ever
            switched between profiles, so it wasn't the one place to find
            everything about your own account the way an Instagram-style
            icon implies. Both now live right here too. */}
        <div style={{borderTop:`0.5px solid ${C.border}`,margin:'14px 0 6px'}}/>
        <div onClick={()=>{onOpenSettings&&onOpenSettings()}} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 6px',cursor:'pointer'}}>
          <div style={{width:40,height:40,borderRadius:'50%',background:C.border,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',flexShrink:0}}>⚙</div>
          <div style={{fontSize:'14px',fontWeight:600}}>Account settings</div>
        </div>
        <div onClick={()=>{onOpenEmergency&&onOpenEmergency()}} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 6px',cursor:'pointer'}}>
          <div style={{width:40,height:40,borderRadius:'50%',background:C.amberLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',flexShrink:0}}>🚨</div>
          <div style={{fontSize:'14px',fontWeight:600}}>Emergency card</div>
        </div>

        <div style={{marginTop:'12px'}}>
          {canAddFree
            ? <Btn style={{width:'100%'}} onClick={()=>{onAddChild(managingAdult,false);onClose()}}>+ Add a dependent profile</Btn>
            : guardianActive
              ? <Btn style={{width:'100%'}} onClick={()=>{onAddChild(managingAdult,false);onClose()}}>+ Add another dependent profile</Btn>
              : <Btn variant="primary" style={{width:'100%'}} disabled={subscribing} onClick={handleSubscribeGuardian}>{subscribing?'Starting…':'Subscribe to Medsa Guardian to manage more'}</Btn>}
        </div>
      </div>
    </div>
  )
}

// Reuses SelfRegisterFlow's step-by-step visual shape, but not its HKID +
// selfie identity verification - that exists to prove a STRANGER with no
// prior anchor really is who they claim, which doesn't apply here: the
// parent creating this is already signed in, and the child usually has no
// HKID yet anyway (HK doesn't require one until around age 11). A birth
// certificate upload is the real equivalent proof for this case instead.
// Guardian was never meant to be "kids only" - your call: it's anyone
// you're the caretaker of (a child, but just as much a parent, an elderly
// relative, or a person with a disability). account_type stays 'kids' in
// the DB either way (that's just the locking/avatar mechanism, untouched),
// but the relationship picked here drives copy, the document label, and
// is stored on dependent_relationship purely for display.
const DEPENDENT_RELATIONSHIPS = [
  { value: 'child', label: 'Child', docLabel: 'Birth certificate', docNoun: 'child' },
  { value: 'parent', label: 'Parent', docLabel: 'ID or proof of relationship', docNoun: 'parent' },
  { value: 'elderly', label: 'Elderly relative', docLabel: 'ID or proof of relationship', docNoun: 'relative' },
  { value: 'disabled', label: 'Person with a disability', docLabel: 'ID or proof of relationship', docNoun: 'dependent' },
  { value: 'other', label: 'Other dependent', docLabel: 'ID or proof of relationship', docNoun: 'dependent' },
]

function CreateKidsProfileFlow({ parentPatient, guardianRequired, onBack, onComplete }) {
  const __theme = useContext(ThemeContext)
  const [relationship,setRelationship]=useState('child')
  const [form,setForm]=useState({fullName:'',dob:'',sex:''})
  const [certFile,setCertFile]=useState(null)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)
  const rel = DEPENDENT_RELATIONSHIPS.find(r=>r.value===relationship) || DEPENDENT_RELATIONSHIPS[0]

  async function handleSubmit() {
    setSaving(true); setError(null)
    try {
      const medsaId = 'MDS-' + Math.floor(10000+Math.random()*89999) + '-HK'
      const { data: child, error: insErr } = await supabase.from('patients').insert({
        medsa_id: medsaId, full_name: form.fullName, date_of_birth: form.dob, sex: form.sex||null,
        account_type: 'kids', parent_patient_id: parentPatient.id, registration_path: 'guardian_created',
        dependent_relationship: relationship,
      }).select().maybeSingle()
      if (insErr) throw insErr
      if (certFile) {
        const path = `${medsaId}/dependent-doc-${Date.now()}-${certFile.name}`
        await supabase.storage.from('id-verification').upload(path, certFile)
        const { data: att } = await supabase.from('medical_record_attachments').insert({
          patient_id: child.id, category: relationship==='child' ? 'birth_certificate' : 'dependent_relationship_doc', file_url: path, file_name: certFile.name, verification_status: 'unverified',
        }).select().maybeSingle()
        if (att) await supabase.from('patients').update({ birth_certificate_attachment_id: att.id }).eq('id', child.id)
      }
      onComplete(child)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div onClick={onBack} style={{fontSize:'13px',color:__theme.accent,cursor:'pointer',marginBottom:'20px'}}>← Back</div>
        <div style={{fontSize:'18px',fontWeight:700,marginBottom:'6px'}}>Add a dependent profile</div>
        {guardianRequired&&<div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'16px',fontSize:'12px',color:C.amber,lineHeight:1.6}}>You already manage one dependent under this login for free. This one will be created, but switching between both under this login needs Medsa Guardian - contact Medsa to upgrade.</div>}
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'14px',lineHeight:1.5}}>Medsa Guardian covers anyone you're the caretaker of - a child, a parent, an elderly relative, or someone with a disability.</div>
        <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'6px'}}>Relationship</div>
        <select value={relationship} onChange={e=>setRelationship(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box',marginBottom:'14px',background:'#fff'}}>
          {DEPENDENT_RELATIONSHIPS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'14px'}}>
          <input value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} placeholder={`${rel.label}'s full name`} style={{border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
          <input value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} type="date" max={new Date().toISOString().slice(0,10)} placeholder="Date of birth" style={{border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
          <select value={form.sex} onChange={e=>setForm({...form,sex:e.target.value})} style={{border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box',background:'#fff'}}>
            <option value="">{relationship==='child'?'Sex (needed for WHO growth charts)':'Sex (optional)'}</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div style={{fontSize:'12px',color:C.textMuted,marginBottom:'6px'}}>{rel.docLabel} (optional, can add later)</div>
        <input type="file" accept="image/*,application/pdf" onChange={e=>setCertFile(e.target.files[0])} style={{width:'100%',marginBottom:'20px'}}/>
        {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'14px'}}>{error}</div>}
        <Btn variant="primary" style={{width:'100%'}} onClick={handleSubmit} disabled={saving||!form.fullName||!form.dob||(relationship==='child'&&!form.sex)}>{saving?'Creating…':'Create profile'}</Btn>
      </div>
    </div>
  )
}

function SignUpGate({ onComplete, onSkipDemo }) {
  const [mode,setMode]=useState(null) // null | 'claim' | 'register'

  if (!mode) return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380,textAlign:'center'}}>
        <MedsaLogo height={28}/>
        <div style={{fontSize:'14px',color:C.textSub,margin:'16px 0 28px'}}>Get started with your health passport</div>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          <Card onClick={()=>setMode('login')} style={{padding:'18px',textAlign:'left'}}>
            <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>I've already claimed my profile</div>
            <div style={{fontSize:'12px',color:C.textSub}}>Log back in with your HKID and phone number</div>
          </Card>
          <Card onClick={()=>setMode('claim')} style={{padding:'18px',textAlign:'left'}}>
            <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>A clinic already has my record</div>
            <div style={{fontSize:'12px',color:C.textSub}}>Claim your existing profile using the code sent to your phone</div>
          </Card>
          <Card onClick={()=>setMode('register')} style={{padding:'18px',textAlign:'left'}}>
            <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>I'm new to Medsa</div>
            <div style={{fontSize:'12px',color:C.textSub}}>Register with ID verification</div>
          </Card>
        </div>
        {onSkipDemo&&<div onClick={onSkipDemo} style={{marginTop:'20px',fontSize:'12px',color:C.textMuted,cursor:'pointer'}}>View demo instead →</div>}
      </div>
    </div>
  )

  if (mode==='login') return <LoginFlow onBack={()=>setMode(null)} onComplete={onComplete}/>
  if (mode==='claim') return <ClaimProfileFlow onBack={()=>setMode(null)} onComplete={onComplete}/>
  return <SelfRegisterFlow onBack={()=>setMode(null)} onComplete={onComplete}/>
}

function ClaimProfileFlow({ onBack, onComplete }) {
  const __theme = useContext(ThemeContext)
  const [hkid,setHkid]=useState('')
  const [code,setCode]=useState('')
  const [error,setError]=useState(null)
  const [checking,setChecking]=useState(false)
  const [mergedCount,setMergedCount]=useState(0)
  const [claimedData,setClaimedData]=useState(null)

  // Every real table that references patient_id - if a new one gets added
  // later, it needs adding here too, or its rows would be silently orphaned
  // (left pointing at a deleted duplicate) rather than merged.
  const PATIENT_LINKED_TABLES = [
    'medical_records','conditions','allergies','medications','appointments',
    'agent_policies','appointment_intake','clinic_queue','insurance_claims',
    'order_escalations','patient_messages','patient_share_links',
    'surgery_bookings','transactions','treatment_plans','verbal_orders',
  ]

  async function mergeOtherRecords(claimedId, hkidValue) {
    // Any other row sharing this HKID is the same real person, registered
    // separately at a different institution before ever claiming.
    const { data: duplicates } = await supabase.from('patients').select('id')
      .eq('hkid', hkidValue).neq('id', claimedId).is('claimed_at', null)
    if (!duplicates || duplicates.length === 0) return 0

    for (const dup of duplicates) {
      for (const table of PATIENT_LINKED_TABLES) {
        await supabase.from(table).update({ patient_id: claimedId }).eq('patient_id', dup.id)
      }
      await supabase.from('patients').delete().eq('id', dup.id)
    }
    return duplicates.length
  }

  async function handleClaim() {
    setChecking(true)
    setError(null)
    const { data, error: qErr } = await supabase.from('patients').select('*').eq('hkid', hkid).eq('claim_code', code.toUpperCase()).maybeSingle()
    if (qErr || !data) { setChecking(false); setError('HKID and code do not match any record. Check with the clinic that registered you.'); return }
    if (data.claimed_at) { setChecking(false); setError('This profile has already been claimed.'); return }
    if (new Date(data.claim_code_expires_at) < new Date()) { setChecking(false); setError('This claim code has expired. Ask the clinic to issue a new one.'); return }

    await supabase.from('patients').update({
      registration_path: 'claimed',
      claimed_at: new Date().toISOString(),
      claim_code: null, // burn the code so it can't be reused
    }).eq('id', data.id)

    const merged = await mergeOtherRecords(data.id, hkid)
    setChecking(false)
    setMergedCount(merged)
    setClaimedData(data)
  }

  if (claimedData) return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380,textAlign:'center'}}>
        <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u2713'}</div>
        <div style={{fontSize:'18px',fontWeight:700,marginBottom:'8px'}}>Profile claimed</div>
        {mergedCount>0
          ? <div style={{fontSize:'13px',color:C.textSub,marginBottom:'24px',lineHeight:1.5}}>We also found {mergedCount} other record{mergedCount>1?'s':''} under your HKID from other visits before you claimed - everything's been gathered into this one profile.</div>
          : <div style={{fontSize:'13px',color:C.textSub,marginBottom:'24px',lineHeight:1.5}}>Your health record is now yours - portable across any Medsa-connected clinic.</div>}
        <Btn variant="primary" style={{width:'100%'}} onClick={()=>onComplete(claimedData)}>Continue</Btn>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div onClick={onBack} style={{fontSize:'13px',color:__theme.accent,cursor:'pointer',marginBottom:'20px'}}>← Back</div>
        <div style={{fontSize:'18px',fontWeight:700,marginBottom:'6px'}}>Claim your profile</div>
        <div style={{fontSize:'13px',color:C.textSub,marginBottom:'24px',lineHeight:1.5}}>Enter your HKID and the claim code sent to the phone number your clinic has on file.</div>
        <input value={hkid} onChange={e=>setHkid(e.target.value)} placeholder="HKID" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',marginBottom:'12px',boxSizing:'border-box'}}/>
        <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Claim code" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',marginBottom:'16px',boxSizing:'border-box',textTransform:'uppercase'}}/>
        {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'14px'}}>{error}</div>}
        <Btn variant="primary" style={{width:'100%'}} onClick={handleClaim} disabled={checking||!hkid||!code}>{checking?'Checking...':'Claim my profile'}</Btn>
      </div>
    </div>
  )
}

function SelfRegisterFlow({ onBack, onComplete }) {
  const __theme = useContext(ThemeContext)
  const [step,setStep]=useState('form') // form | id_upload | selfie | pending
  const [form,setForm]=useState({fullName:'',dob:'',hkid:'',phone:''})
  const [idFile,setIdFile]=useState(null)
  const [selfieFile,setSelfieFile]=useState(null)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)
  const [checkingHkid,setCheckingHkid]=useState(false)
  // Set once the HKID entered matches a real account that already
  // exists - the rest of the flow (ID + selfie) is identical either
  // way, but submitting goes to a recovery request tied to that
  // account instead of creating a new one.
  const [recovery,setRecovery]=useState(null) // null | {patientId}

  async function handleContinueFromForm() {
    setCheckingHkid(true)
    setError(null)
    const { data: existing } = await supabase.from('patients').select('id')
      .eq('hkid', form.hkid.trim())
      .or('claimed_at.not.is.null,registration_path.eq.self_registered')
      .limit(1).maybeSingle()
    setCheckingHkid(false)
    setRecovery(existing ? { patientId: existing.id } : null)
    setStep('id_upload')
  }

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      const idFolder = recovery ? `recovery-${recovery.patientId}` : ('MDS-' + Math.floor(10000+Math.random()*89999) + '-HK')
      let idPath = null, selfiePath = null
      if (idFile) {
        idPath = `${idFolder}/id-${Date.now()}-${idFile.name}`
        await supabase.storage.from('id-verification').upload(idPath, idFile)
      }
      if (selfieFile) {
        selfiePath = `${idFolder}/selfie-${Date.now()}-${selfieFile.name}`
        await supabase.storage.from('id-verification').upload(selfiePath, selfieFile)
      }

      if (recovery) {
        // Doesn't touch the existing account at all yet - a human has to
        // actually compare this against what's on file and approve it
        // first (see medsa-admin's Account Recovery tab). Never signs
        // them into the existing account here.
        const { error: recErr } = await supabase.from('account_recovery_requests').insert({
          patient_id: recovery.patientId, hkid: form.hkid.trim(), new_phone: form.phone,
          id_document_path: idPath, selfie_verification_path: selfiePath, status: 'pending',
        })
        if (recErr) throw recErr
        setStep('pending')
        return
      }

      const medsaId = idFolder
      const { data, error: insErr } = await supabase.from('patients').insert({
        medsa_id: medsaId,
        full_name: form.fullName,
        date_of_birth: form.dob,
        hkid: form.hkid,
        phone: form.phone,
        registration_path: 'self_registered',
        id_verification_status: 'pending',
        id_document_path: idPath,
        selfie_verification_path: selfiePath,
      }).select().single()
      // 23505 is the backstop database constraint (see migration) catching
      // a race the check in handleContinueFromForm can't - two signups
      // for the same HKID at the exact same moment.
      if (insErr?.code === '23505') { setError('You already have a Medsa account under this HKID. Go back and log in, or claim your profile if a clinic registered you.'); setSaving(false); return }
      if (insErr) throw insErr
      setStep('pending')
      setTimeout(()=>onComplete(data), 2500) // demo only - real flow waits for actual verification result
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        {step!=='pending'&&<div onClick={onBack} style={{fontSize:'13px',color:__theme.accent,cursor:'pointer',marginBottom:'20px'}}>← Back</div>}

        {step==='form'&&<>
          <div style={{fontSize:'18px',fontWeight:700,marginBottom:'6px'}}>Register with Medsa</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.5}}>Since there's no clinic record to verify against, we'll need your ID and a quick photo to confirm it's really you - this protects your medical information.</div>
          <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'20px'}}>
            <input value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} placeholder="Full name (as on ID)" style={{border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
            <input value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} placeholder="Date of birth (YYYY-MM-DD)" style={{border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
            <input value={form.hkid} onChange={e=>setForm({...form,hkid:e.target.value})} placeholder="HKID" style={{border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
            <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone number" style={{border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
          </div>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'14px'}}>{error}</div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={handleContinueFromForm} disabled={checkingHkid||!form.fullName||!form.dob||!form.hkid||!form.phone}>{checkingHkid?'Checking…':'Continue'}</Btn>
        </>}

        {step==='id_upload'&&<>
          <div style={{fontSize:'18px',fontWeight:700,marginBottom:'6px'}}>{recovery?'Verify identity':'Upload your ID'}</div>
          {recovery&&<div style={{background:C.blueLight,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'16px',fontSize:'12px',color:C.textSub,lineHeight:1.5}}>This HKID already has a Medsa account. We'll compare your ID/selfie against what's on file and, once approved, update the phone number on that account to the one you entered - you won't get a new account.</div>}
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.5}}>A clear photo of your HKID card, both sides if possible.</div>
          <input type="file" accept="image/*" onChange={e=>setIdFile(e.target.files[0])} style={{width:'100%',marginBottom:'20px'}}/>
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>setStep('selfie')} disabled={!idFile}>Continue</Btn>
        </>}

        {step==='selfie'&&<>
          <div style={{fontSize:'18px',fontWeight:700,marginBottom:'6px'}}>Take a selfie</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>This confirms the person {recovery?'recovering this account':'registering'} matches the ID provided.</div>
          <div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'16px',fontSize:'11px',color:C.amber,lineHeight:1.5}}>
            {'\u25c7'} Demo note: real liveness/anti-spoofing verification (confirming a live person, not a photo of a photo) requires a dedicated identity verification provider - this step captures the photo, and {recovery?'a Medsa staff member reviews it against the original':"the matching logic isn't live yet"}.
          </div>
          <input type="file" accept="image/*" capture="user" onChange={e=>setSelfieFile(e.target.files[0])} style={{width:'100%',marginBottom:'20px'}}/>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'14px'}}>{error}</div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={handleSubmit} disabled={saving||!selfieFile}>{saving?'Submitting...':recovery?'Submit for review':'Submit for verification'}</Btn>
        </>}

        {step==='pending'&&recovery&&<div style={{textAlign:'center'}}>
          <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u25c7'}</div>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Recovery request submitted</div>
          <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6,marginBottom:'20px'}}>A Medsa staff member will compare this against your account's original ID and selfie. Once approved, you'll be able to log in with your new phone number.</div>
          <Btn variant="primary" style={{width:'100%'}} onClick={onBack}>Back to start</Btn>
        </div>}
        {step==='pending'&&!recovery&&<div style={{textAlign:'center'}}>
          <div style={{fontSize:'36px',marginBottom:'12px'}}>{'\u25c7'}</div>
          <div style={{fontSize:'17px',fontWeight:700,marginBottom:'8px'}}>Verification submitted</div>
          <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Your documents are being reviewed. This usually takes a short while - continuing to your account now for this demo.</div>
        </div>}
      </div>
    </div>
  )
}

// ── SHARE FOR THIS VISIT — expiring, consent-scoped code for a non-Medsa clinic ──
// The permanent QR still works instantly for participating clinics. This is
// the separate mechanism for a clinic with no Medsa system at all: the
// patient picks exactly what to disclose for this specific visit, generates
// a short code with an expiry, and hands it to the clinic themselves - the
// clinic then enters it on a public, non-authenticated page to view (and
// download) just that tier of information.
function ExternalRequestModal({ request, records=[], onDone }) {
  const __theme = useContext(ThemeContext)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)

  if (!request) return null

  function toggle(id) {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  async function handleSend() {
    setSubmitting(true)
    await supabase.from('external_share_requests').update({
      status: 'fulfilled', bundled_record_ids: Array.from(selectedIds), responded_at: new Date().toISOString(),
    }).eq('id', request.id)
    setSubmitting(false)
    onDone()
  }

  async function handleDecline() {
    setSubmitting(true)
    await supabase.from('external_share_requests').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', request.id)
    setSubmitting(false)
    onDone()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div style={{background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:440,padding:'24px',maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{fontSize:'16px',fontWeight:700,marginBottom:'6px'}}>{request.clinic_name} is requesting your records</div>
        <div style={{fontSize:'12px',color:C.textSub,marginBottom:'18px'}}>Registration: {request.clinic_registration_number}. Choose what to share.</div>
        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'18px',maxHeight:280,overflowY:'auto'}}>
          {records.map(r=>(
            <div key={r.id} onClick={()=>toggle(r.id)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:C.card,borderRadius:'8px',cursor:'pointer'}}>
              <div style={{width:18,height:18,borderRadius:'4px',border:`1.5px solid ${selectedIds.has(r.id)?__theme.accent:C.border}`,background:selectedIds.has(r.id)?__theme.accent:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'#fff',flexShrink:0}}>{selectedIds.has(r.id)?'\u2713':''}</div>
              <div style={{fontSize:'13px'}}>{r.title} - {r.date_of_record}</div>
            </div>
          ))}
          {records.length===0&&<div style={{fontSize:'12px',color:C.textMuted}}>No records on file to share.</div>}
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={handleDecline} disabled={submitting} style={{flex:1,padding:'12px',background:C.card,border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer'}}>Decline</button>
          <button onClick={handleSend} disabled={submitting||selectedIds.size===0} style={{flex:1,padding:'12px',background:__theme.accent,color:'#fff',border:'none',borderRadius:'10px',fontWeight:600,cursor:'pointer',opacity:selectedIds.size===0?0.5:1}}>{submitting?'Sending...':'Send'}</button>
        </div>
      </div>
    </div>
  )
}

function ShareForVisitModal({ open, onClose, patient, recordIds=null }) {
  const __theme = useContext(ThemeContext)
  const [tiers,setTiers]=useState({ allergies:true, conditions:true, medications:true, vaccinations:false, fullHistory:false })
  const [reason,setReason]=useState('')
  const [expiryMinutes,setExpiryMinutes]=useState(60)
  const [saving,setSaving]=useState(false)
  const [generatedCode,setGeneratedCode]=useState(null)
  const [error,setError]=useState(null)

  if (!open) return null

  function toggleTier(key) { setTiers({...tiers,[key]:!tiers[key]}) }

  async function handleGenerate() {
    setSaving(true)
    setError(null)
    try {
      const medsaId = patient?.medsa_id
      const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
      if (!patientRow) throw new Error('Could not find your profile - try again in a moment.')

      const code = Math.random().toString(36).slice(2,8).toUpperCase()
      const expiresAt = new Date(Date.now() + expiryMinutes*60*1000).toISOString()

      const { error: insErr } = await supabase.from('patient_share_links').insert({
        patient_id: patientRow.id,
        code,
        include_allergies: tiers.allergies,
        include_conditions: tiers.conditions,
        include_medications: tiers.medications,
        include_vaccinations: tiers.vaccinations,
        include_full_history: tiers.fullHistory,
        reason_note: reason || null,
        expires_at: expiresAt,
        record_ids: recordIds && recordIds.length>0 ? recordIds : null,
      })
      if (insErr) throw insErr
      setGeneratedCode(code)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setGeneratedCode(null); setReason(''); setError(null)
    onClose()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={handleClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:440,padding:'24px',maxHeight:'85vh',overflowY:'auto'}}>
        {!generatedCode ? <>
          <div style={{fontSize:'16px',fontWeight:700,marginBottom:'6px'}}>Share for this visit</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'18px',lineHeight:1.5}}>For a clinic that doesn't use Medsa. Choose what to share - a routine visit needs less than something like a vaccination.</div>

          {recordIds?.length>0 ? (
            <div style={{background:__theme.accentXLight,border:`0.5px solid ${__theme.accent}`,borderRadius:'8px',padding:'12px 14px',marginBottom:'16px',fontSize:'13px',color:__theme.accent}}>Sharing {recordIds.length} selected record{recordIds.length>1?'s':''}.</div>
          ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
            {[
              {key:'allergies',label:'Allergies'},
              {key:'conditions',label:'Active conditions'},
              {key:'medications',label:'Current medications'},
              {key:'vaccinations',label:'Vaccination history'},
              {key:'fullHistory',label:'Full medical history'},
            ].map(item=>(
              <div key={item.key} onClick={()=>toggleTier(item.key)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:C.card,borderRadius:'8px',cursor:'pointer'}}>
                <div style={{width:18,height:18,borderRadius:'4px',border:`1.5px solid ${tiers[item.key]?__theme.accent:C.border}`,background:tiers[item.key]?__theme.accent:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'#fff',flexShrink:0}}>{tiers[item.key]?'\u2713':''}</div>
                <span style={{fontSize:'13px'}}>{item.label}</span>
              </div>
            ))}
          </div>
          )}

          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>What's this visit for? (optional, for your own reference)</div>
          <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Flu vaccination" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'16px',boxSizing:'border-box'}}/>

          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Code expires after</div>
          <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
            {[[30,'30 min'],[60,'1 hour'],[240,'4 hours']].map(([mins,label])=>(
              <div key={mins} onClick={()=>setExpiryMinutes(mins)} style={{flex:1,padding:'9px',borderRadius:'8px',textAlign:'center',fontSize:'12px',cursor:'pointer',background:expiryMinutes===mins?__theme.accent:C.card,color:expiryMinutes===mins?'#fff':C.textSub}}>{label}</div>
            ))}
          </div>

          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'14px'}}>{error}</div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={handleGenerate} disabled={saving}>{saving?'Generating...':'Generate code'}</Btn>
        </> : <>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'13px',color:C.textSub,marginBottom:'10px'}}>Give this code to the clinic, or have them scan this</div>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://medsa.health/share?code=${generatedCode}`)}`}
              alt="QR code to redeem this share code" width={200} height={200}
              style={{marginBottom:'14px',borderRadius:'8px'}}
            />
            <div style={{fontSize:'32px',fontWeight:700,letterSpacing:'4px',color:__theme.accent,marginBottom:'10px'}}>{generatedCode}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'20px',lineHeight:1.5}}>Valid for {expiryMinutes>=60?`${expiryMinutes/60} hour(s)`:`${expiryMinutes} minutes`}. They'll enter it at medsa.health/share to view and download what you've chosen to share.</div>
            <Btn variant="primary" style={{width:'100%'}} onClick={handleClose}>Done</Btn>
          </div>
        </>}
      </div>
    </div>
  )
}

export default function PatientApp({ liveData={} }) {
  // All hooks must be declared before any conditional return, unconditionally,
  // in the same order every render - otherwise React throws a hard crash the
  // moment the gate's shown/hidden state changes and the hook count differs
  // between renders. This was the actual cause of the sign-up gate crash.
  const [signedInPatient,setSignedInPatient]=useState(null)
  const [showGate,setShowGate]=useState(true)
  const [switcherOpen,setSwitcherOpen]=useState(false)
  const [creatingKid,setCreatingKid]=useState(null) // null | {parent, guardianRequired}
  function switchToPatient(p) {
    setSignedInPatient(p)
    if (typeof window!=='undefined') window.localStorage.setItem('medsa_signed_in_patient_id', p.id)
  }
  const [checkingPersistedSignIn,setCheckingPersistedSignIn]=useState(true)

  // Don't trust liveData.patient as proof someone's really signed in - it
  // can be populated with static demo data by the page wrapper regardless
  // of actual auth state. Real sign-in is tracked here, persisted across
  // reloads, and re-fetched fresh from Supabase rather than reused stale.
  useEffect(() => {
    const persistedId = typeof window!=='undefined' ? window.localStorage.getItem('medsa_signed_in_patient_id') : null
    if (!persistedId) { setCheckingPersistedSignIn(false); return }
    supabase.from('patients').select('*').eq('id', persistedId).maybeSingle().then(({data}) => {
      if (data) { setSignedInPatient(data); setShowGate(false) }
      setCheckingPersistedSignIn(false)
    })
  }, [])

  const [screen,setScreen]=useState('home')
  // Calendar's "View record" deep-links into Records: land on the real
  // record (expanded, real PDF triggered) instead of a second, weaker
  // summary living inside Calendar itself.
  const [deepLinkRecordId,setDeepLinkRecordId]=useState(null)
  const [deepLinkInquiryId,setDeepLinkInquiryId]=useState(null)
  const [lang,setLang]=useState('en') // 'en' | 'zh-TW' | 'zh-CN'
  const isEn = lang==='en' // kept so every existing isEn?'EN':'Traditional' string throughout this file works unchanged
  const [emergencyOpen,setEmergencyOpen]=useState(false)
  const [shareOpen,setShareOpen]=useState(false)
  const [pendingExternalRequest,setPendingExternalRequest]=useState(null)
  const [shareRecordIds,setShareRecordIds]=useState(null)
  const [emergencyConsented,setEmergencyConsented]=useState(true) // true = demo state, false = not set up

  const [realPatientData,setRealPatientData]=useState(null) // null = not fetched yet, object = real fetched data
  const [autoPurchaseNotice,setAutoPurchaseNotice]=useState(null)

  // Real bug found live-testing: the self-serve Stripe path for an
  // automated purchase only ever created the policy from the
  // checkout.session.completed webhook, which is confirmed not firing in
  // this environment (same root cause already fixed for subscriptions
  // and sponsorships) - a real payment completed, redirected back here,
  // and the plan just never showed up under "Policy on file." Verifies
  // the real Stripe session directly instead, same pattern as those.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (params.get('auto_purchase') === '1' && sessionId) {
      fetch('/api/patient/verify_auto_purchase_checkout', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sessionId }),
      }).then(r=>r.json()).then(data => {
        if (data.status === 'OK') { setAutoPurchaseNotice({ ok: true, text: 'Payment confirmed - your plan is now active, see "Policy on file".' }); setScreen('insurance') }
        else if (data.status === 'NOT_PAID') setAutoPurchaseNotice({ ok: false, text: `Payment didn't complete (status: ${data.paymentStatus}) - nothing was charged.` })
        else setAutoPurchaseNotice({ ok: false, text: data.message || 'Could not verify this payment - contact Medsa with your payment confirmation.' })
      }).catch(() => setAutoPurchaseNotice({ ok: false, text: 'Could not reach Medsa to verify this payment - contact Medsa with your payment confirmation.' }))
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('auto_purchase_cancelled') === '1') {
      setAutoPurchaseNotice({ ok: false, text: 'Checkout was cancelled - nothing was charged.' })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Same verify-on-return pattern as the auto-purchase effect above, for
  // Medsa Guardian - reuses autoPurchaseNotice as a generic top banner
  // rather than adding a near-duplicate piece of state just for this.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (params.get('guardian_started') === '1' && sessionId) {
      fetch('/api/patient/verify_guardian_checkout', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sessionId }),
      }).then(r=>r.json()).then(data => {
        if (data.status === 'OK' && data.isActive) setAutoPurchaseNotice({ ok: true, text: 'Medsa Guardian is now active - you can manage more than one profile under this login.' })
        else setAutoPurchaseNotice({ ok: false, text: data.message || 'Could not verify this payment - contact Medsa with your payment confirmation.' })
      }).catch(() => setAutoPurchaseNotice({ ok: false, text: 'Could not reach Medsa to verify this payment - contact Medsa with your payment confirmation.' }))
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('guardian_cancelled') === '1') {
      setAutoPurchaseNotice({ ok: false, text: 'Checkout was cancelled - nothing was charged.' })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Once we know who's really signed in, fetch everything fresh from
  // Supabase - conditions, allergies, medications, records, appointments,
  // claims, and vaccinations all previously came only from the static
  // liveData prop, which never reflected the actual signed-in patient
  // (same root cause as the identity bug, just for every other data
  // category too). Vaccinations was missing from this fetch entirely
  // until now, which is why RecordsScreen always fell back to a
  // hardcoded, identical vaccine list for every patient.
  // Pulled out of the effect below (and wrapped in useCallback) so the
  // home screen's pull-to-refresh can call the exact same fetch on
  // demand, instead of only refreshing its own local queue/messages
  // state and leaving records/appointments/claims/transactions stale -
  // that mismatch is why pull-to-refresh looked "fake."
  const loadRealData = useCallback(async () => {
    if (!signedInPatient?.id) return
    const [condRes, allergyRes, medRes, recRes, apptRes, claimRes, vaxRes, txnRes] = await Promise.all([
      supabase.from('conditions').select('*').eq('patient_id', signedInPatient.id).eq('active', true),
      supabase.from('allergies').select('*').eq('patient_id', signedInPatient.id),
      supabase.from('medications').select('*').eq('patient_id', signedInPatient.id),
      supabase.from('medical_records').select('*,institutions(name)').eq('patient_id', signedInPatient.id).order('date_of_record',{ascending:false}),
      supabase.from('appointments').select('*').eq('patient_id', signedInPatient.id).order('scheduled_at',{ascending:false}),
      // Real bug this fixes: this never joined institutions or
      // insurance_plans at all - the claims list card below reads
      // c.institutions?.name and c.insurance_plans?.plan_name, which
      // were always undefined regardless of the data, rendering as a
      // bare "—" for every single claim, clinic-submitted or not.
      supabase.from('insurance_claims').select('*, institutions(name), insurance_plans(plan_name, company_name)').eq('patient_id', signedInPatient.id).order('submitted_at',{ascending:false}),
      supabase.from('vaccinations').select('*').eq('patient_id', signedInPatient.id).order('administered_date',{ascending:true}),
      supabase.from('transactions').select('*').eq('patient_id', signedInPatient.id),
    ])
    setRealPatientData({
      conditions: condRes.data||[], allergies: allergyRes.data||[], medications: medRes.data||[],
      // A record shouldn't appear to the patient until the visit is
      // actually paid for/billed - 'draft' and 'submitted' are still
      // in progress at the clinic. Anything else (including legacy
      // rows with no record_status at all) stays visible as before.
      records: (recRes.data||[]).filter(r => r.record_status !== 'draft' && r.record_status !== 'submitted'),
      appointments: apptRes.data||[], claims: claimRes.data||[],
      vaccinations: vaxRes.data||[], transactions: txnRes.data||[],
    })
  }, [signedInPatient?.id])

  useEffect(() => {
    if (!signedInPatient?.id) { setRealPatientData(null); return }
    loadRealData()
    // This only ever ran once, right after sign-in - a record billed
    // by a clinic minutes later (or any other change made outside this
    // session) never appeared anywhere in the app until a full
    // sign-out/sign-in, since nothing here was watching for it. Same
    // periodic-refresh pattern already used for the active policy and
    // external share requests below, just applied to everything this
    // fetch covers, on every screen - not just whichever one happened
    // to remount.
    const interval = setInterval(loadRealData, 15000)
    return () => clearInterval(interval)
  }, [signedInPatient?.id, loadRealData])

  // Real-time "doctor is calling" - subscribed for as long as a real
  // patient is signed in and the app is open, regardless of which screen
  // they're on, so it interrupts like an actual incoming call rather than
  // only being visible from Calendar. See lib/videoCallSignal.js.
  const [incomingCall,setIncomingCall]=useState(null)
  useEffect(() => {
    if (!signedInPatient?.medsa_id) return
    const unsubscribe = subscribeIncomingCalls(signedInPatient.medsa_id, (payload) => setIncomingCall(payload))
    return unsubscribe
  }, [signedInPatient?.medsa_id])

  // Computed and hooked before the early returns below (not after) -
  // every hook in this component must run on every render regardless of
  // gate/loading state, or React throws "rendered more hooks than
  // during the previous render" the moment that state changes (e.g. the
  // instant sign-up completes and the gate stops returning early).
  const patient = signedInPatient || liveData.patient || { full_name:'', preferred_name:'', medsa_id:'', date_of_birth:null, blood_type:null, emergency_card_active:false, emergency_contact_name:null, emergency_contact_rel:null, emergency_contact_phone:null, storage_tier:'essential' }

  useEffect(() => {
    if (!patient?.id) return
    async function checkExternalRequests() {
      const { data } = await supabase.from('external_share_requests').select('*')
        .eq('patient_id', patient.id).eq('status', 'pending').eq('direction', 'download')
        .order('requested_at', { ascending: false }).limit(1).maybeSingle()
      setPendingExternalRequest(data || null)
    }
    checkExternalRequests()
    const interval = setInterval(checkExternalRequests, 8000)
    return () => clearInterval(interval)
  }, [patient?.id])

  // Real request: once Medsa Bump is active, the app's own accent color
  // (header, bottom nav) shifts to Bump's pink instead of the default
  // green - a visible, ambient reminder of which mode you're in, same
  // idea as Kids being yellow and Guardian being blue elsewhere. Scoped
  // to the shared chrome (header/nav), not every green pixel on every
  // screen - repainting literally everything risked looking broken
  // rather than branded.
  // Real glitch found live-testing: the pink theme only ever became true
  // once this Supabase check resolved, so every refresh painted green for
  // a frame first, then flashed to pink. Seeding from the same localStorage
  // cache the persisted-sign-in check already uses (keyed by patient id, so
  // it survives before `patient` itself has loaded) means a returning
  // Bump patient sees pink from the very first paint - this still verifies
  // against the real row right after, it just doesn't start from a wrong
  // guess.
  const [bumpActive,setBumpActive]=useState(() => {
    if (typeof window==='undefined') return false
    const persistedId = window.localStorage.getItem('medsa_signed_in_patient_id')
    return !!persistedId && window.localStorage.getItem(`medsa_bump_active_${persistedId}`) === '1'
  })
  const [bumpSubscriptionId,setBumpSubscriptionId]=useState(null)
  const checkBumpActive = useCallback(() => {
    if (!patient?.id) { setBumpActive(false); setBumpSubscriptionId(null); return }
    supabase.from('bump_subscriptions').select('id').eq('patient_id', patient.id).is('graduated_at', null).limit(1).maybeSingle()
      .then(({data}) => {
        const active = !!data
        setBumpActive(active)
        setBumpSubscriptionId(data?.id || null)
        if (typeof window!=='undefined') window.localStorage.setItem(`medsa_bump_active_${patient.id}`, active ? '1' : '0')
      })
  }, [patient?.id])
  useEffect(() => { checkBumpActive() }, [checkBumpActive])
  // Your call, refined: a kid always follows a parent anyway, so there's
  // no need to separately signal "this is a dependent" for them - yellow
  // on its own is different enough from green. Light green is reserved
  // for a NON-kid dependent (parent, elderly relative, person with a
  // disability) specifically to flag "not the main profile," since those
  // don't have the same obviously-a-kid visual cue a yellow theme gives.
  const isDependentProfile = !!patient?.parent_patient_id
  const isKidDependent = isDependentProfile && (patient?.dependent_relationship==null || patient?.dependent_relationship==='child')
  const isOtherDependent = isDependentProfile && !isKidDependent
  // Dependent-ness checked FIRST, not Bump - a dependent profile is never
  // pregnant, so pink has no business showing there even if bumpActive
  // somehow resolved true for that id. Only the main account can go pink.
  const themeAccent = isKidDependent ? '#E8A400' : isOtherDependent ? '#43A879' : bumpActive ? '#F48FB1' : C.green
  const themeAccentMid = isKidDependent ? '#F5C242' : isOtherDependent ? '#6FC89D' : bumpActive ? '#F8BBD0' : C.greenMid
  const themeAccentLight = isKidDependent ? '#FFF3CD' : isOtherDependent ? '#E3F3EA' : bumpActive ? '#FCE4EC' : C.greenLight
  const themeAccentXLight = isKidDependent ? '#FFFBF0' : isOtherDependent ? '#F3FAF6' : bumpActive ? '#FFF5F8' : C.greenXLight

  // Real bug found live-testing: Bump is only ever started from inside
  // Account Settings, but Stripe's redirect back lands on a fresh page
  // load - React state resets to the default Home screen, not back on
  // Account Settings. Verification used to live entirely inside
  // MedsaBumpSection, which never even mounts until the patient manually
  // navigates back there - so a payment could sit unverified (header
  // staying green, "still active" status unconfirmed) until they
  // happened to click into Account Settings again. Same root-level
  // verify-on-return pattern already used for Guardian/auto-purchase
  // above fixes this: it runs the instant the page loads, regardless of
  // which screen ends up showing.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (params.get('bump_started') === '1' && sessionId) {
      fetch('/api/patient/verify_bump_checkout', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sessionId }),
      }).then(r=>r.json()).then(data => {
        if (data.status === 'OK') { setAutoPurchaseNotice({ ok: true, text: 'Payment confirmed - Medsa Bump is now active.' }); checkBumpActive() }
        else setAutoPurchaseNotice({ ok: false, text: data.message || 'Could not verify this payment - contact Medsa with your payment confirmation.' })
      }).catch(() => setAutoPurchaseNotice({ ok: false, text: 'Could not reach Medsa to verify this payment - contact Medsa with your payment confirmation.' }))
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('bump_cancelled') === '1') {
      setAutoPurchaseNotice({ ok: false, text: 'Checkout was cancelled - nothing was charged.' })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [checkBumpActive])

  if (checkingPersistedSignIn) return null

  if (showGate && !signedInPatient) {
    return <SignUpGate onComplete={(p)=>{
      setSignedInPatient(p); setShowGate(false)
      if (typeof window!=='undefined') window.localStorage.setItem('medsa_signed_in_patient_id', p.id)
    }} onSkipDemo={()=>setShowGate(false)}/>
  }

  if (creatingKid) {
    return <CreateKidsProfileFlow parentPatient={creatingKid.parent} guardianRequired={creatingKid.guardianRequired}
      onBack={()=>setCreatingKid(null)}
      onComplete={(child)=>{ setCreatingKid(null); switchToPatient(child) }}/>
  }

  const liveRecords = signedInPatient ? (realPatientData?.records||[]) : (liveData.records || [])
  const liveTransactions = signedInPatient ? (realPatientData?.transactions||[]) : []
  const liveConditions = signedInPatient ? (realPatientData?.conditions||[]) : (liveData.conditions || [])
  const liveAllergies = signedInPatient ? (realPatientData?.allergies||[]) : (liveData.allergies || [])
  const liveMedications = signedInPatient ? (realPatientData?.medications||[]) : (liveData.medications || [])
  // Previously never checked signedInPatient at all, unlike every other
  // liveXxx variable here - meaning a real signed-in patient always fell
  // through to liveData.vaccinations (empty, since real sign-in doesn't
  // populate that prop), and RecordsScreen compensated with a hardcoded
  // fake vaccine list. Now consistent with the rest of this block.
  const liveVaccinations = signedInPatient ? (realPatientData?.vaccinations||[]) : (liveData.vaccinations || [])
  const liveAppointments = signedInPatient ? (realPatientData?.appointments||[]) : (liveData.appointments || [])
  const liveClaims = signedInPatient ? (realPatientData?.claims||[]) : (liveData.claims || [])
  const titles={home:'medsa',records:isEn?'Medical records':'醫療記錄',doctors:isEn?'Doctors & clinics':'醫生與診所',calendar:isEn?'Calendar':'日曆',insurance:isEn?'Insurance':'保險',prescriptions:isEn?'Prescriptions':'處方',family:isEn?'Family & guardians':'家庭與監護',storage:isEn?'Storage & plan':'儲存與計劃',forum:isEn?'Community':'社群',kidsgrowth:isEn?'Growth & feeding':'生長與餵養',bumphealth:isEn?'Pregnancy health log':'孕期健康記錄',bumpcohort:isEn?'Birth club':'待產小組'}
  const navItems=[{key:'home',icon:'home',en:'Home',zh:'主頁'},{key:'records',icon:'records',en:'Records',zh:'記錄'},{key:'doctors',icon:'doctors',en:'Find care',zh:'尋找'},{key:'calendar',icon:'calendar',en:'Calendar',zh:'日曆'},{key:'insurance',icon:'insurance',en:'Insurance',zh:'保險'}]
  const rootContent = (
    // Real gap reported live-testing: minHeight let this column grow
    // TALLER than the viewport whenever a screen's content ran long -
    // the whole column (bottom nav included) then scrolled off with the
    // page itself, so the nav only reappeared once you'd scrolled all
    // the way down, instead of staying pinned like a real tab bar. Fixed
    // height + overflow:hidden keeps this column locked to exactly the
    // viewport; only the inner content div (overflowY:auto, below)
    // scrolls internally, so the nav never leaves.
    //
    // ThemeContext.Provider here is what makes every other screen in the
    // app (records, doctors, calendar, insurance, forum, profile switcher,
    // etc.) switch from green to pink while Bump is active - they all read
    // this via useContext(ThemeContext) instead of C.green directly.
    <ThemeContext.Provider value={{accent:themeAccent, accentMid:themeAccentMid, accentLight:themeAccentLight, accentXLight:themeAccentXLight}}>
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',maxWidth:'440px',margin:'0 auto',background:C.beige}}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      {autoPurchaseNotice&&<div onClick={()=>setAutoPurchaseNotice(null)} style={{padding:'10px 16px',fontSize:'12px',lineHeight:1.5,textAlign:'center',cursor:'pointer',background:autoPurchaseNotice.ok?themeAccentXLight:C.redLight,color:autoPurchaseNotice.ok?themeAccent:C.red}}>{autoPurchaseNotice.text}</div>}
      <div style={{background:themeAccent,padding:'14px 16px',display:'flex',alignItems:'center',gap:'10px',position:'sticky',top:0,zIndex:10}}>
        {screen!=='home'&&<button onClick={()=>setScreen('home')} style={{background:'rgba(255,255,255,0.18)',border:'none',color:'#fff',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</button>}
        {screen==='home'?<MedsaLogo height={20}/>:<span style={{fontSize:'17px',fontWeight:500,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0,flex:'0 1 auto'}}>{titles[screen]}</span>}
        <div style={{flex:1,minWidth:0}}/>
        <div style={{display:'flex',background:'rgba(255,255,255,0.12)',borderRadius:'20px',padding:'2px',flexShrink:0}}>
          {[['en','EN'],['zh-TW','繁'],['zh-CN','简']].map(([code,label])=>(
            <button key={code} onClick={()=>setLang(code)} style={{background:lang===code?'rgba(255,255,255,0.9)':'transparent',color:lang===code?themeAccent:'#fff',border:'none',fontSize:'11px',fontWeight:600,padding:'4px 10px',borderRadius:'18px',cursor:'pointer'}}>{label}</button>
          ))}
        </div>
        {/* Instagram-style profile switcher entry point - tap your own
            avatar to switch into a linked dependent profile or add one.
            Only shown for a real signed-in account (switching makes no
            sense in demo mode, which has no real patient row to link). */}
        {signedInPatient&&<div onClick={()=>setSwitcherOpen(true)} style={{width:30,height:30,borderRadius:'50%',background:'rgba(255,255,255,0.9)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'13px',color:themeAccent,cursor:'pointer',flexShrink:0,marginLeft:'8px'}}>{(patient.preferred_name||patient.full_name||'?')[0]}</div>}
      </div>
      <div data-app-scroll-root style={{flex:1,overflowY:'auto'}}>
        {screen==='home'&&<HomeScreen onNav={setScreen} onOpenInquiry={(id)=>{setDeepLinkInquiryId(id);setScreen('insurance')}} isEn={isEn} onOpenEmergencySetup={()=>setEmergencyOpen(true)} onOpenShare={()=>setShareOpen(true)} onOpenSignUp={()=>{setSignedInPatient(null);setShowGate(true)}} emergencyConsented={emergencyConsented} patient={patient} appointments={liveAppointments} claims={liveClaims} onRefreshData={loadRealData} themeAccent={themeAccent} themeAccentMid={themeAccentMid} themeAccentLight={themeAccentLight} themeAccentXLight={themeAccentXLight} bumpActive={bumpActive}/>}
        {screen==='records'&&<RecordsScreen isEn={isEn} records={liveRecords} conditions={liveConditions} vaccinations={liveVaccinations} patient={patient} transactions={liveTransactions} onShareBundle={(ids)=>{setShareRecordIds(ids);setShareOpen(true)}} deepLinkRecordId={deepLinkRecordId} onConsumeDeepLink={()=>setDeepLinkRecordId(null)}/>}
        {screen==='doctors'&&<DoctorsScreen isEn={isEn} patient={patient}/>}
        {screen==='calendar'&&<CalendarScreen isEn={isEn} appointments={liveAppointments} medications={liveMedications} records={liveRecords} patient={patient} onCancelled={loadRealData} onReload={loadRealData} onViewRecord={(id)=>{setDeepLinkRecordId(id);setScreen('records')}}/>}
        {screen==='insurance'&&<InsuranceScreen isEn={isEn} claims={liveClaims} patient={patient} records={liveRecords} deepLinkInquiryId={deepLinkInquiryId} onConsumeInquiryDeepLink={()=>setDeepLinkInquiryId(null)}/>}
        {screen==='prescriptions'&&<PrescriptionsScreen isEn={isEn} medications={liveMedications} onNav={setScreen}/>}
        {screen==='kidsgrowth'&&<KidsGrowthScreen isEn={isEn} patient={patient} onNav={setScreen} onPatientUpdated={async()=>{
          if (!signedInPatient?.id) return
          const { data } = await supabase.from('patients').select('*').eq('id', signedInPatient.id).maybeSingle()
          if (data) setSignedInPatient(data)
        }}/>}
        {screen==='bumphealth'&&<BumpHealthScreen isEn={isEn} patient={patient} bumpSubscriptionId={bumpSubscriptionId}/>}
        {screen==='bumpcohort'&&<BumpCohortScreen isEn={isEn} patient={patient}/>}
        {screen==='forum'&&<ForumScreen isEn={isEn} patient={patient}/>}
        {screen==='editprofile'&&<EditProfileScreen isEn={isEn} patient={patient} onSaved={async()=>{
          if (!signedInPatient?.id) return
          const { data } = await supabase.from('patients').select('*').eq('id', signedInPatient.id).maybeSingle()
          if (data) setSignedInPatient(data)
        }} onSignOut={()=>{
          setSignedInPatient(null); setShowGate(true)
          if (typeof window!=='undefined') window.localStorage.removeItem('medsa_signed_in_patient_id')
        }}/>}
      </div>
      <div style={{background:C.cream,borderTop:`0.5px solid ${C.border}`,display:'flex',padding:'8px 0 6px',position:'sticky',bottom:0}}>
        {navItems.map(item=>(
          <div key={item.key} onClick={()=>setScreen(item.key)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',cursor:'pointer',color:screen===item.key?themeAccent:C.textMuted,fontSize:'10px'}}>
            <Icon name={item.icon} size={20}/>
            <span>{isEn?item.en:item.zh}</span>
          </div>
        ))}
      </div>
      <EmergencyCardSetup
        open={emergencyOpen}
        onClose={()=>setEmergencyOpen(false)}
        consented={emergencyConsented}
        onConsent={(val=true)=>setEmergencyConsented(val)}
        liveConditions={liveConditions}
        liveAllergies={liveAllergies}
        liveMedications={liveMedications}
        patient={patient}
      />
      <ShareForVisitModal open={shareOpen} onClose={()=>{setShareOpen(false);setShareRecordIds(null)}} patient={patient} recordIds={shareRecordIds}/>
      <ExternalRequestModal request={pendingExternalRequest} records={liveRecords} onDone={()=>setPendingExternalRequest(null)}/>
      <IncomingCallOverlay call={incomingCall} isEn={isEn} patient={patient} onDismiss={()=>setIncomingCall(null)}/>
      {signedInPatient&&<ProfileSwitcherModal open={switcherOpen} onClose={()=>setSwitcherOpen(false)} activePatient={signedInPatient}
        onSwitch={switchToPatient}
        onAddChild={(parent,guardianRequired)=>setCreatingKid({parent,guardianRequired})}
        onOpenSettings={()=>{setScreen('editprofile');setSwitcherOpen(false)}}
        onOpenEmergency={()=>{setEmergencyOpen(true);setSwitcherOpen(false)}}/>}
    </div>
    </ThemeContext.Provider>
  )
  return lang==='zh-CN' ? deepSimplify(rootContent) : rootContent
}
