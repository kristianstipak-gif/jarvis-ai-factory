# JARVIS Data Contract

Every live observation must contain:

- token mint
- pair address
- observed_at
- price
- liquidity_usd
- volume_1m / 5m / 15m / 30m / 60m when available
- buys and sells per window
- unique buyers/sellers per window
- holder count and holder growth
- top-account concentration
- creator address when discoverable
- creator-linked wallet share
- wallet-cluster indicators
- risk flags
- model score

## Anti-leakage rule

A row observed at time T may only contain information available at or before T. Outcome labels must be stored separately.

## Quality rules

Reject or quarantine:
- duplicate observations
- impossible negative values
- timestamps in the future
- missing mint identifiers
- stale market snapshots
- failed RPC responses treated as zero values

Unknown is not zero. Missing data must remain explicitly missing.
