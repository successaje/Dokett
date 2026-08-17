#!/usr/bin/env bash
# Verify already-deployed contracts, for when a deploy succeeded but the
# verification step did not — a broadcast is not worth repeating just to get a
# source listing, and re-deploying to fix verification would orphan the record.
set -euo pipefail

VERIFIER_URL="https://creditcoin-testnet.blockscout.com/api/"
CHAIN=102031

verify() { # <address> <fully:qualified:Name>
  echo "── $2 @ $1"
  forge verify-contract "$1" "$2" \
    --chain-id "$CHAIN" \
    --verifier blockscout \
    --verifier-url "$VERIFIER_URL" \
    --watch || echo "   (failed — may already be verified)"
}

if [ $# -ge 2 ]; then
  verify "$1" "$2"
  exit 0
fi

DEPLOYMENT="deployments/${CHAIN}.json"
if [ ! -f "$DEPLOYMENT" ]; then
  echo "No $DEPLOYMENT. Pass an address and contract path instead:"
  echo "  npm run verify 0xABC… src/Register.sol:Register"
  exit 1
fi

jqv() { node -p "require('./$DEPLOYMENT').$1 || ''"; }

verify "$(jqv ascVerifier)"    src/AscVerifier.sol:AscVerifier
verify "$(jqv register)"       src/Register.sol:Register
verify "$(jqv bond)"           src/Bond.sol:Bond
verify "$(jqv paymentAdapter)" src/adapters/PaymentAdapter.sol:PaymentAdapter
verify "$(jqv silenceAdapter)" src/adapters/SilenceAdapter.sol:SilenceAdapter
