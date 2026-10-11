import { createStorageAdapter } from "../../../research/storage.js";
import { runSnapshotBacktest } from "../../../research/backtest.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const store = createStorageAdapter();
    const limit = Math.min(20000, Math.max(100, Number(url.searchParams.get("limit") || 10000)));
    const horizonMinutes = Math.min(1440, Math.max(5, Number(url.searchParams.get("horizonMinutes") || 60)));
    const feePct = Math.min(20, Math.max(0, Number(url.searchParams.get("feePct") || 2.5)));
    const slippagePct = Math.min(20, Math.max(0, Number(url.searchParams.get("slippagePct") || 2)));
    const rows = await store.read({ limit });
    return Response.json({ ok:true, durableStorage:store.durable, storedSnapshotCount:await store.count(),
      report:runSnapshotBacktest(rows,{ horizonMinutes, feePct, slippagePct }), generatedAt:new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok:false, error:"Backtest failed", detail:String(e) }, { status:500 });
  }
}
