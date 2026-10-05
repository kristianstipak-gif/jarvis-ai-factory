export const runtime = "nodejs";

const PROFILE_API = "https://api.dexscreener.com/token-profiles/latest/v1";
const BOOST_API = "https://api.dexscreener.com/token-boosts/latest/v1";
const TOP_BOOST_API = "https://api.dexscreener.com/token-boosts/top/v1";
const TOKEN_API = "https://api.dexscreener.com/latest/dex/tokens/";

const EXCLUDED_SYMBOLS = new Set([
  "SOL", "WSOL", "USDC", "USDT", "USD1", "DAI", "USDE", "USDS",
  "BTC", "WBTC", "ETH", "WETH"
]);

async function getJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`DexScreener request failed: ${response.status}`);
  return response.json();
}

function tokenAddressOf(item) {
  return item?.tokenAddress || item?.address || null;
}

export async function GET() {
  try {
    const [profiles, boosts, topBoosts] = await Promise.all([
      getJson(PROFILE_API),
      getJson(BOOST_API),
      getJson(TOP_BOOST_API),
    ]);

    const addresses = [
      ...(profiles || []),
      ...(boosts || []),
      ...(topBoosts || []),
    ]
      .filter((x) => x?.chainId === "solana")
      .map(tokenAddressOf)
      .filter(Boolean);

    const uniqueAddresses = [...new Set(addresses)].slice(0, 90);

    const payloads = [];
    for (let i = 0; i < uniqueAddresses.length; i += 30) {
      const chunk = uniqueAddresses.slice(i, i + 30);
      payloads.push(await getJson(TOKEN_API + chunk.join(",")));
    }

    const seen = new Set();
    const tokens = payloads
      .flatMap((p) => p?.pairs || [])
      .filter((p) => {
        if (!p?.pairAddress || p.chainId !== "solana" || seen.has(p.pairAddress)) return false;
        seen.add(p.pairAddress);
        return true;
      })
      .map((p) => ({
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
        fdv: Number(p.fdv || 0),
        marketCap: Number(p.marketCap || 0),
        pairCreatedAt: p.pairCreatedAt || null,
        url: p.url,
      }))
      .filter((x) =>
        x.address &&
        !EXCLUDED_SYMBOLS.has(String(x.symbol).toUpperCase()) &&
        (x.liquidityUsd > 0 || x.volume24h > 0 || x.txns24h > 0)
      )
      .sort((a, b) => {
        const aPump = a.dex === "pumpfun" ? 1 : 0;
        const bPump = b.dex === "pumpfun" ? 1 : 0;
        if (aPump !== bPump) return bPump - aPump;
        return b.volume24h - a.volume24h;
      })
      .slice(0, 60);

    return Response.json({
      source: "DexScreener token profiles + boosts",
      updatedAt: new Date().toISOString(),
      discovery: {
        solanaAddresses: uniqueAddresses.length,
        returnedPairs: tokens.length,
        excludedMajorAssets: true,
      },
      tokens,
    });
  } catch (error) {
    return Response.json(
      { error: "Market data unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}
