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

  const [onchainResult, walletResult] = await Promise.allSettled([
    fetchToken(mint),
    fetchWallet(mint),
  ]);

  return {
    ...candidate,
    enrichment: {
      status: "complete",
      onchain: onchainResult.status === "fulfilled" ? onchainResult.value : null,
      wallet: walletResult.status === "fulfilled" ? walletResult.value : null,
      errors: [
        ...(onchainResult.status === "rejected" ? ["onchain"] : []),
        ...(walletResult.status === "rejected" ? ["wallet"] : []),
      ],
    },
  };
}
