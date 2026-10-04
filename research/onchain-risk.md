# JARVIS On-chain Risk Layer

The next scoring layer uses Solana mainnet RPC data in addition to market data.

## Current signals

- Largest token accounts: concentration snapshot from the top 20 accounts.
- Top-10 share within that sample.
- Recent token-address transaction signatures.
- Failed versus successful recent transactions.
- Timestamp freshness.

## Important limitation

Token-account concentration is only a screening signal. A token account is not automatically one economic owner, and the top-20 sample is not a complete holder graph.

## Next upgrades

1. Resolve token accounts to owner wallets.
2. Group wallets by common funding sources and transaction timing.
3. Detect bursty clusters and repeated launch-wallet patterns.
4. Track creator wallet history across launches.
5. Add holder growth windows: 1m / 5m / 15m / 1h.
6. Separate organic concentration from program/LP/treasury accounts.
7. Backtest every risk rule against historical winners and failures.

## Safety

The system is for research and risk detection. It must not manufacture volume, create fake holders, coordinate trades, or disguise promotional activity as organic demand.
