import { useRouter } from 'next/router'
import { AgentClaimView } from '../components/insurance/InsuranceApp'

// medsa.health/claim-review?claim=CLM-XXXXX - real claim, real
// approve/reject decision written to insurance_claims. Previously
// rendered AgentClaimView with no props at all, so it always showed one
// hardcoded fake claim regardless of the URL.
export default function ClaimReview() {
  const router = useRouter()
  // Real bug this fixes: router.query.claim reads as undefined on the
  // very first client render - Next hasn't parsed the URL's query string
  // yet (router.isReady is false) - so AgentClaimView used to mount with
  // no claimRef at all, immediately conclude "not found," and (a separate
  // bug fixed alongside this one - see AgentClaimView's load()) never
  // clear that flag once the router caught up and the real claim loaded
  // successfully a moment later. A genuinely valid /claim-review link
  // read as permanently broken. Now waits for the router before mounting
  // AgentClaimView at all, so it only ever sees the real claim ref.
  if (!router.isReady) {
    return <div style={{ maxWidth:'440px', margin:'0 auto', minHeight:'100vh', background:'#f0ede8', padding:'32px 20px', textAlign:'center', fontSize:'13px', color:'#6b6560' }}>Loading...</div>
  }
  const claimRef = router.query.claim
  return (
    <div style={{ maxWidth:'440px', margin:'0 auto', minHeight:'100vh', background:'#f0ede8' }}>
      <AgentClaimView claimRef={claimRef}/>
    </div>
  )
}
