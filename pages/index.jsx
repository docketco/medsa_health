import { useRouter } from 'next/router'
import MedsaLogo from '../components/shared/MedsaLogo'
import C from '../components/shared/colours'

export default function Home() {
  const router = useRouter()
  const portals = [
    { key:'patient',      icon:'◎', label:'Patient portal',            sub:'Health passport, records, emergency card, insurance, find care', color:C.green, bg:C.greenLight,   path:'/patient' },
    { key:'practitioner', icon:'◈', label:'Practitioner portal',       sub:'Clock in, log patients, schedule — for all healthcare staff',   color:C.blue,  bg:C.blueLight,    path:'/practitioner' },
    { key:'institution',  icon:'⬡', label:'Institution & partner portal', sub:'Hospital admin, insurance partners, schedule, occupancy',    color:C.navy,  bg:C.navyLight,    path:'/institution' },
  ]
  return (
    <div style={{ background:C.beige, minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 20px' }}>
      <div style={{ textAlign:'center', marginBottom:'36px' }}>
        <MedsaLogo height={36} color={C.green}/>
        <div style={{ fontSize:'13px', color:C.textSub, marginTop:'8px' }}>Your universal health passport</div>
      </div>
      <div style={{ width:'100%', maxWidth:'400px', display:'flex', flexDirection:'column', gap:'12px' }}>
        {portals.map(p=>(
          <div key={p.key} onClick={()=>router.push(p.path)} style={{ background:C.cream, border:`0.5px solid ${C.border}`, borderRadius:'16px', padding:'18px 20px', cursor:'pointer', display:'flex', alignItems:'center', gap:'16px' }}>
            <div style={{ width:48, height:48, background:p.bg, borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', color:p.color, flexShrink:0 }}>{p.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'15px', fontWeight:600, color:C.text }}>{p.label}</div>
              <div style={{ fontSize:'12px', color:C.textSub, marginTop:'2px', lineHeight:1.4 }}>{p.sub}</div>
            </div>
            <span style={{ fontSize:'20px', color:C.textMuted }}>›</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize:'11px', color:C.textMuted, marginTop:'28px' }}>medsa.health · Hong Kong · v1.0</div>
    </div>
  )
}
