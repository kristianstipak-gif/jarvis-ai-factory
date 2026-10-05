# JARVIS Validation Protocol

Before calling a signal predictive:

1. Collect a broad chronological launch cohort.
2. Snapshot features at fixed observation times.
3. Freeze features at each observation timestamp.
4. Label outcomes only after that timestamp.
5. Split by time: train → validation → test.
6. Compare against simple baselines.
7. Report precision@K, recall, calibration, drawdown and false positives.
8. Repeat across different market regimes.
9. Keep a paper/live evaluation log separate from historical backtests.
10. Do not optimize weights on the final test period.

A high score is a ranking signal, not a promise of profit.
