# JARVIS live snapshot collector setup

The repository includes a GitHub Actions collector scheduled every five minutes. This improves on the Vercel Hobby cron's daily schedule, but it is not a tick feed and GitHub scheduled jobs may start late.

## Required secrets and environment variables

1. In Vercel project settings, configure:
   - `CRON_SECRET`: a long random secret.
   - `SUPABASE_URL`: the project's Supabase URL.
   - `SUPABASE_SERVICE_ROLE_KEY` (or the supported server-side `SUPABASE_SECRET_KEY`): keep it server-side only. Never use a `NEXT_PUBLIC_` prefix for this key.
2. In Supabase SQL Editor, run `supabase/schema.sql` to create the `market_snapshots` table and indexes.
3. In GitHub, open the repository Settings → Secrets and variables → Actions → New repository secret:
   - Name: `JARVIS_CRON_SECRET`
   - Value: exactly the same value as Vercel `CRON_SECRET`.
4. Redeploy the Vercel project after adding or changing environment variables.
5. Open Actions → JARVIS market data collector → Run workflow to test a collection manually.

## Verify persistence

Call `/api/backtest` and inspect:
- `durableStorage` must be `true`.
- `storedSnapshotCount` should increase across successful collections.
- The backtest report must have enough independent, time-separated observations before any strategy result is interpreted.

If `durableStorage` is false, snapshots are held only in a process-local memory store and will not reliably persist between serverless invocations. Do not treat those rows as a historical dataset.

## Important research limits

- The current market endpoint discovers recent/promoted DexScreener token profiles and boosts; it is not an exhaustive list of every new Solana token.
- The current source exposes 24-hour aggregates and snapshots, not millisecond-level order-book or trade-tick data. Do not treat these values as five-minute metrics.
- A five-minute collection interval is useful for building an initial dataset, but it is not suitable for claiming millisecond execution.
- Keep trading disabled while collecting and evaluating data. Use time-forward validation, out-of-sample tests, conservative fees/slippage, liquidity/rug risk filters, and paper trading before considering any live orders.
