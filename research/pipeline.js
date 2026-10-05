import { buildSnapshot } from "./snapshot-builder.js";
import { scoreCandidate } from "./score.js";

export function processMarketCandidate(market, enrichment = {}) {
  const { snapshot, validation } = buildSnapshot(market, enrichment.onchain || {});
  if (!snapshot) return { ok: false, validation };

  const scored = scoreCandidate({
    market,
    onchain: enrichment.onchain || {},
    wallet: enrichment.wallet || {},
  });

  return {
    ok: true,
    snapshot,
    scoring: scored,
    observedAt: snapshot.observedAt,
  };
}

export function rankCandidates(candidates = []) {
  return [...candidates]
    .filter((x) => x?.ok && Number.isFinite(x?.scoring?.score))
    .sort((a, b) => b.scoring.score - a.scoring.score);
}
