import { collectMarketSnapshot } from "../../../../research/collector.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROFILE_API = "https://api.dexscreener.com/token-profiles/latest/v1";
const BOOST_API = "https://api.dexscreener.com/token-boosts/latest/v1";
const TOKEN_API = "https://api.dexscreener.com/latest/dex/tokens/";

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error("Market provider HTTP " + response.status);
  return response.json();
}

// Read-only research endpoint. No wallet access, signing, or live orders.
export async function GET() {
  try {
    const result = await collectMarketSnapshot(async () => {
      const [profiles, boosts] = await Promise.all([fetchJson(PROFILE_API), fetchJson(BOOST_API)]);
      const addresses = [...new Set([
        ...(profiles || []).filter(x => x.chainId === "solana").map(x => x.tokenAddress),
        ...(boosts || []).filter(x => x.chainId === "solana").map(x => x.tokenAddress)
      ].filter(Boolean))].slice(0, 30);
      if (!addresses.length) return { source: "DexScreener", tokens: [] };

      // Official token endpoint accepts comma-separated token addresses (up to 30).
      const payload = await fetchJson(TOKEN_API + addresses.map(encodeURIComponent).join(","));
      const excluded = new Set(["SOL","USDC","USDT","USD1","DAI","USDS","USDE","WETH","WBTC"]);
      const seen = new Set();
      const tokens = (payload.pairs || []).filter(pair => {
        const symbol = String(pair.baseToken?.symbol || "").toUpperCase();
        if (pair.chainId !== "solana" || !pair.baseToken?.address || excluded.has(symbol) || seen.has(pair.pairAddress)) return false;
        seen.add(pair.pairAddress);
        return true;
      }).map(pair => ({
        name: pair.baseToken?.name || pair.baseToken?.symbol || "Unknown",
        symbol: pair.baseToken?.symbol || "?",
        address: pair.baseToken.address,
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
      })).sort((a,b) => (b.volume24h + b.txns24h*25) - (a.volume24h + a.txns24h*25)).slice(0,40);
      return { source: "DexScreener profiles + boosts + token pairs", tokens };
    });

    const minLiquidityUsd = 5000;
    const roundTripFeeAssumptionPct = 2.5;
    const slippagePerSideAssumptionPct = 2;
    const costMultiplier = (1-roundTripFeeAssumptionPct/100)*Math.pow(1-slippagePerSideAssumptionPct/100,2);
    const candidates = result.candidates.map(candidate => {
      const s = candidate.snapshot || {};
      const score = Number(candidate.scoring?.score || 0);
      const liquidity = Number(s.liquidityUsd);
      const price = Number(s.priceUsd);
      const riskCount = Number(candidate.scoring?.risk?.riskCount || 0);
      const eligible = Number.isFinite(liquidity) && liquidity >= minLiquidityUsd &&
        Number.isFinite(price) && price > 0 && score >= 65 && riskCount <= 1;
      return {
        mint:s.mint, pair:s.pair, symbol:s.symbol || null, name:s.name || null, observedAt:s.observedAt,
        priceUsd:Number.isFinite(price) && price > 0 ? price : null,
        liquidityUsd:Number.isFinite(liquidity) ? liquidity : null,
        volume24h:s.volume24h ?? null, score, tier:candidate.scoring?.tier || "D", riskCount,
        estimatedCostDragPct:Math.round((1-costMultiplier)*10000)/100,
        signal:eligible ? "PAPER_WATCH" : "NO_TRADE",
        reason:eligible ? "Meets preliminary research filters; not a buy recommendation." :
          "Does not meet all preliminary liquidity, score and risk filters."
      };
    }).sort((a,b)=>b.score-a.score);

    return Response.json({
      ok:true, mode:"read-only-paper-research", source:result.source, observedAt:result.observedAt,
      persistence:result.persistence, durableStorageConfigured:result.persistence?.durable === true,
      assumptions:{minLiquidityUsd,minScore:65,maxRiskFlags:1,roundTripFeeAssumptionPct,slippagePerSideAssumptionPct,
        warning:"Illustrative cost assumptions only. Actual fees, spreads and fills vary; profit is never guaranteed."},
      counts:{candidates:candidates.length,paperWatch:candidates.filter(x=>x.signal==="PAPER_WATCH").length,
        noTrade:candidates.filter(x=>x.signal==="NO_TRADE").length},
      candidates,
      safety:"Research only. No wallet access, signing, or live orders. Validate chronologically and paper trade before considering live execution."
    });
  } catch (error) {
    return Response.json({ok:false,error:"Paper research scan failed",detail:String(error)}, {status:502});
  }
}
