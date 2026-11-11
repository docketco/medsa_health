// pages/underwriter-portal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVED (BeeFintech pivot): this used to be a self-serve login for an
// insurer's own underwriter staff to review their flagged/clean-signoff
// queue directly. Same reasoning as claim-review.jsx's archival - Medsa
// isn't the decision-maker, but still has to provide the space for one,
// and a second full login system per insurer for a feature most never
// used doesn't fit that. Every insurer's queue is now relayed by Medsa
// staff instead (medsa-admin.jsx's Underwriting tab, calling the same
// pages/api/underwriter/list_queue.js and decide.js this portal always
// used - approve or decline, no inner work, same as before). UnderwriterApp
// itself is left defined/untouched in components/underwriter/UnderwriterApp.jsx
// (frozen, not deleted), and insurance_companies.underwriting_delegated_to_medsa
// now defaults true for the same reason.
// ─────────────────────────────────────────────────────────────────────────────

import C from '../components/shared/colours'
import MedsaLogo from '../components/shared/MedsaLogo'

export default function UnderwriterPortalPage() {
  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:420,textAlign:'center'}}>
        <MedsaLogo height={24}/>
        <div style={{fontSize:'17px',fontWeight:700,color:C.text,marginTop:'16px',marginBottom:'8px'}}>This portal is no longer in use</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Underwriting decisions are now relayed by Medsa staff rather than reviewed through a separate insurer login. If you have a case that needs attention, please reach out to your Medsa contact directly.</div>
      </div>
    </div>
  )
}
