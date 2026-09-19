// components/shared/TermsAgreementModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Digitizes the health declaration - it used to be one inline checkbox
// sentence next to a save/buy button, both for a patient buying a plan
// automatically and for an agent issuing one. Real gap: a patient or agent
// could tick that box without ever actually reading what they were agreeing
// to, and the sentence itself never said anything concrete (which
// conditions, which plan, what happens if something's missing).
// Modelled on the Uber Merchant onboarding pattern the user asked for: a
// real scrollable document, built from the plan's own on-file terms
// (waiting period, pre-existing condition policy, insurer flags) and
// whatever was actually declared - not boilerplate - with "I agree"
// disabled until the content has actually been scrolled through.
// Shared between PatientApp.jsx (automated purchase) and AgentApp.jsx
// (agent-issued policy) so both flows go through the same real screen.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react'
import C from './colours'

export default function TermsAgreementModal({
  open, onClose, onAccept, isEn=true,
  planName, companyName, declaredConditions=[], historyConditions=[],
  waitingPeriodDays, preExistingConditionPolicy, contractUrl, onViewContract,
}) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const [contractViewed, setContractViewed] = useState(false)
  const scrollRef = useRef(null)

  if (!open) return null

  function handleScroll(e) {
    const el = e.target
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolledToEnd(true)
  }
  async function handleViewContract() {
    if (onViewContract) { await onViewContract(); setContractViewed(true) }
  }

  const allDeclared = [...new Set([...(declaredConditions||[]), ...(historyConditions||[])])].filter(Boolean)
  const canAccept = scrolledToEnd && (!contractUrl || contractViewed)

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'20px 24px 12px',borderBottom:`0.5px solid ${C.border}`}}>
          <div style={{fontSize:'17px',fontWeight:700,color:C.text}}>{isEn?'Health declaration & terms':'健康聲明及條款'}</div>
          <div style={{fontSize:'12px',color:C.textMuted,marginTop:'2px'}}>{planName}{companyName?` — ${companyName}`:''}</div>
        </div>

        <div ref={scrollRef} onScroll={handleScroll} style={{overflowY:'auto',padding:'20px 24px',fontSize:'13px',lineHeight:1.7,color:C.text,flex:1}}>
          <div style={{marginBottom:'20px'}}>
            <div style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',color:C.textMuted,marginBottom:'8px'}}>{isEn?'1. What you are declaring':'1. 您所聲明的事項'}</div>
            {allDeclared.length>0
              ? <>
                  <div style={{marginBottom:'6px'}}>{isEn?'You are declaring the following, for this application:':'您正就此申請聲明以下事項：'}</div>
                  <ul style={{margin:'0 0 6px',paddingLeft:'20px'}}>{allDeclared.map((c,i)=><li key={i}>{c}</li>)}</ul>
                </>
              : <div>{isEn?'You have declared no medical conditions for this application.':'您並未就此申請聲明任何醫療狀況。'}</div>}
            <div style={{color:C.textMuted,fontSize:'12px'}}>{isEn?'This has already been checked against this plan\'s coverage - see the read on the previous screen.':'此聲明已與此計劃的保障範圍核對 - 詳見上一畫面的結果。'}</div>
          </div>

          <div style={{marginBottom:'20px'}}>
            <div style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',color:C.textMuted,marginBottom:'8px'}}>{isEn?'2. This plan\'s rules':'2. 此計劃的條款'}</div>
            <div style={{marginBottom:'4px'}}>{isEn?`Waiting period: ${waitingPeriodDays!=null?`${waitingPeriodDays} days before most benefits can be claimed.`:'not set by the insurer yet.'}`:`等候期：${waitingPeriodDays!=null?`大部分保障須待${waitingPeriodDays}天後方可申索。`:'保險公司尚未設定。'}`}</div>
            <div>{isEn?`Pre-existing conditions: ${preExistingConditionPolicy||'not set by the insurer yet - ask before relying on cover for anything declared above.'}`:`已有病症：${preExistingConditionPolicy||'保險公司尚未設定 - 在依賴上述聲明的保障前請先查詢。'}`}</div>
          </div>

          <div style={{marginBottom:'20px'}}>
            <div style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',color:C.textMuted,marginBottom:'8px'}}>{isEn?'3. If something is missing':'3. 如有遺漏'}</div>
            <div>{isEn?'Insurers rely on this declaration being complete and accurate. Leaving out a condition you knew about at the time of applying can lead to a claim being reduced, delayed, or refused, or the policy being cancelled - this is standard across health insurance in Hong Kong, not specific to Medsa or this insurer.':'保險公司依賴此聲明的完整及準確性。若在申請時未有申報已知的病況，可能導致索償被削減、延遲或拒絕，甚至保單被取消 - 這是香港健康保險業的一般做法，並非Medsa或此保險公司獨有的規定。'}</div>
          </div>

          {contractUrl&&<div style={{marginBottom:'20px'}}>
            <div style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',color:C.textMuted,marginBottom:'8px'}}>{isEn?'4. Policy contract':'4. 保單合約'}</div>
            <div style={{marginBottom:'8px'}}>{isEn?'The insurer has provided a full contract for this plan - review it before agreeing below.':'保險公司已提供此計劃的完整合約 - 請在下方同意前先行查閱。'}</div>
            <button onClick={handleViewContract} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:'8px',padding:'10px',fontSize:'12px',fontFamily:'inherit',background:contractViewed?C.greenXLight:'#fff',color:contractViewed?C.green:C.text,cursor:'pointer'}}>{contractViewed?(isEn?'✓ Contract reviewed - view again':'✓ 已查閱合約 - 再次查看'):(isEn?'View the full contract':'查看完整合約')}</button>
          </div>}

          <div style={{fontSize:'11px',color:C.textMuted,paddingTop:'8px',borderTop:`0.5px solid ${C.border}`}}>
            {isEn?'Scroll to the end to enable "I agree" below.':'請捲動至底部以啟用下方的「我同意」按鈕。'}
          </div>
        </div>

        <div style={{padding:'16px 24px 24px',borderTop:`0.5px solid ${C.border}`}}>
          {!scrolledToEnd&&<div style={{fontSize:'11px',color:C.amber,textAlign:'center',marginBottom:'8px'}}>{isEn?'Please read through to the end first.':'請先閱讀至結尾。'}</div>}
          {scrolledToEnd&&contractUrl&&!contractViewed&&<div style={{fontSize:'11px',color:C.amber,textAlign:'center',marginBottom:'8px'}}>{isEn?'Please view the contract above first.':'請先查看上方的合約。'}</div>}
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={onClose} style={{flex:1,border:`0.5px solid ${C.border}`,borderRadius:'10px',padding:'12px',fontSize:'13px',fontFamily:'inherit',background:C.card,color:C.text,cursor:'pointer'}}>{isEn?'Cancel':'取消'}</button>
            <button onClick={()=>canAccept&&onAccept()} disabled={!canAccept} style={{flex:1,border:'none',borderRadius:'10px',padding:'12px',fontSize:'13px',fontWeight:600,fontFamily:'inherit',background:canAccept?C.green:C.border,color:'#fff',cursor:canAccept?'pointer':'not-allowed'}}>{isEn?'I agree':'我同意'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
