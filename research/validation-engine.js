import { compareBaselines } from "./baselines.js";

export function validateBacktest(rows = [], options = {}) {
  const results = compareBaselines(rows, options);

  const score = results.find((x) => x.baseline === "score")?.metrics;
  const volume = results.find((x) => x.baseline === "volume")?.metrics;

  const precisionDelta =
    Number.isFinite(score?.precisionAtK) && Number.isFinite(volume?.precisionAtK)
      ? score.precisionAtK - volume.precisionAtK
      : null;

  return {
    results,
    conclusion:
      precisionDelta == null
        ? "insufficient-data"
        : precisionDelta > 0
          ? "composite-beats-volume-baseline"
          : "composite-does-not-beat-volume-baseline",
    precisionDelta,
  };
}
