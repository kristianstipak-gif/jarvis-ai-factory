# Live Collector Plan

The collector should run on a schedule and record snapshots rather than overwrite the latest value.

## Cadence

- discovery: every 30 seconds
- high-priority candidates: every 15 seconds
- historical retention: all observations
- risk/on-chain enrichment: slower cadence and on candidate promotion

## Pipeline

1. Fetch live market pairs.
2. Normalize and validate.
3. Deduplicate by mint/pair/timestamp bucket.
4. Persist observation.
5. Enrich promoted candidates with Solana RPC owner/concentration data.
6. Calculate JARVIS score and risk flags.
7. Store the score alongside the raw features.
8. Later attach outcome labels only from future observations.

## Storage requirements

Minimum fields:
- mint
- pair
- observed_at
- raw market features
- on-chain features
- risk flags
- score
- data-source metadata

Never overwrite historical observations.
Never treat missing API/RPC responses as zero.
