export function classifyAccount(address, context = {}) {
  if (!address) return "unknown";
  if (context.lpAccounts?.has?.(address)) return "liquidity-pool";
  if (context.programAccounts?.has?.(address)) return "program";
  if (context.treasuryAccounts?.has?.(address)) return "treasury";
  if (context.creatorAddresses?.has?.(address)) return "creator";
  return "wallet";
}

export function summarizeOwners(accounts = [], context = {}) {
  const counts = {};
  for (const account of accounts) {
    const type = classifyAccount(account?.owner, context);
    counts[type] = (counts[type] || 0) + 1;
  }

  return {
    counts,
    total: accounts.length,
    walletLike: counts.wallet || 0,
    excludedFromWalletClustering:
      (counts["liquidity-pool"] || 0) +
      (counts.program || 0) +
      (counts.treasury || 0),
  };
}
