export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROFILE_API = "https://api.dexscreener.com/token-profiles/latest/v1";
const BOOST_API = "https://api.dexscreener.com/token-boosts/latest/v1";
const TOKENS_API = "https://api.dexscreener.com/tokens/v1/solana/";
const EXCLUDED_SYMBOLS = new Set(["SOL","USDC","USDT","USD1","DAI","USDS","USDE","WETH","WBTC"]);

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error("DexScreener request failed: " + response.status);
  return response.json();
}

function toToken(pair) {
  return {
    name: pair.baseToken?.name || pair.baseToken?.symbol || "Unknown",
    symbol: pair.baseToken?.symbol || "?",
    address: pair.baseToken?.address,
    pair: pair.pairAddress,
    dex: pair.dexId,
    priceUsd: Number(pair.priceUsd || 0),
    liquidityUsd: Number(pair.liquidity?.usd || 0),
    volume24h: Number(pair.volume?.h24 || 0),
    txns24h: Number(pair.txns?.h24?.buys || 0) + Number(pair.txns?.h24?.sells || 0),
    buys24h: Number(pair.txns?.h24?.buys || 0),
    sells24h: Number(pair.txns?.h24?.sells || 0),
    priceChange24h: Number(pair.priceChange?.h24 || 0),
    pairCreatedAt: pair.pairCreatedAt || null,
    url: pair.url
  };
}

export async function GET() {
  try {
    const [profiles, boosts] = await Promise.all([fetchJson(PROFILE_API), fetchJson(BOOST_API)]);
    const addresses = [...new Set([
      ...(profiles || []).filter(x => x.chainId === "solana").map(x => x.tokenAddress),
      ...(boosts || []).filter(x => x.chainId === "solana").map(x => x.tokenAddress)
    ].filter(Boolean))].slice(0, 30);

    const pairs = addresses.length
      ? await fetchJson(TOKENS_API + addresses.map(encodeURIComponent).join(","))
      : [];
    const seen = new Set();
    const tokens = (Array.isArray(pairs) ? pairs : []).filter(pair => {
      const symbol = String(pair.baseToken?.symbol || "").toUpperCase();
      if (pair.chainId !== "solana" || !pair.baseToken?.address || !pair.pairAddress ||
          EXCLUDED_SYMBOLS.has(symbol) || seen.has(pair.pairAddress)) return false;
      seen.add(pair.pairAddress);
      return true;
    }).map(toToken).filter(token => token.priceUsd > 0)
      .sort((a,b) => (b.volume24h + b.txns24h * 25) - (a.volume24h + a.txns24h * 25))
      .slice(0,40);

    return Response.json({
      source: "DexScreener profiles + boosts + batched Solana token pairs",
      updatedAt: new Date().toISOString(),
      discovery: { profileCount: profiles?.length || 0, boostCount: boosts?.length || 0, addressCount: addresses.length },
      tokens,
      dataLimitations: "Public snapshots are not a tick-level trade feed and cannot guarantee millisecond execution."
    });
  } catch (error) {
    return Response.json({ error: "Market data unavailable", detail: String(error) }, { status: 502 });
  }
}
