export const runtime = "nodejs";

const PROFILE_API = "https://api.dexscreener.com/token-profiles/latest/v1";
const BOOST_API = "https://api.dexscreener.com/token-boosts/latest/v1";
const TOKEN_API = "https://api.dexscreener.com/latest/dex/tokens/";

const EXCLUDED_SYMBOLS = new Set([
  "SOL", "USDC", "USDT", "USD1", "DAI", "USDS", "USDE", "WETH", "WBTC",
]);

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 15 },
  });
  if (!response.ok) throw new Error("DexScreener request failed: " + response.status);
  return response.json();
}

function isCandidate(pair) {
  const symbol = String(pair?.baseToken?.symbol || "").toUpperCase();
  return pair?.chainId === "solana" &&
    pair?.baseToken?.address &&
    !EXCLUDED_SYMBOLS.has(symbol);
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
    url: pair.url,
  };
}

export async function GET() {
  try {
    const [profiles, boosts] = await Promise.all([
      fetchJson(PROFILE_API),
      fetchJson(BOOST_API),
    ]);

    const addresses = [
      ...(profiles || []).filter((x) => x.chainId === "solana").map((x) => x.tokenAddress),
      ...(boosts || []).filter((x) => x.chainId === "solana").map((x) => x.tokenAddress),
    ].filter(Boolean);

    const uniqueAddresses = [...new Set(addresses)].slice(0, 30);

    const tokenPayloads = await Promise.all(
      uniqueAddresses.map(async (address) => {
        try {
          return await fetchJson(TOKEN_API + encodeURIComponent(address));
        } catch {
          return { pairs: [] };
        }
      })
    );

    const seenPairs = new Set();
    const pairs = tokenPayloads.flatMap((payload) => payload.pairs || []).filter((pair) => {
      if (!isCandidate(pair) || seenPairs.has(pair.pairAddress)) return false;
      seenPairs.add(pair.pairAddress);
      return true;
    });

    const tokens = pairs
      .map(toToken)
      .filter((token) => token.address)
      .sort((a, b) => {
        const aActivity = a.volume24h + a.txns24h * 25;
        const bActivity = b.volume24h + b.txns24h * 25;
        return bActivity - aActivity;
      })
      .slice(0, 40);

    return Response.json({
      source: "DexScreener token profiles + boosts",
      updatedAt: new Date().toISOString(),
      discovery: {
        profileCount: profiles?.length || 0,
        boostCount: boosts?.length || 0,
        addressCount: uniqueAddresses.length,
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
