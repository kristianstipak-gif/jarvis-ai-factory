import { getRpcUrls, heliusRpc, rpc } from "../../../../lib/solana-rpc.js";

export const runtime = "nodejs";

function lamportsToSol(value) {
  return Number(value || 0) / 1e9;
}

function classifyFundingTransaction(tx, address) {
  const message = tx?.transaction?.message;
  const keys = message?.accountKeys || [];
  const index = keys.findIndex((key) => (typeof key === "string" ? key : key?.pubkey) === address);
  if (index < 0) return null;

  const pre = tx?.meta?.preBalances?.[index];
  const post = tx?.meta?.postBalances?.[index];
  if (!Number.isFinite(pre) || !Number.isFinite(post)) return null;

  const delta = post - pre;
  if (delta <= 0) return null;

  const signer = keys.find((key) => (typeof key === "object" ? key.signer : false));
  return {
    type: "native-sol-inflow",
    lamports: delta,
    sol: lamportsToSol(delta),
    likelySource: signer?.pubkey || null,
    signature: tx?.transaction?.signatures?.[0] || null,
    blockTime: tx?.blockTime || null,
  };
}

export async function GET(request, { params }) {
  const address = (await params).address;
  if (!address) return Response.json({ error: "Missing wallet address" }, { status: 400 });

  try {
    const [balanceRpc, sigsRpc, tokenRpc] = await Promise.all([
      rpc("getBalance", [address, { commitment: "confirmed" }]),
      rpc("getSignaturesForAddress", [address, { commitment: "confirmed", limit: 50 }]),
      rpc("getTokenAccountsByOwner", [
        address,
        { programId: "TokenkegQfeZyiWnAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]),
    ]);

    const sigs = sigsRpc.result || [];
    const failed = sigs.filter((x) => x.err).length;
    const timestamps = sigs.map((x) => x.blockTime).filter(Boolean);

    // Inspect a small sample of recent transactions when Helius is configured.
    // This is intentionally bounded to avoid excessive RPC usage.
    let transactionSample = [];
    let fundingCandidates = [];
    if (process.env.HELIUS_API_KEY) {
      const sample = sigs.slice(0, 8);
      const results = await Promise.allSettled(
        sample.map((item) =>
          heliusRpc("getTransaction", [
            item.signature,
            {
              encoding: "jsonParsed",
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            },
          ])
        )
      );

      transactionSample = results
        .filter((x) => x.status === "fulfilled" && x.value)
        .map((x) => x.value);

      fundingCandidates = transactionSample
        .map((tx) => classifyFundingTransaction(tx, address))
        .filter(Boolean)
        .sort((a, b) => b.lamports - a.lamports)
        .slice(0, 5);
    }

    return Response.json({
      address,
      balanceSol: lamportsToSol(balanceRpc.result?.value),
      tokenAccountCount: tokenRpc.result?.value?.length || 0,
      recentTransactions: sigs.length,
      failedRecentTransactions: failed,
      failedRate: sigs.length ? failed / sigs.length : 0,
      firstObservedRecentTimestamp: timestamps.length ? Math.min(...timestamps) : null,
      lastObservedRecentTimestamp: timestamps.length ? Math.max(...timestamps) : null,
      transactionSampled: transactionSample.length,
      fundingCandidates,
      source: "Helius-first Solana RPC with public failover",
      rpcProvider: balanceRpc.provider,
      transactionProvider: process.env.HELIUS_API_KEY ? "Helius" : null,
      rpcProviderConfigured: Boolean(process.env.HELIUS_API_KEY || process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_2),
      rpcFailoverPool: getRpcUrls().length,
      limitations: [
        "Funding candidates are inferred from a bounded recent transaction sample.",
        "A signer is not automatically the economic funding source.",
        "Complete historical clustering requires archival/indexer queries and broader transaction sampling.",
      ],
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({
      error: "Wallet analysis unavailable",
      detail: String(error),
      rpcProvidersTried: getRpcUrls().length,
    }, { status: 502 });
  }
}
