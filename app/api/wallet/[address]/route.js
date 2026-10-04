export const runtime = "nodejs";

const RPC = "https://api.mainnet-beta.solana.com";

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({jsonrpc:"2.0",id:1,method,params}),
    cache:"no-store"
  });
  if (!r.ok) throw new Error("Solana RPC request failed");
  const j=await r.json();
  if(j.error) throw new Error(j.error.message || "Solana RPC error");
  return j.result;
}

export async function GET(request,{params}) {
  const address=(await params).address;
  try {
    const [balance,sigs,tokenAccounts]=await Promise.all([
      rpc("getBalance",[address,{commitment:"confirmed"}]),
      rpc("getSignaturesForAddress",[address,{commitment:"confirmed",limit:50}]),
      rpc("getTokenAccountsByOwner",[address,{programId:"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},{encoding:"jsonParsed",commitment:"confirmed"}])
    ]);
    const failed=(sigs||[]).filter(x=>x.err).length;
    const timestamps=(sigs||[]).map(x=>x.blockTime).filter(Boolean);
    return Response.json({
      address,
      balanceSol:Number(balance?.value||0)/1e9,
      tokenAccountCount:tokenAccounts?.value?.length||0,
      recentTransactions:sigs?.length||0,
      failedRecentTransactions:failed,
      failedRate:sigs?.length?failed/sigs.length:0,
      firstObservedRecentTimestamp:timestamps.length?Math.min(...timestamps):null,
      lastObservedRecentTimestamp:timestamps.length?Math.max(...timestamps):null,
      source:"Solana mainnet RPC",
      updatedAt:new Date().toISOString()
    });
  } catch(error) {
    return Response.json({error:"Wallet analysis unavailable",detail:String(error)},{status:502});
  }
}
