import { createStorageAdapter } from "../../../research/storage.js";
import { runWalkForwardLab } from "../../../research/walk-forward-lab.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const store = createStorageAdapter();
    const limit = Math.min(20000, Math.max(100, Number(url.searchParams.get("limit") || 10000)));
    const rows = await store.read({ limit });
    const report = runWalkForwardLab(rows);
    return Response.json({
      ok: true,
      durableStorage: store.durable,
      storedSnapshotCount: await store.count(),
      report,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ ok: false, error: "Walk-forward research failed",
      detail: String(error?.message || error) }, { status: 500 });
  }
}
