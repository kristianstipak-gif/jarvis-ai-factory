export function precisionAtK(rows = [], k = 10) {
  const ranked = rows.filter((x) => Number.isFinite(x?.score) && typeof x?.label === "boolean")
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, k));

  if (!ranked.length) return null;
  return ranked.filter((x) => x.label).length / ranked.length;
}

export function recallAtK(rows = [], k = 10) {
  const valid = rows.filter((x) => Number.isFinite(x?.score) && typeof x?.label === "boolean");
  const positives = valid.filter((x) => x.label).length;
  if (!positives) return null;

  const top = [...valid].sort((a, b) => b.score - a.score).slice(0, Math.max(0, k));
  return top.filter((x) => x.label).length / positives;
}

export function hitRate(rows = [], threshold = 2) {
  const valid = rows.filter((x) => Number.isFinite(x?.score) && Number.isFinite(x?.peakMultiple));
  if (!valid.length) return null;

  return valid.filter((x) => x.peakMultiple >= threshold).length / valid.length;
}

export function brierScore(rows = []) {
  const valid = rows.filter((x) => Number.isFinite(x?.probability) && typeof x?.label === "boolean");
  if (!valid.length) return null;

  return valid.reduce((sum, x) => {
    const p = Math.max(0, Math.min(1, x.probability));
    const y = x.label ? 1 : 0;
    return sum + (p - y) ** 2;
  }, 0) / valid.length;
}

export function calibrationBins(rows = [], bins = 10) {
  const valid = rows.filter((x) => Number.isFinite(x?.probability) && typeof x?.label === "boolean");
  const result = [];

  for (let i = 0; i < bins; i += 1) {
    const low = i / bins;
    const high = (i + 1) / bins;
    const bucket = valid.filter((x) => {
      const p = Math.max(0, Math.min(1, x.probability));
      return i === bins - 1 ? p >= low && p <= high : p >= low && p < high;
    });

    result.push({
      low,
      high,
      count: bucket.length,
      predicted: bucket.length
        ? bucket.reduce((s, x) => s + Math.max(0, Math.min(1, x.probability)), 0) / bucket.length
        : null,
      observed: bucket.length
        ? bucket.filter((x) => x.label).length / bucket.length
        : null,
    });
  }

  return result;
}

export function evaluateRanking(rows = [], { k = 10, peakThreshold = 2 } = {}) {
  return {
    samples: rows.length,
    precisionAtK: precisionAtK(rows, k),
    recallAtK: recallAtK(rows, k),
    hitRate: hitRate(rows, peakThreshold),
    brierScore: brierScore(rows),
    calibration: calibrationBins(rows),
  };
}
