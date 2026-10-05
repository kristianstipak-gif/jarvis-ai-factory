import { validateSnapshot, normalizeSnapshot } from "./snapshot-validator.js";

export function validateHistoricalDataset(rows = []) {
  const errors = [];
  const seen = new Set();

  for (let i = 0; i < rows.length; i += 1) {
    const normalized = normalizeSnapshot(rows[i]);
    const result = validateSnapshot(normalized);

    for (const error of result.errors) {
      errors.push({ index: i, mint: rows[i]?.mint || null, error });
    }

    const key = [normalized.mint, normalized.pair || "", normalized.observedAt].join("|");
    if (seen.has(key)) errors.push({ index: i, mint: normalized.mint, error: "duplicate observation" });
    seen.add(key);
  }

  const ordered = rows.every((row, i) =>
    i === 0 || Date.parse(rows[i - 1]?.observedAt) <= Date.parse(row?.observedAt)
  );

  if (!ordered) errors.push({ error: "dataset is not chronologically ordered" });

  return {
    valid: errors.length === 0,
    rows: rows.length,
    errors,
  };
}
