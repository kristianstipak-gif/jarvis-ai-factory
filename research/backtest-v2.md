# JARVIS Backtest v2

Build a chronological cohort containing failures and inactive launches.
Snapshots: 1m, 5m, 15m, 30m, 60m.
Labels: survives_1h, survives_6h, survives_24h, graduates, peak_multiple_24h, max_drawdown_24h, time_to_peak, severe_collapse.
Validation must be time-forward with no future leakage.
Metrics: precision@K, recall, false-positive rate, calibration, drawdown and hit rate by score band.
Baselines: random, volume-only, momentum-only, liquidity-only and the composite model.
