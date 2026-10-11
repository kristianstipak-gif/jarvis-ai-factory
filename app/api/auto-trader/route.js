import { evaluateAutoTradeCandidate } from "../../../research/auto-trader.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROFILE_API = "https://api.dexscreener.com/token-profiles/latest/v1";
const BOOST_API = "https://api.dexscreener.com/token-boosts/latest/v1";
const TOKENS_API = "https://api.dexscreener.com/tokens/v1/solana/";
const EXCLUDED_SYMBOLS = new Set(["SOL", "USDC", "USDT", "USD1", "DAI", "USDS", "USDE", "WETH", "WBTC"]);

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Market provider returned HTTP ${response.status}`);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Market provider returned non-JSON data");
  }
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

async function getMarketSnapshot() {
  const [profiles, boosts] = await Promise.all([fetchJson(PROFILE_API), fetchJson(BOOST_API)]);
  const addresses = [...new Set([
    ...(Array.isArray(profiles) ? profiles : []).filter((x) => x.chainId === "solana").map((x) => x.tokenAddress),
    ...(Array.isArray(boosts) ? boosts : []).filter((x) => x.chainId === "solana").map((x) => x.tokenAddress),
  ].filter(Boolean))].slice(0, 30);

  const pairs = addresses.length
    ? await fetchJson(TOKENS_API + addresses.map(encodeURIComponent).join(","))
    : [];
  const seen = new Set();
  const tokens = (Array.isArray(pairs) ? pairs : [])
    .filter((pair) => {
      const symbol = String(pair.baseToken?.symbol || "").toUpperCase();
      if (pair.chainId !== "solana" || !pair.baseToken?.address || !pair.pairAddress ||
          EXCLUDED_SYMBOLS.has(symbol) || seen.has(pair.pairAddress)) return false;
      seen.add(pair.pairAddress);
      return true;
    })
    .map(toToken)
    .filter((token) => token.priceUsd > 0)
    .sort((a, b) => (b.volume24h + b.txns24h * 25) - (a.volume24h + a.txns24h * 25))
    .slice(0, 40);

  return {
    source: "DexScreener profiles + boosts + batched Solana token pairs",
    updatedAt: new Date().toISOString(),
    tokens,
  };
}

export async function GET() {
  try {
    // Query DexScreener directly instead of fetching this app's own /api/market
    // route, which can return an HTML deployment/protection page on Vercel.
    const market = await getMarketSnapshot();

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
    return Response.json({
      ok: false,
      mode: "paper-only",
      error: "Auto trader scan failed",
      detail: String(error?.message || error),
    }, { status: 502 });
  }
}
