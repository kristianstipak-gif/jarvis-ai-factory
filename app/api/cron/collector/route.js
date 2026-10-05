import { collectFromUrl } from "../../../../research/collector.js";

export const runtime = "nodejs";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  // Vercel Cron sends its own authorization header when CRON_SECRET is configured.
  // Never leave this endpoint unauthenticated in production.
  if (!secret || authorization !== "Bearer " + secret) {
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
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: "Collector job failed", detail: String(error) },
      { status: 502 }
    );
  }
}
