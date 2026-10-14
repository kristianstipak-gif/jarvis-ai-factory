import { strict as assert } from "node:assert";
import { evaluatePaperExit, netReturnPct, paperPositionSize, researchGatePassed } from "./paper-trading.js";

const position = { entry_price: "1", entry_at: new Date("2026-01-01T00:00:00Z").toISOString() };
assert.equal(evaluatePaperExit(position, 0.91, Date.parse("2026-01-01T00:10:00Z")).reason, "stop-loss");
assert.equal(evaluatePaperExit(position, 1.13, Date.parse("2026-01-01T00:10:00Z")).reason, "take-profit");
assert.equal(evaluatePaperExit(position, 1.01, Date.parse("2026-01-01T01:01:00Z")).reason, "time-stop");
assert.equal(evaluatePaperExit(position, 1.01, Date.parse("2026-01-01T00:10:00Z")).close, false);
assert.ok(netReturnPct(1) < 0, "tiny gains should not hide assumed round-trip costs");
assert.equal(paperPositionSize(1000), 200); // default maxPositionPct is 20%
assert.equal(paperPositionSize(0), 0);
assert.equal(researchGatePassed({}), false);
assert.equal(researchGatePassed({selection:{holdoutPassed:false},test:{trades:10,meanNetPct:3,profitFactor:2}}), false);
assert.equal(researchGatePassed({selection:{holdoutPassed:true},test:{trades:5,meanNetPct:1,profitFactor:1.1}}), true);
console.log("Paper trading lifecycle tests passed");
