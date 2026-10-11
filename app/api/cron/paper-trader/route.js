import { createClient } from "@supabase/supabase-js";
import { evaluateAutoTradeCandidate } from "../../../../research/auto-trader.js";
import { evaluatePaperExit, netReturnPct, paperPositionSize } from "../../../../research/paper-trading.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PROFILE_API = "https://api.dexscreener.com/token-profiles/latest/v1";
const BOOST_API = "https://api.dexscreener.com/token-boosts/latest/v1";
const TOKENS_API = "https://api.dexscreener.com/tokens/v1/solana/";
const EXCLUDED = new Set(["SOL","USDC","USDT","USD1","DAI","USDS","USDE","WETH","WBTC"]);

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" }, cache: "no-store",
    signal: AbortSignal.timeout(10000)
  });
  const body = await response.text();
  if (!response.ok) throw new Error("DexScreener HTTP " + response.status);
  try { return JSON.parse(body); } catch { throw new Error("DexScreener returned non-JSON"); }
}
function toToken(p) {
  return {
    mint:p.baseToken.address, pair:p.pairAddress,
    name:p.baseToken.name||p.baseToken.symbol||"Unknown", symbol:p.baseToken.symbol||"?",
    url:p.url, priceUsd:Number(p.priceUsd||0), liquidityUsd:Number(p.liquidity?.usd||0),
    volume24h:Number(p.volume?.h24||0), buys24h:Number(p.txns?.h24?.buys||0),
    sells24h:Number(p.txns?.h24?.sells||0),
    txns24h:Number(p.txns?.h24?.buys||0)+Number(p.txns?.h24?.sells||0),
    priceChange24h:Number(p.priceChange?.h24||0)
  };
}
async function getTokens(extraAddresses = []) {
  const [profiles, boosts] = await Promise.all([fetchJson(PROFILE_API), fetchJson(BOOST_API)]);
  const addresses = [...new Set([
    ...(Array.isArray(profiles)?profiles:[]).filter(x=>x.chainId==="solana").map(x=>x.tokenAddress),
    ...(Array.isArray(boosts)?boosts:[]).filter(x=>x.chainId==="solana").map(x=>x.tokenAddress),
    ...extraAddresses
  ].filter(Boolean))].slice(0,100);
  const batches = [];
  for(let i=0;i<addresses.length;i+=30) batches.push(addresses.slice(i,i+30));
  const pairLists = await Promise.all(batches.map(batch=>fetchJson(TOKENS_API+batch.map(encodeURIComponent).join(","))));
  const seen = new Set();
  return pairLists.flat().filter(p=>{
    const sym=String(p.baseToken?.symbol||"").toUpperCase();
    if(p.chainId!=="solana"||!p.baseToken?.address||!p.pairAddress||EXCLUDED.has(sym)||seen.has(p.pairAddress))return false;
    seen.add(p.pairAddress); return true;
  }).map(toToken).filter(t=>t.priceUsd>0);
}
export async function GET(request) {
  const expected=process.env.CRON_SECRET;
  if(!expected || request.headers.get("authorization")!==`Bearer ${expected}`) {
    return Response.json({ok:false,error:"Unauthorized"},{status:401});
  }
  const supabaseUrl=process.env.SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!supabaseUrl||!serviceKey) {
    return Response.json({ok:false,error:"Durable Supabase server credentials are not configured"},{status:503});
  }
  const db=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
  try {
    const now=new Date(), nowMs=now.getTime();
    const baseEquity=Number(process.env.PAPER_EQUITY_USD||1000);
    const todayStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())).toISOString();
    const [openResult,closedResult,recentResult,closed24hResult,todayResult]=await Promise.all([
      db.from("paper_positions").select("*").eq("status","open"),
      db.from("paper_positions").select("pnl_usd,exit_at").eq("status","closed"),
      db.from("paper_positions").select("id").gte("entry_at",new Date(nowMs-3600000).toISOString()),
      db.from("paper_positions").select("pnl_usd,exit_at").eq("status","closed").gte("exit_at",new Date(nowMs-24*3600000).toISOString()),
      db.from("paper_positions").select("pnl_usd,exit_at").eq("status","closed").gte("exit_at",todayStart)
    ]);
    for(const result of [openResult,closedResult,recentResult,closed24hResult,todayResult]) {
      if(result.error) throw new Error(result.error.message);
    }
    const open=openResult.data||[], closed=closedResult.data||[];
    const recent=recentResult.data||[], closed24h=closed24hResult.data||[], today=todayResult.data||[];
    // Always fetch marks for held tokens, even if they disappear from the promoted-token feed.
    const tokens=await getTokens(open.map(p=>p.mint));
    const realizedAll=closed.reduce((s,x)=>s+Number(x.pnl_usd||0),0);
    const realized24h=closed24h.reduce((s,x)=>s+Number(x.pnl_usd||0),0);
    const unrealized=open.reduce((s,p)=>{
      const t=tokens.find(x=>x.mint===p.mint&&x.pair===p.pair);
      if(!t)return s;
      return s+Number(p.position_usd)*netReturnPct((t.priceUsd/Number(p.entry_price)-1)*100)/100;
    },0);
    const equity=Math.max(0,baseEquity+realizedAll+unrealized);
    const dailyPnl=today.reduce((s,x)=>s+Number(x.pnl_usd||0),0);
    const dailyLossPct=Math.max(0,-dailyPnl/Math.max(baseEquity,1)*100);
    const closedDetails=[];
    for(const p of open) {
      const token=tokens.find(t=>t.mint===p.mint&&t.pair===p.pair);
      if(!token) continue;
      const exit=evaluatePaperExit(p,token.priceUsd,nowMs);
      if(!exit.close) continue;
      const net=netReturnPct(exit.grossReturnPct), pnl=Number(p.position_usd)*net/100;
      const update=await db.from("paper_positions").update({
        status:"closed",exit_price:token.priceUsd,exit_at:now.toISOString(),
        gross_return_pct:exit.grossReturnPct,net_return_pct:net,pnl_usd:pnl,close_reason:exit.reason
      }).eq("id",p.id).eq("status","open").select("id");
      if(update.error) throw new Error(update.error.message);
      if(update.data?.length) closedDetails.push({id:p.id,symbol:p.symbol,reason:exit.reason,netReturnPct:net,pnlUsd:pnl});
    }
    const refreshedResult=await db.from("paper_positions").select("*").eq("status","open");
    if(refreshedResult.error) throw new Error(refreshedResult.error.message);
    const refreshedOpen=refreshedResult.data||[], opened=[];
    const ranked=tokens.map(t=>({...t,...evaluateAutoTradeCandidate(t,{
      equityUsd:equity,openPositions:refreshedOpen.length,tradesLastHour:recent.length,
      dailyLossPct
    })})).filter(x=>x.decision==="PAPER_BUY_CANDIDATE")
      .sort((a,b)=>(b.metrics.buyRatio||0)-(a.metrics.buyRatio||0));
    for(const candidate of ranked) {
      if(refreshedOpen.length+opened.length>=3||recent.length+opened.length>=6||dailyLossPct>=2) break;
      if(refreshedOpen.some(p=>p.mint===candidate.mint&&p.pair===candidate.pair)||
         opened.some(p=>p.mint===candidate.mint&&p.pair===candidate.pair)) continue;
      const size=paperPositionSize(equity);
      if(size<=0) break;
      const insert=await db.from("paper_positions").insert({
        mint:candidate.mint,pair:candidate.pair,name:candidate.name,symbol:candidate.symbol,
        status:"open",entry_price:candidate.priceUsd,position_usd:size,
        quantity:size/candidate.priceUsd,entry_at:now.toISOString(),
        fees_assumed_pct:2.5,slippage_per_side_pct:2
      }).select("id,mint,pair,symbol,entry_price,position_usd");
      if(insert.error) {
        if(String(insert.error.code)==="23505") continue;
        throw new Error(insert.error.message);
      }
      opened.push(insert.data?.[0]||{symbol:candidate.symbol,position_usd:size});
    }
    return Response.json({
      ok:true,mode:"paper-only",observedAt:now.toISOString(),
      market:{tokensScanned:tokens.length},
      ledger:{openPositions:refreshedOpen.length+opened.length,closedThisRun:closedDetails.length,
        openedThisRun:opened.length,closedDetails,opened},
      risk:{paperEquityUsd:equity,realizedPnlAllTimeUsd:realizedAll,realizedPnlLast24hUsd:realized24h,
        dailyLossPct,maxOpenPositions:3,maxTradesPerHour:6,maxDailyLossPct:2,positionPct:1},
      execution:{enabled:false,walletConnected:false,realOrdersSubmitted:0},
      limitations:[
        "Runs only when the scheduled workflow invokes it; current schedule is every 5 minutes, not every second.",
        "Market feed is a promoted-token list with rolling 24-hour aggregates, not tick-level history or order-book depth.",
        "Paper fills are assumed at the observed price; costs are modeled, but MEV, failed fills, token taxes, route impact and priority fees are not fully modeled.",
        "This system never signs or submits real transactions."
      ]
    });
  } catch(error) {
    return Response.json({ok:false,mode:"paper-only",error:"Paper trader run failed",
      detail:String(error?.message||error)},{status:500});
  }
}
