import { collectFromUrl } from "../../../../research/collector.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only research endpoint. It never signs transactions or sends live orders.
export async function GET(request) {
  try {
    const origin = new URL(request.url).origin;
    const result = await collectFromUrl(origin + "/api/market");
    const minLiquidityUsd = 5000;
    const roundTripFeeAssumptionPct = 2.5;
    const slippagePerSideAssumptionPct = 2;
    const costMultiplier = (1 - roundTripFeeAssumptionPct / 100) * Math.pow(1 - slippagePerSideAssumptionPct / 100, 2);
    const candidates = result.candidates.map((candidate) => {
      const s = candidate.snapshot || {};
      const score = Number(candidate.scoring?.score || 0);
      const liquidity = Number(s.liquidityUsd);
      const price = Number(s.priceUsd);
      const riskCount = Number(candidate.scoring?.risk?.riskCount || 0);
      const eligible = Number.isFinite(liquidity) && liquidity >= minLiquidityUsd &&
        Number.isFinite(price) && price > 0 && score >= 65 && riskCount <= 1;
      return {
        mint: s.mint, pair: s.pair, symbol: s.symbol || null, name: s.name || null,
        observedAt: s.observedAt,
        priceUsd: Number.isFinite(price) && price > 0 ? price : null,
        liquidityUsd: Number.isFinite(liquidity) ? liquidity : null,
        volume24h: s.volume24h ?? null, score,
        tier: candidate.scoring?.tier || "D", riskCount,
        estimatedCostDragPct: Math.round((1-costMultiplier)*10000)/100,
        signal: eligible ? "PAPER_WATCH" : "NO_TRADE",
        reason: eligible ? "Meets preliminary research filters; not a buy recommendation." :
          "Does not meet all preliminary liquidity, score, and risk filters."
      };
    }).sort((a,b) => b.score-a.score);
    return Response.json({
      ok: true, mode: "read-only-paper-research", source: result.source,
      observedAt: result.observedAt, persistence: result.persistence,
      durableStorageConfigured: result.persistence?.durable === true,
      assumptions: {
        minLiquidityUsd, minScore: 65, maxRiskFlags: 1,
        roundTripFeeAssumptionPct, slippagePerSideAssumptionPct,
        warning: "Illustrative assumptions only. Actual fees, spreads and fills vary; profit is never guaranteed."
      },
      counts: { candidates: candidates.length, paperWatch: candidates.filter(x=>x.signal==="PAPER_WATCH").length,
        noTrade: candidates.filter(x=>x.signal==="NO_TRADE").length },
      candidates,
      safety: "No wallet access, signing, or live orders. Require historical out-of-sample validation and paper-trading outcome evidence before live execution."
    });
  } catch (error) {
    return Response.json({ ok:false, error:"Paper research scan failed", detail:String(error) }, { status:502 });
  }
}
