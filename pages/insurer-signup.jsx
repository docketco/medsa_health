// pages/insurer-signup.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVED (BeeFintech pivot): this used to be public, no-login self-serve
// signup for an insurer (see /api/insurer/signup.js, left untouched).
// Same reasoning as pages/insurer-portal.jsx's header comment - Medsa no
// longer has a human-facing insurer portal to sign up for at all. Onboarding
// an insurer for the backend sync (plan catalog, claims-plugin webhook) is
// now a Medsa-admin-only action (medsa-admin's Insurers tab), not self-serve.
// ─────────────────────────────────────────────────────────────────────────────

import C from '../components/shared/colours'
import MedsaLogo from '../components/shared/MedsaLogo'

export default function InsurerSignupPage() {
  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:420,textAlign:'center'}}>
        <MedsaLogo height={24}/>
        <div style={{fontSize:'17px',fontWeight:700,color:C.text,marginTop:'16px',marginBottom:'8px'}}>Self-serve sign-up is no longer available</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Medsa onboards insurance partners directly rather than through self-serve sign-up. If you'd like to explore a partnership, please contact Medsa directly.</div>
      </div>
    </div>
  )
}
