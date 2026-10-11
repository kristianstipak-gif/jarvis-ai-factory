/**
 * Paper-only position lifecycle helpers. No signing or live order execution.
 */
export const PAPER_DEFAULTS = Object.freeze({
  stopLossPct: 8,
  takeProfitPct: 12,
  maxHoldMinutes: 60,
  feePctRoundTrip: 2.5,
  slippagePerSidePct: 2,
  maxOpenPositions: 3,
  maxTradesPerHour: 6,
  maxDailyLossPct: 2,
  maxPositionPct: 20,
});

export function evaluatePaperExit(position, markPrice, now = Date.now(), options = {}) {
  const cfg = { ...PAPER_DEFAULTS, ...options };
  const entry = Number(position?.entry_price);
  const mark = Number(markPrice);
  const entryTime = Date.parse(position?.entry_at);
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(mark) || mark <= 0) {
    return { close: false, reason: "invalid-mark-or-entry" };
  }
  if (!Number.isFinite(entryTime)) return { close: false, reason: "invalid-entry-time" };
  const grossReturnPct = (mark / entry - 1) * 100;
  const heldMinutes = Math.max(0, (now - entryTime) / 60000);
  if (grossReturnPct <= -cfg.stopLossPct) return { close: true, reason: "stop-loss", grossReturnPct, heldMinutes };
  if (grossReturnPct >= cfg.takeProfitPct) return { close: true, reason: "take-profit", grossReturnPct, heldMinutes };
  if (heldMinutes >= cfg.maxHoldMinutes) return { close: true, reason: "time-stop", grossReturnPct, heldMinutes };
  return { close: false, reason: "hold", grossReturnPct, heldMinutes };
}

export function netReturnPct(grossReturnPct, options = {}) {
  const cfg = { ...PAPER_DEFAULTS, ...options };
  const grossMultiplier = 1 + Number(grossReturnPct) / 100;
  const costMultiplier = (1 - cfg.feePctRoundTrip / 100) *
    Math.pow(1 - cfg.slippagePerSidePct / 100, 2);
  return (grossMultiplier * costMultiplier - 1) * 100;
}

export function paperPositionSize(equityUsd, options = {}) {
  const cfg = { ...PAPER_DEFAULTS, ...options };
  if (!Number.isFinite(Number(equityUsd)) || Number(equityUsd) <= 0) return 0;
  return Math.round(Number(equityUsd) * cfg.maxPositionPct) / 100;
}

/** Fail closed: new paper entries require a positive, sufficiently sampled holdout. */
export function researchGatePassed(report) {
  return Boolean(report?.selection?.holdoutPassed === true &&
    Number(report?.test?.trades) >= 5 &&
    Number.isFinite(Number(report?.test?.meanNetPct)) &&
    Number(report.test.meanNetPct) > 0 &&
    Number.isFinite(Number(report?.test?.profitFactor)) &&
    Number(report.test.profitFactor) > 1);
}
