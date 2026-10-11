import { strict as assert } from "node:assert";
import { evaluateAutoTradeCandidate } from "./auto-trader.js";

const token = {
  priceUsd: 0.001,
  liquidityUsd: 50000,
  volume24h: 100000,
  buys24h: 80,
  sells24h: 20,
  priceChange24h: 12,
};
const portfolio = { equityUsd: 1000, openPositions: 0, tradesLastHour: 0, dailyLossPct: 0 };
const allowed = evaluateAutoTradeCandidate(token, portfolio);
assert.equal(allowed.decision, "PAPER_BUY_CANDIDATE");
assert.equal(allowed.execution, "DISABLED");
assert.equal(allowed.positionBudgetUsd, 200);

assert.ok(evaluateAutoTradeCandidate(token, { ...portfolio, openPositions: 3 }).reasons.includes("max-open-positions-reached"));
assert.ok(evaluateAutoTradeCandidate(token, { ...portfolio, tradesLastHour: 6 }).reasons.includes("hourly-trade-limit-reached"));
assert.ok(evaluateAutoTradeCandidate(token, { ...portfolio, dailyLossPct: 2 }).reasons.includes("daily-loss-stop-triggered"));
assert.equal(evaluateAutoTradeCandidate(token, {}).decision, "NO_TRADE");
assert.equal(evaluateAutoTradeCandidate({ ...token, liquidityUsd: 100 }, portfolio).decision, "NO_TRADE");
console.log("Auto trader risk tests passed");
