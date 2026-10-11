# JARVIS persistent market monitor

This worker is a **paper-only reactive monitor**, not a live execution bot.

## Behavior
- Polls the existing DexScreener-backed `/api/market` endpoint every 5 seconds by default.
- Detects new pairs or price moves of at least 0.15% between observed snapshots.
- Triggers `/api/cron/paper-trader` no more often than every 30 seconds, preserving a pending signal until the cycle succeeds.
- The paper-trader endpoint persists the market snapshot and enforces the existing fail-closed research gate.
- It never signs transactions or submits real orders.

## Environment
- `CRON_SECRET`: same value as the protected Vercel `CRON_SECRET`.
- `JARVIS_BASE_URL`: optional; defaults to `https://jarvis-ai-factory.vercel.app`.
- `POLL_INTERVAL_MS`: defaults to 5000; do not lower to 1000 with the current public DexScreener feed because polling is not a websocket stream and can hit API limits.
- `MIN_ACTION_GAP_MS`: defaults to 30000.
- `CHANGE_THRESHOLD_PCT`: defaults to 0.15.

Run locally with `npm run monitor`; test with `npm run test:monitor`. Health endpoint is `/healthz`.

## Important limitation
This is still polling snapshots, not tick-level streaming. It cannot guarantee 1-second market detection or fills. For true sub-second reaction, replace the promoted-token feed with an authorized Solana websocket/transaction stream, decode relevant DEX trades, and validate the strategy in paper mode first. Do not enable live trading until out-of-sample performance and risk controls are independently verified.
