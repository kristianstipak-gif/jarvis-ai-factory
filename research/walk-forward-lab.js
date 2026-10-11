/**
 * JARVIS walk-forward strategy lab.
 * Fixed, bounded parameter grid; time-ordered train/test split; no live orders.
 * Every simulated fill pays entry+exit costs through a conservative round-trip model.
 */
export const DEFAULT_LAB_CONFIG = Object.freeze({
  trainFraction: 0.7,
  minTrainTrades: 12,
  minTestTrades: 5,
  feePctRoundTrip: 2.5,
  slippagePctPerSide: 2,
  minLiquidityGrid: [5000, 15000, 30000],
  minBuyRatioGrid: [0.52, 0.56, 0.60],
  minVolumeLiquidityGrid: [0.25, 0.75],
  minTransactionsGrid: [10, 30],
  horizonMinutesGrid: [15, 60],
});

const round = (x, n = 4) => Number.isFinite(x) ? Math.round(x * 10 ** n) / 10 ** n : null;

function validRows(rows) {
  return rows.filter(r => r?.mint && r?.observedAt &&
    Number.isFinite(Date.parse(r.observedAt)) &&
    Number.isFinite(Number(r.priceUsd)) && Number(r.priceUsd) > 0)
    .map(r => ({
      ...r,
      _t: Date.parse(r.observedAt),
      _p: Number(r.priceUsd),
      _liq: Number(r.liquidityUsd),
      _vol: Number(r.volume24h),
      _buys: Number(r.buys24h),
      _sells: Number(r.sells24h),
      _txns: Number(r.txns24h),
    }))
    .sort((a,b) => a._t - b._t);
}

function parameterGrid(config) {
  const out = [];
  for (const minLiquidityUsd of config.minLiquidityGrid)
    for (const minBuyRatio of config.minBuyRatioGrid)
      for (const minVolumeLiquidityRatio of config.minVolumeLiquidityGrid)
        for (const minTransactions of config.minTransactionsGrid)
          for (const horizonMinutes of config.horizonMinutesGrid)
            out.push({ minLiquidityUsd, minBuyRatio, minVolumeLiquidityRatio, minTransactions, horizonMinutes });
  return out;
}

function passes(row, p) {
  const txns = Number.isFinite(row._txns) ? row._txns :
    (Number.isFinite(row._buys) && Number.isFinite(row._sells) ? row._buys + row._sells : NaN);
  const buyRatio = Number.isFinite(row._buys) && Number.isFinite(row._sells) && row._buys + row._sells > 0
    ? row._buys / (row._buys + row._sells) : null;
  const volLiq = row._liq > 0 && Number.isFinite(row._vol) ? row._vol / row._liq : null;
  return Number.isFinite(row._liq) && row._liq >= p.minLiquidityUsd &&
    Number.isFinite(txns) && txns >= p.minTransactions &&
    buyRatio !== null && buyRatio >= p.minBuyRatio &&
    volLiq !== null && volLiq >= p.minVolumeLiquidityRatio;
}

function summarize(trades) {
  const returns = trades.map(t => t.netReturnPct).filter(Number.isFinite);
  if (!returns.length) return { trades: 0, meanNetPct: null, medianNetPct: null, winRatePct: null, profitFactor: null, maxDrawdownPct: null };
  const sorted = [...returns].sort((a,b) => a-b);
  const mean = returns.reduce((a,b) => a+b, 0) / returns.length;
  const mid = Math.floor(sorted.length/2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
  const gains = returns.filter(x => x > 0).reduce((a,b)=>a+b,0);
  const losses = -returns.filter(x => x < 0).reduce((a,b)=>a+b,0);
  let equity = 1, peak = 1, maxDrawdown = 0;
  for (const r of trades.map(t=>t.netReturnPct)) {
    equity *= Math.max(0, 1 + r/100);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak-equity)/peak*100 : 100);
  }
  return {
    trades: returns.length,
    meanNetPct: round(mean),
    medianNetPct: round(median),
    winRatePct: round(returns.filter(x=>x>0).length/returns.length*100, 2),
    profitFactor: losses > 0 ? round(gains/losses, 3) : gains > 0 ? null : 0,
    maxDrawdownPct: round(maxDrawdown, 2),
  };
}

function simulate(rows, params, startTime, endTime, config) {
  const byPair = new Map();
  for (const row of rows) {
    if (row._t < startTime || row._t >= endTime) continue;
    const key = row.mint + "|" + (row.pair || "");
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(row);
  }
  const trades = [];
  const costMultiplier = (1 - config.feePctRoundTrip/100) *
    Math.pow(1 - config.slippagePctPerSide/100, 2);
  for (const series of byPair.values()) {
    let nextEntryTime = -Infinity;
    for (let i=0; i<series.length; i++) {
      const entry = series[i];
      if (entry._t < nextEntryTime || !passes(entry, params)) continue;
      const exit = series.slice(i+1).find(r => r._t >= entry._t + params.horizonMinutes*60000);
      // Never let a trade cross the train/test boundary.
      if (!exit || exit._t >= endTime) continue;
      const netReturnPct = (exit._p / entry._p * costMultiplier - 1) * 100;
      if (!Number.isFinite(netReturnPct)) continue;
      trades.push({ mint: entry.mint, pair: entry.pair || null, entryAt: entry.observedAt,
        exitAt: exit.observedAt, horizonMinutes: params.horizonMinutes,
        grossReturnPct: round((exit._p/entry._p-1)*100), netReturnPct: round(netReturnPct) });
      nextEntryTime = exit._t;
    }
  }
  return trades.sort((a,b)=>Date.parse(a.entryAt)-Date.parse(b.entryAt));
}

export function runWalkForwardLab(inputRows = [], options = {}) {
  const config = { ...DEFAULT_LAB_CONFIG, ...options };
  const rows = validRows(inputRows);
  const grid = parameterGrid(config);
  const uniqueTimes = [...new Set(rows.map(r=>r._t))].sort((a,b)=>a-b);
  const splitIndex = Math.floor(uniqueTimes.length * config.trainFraction);
  const splitTime = uniqueTimes[splitIndex];
  const startTime = uniqueTimes[0] ?? 0;
  const endTime = uniqueTimes.at(-1) === undefined ? 0 : uniqueTimes.at(-1) + 1;
  if (uniqueTimes.length < 10 || !Number.isFinite(splitTime)) {
    return {
      mode: "walk-forward-research-only", eligible: false, reason: "insufficient-history",
      observations: rows.length, uniqueTimes: uniqueTimes.length, gridConfigurations: grid.length,
      train: { start: null, end: null }, test: { start: null, end: null },
      selection: null, leaderboard: [], limitations: ["Collect more time-spaced snapshots before interpreting results.", "No live trading is performed."]
    };
  }

  const scored = grid.map(params => {
    const trainTrades = simulate(rows, params, startTime, splitTime, config);
    return { params, train: summarize(trainTrades), _trainTrades: trainTrades };
  }).sort((a,b) =>
    (b.train.meanNetPct ?? -Infinity) - (a.train.meanNetPct ?? -Infinity) ||
    (b.train.profitFactor ?? -Infinity) - (a.train.profitFactor ?? -Infinity)
  );

  const eligible = scored.filter(x => x.train.trades >= config.minTrainTrades &&
    Number.isFinite(x.train.meanNetPct));
  const winner = eligible[0] || null;
  let testSummary = null;
  let testTrades = [];
  if (winner) {
    testTrades = simulate(rows, winner.params, splitTime, endTime, config);
    testSummary = summarize(testTrades);
  }

  const trainRows = rows.filter(r=>r._t < splitTime);
  const testRows = rows.filter(r=>r._t >= splitTime);
  const testPassed = Boolean(winner && testSummary &&
    testSummary.trades >= config.minTestTrades &&
    Number.isFinite(testSummary.meanNetPct) && testSummary.meanNetPct > 0 &&
    Number.isFinite(testSummary.profitFactor) && testSummary.profitFactor > 1);
  return {
    mode: "walk-forward-research-only",
    eligible: Boolean(winner && testSummary && testSummary.trades >= config.minTestTrades),
    verdict: !winner ? "NO_TRAINING_WINNER: not enough eligible training trades; do not select a strategy." :
      !testSummary || testSummary.trades < config.minTestTrades ? "INSUFFICIENT_TEST_TRADES: collect more data; do not deploy." :
      testPassed ? "PROVISIONAL_PAPER_ONLY: positive holdout metrics in this limited sample; continue paper trading." :
      "NO_EDGE_CONFIRMED: selected training strategy did not pass the holdout gate.",
    observations: rows.length,
    uniqueMintPairs: new Set(rows.map(r=>r.mint+"|"+(r.pair||""))).size,
    gridConfigurations: grid.length,
    assumptions: {
      trainFraction: config.trainFraction,
      roundTripFeePct: config.feePctRoundTrip,
      slippagePerSidePct: config.slippagePctPerSide,
      minTrainTrades: config.minTrainTrades,
      minTestTrades: config.minTestTrades,
      parameterSelection: "training period only; one selected configuration tested on the later holdout",
    },
    train: { observations: trainRows.length, start: trainRows[0]?.observedAt || null,
      end: trainRows.at(-1)?.observedAt || null, ...(winner ? winner.train : { trades: 0 }) },
    test: { observations: testRows.length, start: testRows[0]?.observedAt || null,
      end: testRows.at(-1)?.observedAt || null, ...(testSummary || { trades: 0 }) },
    selection: winner ? { params: winner.params, training: winner.train, holdout: testSummary,
      holdoutPassed: testPassed, holdoutTrades: testTrades.slice(0,100) } : null,
    leaderboard: scored.slice(0,10).map(x=>({ params:x.params, train:x.train })),
    limitations: [
      "The grid is finite and predeclared; this is not an infinite search or a guarantee of profit.",
      "The data are sparse market snapshots with rolling 24-hour aggregates, not tick-level order-book or historical trade data.",
      "The model selects one configuration on training data and evaluates it on a later holdout; repeated changes after seeing holdout results invalidate that holdout.",
      "Fees and slippage are assumptions; token taxes, MEV, failed fills, priority fees, route impact and outages are not fully modeled.",
      "A positive holdout is provisional evidence only; require fresh forward paper trading before any live execution.",
      "No wallet connection, signing, or real orders are implemented."
    ]
  };
}
