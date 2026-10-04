# JARVIS MEME LAB — research pipeline

Objective: estimate which newly launched Solana meme tokens show evidence of sustainable organic traction while explicitly filtering manipulation risk.

Data targets: token creation time and mint, bonding-curve state and graduation, buy/sell events, price path, unique holders, holder growth, top-wallet concentration, creator-wallet relationships, liquidity, social signals, copycat similarity, and suspicious burst/sybil/wash-trading indicators.

Pump.fun's current architecture exposes permissionless on-chain programs and first-party SDKs; prefer on-chain program events over undocumented frontend endpoints.

Success metrics: survival at 1h/6h/24h/7d, graduation, liquidity bands, max drawdown, time-to-peak, creator fee generation, concentration risk, and severe-collapse probability.

Backtest rules: time-split train/validation/test; no look-ahead; include dead tokens; include fees/slippage; report calibration, precision/recall and false-positive rate; stress-test regime changes; separate paper results from live results.

Safety: never generate fake volume, wash trades, sybil wallets, coordinated buying, misleading claims, or artificial social engagement.