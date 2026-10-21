// pages/claim-submit.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVED (BeeFintech pivot): this used to be the entry point for the
// out-of-network TPA claim intake flow (components/tpa/TpaClinicApp.jsx -
// "the Uber Eats side of the insurance work," per that file's own header
// comment), scoped to patients holding a policy through one of Medsa's own
// platform-partner insurers. Medsa no longer runs any direct insurer
// partnership that would make this TPA role meaningful - the insurer
// relationship, where there is one, is a pure backend sync (pull decisions
// in, push claim documents out), not Medsa acting as biller/router for an
// out-of-network clinic. TpaClinicApp and its admin provisioning (medsa-
// admin's TPA Clinics tab) are left defined/untouched (frozen, not
// deleted) in case a real TPA-style deal ever actually calls for them.
// ─────────────────────────────────────────────────────────────────────────────

import C from '../components/shared/colours'
import MedsaLogo from '../components/shared/MedsaLogo'

export default function ClaimSubmitPage() {
  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:420,textAlign:'center'}}>
        <MedsaLogo height={24}/>
        <div style={{fontSize:'17px',fontWeight:700,color:C.text,marginTop:'16px',marginBottom:'8px'}}>This claim intake is no longer in use</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Out-of-network claim submission through Medsa has been retired. If you have a question about an existing claim, please reach out to your Medsa contact directly.</div>
      </div>
    </div>
  )
}
