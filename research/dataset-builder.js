export function buildTimeSplit(rows = [], ratios = { train: 0.70, validation: 0.15, test: 0.15 }) {
  const sorted = [...rows]
    .filter((x) => x?.observedAt && !Number.isNaN(Date.parse(x.observedAt)))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

  const n = sorted.length;
  const trainEnd = Math.floor(n * ratios.train);
  const validationEnd = trainEnd + Math.floor(n * ratios.validation);

  return {
    train: sorted.slice(0, trainEnd),
    validation: sorted.slice(trainEnd, validationEnd),
    test: sorted.slice(validationEnd),
    counts: {
      total: n,
      train: trainEnd,
      validation: validationEnd - trainEnd,
      test: n - validationEnd
    }
  };
}

export function makeOutcome(snapshot, futureSnapshots = []) {
  const future = futureSnapshots.filter(
    (x) => Date.parse(x.observedAt) > Date.parse(snapshot.observedAt)
  );

  if (!future.length) return null;

  const start = Number(snapshot.priceUsd);
  const prices = future.map((x) => Number(x.priceUsd)).filter(Number.isFinite);
  if (!Number.isFinite(start) || start <= 0 || !prices.length) return null;

  const peak = Math.max(...prices);
  const trough = Math.min(...prices);

  return {
    peakMultiple: peak / start,
    maxDrawdownFromObservation: 1 - trough / peak,
    observationsAfter: future.length
  };
}
