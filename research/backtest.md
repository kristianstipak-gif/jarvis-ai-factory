# Backtest specification

The first real experiment should be a large historical cohort, not a hand-picked list.

At each observation time T, label outcomes after T: survives_24h, graduates, peak_multiple_24h, max_drawdown_24h, peak_time_minutes.

Feature windows: 1m/5m/15m/30m/60m trade velocity, volume/market cap, buy/sell imbalance, unique buyer growth, holder growth, top-10/top-20 concentration, creator-linked wallet share, bonding-curve progress, price impact, social activity, copycat similarity, suspicious-wallet clusters.

Experiments: baseline heuristics, logistic regression, gradient-boosted model, ablation study, time-forward validation, and adversarial validation using known manipulation patterns.

Output probability and confidence interval, not a promise of profit.