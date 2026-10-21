// pages/insurer-portal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVED (BeeFintech pivot): this used to be the real, public entry
// point for an insurer to log into their own account inside Medsa (Plans/
// Verify/Claims/Promote - see components/insurance/InsuranceApp.jsx).
// Medsa no longer has a human-facing insurer portal at all - the insurer
// relationship, where there is one (directly, or layered under a
// BeeFintech-style agent network), is a pure backend sync: pull the
// insurer's own policy/claim decisions in (lib/insuranceAdapter.js), push
// claim documents out (the claims-plugin webhook, medsa-admin's Insurers
// tab). No insurer needs a login for that. InsuranceApp and the
// verify_insurance_company_password RPC are left defined/untouched
// (frozen, not deleted) in case a real reason to bring a human portal
// back ever comes up.
// ─────────────────────────────────────────────────────────────────────────────

import C from '../components/shared/colours'
import MedsaLogo from '../components/shared/MedsaLogo'

export default function InsurerPortalPage() {
  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:420,textAlign:'center'}}>
        <MedsaLogo height={24}/>
        <div style={{fontSize:'17px',fontWeight:700,color:C.text,marginTop:'16px',marginBottom:'8px'}}>This portal is no longer in use</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Medsa's relationship with insurers is now handled directly between our systems - there's nothing for an insurer to sign into here. If you have a question about a plan, policy, or claim, please reach out to your Medsa contact directly.</div>
      </div>
    </div>
  )
}
