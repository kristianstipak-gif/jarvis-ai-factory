import { collectFromUrl } from "../../../../research/collector.js";
import { isAuthorizedCronRequest } from "../../../../research/cron-auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!(await isAuthorizedCronRequest(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await collectFromUrl(origin + "/api/market");

    return Response.json({
      ok: true,
      observedAt: result.observedAt,
      candidateCount: result.candidates.length,
      persistence: result.persistence,
      top: result.candidates.slice(0, 10).map((x) => ({
        mint: x.snapshot.mint,
        pair: x.snapshot.pair,
        score: x.scoring.score,
        tier: x.scoring.tier,
        riskCount: x.scoring.risk.riskCount,
      })),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json(
      { ok: false, error: "Collector job failed", detail: String(error) },
      { status: 502 }
    );
  }
}
