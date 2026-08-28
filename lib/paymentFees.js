// Stripe's cut has to come from somewhere - for sponsor invoicing
// (unlike clinic point-of-sale, where lib/insuranceAdapter.js deducts
// the card fee from the clinic's payout instead) the sponsor is the
// one being invoiced, so the fee gets added on top instead: Medsa
// still receives the full price it quoted, the sponsor's card is
// charged slightly more to cover Stripe's fee.
//
// Rates are Stripe's published Hong Kong online-card default (3.4% +
// HK$2.35 per successful charge) - an estimate. Once there's a real
// Stripe account, confirm the actual negotiated rate for the account's
// country/card mix and adjust these two constants if it differs.
const STRIPE_PCT = 0.034
const STRIPE_FIXED_HKD = 2.35

export function grossUpForStripeFee(netAmountHKD) {
  const net = parseFloat(netAmountHKD) || 0
  const gross = (net + STRIPE_FIXED_HKD) / (1 - STRIPE_PCT)
  const fee = gross - net
  return { netAmountHKD: net, grossAmountHKD: Math.round(gross * 100) / 100, estimatedFeeHKD: Math.round(fee * 100) / 100 }
}
