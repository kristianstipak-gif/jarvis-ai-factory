const assert = require("node:assert/strict");
const { meaningfulChanges } = require("./realtime-monitor.cjs");

const old = new Map([
  ["pair-a", { price: 1 }],
  ["pair-b", { price: 2 }]
]);
const changed = meaningfulChanges([
  { pair: "pair-a", priceUsd: 1.002, symbol: "AAA" },
  { pair: "pair-b", priceUsd: 2.001, symbol: "BBB" },
  { pair: "pair-c", priceUsd: 0.5, symbol: "CCC" }
], old, 0.15);
assert.equal(changed.length, 2);
assert.equal(changed[0].reason, "price-move");
assert.equal(changed[1].reason, "new-pair");
assert.equal(meaningfulChanges([{pair:"pair-a",priceUsd:1.0001}],old,0.15).length,0);
console.log("Realtime monitor signal tests passed");
