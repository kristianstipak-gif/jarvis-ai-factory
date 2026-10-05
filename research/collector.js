import { processMarketCandidate, rankCandidates } from "./pipeline.js";

export async function collectMarketSnapshot(fetcher) {
  const response = await fetcher();
  if (!response?.tokens || !Array.isArray(response.tokens)) {
    throw new Error("Invalid market feed");
  }

  const processed = response.tokens.map((market) =>
    processMarketCandidate(market, {})
  );

  return {
    source: response.source || "unknown",
    observedAt: new Date().toISOString(),
    candidates: rankCandidates(processed),
  };
}

export async function collectFromUrl(url) {
  return collectMarketSnapshot(async () => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Market feed HTTP " + response.status);
    return response.json();
  });
}
