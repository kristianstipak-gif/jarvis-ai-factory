import assert from "node:assert/strict";
import { assessTradingReadiness, checkOrderRisk } from "./trading-safety.js";
const ready = assessTradingReadiness({ BINANCE_API_KEY:"set", BINANCE_API_SECRET:"set", JUPITER_API_KEY:"set",
  SOLANA_RPC_URL:"set", SUPABASE_URL:"set", SUPABASE_SERVICE_ROLE_KEY:"set" });
assert.equal(ready.liveExecutionEnabled, false);
assert.equal(ready.ordersAllowed, false);
assert.deepEqual(ready.missing, []);
const denied = checkOrderRisk({ notionalUsd:100, slippageBps:200, marketDataFresh:false, netProfitAfterCostsPct:-1 },
  { openPositions:2, tradesLastHour:4, dailyLossUsd:5, dailyLossPct:2 });
assert.equal(denied.allowed, false);
for (const reason of ["order-exceeds-max-usd","max-open-positions","hourly-trade-limit","daily-loss-limit",
  "daily-loss-percent-limit","slippage-exceeds-limit","market-data-not-confirmed-fresh","net-edge-below-minimum"])
  assert.ok(denied.reasons.includes(reason), "expected risk blocker " + reason);
assert.ok(assessTradingReadiness({}).missing.length >= 5);
console.log("JARVIS trading safety tests passed");
