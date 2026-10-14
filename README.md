# JARVIS AI Factory

JARVIS web dashboard and research-only trading monitor.

## Verified capabilities

- Next.js dashboard deployed on Vercel.
- Solana token research feed through DexScreener.
- Binance Spot public 24-hour ticker snapshots through `/api/binance/market`.
- Trading readiness diagnostics through `/api/trading/status`.
- Paper-only Solana candidate evaluator and walk-forward gate.
- Optional persistent market monitor worker with Binance public WebSocket trade stream and 5-second Solana snapshot polling.

## Important execution status

**Live order placement is disabled and is not implemented in this repository.** The dashboard and monitor must not be treated as a live trading bot. No profit is guaranteed. Keep live funds and exchange permissions disabled until a separately reviewed executor, idempotent order reconciliation, sellability checks, and out-of-sample paper results are in place.

## Local checks

```sh
npm install
npm run test:monitor
npm run test:trading
npm run build
```

GitHub Actions also runs the research and build test suites on pushes to `main`.

## Persistent monitor worker

`render.yaml` describes a Frankfurt Render background worker. It requires a persistent worker service (Starter plan in the blueprint) because Vercel serverless functions cannot keep a WebSocket open indefinitely.

Required configuration:
- `JARVIS_BASE_URL=https://jarvis-ai-factory.vercel.app`
- `CRON_SECRET`: set the **same random secret** in Render and Vercel. This protects `/api/cron/paper-trader`; never commit it or send it in chat.
- `BINANCE_STREAM_ENABLED=true`
- `POLL_INTERVAL_MS=5000`
- `MIN_ACTION_GAP_MS=30000`
- `CHANGE_THRESHOLD_PCT=0.15`

The worker is paper-only. Its health endpoint is `/healthz` and reports stream status and recent public prices. It exits if `CRON_SECRET` is missing. Deploying the worker can incur a recurring hosting charge; do not deploy without approving the plan.

## Trading readiness endpoint

Open `/api/trading/status` to see which server-side configuration flags are present. It never returns secret values. Missing flags currently include Binance credentials, Jupiter API key, and a Solana RPC URL. Setting those values alone does not enable order execution.

## Security

- Never commit API keys, exchange secrets, wallet private keys, or seed phrases.
- Use separate, least-privilege keys; never enable withdrawals on exchange API keys.
- Keep the wallet with the minimum funds required.
- Enforce a daily loss limit, order-size cap, max slippage, stale-feed blocking, and a kill switch before any live execution.
