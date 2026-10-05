import { collectFromUrl } from "../../../../research/collector.js";

export const runtime = "nodejs";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (secret && authorization !== "Bearer " + secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await collectFromUrl(origin + "/api/market");

    return Response.json({
      ok: true,
      observedAt: result.observedAt,
      candidateCount: result.candidates.length,
      top: result.candidates.slice(0, 10).map((x) => ({
        mint: x.snapshot.mint,
        pair: x.snapshot.pair,
        score: x.scoring.score,
        tier: x.scoring.tier,
        riskCount: x.scoring.risk.riskCount,
      })),
      note: "Persistence is intentionally storage-adapter based until a durable database/blob store is connected.",
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: "Collector job failed", detail: String(error) },
      { status: 502 }
    );
  }
}
