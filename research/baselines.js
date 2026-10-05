import { evaluateRanking } from "./metrics.js";

export function makeBaselineRows(rows = [], feature = "score") {
  return rows.map((x) => ({
    ...x,
    score:
      feature === "volume" ? Number(x.volume24h || 0) :
      feature === "momentum" ? Number(x.priceChange24h || 0) :
      feature === "liquidity" ? Number(x.liquidityUsd || 0) :
      Number(x.score || 0),
  }));
}

export function compareBaselines(rows = [], options = {}) {
  const names = ["score", "volume", "momentum", "liquidity"];
  return names.map((name) => ({
    baseline: name,
    metrics: evaluateRanking(makeBaselineRows(rows, name), options),
  }));
}
