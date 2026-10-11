import { evaluateAutoTradeCandidate } from "../../../research/auto-trader.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const marketResponse = await fetch(new URL("/api/market", request.url), { cache: "no-store" });
    if (!marketResponse.ok) {
      return Response.json({ ok: false, mode: "paper-only", error: "Market feed unavailable" }, { status: 502 });
    }
    const market = await marketResponse.json();
    if (!Array.isArray(market.tokens)) {
      return Response.json({ ok: false, mode: "paper-only", error: "Invalid market feed" }, { status: 502 });
    }

    // Deliberately no portfolio state means the endpoint fails closed:
    // it can rank paper candidates but cannot authorize a real order.
    const candidates = market.tokens.map((token) => ({
      name: token.name,
      symbol: token.symbol,
      address: token.address,
      pair: token.pair,
      url: token.url,
      ...evaluateAutoTradeCandidate(token, {
        equityUsd: Number(process.env.PAPER_EQUITY_USD || 1000),
        openPositions: 0,
        tradesLastHour: 0,
        dailyLossPct: 0,
      }),
    })).sort((a, b) => {
      if (a.decision !== b.decision) return a.decision === "PAPER_BUY_CANDIDATE" ? -1 : 1;
      return (b.metrics.buyRatio ?? 0) - (a.metrics.buyRatio ?? 0);
    });

    return Response.json({
      ok: true,
      mode: "paper-only",
      source: market.source,
      observedAt: market.updatedAt,
      counts: {
        scanned: candidates.length,
        paperBuyCandidates: candidates.filter((x) => x.decision === "PAPER_BUY_CANDIDATE").length,
        noTrade: candidates.filter((x) => x.decision === "NO_TRADE").length,
      },
      candidates,
      execution: {
        enabled: false,
        walletConnected: false,
        realOrdersSubmitted: 0,
        reason: "Live signing and order submission are not implemented. No wallet secret is accepted by this endpoint.",
      },
      limitations: [
        "Input is a promoted-token feed with 24-hour aggregates, not a real-time trade-tick feed.",
        "Portfolio limits are provisional defaults; this endpoint does not maintain open positions or a trade ledger.",
        "A candidate is not a buy recommendation and does not establish positive expectancy.",
      ],
    });
  } catch (error) {
    return Response.json({ ok: false, mode: "paper-only", error: "Auto trader scan failed", detail: String(error) }, { status: 502 });
  }
}
