import { evaluateMomentumSignal } from "../../../research/strategy-lab.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const response = await fetch(new URL("/api/market", request.url), { cache: "no-store" });
    if (!response.ok) return Response.json({ ok: false, error: "Market feed unavailable", status: response.status }, { status: 502 });
    const market = await response.json();
    if (!Array.isArray(market.tokens)) return Response.json({ ok: false, error: "Invalid market feed" }, { status: 502 });

    const candidates = market.tokens.map((token) => ({
      name: token.name,
      symbol: token.symbol,
      address: token.address,
      pair: token.pair,
      url: token.url,
      priceUsd: token.priceUsd,
      liquidityUsd: token.liquidityUsd,
      volume24h: token.volume24h,
      buys24h: token.buys24h,
      sells24h: token.sells24h,
      priceChange24h: token.priceChange24h,
      ...evaluateMomentumSignal(token, {
        minLiquidityUsd: 10000,
        minVolumeLiquidityRatio: 0.5,
        minBuyRatio: 0.55,
        minTxns: 20,
        maxPriceChangePct: 80,
        maxPriceChangePctMin: -10
      })
    })).sort((a, b) => {
      if (a.signal !== b.signal) return a.signal === "WATCH_FOR_PAPER_TRADE" ? -1 : 1;
      return (b.metrics.buyRatio ?? 0) - (a.metrics.buyRatio ?? 0);
    });

    return Response.json({
      ok: true,
      mode: "research-only",
      source: market.source,
      observedAt: market.updatedAt || new Date().toISOString(),
      timeframe: "24h aggregate snapshot; not a short-interval entry signal",
      counts: {
        scanned: candidates.length,
        watchForPaperTrade: candidates.filter((x) => x.signal === "WATCH_FOR_PAPER_TRADE").length,
        noTrade: candidates.filter((x) => x.signal === "NO_TRADE").length
      },
      candidates,
      safety: "Research filter only. No wallet signing or live orders. Validate with time-aligned data and paper trading."
    });
  } catch (error) {
    return Response.json({ ok: false, error: "Strategy scan failed", detail: String(error) }, { status: 502 });
  }
}
