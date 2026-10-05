import { isLikelyPumpFunMint } from "../../../../research/mint-intelligence.js";
import { getRpcUrls, rpc } from "../../../../lib/solana-rpc.js";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const address = (await params).address;
  if (!address) return Response.json({ error: "Missing token address" }, { status: 400 });

  try {
    const [largestRpc, supplyRpc, mintRpc] = await Promise.all([
      rpc("getTokenLargestAccounts", [address, { commitment: "confirmed" }]),
      rpc("getTokenSupply", [address, { commitment: "confirmed" }]),
      rpc("getAccountInfo", [address, { encoding: "jsonParsed", commitment: "confirmed" }]),
    ]);

    const holders = largestRpc.result?.value || [];
    const accounts = holders.map((x) => x.address).filter(Boolean);
    const accountRpc = accounts.length
      ? await rpc("getMultipleAccounts", [accounts, { encoding: "jsonParsed", commitment: "confirmed" }])
      : { result: { value: [] }, provider: largestRpc.provider };

    const enriched = holders.map((account, index) => {
      const parsed = accountRpc.result?.value?.[index]?.data?.parsed?.info;
      return {
        tokenAccount: account.address,
        amount: account.uiAmount,
        decimals: account.decimals,
        owner: parsed?.owner || null,
        state: parsed?.state || null,
      };
    });

    const totalSupply = Number(supplyRpc.result?.value?.uiAmount || 0);
    const top10 = enriched.slice(0, 10).reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const top20 = enriched.reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const uniqueOwners = new Set(enriched.map((x) => x.owner).filter(Boolean));
    const ownerAmounts = new Map();
    for (const row of enriched) {
      if (row.owner) ownerAmounts.set(row.owner, (ownerAmounts.get(row.owner) || 0) + Number(row.amount || 0));
    }

    const ownerRank = [...ownerAmounts.entries()]
      .map(([owner, amount]) => ({ owner, amount, shareOfTop20Sample: top20 ? amount / top20 : 0 }))
      .sort((a, b) => b.amount - a.amount);

    const mintInfo = mintRpc.result?.value?.data?.parsed?.info || null;

    return Response.json({
      mint: address,
      source: "Helius-first Solana RPC with public failover",
      rpcProvider: mintRpc.provider,
      rpcProviderConfigured: Boolean(process.env.HELIUS_API_KEY || process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL_2),
      rpcFailoverPool: getRpcUrls().length,
      protocol: { likelyPumpFun: isLikelyPumpFunMint(mintInfo || {}), pumpFunDetection: "mint authority match" },
      mintAccount: {
        mintAuthority: mintInfo?.mintAuthority || null,
        freezeAuthority: mintInfo?.freezeAuthority || null,
        decimals: Number.isFinite(mintInfo?.decimals) ? mintInfo.decimals : null,
      },
      supply: supplyRpc.result?.value || null,
      top10ShareOfTotalSupply: totalSupply ? top10 / totalSupply : null,
      sampledTokenAccounts: enriched.length,
      uniqueOwnersInTop20: uniqueOwners.size,
      ownerRank,
      accounts: enriched,
      limitations: [
        "Only the 20 largest token accounts are sampled.",
        "Owner concentration is not proof of common control.",
        "Funding-source and transaction-history clustering require additional historical/indexer data.",
      ],
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: "Token analysis unavailable", detail: String(error), rpcProvidersTried: getRpcUrls().length }, { status: 502 });
  }
}
