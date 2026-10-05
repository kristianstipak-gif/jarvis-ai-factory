import { riskPenalty } from "./risk-rules.js";

export function buildRiskSignals({ market = {}, onchain = {}, wallet = {} } = {}) {
  const txns = Number(market.txns24h);
  const buys = Number(market.buys24h);
  const buyRatio = Number.isFinite(txns) && txns > 0 && Number.isFinite(buys) ? buys / txns : null;

  const liquidity = Number(market.liquidityUsd);
  const volume = Number(market.volume24h);
  const volumeLiquidity = Number.isFinite(liquidity) && liquidity > 0 && Number.isFinite(volume)
    ? volume / liquidity
    : null;

  const concentration = Number(onchain.top10ShareOfTotalSupply);
  const failedRate = Number(wallet.failedRate);
  const creatorLinkedShare = Number(wallet.creatorLinkedShare);

  const flags = {
    extremeConcentration: Number.isFinite(concentration) && concentration > 0.55,
    extremeBuyImbalance: Number.isFinite(buyRatio) && buyRatio > 0.92,
    extremeVelocity: Number.isFinite(volumeLiquidity) && volumeLiquidity > 8,
    failedTxRate: Number.isFinite(failedRate) && failedRate > 0.25,
    synchronizedCluster: Boolean(wallet.synchronizedCluster),
    creatorLinkedShare: Number.isFinite(creatorLinkedShare) && creatorLinkedShare > 0.35,
  };

  return {
    buyRatio,
    volumeLiquidity,
    concentration: Number.isFinite(concentration) ? concentration : null,
    failedRate: Number.isFinite(failedRate) ? failedRate : null,
    flags,
    riskCount: Object.values(flags).filter(Boolean).length,
    penalty: riskPenalty(flags),
  };
}

export function intelligenceScore(baseScore, risk) {
  return Math.max(0, Math.min(100, Math.round(Number(baseScore || 0) - Number(risk?.penalty || 0))));
}
