import { makeOutcome, buildTimeSplit } from "./dataset-builder.js";

export function buildOutcomes(history = []) {
  const sorted = [...history]
    .filter((x) => x?.mint && x?.observedAt)
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

  const byMint = new Map();
  for (const row of sorted) {
    if (!byMint.has(row.mint)) byMint.set(row.mint, []);
    byMint.get(row.mint).push(row);
  }

  return sorted.map((snapshot) => {
    const series = byMint.get(snapshot.mint) || [];
    return {
      mint: snapshot.mint,
      observedAt: snapshot.observedAt,
      outcome: makeOutcome(snapshot, series),
    };
  });
}

export function buildBacktestDataset(history = []) {
  const outcomes = buildOutcomes(history)
    .filter((x) => x.outcome)
    .map((x) => ({
      ...x,
      label: x.outcome.peakMultiple >= 2,
    }));

  return {
    ...buildTimeSplit(outcomes),
    labels: {
      positive: outcomes.filter((x) => x.label).length,
      negative: outcomes.filter((x) => !x.label).length,
    },
  };
}
