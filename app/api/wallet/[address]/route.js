import { getRpcUrls, rpc } from "../../../../lib/solana-rpc.js";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const address = (await params).address;
  if (!address) return Response.json({ error: "Missing wallet address" }, { status: 400 });

  try {
    const [balanceRpc, sigsRpc, tokenRpc] = await Promise.all([
      rpc("getBalance", [address, { commitment: "confirmed" }]),
      rpc("getSignaturesForAddress", [address, { commitment: "confirmed", limit: 50 }]),
      rpc("getTokenAccountsByOwner", [address, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed", commitment: "confirmed" }]),
    ]);

    const sigs = sigsRpc.result || [];
    const failed = sigs.filter((x) => x.err).length;
    const timestamps = sigs.map((x) => x.blockTime).filter(Boolean);

    return Response.json({
      address,
      balanceSol: Number(balanceRpc.result?.value || 0) / 1e9,
      tokenAccountCount: tokenRpc.result?.value?.length || 0,
      recentTransactions: sigs.length,
      failedRecentTransactions: failed,
      failedRate: sigs.length ? failed / sigs.length : 0,
      firstObservedRecentTimestamp: timestamps.length ? Math.min(...timestamps) : null,
      lastObservedRecentTimestamp: timestamps.length ? Math.max(...timestamps) : null,
      source: "Helius-first Solana RPC with public failover",
      rpcProvider: balanceRpc.provider,
      rpcProviderConfigured: Boolean(process.env.HELIUS_API_KEY || process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_2),
      rpcFailoverPool: getRpcUrls().length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: "Wallet analysis unavailable", detail: String(error), rpcProvidersTried: getRpcUrls().length }, { status: 502 });
  }
}
