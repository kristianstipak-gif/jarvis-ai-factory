import { buildRiskSignals, intelligenceScore } from "./intelligence-engine.js";

export function marketBaseScore(t = {}) {
  const liquidity = Number(t.liquidityUsd);
  const volume = Number(t.volume24h);
  const txns = Number(t.txns24h);
  const buys = Number(t.buys24h);
  const change = Number(t.priceChange24h);

  const velocity = Number.isFinite(liquidity) && liquidity > 0 && Number.isFinite(volume)
    ? Math.min(1, (volume / liquidity) / 3)
    : 0;
  const flow = Number.isFinite(txns) && txns > 0 && Number.isFinite(buys)
    ? Math.min(1, buys / txns)
    : 0;
  const activity = Number.isFinite(txns) ? Math.min(1, txns / 500) : 0;
  const liq = Number.isFinite(liquidity) ? Math.min(1, liquidity / 100000) : 0;
  const momentum = Number.isFinite(change) ? Math.max(0, Math.min(1, (change + 20) / 80)) : 0;

  return Math.round(100 * (
    .30 * velocity +
    .20 * flow +
    .20 * activity +
    .15 * liq +
    .15 * momentum
  ));
}

export function scoreCandidate({ market = {}, onchain = {}, wallet = {} } = {}) {
  const baseScore = marketBaseScore(market);
  const risk = buildRiskSignals({ market, onchain, wallet });
  return {
    baseScore,
    risk,
    score: intelligenceScore(baseScore, risk),
    tier: intelligenceScore(baseScore, risk) >= 80 ? "A"
      : intelligenceScore(baseScore, risk) >= 65 ? "B"
      : intelligenceScore(baseScore, risk) >= 50 ? "C" : "D",
  };
}
