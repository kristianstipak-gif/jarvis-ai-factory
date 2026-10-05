const HORIZONS = [60, 360, 1440];

export function buildForwardOutcomes(snapshot, series = []) {
  return Object.fromEntries(
    HORIZONS.map((minutes) => [
      minutes,
      makeHorizonOutcome(snapshot, series, minutes),
    ])
  );
}

function makeHorizonOutcome(snapshot, series, minutes) {
  const t0 = Date.parse(snapshot?.observedAt);
  const start = Number(snapshot?.priceUsd);
  if (!Number.isFinite(t0) || !Number.isFinite(start) || start <= 0) return null;

  const end = t0 + minutes * 60000;
  const future = series.filter((x) => {
    const t = Date.parse(x?.observedAt);
    return Number.isFinite(t) && t > t0 && t <= end;
  });

  const prices = future.map((x) => Number(x?.priceUsd)).filter((x) => Number.isFinite(x) && x > 0);
  if (!prices.length) return null;

  const peak = Math.max(...prices);
  const trough = Math.min(...prices);

  return {
    horizonMinutes: minutes,
    peakMultiple: peak / start,
    troughMultiple: trough / start,
    maxDrawdownFromObservation: 1 - trough / peak,
    positive2x: peak / start >= 2,
    observations: prices.length,
  };
}

export function attachForwardOutcomes(rows = []) {
  const byMint = new Map();

  for (const row of rows) {
    if (!row?.mint) continue;
    if (!byMint.has(row.mint)) byMint.set(row.mint, []);
    byMint.get(row.mint).push(row);
  }

  return rows.map((row) => ({
    ...row,
    outcomes: buildForwardOutcomes(row, byMint.get(row.mint) || []),
  }));
}
