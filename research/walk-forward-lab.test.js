import { strict as assert } from "node:assert";
import { runWalkForwardLab } from "./walk-forward-lab.js";

const rows = [];
// Generate time-ordered, reproducible data for unit testing only.
for (let minute=0; minute<300; minute+=5) {
  for (let coin=0; coin<4; coin++) {
    const trend = 1 + minute*0.01;
    rows.push({
      mint: "mint-"+coin, pair: "pair-"+coin,
      observedAt: new Date(Date.UTC(2026,0,1,0,minute)).toISOString(),
      priceUsd: trend*(1+coin*0.01),
      liquidityUsd: 50000, volume24h: 100000,
      txns24h: 100, buys24h: 70, sells24h: 30
    });
  }
}
const report = runWalkForwardLab(rows, { minTrainTrades: 2, minTestTrades: 1 });
assert.equal(report.mode, "walk-forward-research-only");
assert.equal(report.gridConfigurations, 72);
assert.ok(report.train.observations > 0);
assert.ok(report.test.observations > 0);
assert.ok(report.leaderboard.length > 0);
assert.equal(report.selection?.params?.horizonMinutes === 15 || report.selection?.params?.horizonMinutes === 60, true);
assert.ok(report.limitations.some(x=>x.includes("not a guarantee of profit")));
assert.equal(runWalkForwardLab([]).eligible, false);
console.log("Walk-forward lab tests passed");
