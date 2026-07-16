import { useState, useEffect, useRef, isValidElement, cloneElement, Children } from 'react'
import { supabase } from '../../lib/supabase'
import MedsaLogo from '../shared/MedsaLogo'
import C from '../shared/colours'

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
  const base={border:'none',borderRadius:'10px',padding:'10px 16px',fontSize:'13px',fontWeight:500,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:disabled?0.5:1,...sx}
  const V={primary:{background:C.green,color:'#fff'},secondary:{background:C.card,color:C.text,border:`0.5px solid ${C.border}`},danger:{background:C.red,color:'#fff'},amber:{background:C.amber,color:'#fff'},navy:{background:C.navy,color:'#fff'}}
  return <button style={{...base,...V[variant]}} onClick={onClick} disabled={disabled}>{children}</button>
}
function Card({ children, style:sx={}, onClick }) {
  return <div onClick={onClick} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',margin:'0 16px 10px',overflow:'hidden',cursor:onClick?'pointer':'default',...sx}}>{children}</div>
}
function SecLabel({ children }) {
  return <div style={{fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.9px',color:C.textMuted,padding:'16px 16px 8px'}}>{children}</div>
}
function Toggle({ checked=false, onChange }) {
  const [on,setOn]=useState(checked)
  return <div onClick={()=>{setOn(!on);onChange&&onChange(!on)}} style={{width:34,height:18,borderRadius:20,background:on?C.green:C.border,cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}><div style={{position:'absolute',top:2,left:on?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/></div>
}
function Badge({ text, type }) {
  const map={ok:[C.greenLight,C.green],due:[C.amberLight,C.amber],full:[C.redLight,C.red]}
  const [bg,fg]=map[type]||map.ok
  return <span style={{fontSize:'10px',background:bg,color:fg,padding:'3px 9px',borderRadius:'20px',fontWeight:500,whiteSpace:'nowrap'}}>{text}</span>
}

// ── EMERGENCY CARD SETUP + CONSENT FLOW ──────────────────────────────────────
// This is shown to PATIENTS only for setup/consent — not for showing to EMS.
// EMS access the emergency card automatically via QR scan in the practitioner portal.
function EmergencyCardSetup({ open, onClose, consented, onConsent, liveConditions=[], liveAllergies=[], liveMedications=[], patient }) {
  const p = patient || { full_name:'Wong Mei-ling, Lisa', medsa_id:'MDS-84921-HK', date_of_birth:'1988-03-14', blood_type:'O+', emergency_contact_name:'Wong Tai', emergency_contact_rel:'Mother', emergency_contact_phone:'+852 9xxx xxxx' }
  const [step, setStep] = useState(consented ? 'view' : 'intro')
  if (!open) return null
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
          <div style={{background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'14px',padding:'16px',marginBottom:'16px'}}>
            <div style={{fontSize:'12px',fontWeight:600,color:C.green,marginBottom:'10px'}}>What emergency personnel will see:</div>
            {['Blood type','Critical conditions','Severe allergies','Current medications','Emergency contact'].map((item,i)=>(
              <div key={i} style={{fontSize:'13px',color:C.text,padding:'4px 0',display:'flex',alignItems:'center',gap:'8px'}}><span style={{color:C.green,fontSize:'10px'}}>✓</span>{item}</div>
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
            I, <strong>Wong Mei-ling, Lisa</strong>, consent to Medsa making my critical medical information accessible to verified emergency medical personnel (EMS, A&E staff, and Medsa-registered practitioners in an emergency context) via QR scan.<br/><br/>
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
              <div style={{fontSize:'12px',color:C.green,marginTop:'2px'}}>● Active · Auto-updating from records</div>
            </div>
            <span style={{fontSize:'10px',background:C.greenLight,color:C.green,padding:'3px 10px',borderRadius:'20px',fontWeight:600}}>Consented ✓</span>
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
                <div style={{fontSize:'13px',fontWeight:600}}>Wong Tai (Mother)</div>
                <div style={{fontSize:'12px',color:C.textSub}}>+852 9xxx xxxx</div>
              </div>
            </div>
            {['Type 2 Diabetes','Iron deficiency anaemia','Coronary artery disease'].map((c,i)=>(
              <div key={i} style={{fontSize:'13px',fontWeight:500,padding:'4px 0',borderTop:i===0?`0.5px solid rgba(192,57,43,0.2)`:undefined}}>◎ {c}</div>
            ))}
            <div style={{borderTop:`0.5px solid rgba(192,57,43,0.2)`,marginTop:'8px',paddingTop:'8px'}}>
              {['Penicillin — SEVERE ANAPHYLAXIS','Dust mites — moderate'].map((a,i)=>(
                <div key={i} style={{fontSize:'13px',fontWeight:700,color:C.red,padding:'3px 0'}}>⚠ {a}</div>
              ))}
            </div>
            <div style={{borderTop:`0.5px solid rgba(192,57,43,0.2)`,marginTop:'8px',paddingTop:'8px'}}>
              {['Metformin 500mg — twice daily','Aspirin 100mg — daily','Atorvastatin 20mg — nightly'].map((m,i)=>(
                <div key={i} style={{fontSize:'12px',color:C.textSub,padding:'2px 0'}}>◉ {m}</div>
              ))}
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

function HomeScreen({ onNav, isEn, onOpenEmergencySetup, onOpenShare, onOpenSignUp, emergencyConsented, patient={} }) {
  // Live queue position - reads from the real `clinic_queue` table that
  // ClinicOpsApp writes to on check-in, so this updates the moment front
  // desk checks the patient in, and clears once their status is no longer
  // waiting/in_room.
  const [queueStatus,setQueueStatus]=useState({ checkedIn:false })
  const [doctorMessages,setDoctorMessages]=useState([])
  const [messagesLoading,setMessagesLoading]=useState(true)
  const [openThread,setOpenThread]=useState(null) // array of messages in one conversation, shown in a modal
  const [homePatientId,setHomePatientId]=useState(null)
  const [replyBody,setReplyBody]=useState('')
  const [replying,setReplying]=useState(false)
  const [replyError,setReplyError]=useState(null)

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

    const { data: myEntry } = await supabase
      .from('clinic_queue')
      .select('*, institutions(name)')
      .eq('patient_id', patientRow.id)
      .in('status', ['waiting','in_room'])
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!myEntry) { setQueueStatus({ checkedIn:false }); return }

    // Position = how many other patients checked in earlier are still
    // waiting ahead of this one, at the same institution.
    const { count } = await supabase
      .from('clinic_queue')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', myEntry.institution_id)
      .eq('status', 'waiting')
      .lt('checked_in_at', myEntry.checked_in_at)

    setQueueStatus({
      checkedIn: true,
      position: count || 0,
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
    <PullToRefresh onRefresh={async ()=>{ await Promise.all([loadDoctorMessages(), loadQueueStatus()]) }}>
    <div style={{background:C.beige,flex:1,paddingBottom:'20px'}}>

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
            <div style={{fontSize:'16px',fontWeight:800,color:'#fff',lineHeight:1}}>{queueStatus.position}</div>
            <div style={{fontSize:'8px',color:'rgba(255,255,255,0.7)'}}>{isEn?'ahead':'位在前'}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:'13px',fontWeight:600,color:'#fff'}}>{isEn?`${queueStatus.position} people ahead of you`:`您前面有${queueStatus.position}位`}</div>
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
      <div style={{margin:'14px 16px 0',background:`linear-gradient(135deg,${C.green} 0%,${C.greenMid} 100%)`,borderRadius:'16px',padding:'20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}}>
          <div>
            <div style={{fontSize:'17px',fontWeight:500,color:'#fff'}}>{isEn?`Good morning, ${patient?.preferred_name||patient?.full_name?.split(',')[1]?.trim()||'Lisa'}`:'早晨，Lisa'}</div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.8)',marginTop:'2px'}}>{isEn?'Your health passport':'您的健康護照'}</div>
            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.6)',marginTop:'6px',letterSpacing:'1px'}}>MDS-84921-HK · Verified ✓</div>
            {onOpenSignUp&&<div onClick={onOpenSignUp} style={{fontSize:'10px',color:'rgba(255,255,255,0.7)',marginTop:'6px',textDecoration:'underline',cursor:'pointer'}}>{isEn?'Not you? Claim or register a profile':'不是您？認領或註冊個人檔案'}</div>}
          </div>
          {/* Emergency card status badge */}
          <div onClick={onOpenEmergencySetup} style={{cursor:'pointer'}}>
            {emergencyConsented
              ?<span style={{fontSize:'10px',background:'rgba(255,255,255,0.2)',color:'#fff',padding:'4px 10px',borderRadius:'20px',fontWeight:600,display:'flex',alignItems:'center',gap:'4px'}}><span style={{width:6,height:6,borderRadius:'50%',background:'#7fff7f',display:'inline-block'}}/>Emergency card ✓</span>
              :<span style={{fontSize:'10px',background:'rgba(255,180,0,0.3)',color:'#ffe066',padding:'4px 10px',borderRadius:'20px',fontWeight:600}}>Emergency card — set up ›</span>
            }
          </div>
        </div>
        {/* QR Code — large and centred, the hero */}
        <div style={{background:'#fff',borderRadius:'14px',padding:'20px',display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'}}>
          <svg width="140" height="140" viewBox="0 0 48 48" fill="none">
            <rect x="2" y="2" width="18" height="18" rx="2" fill={C.green}/><rect x="6" y="6" width="10" height="10" rx="1" fill="white"/>
            <rect x="28" y="2" width="18" height="18" rx="2" fill={C.green}/><rect x="32" y="6" width="10" height="10" rx="1" fill="white"/>
            <rect x="2" y="28" width="18" height="18" rx="2" fill={C.green}/><rect x="6" y="32" width="10" height="10" rx="1" fill="white"/>
            <rect x="28" y="28" width="4" height="4" fill={C.green}/><rect x="34" y="28" width="4" height="4" fill={C.green}/>
            <rect x="40" y="28" width="6" height="4" fill={C.green}/><rect x="28" y="34" width="6" height="4" fill={C.green}/>
            <rect x="36" y="34" width="4" height="4" fill={C.green}/><rect x="28" y="40" width="4" height="6" fill={C.green}/>
            <rect x="34" y="42" width="12" height="4" fill={C.green}/>
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
          <div style={{fontSize:'11px',color:C.textMuted}}>{isEn?'For a clinic that doesn\\u2019t use Medsa - choose what to share':'為未使用Medsa的診所選擇分享內容'}</div>
        </div>
        <span style={{color:C.textMuted,fontSize:'14px'}}>{'\u203a'}</span>
      </div>
      <SecLabel>{isEn?'Your health':'您的健康'}</SecLabel>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',padding:'0 16px'}}>
        {[
          {key:'records',icon:'▣',label:isEn?'Medical records':'醫療記錄',sub:isEn?'History, vaccinations, share':'病歷、疫苗、分享',bg:C.greenLight,badge:null},
          {key:'insurance',icon:'◉',label:isEn?'Insurance':'保險',sub:isEn?'Plans, claims, agents':'計劃、索賠、代理人',bg:C.blueLight,badge:'2'},
          {key:'prescriptions',icon:'◈',label:isEn?'Prescriptions':'處方',sub:isEn?'Meds, drug info':'藥物、資訊',bg:C.brownLight,badge:null},
          {key:'calendar',icon:'◇',label:isEn?'Calendar':'日曆',sub:isEn?'Appointments, alarms':'預約、提醒',bg:C.amberLight,badge:'1'},
        ].map(item=>(
          <div key={item.key} onClick={()=>onNav(item.key)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'16px',cursor:'pointer',position:'relative'}}>
            <div style={{width:36,height:36,background:item.bg,borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',marginBottom:'10px',color:C.green}}>{item.icon}</div>
            <div style={{fontSize:'13px',fontWeight:500,marginBottom:'3px'}}>{item.label}</div>
            <div style={{fontSize:'11px',color:C.textSub,lineHeight:1.4}}>{item.sub}</div>
            {item.badge&&<span style={{position:'absolute',top:10,right:10,background:C.red,color:'#fff',fontSize:'10px',width:18,height:18,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>{item.badge}</span>}
          </div>
        ))}
      </div>
      <SecLabel>{isEn?'Find care & manage':'尋找醫療'}</SecLabel>
      <div style={{padding:'0 16px'}}>
        {[
          {key:'doctors',icon:'◎',bg:C.greenLight,label:isEn?'Doctors & clinics':'醫生與診所',sub:isEn?'Search, book, pay':'搜索、預約、付款'},
          {key:'family',icon:'◇',bg:C.brownLight,label:isEn?'Family & guardians':'家庭與監護',sub:isEn?'Monitor family members · HK$38/mo':'監護家庭成員'},
          {key:'storage',icon:'▣',bg:C.card,label:isEn?'Storage & plan':'儲存與計劃',sub:isEn?'Free · 0.8 GB of 2 GB used':'免費 · 已使用0.8 GB / 2 GB'},
        ].map(item=>(
          <div key={item.key} onClick={()=>onNav(item.key)} style={{background:C.cream,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:'14px',marginBottom:'10px'}}>
            <div style={{width:40,height:40,background:item.bg,borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.green,flexShrink:0}}>{item.icon}</div>
            <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{item.label}</div><div style={{fontSize:'12px',color:C.textSub}}>{item.sub}</div></div>
            <span style={{color:C.textMuted,fontSize:'18px'}}>›</span>
          </div>
        ))}
      </div>
      <SecLabel>{isEn?'Message board':'訊息板'}</SecLabel>
      <Card>
        <div style={{background:C.greenXLight,padding:'10px 14px',borderBottom:`0.5px solid ${C.border}`,fontSize:'13px',fontWeight:500,color:C.green}}>◈ {isEn?'Alerts & updates':'警報與更新'}</div>
        {[
          {dot:C.red,title:isEn?'Flu season advisory':'流感季節公告',body:isEn?'HKDOH recommends vaccination before Oct 31.':'衞生署建議於10月31日前接種疫苗。'},
          {dot:'#d4a017',title:isEn?'Reminder: Dr Chan — tomorrow 10am':'提醒：陳醫生 — 明天上午10時',body:isEn?'QE Hospital, Room 3B.':'伊利沙伯醫院，3B室。'},
          {dot:C.green,title:isEn?'Insurance claim approved':'保險索賠已批准',body:isEn?'AIA claim #44821 — HK$3,200 approved.':'AIA索賠#44821 — 港幣3,200元已批准。'},
        ].map((m,i)=>(
          <div key={i} style={{padding:'10px 14px',borderBottom:`0.5px solid ${C.border}`,display:'flex',gap:'10px',alignItems:'flex-start'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:m.dot,marginTop:'5px',flexShrink:0}}/>
            <div><div style={{fontSize:'12px',fontWeight:500}}>{m.title}</div><div style={{fontSize:'11px',color:C.textSub,marginTop:'2px',lineHeight:1.4}}>{m.body}</div></div>
          </div>
        ))}
        <div style={{padding:'10px 14px',borderBottom:`0.5px solid ${C.border}`,fontSize:'13px',fontWeight:500,color:C.green}}>◉ {isEn?'Messages from your doctor':'醫生的訊息'}</div>
        {messagesLoading&&<div style={{padding:'14px',textAlign:'center',fontSize:'11px',color:C.textMuted}}>{isEn?'Loading…':'載入中…'}</div>}
        {!messagesLoading&&doctorThreadsLatestFirst.length===0&&<div style={{padding:'14px',textAlign:'center',fontSize:'11px',color:C.textMuted}}>{isEn?'No messages yet.':'暫無訊息。'}</div>}
        {doctorThreadsLatestFirst.map((m,i)=>(
          <div key={m.id} onClick={()=>handleOpenDoctorMsg(m)} style={{padding:'10px 14px',borderBottom:i<doctorThreadsLatestFirst.length-1?`0.5px solid ${C.border}`:'none',display:'flex',gap:'10px',alignItems:'flex-start',cursor:'pointer',background:m.urgent&&!m.read_by_patient?C.redLight:'transparent'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:m.urgent?C.red:(!m.read_by_patient?C.green:C.border),marginTop:'5px',flexShrink:0}}/>
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
            <div onClick={()=>setOpenThread(null)} style={{fontSize:'12px',color:C.green,cursor:'pointer',marginBottom:'14px'}}>{isEn?'← Close':'← 關閉'}</div>
            {openThread.map((m)=>(
              <Card key={m.id} style={{padding:'14px 16px',marginBottom:'8px',background:m.sender_type==='patient'?C.greenXLight:(m.urgent?C.redLight:'#fff')}}>
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
    </div>
    </PullToRefresh>
  )
}

function RecordsScreen({ isEn, records=[], conditions=[], vaccinations=[], patient={} }) {
  // Use live Supabase data if available, otherwise fall back to demo records
  const hasLiveData = records.length > 0
  const [tab,setTab]=useState('all')
  const [expanded,setExpanded]=useState(null)
  const demoRecords=[
    {id:1,icon:'◎',bg:C.blueLight,title:'Blood panel — full CBC',sub:'Queen Elizabeth Hospital · Lab',date:'12 Jun 2025',src:'Synced',details:[['Haemoglobin','13.8 g/dL ✓'],['WBC','6.2 × 10⁹/L ✓'],['Glucose','5.9 mmol/L ↑'],['Ordered by','Dr Chan Siu-ming']]},
    {id:2,icon:'◈',bg:C.greenLight,title:'General check-up',sub:'Matilda International · Visit',date:'3 May 2025',src:'Synced',details:[['Blood pressure','118/76 mmHg ✓'],['BMI','22.4'],['Heart rate','72 bpm ✓'],['Notes','Mild iron deficiency']]},
    {id:3,icon:'▣',bg:C.amberLight,title:'Chest X-ray',sub:'Ruttonjee Hospital · Imaging',date:'18 Feb 2025',src:'Synced',details:[['Findings','No active TB. Lungs clear.'],['Radiologist','Dr Lam Wai-yee']]},
    {id:4,icon:'◇',bg:C.brownLight,title:'Allergy test results',sub:'Uploaded manually · PDF',date:'9 Jan 2025',src:'Manual',details:[['Penicillin','⚠ Severe allergy'],['Verified by','Pending review']]},
  ]
  const vaccines=[
    {name:'COVID-19',status:'ok',label:'Up to date',doses:[['Dose 1 — BioNTech','12 Mar 2021'],['Dose 2 — BioNTech','3 Apr 2021'],['Booster 1','18 Jan 2022'],['Booster 2 — XBB','9 Oct 2023']]},
    {name:'Influenza (seasonal)',status:'due',label:'Due soon',doses:[['2023–24 Quadrivalent','6 Oct 2023'],['2024–25 — Book now','Recommended']]},
    {name:'Hepatitis B',status:'ok',label:'Complete',doses:[['Dose 1','Jan 1992'],['Dose 2','Mar 1992'],['Dose 3','Jul 1992']]},
    {name:'HPV (Gardasil 9)',status:'ok',label:'Complete',doses:[['Dose 1','5 Sep 2018'],['Dose 2','5 Nov 2018'],['Dose 3','5 Mar 2019']]},
    {name:'Tetanus / Td booster',status:'full',label:'Overdue',doses:[['Last booster','Mar 2013'],['Next due — every 10 yrs','Overdue 2023']]},
  ]
  const providers=[{init:'QE',name:'Queen Elizabeth Hospital',sub:'Medsa partner',on:true},{init:'MIH',name:'Matilda International',sub:'Medsa partner',on:true},{init:'DR',name:'Dr Chan Siu-ming',sub:'Private practitioner',on:true},{init:'VF',name:'Valley Fitness Clinic',sub:'Non-Medsa · Link share',on:false}]
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
    'Non-Medsa':'非Medsa','Link share':'連結分享',
  }
  function mt(term) {
    if (isEn || !term) return term
    return String(term).split(' · ').map(part => MED_TERM_ZH[part] || part).join(' · ')
  }
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:C.greenXLight,borderBottom:`0.5px solid ${C.greenLight}`,padding:'10px 16px',display:'flex',gap:'8px',alignItems:'center'}}>
        <span style={{color:C.green}}>◇</span>
        <span style={{fontSize:'12px',color:C.green}}>{isEn?'You control exactly what each provider sees.':'您完全掌控每位醫療提供者可查看的內容。'}</span>
      </div>
      <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`,overflowX:'auto'}}>
        {[['all',isEn?'All records':'所有記錄'],['vax',isEn?'Vaccinations':'疫苗'],['sharing',isEn?'Sharing':'分享'],['upload',isEn?'Upload':'上傳']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'11px 8px',fontSize:'12px',fontWeight:500,color:tab===k?C.green:C.textSub,textAlign:'center',borderBottom:`2px solid ${tab===k?C.green:'transparent'}`,cursor:'pointer',whiteSpace:'nowrap'}}>{l}</div>
        ))}
      </div>
      {tab==='all'&&<>
        <SecLabel>{isEn?'Recent records':'最近記錄'}</SecLabel>
        {(hasLiveData ? records.map(r=>({
          id: r.id,
          icon: r.record_type==='lab'?'◉':r.record_type==='imaging'?'▣':r.record_type==='procedure'?'◇':'◎',
          bg: r.record_type==='lab'?C.blueLight:r.record_type==='imaging'?C.amberLight:r.record_type==='procedure'?C.brownLight:C.greenLight,
          title: r.title,
          sub: `${r.institutions?.name||'Unknown'} · ${r.record_type}`,
          date: new Date(r.date_of_record).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'}),
          src: r.source==='synced'?'Synced':'Manual',
          details: [['Diagnosis',r.diagnosis||'—'],['Notes',r.notes||'—'],['Department',r.department||'—']],
        })) : [
          {id:1,icon:'◎',bg:C.blueLight,title:'Blood panel — full CBC',sub:'Queen Elizabeth Hospital · Lab',date:'12 Jun 2025',src:'Synced',details:[['Haemoglobin','13.8 g/dL ✓'],['WBC','6.2 × 10⁹/L ✓'],['Glucose','5.9 mmol/L ↑'],['Ordered by','Dr Chan Siu-ming']]},
          {id:2,icon:'◈',bg:C.greenLight,title:'General check-up',sub:'Matilda International · Visit',date:'3 May 2025',src:'Synced',details:[['Blood pressure','118/76 mmHg ✓'],['BMI','22.4'],['Heart rate','72 bpm ✓'],['Notes','Mild iron deficiency']]},
          {id:3,icon:'▣',bg:C.amberLight,title:'Chest X-ray',sub:'Ruttonjee Hospital · Imaging',date:'18 Feb 2025',src:'Synced',details:[['Findings','No active TB. Lungs clear.'],['Radiologist','Dr Lam Wai-yee']]},
          {id:4,icon:'◇',bg:C.brownLight,title:'Allergy test results',sub:'Uploaded manually · PDF',date:'9 Jan 2025',src:'Manual',details:[['Penicillin','⚠ Severe allergy'],['Verified by','Pending review']]},
        ]).map(r=>(
          <Card key={r.id} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>
            <div style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
              <div style={{width:38,height:38,borderRadius:'10px',background:r.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',color:C.green,flexShrink:0}}>{r.icon}</div>
              <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{mt(r.title)}</div><div style={{fontSize:'12px',color:C.textSub}}>{mt(r.sub)}</div></div>
              <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:'11px',color:C.textMuted}}>{r.date}</div><span style={{fontSize:'10px',background:r.src==='Synced'?C.greenLight:C.brownLight,color:r.src==='Synced'?C.green:C.brown,padding:'2px 8px',borderRadius:'20px',fontWeight:500}}>{mt(r.src)}</span></div>
            </div>
            {expanded===r.id&&<div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}>
              {r.details.map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:'12px'}}><span style={{color:C.textSub}}>{mt(l)}</span><span style={{fontWeight:500}}>{mt(v)}</span></div>)}
              <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
                <Btn style={{flex:1,fontSize:'12px'}}>Share</Btn>
                <Btn style={{flex:1,fontSize:'12px'}}>Download</Btn>
                <Btn variant="primary" style={{flex:1,fontSize:'12px'}}>View full</Btn>
              </div>
            </div>}
          </Card>
        ))}
      </>}
      {tab==='vax'&&<>
        <SecLabel>{isEn?'Vaccination passport':'疫苗接種護照'}</SecLabel>
        {vaccines.map(v=>(
          <Card key={v.name}>
            <div style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'14px',fontWeight:500}}>{mt(v.name)}</span><Badge text={mt(v.label)} type={v.status}/></div>
            <div style={{padding:'0 16px 14px'}}>
              {v.doses.map(([d,date])=>(
                <div key={d} style={{display:'flex',gap:'10px',alignItems:'center',padding:'5px 0',borderTop:`0.5px solid ${C.border}`}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:v.status==='full'?C.amber:C.green,flexShrink:0}}/>
                  <div style={{flex:1,fontSize:'12px',color:C.textSub}}><strong style={{color:C.text}}>{mt(d)}</strong></div>
                  <span style={{fontSize:'11px',color:C.textMuted}}>{date}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
        <div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}}>📅 {isEn?'Book overdue vaccinations':'預約逾期疫苗'}</Btn></div>
      </>}
      {tab==='sharing'&&<>
        <SecLabel>{isEn?'Who can see your records':'誰可以查看您的記錄'}</SecLabel>
        <Card>
          {providers.map((p,i)=>(
            <div key={p.init} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center',borderBottom:i<providers.length-1?`0.5px solid ${C.border}`:'none'}}>
              <div style={{width:36,height:36,borderRadius:'10px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:600,flexShrink:0}}>{p.init}</div>
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
        <div style={{margin:'0 16px 10px',border:`1.5px dashed ${C.border}`,borderRadius:'14px',padding:'28px 20px',textAlign:'center',background:C.cream,cursor:'pointer'}}>
          <div style={{fontSize:'32px',color:C.green,marginBottom:'10px'}}>◈</div>
          <div style={{fontSize:'14px',fontWeight:500,marginBottom:'4px'}}>{isEn?'Tap to upload':'點擊上傳'}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>{isEn?'Non-Medsa hospitals, overseas providers, personal files':'非Medsa醫院、海外醫療機構或個人文件'}</div>
          <div style={{display:'flex',gap:'6px',justifyContent:'center',flexWrap:'wrap'}}>
            {['PDF','JPG/PNG','DICOM','CSV'].map(t=><span key={t} style={{fontSize:'10px',background:C.greenLight,color:C.green,padding:'3px 10px',borderRadius:'20px'}}>{t}</span>)}
          </div>
        </div>
        <Card style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
          <div style={{width:36,height:36,borderRadius:'10px',background:C.amberLight,display:'flex',alignItems:'center',justifyContent:'center',color:C.amber,fontSize:'18px'}}>⏳</div>
          <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:500}}>Allergy test results.pdf</div><div style={{fontSize:'11px',color:C.textSub}}>Uploaded 9 Jan · Awaiting verification</div></div>
          <Btn variant="primary" style={{fontSize:'11px',padding:'6px 10px'}}>Send for review</Btn>
        </Card>
      </>}
    </div>
  )
}

// ── VIDEO CONSULTATION MODAL ─────────────────────────────────────────────────
// Matches iMeddy's model: video call + medical certificate/referral issuance
function VideoCallModal({ doc, isEn, onClose }) {
  const [stage,setStage]=useState('connecting') // connecting | active | ended
  const [docsIssued,setDocsIssued]=useState([])

  useEffect(() => {
    if (stage==='connecting') {
      const t = setTimeout(()=>setStage('active'), 1800)
      return () => clearTimeout(t)
    }
  }, [stage])

  if (!doc) return null

  function requestDoc(type) {
    if (!docsIssued.includes(type)) setDocsIssued([...docsIssued, type])
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:400,display:'flex',flexDirection:'column'}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#fff',padding:'24px'}}>
        {stage==='connecting'&&<>
          <div style={{width:80,height:80,borderRadius:'50%',background:C.greenLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',fontWeight:600,color:C.green,marginBottom:'16px'}}>{doc.init}</div>
          <div style={{fontSize:'16px',fontWeight:600,marginBottom:'6px'}}>{doc.name}</div>
          <div style={{fontSize:'13px',opacity:0.7,marginBottom:'24px'}}>{isEn?'Connecting…':'連接中…'}</div>
          <div style={{width:36,height:36,border:'3px solid rgba(255,255,255,0.2)',borderTop:'3px solid #fff',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{position:'absolute',bottom:40}}>
            <Btn variant="danger" onClick={onClose}>{isEn?'Cancel':'取消'}</Btn>
          </div>
        </>}
        {stage==='active'&&<>
          <div style={{width:'100%',maxWidth:360,aspectRatio:'3/4',background:'#1a1a1a',borderRadius:'16px',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'16px',position:'relative'}}>
            <div style={{width:80,height:80,borderRadius:'50%',background:C.greenLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',fontWeight:600,color:C.green}}>{doc.init}</div>
            <div style={{position:'absolute',top:12,right:12,background:'rgba(0,0,0,0.5)',borderRadius:'20px',padding:'4px 10px',fontSize:'11px'}}>● {isEn?'Live':'直播中'}</div>
            <div style={{position:'absolute',bottom:12,left:12,width:56,height:74,background:'#333',borderRadius:'8px',border:'1.5px solid rgba(255,255,255,0.3)'}}/>
          </div>
          <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px'}}>{doc.name}</div>
          <div style={{fontSize:'12px',opacity:0.7,marginBottom:'20px'}}>{dt(doc.spec)}</div>
          <div style={{display:'flex',gap:'16px'}}>
            <button style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',fontSize:'20px',cursor:'pointer'}}>◉</button>
            <button onClick={()=>setStage('ended')} style={{width:52,height:52,borderRadius:'50%',background:C.red,border:'none',color:'#fff',fontSize:'20px',cursor:'pointer'}}>✕</button>
            <button style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',fontSize:'20px',cursor:'pointer'}}>◈</button>
          </div>
        </>}
        {stage==='ended'&&<div style={{background:C.cream,borderRadius:'16px',padding:'24px',width:'100%',maxWidth:400,color:C.text}}>
          <div style={{textAlign:'center',marginBottom:'16px'}}>
            <div style={{fontSize:'32px',marginBottom:'8px'}}>✓</div>
            <div style={{fontSize:'16px',fontWeight:700}}>{isEn?'Consultation complete':'問診完成'}</div>
            <div style={{fontSize:'12px',color:C.textSub,marginTop:'4px'}}>{doc.name} · {dt(doc.spec)}</div>
          </div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px',fontWeight:600}}>{isEn?'Request documents':'索取文件'}</div>
          {[
            {key:'certificate',label:isEn?'Medical certificate':'醫療證明書'},
            {key:'sickleave',label:isEn?'Sick leave note':'病假紙'},
            {key:'referral',label:isEn?'Referral letter':'轉介信'},
          ].map(d=>(
            <div key={d.key} onClick={()=>requestDoc(d.key)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:C.card,borderRadius:'10px',marginBottom:'8px',cursor:'pointer'}}>
              <span style={{fontSize:'13px'}}>{d.label}</span>
              {docsIssued.includes(d.key)
                ?<span style={{fontSize:'11px',color:C.green,fontWeight:600}}>✓ {isEn?'Issued':'已發出'}</span>
                :<span style={{fontSize:'11px',color:C.green}}>{isEn?'Request':'索取'} ›</span>}
            </div>
          ))}
          <Btn variant="primary" style={{width:'100%',marginTop:'8px'}} onClick={onClose}>{isEn?'Done':'完成'}</Btn>
        </div>}
      </div>
    </div>
  )
}

function DoctorsScreen({ isEn, patient={} }) {
  const [tab,setTab]=useState('search')
  const [selTime,setSelTime]=useState('10:30am')
  const [selLang,setSelLang]=useState('廣東話')
  const [booked,setBooked]=useState(false)
  const [sortBy,setSortBy]=useState('distance')
  const [videoCallDoc,setVideoCallDoc]=useState(null)
  const [whatsappReminder,setWhatsappReminder]=useState(true)
  const [selectedDoctor,setSelectedDoctor]=useState(null)
  const [consultType,setConsultType]=useState('in-person') // 'in-person' | 'video'
  const [reasonForVisit,setReasonForVisit]=useState('')
  const [symptoms,setSymptoms]=useState('')
  const [currentMeds,setCurrentMeds]=useState('')
  const [intakeConsent,setIntakeConsent]=useState(true) // opt-out: consented by default, patient can uncheck
  const [intakeSaving,setIntakeSaving]=useState(false)
  const [intakeError,setIntakeError]=useState(null)
  const doctors=[
    {init:'陳',name:'Dr Chan Siu-ming',spec:'General Practice',clinic:'Pacific Medical Group · Wan Chai',institution:'clinic_ops',rating:'4.9',avail:'Today',type:'ok',distanceKm:0.8,videoAvail:true},
    {init:'林',name:'Dr Lam Wai-yee',spec:'Cardiologist',clinic:'Pacific Medical Group · Wan Chai',institution:'clinic_ops',rating:'4.8',avail:'Tomorrow',type:'due',distanceKm:0.8,videoAvail:false},
    {init:'楊',name:'Dr Yeung Chi-hong',spec:'Internal Medicine',clinic:'QE Hospital · Yau Ma Tei',institution:'practitioner',rating:'4.8',avail:'Today',type:'ok',distanceKm:2.4,videoAvail:true},
    {init:'何',name:'Dr Ho Ka-fai',spec:'Cardiologist',clinic:'QE Hospital · Yau Ma Tei',institution:'practitioner',rating:'4.7',avail:'Tomorrow',type:'due',distanceKm:2.4,videoAvail:false},
    {init:'曾',name:'Dr Tsang Wing-lam',spec:'Cardiologist',clinic:'QE Hospital · Yau Ma Tei',institution:'practitioner',rating:'4.9',avail:'Today',type:'ok',distanceKm:2.4,videoAvail:true},
    {init:'黃',name:'Dr Wong Mei-ling',spec:'TCM Practitioner',clinic:'Tong Wah TCM · Sham Shui Po',institution:null,rating:'4.6',avail:'Today',type:'ok',distanceKm:5.1,videoAvail:true},
    {init:'鄭',name:'Dr Cheng Ka-wai',spec:'Psychiatrist',clinic:'Mind Health HK · Central',institution:null,rating:'4.9',avail:'Thu',type:'due',distanceKm:1.5,videoAvail:true},
    {init:'李',name:'Dr Lee Tak-shing',spec:'Dentist',clinic:'Smile Dental · Causeway Bay',institution:null,rating:'4.5',avail:'Fully booked',type:'full',distanceKm:2.1,videoAvail:false},
  ]
  // Doctor specialty and clinic/location terms were never translated -
  // shown in English regardless of selected language. Translated here at
  // render time rather than restructuring the whole doctors array.
  const DR_TERM_ZH = {
    'General Practice':'全科','Cardiologist':'心臟科專科醫生','Internal Medicine':'內科','TCM Practitioner':'中醫師',
    'Psychiatrist':'精神科專科醫生','Dentist':'牙醫',
    'Pacific Medical Group':'太平醫療集團','QE Hospital':'伊利沙伯醫院','Tong Wah TCM':'東華中醫',
    'Mind Health HK':'心靈健康香港','Smile Dental':'笑容牙科',
    'Wan Chai':'灣仔','Yau Ma Tei':'油麻地','Sham Shui Po':'深水埗','Central':'中環','Causeway Bay':'銅鑼灣',
  }
  function dt(term) {
    if (isEn || !term) return term
    return term.split(' · ').map(part => DR_TERM_ZH[part] || part).join(' · ')
  }
  const sortedDoctors = [...doctors].sort((a,b)=>{
    if (sortBy==='distance') return a.distanceKm - b.distanceKm
    if (sortBy==='rating') return parseFloat(b.rating) - parseFloat(a.rating)
    return 0
  })
  const TIMES=['9:00am','9:30am','10:00am','10:30am','11:00am','2:00pm','2:30pm','3:00pm']
  // Real upcoming dates starting today, not a fixed hardcoded month - this
  // is what makes the 48-hour consent window actually testable against
  // the real current time, instead of always landing in the past.
  const DAY_LABELS=['SUN','MON','TUE','WED','THU','FRI','SAT']
  const DAYS = Array.from({length:5}, (_,i) => {
    const d = new Date()
    d.setDate(d.getDate()+i)
    return { label: DAY_LABELS[d.getDay()], date: d.getDate(), fullDate: d }
  })
  const [selDay,setSelDay]=useState(DAYS[0].fullDate)
  // Unavailable slots vary by day so every day doesn't look identical -
  // seeded off the date itself so it's consistent on re-render, not random.
  function unavailForDay(dateObj) {
    const seed = dateObj.getDate()
    const pool = ['9:00am','9:30am','10:00am','10:30am','11:00am','2:00pm','2:30pm','3:00pm']
    return pool.filter((_,i) => (seed + i) % 3 === 0)
  }
  const UNAVAIL = unavailForDay(selDay)

  function handleBookClick(doc, type) {
    setSelectedDoctor(doc)
    setConsultType(type)
    setBooked(false)
    setTab('book')
  }

  const activeDoctor = selectedDoctor || doctors[0]

  async function handleConfirmBooking() {
    if (!intakeConsent) return
    setIntakeSaving(true)
    setIntakeError(null)
    try {
      const medsaId = patient?.medsa_id
      const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
      if (!patientRow) throw new Error('Could not find your profile - try again in a moment.')

      // Build the actual appointment datetime from the selected day/time,
      // using the real Date object picked in the calendar - not a fragile
      // day-of-month string, so this works correctly across month/year
      // boundaries too.
      const timeMatch = selTime.match(/(\d+):(\d+)(am|pm)/i)
      let hour = timeMatch ? parseInt(timeMatch[1]) : 10
      const minute = timeMatch ? parseInt(timeMatch[2]) : 0
      if (timeMatch && timeMatch[3].toLowerCase()==='pm' && hour!==12) hour += 12
      const apptDate = new Date(selDay)
      apptDate.setHours(hour, minute, 0, 0)

      // The full window is genuinely 48 hours: 12 hours before the
      // appointment day starts, the entire appointment day itself (24h),
      // and 12 hours after the appointment day ends - not just 12h either
      // side of the exact appointment minute.
      const dayStart = new Date(apptDate); dayStart.setHours(0,0,0,0)
      const dayEnd = new Date(apptDate); dayEnd.setHours(23,59,59,999)
      const windowStart = new Date(dayStart.getTime() - 12*60*60*1000)
      const windowEnd = new Date(dayEnd.getTime() + 12*60*60*1000)

      const { error: insErr } = await supabase.from('appointment_intake').insert({
        patient_id: patientRow.id,
        appointment_time: apptDate.toISOString(),
        doctor_name: activeDoctor.name,
        reason_for_visit: reasonForVisit || null,
        symptoms: symptoms || null,
        current_medications: currentMeds || null,
        consent_given: true,
        consent_given_at: new Date().toISOString(),
        access_window_start: windowStart.toISOString(),
        access_window_end: windowEnd.toISOString(),
      })
      if (insErr) throw insErr

      // This is the piece that was actually missing: booking only ever
      // wrote the consent record above, never a real appointment the
      // clinic side could see. Try to link a real practitioner_id if one
      // matches this doctor's name; otherwise fall back to doctor_name as
      // plain text so the booking still shows up either way.
      const { data: practitionerRow } = await supabase.from('practitioners').select('id').ilike('full_name', `%${activeDoctor.name.replace('Dr ','')}%`).maybeSingle()
      const { data: institutionRow } = await supabase.from('institutions').select('id').eq('name', 'Pacific Medical Group').maybeSingle()

      const { error: apptErr } = await supabase.from('appointments').insert({
        patient_id: patientRow.id,
        practitioner_id: practitionerRow?.id || null,
        institution_id: institutionRow?.id || null,
        institution_source: activeDoctor.institution || null,
        doctor_name: activeDoctor.name,
        department: activeDoctor.spec || null,
        scheduled_at: apptDate.toISOString(),
        appointment_type: reasonForVisit || activeDoctor.spec || 'Consultation',
        consult_type: consultType,
        status: 'confirmed',
        reason_for_visit: reasonForVisit || null,
        patient_pays: 80,
      })
      if (apptErr) throw apptErr
      setBooked(true)
    } catch (e) {
      setIntakeError(e.message)
    } finally {
      setIntakeSaving(false)
    }
  }

  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{background:C.green,padding:'0 16px 14px'}}>
        <div style={{position:'relative',display:'flex',alignItems:'center'}}>
          <span style={{position:'absolute',left:'10px',fontSize:'16px',color:C.green}}>◎</span>
          <input style={{width:'100%',background:'rgba(255,255,255,0.95)',border:'none',borderRadius:'10px',padding:'10px 12px 10px 34px',fontSize:'14px',outline:'none'}} placeholder={isEn?'Search by name, specialty, clinic…':'按名稱、專科搜尋…'}/>
        </div>
      </div>
      <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`}}>
        {[['search',isEn?'Find doctors':'尋找醫生'],['book',isEn?'Book':'預約'],['payments',isEn?'Payments':'付款']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'11px 8px',fontSize:'12px',fontWeight:500,color:tab===k?C.green:C.textSub,textAlign:'center',borderBottom:`2px solid ${tab===k?C.green:'transparent'}`,cursor:'pointer'}}>{l}</div>
        ))}
      </div>
      {tab==='search'&&<>
        <div style={{padding:'12px 16px 4px',display:'flex',gap:'8px',alignItems:'center'}}>
          <span style={{fontSize:'12px',color:C.textSub}}>{isEn?'Sort by':'排序方式'}</span>
          {[['distance',isEn?'Nearest':'最近'],['rating',isEn?'Top rated':'評分最高']].map(([k,l])=>(
            <div key={k} onClick={()=>setSortBy(k)} style={{fontSize:'11px',padding:'5px 12px',borderRadius:'20px',cursor:'pointer',background:sortBy===k?C.green:C.card,color:sortBy===k?'#fff':C.textSub,fontWeight:500}}>{l}</div>
          ))}
        </div>
        <SecLabel>{isEn?'Doctors near you · Wan Chai':'附近的醫生 · 灣仔'}</SecLabel>
        {sortedDoctors.map((doc,i)=>(
          <Card key={i}>
            <div style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
              <div style={{width:48,height:48,borderRadius:'12px',background:C.greenLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:600,color:C.green,flexShrink:0}}>{doc.init}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'14px',fontWeight:500}}>{doc.name}</div>
                <div style={{fontSize:'12px',color:C.green,fontWeight:500}}>{dt(doc.spec)}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{dt(doc.clinic)}</div>
                <div style={{display:'flex',gap:'8px',marginTop:'4px',alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontSize:'11px',color:C.textMuted}}>◇ {doc.distanceKm}km</span>
                  {doc.videoAvail&&<span style={{fontSize:'10px',background:C.blueLight,color:C.blue,padding:'2px 8px',borderRadius:'20px',fontWeight:500}}>◈ {isEn?'Video available':'視像問診'}</span>}
                  {doc.institution==='clinic_ops'&&<span style={{fontSize:'10px',background:C.greenLight,color:C.green,padding:'2px 8px',borderRadius:'20px',fontWeight:500}}>{isEn?'Medsa Clinic':'Medsa診所'}</span>}
                  {doc.institution==='practitioner'&&<span style={{fontSize:'10px',background:C.amberLight,color:C.amber,padding:'2px 8px',borderRadius:'20px',fontWeight:500}}>{isEn?'Medsa Hospital':'Medsa醫院'}</span>}
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:'12px',color:'#d4a017'}}>★★★★★</div><div style={{fontSize:'10px',color:C.textMuted}}>{doc.rating}</div><Badge text={doc.avail} type={doc.type}/></div>
            </div>
            <div style={{borderTop:`0.5px solid ${C.border}`,padding:'10px 16px',display:'flex',gap:'8px'}}>
              <Btn style={{flex:1,fontSize:'12px'}}>Profile</Btn>
              {doc.type==='full'
                ?<Btn variant="primary" style={{flex:1,fontSize:'12px',opacity:0.5}} disabled>Full</Btn>
                :<Btn variant="primary" style={{flex:1,fontSize:'12px'}} onClick={()=>handleBookClick(doc, doc.videoAvail?'video':'in-person')}>{isEn?'Book':'預約'}</Btn>}
            </div>
          </Card>
        ))}
      </>}
      {tab==='book'&&<>
        <SecLabel>{isEn?'New appointment':'新預約'}</SecLabel>
        <Card style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:C.greenLight,color:C.green,fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>✓</div>
          <div><div style={{fontSize:'14px',fontWeight:500}}>{activeDoctor.name}</div><div style={{fontSize:'12px',color:C.textSub}}>{dt(activeDoctor.spec)} · {dt(activeDoctor.clinic)}</div></div>
        </Card>

        {activeDoctor.videoAvail&&<Card style={{padding:'14px 16px'}}>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'10px'}}>{isEn?'Consultation type':'診症方式'}</div>
          <div style={{display:'flex',gap:'8px'}}>
            {[['in-person',isEn?'In-person':'親身診症'],['video',isEn?'Video call':'視像診症']].map(([k,l])=>(
              <div key={k} onClick={()=>setConsultType(k)} style={{flex:1,padding:'10px',borderRadius:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:'pointer',background:consultType===k?C.green:C.card,color:consultType===k?'#fff':C.text}}>{l}</div>
            ))}
          </div>
        </Card>}

        <Card>
          <div style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}><div style={{width:28,height:28,borderRadius:'50%',background:C.green,color:'#fff',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>2</div><div style={{fontSize:'14px',fontWeight:500}}>{isEn?'Date & time':'日期與時間'}</div></div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}>
            <div style={{display:'flex',gap:'8px',overflowX:'auto',marginBottom:'12px'}}>
              {DAYS.map(({label,date,fullDate})=>{
                const isSel = fullDate.toDateString()===selDay.toDateString()
                return (
                <div key={fullDate.toISOString()} onClick={()=>{setSelDay(fullDate);if(unavailForDay(fullDate).includes(selTime)){const firstFree=TIMES.find(t=>!unavailForDay(fullDate).includes(t));if(firstFree)setSelTime(firstFree)}}} style={{flexShrink:0,textAlign:'center',padding:'8px 14px',borderRadius:'10px',background:isSel?C.green:C.card,color:isSel?'#fff':C.text,cursor:'pointer',border:`0.5px solid ${isSel?C.green:C.border}`}}>
                  <div style={{fontSize:'10px',opacity:0.8}}>{label}</div><div style={{fontSize:'16px',fontWeight:600}}>{date}</div>
                </div>
                )
              })}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
              {TIMES.map(t=>{const u=UNAVAIL.includes(t);const s=t===selTime;return(
                <div key={t} onClick={()=>!u&&setSelTime(t)} style={{border:`0.5px solid ${s?C.green:C.border}`,borderRadius:'8px',padding:'8px',textAlign:'center',fontSize:'12px',fontWeight:500,cursor:u?'not-allowed':'pointer',background:s?C.green:u?C.beige:C.card,color:s?'#fff':u?C.textMuted:C.text,opacity:u?0.5:1}}>{t}</div>
              )})}
            </div>
          </div>
        </Card>
        <Card>
          <div style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}><div style={{width:28,height:28,borderRadius:'50%',background:C.green,color:'#fff',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>3</div><div style={{fontSize:'14px',fontWeight:500}}>{isEn?'Language':'語言'}</div></div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
            {['廣東話','English','普通話','日本語'].map(l=>(
              <div key={l} onClick={()=>setSelLang(l)} style={{border:`0.5px solid ${selLang===l?C.green:C.border}`,borderRadius:'8px',padding:'10px',textAlign:'center',fontSize:'13px',fontWeight:500,cursor:'pointer',background:selLang===l?C.green:C.card,color:selLang===l?'#fff':C.text}}>{l}</div>
            ))}
          </div></div>
        </Card>
        <Card>
          <div style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}><div style={{width:28,height:28,borderRadius:'50%',background:C.green,color:'#fff',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>4</div><div style={{fontSize:'14px',fontWeight:500}}>{isEn?'Intake form':'問診表'}</div></div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>{isEn?'Reason for visit':'求診原因'}</div>
            <input value={reasonForVisit} onChange={e=>setReasonForVisit(e.target.value)} placeholder={isEn?'e.g. Persistent cough':'例如：持續咳嗽'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box'}}/>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>{isEn?'Symptoms':'症狀'}</div>
            <textarea value={symptoms} onChange={e=>setSymptoms(e.target.value)} rows={3} placeholder={isEn?'Describe what you\\u2019re experiencing…':'描述您的症狀…'} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'12px',boxSizing:'border-box',resize:'none',fontFamily:'inherit'}}/>
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
            <div onClick={()=>setIntakeConsent(!intakeConsent)} style={{display:'flex',gap:'10px',alignItems:'flex-start',padding:'12px',background:intakeConsent?C.greenXLight:C.card,border:`0.5px solid ${intakeConsent?C.green:C.border}`,borderRadius:'10px',cursor:'pointer'}}>
              <div style={{width:18,height:18,borderRadius:'4px',border:`1.5px solid ${intakeConsent?C.green:C.border}`,background:intakeConsent?C.green:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'#fff',flexShrink:0,marginTop:'1px'}}>{intakeConsent?'\u2713':''}</div>
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
          <div style={{padding:'14px 16px',display:'flex',gap:'10px',alignItems:'center'}}><div style={{width:28,height:28,borderRadius:'50%',background:C.green,color:'#fff',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>5</div><div style={{fontSize:'14px',fontWeight:500}}>{isEn?'Confirm & pay':'確認與付款'}</div></div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}>
            <div style={{background:C.greenXLight,borderRadius:'10px',padding:'14px',marginBottom:'12px'}}>
              {[[isEn?'Doctor':'醫生',activeDoctor.name],[isEn?'Type':'診症方式',consultType==='video'?(isEn?'Video call':'視像診症'):(isEn?'In-person':'親身診症')],[isEn?'Date':'日期',`${selDay.toLocaleDateString('en-HK',{weekday:'short',day:'numeric',month:'short'})} · ${selTime}`],[isEn?'Language':'語言',selLang],[isEn?'Consultation fee':'診金','HK$380'],[isEn?'AIA covers':'AIA承保','HK$300'],[isEn?'You pay':'您需支付','HK$80']].map(([l,v],i,arr)=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:'13px'}}><span style={{color:C.green,fontWeight:500}}>{l}</span><span style={{fontWeight:i===arr.length-1?700:400}}>{v}</span></div>
              ))}
            </div>
            <div onClick={()=>setWhatsappReminder(!whatsappReminder)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:C.card,borderRadius:'10px',marginBottom:'12px',cursor:'pointer'}}>
              <div style={{width:34,height:18,borderRadius:20,background:whatsappReminder?C.green:C.border,position:'relative',flexShrink:0}}>
                <div style={{position:'absolute',top:2,left:whatsappReminder?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:500}}>{isEn?'WhatsApp reminders':'WhatsApp提醒'}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{isEn?'Get appointment reminders via WhatsApp':'透過WhatsApp接收預約提醒'}</div>
              </div>
              <span style={{fontSize:'18px',color:'#25D366'}}>◈</span>
            </div>
            {!intakeConsent&&<div style={{fontSize:'11px',color:C.amber,marginBottom:'10px',textAlign:'center'}}>{isEn?'Complete the intake consent above to continue':'請先完成上方的問診同意'}</div>}
            <Btn variant="primary" style={{width:'100%'}} onClick={handleConfirmBooking} disabled={!intakeConsent||intakeSaving}>{intakeSaving?(isEn?'Confirming…':'確認中…'):(isEn?'Confirm appointment':'確認預約')}</Btn>
          </div>
        </Card>
        {booked&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:C.cream,borderRadius:'20px',width:'90%',maxWidth:380,padding:'32px 24px',textAlign:'center'}}>
            <div style={{fontSize:'40px',marginBottom:'12px'}}>✓</div>
            <div style={{fontSize:'18px',fontWeight:700,marginBottom:'8px'}}>{isEn?'Appointment confirmed':'預約已確認'}</div>
            <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.5}}>{activeDoctor.name} · {selDay.toLocaleDateString('en-HK',{weekday:'short',day:'numeric',month:'short'})} at {selTime}</div>
            {consultType==='video'
              ? <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  <Btn variant="primary" style={{width:'100%'}} onClick={()=>{setVideoCallDoc(activeDoctor);setBooked(false)}}>{isEn?'Join video call now (demo)':'立即加入視像通話（示範）'}</Btn>
                  <div style={{fontSize:'10px',color:C.textMuted}}>{isEn?'In production, this unlocks at your actual appointment time.':'實際運作時，此按鈕將於預約時間開放。'}</div>
                  <Btn style={{width:'100%'}} onClick={()=>setBooked(false)}>{isEn?'Close':'關閉'}</Btn>
                </div>
              : <Btn variant="primary" style={{width:'100%'}} onClick={()=>setBooked(false)}>Done</Btn>}
          </div>
        </div>}
      </>}
      {tab==='payments'&&<>
        <SecLabel>{isEn?'Outstanding':'待付款'}</SecLabel>
        <Card style={{padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><div style={{fontSize:'14px',fontWeight:500}}>Dr Chan — Jun 12</div><Badge text="Due HK$80" type="due"/></div>
          {[['Consultation fee','HK$380'],['AIA covered','−HK$300'],['Balance','HK$80']].map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:'12px',padding:'3px 0'}}><span style={{color:C.textSub}}>{l}</span><span style={{fontWeight:500}}>{v}</span></div>)}
          <div style={{display:'flex',gap:'8px',marginTop:'12px'}}><Btn style={{flex:1,fontSize:'12px'}}>Receipt</Btn><Btn variant="primary" style={{flex:1,fontSize:'12px'}}>Pay HK$80</Btn></div>
        </Card>
        <SecLabel>{isEn?'Recent payments':'最近付款'}</SecLabel>
        {[{title:'Ruttonjee Hospital — Feb 18',amount:'HK$1,200',status:'Paid',type:'ok'},{title:'Matilda International — May 3',amount:'HK$680',status:'Refund pending',type:'due'}].map((p,i)=>(
          <Card key={i} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:'13px',fontWeight:500}}>{p.title}</div></div>
            <div style={{textAlign:'right'}}><div style={{fontSize:'14px',fontWeight:600,color:C.green}}>{p.amount}</div><Badge text={p.status} type={p.type}/></div>
          </Card>
        ))}
      </>}
      <VideoCallModal doc={videoCallDoc} isEn={isEn} onClose={()=>setVideoCallDoc(null)}/>
    </div>
  )
}

function MedAlarmCard({ med, schedule, next, defaultOn, defaultTime, isEn }) {
  const [on,setOn]=useState(defaultOn)
  const [t,setT]=useState(defaultTime)
  return (
    <Card style={{padding:'14px 16px'}}>
      <div style={{display:'flex',gap:'12px',alignItems:'center',marginBottom:on?'12px':'0'}}>
        <div style={{width:36,height:36,borderRadius:'10px',background:C.brownLight,display:'flex',alignItems:'center',justifyContent:'center',color:C.brown,fontSize:'18px'}}>◉</div>
        <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:500}}>{med}</div><div style={{fontSize:'11px',color:C.textSub}}>{schedule} · Next: {next}</div></div>
        <div onClick={()=>setOn(!on)} style={{width:34,height:18,borderRadius:20,background:on?C.green:C.border,cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}><div style={{position:'absolute',top:2,left:on?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/></div>
      </div>
      {on&&<div style={{display:'flex',alignItems:'center',gap:'10px',paddingTop:'10px',borderTop:`0.5px solid ${C.border}`}}>
        <span style={{fontSize:'12px',color:C.textSub}}>{isEn?'Alarm at':'鬧鐘'}</span>
        <input type="time" value={t} onChange={e=>setT(e.target.value)} style={{border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'6px 10px',fontSize:'13px',background:C.beige,outline:'none'}}/>
        <span style={{fontSize:'11px',color:C.green,fontWeight:500}}>● Active</span>
      </div>}
    </Card>
  )
}

function CalendarScreen({ isEn, appointments=[], medications=[] }) {
  const [viewMonth,setViewMonth]=useState(() => { const d=new Date(); d.setDate(1); return d })
  const [selectedDate,setSelectedDate]=useState(() => new Date())

  function changeMonth(delta) {
    setViewMonth(prev => { const d=new Date(prev); d.setMonth(d.getMonth()+delta); return d })
  }

  const monthLabel = viewMonth.toLocaleDateString(isEn?'en-HK':'zh-HK',{month:'long',year:'numeric'})
  const firstWeekday = (viewMonth.getDay()+6)%7 // Monday-first grid
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 0).getDate()
  const today = new Date()
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
              <div key={d} onClick={()=>setSelectedDate(cellDate)} style={{textAlign:'center',fontSize:'13px',padding:'6px 2px',borderRadius:'50%',cursor:'pointer',background:isSelected?C.green:isToday?C.greenLight:'transparent',color:isSelected?'#fff':hasEvent?C.green:C.text,fontWeight:isSelected||isToday?600:400}}>
                {d}
                {hasEvent&&!isSelected&&<div style={{width:4,height:4,borderRadius:'50%',background:C.green,margin:'2px auto 0'}}/>}
              </div>
            )
          })}
        </div>
      </div>
      <SecLabel>{isEn?'Upcoming':'即將到來'}</SecLabel>
      {appointments.length>0 ? appointments.map((appt,i)=>{
        const dt = new Date(appt.scheduled_at)
        const timeStr = dt.toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Hong_Kong'})
        const dateStr = dt.toLocaleDateString('en-HK',{weekday:'short',day:'numeric',month:'short',timeZone:'Asia/Hong_Kong'})
        const drName = appt.practitioners?.full_name ? 'Dr '+appt.practitioners.full_name.split(',')[0] : appt.appointment_type
        return(
          <Card key={i} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
            <div style={{width:40,height:40,borderRadius:'12px',background:C.greenLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.green,flexShrink:0}}>◎</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'14px',fontWeight:500}}>{drName}</div>
              <div style={{fontSize:'12px',color:C.textSub}}>{appt.institutions?.name||'—'}</div>
              <span style={{fontSize:'10px',background:appt.status==='confirmed'?C.greenLight:C.amberLight,color:appt.status==='confirmed'?C.green:C.amber,padding:'1px 8px',borderRadius:'20px',fontWeight:500}}>{appt.status}</span>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:'12px',fontWeight:600}}>{timeStr}</div>
              <div style={{fontSize:'11px',color:C.textMuted}}>{dateStr}</div>
              {appt.patient_pays>0&&<div style={{fontSize:'11px',color:C.amber}}>HK${appt.patient_pays} due</div>}
            </div>
          </Card>
        )
      }) : [
        {time:'10:30 am',date:'Tue 24 Jun',title:'Dr Chan Siu-ming',sub:'Pacific Medical Group · Wan Chai',bg:C.greenLight,icon:'◎'},
        {time:'8:00 pm',date:'Tue 24 Jun',title:'Metformin 500mg',sub:'Take with dinner · Daily',bg:C.brownLight,icon:'◉'},
        {time:'9:00 am',date:'Fri 27 Jun',title:'Flu vaccine — booking pending',sub:'Pacific Medical Group',bg:C.amberLight,icon:'◈'},
      ].map((e,i)=>(
        <Card key={i} style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'center'}}>
          <div style={{width:40,height:40,borderRadius:'12px',background:e.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.green,flexShrink:0}}>{e.icon}</div>
          <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{e.title}</div><div style={{fontSize:'12px',color:C.textSub}}>{e.sub}</div></div>
          <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:'12px',fontWeight:600}}>{e.time}</div><div style={{fontSize:'11px',color:C.textMuted}}>{e.date}</div></div>
        </Card>
      ))}
      <SecLabel>{isEn?'Medication alarms':'用藥鬧鐘'}</SecLabel>
      {medications.length>0 ? medications.filter(m=>m.alarm_enabled||m.alarm_time).map((m,i)=>(
        <MedAlarmCard key={i} med={`${m.medication_name} ${m.dosage||''}`.trim()} schedule={m.frequency||'As prescribed'} next="Check schedule" defaultOn={m.alarm_enabled||false} defaultTime={m.alarm_time?.slice(0,5)||'08:00'} isEn={isEn}/>
      )) : <>
        <MedAlarmCard med="Metformin 500mg" schedule="Daily with dinner" next="Tonight 8pm" defaultOn={true} defaultTime="20:00" isEn={isEn}/>
        <MedAlarmCard med="Vitamin D3 1000IU" schedule="Daily with breakfast" next="Tomorrow 8am" defaultOn={true} defaultTime="08:00" isEn={isEn}/>
        <MedAlarmCard med="Iron supplement 14mg" schedule="Every other day" next="Thu morning" defaultOn={false} defaultTime="09:00" isEn={isEn}/>
      </>}
      <div style={{padding:'0 16px 16px'}}><Btn variant="primary" style={{width:'100%'}}>+ {isEn?'Add reminder':'新增提醒'}</Btn></div>
    </div>
  )
}

// ── CLAIMS TAB ───────────────────────────────────────────────────────────────
function ClaimsTab({ isEn, claims=[] }) {
  const hasLiveClaims = claims.length > 0
  const [claimType,setClaimType]=useState(null)
  const [checklist,setChecklist]=useState({})
  const [bundleReady,setBundleReady]=useState(false)

  // Documents that already exist in this patient's Medsa records
  // In production these would be queried from the database
  const MEDSA_RECORDS = {
    'Lab results report': {title:'Blood panel — full CBC', date:'12 Jun 2025', institution:'QE Hospital'},
    'Test results report': {title:'Blood panel — full CBC', date:'12 Jun 2025', institution:'QE Hospital'},
    'Lab & imaging reports (if any)': {title:'Chest X-ray + Blood panel', date:'Feb & Jun 2025', institution:'QE Hospital / Ruttonjee'},
    'Prescription copy': {title:'Metformin 500mg + Iron supplement', date:'3 May 2025', institution:'Matilda International'},
    'Diagnosis and treatment notes': {title:'General check-up summary', date:'3 May 2025', institution:'Matilda International'},
    'Patient ID copy': {title:'Wong Mei-ling, Lisa — MDS-84921-HK', date:'On file', institution:'Medsa profile'},
    'Policy number': {title:'AIA Prime Care — Policy #AIA-84921-HK', date:'On file', institution:'Medsa profile'},
  }

  const CLAIM_TYPES=[
    {key:'outpatient',label:'Outpatient visit',icon:'◎',docs:[
      {name:'Consultation receipt',medsa:false},
      {name:'Doctor diagnosis letter or stamp',medsa:false},
      {name:'Patient ID copy',medsa:true},
      {name:'Policy number',medsa:true},
    ]},
    {key:'hospitalisation',label:'Hospitalisation',icon:'▣',docs:[
      {name:'Hospital admission & discharge summary',medsa:false},
      {name:'All receipts and invoices',medsa:false},
      {name:'Doctor report',medsa:false},
      {name:'Lab & imaging reports (if any)',medsa:true},
      {name:'Patient ID copy',medsa:true},
      {name:'Policy number',medsa:true},
    ]},
    {key:'specialist',label:'Specialist consultation',icon:'◈',docs:[
      {name:'Specialist consultation receipt',medsa:false},
      {name:'Referral letter from GP if required',medsa:false},
      {name:'Diagnosis and treatment notes',medsa:true},
      {name:'Patient ID copy',medsa:true},
      {name:'Policy number',medsa:true},
    ]},
    {key:'lab',label:'Lab & imaging',icon:'◉',docs:[
      {name:'Lab or imaging receipt',medsa:false},
      {name:'Test results report',medsa:true},
      {name:'Doctor referral or order',medsa:false},
      {name:'Patient ID copy',medsa:true},
      {name:'Policy number',medsa:true},
    ]},
    {key:'prescription',label:'Prescription / medication',icon:'◇',docs:[
      {name:'Pharmacy receipt',medsa:false},
      {name:'Prescription copy',medsa:true},
      {name:'Doctor diagnosis (if required)',medsa:false},
      {name:'Patient ID copy',medsa:true},
      {name:'Policy number',medsa:true},
    ]},
  ]

  const selectedType = CLAIM_TYPES.find(t=>t.key===claimType)
  // Medsa docs auto-checked, manual docs need patient action
  const getKey = (type,i) => `${type}_${i}`
  const isReady = (doc,key) => doc.medsa || checklist[key]
  const allChecked = selectedType && selectedType.docs.every((doc,i)=>isReady(doc,getKey(claimType,i)))
  const medsaCount = selectedType ? selectedType.docs.filter(d=>d.medsa).length : 0
  const manualCount = selectedType ? selectedType.docs.filter(d=>!d.medsa).length : 0

  return (
    <div>
      {/* Integration notice — greyed out past claims */}
      <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.navy,lineHeight:1.6}}>
        ◈ <strong>Live claim tracking coming with insurer integration.</strong> Once your insurer connects with Medsa, claim submission, status updates, and approvals will sync here automatically.
      </div>

      {/* Greyed out past claims — for reference only */}
      <SecLabel>{isEn?'Past claims (not yet synced)':'過往索賠（尚未同步）'}</SecLabel>
      <div style={{opacity:hasLiveClaims?1:0.4,pointerEvents:hasLiveClaims?'auto':'none'}}>
        {hasLiveClaims ? claims.map((c,i)=>{
          const statusType = c.status==='approved'?'ok':c.status==='rejected'?'full':'due'
          const date = new Date(c.submitted_at).toLocaleDateString('en-HK',{day:'numeric',month:'short'})
          return(
            <Card key={i} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:500}}>{c.claim_ref} · {c.institutions?.name||'—'}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{c.insurance_plans?.plan_name||'—'} · {c.claim_type}</div>
                <div style={{fontSize:'11px',color:C.textMuted}}>Submitted {date}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'14px',fontWeight:600,color:C.green}}>HK${c.plan_covers?.toLocaleString()}</div>
                <Badge text={c.status.charAt(0).toUpperCase()+c.status.slice(1)} type={statusType}/>
              </div>
            </Card>
          )
        }) : <>
          <Card style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:'14px',fontWeight:500}}>Matilda International · May 3</div><div style={{fontSize:'12px',color:C.textSub}}>Check-up · HK$680 · Filed directly with AIA</div></div>
            <Badge text="Pending" type="due"/>
          </Card>
          {[{title:'AIA #44821 · Ruttonjee Hospital',amount:'HK$1,200',date:'Feb 18'},{title:'AIA #43910 · Dr Chan consult',amount:'HK$300',date:'Jan 12'}].map((c,i)=>(
            <Card key={i} style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontSize:'13px',fontWeight:500}}>{c.title}</div><div style={{fontSize:'11px',color:C.textSub}}>{c.date}</div></div>
              <div style={{textAlign:'right'}}><div style={{fontSize:'14px',fontWeight:600,color:C.green}}>{c.amount}</div><Badge text="Approved" type="ok"/></div>
            </Card>
          ))}
        </>}
      </div>
      {!hasLiveClaims&&<div style={{margin:'-4px 16px 0',fontSize:'11px',color:C.textMuted,textAlign:'center',marginBottom:'8px'}}>These records will sync automatically once your insurer integrates with Medsa</div>}

      {/* Medsa disclaimer */}
      <div style={{margin:'12px 16px 0',background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.amber,lineHeight:1.6}}>
        ⚠ <strong>{isEn?'Important:':'重要提示:'}</strong> {isEn
          ? 'Document requirements vary by insurer, plan type, and individual claim. The checklist below covers standard requirements — your insurer or agent may request additional documents. Medsa is not liable for incomplete or rejected claims. When in doubt, contact your assigned agent or insurer directly before submitting.'
          : '所需文件因保險公司、方案類型及個別索償而異。以下清單涵蓋一般標準要求——您的保險公司或代理人可能要求提供額外文件。Medsa對不完整或被拒的索償概不負責。如有疑問,請於提交前直接聯絡您的代理人或保險公司。'}
      </div>

      {/* Claim preparation flow */}
      <SecLabel>{isEn?'Prepare a claim package':'準備索賠文件包'}</SecLabel>

      {!claimType&&<>
        <div style={{padding:'0 16px 6px',fontSize:'12px',color:C.textSub}}>Select the type of claim you are preparing:</div>
        {CLAIM_TYPES.map(t=>(
          <Card key={t.key} onClick={()=>{setClaimType(t.key);setChecklist({});setBundleReady(false)}} style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:'14px',cursor:'pointer'}}>
            <div style={{width:40,height:40,background:C.greenLight,borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.green,flexShrink:0}}>{t.icon}</div>
            <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:500}}>{t.label}</div><div style={{fontSize:'11px',color:C.textSub,marginTop:'2px'}}>{t.docs.length} documents typically required</div></div>
            <span style={{color:C.textMuted,fontSize:'18px'}}>›</span>
          </Card>
        ))}
      </>}

      {claimType&&selectedType&&<>
        <div style={{padding:'0 16px 10px',display:'flex',alignItems:'center',gap:'10px'}}>
          <div onClick={()=>{setClaimType(null);setChecklist({});setBundleReady(false)}} style={{fontSize:'12px',color:C.green,cursor:'pointer'}}>← Change claim type</div>
          <span style={{fontSize:'12px',color:C.textMuted}}>· {selectedType.label}</span>
        </div>

        {/* Auto-attach summary */}
        <div style={{margin:'0 16px 10px',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'12px',padding:'12px 14px'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'4px'}}>◎ {medsaCount} of {selectedType.docs.length} documents auto-attached from your Medsa records</div>
          <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5}}>{manualCount > 0 ? `${manualCount} item${manualCount>1?'s':''} need your attention — marked below.` : 'All documents are ready. You can bundle your claim now.'}</div>
        </div>
        <Card style={{padding:'16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,marginBottom:'4px'}}>Documents checklist</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'14px',lineHeight:1.5}}>Green items are auto-attached from your Medsa records. Upload or confirm the remaining items.</div>
          {selectedType.docs.map((doc,i)=>{
            const key=getKey(claimType,i)
            const ready=isReady(doc,key)
            const medsaRecord=MEDSA_RECORDS[doc.name]
            return(
              <div key={i} style={{display:'flex',gap:'12px',alignItems:'flex-start',padding:'12px 0',borderBottom:i<selectedType.docs.length-1?`0.5px solid ${C.border}`:'none',background:doc.medsa?C.greenXLight:'transparent',margin:doc.medsa?'0 -16px':undefined,padding:doc.medsa?'12px 16px':'12px 0'}}>
                {/* Checkbox — auto-checked and locked for Medsa records */}
                <div style={{width:22,height:22,borderRadius:6,border:`1.5px solid ${ready?C.green:C.border}`,background:ready?C.green:'transparent',cursor:doc.medsa?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'2px'}}
                  onClick={()=>!doc.medsa&&setChecklist(prev=>({...prev,[key]:!prev[key]}))}>
                  {ready&&<span style={{color:'#fff',fontSize:'12px',fontWeight:700}}>✓</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'13px',fontWeight:500,color:C.text}}>{doc.name}</div>
                  {doc.medsa&&medsaRecord&&<>
                    <div style={{fontSize:'11px',color:C.green,marginTop:'3px',fontWeight:500}}>◎ Auto-attached from Medsa records</div>
                    <div style={{background:'rgba(74,124,89,0.08)',borderRadius:'8px',padding:'8px 10px',marginTop:'6px'}}>
                      <div style={{fontSize:'12px',fontWeight:500,color:C.text}}>{medsaRecord.title}</div>
                      <div style={{fontSize:'11px',color:C.textSub,marginTop:'1px'}}>{medsaRecord.date} · {medsaRecord.institution}</div>
                    </div>
                  </>}
                  {!doc.medsa&&<div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>Upload or confirm you have this ready</div>}
                </div>
                {!doc.medsa&&<div style={{fontSize:'12px',color:C.green,cursor:'pointer',fontWeight:500,flexShrink:0,padding:'4px 10px',border:`0.5px solid ${C.green}`,borderRadius:'8px'}}>Upload</div>}
                {doc.medsa&&<span style={{fontSize:'10px',background:C.greenLight,color:C.green,padding:'2px 8px',borderRadius:'20px',fontWeight:600,flexShrink:0,alignSelf:'center'}}>From Medsa</span>}
              </div>
            )
          })}
        </Card>

        {/* Progress indicator */}
        <div style={{padding:'0 16px 10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',color:C.textSub,marginBottom:'6px'}}>
            <span style={{color:C.green}}>{medsaCount} auto-attached from Medsa</span>
            {allChecked
              ?<span style={{color:C.green,fontWeight:600}}>All documents ready ✓</span>
              :<span>{manualCount - Object.values(checklist).filter(Boolean).length} still needed</span>}
          </div>
          <div style={{height:6,background:C.card,borderRadius:6,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${(selectedType.docs.filter((doc,i)=>isReady(doc,getKey(claimType,i))).length/selectedType.docs.length)*100}%`,background:allChecked?C.green:C.amber,borderRadius:6,transition:'width 0.3s'}}/>
          </div>
          <div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>{selectedType.docs.filter((doc,i)=>isReady(doc,getKey(claimType,i))).length} of {selectedType.docs.length} documents ready</div>
        </div>

        {/* Bundle and submit */}
        <div style={{padding:'0 16px 8px'}}>
          <Btn variant="primary" style={{width:'100%',marginBottom:'8px'}} disabled={!allChecked} onClick={()=>setBundleReady(true)}>
            {allChecked?'Bundle claim package for download':'Complete checklist to bundle'}
          </Btn>
          {bundleReady&&<div style={{background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'8px'}}>
            <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'4px'}}>✓ Claim package ready</div>
            <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.5,marginBottom:'10px'}}>Your documents have been bundled. Download the package and submit it directly to your insurer, or hold it ready for when direct submission via Medsa is available.</div>
            <Btn style={{width:'100%',marginBottom:'6px'}}>Download claim package (PDF)</Btn>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>or</div>
              <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'10px',textAlign:'center',opacity:0.5}}>
                <div style={{fontSize:'12px',color:C.textSub,fontWeight:500}}>Submit directly via Medsa</div>
                <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>Available once your insurer integrates with Medsa</div>
              </div>
            </div>
          </div>}
        </div>

        {/* Final disclaimer */}
        <div style={{margin:'0 16px 16px',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.brown,lineHeight:1.6}}>
          ◇ This checklist covers standard requirements. Your insurer or agent may request additional documents specific to your plan or claim. Medsa is a preparation tool only — submission, review, and approval are handled entirely by your insurer. For plan-specific guidance, contact your assigned agent.
        </div>
      </>}
    </div>
  )
}

function InsuranceScreen({ isEn, claims=[], patient={} }) {
  const hasLiveClaims = claims.length > 0
  const [tab,setTab]=useState('plans')
  const [expanded,setExpanded]=useState(null)
  const [inquired,setInquired]=useState(null)
  const [anonRating,setAnonRating]=useState(null)
  const [feedbackText,setFeedbackText]=useState('')
  const [feedbackSubmitted,setFeedbackSubmitted]=useState(false)
  const [activePolicy,setActivePolicy]=useState(null)
  const [policyLoading,setPolicyLoading]=useState(true)
  const [renewalRequested,setRenewalRequested]=useState(false)

  useEffect(() => {
    async function loadPolicy() {
      const medsaId = patient?.medsa_id
      if (!medsaId) { setPolicyLoading(false); return }
      const { data: patientRow } = await supabase.from('patients').select('id').eq('medsa_id', medsaId).maybeSingle()
      if (!patientRow) { setPolicyLoading(false); return }
      const { data } = await supabase.from('agent_policies').select('*, institutions(name)').eq('patient_id', patientRow.id).in('status',['active','renewal_in_progress']).order('renewal_date',{ascending:true}).limit(1).maybeSingle()
      setActivePolicy(data||null)
      setRenewalRequested(!!data?.patient_requested_renewal_at)
      setPolicyLoading(false)
    }
    loadPolicy()
    const interval = setInterval(loadPolicy, 30000) // keep renewal status live without a manual reload
    return () => clearInterval(interval)
  }, [patient?.medsa_id])

  async function handleRequestRenewal() {
    if (!activePolicy) return
    setRenewalRequested(true)
    await supabase.from('agent_policies').update({ patient_requested_renewal_at: new Date().toISOString() }).eq('id', activePolicy.id)
  }

  async function handleSignContract() {
    if (!activePolicy) return
    const signedAt = new Date().toISOString()
    setActivePolicy({...activePolicy, patient_signed_at: signedAt})
    await supabase.from('agent_policies').update({ patient_signed_at: signedAt }).eq('id', activePolicy.id)
  }

  const [viewError,setViewError]=useState(null)
  async function handleViewContract() {
    if (!activePolicy?.contract_file_path) return
    setViewError(null)
    const { data, error } = await supabase.storage.from('policy-contracts').createSignedUrl(activePolicy.contract_file_path, 300) // link valid 5 minutes
    if (error || !data?.signedUrl) { setViewError('Could not open the contract - ask your agent to check the upload.'); return }
    window.open(data.signedUrl, '_blank')
  }

  const plans=[
    {name:'AIA Prime Care',company:'AIA',type:'Comprehensive',price:'HK$1,200/mo',limit:'HK$1.2M annual',sponsored:true,
     criteria:['Covers diabetes management','Includes outpatient visits','Includes lab tests'],
     covers:['Hospitalisation','Outpatient','Specialist','Labs & imaging','Dental (basic)']},
    {name:'Blue Cross Hospital Plan',company:'Blue Cross',type:'Hospital focus',price:'HK$980/mo',limit:'HK$800K annual',sponsored:false,
     criteria:['Hospitalisation-focused','Lower monthly cost','Limited outpatient coverage'],
     covers:['Hospitalisation','Specialist','Surgery']},
    {name:'Bupa Gold Cover',company:'Bupa',type:'Premium + travel',price:'HK$2,100/mo',limit:'HK$2M + travel',sponsored:false,
     criteria:['Includes travel emergency cover','Includes mental health','Higher monthly cost'],
     covers:['Hospitalisation','Outpatient','Travel emergency','Mental health']},
    {name:'AIA Critical Rider',company:'AIA',type:'Critical illness',price:'HK$450/mo',limit:'HK$500K lump sum',sponsored:true,
     criteria:['Lump sum on diagnosis','57 covered conditions','Add-on, not standalone'],
     covers:['Critical illness lump sum','57 covered conditions']},
  ]
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

  return (
    <div style={{background:C.beige,flex:1}}>
      {/* Active plan banner - real data from agent_policies */}
      {policyLoading&&<div style={{margin:'16px 16px 0',textAlign:'center',fontSize:'12px',color:C.textMuted}}>{isEn?'Loading your plan...':'載入您的計劃中...'}</div>}
      {!policyLoading&&!activePolicy&&<div style={{margin:'16px 16px 0',background:C.card,borderRadius:'16px',padding:'20px',textAlign:'center',fontSize:'13px',color:C.textMuted}}>No active plan on file yet. Inquire about a plan below to get started.</div>}
      {!policyLoading&&activePolicy&&(() => {
        const daysLeft = Math.ceil((new Date(activePolicy.renewal_date).getTime() - Date.now()) / (1000*60*60*24))
        const inProgress = activePolicy.status==='renewal_in_progress'
        const readyToSign = inProgress && activePolicy.contract_ready_at && !activePolicy.patient_signed_at
        const waitingOnAgent = inProgress && !activePolicy.contract_ready_at
        return (
        <div style={{margin:'16px 16px 0',background:`linear-gradient(135deg,#1e3a5f 0%,${C.blue} 100%)`,borderRadius:'16px',padding:'20px',color:'#fff'}}>
          <div style={{fontSize:'11px',opacity:0.7,textTransform:'uppercase',letterSpacing:'1px'}}>{activePolicy.plan_name} — {isEn?'Active plan':'現行計劃'}</div>
          <div style={{fontSize:'20px',fontWeight:700,margin:'8px 0 4px'}}>HK${activePolicy.premium}/mo</div>
          <div style={{fontSize:'12px',opacity:0.8}}>{isEn?`Renews ${new Date(activePolicy.renewal_date).toLocaleDateString('en-HK',{day:'numeric',month:'short',year:'numeric'})}`:`續保日期 ${new Date(activePolicy.renewal_date).toLocaleDateString('zh-HK',{day:'numeric',month:'short',year:'numeric'})}`}</div>

          {waitingOnAgent&&<div style={{marginTop:'14px',background:'rgba(255,255,255,0.15)',borderRadius:'10px',padding:'10px 12px',fontSize:'12px',lineHeight:1.5}}>
            {'\u25c7'} {isEn?`Your agent is preparing your renewal with ${activePolicy.institutions?.name||'your insurer'}.`:'您的代理人正在為您準備續保。'}
          </div>}

          {readyToSign&&<div style={{marginTop:'14px',background:'rgba(255,255,255,0.15)',borderRadius:'10px',padding:'12px 14px'}}>
            <div style={{fontSize:'12px',fontWeight:600,marginBottom:'8px'}}>{isEn?'Your new contract is ready':'您的新合約已準備就緒'}</div>
            <div style={{fontSize:'11px',opacity:0.85,marginBottom:'10px',lineHeight:1.5}}>{isEn?"Review the document below, then confirm once you're ready to sign.":'請先查閱以下文件，準備好後確認簽署。'}</div>
            {viewError&&<div style={{fontSize:'11px',color:'#ffb3b3',marginBottom:'10px'}}>{viewError}</div>}
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1,background:'rgba(255,255,255,0.15)',color:'#fff',border:'0.5px solid rgba(255,255,255,0.3)',fontSize:'12px'}} onClick={handleViewContract}>{isEn?'View contract':'查看合約'}</Btn>
              <Btn variant="primary" style={{flex:1,background:'#fff',color:C.navy,fontSize:'12px'}} onClick={handleSignContract}>{isEn?"I've reviewed and signed":'我已檢閱並簽署'}</Btn>
            </div>
          </div>}

          {activePolicy.patient_signed_at&&inProgress&&<div style={{marginTop:'14px',background:'rgba(255,255,255,0.15)',borderRadius:'10px',padding:'10px 12px',fontSize:'12px'}}>
            ✓ {isEn?'Signed — your agent will confirm the renewal shortly.':'已簽署 — 代理人將盡快確認續保。'}
          </div>}

          {!inProgress&&<div style={{display:'flex',gap:'16px',marginTop:'14px',alignItems:'center'}}>
            <div><div style={{fontSize:'11px',opacity:0.7}}>{isEn?'Days left':'剩餘天數'}</div><div style={{fontSize:'16px',fontWeight:600}}>{daysLeft>=0?daysLeft:'Overdue'}</div></div>
            <div style={{flex:1}}/>
            {daysLeft<=45&&(renewalRequested
              ?<div style={{fontSize:'11px',background:'rgba(255,255,255,0.2)',padding:'6px 12px',borderRadius:'20px'}}>✓ {isEn?'Renewal requested':'已請求續保'}</div>
              :<Btn variant="primary" style={{fontSize:'11px',padding:'8px 14px',background:'#fff',color:C.navy}} onClick={handleRequestRenewal}>{isEn?'Request renewal':'請求續保'}</Btn>)}
          </div>}
        </div>
        )
      })()}

      {/* Tabs */}
      <div style={{display:'flex',background:C.cream,borderBottom:`0.5px solid ${C.border}`,marginTop:'12px'}}>
        {[['plans',isEn?'Compare plans':'比較計劃'],['claims',isEn?'Claims':'索賠'],['agents',isEn?'Agent ratings':'代理人評分']].map(([k,l])=>(
          <div key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'11px 4px',fontSize:'11px',fontWeight:500,color:tab===k?C.green:C.textSub,textAlign:'center',borderBottom:`2px solid ${tab===k?C.green:'transparent'}`,cursor:'pointer'}}>{l}</div>
        ))}
      </div>

      {/* ── PLANS & COMPARISON ── */}
      {tab==='plans'&&<>
        {/* How Medsa connects patients to insurers — neutral comparison, not advice */}
        <div style={{margin:'16px 16px 0',background:C.navyLight,border:`0.5px solid ${C.border}`,borderRadius:'14px',padding:'14px 16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:C.navy,marginBottom:'6px'}}>◈ {isEn?'How Medsa connects you to insurers':'Medsa如何連接您與保險公司'}</div>
          <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.7}}>
            {isEn
              ? 'Medsa shows plans filtered against your verified health records — no questionnaires, no cold calls. This is a neutral comparison, not personal advice; you decide what fits. When you inquire, your details are forwarded directly to the insurer or a licensed intermediary. Once insurers integrate with Medsa, agent assignment, claims, and status updates will all sync back here automatically — one place for everything health.'
              : 'Medsa根據您已核實的健康記錄篩選方案——無需填寫問卷,亦無需接聽推銷電話。這是中立的比較,並非個人建議;最終選擇由您決定。當您提出查詢後,您的資料將直接轉發予保險公司或持牌中介人。一旦保險公司與Medsa完成系統整合,代理人分配、索償及狀態更新將自動同步至此——所有健康相關事務,一站式處理。'}
          </div>
        </div>

        <div style={{margin:'10px 16px 0',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'14px',padding:'14px 16px'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:C.green,marginBottom:'4px'}}>◈ {isEn?'Plan comparison, not advice':'方案比較,並非建議'}</div>
          <div style={{fontSize:'12px',color:C.textSub,lineHeight:1.6}}>{isEn?'Plans are filtered against your verified health records and shown with the criteria they meet. Medsa doesn\\u2019t rank plans or tell you which is "best" — that\\u2019s a decision for you or a licensed agent. Sponsored plans are clearly labelled and filtered the same way as any other plan.':'方案根據您已核實的健康記錄篩選,並列明其符合的條件。Medsa不會為方案排名,亦不會告知何者「最佳」——此決定應由您或持牌代理人作出。贊助方案會清楚標示,並與其他方案採用相同的篩選方式。'}</div>
        </div>

        <SecLabel>{isEn?'Plans matching your profile':'符合您狀況的計劃'}</SecLabel>
        {plans.map((plan,i)=>(
          <Card key={i} style={{padding:'14px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
                  {plan.sponsored&&<span style={{fontSize:'10px',background:C.amberLight,color:C.amber,padding:'1px 7px',borderRadius:'20px',fontWeight:600}}>{isEn?'Sponsored':'贊助'}</span>}
                  <span style={{fontSize:'10px',background:C.card,color:C.textSub,padding:'1px 7px',borderRadius:'20px'}}>{pt(plan.type)}</span>
                </div>
                <div style={{fontSize:'15px',fontWeight:700}}>{plan.name}</div>
                <div style={{fontSize:'12px',color:C.textSub}}>{plan.company}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:'14px',fontWeight:700,color:C.navy}}>{plan.price}</div>
                <div style={{fontSize:'11px',color:C.textMuted}}>{plan.limit}</div>
              </div>
            </div>
            {/* Objective criteria met - no ranking, no score */}
            <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px'}}>
              {plan.criteria.map(c=><span key={c} style={{fontSize:'11px',background:C.card,color:C.textSub,padding:'3px 10px',borderRadius:'20px'}}>{pt(c)}</span>)}
            </div>
            {expanded===i&&<div style={{marginBottom:'10px',display:'flex',gap:'6px',flexWrap:'wrap'}}>
              {plan.covers.map(c=><span key={c} style={{fontSize:'11px',background:C.greenLight,color:C.green,padding:'3px 10px',borderRadius:'20px'}}>{pt(c)}</span>)}
            </div>}
            <div style={{display:'flex',gap:'8px'}}>
              <Btn style={{flex:1,fontSize:'12px'}} onClick={()=>setExpanded(expanded===i?null:i)}>{expanded===i?'Hide details':'See details'}</Btn>
              {inquired===i
                ?<div style={{flex:1,background:C.greenXLight,border:`0.5px solid ${C.green}`,borderRadius:'10px',padding:'10px',textAlign:'center',fontSize:'12px',color:C.green,fontWeight:500}}>✓ Enquiry sent</div>
                :<Btn variant="primary" style={{flex:1,fontSize:'12px'}} onClick={()=>setInquired(i)}>Inquire about plan</Btn>}
            </div>
            {/* Post-inquiry confirmation */}
            {inquired===i&&<div style={{marginTop:'10px',background:C.greenXLight,border:`0.5px solid ${C.greenLight}`,borderRadius:'10px',padding:'12px 14px'}}>
              <div style={{fontSize:'12px',color:C.green,fontWeight:600,marginBottom:'4px'}}>Your enquiry has been forwarded to {plan.company}</div>
              <div style={{fontSize:'11px',color:C.textSub,lineHeight:1.6}}>Their team will be in touch according to their standard response policy. Medsa connects you with insurers and their agents — plan outcomes, agent performance, and claims decisions are the responsibility of {plan.company}.</div>
              <div style={{fontSize:'11px',color:C.textMuted,marginTop:'6px',fontStyle:'italic'}}>Not sure which plans to combine? A licensed agent can help structure your coverage once assigned.</div>
            </div>}
          </Card>
        ))}

        {/* Search all plans */}
        <SecLabel>{isEn?'Search all plans':'搜尋所有計劃'}</SecLabel>
        <div style={{padding:'0 16px 10px'}}>
          <div style={{position:'relative',display:'flex',alignItems:'center'}}>
            <span style={{position:'absolute',left:'10px',fontSize:'16px',color:C.green}}>◎</span>
            <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'10px 12px 10px 34px',fontSize:'13px',background:C.cream,outline:'none',fontFamily:'inherit'}} placeholder={isEn?'Search e.g. dental, travel, critical illness…':'按關鍵字搜尋…'}/>
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

      {/* ── CLAIMS ── */}
      {tab==='claims'&&<ClaimsTab isEn={isEn} claims={claims}/>}

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
              <span style={{fontSize:'18px',color:C.green,flexShrink:0}}>{item.icon}</span>
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
              <div style={{width:40,height:40,borderRadius:'10px',background:C.greenLight,color:C.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:600,flexShrink:0}}>{a.init}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:500}}>{a.name}</div>
                <div style={{fontSize:'11px',color:C.textSub}}>{a.company} · {a.spec}</div>
                <div style={{fontSize:'12px',color:'#d4a017'}}>{'★'.repeat(Math.round(a.rating))} <span style={{fontSize:'11px',color:C.textMuted}}>{a.rating} ({a.reviews})</span></div>
                <div style={{display:'flex',gap:'4px',marginTop:'4px',flexWrap:'wrap'}}>
                  {a.langs.map(l=><span key={l} style={{fontSize:'10px',background:C.greenLight,color:C.green,padding:'1px 7px',borderRadius:'20px'}}>{l}</span>)}
                  <span style={{fontSize:'10px',background:a.avail==='Available'?C.greenLight:C.amberLight,color:a.avail==='Available'?C.green:C.amber,padding:'1px 7px',borderRadius:'20px'}}>{a.avail}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Anonymous feedback form — available now for patients who have interacted */}
        <SecLabel>{isEn?'Leave anonymous feedback':'留下匿名評價'}</SecLabel>
        <Card style={{padding:'16px'}}>
          {!feedbackSubmitted?<>
            <div style={{fontSize:'13px',color:C.textSub,marginBottom:'12px',lineHeight:1.5}}>Had a recent interaction with an agent through Medsa? Leave anonymous feedback — your identity will never be revealed.</div>
            <div style={{fontSize:'12px',color:C.textSub,marginBottom:'8px'}}>Your rating:</div>
            <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
              {[1,2,3,4,5].map(n=><div key={n} onClick={()=>setAnonRating(n)} style={{flex:1,textAlign:'center',fontSize:'24px',cursor:'pointer',opacity:anonRating&&anonRating>=n?1:0.25}}>★</div>)}
            </div>
            <textarea value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'13px',background:C.beige,outline:'none',fontFamily:'inherit',resize:'none',marginBottom:'10px'}} rows={3} placeholder="Optional comment — anonymous, never attributed to you…"/>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'10px'}}>◇ Your name and account details are never stored with this feedback.</div>
            <Btn variant="primary" style={{width:'100%'}} disabled={!anonRating} onClick={()=>setFeedbackSubmitted(true)}>Submit anonymously</Btn>
          </>:<>
            <div style={{textAlign:'center',padding:'16px 0'}}>
              <div style={{fontSize:'28px',marginBottom:'10px'}}>✓</div>
              <div style={{fontSize:'14px',fontWeight:600,color:C.green,marginBottom:'6px'}}>Feedback submitted anonymously</div>
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


function PrescriptionsScreen({ isEn, medications=[] }) {
  const hasLiveMeds = medications.length > 0
  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>{isEn?'Active prescriptions':'有效處方'}</SecLabel>
      {(hasLiveMeds ? medications.map((m,idx)=>({
        name:`${m.medication_name} ${m.dosage||''}`.trim(),
        dose:m.frequency||'As prescribed',
        dr:m.prescribed_by||'—',
        refills:`${m.institution||''} · ${m.start_date?'Since '+new Date(m.start_date).toLocaleDateString('en-HK',{month:'short',year:'numeric'}):''}`.trim().replace(/^·\s*/,''),
        icon:['◉','◈','◇','◎','▣'][idx%5],
        bg:[C.greenLight,C.brownLight,C.amberLight,C.blueLight,C.greenLight][idx%5],
      })) : [
        {name:'Metformin 500mg',dose:'1 tablet twice daily with meals',dr:'Dr Chan Siu-ming',refills:'2 refills remaining',icon:'◉',bg:C.greenLight},
        {name:'Vitamin D3 1000IU',dose:'1 capsule daily with breakfast',dr:'Dr Chan Siu-ming',refills:'Auto-refill on',icon:'◈',bg:C.brownLight},
        {name:'Iron supplement 14mg',dose:'1 tablet every other day',dr:'Dr Lam Wai-yee',refills:'1 refill remaining',icon:'◇',bg:C.amberLight},
      ]).map((rx,i)=>(
        <Card key={i}>
          <div style={{padding:'14px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
            <div style={{width:40,height:40,borderRadius:'12px',background:rx.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',color:C.green,flexShrink:0}}>{rx.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'14px',fontWeight:500}}>{rx.name}</div>
              <div style={{fontSize:'12px',color:C.textSub,marginTop:'2px'}}>{rx.dose}</div>
              <div style={{fontSize:'11px',color:C.green,marginTop:'4px'}}>{rx.dr}</div>
              <div style={{fontSize:'11px',color:C.textMuted,marginTop:'2px'}}>{rx.refills}</div>
            </div>
          </div>
          <div style={{borderTop:`0.5px solid ${C.border}`,padding:'10px 16px',display:'flex',gap:'8px'}}>
            <Btn style={{flex:1,fontSize:'12px'}}>Drug info</Btn>
            <Btn style={{flex:1,fontSize:'12px'}}>Interactions</Btn>
            <Btn variant="primary" style={{flex:1,fontSize:'12px'}}>Refill</Btn>
          </div>
        </Card>
      ))}
      <SecLabel>{isEn?'Drug reference':'藥物參考'}</SecLabel>
      <Card style={{padding:'14px 16px'}}>
        <div style={{position:'relative',display:'flex',alignItems:'center'}}>
          <span style={{position:'absolute',left:'10px',fontSize:'16px',color:C.green}}>◎</span>
          <input style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px 10px 34px',fontSize:'13px',background:C.beige,outline:'none'}} placeholder={isEn?'Search any drug name…':'搜尋任何藥物名稱…'}/>
        </div>
        <div style={{fontSize:'12px',color:C.textSub,marginTop:'10px'}}>{isEn?'Check dosage, interactions, contraindications, and side effects.':'查看劑量、相互作用、禁忌症和副作用。'}</div>
      </Card>
    </div>
  )
}

function FamilyScreen({ isEn }) {
  const members=[
    {name:'Wong Tai (Mum)',relation:'Mother',age:64,type:'Senior',status:'Active',alerts:2},
    {name:'Wong Siu-lok',relation:'Son',age:14,type:'Minor',status:'Active',alerts:0},
    {name:'Uncle Cheung Ho',relation:'Uncle',age:72,type:'Senior',status:'Pending',alerts:1},
  ]
  return (
    <div style={{background:C.beige,flex:1}}>
      <div style={{margin:'16px 16px 0',background:`linear-gradient(135deg,${C.green} 0%,${C.greenMid} 100%)`,borderRadius:'14px',padding:'16px',color:'#fff'}}>
        <div style={{fontSize:'11px',opacity:0.7,textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>{isEn?'Family guardian plan':'家庭監護計劃'}</div>
        <div style={{fontSize:'16px',fontWeight:700,marginBottom:'2px'}}>Active · HK$38/mo</div>
        <div style={{fontSize:'12px',opacity:0.8}}>{isEn?'Monitoring 2 of 3 members · Renews 1 Jul':'監護3名成員中的2名 · 7月1日續期'}</div>
      </div>
      <SecLabel>{isEn?'Family members':'家庭成員'}</SecLabel>
      {members.map((m,i)=>(
        <Card key={i} style={{padding:'14px 16px'}}>
          <div style={{display:'flex',gap:'12px',alignItems:'center',marginBottom:'10px'}}>
            <div style={{width:40,height:40,borderRadius:'12px',background:m.type==='Minor'?C.blueLight:C.amberLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:600,color:m.type==='Minor'?C.blue:C.amber,flexShrink:0}}>{m.name[0]}</div>
            <div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:600}}>{m.name}</div><div style={{fontSize:'12px',color:C.textSub}}>{m.relation} · Age {m.age} · {m.type}</div></div>
            <div style={{textAlign:'right'}}>
              <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'20px',fontWeight:500,background:m.status==='Active'?C.greenLight:C.amberLight,color:m.status==='Active'?C.green:C.amber}}>{m.status}</span>
              {m.alerts>0&&<div style={{fontSize:'11px',color:C.red,marginTop:'4px'}}>⚠ {m.alerts} alert{m.alerts>1?'s':''}</div>}
            </div>
          </div>
          <div style={{background:C.beige,borderRadius:'10px',padding:'10px 12px',marginBottom:'10px'}}>
            <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>{isEn?'Guardian access':'監護人存取'}</div>
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
              {['Medication reminders','Appointment alerts','Emergency card','Vitals summary'].map(tag=>(
                <span key={tag} style={{fontSize:'10px',background:C.greenLight,color:C.green,padding:'2px 8px',borderRadius:'20px'}}>{tag}</span>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:'8px'}}><Btn style={{flex:1,fontSize:'12px'}}>View health</Btn><Btn variant="primary" style={{flex:1,fontSize:'12px'}}>Manage access</Btn></div>
        </Card>
      ))}
      <div style={{padding:'0 16px'}}><Btn variant="primary" style={{width:'100%',marginBottom:'10px'}}>+ {isEn?'Add family member':'新增家庭成員'}</Btn></div>
      <div style={{margin:'0 16px 16px',background:C.brownLight,border:`0.5px solid ${C.border}`,borderRadius:'12px',padding:'12px 14px',fontSize:'12px',color:C.brown}}>
        ◇ {isEn?'Guardian access is consent-based. Family members approve via their own Medsa account.':'監護人存取基於同意。家庭成員透過自己的Medsa帳戶批准。'}
      </div>
    </div>
  )
}

function StorageScreen({ isEn, patient={} }) {
  const tiers=[
    {name:'Essential',price:isEn?'Free':'免費',storage:'2 GB',perks:['Emergency health card','Vaccination passport','Basic record storage','1 family member monitor'],current:true,color:C.green,bg:C.greenLight},
    {name:'Personal',price:'HK$18/mo',storage:'20 GB',perks:['Everything in Essential','Full record history','Unlimited uploads','Medication alarms','AI insurance recommendations','Travel health mode'],current:false,color:C.navy,bg:C.navyLight},
    {name:'Family',price:'HK$38/mo',storage:'50 GB shared',perks:['Everything in Personal','Up to 5 family members','Guardian monitoring for seniors/minors','Priority support','Family emergency card'],current:false,color:C.brown,bg:C.brownLight},
  ]
  return (
    <div style={{background:C.beige,flex:1}}>
      <SecLabel>{isEn?'Your storage':'您的儲存空間'}</SecLabel>
      <Card style={{padding:'16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'13px',fontWeight:500}}>Used: 0.8 GB of 2 GB</span><span style={{fontSize:'13px',fontWeight:600,color:C.green}}>40%</span></div>
        <div style={{height:8,background:C.card,borderRadius:8,overflow:'hidden'}}><div style={{height:'100%',width:'40%',background:C.green,borderRadius:8}}/></div>
        <div style={{fontSize:'11px',color:C.textSub,marginTop:'8px'}}>{isEn?"At current rate you'll reach your limit in ~14 months.":'按目前速度，約14個月內達到限額。'}</div>
      </Card>
      <SecLabel>{isEn?'Plans':'計劃'}</SecLabel>
      {tiers.map((tier,i)=>(
        <div key={i} style={{background:C.cream,border:`0.5px solid ${tier.current?tier.color:C.border}`,borderRadius:'14px',margin:'0 16px 10px',padding:'16px',position:'relative'}}>
          {tier.current&&<span style={{position:'absolute',top:12,right:12,fontSize:'10px',background:tier.bg,color:tier.color,padding:'2px 10px',borderRadius:'20px',fontWeight:600}}>{isEn?'Current plan':'目前計劃'}</span>}
          <div style={{fontSize:'16px',fontWeight:700,color:tier.color,marginBottom:'2px'}}>{tier.name}</div>
          <div style={{fontSize:'22px',fontWeight:800,color:C.text,marginBottom:'2px'}}>{tier.price}</div>
          <div style={{fontSize:'12px',color:C.textSub,marginBottom:'12px'}}>{tier.storage} {isEn?'cloud storage':'雲端儲存'}</div>
          <div style={{display:'flex',flexDirection:'column',gap:'5px',marginBottom:'14px'}}>
            {tier.perks.map(p=><div key={p} style={{fontSize:'12px',color:C.text,display:'flex',alignItems:'center',gap:'7px'}}><span style={{color:tier.color,fontSize:'10px'}}>✓</span>{p}</div>)}
          </div>
          {!tier.current&&<button style={{width:'100%',border:'none',background:tier.color,borderRadius:'10px',padding:'11px',fontSize:'13px',fontWeight:500,cursor:'pointer',fontFamily:'inherit',color:'#fff'}}>{isEn?`Upgrade to ${tier.name}`:`升級至${tier.name}`}</button>}
        </div>
      ))}
    </div>
  )
}

// ── SIGN-UP GATE — two paths into Medsa ──────────────────────────────────────
// Path A: a clinic already created a placeholder profile (CSV import or
// manual registration). A claim code sent only to the phone/email the
// CLINIC already had on file proves the real patient is claiming it.
// Path B: no institution record exists yet. Since there's no prior anchor,
// this requires document + liveness verification instead.
function SignUpGate({ onComplete, onSkipDemo }) {
  const [mode,setMode]=useState(null) // null | 'claim' | 'register'

  if (!mode) return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380,textAlign:'center'}}>
        <MedsaLogo height={28}/>
        <div style={{fontSize:'14px',color:C.textSub,margin:'16px 0 28px'}}>Get started with your health passport</div>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
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

  if (mode==='claim') return <ClaimProfileFlow onBack={()=>setMode(null)} onComplete={onComplete}/>
  return <SelfRegisterFlow onBack={()=>setMode(null)} onComplete={onComplete}/>
}

function ClaimProfileFlow({ onBack, onComplete }) {
  const [hkid,setHkid]=useState('')
  const [code,setCode]=useState('')
  const [error,setError]=useState(null)
  const [checking,setChecking]=useState(false)

  async function handleClaim() {
    setChecking(true)
    setError(null)
    const { data, error: qErr } = await supabase.from('patients').select('*').eq('hkid', hkid).eq('claim_code', code.toUpperCase()).maybeSingle()
    setChecking(false)
    if (qErr || !data) { setError('HKID and code do not match any record. Check with the clinic that registered you.'); return }
    if (data.claimed_at) { setError('This profile has already been claimed.'); return }
    if (new Date(data.claim_code_expires_at) < new Date()) { setError('This claim code has expired. Ask the clinic to issue a new one.'); return }

    await supabase.from('patients').update({
      registration_path: 'claimed',
      claimed_at: new Date().toISOString(),
      claim_code: null, // burn the code so it can't be reused
    }).eq('id', data.id)

    onComplete(data)
  }

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div onClick={onBack} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'20px'}}>← Back</div>
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
  const [step,setStep]=useState('form') // form | id_upload | selfie | pending
  const [form,setForm]=useState({fullName:'',dob:'',hkid:''})
  const [idFile,setIdFile]=useState(null)
  const [selfieFile,setSelfieFile]=useState(null)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      const medsaId = 'MDS-' + Math.floor(10000+Math.random()*89999) + '-HK'
      let idPath = null, selfiePath = null
      if (idFile) {
        idPath = `${medsaId}/id-${Date.now()}-${idFile.name}`
        await supabase.storage.from('id-verification').upload(idPath, idFile)
      }
      if (selfieFile) {
        selfiePath = `${medsaId}/selfie-${Date.now()}-${selfieFile.name}`
        await supabase.storage.from('id-verification').upload(selfiePath, selfieFile)
      }
      const { data, error: insErr } = await supabase.from('patients').insert({
        medsa_id: medsaId,
        full_name: form.fullName,
        date_of_birth: form.dob,
        hkid: form.hkid,
        registration_path: 'self_registered',
        id_verification_status: 'pending',
        id_document_path: idPath,
        selfie_verification_path: selfiePath,
      }).select().single()
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
        {step!=='pending'&&<div onClick={onBack} style={{fontSize:'13px',color:C.green,cursor:'pointer',marginBottom:'20px'}}>← Back</div>}

        {step==='form'&&<>
          <div style={{fontSize:'18px',fontWeight:700,marginBottom:'6px'}}>Register with Medsa</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.5}}>Since there's no clinic record to verify against, we'll need your ID and a quick photo to confirm it's really you - this protects your medical information.</div>
          <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'20px'}}>
            <input value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} placeholder="Full name (as on ID)" style={{border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
            <input value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} placeholder="Date of birth (YYYY-MM-DD)" style={{border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
            <input value={form.hkid} onChange={e=>setForm({...form,hkid:e.target.value})} placeholder="HKID" style={{border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px 14px',fontSize:'14px',boxSizing:'border-box'}}/>
          </div>
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>setStep('id_upload')} disabled={!form.fullName||!form.dob||!form.hkid}>Continue</Btn>
        </>}

        {step==='id_upload'&&<>
          <div style={{fontSize:'18px',fontWeight:700,marginBottom:'6px'}}>Upload your ID</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'20px',lineHeight:1.5}}>A clear photo of your HKID card, both sides if possible.</div>
          <input type="file" accept="image/*" onChange={e=>setIdFile(e.target.files[0])} style={{width:'100%',marginBottom:'20px'}}/>
          <Btn variant="primary" style={{width:'100%'}} onClick={()=>setStep('selfie')} disabled={!idFile}>Continue</Btn>
        </>}

        {step==='selfie'&&<>
          <div style={{fontSize:'18px',fontWeight:700,marginBottom:'6px'}}>Take a selfie</div>
          <div style={{fontSize:'13px',color:C.textSub,marginBottom:'16px',lineHeight:1.5}}>This confirms the person registering matches the ID provided.</div>
          <div style={{background:C.amberLight,border:`0.5px solid ${C.amber}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'16px',fontSize:'11px',color:C.amber,lineHeight:1.5}}>
            {'\u25c7'} Demo note: real liveness/anti-spoofing verification (confirming a live person, not a photo of a photo) requires a dedicated identity verification provider - this step captures the photo but the matching logic isn't live yet.
          </div>
          <input type="file" accept="image/*" capture="user" onChange={e=>setSelfieFile(e.target.files[0])} style={{width:'100%',marginBottom:'20px'}}/>
          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'14px'}}>{error}</div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={handleSubmit} disabled={saving||!selfieFile}>{saving?'Submitting...':'Submit for verification'}</Btn>
        </>}

        {step==='pending'&&<div style={{textAlign:'center'}}>
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
function ShareForVisitModal({ open, onClose, patient }) {
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

          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
            {[
              {key:'allergies',label:'Allergies'},
              {key:'conditions',label:'Active conditions'},
              {key:'medications',label:'Current medications'},
              {key:'vaccinations',label:'Vaccination history'},
              {key:'fullHistory',label:'Full medical history'},
            ].map(item=>(
              <div key={item.key} onClick={()=>toggleTier(item.key)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:C.card,borderRadius:'8px',cursor:'pointer'}}>
                <div style={{width:18,height:18,borderRadius:'4px',border:`1.5px solid ${tiers[item.key]?C.green:C.border}`,background:tiers[item.key]?C.green:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'#fff',flexShrink:0}}>{tiers[item.key]?'\u2713':''}</div>
                <span style={{fontSize:'13px'}}>{item.label}</span>
              </div>
            ))}
          </div>

          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'4px'}}>What's this visit for? (optional, for your own reference)</div>
          <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Flu vaccination" style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px 12px',fontSize:'13px',marginBottom:'16px',boxSizing:'border-box'}}/>

          <div style={{fontSize:'11px',color:C.textMuted,marginBottom:'6px'}}>Code expires after</div>
          <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
            {[[30,'30 min'],[60,'1 hour'],[240,'4 hours']].map(([mins,label])=>(
              <div key={mins} onClick={()=>setExpiryMinutes(mins)} style={{flex:1,padding:'9px',borderRadius:'8px',textAlign:'center',fontSize:'12px',cursor:'pointer',background:expiryMinutes===mins?C.green:C.card,color:expiryMinutes===mins?'#fff':C.textSub}}>{label}</div>
            ))}
          </div>

          {error&&<div style={{fontSize:'12px',color:C.red,marginBottom:'14px'}}>{error}</div>}
          <Btn variant="primary" style={{width:'100%'}} onClick={handleGenerate} disabled={saving}>{saving?'Generating...':'Generate code'}</Btn>
        </> : <>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'13px',color:C.textSub,marginBottom:'10px'}}>Give this code to the clinic</div>
            <div style={{fontSize:'32px',fontWeight:700,letterSpacing:'4px',color:C.green,marginBottom:'10px'}}>{generatedCode}</div>
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
  const [signedInPatient,setSignedInPatient]=useState(liveData.patient || null)
  const [showGate,setShowGate]=useState(!liveData.patient)
  const [screen,setScreen]=useState('home')
  const [lang,setLang]=useState('en') // 'en' | 'zh-TW' | 'zh-CN'
  const isEn = lang==='en' // kept so every existing isEn?'EN':'Traditional' string throughout this file works unchanged
  const [emergencyOpen,setEmergencyOpen]=useState(false)
  const [shareOpen,setShareOpen]=useState(false)
  const [emergencyConsented,setEmergencyConsented]=useState(true) // true = demo state, false = not set up

  if (showGate && !signedInPatient) {
    return <SignUpGate onComplete={(p)=>{setSignedInPatient(p);setShowGate(false)}} onSkipDemo={()=>setShowGate(false)}/>
  }

  const patient = signedInPatient || liveData.patient || { full_name:'Wong Mei-ling, Lisa', preferred_name:'Lisa', medsa_id:'MDS-84921-HK', date_of_birth:'1988-03-14', blood_type:'O+', emergency_card_active:true, emergency_contact_name:'Wong Tai', emergency_contact_rel:'Mother', emergency_contact_phone:'+852 9xxx xxxx', storage_tier:'essential' }
  const liveRecords = liveData.records || []
  const liveConditions = liveData.conditions || []
  const liveAllergies = liveData.allergies || []
  const liveMedications = liveData.medications || []
  const liveVaccinations = liveData.vaccinations || []
  const liveAppointments = liveData.appointments || []
  const liveClaims = liveData.claims || []
  const titles={home:'medsa',records:isEn?'Medical records':'醫療記錄',doctors:isEn?'Doctors & clinics':'醫生與診所',calendar:isEn?'Calendar':'日曆',insurance:isEn?'Insurance':'保險',prescriptions:isEn?'Prescriptions':'處方',family:isEn?'Family & guardians':'家庭與監護',storage:isEn?'Storage & plan':'儲存與計劃'}
  const navItems=[{key:'home',icon:'◎',en:'Home',zh:'主頁'},{key:'records',icon:'▣',en:'Records',zh:'記錄'},{key:'doctors',icon:'◈',en:'Find care',zh:'尋找'},{key:'calendar',icon:'◇',en:'Calendar',zh:'日曆'},{key:'insurance',icon:'◉',en:'Insurance',zh:'保險'}]
  const rootContent = (
    <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',maxWidth:'440px',margin:'0 auto',background:C.beige}}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{background:C.green,padding:'14px 16px',display:'flex',alignItems:'center',gap:'10px',position:'sticky',top:0,zIndex:10}}>
        {screen!=='home'&&<button onClick={()=>setScreen('home')} style={{background:'rgba(255,255,255,0.18)',border:'none',color:'#fff',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</button>}
        {screen==='home'?<MedsaLogo height={20}/>:<span style={{fontSize:'17px',fontWeight:500,color:'#fff'}}>{titles[screen]}</span>}
        <div style={{flex:1}}/>
        <div style={{display:'flex',background:'rgba(255,255,255,0.12)',borderRadius:'20px',padding:'2px',flexShrink:0}}>
          {[['en','EN'],['zh-TW','繁'],['zh-CN','简']].map(([code,label])=>(
            <button key={code} onClick={()=>setLang(code)} style={{background:lang===code?'rgba(255,255,255,0.9)':'transparent',color:lang===code?C.green:'#fff',border:'none',fontSize:'11px',fontWeight:600,padding:'4px 10px',borderRadius:'18px',cursor:'pointer'}}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {screen==='home'&&<HomeScreen onNav={setScreen} isEn={isEn} onOpenEmergencySetup={()=>setEmergencyOpen(true)} onOpenShare={()=>setShareOpen(true)} onOpenSignUp={()=>{setSignedInPatient(null);setShowGate(true)}} emergencyConsented={emergencyConsented} patient={patient}/>}
        {screen==='records'&&<RecordsScreen isEn={isEn} records={liveRecords} conditions={liveConditions} vaccinations={liveVaccinations} patient={patient}/>}
        {screen==='doctors'&&<DoctorsScreen isEn={isEn} patient={patient}/>}
        {screen==='calendar'&&<CalendarScreen isEn={isEn} appointments={liveAppointments} medications={liveMedications}/>}
        {screen==='insurance'&&<InsuranceScreen isEn={isEn} claims={liveClaims} patient={patient}/>}
        {screen==='prescriptions'&&<PrescriptionsScreen isEn={isEn} medications={liveMedications}/>}
        {screen==='family'&&<FamilyScreen isEn={isEn}/>}
        {screen==='storage'&&<StorageScreen isEn={isEn} patient={patient}/>}
      </div>
      <div style={{background:C.cream,borderTop:`0.5px solid ${C.border}`,display:'flex',padding:'8px 0 6px',position:'sticky',bottom:0}}>
        {navItems.map(item=>(
          <div key={item.key} onClick={()=>setScreen(item.key)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',cursor:'pointer',color:screen===item.key?C.green:C.textMuted,fontSize:'10px'}}>
            <span style={{fontSize:'20px',lineHeight:1}}>{item.icon}</span>
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
      <ShareForVisitModal open={shareOpen} onClose={()=>setShareOpen(false)} patient={patient}/>
    </div>
  )
  return lang==='zh-CN' ? deepSimplify(rootContent) : rootContent
}
