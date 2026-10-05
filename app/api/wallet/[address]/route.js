import { getRpcUrls, heliusRpc, rpc } from "../../../../lib/solana-rpc.js";

export const runtime = "nodejs";

function lamportsToSol(value) {
  return Number(value || 0) / 1e9;
}

function classifyFundingTransaction(tx, address) {
  const keys = tx?.transaction?.message?.accountKeys || [];
  const index = keys.findIndex((key) => (typeof key === "string" ? key : key?.pubkey) === address);
  if (index < 0) return null;

  const pre = Number(tx?.meta?.preBalances?.[index]);
  const post = Number(tx?.meta?.postBalances?.[index]);
  if (!Number.isFinite(pre) || !Number.isFinite(post) || post <= pre) return null;

  const signers = keys
    .filter((key) => typeof key === "object" && key.signer)
    .map((key) => key.pubkey)
    .filter(Boolean);

  return {
    type: "native-sol-inflow",
    lamports: post - pre,
    sol: lamportsToSol(post - pre),
    possibleSources: signers.filter((x) => x !== address).slice(0, 5),
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
        { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]),
    ]);

    const sigs = Array.isArray(sigsRpc.result) ? sigsRpc.result : [];
    const failed = sigs.filter((x) => x.err).length;
    const timestamps = sigs.map((x) => x.blockTime).filter((x) => Number.isFinite(x));

    let transactionSample = [];
    let fundingCandidates = [];
    const transactionErrors = [];

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

      for (let i = 0; i < results.length; i += 1) {
        const result = results[i];
        if (result.status === "fulfilled" && result.value) {
          transactionSample.push(result.value);
        } else if (result.status === "rejected") {
          transactionErrors.push(String(result.reason));
        }
      }

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
      transactionErrors: transactionErrors.slice(0, 3),
      source: "Helius-first Solana RPC with public failover",
      rpcProvider: balanceRpc.provider,
      transactionProvider: process.env.HELIUS_API_KEY ? "Helius" : null,
      rpcProviderConfigured: Boolean(process.env.HELIUS_API_KEY || process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_2),
      rpcFailoverPool: getRpcUrls().length,
      limitations: [
        "Funding candidates are inferred from a bounded recent transaction sample.",
        "A signer is only a possible source, not proof of economic ownership.",
        "Complete historical clustering requires broader transaction/indexer analysis.",
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
