import { attachForwardOutcomes } from "./forward-outcomes.js";

export function prepareEvaluationRows(rows = [], horizonMinutes = 1440, threshold = 2) {
  return attachForwardOutcomes(rows).map((row) => {
    const outcome = row.outcomes?.[horizonMinutes];

    if (!outcome) {
      return {
        ...row,
        evaluation: {
          status: "insufficient-horizon",
          label: null,
          probability: null,
        },
      };
    }

    const peakMultiple = Number(outcome.peakMultiple);

    return {
      ...row,
      evaluation: {
        status: "complete",
        label: peakMultiple >= threshold,
        probability: Number(row?.score) / 100,
        peakMultiple,
      },
    };
  });
}

export function filterCompleteEvaluation(rows = []) {
  return rows.filter((x) => x?.evaluation?.status === "complete");
}
