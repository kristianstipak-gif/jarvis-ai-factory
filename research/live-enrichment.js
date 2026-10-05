import { enrichRankedCandidates } from "./enrichment-pipeline.js";
import { buildCandidateIntelligence } from "./candidate-intelligence.js";

export async function runDeepEnrichment(candidates = [], origin, options = {}) {
  const enriched = await enrichRankedCandidates(candidates, {
    minScore: options.minScore ?? 55,
    maxCandidates: options.maxCandidates ?? 10,
    fetchToken: (mint) => getJson(origin + "/api/token/" + encodeURIComponent(mint)),
    fetchWallet: (address) => getJson(origin + "/api/wallet/" + encodeURIComponent(address)),
  });

  return enriched
    .map((candidate) => {
      const market = {
        ...(candidate.market || candidate.snapshot || {}),
        baseScore: candidate.scoring?.baseScore ?? candidate.scoring?.score ?? 0,
      };
      return buildCandidateIntelligence({
        ...candidate,
        market,
      });
    })
    .sort((a, b) => Number(b?.intelligence?.score || 0) - Number(a?.intelligence?.score || 0));
}

async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}
