// pages/insurer-plans.jsx
// ─────────────────────────────────────────────────────────────────────────────
// This page's real functionality (plan create/edit, tied to a real
// insurance_companies row) moved into /medsa-admin's Insurers tab, under
// "Manage plans" on each onboarded company - onboarding a company and
// managing its plans is now one tool, not two separate pages. This stub
// just forwards anyone with the old link/bookmark there.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useRouter } from 'next/router'
import C from '../components/shared/colours'

export default function InsurerPlansRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/medsa-admin') }, [router])
  return (
    <div style={{background:C.beige,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',fontSize:'13px',color:C.textSub}}>
      Insurer plan management moved to Medsa Admin - redirecting…
    </div>
  )
}
