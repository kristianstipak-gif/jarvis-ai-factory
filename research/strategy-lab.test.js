import { strict as assert } from "node:assert";
import { evaluateMomentumSignal, estimateRoundTripReturnPct } from "./strategy-lab.js";

const good = evaluateMomentumSignal({
  priceUsd: 0.00001,
  liquidityUsd: 50000,
  volume5mUsd: 40000,
  buys5m: 80,
  sells5m: 30,
  priceChange5mPct: 12,
});
assert.equal(good.signal, "WATCH_FOR_PAPER_TRADE");
assert.equal(good.reasons.length, 0);

const illiquid = evaluateMomentumSignal({
  priceUsd: 0.00001,
  liquidityUsd: 500,
  volume5mUsd: 40000,
  buys5m: 80,
  sells5m: 30,
  priceChange5mPct: 12,
});
assert.equal(illiquid.signal, "NO_TRADE");
assert.ok(illiquid.reasons.includes("insufficient-liquidity"));

assert.ok(estimateRoundTripReturnPct(5, { roundTripFeePct: 1, slippagePerSidePct: 0.5 }) < 5);
assert.ok(estimateRoundTripReturnPct(1, { roundTripFeePct: 1, slippagePerSidePct: 0.5 }) < 0);
assert.throws(() => estimateRoundTripReturnPct(5, { roundTripFeePct: -1 }), /Invalid/);

console.log("Strategy Lab tests passed");
