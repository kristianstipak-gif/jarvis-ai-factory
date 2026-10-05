import { collectFromUrl } from "../../../research/collector.js";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const origin = new URL(request.url).origin;
    const result = await collectFromUrl(origin + "/api/market", { persist: false });

    return Response.json({
      source: result.source,
      observedAt: result.observedAt,
      candidates: result.candidates,
      persistence: result.persistence,
    });
  } catch (error) {
    return Response.json(
      { error: "Collector failed", detail: String(error) },
      { status: 502 }
    );
  }
}
