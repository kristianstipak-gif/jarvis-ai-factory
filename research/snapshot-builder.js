import { validateSnapshot, normalizeSnapshot } from "./snapshot-validator.js";

export function buildSnapshot(market = {}, onchain = {}) {
  const snapshot = normalizeSnapshot({
    mint: market.address,
    pair: market.pair ?? null,
    observedAt: new Date().toISOString(),
    priceUsd: market.priceUsd,
    liquidityUsd: market.liquidityUsd,
    volume24h: market.volume24h,
    txns24h: market.txns24h,
    buys24h: market.buys24h,
    sells24h: market.sells24h,
    holderCount: onchain.holderCount,
    top10Share: onchain.top10ShareOfTotalSupply,
    uniqueOwnersTop20: onchain.uniqueOwnersInTop20,
  });

  const validation = validateSnapshot(snapshot);
  if (!validation.valid) {
    return { snapshot: null, validation };
  }

  return { snapshot, validation };
}

export function dedupeSnapshots(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = [row?.mint, row?.pair, row?.observedAt].join("|");
    if (!row?.mint || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
