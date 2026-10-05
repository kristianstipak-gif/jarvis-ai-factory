import { createStorageAdapter } from "../../../../research/storage.js";

export const runtime = "nodejs";

export async function GET() {
  const storage = createStorageAdapter();
  return Response.json({
    durable: storage.durable,
    provider: storage.durable ? "supabase" : "memory",
    message: storage.durable
      ? "Historical snapshot persistence is enabled."
      : "Historical snapshot persistence is not configured; snapshots will not survive serverless restarts.",
  });
}
