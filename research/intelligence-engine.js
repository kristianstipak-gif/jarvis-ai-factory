export function buildRiskSignals({ market = {}, onchain = {}, wallet = {} } = {}) {
  const txns = Number(market.txns24h || 0);
  const buyRatio = txns ? Number(market.buys24h || 0) / txns : 0;
  const volumeLiquidity = Number(market.liquidityUsd || 0) > 0
    ? Number(market.volume24h || 0) / Number(market.liquidityUsd)
    : 0;

  const concentration = Number(onchain.top10ShareOfTotalSupply);
  const failedRate = Number(wallet.failedRate);

  const flags = {
    extremeConcentration: Number.isFinite(concentration) && concentration > 0.55,
    extremeBuyImbalance: buyRatio > 0.92,
    extremeVelocity: volumeLiquidity > 8,
    failedTxRate: Number.isFinite(failedRate) && failedRate > 0.25,
    synchronizedCluster: Boolean(wallet.synchronizedCluster),
    creatorLinkedShare: Number(wallet.creatorLinkedShare || 0) > 0.35,
  };

  const riskCount = Object.values(flags).filter(Boolean).length;
  const penalty = riskCount * 10;

  return {
    buyRatio,
    volumeLiquidity,
    concentration: Number.isFinite(concentration) ? concentration : null,
    failedRate: Number.isFinite(failedRate) ? failedRate : null,
    flags,
    riskCount,
    penalty,
  };
}

export function intelligenceScore(baseScore, risk) {
  return Math.max(0, Math.min(100, Math.round(Number(baseScore || 0) - Number(risk?.penalty || 0))));
}
