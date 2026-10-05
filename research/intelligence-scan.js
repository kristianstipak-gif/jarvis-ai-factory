import { buildCandidateIntelligence, rankIntelligence } from "./candidate-intelligence.js";

export async function runIntelligenceScan(marketCandidates = [], enrich) {
  if (typeof enrich !== "function") throw new Error("enrich function is required");

  const enriched = await enrich(marketCandidates);
  return rankIntelligence(enriched);
}
