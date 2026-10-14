/**
 * JARVIS live-trading readiness gate.
 * No signing or order submission is implemented here.
 */
export const DEFAULT_LIVE_RISK_LIMITS = Object.freeze({
  maxOrderUsd: 10, maxPositionUsd: 20, maxOpenPositions: 2,
  maxTradesPerHour: 4, maxDailyLossUsd: 5, maxDailyLossPct: 2,
  minSolanaLiquidityUsd: 25000, maxSlippageBps: 100, minNetProfitPct: 1.0,
});
export function assessTradingReadiness(env = process.env) {
  const required = {
    binanceApiKey: Boolean(env.BINANCE_API_KEY),
    binanceApiSecret: Boolean(env.BINANCE_API_SECRET),
    jupiterApiKey: Boolean(env.JUPITER_API_KEY),
    solanaRpcUrl: Boolean(env.SOLANA_RPC_URL),
    durableDatabase: Boolean(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY)),
  };
  return {
    mode: "pre-live-readiness", liveExecutionEnabled: false, ordersAllowed: false,
    required, missing: Object.entries(required).filter(([, ok]) => !ok).map(([key]) => key),
    riskLimits: DEFAULT_LIVE_RISK_LIMITS,
    blockers: [
      "Live order executor and venue-specific signing are not implemented or verified.",
      "Tick-aligned market data and stale-data order blocking are required.",
      "Strategy must pass out-of-sample paper tests after fees, spread, slippage and failed fills.",
      "Solana tokens require mint/freeze authority, liquidity, sellability and scam checks.",
      "Live trading remains disabled by design; environment variables alone never enable it."
    ],
    note: "Diagnostics only. Secret values are never returned and orders are never placed."
  };
}
export function checkOrderRisk(order, portfolio, limits = DEFAULT_LIVE_RISK_LIMITS) {
  const reasons = [];
  const usd = Number(order?.notionalUsd), slippageBps = Number(order?.slippageBps);
  if (!Number.isFinite(usd) || usd <= 0) reasons.push("invalid-order-notional");
  if (usd > limits.maxOrderUsd) reasons.push("order-exceeds-max-usd");
  if (Number(portfolio?.openPositions ?? 0) >= limits.maxOpenPositions) reasons.push("max-open-positions");
  if (Number(portfolio?.tradesLastHour ?? 0) >= limits.maxTradesPerHour) reasons.push("hourly-trade-limit");
  if (Number(portfolio?.dailyLossUsd ?? 0) >= limits.maxDailyLossUsd) reasons.push("daily-loss-limit");
  if (Number(portfolio?.dailyLossPct ?? 0) >= limits.maxDailyLossPct) reasons.push("daily-loss-percent-limit");
  if (Number.isFinite(slippageBps) && slippageBps > limits.maxSlippageBps) reasons.push("slippage-exceeds-limit");
  if (order?.marketDataFresh !== true) reasons.push("market-data-not-confirmed-fresh");
  if (order?.netProfitAfterCostsPct == null || Number(order.netProfitAfterCostsPct) < limits.minNetProfitPct) reasons.push("net-edge-below-minimum");
  return { allowed: false, reasons: [...new Set(reasons)], execution: "DISABLED" };
}
