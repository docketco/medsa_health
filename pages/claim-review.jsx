import { useRouter } from 'next/router'
import { AgentClaimView } from '../components/insurance/InsuranceApp'

// medsa.health/claim-review?claim=CLM-XXXXX - real claim, real
// approve/reject decision written to insurance_claims. Previously
// rendered AgentClaimView with no props at all, so it always showed one
// hardcoded fake claim regardless of the URL.
export default function ClaimReview() {
  const router = useRouter()
  const claimRef = router.query.claim
  return (
    <div style={{ maxWidth:'440px', margin:'0 auto', minHeight:'100vh', background:'#f0ede8' }}>
      <AgentClaimView claimRef={claimRef}/>
    </div>
  )
}
