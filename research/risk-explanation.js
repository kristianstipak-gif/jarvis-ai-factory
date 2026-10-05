export function riskExplain({
  score = null,
  baseScore = null,
  risk = {},
  creator = {},
  mint = {},
} = {}) {
  const positives = [];
  const negatives = [];

  if (Number(baseScore) >= 65) positives.push("strong market activity");
  if (risk.buyRatio != null && risk.buyRatio >= 0.6) positives.push("buy-side flow is elevated");
  if (risk.volumeLiquidity != null && risk.volumeLiquidity >= 1) positives.push("volume is meaningful relative to liquidity");

  if (risk.flags?.extremeConcentration) negatives.push("high holder concentration");
  if (risk.flags?.extremeBuyImbalance) negatives.push("extreme buy imbalance");
  if (risk.flags?.extremeVelocity) negatives.push("extreme volume/liquidity velocity");
  if (risk.flags?.failedTxRate) negatives.push("elevated failed transaction rate");
  if (risk.flags?.synchronizedCluster) negatives.push("synchronized wallet activity signal");
  if (risk.flags?.creatorLinkedShare) negatives.push("creator-linked concentration signal");
  if (creator.mintAuthorityActive || mint.mintAuthority) negatives.push("mint authority is active");
  if (creator.freezeAuthorityActive || mint.freezeAuthority) negatives.push("freeze authority is active");

  return {
    score: Number.isFinite(Number(score)) ? Number(score) : null,
    positives,
    negatives,
    verdict:
      negatives.length === 0 ? "low-signal-risk"
      : negatives.length <= 2 ? "elevated-risk"
      : "high-risk",
    disclaimer: "Signals are probabilistic research indicators and do not establish malicious intent.",
  };
}
