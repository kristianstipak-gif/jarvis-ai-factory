export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BASES = [
  "https://data-api.binance.vision/api/v3/ticker/24hr",
  "https://api.binance.com/api/v3/ticker/24hr"
];
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "DOGEUSDT", "PEPEUSDT", "SHIBUSDT"];

async function fetchTicker(symbol) {
  const errors = [];
  for (const base of BASES) {
    try {
      const response = await fetch(base + "?symbol=" + symbol, {
        cache: "no-store", signal: AbortSignal.timeout(5000), headers: { accept: "application/json" }
      });
      if (!response.ok) {
        errors.push(base.includes("data-api") ? "data-api HTTP " + response.status : "api HTTP " + response.status);
        continue;
      }
      const item = await response.json();
      return { symbol: item.symbol, price: Number(item.lastPrice), priceChangePct24h: Number(item.priceChangePercent),
        quoteVolume24h: Number(item.quoteVolume), trades24h: Number(item.count), dataType: "24h ticker snapshot" };
    } catch (error) { errors.push(String(error?.message || error)); }
  }
  return { symbol, ok: false, error: errors.join("; ") };
}

export async function GET() {
  const results = await Promise.all(SYMBOLS.map(fetchTicker));
  const symbols = results.filter(item => item.ok !== false);
  const failed = results.filter(item => item.ok === false);
  return Response.json({
    ok: symbols.length > 0, mode: "public-market-data-only",
    source: "Binance Spot public REST API (data-api fallback)",
    observedAt: new Date().toISOString(), stream: false, liveTrading: false,
    symbols, failedSymbols: failed,
    limitation: "24-hour ticker snapshots only; not a WebSocket tick stream or instant-execution feed."
  }, { status: symbols.length > 0 ? 200 : 502, headers: { "cache-control": "no-store" } });
}
