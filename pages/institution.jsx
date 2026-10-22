// pages/institution.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVED, Oct 22 (correcting an earlier wrong claim this session that
// this page stayed live after the BeeFintech pivot - it didn't, and the
// user's own call was that it never should have: this was meant to be
// shelved very early on, well before the insurer collapse, and stayed
// reachable by oversight, not intent). InstitutionApp is a big-hospital
// operations console (staff shift bidding, department coverage,
// surgery bookings, verbal orders, occupancy/bed management -
// components/institution/InstitutionApp.jsx, all demo/hardcoded data,
// a "Queen Elizabeth Hospital" prototype never wired to real tables).
// Medsa doesn't want to run the inner operational workings of a big
// hospital - that's a different, much larger product than ClinicOps.
// The landing page's "Institution & partner portal" tile (pages/
// index.jsx) is removed alongside this. InstitutionApp itself is left
// defined (frozen, not deleted), same as every other shelved screen.
// ─────────────────────────────────────────────────────────────────────────────

import C from '../components/shared/colours'
import MedsaLogo from '../components/shared/MedsaLogo'

export default function InstitutionPage() {
  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px'}}>
      <div style={{width:'100%',maxWidth:420,textAlign:'center'}}>
        <MedsaLogo height={24}/>
        <div style={{fontSize:'17px',fontWeight:700,color:C.text,marginTop:'16px',marginBottom:'8px'}}>This portal is no longer in use</div>
        <div style={{fontSize:'13px',color:C.textSub,lineHeight:1.6}}>Medsa doesn't manage big-institution operations directly. If you're looking for a clinic's practitioner tools, visit the Practitioner portal instead.</div>
      </div>
    </div>
  )
}
