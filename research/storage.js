import { createClient } from "@supabase/supabase-js";

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function createMemoryStore() {
  const rows = [];
  return {
    async append(observations = []) {
      const safe = normalizeStorageRows(observations);
      rows.push(...safe);
      return { added: safe.length, total: rows.length };
    },
    async read({ mint = null, since = null, limit = 5000 } = {}) {
      let result = mint ? rows.filter((x) => x?.mint === mint) : [...rows];
      if (since) {
        const t = Date.parse(since);
        if (Number.isFinite(t)) result = result.filter((x) => Date.parse(x.observedAt) >= t);
      }
      return result.sort((a,b) => Date.parse(a.observedAt)-Date.parse(b.observedAt)).slice(-limit);
    },
    async count() { return rows.length; },
    async clear() { rows.length = 0; },
  };
}

export function createSupabaseStore(client = env()) {
  if (!client) throw new Error("Supabase storage is not configured");

  return {
    async append(observations = []) {
      const rows = normalizeStorageRows(observations);
      if (!rows.length) return { added: 0 };

      const { error } = await client
        .from("market_snapshots")
        .upsert(rows.map(toDbRow), { onConflict: "mint,pair,observed_at" });

      if (error) throw new Error("Supabase append failed: " + error.message);
      return { added: rows.length };
    },
    async read({ mint = null, since = null, limit = 5000 } = {}) {
      let query = client.from("market_snapshots").select("*").order("observed_at", { ascending: true }).limit(limit);
      if (mint) query = query.eq("mint", mint);
      if (since) query = query.gte("observed_at", since);
      const { data, error } = await query;
      if (error) throw new Error("Supabase read failed: " + error.message);
      return (data || []).map(fromDbRow);
    },
    async count() {
      const { count, error } = await client.from("market_snapshots").select("*", { count: "exact", head: true });
      if (error) throw new Error("Supabase count failed: " + error.message);
      return count || 0;
    },
    async clear() {
      throw new Error("Refusing destructive clear on durable storage");
    },
  };
}

export function createStorageAdapter({ durableStore = null } = {}) {
  const configured = durableStore || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseStore() : null);
  const fallback = createMemoryStore();
  return {
    append: (rows) => (configured ? configured.append(rows) : fallback.append(rows)),
    read: (options) => (configured ? configured.read(options) : fallback.read(options)),
    count: () => (configured ? configured.count() : fallback.count()),
    clear: () => (configured ? configured.clear() : fallback.clear()),
    durable: Boolean(configured),
  };
}

function toDbRow(x) {
  return {
    mint: x.mint,
    pair: x.pair || null,
    observed_at: x.observedAt,
    price_usd: Number.isFinite(Number(x.priceUsd)) ? Number(x.priceUsd) : null,
    liquidity_usd: Number.isFinite(Number(x.liquidityUsd)) ? Number(x.liquidityUsd) : null,
    volume_24h: Number.isFinite(Number(x.volume24h)) ? Number(x.volume24h) : null,
    txns_24h: Number.isFinite(Number(x.txns24h)) ? Number(x.txns24h) : null,
    buys_24h: Number.isFinite(Number(x.buys24h)) ? Number(x.buys24h) : null,
    sells_24h: Number.isFinite(Number(x.sells24h)) ? Number(x.sells24h) : null,
    holder_count: Number.isFinite(Number(x.holderCount)) ? Number(x.holderCount) : null,
    top10_share: Number.isFinite(Number(x.top10Share)) ? Number(x.top10Share) : null,
    unique_owners_top20: Number.isFinite(Number(x.uniqueOwnersTop20)) ? Number(x.uniqueOwnersTop20) : null,
  };
}

function fromDbRow(x) {
  return {
    mint: x.mint,
    pair: x.pair,
    observedAt: x.observed_at,
    priceUsd: x.price_usd,
    liquidityUsd: x.liquidity_usd,
    volume24h: x.volume_24h,
    txns24h: x.txns_24h,
    buys24h: x.buys_24h,
    sells24h: x.sells_24h,
    holderCount: x.holder_count,
    top10Share: x.top10_share,
    uniqueOwnersTop20: x.unique_owners_top20,
  };
}

export function normalizeStorageRows(rows = []) {
  return rows.filter((x) => x?.mint && x?.observedAt);
}
