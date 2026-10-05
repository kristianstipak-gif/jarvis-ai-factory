export function selectEnrichmentCandidates(rows = [], {
  minScore = 55,
  maxCandidates = 10,
} = {}) {
  return [...rows]
    .filter((x) => x?.ok && Number(x?.scoring?.score) >= minScore)
    .sort((a, b) => Number(b.scoring.score) - Number(a.scoring.score))
    .slice(0, maxCandidates);
}

export async function enrichCandidate(candidate, fetchToken, fetchWallet) {
  const mint = candidate?.snapshot?.mint;
  if (!mint) return { ...candidate, enrichment: { status: "invalid-mint" } };

  let onchain = null;
  let wallet = null;
  const errors = [];

  try {
    onchain = await fetchToken(mint);
  } catch {
    errors.push("onchain");
  }

  // The mint address is not a wallet. Analyze the largest observed owner instead.
  const owner = onchain?.ownerRank?.[0]?.owner || null;
  if (owner) {
    try {
      wallet = await fetchWallet(owner);
    } catch {
      errors.push("wallet");
    }
  } else {
    errors.push("wallet-owner-unavailable");
  }

  return {
    ...candidate,
    enrichment: {
      status: errors.length ? "partial" : "complete",
      onchain,
      wallet,
      walletAddress: owner,
      errors,
    },
  };
}
