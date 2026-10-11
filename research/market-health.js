export function summarizeMarketHistory(rows = [], now = Date.now()) {
  const valid = rows.filter(r => r?.observedAt && Number.isFinite(Date.parse(r.observedAt)))
    .slice().sort((a,b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const times = [...new Set(valid.map(r => Date.parse(r.observedAt)))].sort((a,b) => a-b);
  const latest = times.at(-1) ?? null;
  const intervals = times.slice(1).map((t,i) => (t-times[i])/60000).filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b);
  const medianIntervalMinutes = intervals.length
    ? (intervals.length%2 ? intervals[(intervals.length-1)/2] : (intervals[intervals.length/2-1]+intervals[intervals.length/2])/2)
    : null;
  const latestBatchSnapshots = latest === null ? 0 : valid.filter(r=>Date.parse(r.observedAt)===latest).length;
  const ageMinutes = latest === null ? null : Math.max(0,(now-latest)/60000);
  const uniquePairs = new Set(valid.map(r=>String(r.mint||"")+"|"+String(r.pair||""))).size;
  const warnings = [];
  if (times.length < 10) warnings.push("Need at least 10 distinct collection times before interpreting backtest results.");
  if (ageMinutes === null || ageMinutes > 10) warnings.push("Market data is stale: no snapshot within the last 10 minutes.");
  if (valid.length < 500) warnings.push("History is still small; increase the sample before selecting a strategy.");
  return {
    storedSnapshots: valid.length, uniquePairs, distinctCollectionTimes: times.length,
    latestSnapshotAt: latest === null ? null : new Date(latest).toISOString(),
    latestBatchSnapshots, ageMinutes: ageMinutes === null ? null : Math.round(ageMinutes*100)/100,
    medianMinutesBetweenCollections: medianIntervalMinutes === null ? null : Math.round(medianIntervalMinutes*100)/100,
    fresh: ageMinutes !== null && ageMinutes <= 10,
    warnings
  };
}
