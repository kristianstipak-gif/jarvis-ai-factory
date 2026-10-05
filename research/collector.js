import { processMarketCandidate, rankCandidates } from "./pipeline.js";
import { createStorageAdapter } from "./storage.js";

const storage = createStorageAdapter();

export async function collectMarketSnapshot(fetcher, { persist = true } = {}) {
  const response = await fetcher();
  if (!response?.tokens || !Array.isArray(response.tokens)) {
    throw new Error("Invalid market feed");
  }

  const processed = response.tokens.map((market) =>
    processMarketCandidate(market, {})
  );

  const candidates = rankCandidates(processed);

  let persistence = { attempted: false, durable: storage.durable, added: 0 };
  if (persist) {
    const snapshots = candidates.map((x) => x.snapshot).filter(Boolean);
    if (snapshots.length) {
      const result = await storage.append(snapshots);
      persistence = {
        attempted: true,
        durable: storage.durable,
        added: result.added || 0,
        total: result.total,
      };
    }
  }

  return {
    source: response.source || "unknown",
    observedAt: new Date().toISOString(),
    candidates,
    persistence,
  };
}

export async function collectFromUrl(url, options = {}) {
  return collectMarketSnapshot(async () => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Market feed HTTP " + response.status);
    return response.json();
  }, options);
}
