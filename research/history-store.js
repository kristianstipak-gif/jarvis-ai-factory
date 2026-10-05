export function bucketTimestamp(iso, seconds = 30) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || seconds <= 0) return null;
  return new Date(Math.floor(ms / (seconds * 1000)) * seconds * 1000).toISOString();
}

export function observationKey(row, bucketSeconds = 30) {
  if (!row?.mint) return null;
  const bucket = bucketTimestamp(row.observedAt, bucketSeconds);
  return bucket ? [row.mint, row.pair || "", bucket].join("|") : null;
}

export function appendHistoricalRows(history = [], incoming = [], bucketSeconds = 30) {
  const seen = new Set(history.map((x) => observationKey(x, bucketSeconds)).filter(Boolean));
  const added = [];

  for (const row of incoming) {
    const key = observationKey(row, bucketSeconds);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    added.push(row);
  }

  return [...history, ...added].sort(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)
  );
}

export function groupByMint(history = []) {
  const groups = new Map();
  for (const row of history) {
    if (!row?.mint) continue;
    if (!groups.has(row.mint)) groups.set(row.mint, []);
    groups.get(row.mint).push(row);
  }
  return groups;
}
