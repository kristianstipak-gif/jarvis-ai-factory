import { createClient } from "@supabase/supabase-js";
import { createStorageAdapter } from "../../../../research/storage.js";
import { runWalkForwardLab } from "../../../../research/walk-forward-lab.js";
import { researchGatePassed } from "../../../../research/paper-trading.js";
import { summarizeMarketHistory } from "../../../../research/market-health.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!key) return Response.json({ok:false,error:"Durable storage is not configured"},{status:503});
  try {
    const db=createClient(url,key,{auth:{persistSession:false}});
    const [positionsResult,store]=await Promise.all([
      db.from("paper_positions").select("*").order("entry_at",{ascending:false}).limit(1000),
      Promise.resolve(createStorageAdapter())
    ]);
    if(positionsResult.error) throw new Error(positionsResult.error.message);
    const positions=positionsResult.data||[];
    const open=positions.filter(p=>p.status==="open");
    const closed=positions.filter(p=>p.status==="closed");
    const pnl=closed.map(p=>Number(p.pnl_usd||0));
    const realizedPnlUsd=pnl.reduce((s,x)=>s+x,0);
    const wins=closed.filter(p=>Number(p.net_return_pct)>0).length;
    const history=await store.read({limit:2000});
    const marketHealth=summarizeMarketHistory(history,Date.now());
    const research=runWalkForwardLab(history);
    return Response.json({
      ok:true,mode:"paper-only",durableStorage:store.durable,
      observedAt:new Date().toISOString(),
      marketData:{...marketHealth,totalStoredSnapshots:await store.count(),recentSnapshots:history.length},
      research:{verdict:research.verdict,eligible:research.eligible,
        gridConfigurations:research.gridConfigurations,trainTrades:research.train?.trades||0,
        testTrades:research.test?.trades||0,testMeanNetPct:research.test?.meanNetPct??null,
        holdoutPassed:research.selection?.holdoutPassed??false,
        allowNewEntries:researchGatePassed(research)},
      ledger:{openPositions:open.length,closedTrades:closed.length,realizedPnlUsd,
        winRatePct:closed.length?Math.round(wins/closed.length*10000)/100:null,
        positions:positions.slice(0,100).map(p=>({id:p.id,symbol:p.symbol,mint:p.mint,pair:p.pair,
          status:p.status,entryPrice:Number(p.entry_price),exitPrice:p.exit_price===null?null:Number(p.exit_price),
          positionUsd:Number(p.position_usd),entryAt:p.entry_at,exitAt:p.exit_at,
          netReturnPct:p.net_return_pct===null?null:Number(p.net_return_pct),
          pnlUsd:p.pnl_usd===null?null:Number(p.pnl_usd),closeReason:p.close_reason}))},
      execution:{enabled:false,walletConnected:false,realOrdersSubmitted:0},
      limitations:["This endpoint reports simulated positions only; no real wallet or live trades.",
        "Snapshot collection depends on the scheduled paper-trader workflow running successfully.",
        ...marketHealth.warnings]
    });
  } catch(error) {
    return Response.json({ok:false,error:"Paper trader status failed",detail:String(error?.message||error)},{status:500});
  }
}
