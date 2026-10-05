import { buildIntelligenceResult } from "./intelligence-result.js";

export function buildCandidateIntelligence(candidate = {}) {
  const market = {
    ...(candidate.market || candidate.snapshot || {}),
    baseScore: candidate.market?.baseScore ?? candidate.scoring?.baseScore ?? candidate.scoring?.score ?? 0,
  };
  const onchain = candidate.enrichment?.onchain || candidate.onchain || {};
  const wallet = candidate.enrichment?.wallet || candidate.wallet || {};
  const creator = candidate.enrichment?.creator || candidate.creator || {};
  const mint = candidate.enrichment?.mint || candidate.enrichment?.onchain?.mintAccount || candidate.mint || {};

  return {
    ...candidate,
    intelligence: buildIntelligenceResult({ market, onchain, wallet, creator, mint }),
  };
}

export function rankIntelligence(candidates = []) {
  return candidates
    .map(buildCandidateIntelligence)
    .sort((a, b) => Number(b.intelligence?.score || 0) - Number(a.intelligence?.score || 0));
}
