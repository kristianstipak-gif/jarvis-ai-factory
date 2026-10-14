export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BASE = "https://api.binance.com/api/v3/ticker/24hr";
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "DOGEUSDT", "PEPEUSDT", "SHIBUSDT"];
export async function GET() {
  try {
    const rows = await Promise.all(SYMBOLS.map(async symbol => {
      const response = await fetch(BASE + "?symbol=" + symbol, {
        cache: "no-store", signal: AbortSignal.timeout(7000), headers: { accept: "application/json" }
      });
      if (!response.ok) throw new Error("Binance ticker request failed for " + symbol + " (HTTP " + response.status + ")");
      const item = await response.json();
      return { symbol: item.symbol, price: Number(item.lastPrice), priceChangePct24h: Number(item.priceChangePercent),
        quoteVolume24h: Number(item.quoteVolume), trades24h: Number(item.count), dataType: "24h ticker snapshot" };
    }));
    return Response.json({ ok: true, mode: "public-market-data-only", source: "Binance Spot public REST API",
      observedAt: new Date().toISOString(), stream: false, liveTrading: false, symbols: rows,
      limitation: "24-hour ticker snapshots only; not a WebSocket tick stream or instant-execution feed." },
      { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, mode: "public-market-data-only", error: "Binance public market data unavailable",
      detail: String(error?.message || error), liveTrading: false },
      { status: 502, headers: { "cache-control": "no-store" } });
  }
}
