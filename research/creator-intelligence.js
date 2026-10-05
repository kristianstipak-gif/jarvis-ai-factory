export function buildCreatorSignals({
  creator = null,
  mintAuthority = null,
  freezeAuthority = null,
  creatorHistory = {},
} = {}) {
  const creatorMatchesMintAuthority = Boolean(
    creator && mintAuthority && creator === mintAuthority
  );

  const creatorBalanceSol = Number(creatorHistory.balanceSol);
  const recentTransactions = Number(creatorHistory.recentTransactions);
  const failedRate = Number(creatorHistory.failedRate);

  return {
    creator,
    mintAuthority,
    freezeAuthority,
    creatorMatchesMintAuthority,
    mintAuthorityActive: Boolean(mintAuthority),
    freezeAuthorityActive: Boolean(freezeAuthority),
    creatorBalanceSol: Number.isFinite(creatorBalanceSol) ? creatorBalanceSol : null,
    recentTransactions: Number.isFinite(recentTransactions) ? recentTransactions : null,
    failedRate: Number.isFinite(failedRate) ? failedRate : null,
    signals: {
      activeMintAuthority: Boolean(mintAuthority),
      activeFreezeAuthority: Boolean(freezeAuthority),
      creatorWalletAvailable: Boolean(creator),
      highFailedRate: Number.isFinite(failedRate) && failedRate > 0.25,
    },
  };
}

export function creatorRiskPenalty(signals = {}) {
  let penalty = 0;
  if (signals.mintAuthorityActive) penalty += 10;
  if (signals.freezeAuthorityActive) penalty += 10;
  if (signals.signals?.highFailedRate) penalty += 5;
  return penalty;
}
