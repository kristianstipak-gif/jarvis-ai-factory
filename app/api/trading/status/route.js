import { assessTradingReadiness } from "../../../../research/trading-safety.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ ok: true, generatedAt: new Date().toISOString(), ...assessTradingReadiness(process.env) },
    { headers: { "cache-control": "no-store" } });
}
