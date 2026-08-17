#!/usr/bin/env bash
#
# Verify deployed contracts on Blockscout.
#
# Split out from deploying because `forge script --verify` refuses chain 102031
# outright ("Chain not supported") — Foundry has no built-in entry for it —
# while `forge verify-contract --chain-id 102031` works fine. Rather than fight
# that, deployment broadcasts and this reads what was actually deployed.
#
#   npm run verify                              # everything in the last broadcast
#   npm run verify 0xADDR src/Register.sol:Register
#
set -uo pipefail

CHAIN=102031
VERIFIER_URL="https://creditcoin-testnet.blockscout.com/api/"

verify() {
  echo "── $2"
  echo "   $1"
  forge verify-contract "$1" "$2" \
    --chain-id "$CHAIN" \
    --verifier blockscout \
    --verifier-url "$VERIFIER_URL" \
    --watch 2>&1 | tail -3
}

if [ $# -ge 2 ]; then
  verify "$1" "$2"
  exit 0
fi

# Resolve a bare contract name to the path Foundry needs, by finding where it is
# declared. Cheaper and less brittle than maintaining a hand-written map.
resolve() {
  local name="$1"
  local hit
  hit=$(grep -rlE "^(abstract )?contract ${name}\b" src script 2>/dev/null | head -1)
  [ -n "$hit" ] && echo "${hit}:${name}"
}

found=0
for f in broadcast/*/"$CHAIN"/run-latest.json; do
  [ -f "$f" ] || continue
  echo "▸ $f"
  while IFS=$'\t' read -r name addr; do
    [ -z "$name" ] && continue
    [ "$name" = "null" ] && continue
    path=$(resolve "$name")
    if [ -z "$path" ]; then
      echo "── $name @ $addr — skipped, declaration not found in src/ or script/"
      continue
    fi
    verify "$addr" "$path"
    found=$((found + 1))
  done < <(node -e "
    const d=require('./$f');
    for (const t of d.transactions||[])
      if (t.contractAddress) console.log((t.contractName||'null')+'\t'+t.contractAddress);
  ")
done

[ "$found" -eq 0 ] && echo "Nothing to verify. Deploy first, or pass an address and contract path."
exit 0
