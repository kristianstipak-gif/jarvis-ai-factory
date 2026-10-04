export const RISK_RULES = {
  extremeConcentration: { threshold: 0.55, penalty: 18 },
  extremeBuyImbalance: { threshold: 0.92, penalty: 12 },
  extremeVelocity: { threshold: 8, penalty: 15 },
  failedTxRate: { threshold: 0.25, penalty: 8 },
  synchronizedCluster: { threshold: 0.40, penalty: 20 },
  creatorLinkedShare: { threshold: 0.35, penalty: 25 },
};

export function riskPenalty(flags = {}) {
  return Object.entries(flags).reduce(
    (sum, [key, value]) => sum + (value ? (RISK_RULES[key]?.penalty || 0) : 0),
    0
  );
}
