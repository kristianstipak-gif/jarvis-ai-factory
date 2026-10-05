export function validateSnapshot(x = {}) {
  const errors = [];
  if (!x.mint) errors.push("missing mint");
  if (!x.observedAt || Number.isNaN(Date.parse(x.observedAt))) errors.push("invalid observedAt");

  const numeric = ["priceUsd","liquidityUsd","volume24h","txns24h","buys24h","sells24h","holderCount","top10Share","uniqueOwnersTop20"];
  for (const key of numeric) {
    if (x[key] == null) continue;
    if (!Number.isFinite(Number(x[key]))) errors.push(key + " is not numeric");
  }

  for (const key of ["priceUsd","liquidityUsd","volume24h","txns24h","buys24h","sells24h","holderCount","uniqueOwnersTop20"]) {
    if (x[key] != null && Number(x[key]) < 0) errors.push(key + " cannot be negative");
  }

  if (x.top10Share != null && (Number(x.top10Share) < 0 || Number(x.top10Share) > 1)) {
    errors.push("top10Share must be between 0 and 1");
  }

  if (x.observedAt && new Date(x.observedAt).getTime() > Date.now() + 60000) {
    errors.push("observation timestamp is in the future");
  }

  return { valid: errors.length === 0, errors };
}

export function normalizeSnapshot(x = {}) {
  return {
    mint: x.mint || null,
    pair: x.pair || null,
    observedAt: x.observedAt || new Date().toISOString(),
    priceUsd: x.priceUsd == null ? null : Number(x.priceUsd),
    liquidityUsd: x.liquidityUsd == null ? null : Number(x.liquidityUsd),
    volume24h: x.volume24h == null ? null : Number(x.volume24h),
    txns24h: x.txns24h == null ? null : Number(x.txns24h),
    buys24h: x.buys24h == null ? null : Number(x.buys24h),
    sells24h: x.sells24h == null ? null : Number(x.sells24h),
    holderCount: x.holderCount == null ? null : Number(x.holderCount),
    top10Share: x.top10Share == null ? null : Number(x.top10Share),
    uniqueOwnersTop20: x.uniqueOwnersTop20 == null ? null : Number(x.uniqueOwnersTop20)
  };
}
