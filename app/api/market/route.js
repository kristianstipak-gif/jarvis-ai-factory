export const runtime = "nodejs";

const API = "https://api.dexscreener.com/latest/dex/search";

export async function GET() {
  try {
    const queries = ["SOL", "USDC"];
    const responses = await Promise.all(
      queries.map((q) => fetch(API + "?q=" + encodeURIComponent(q), {
        headers: { accept: "application/json" },
        next: { revalidate: 15 },
      }))
    );
    const payloads = await Promise.all(responses.map((r) => r.json()));
    const seen = new Set();
    const pairs = payloads.flatMap((p) => p.pairs || []).filter((p) => {
      if (!p?.pairAddress || seen.has(p.pairAddress)) return false;
      seen.add(p.pairAddress);
      return p.chainId === "solana";
    });

    const tokens = pairs.map((p) => ({
      name: p.baseToken?.name || p.baseToken?.symbol || "Unknown",
      symbol: p.baseToken?.symbol || "?",
      address: p.baseToken?.address,
      pair: p.pairAddress,
      dex: p.dexId,
      priceUsd: Number(p.priceUsd || 0),
      liquidityUsd: Number(p.liquidity?.usd || 0),
      volume24h: Number(p.volume?.h24 || 0),
      txns24h: Number(p.txns?.h24?.buys || 0) + Number(p.txns?.h24?.sells || 0),
      buys24h: Number(p.txns?.h24?.buys || 0),
      sells24h: Number(p.txns?.h24?.sells || 0),
      priceChange24h: Number(p.priceChange?.h24 || 0),
      url: p.url,
    }))
    .filter((x) => x.address)
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, 40);

    return Response.json({
      source: "DexScreener public API",
      updatedAt: new Date().toISOString(),
      tokens,
    });
  } catch (error) {
    return Response.json(
      { error: "Market data unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}
