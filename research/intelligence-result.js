import { riskPenalty } from "./risk-rules.js";
import { creatorRiskPenalty } from "./creator-intelligence.js";
import { intelligenceScore, buildRiskSignals } from "./intelligence-engine.js";
import { riskExplain } from "./risk-explanation.js";

export function buildIntelligenceResult({ market = {}, onchain = {}, wallet = {}, creator = {}, mint = {} } = {}) {
  const baseScore = Number(market.baseScore ?? market.score ?? 0);
  const risk = buildRiskSignals({ market, onchain, wallet });

  const rulePenalty = riskPenalty(risk.flags);
  const creatorSignals = {
    ...creator,
    mintAuthority: creator.mintAuthority ?? mint.mintAuthority ?? null,
    freezeAuthority: creator.freezeAuthority ?? mint.freezeAuthority ?? null,
  };
  const creatorPenalty = creatorRiskPenalty(creatorSignals);

  const score = Math.max(
    0,
    Math.min(100, Math.round(baseScore - rulePenalty - creatorPenalty))
  );

  const tier = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D";

  return {
    score,
    baseScore,
    tier,
    risk: {
      ...risk,
      rulePenalty,
      creatorPenalty,
      totalPenalty: rulePenalty + creatorPenalty,
    },
    explanation: riskExplain({
      score,
      baseScore,
      risk,
      creator,
      mint,
    }),
    researchOnly: true,
  };
}
