import { selectEnrichmentCandidates, enrichCandidate } from "./enrichment.js";

export async function enrichRankedCandidates(candidates = [], { minScore = 55, maxCandidates = 10, fetchToken, fetchWallet } = {}) {
  if (typeof fetchToken !== "function" || typeof fetchWallet !== "function") {
    throw new Error("fetchToken and fetchWallet are required");
  }

  const selected = selectEnrichmentCandidates(candidates, { minScore, maxCandidates });
  return Promise.all(
    selected.map((candidate) => enrichCandidate(candidate, fetchToken, fetchWallet))
  );
}
