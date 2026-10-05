import { collectFromUrl } from "../../../research/collector.js";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const origin = new URL(request.url).origin;
    const result = await collectFromUrl(origin + "/api/market");
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: "Collector failed", detail: String(error) },
      { status: 502 }
    );
  }
}
