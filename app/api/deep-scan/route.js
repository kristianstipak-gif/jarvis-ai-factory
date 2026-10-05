import { collectFromUrl } from "../../../../research/collector.js";
import { runDeepEnrichment } from "../../../../research/live-enrichment.js";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const origin = new URL(request.url).origin;
    const market = await collectFromUrl(origin + "/api/market");
    const enriched = await runDeepEnrichment(market.candidates, origin, {
      minScore: 55,
      maxCandidates: 10,
    });

    return Response.json({
      ok: true,
      source: market.source,
      observedAt: market.observedAt,
      scanned: market.candidates.length,
      enriched: enriched.length,
      candidates: enriched.slice(0, 20),
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: "Deep scan failed", detail: String(error) },
      { status: 502 }
    );
  }
}
