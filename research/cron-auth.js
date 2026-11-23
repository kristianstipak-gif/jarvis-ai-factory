import { createClient } from "@supabase/supabase-js";

export async function isAuthorizedCronRequest(request) {
  const authorization = request.headers.get("authorization") || "";
  const configuredSecret = process.env.CRON_SECRET;

  if (configuredSecret && authorization === "Bearer " + configuredSecret) {
    return true;
  }

  const candidate = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!candidate || !url || !serviceKey) return false;

  try {
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await db.rpc("jarvis_cron_token_matches", {
      candidate_token: candidate,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}
