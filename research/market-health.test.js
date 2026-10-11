import { strict as assert } from "node:assert";
import { summarizeMarketHistory } from "./market-health.js";

const now=Date.parse("2026-10-11T15:00:00.000Z");
const rows=[];
for(let i=0;i<12;i++) {
  for(let coin=0;coin<3;coin++) rows.push({
    mint:"mint-"+coin,pair:"pair-"+coin,
    observedAt:new Date(now-(11-i)*5*60000).toISOString(),priceUsd:1
  });
}
const report=summarizeMarketHistory(rows,now);
assert.equal(report.storedSnapshots,36);
assert.equal(report.distinctCollectionTimes,12);
assert.equal(report.latestBatchSnapshots,3);
assert.equal(report.uniquePairs,3);
assert.equal(report.fresh,true);
assert.equal(report.medianMinutesBetweenCollections,5);
assert.equal(summarizeMarketHistory([],now).fresh,false);
assert.ok(summarizeMarketHistory([],now).warnings.length>=2);
console.log("Market history health tests passed");
