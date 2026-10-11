/**
 * JARVIS Auto Trader risk engine.
 * This is a decision/risk layer only: it never signs or submits transactions.
 * Live execution must be implemented separately with a user-controlled wallet.
 */
export const DEFAULT_RISK_LIMITS = Object.freeze({
  maxPositionPct: 1,
  maxOpenPositions: 3,
  maxTradesPerHour: 6,
  maxDailyLossPct: 2,
  minLiquidityUsd: 15000,
  maxPriceChange24hPct: 60,
  minPriceChange24hPct: -8,
  minBuyRatio: 0.56,
  minVolumeLiquidityRatio: 0.75,
  minTransactions24h: 30,
});

export function evaluateAutoTradeCandidate(token, portfolio = {}, options = {}) {
  const limits = { ...DEFAULT_RISK_LIMITS, ...options };
  const reasons = [];
  const price = Number(token?.priceUsd);
  const liquidity = Number(token?.liquidityUsd);
  const volume = Number(token?.volume24h);
  const buys = Number(token?.buys24h);
  const sells = Number(token?.sells24h);
  const change = Number(token?.priceChange24h);
  const transactions = buys + sells;
  const buyRatio = transactions > 0 ? buys / transactions : null;
  const volumeLiquidityRatio = liquidity > 0 ? volume / liquidity : null;
  const openPositions = Number(portfolio.openPositions ?? 0);
  const tradesLastHour = Number(portfolio.tradesLastHour ?? 0);
  const dailyLossPct = Number(portfolio.dailyLossPct ?? 0);
  const equityUsd = Number(portfolio.equityUsd ?? 0);

  if (!Number.isFinite(price) || price <= 0) reasons.push("invalid-price");
  if (!Number.isFinite(liquidity) || liquidity < limits.minLiquidityUsd) reasons.push("liquidity-too-low");
  if (!Number.isFinite(volume) || volume <= 0) reasons.push("invalid-volume");
  if (!Number.isFinite(transactions) || transactions < limits.minTransactions24h) reasons.push("insufficient-transactions");
  if (!Number.isFinite(change) || change < limits.minPriceChange24hPct || change > limits.maxPriceChange24hPct) reasons.push("24h-move-out-of-range");
  if (buyRatio === null || buyRatio < limits.minBuyRatio) reasons.push("buy-pressure-too-low");
  if (volumeLiquidityRatio === null || volumeLiquidityRatio < limits.minVolumeLiquidityRatio) reasons.push("volume-to-liquidity-too-low");
  if (openPositions >= limits.maxOpenPositions) reasons.push("max-open-positions-reached");
  if (tradesLastHour >= limits.maxTradesPerHour) reasons.push("hourly-trade-limit-reached");
  if (dailyLossPct >= limits.maxDailyLossPct) reasons.push("daily-loss-stop-triggered");
  if (!Number.isFinite(equityUsd) || equityUsd <= 0) reasons.push("portfolio-equity-not-configured");

  const positionBudgetUsd = Number.isFinite(equityUsd) && equityUsd > 0
    ? round(equityUsd * limits.maxPositionPct / 100, 2) : 0;

  return {
    decision: reasons.length === 0 ? "PAPER_BUY_CANDIDATE" : "NO_TRADE",
    reasons,
    positionBudgetUsd,
    metrics: {
      priceUsd: finiteOrNull(price),
      liquidityUsd: finiteOrNull(liquidity),
      volumeLiquidityRatio: finiteOrNull(volumeLiquidityRatio),
      buyRatio: finiteOrNull(buyRatio),
      priceChange24hPct: finiteOrNull(change),
      transactions24h: finiteOrNull(transactions),
    },
    execution: "DISABLED",
    note: "This candidate is not an order. Market input is a 24-hour aggregate snapshot, not tick-level execution data.",
  };
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? round(value, 6) : null;
}
function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
