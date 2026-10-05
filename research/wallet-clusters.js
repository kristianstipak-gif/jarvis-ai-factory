export function buildWalletClusterSignals(accounts = [], fundingMap = new Map()) {
  const owners = accounts
    .map((x) => x?.owner)
    .filter(Boolean);

  const uniqueOwners = [...new Set(owners)];
  const fundingGroups = new Map();

  for (const owner of uniqueOwners) {
    const funder = fundingMap.get(owner);
    if (!funder) continue;
    if (!fundingGroups.has(funder)) fundingGroups.set(funder, []);
    fundingGroups.get(funder).push(owner);
  }

  const largestGroup = Math.max(
    0,
    ...[...fundingGroups.values()].map((group) => group.length)
  );

  return {
    uniqueOwners: uniqueOwners.length,
    fundingGroups: [...fundingGroups.entries()].map(([funder, wallets]) => ({
      funder,
      wallets,
      count: wallets.length,
    })),
    largestFundingCluster: largestGroup,
    fundingClusterShare: uniqueOwners.length ? largestGroup / uniqueOwners.length : 0,
  };
}

export function synchronizedEntrySignal(events = [], windowSeconds = 30) {
  const times = events
    .map((x) => Date.parse(x?.observedAt))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (times.length < 3) return { count: times.length, burstShare: 0, signal: false };

  let largestBurst = 1;
  let start = 0;

  for (let end = 1; end < times.length; end += 1) {
    while (times[end] - times[start] > windowSeconds * 1000) start += 1;
    largestBurst = Math.max(largestBurst, end - start + 1);
  }

  const burstShare = largestBurst / times.length;
  return {
    count: times.length,
    largestBurst,
    burstShare,
    signal: burstShare >= 0.4 && largestBurst >= 3,
  };
}
