export function buildTimeSplit(rows = [], ratios = { train: 0.70, validation: 0.15, test: 0.15 }) {
  const sorted = [...rows]
    .filter((x) => x?.observedAt && !Number.isNaN(Date.parse(x.observedAt)))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

  const totalRatio = Number(ratios.train) + Number(ratios.validation) + Number(ratios.test);
  if (!Number.isFinite(totalRatio) || totalRatio <= 0) throw new Error("Invalid split ratios");

  const trainEnd = Math.floor(sorted.length * Number(ratios.train) / totalRatio);
  const validationEnd = trainEnd + Math.floor(sorted.length * Number(ratios.validation) / totalRatio);

  return {
    train: sorted.slice(0, trainEnd),
    validation: sorted.slice(trainEnd, validationEnd),
    test: sorted.slice(validationEnd),
    counts: {
      total: sorted.length,
      train: trainEnd,
      validation: validationEnd - trainEnd,
      test: sorted.length - validationEnd
    }
  };
}

export function makeOutcome(snapshot, futureSnapshots = [], horizonMinutes = null) {
  const snapshotTime = Date.parse(snapshot?.observedAt);
  const start = Number(snapshot?.priceUsd);
  if (!Number.isFinite(snapshotTime) || !Number.isFinite(start) || start <= 0) return null;

  const future = futureSnapshots.filter((x) => {
    const t = Date.parse(x?.observedAt);
    if (!Number.isFinite(t) || t <= snapshotTime) return false;
    if (horizonMinutes == null) return true;
    return t <= snapshotTime + Number(horizonMinutes) * 60000;
  });

  if (!future.length) return null;

  const prices = future.map((x) => Number(x?.priceUsd)).filter((x) => Number.isFinite(x) && x > 0);
  if (!prices.length) return null;

  const peak = Math.max(...prices);
  const trough = Math.min(...prices);
  const peakIndex = prices.indexOf(peak);
  const prePeakPrices = prices.slice(0, peakIndex + 1);
  const prePeakTrough = Math.min(start, ...prePeakPrices);

  return {
    peakMultiple: peak / start,
    maxDrawdownFromObservation: 1 - trough / peak,
    drawdownBeforePeak: 1 - prePeakTrough / peak,
    observationsAfter: future.length,
    horizonMinutes: horizonMinutes == null ? null : Number(horizonMinutes),
  };
}
