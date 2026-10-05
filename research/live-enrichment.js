import { enrichRankedCandidates } from "./enrichment-pipeline.js";
import { rescoreAll } from "./rescore.js";

async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}

export async function runDeepEnrichment(candidates = [], origin, options = {}) {
  const enriched = await enrichRankedCandidates(candidates, {
    minScore: options.minScore ?? 55,
    maxCandidates: options.maxCandidates ?? 10,
    fetchToken: (mint) => getJson(origin + "/api/token/" + encodeURIComponent(mint)),
    fetchWallet: (address) => getJson(origin + "/api/wallet/" + encodeURIComponent(address)),
  });

  return rescoreAll(enriched);
}
