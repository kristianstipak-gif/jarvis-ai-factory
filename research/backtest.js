/**
 * Snapshot-only, time-forward research backtest. No live orders or wallet access.
 * Fees and slippage are assumptions, not venue quotes.
 */
export function runSnapshotBacktest(rows = [], options = {}) {
  const horizonMinutes = Number(options.horizonMinutes ?? 60);
  const feePct = Number(options.feePct ?? 2.5);
  const slippagePct = Number(options.slippagePct ?? 2);
  const minLiquidityUsd = Number(options.minLiquidityUsd ?? 5000);
  const minSamples = Number(options.minSamples ?? 30);
  if (!(horizonMinutes > 0) || ![feePct, slippagePct, minLiquidityUsd].every(Number.isFinite) ||
      feePct < 0 || slippagePct < 0 || minLiquidityUsd < 0) throw new Error("Invalid backtest parameters");

  const valid = rows.filter(r => r?.mint && r?.observedAt && Number.isFinite(Date.parse(r.observedAt)) &&
    Number.isFinite(Number(r.priceUsd)) && Number(r.priceUsd) > 0)
    .map(r => ({ ...r, _t: Date.parse(r.observedAt), _p: Number(r.priceUsd) }))
    .sort((a,b) => a._t-b._t);
  const groups = new Map();
  for (const r of valid) {
    const key = r.mint + "|" + (r.pair || "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const costMultiplier = (1-feePct/100) * Math.pow(1-slippagePct/100, 2);
  const candidates = { all: [], liquidity: [], buyFlow: [], activity: [] };
  for (const series of groups.values()) for (let i=0; i<series.length; i++) {
    const entry = series[i];
    const exit = series.slice(i+1).find(r => r._t >= entry._t + horizonMinutes*60000);
    if (!exit) continue;
    const gross = (exit._p/entry._p-1)*100;
    const net = (exit._p/entry._p*costMultiplier-1)*100;
    const result = { mint: entry.mint, observedAt: entry.observedAt, exitAt: exit.observedAt, grossReturnPct: round(gross), netReturnPct: round(net) };
    candidates.all.push(result);
    const liq = Number(entry.liquidityUsd), vol = Number(entry.volume24h);
    const buys = Number(entry.buys24h), sells = Number(entry.sells24h), txns = Number(entry.txns24h);
    if (Number.isFinite(liq) && liq >= minLiquidityUsd) candidates.liquidity.push(result);
    if (Number.isFinite(liq) && liq >= minLiquidityUsd && Number.isFinite(buys) && Number.isFinite(sells) &&
        buys+sells >= 10 && buys/(buys+sells) >= .55) candidates.buyFlow.push(result);
    if (Number.isFinite(liq) && liq >= minLiquidityUsd && Number.isFinite(vol) && vol/liq >= .2 &&
        Number.isFinite(txns) && txns >= 20) candidates.activity.push(result);
  }
  const summarize = xs => {
    const v = xs.map(x=>x.netReturnPct).filter(Number.isFinite).sort((a,b)=>a-b);
    if (!v.length) return { samples: 0, meanNetReturnPct: null, medianNetReturnPct: null, winRatePct: null, eligible: false };
    const mean = v.reduce((a,b)=>a+b,0)/v.length;
    return { samples:v.length, meanNetReturnPct:round(mean), medianNetReturnPct:round(v[Math.floor(v.length/2)]),
      winRatePct:round(v.filter(x=>x>0).length/v.length*100), bestNetReturnPct:v.at(-1), worstNetReturnPct:v[0],
      eligible:v.length>=minSamples, positiveExpectancy:v.length>=minSamples && mean>0 };
  };
  return {
    mode:"historical-snapshot-research-only", observations:valid.length, uniqueMintPairs:groups.size,
    horizonMinutes, assumptions:{ roundTripPlatformFeePct:feePct, slippagePerSidePct:slippagePct, minLiquidityUsd, minSamples },
    strategies:Object.fromEntries(Object.entries(candidates).map(([k,v])=>[k,summarize(v)])),
    verdict:valid.length<100 ? "INSUFFICIENT_HISTORY: collect more snapshots before evaluating edge." :
      "RESEARCH_ONLY: require chronological out-of-sample validation and paper trading before live use.",
    limitations:["Snapshots may be sparse; exit uses first observation at or after horizon.",
      "No exact historical order-book depth, MEV, failed fills, priority fees, token taxes, or route fees.",
      "Observations overlap and are not independent; results are not proof of future profit.",
      "This endpoint never places trades."]
  };
}
function round(n){ return Math.round(n*100)/100; }
