import InstitutionApp from '../components/institution/InstitutionApp'

// This used to offer a PortalSelector (institution vs. insurance partner)
// before rendering either InstitutionApp or InsuranceApp. Archived per the
// BeeFintech pivot: Medsa no longer has a human-facing insurer portal at
// all - the insurer relationship (where there is one) is a pure backend
// sync (pull the insurer's own policy/claim decisions in via
// lib/insuranceAdapter.js, push claim documents out via the claims-plugin
// webhook), not something an insurer logs into Medsa to use. InsuranceApp
// itself is left defined (frozen, not deleted), same as every other
// shelved screen this pivot - see its own file header for the full
// reasoning. Institutions still have a real portal, so that path stays.
export default function InstitutionPage() {
  return <InstitutionApp/>
}
