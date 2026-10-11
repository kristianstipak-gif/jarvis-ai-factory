# Snapshot Backtest API
GET /api/backtest
Optional query parameters: limit (100–20,000; default 10,000), horizonMinutes (5–1,440; default 60), feePct (assumed round-trip fee, default 2.5%), slippagePct (assumed per-side slippage, default 2%).
Compares all closed snapshot pairs, liquidity-filtered observations, buy-flow-filtered observations and activity-filtered observations. Requires at least 30 samples before marking a strategy eligible; fewer than 100 valid observations yields an insufficient-history verdict. These are research assumptions, not a quote or a live trading recommendation. Never enable live orders based on this report alone; use chronological out-of-sample validation and paper trading first.
