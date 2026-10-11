/**
 * JARVIS Strategy Lab: transparent, deterministic signal evaluation.
 * Research only: this module never sends orders and never promises profit.
 */
export function evaluateMomentumSignal(snapshot, options = {}) {
  const minLiquidityUsd = Number(options.minLiquidityUsd ?? 10000);
  const minVolumeLiquidityRatio = Number(options.minVolumeLiquidityRatio ?? 0.5);
  const minBuyRatio = Number(options.minBuyRatio ?? 0.55);
  const minTxns = Number(options.minTxns ?? 20);
  const maxPriceChangePct = Number(options.maxPriceChangePct ?? 80);
  const maxPriceChangePctMin = Number(options.maxPriceChangePctMin ?? -10);

  const price = Number(snapshot?.priceUsd);
  const liquidity = Number(snapshot?.liquidityUsd);
  const volume = Number(snapshot?.volume5mUsd ?? snapshot?.volume24h);
  const buys = Number(snapshot?.buys5m ?? snapshot?.buys24h);
  const sells = Number(snapshot?.sells5m ?? snapshot?.sells24h);
  const priceChange = Number(snapshot?.priceChange5mPct ?? snapshot?.priceChange24h);

  const reasons = [];
  if (!Number.isFinite(price) || price <= 0) reasons.push("invalid-price");
  if (!Number.isFinite(liquidity) || liquidity < minLiquidityUsd) reasons.push("insufficient-liquidity");
  if (!Number.isFinite(volume) || volume <= 0) reasons.push("invalid-volume");
  if (!Number.isFinite(buys) || !Number.isFinite(sells) || buys + sells < minTxns) reasons.push("insufficient-trades");
  if (!Number.isFinite(priceChange) || priceChange < maxPriceChangePctMin || priceChange > maxPriceChangePct) reasons.push("momentum-out-of-range");

  const buyRatio = Number.isFinite(buys) && Number.isFinite(sells) && buys + sells > 0
    ? buys / (buys + sells) : null;
  const volumeLiquidityRatio = Number.isFinite(volume) && Number.isFinite(liquidity) && liquidity > 0
    ? volume / liquidity : null;

  if (buyRatio !== null && buyRatio < minBuyRatio) reasons.push("buy-pressure-not-confirmed");
  if (volumeLiquidityRatio !== null && volumeLiquidityRatio < minVolumeLiquidityRatio) reasons.push("volume-not-confirmed");

  return {
    signal: reasons.length === 0 ? "WATCH_FOR_PAPER_TRADE" : "NO_TRADE",
    reasons,
    metrics: {
      priceUsd: Number.isFinite(price) ? price : null,
      liquidityUsd: Number.isFinite(liquidity) ? liquidity : null,
      buyRatio: buyRatio === null ? null : round(buyRatio, 4),
      volumeLiquidityRatio: volumeLiquidityRatio === null ? null : round(volumeLiquidityRatio, 4),
      priceChangePct: Number.isFinite(priceChange) ? priceChange : null,
    },
    note: "Research filter only. A signal is not a buy recommendation; validate with time-aligned data, execution costs, and out-of-sample paper trading.",
  };
}

export function estimateRoundTripReturnPct(grossMovePct, options = {}) {
  const feePct = Number(options.roundTripFeePct ?? 1);
  const slippagePerSidePct = Number(options.slippagePerSidePct ?? 0.5);
  if (![grossMovePct, feePct, slippagePerSidePct].every(Number.isFinite) ||
      feePct < 0 || feePct >= 100 || slippagePerSidePct < 0 || slippagePerSidePct >= 100) {
    throw new Error("Invalid gross move or execution cost assumptions");
  }
  const grossMultiplier = 1 + grossMovePct / 100;
  const costMultiplier = (1 - feePct / 100) * Math.pow(1 - slippagePerSidePct / 100, 2);
  return round((grossMultiplier * costMultiplier - 1) * 100, 4);
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
