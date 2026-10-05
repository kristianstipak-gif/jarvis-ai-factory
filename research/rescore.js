import { scoreCandidate } from "./score.js";

export function rescoreEnrichedCandidate(candidate) {
  const market = candidate?.market || candidate?.snapshot || {};
  const onchain = candidate?.enrichment?.onchain || {};
  const wallet = candidate?.enrichment?.wallet || {};

  const scoring = scoreCandidate({ market, onchain, wallet });

  return {
    ...candidate,
    scoring,
    enrichmentStatus: candidate?.enrichment?.status || "unknown",
  };
}

export function rescoreAll(candidates = []) {
  return candidates
    .map(rescoreEnrichedCandidate)
    .sort((a, b) => Number(b?.scoring?.score || 0) - Number(a?.scoring?.score || 0));
}
