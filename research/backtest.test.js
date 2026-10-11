import { strict as assert } from "node:assert";
import { runSnapshotBacktest } from "./backtest.js";
const rows=[];
for(let i=0;i<40;i++){
 const start=new Date(Date.UTC(2026,0,1,0,i*2)).toISOString();
 const end=new Date(Date.parse(start)+60*60000).toISOString();
 rows.push({mint:"m"+i,pair:"p"+i,observedAt:start,priceUsd:1,liquidityUsd:10000,volume24h:5000,txns24h:40,buys24h:25,sells24h:15});
 rows.push({mint:"m"+i,pair:"p"+i,observedAt:end,priceUsd:1.1,liquidityUsd:10000,volume24h:5000,txns24h:40,buys24h:25,sells24h:15});
}
const report=runSnapshotBacktest(rows,{horizonMinutes:60,feePct:2.5,slippagePct:2});
assert.equal(report.observations,80);
assert.equal(report.strategies.all.samples,40);
assert.equal(report.strategies.all.winRatePct,100);
assert.equal(report.strategies.all.positiveExpectancy,true);
assert.equal(runSnapshotBacktest([]).strategies.all.samples,0);
console.log("Backtest unit tests passed");
