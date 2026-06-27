import { useState } from 'react'
import MedsaLogo from '../components/shared/MedsaLogo'
import C from '../components/shared/colours'
import InstitutionApp from '../components/institution/InstitutionApp'
import InsuranceApp from '../components/insurance/InsuranceApp'

function PortalSelector({ onSelect }) {
  const options = [
    { key:'institution', icon:'◈', label:'Institution portal', sub:'Hospitals, clinics, practices — staff, patients, schedule', color:C.green, bg:C.greenLight },
    { key:'insurance',   icon:'⬡', label:'Insurance partner portal', sub:'List plans, manage claims, sponsor AI recommendations', color:C.navy, bg:C.navyLight },
  ]
  return (
    <div style={{ background:C.beige, minHeight:'100vh', display:'flex', flexDirection:'column' }}>
      <div style={{ background:C.green, padding:'28px 20px 20px' }}>
        <MedsaLogo height={26}/>
        <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.5)', marginTop:'6px', letterSpacing:'1.5px', textTransform:'uppercase' }}>institution & partner portal</div>
      </div>
      <div style={{ flex:1, padding:'24px 20px' }}>
        <div style={{ fontSize:'20px', fontWeight:700, color:C.text, marginBottom:'6px' }}>Select your portal</div>
        <div style={{ fontSize:'13px', color:C.textSub, lineHeight:1.6, marginBottom:'28px' }}>Medsa serves both medical institutions and insurance partners. Select your organisation type to continue.</div>
        {options.map(p => (
          <div key={p.key} onClick={() => onSelect(p.key)} style={{ background:C.cream, border:`0.5px solid ${C.border}`, borderRadius:'16px', padding:'20px', marginBottom:'12px', cursor:'pointer', display:'flex', alignItems:'center', gap:'16px' }}>
            <div style={{ width:52, height:52, background:p.bg, borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', color:p.color, flexShrink:0 }}>{p.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'16px', fontWeight:600, color:C.text }}>{p.label}</div>
              <div style={{ fontSize:'12px', color:C.textSub, marginTop:'2px', lineHeight:1.4 }}>{p.sub}</div>
            </div>
            <span style={{ fontSize:'20px', color:C.textMuted }}>›</span>
          </div>
        ))}
        <div style={{ background:C.brownLight, border:`0.5px solid ${C.border}`, borderRadius:'12px', padding:'14px 16px', marginTop:'8px' }}>
          <div style={{ fontSize:'12px', color:C.brown, lineHeight:1.6 }}><strong>New organisation?</strong> Contact Medsa to apply for an institution or partner account. All credentials are verified before portal access is granted.</div>
        </div>
      </div>
    </div>
  )
}

export default function InstitutionPage() {
  const [portal, setPortal] = useState(null)
  if (!portal)                return <PortalSelector onSelect={setPortal}/>
  if (portal === 'institution') return <InstitutionApp/>
  if (portal === 'insurance')   return <InsuranceApp/>
}
