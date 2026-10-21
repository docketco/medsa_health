// pages/claim-review.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVED (BeeFintech pivot): this used to be a standalone link
// (?claim=CLM-XXXXX) to AgentClaimView - a real human approve/reject
// decision on a Medsa-held claim, written straight to insurance_claims.
// That manual-decision screen made sense when Medsa itself stood in for
// an insurer/TPA's claims reviewer. It doesn't anymore: the insurer's own
// decision now gets pulled INTO Medsa (lib/insuranceAdapter.js) rather
// than decided inside Medsa by a human, and pushed documents go OUT via
// the claims-plugin webhook - there's no manual-decision link left to
// send anyone. AgentClaimView itself is left defined/untouched in
// components/insurance/InsuranceApp.jsx (frozen, not deleted).
// ─────────────────────────────────────────────────────────────────────────────

import C from '../components/shared/colours'
import MedsaLogo from '../components/shared/MedsaLogo'

export default function ClaimReview() {
  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:420,textAlign:'center'}}>
        <MedsaLogo height={24}/>
        <div style={{fontSize:'17px',fontWeight:700,color:C.text,marginTop:'16px',marginBottom:'8px'}}>This review link is no longer in use</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Claim decisions are no longer made through a Medsa link. If you were sent this link for a specific claim, please reach out to your Medsa contact directly.</div>
      </div>
    </div>
  )
}
