import { isLikelyPumpFunMint } from "../../../research/mint-intelligence.js";

export const runtime = "nodejs";

const RPC = "https://api.mainnet-beta.solana.com";
async function rpc(method, params) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Solana RPC request failed");
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || "Solana RPC error");
  return json.result;
}

export async function GET(request, { params }) {
  const address = (await params).address;
  if (!address) return Response.json({ error: "Missing token address" }, { status: 400 });

  try {
    const [largest, supply, mintAccount] = await Promise.all([
      rpc("getTokenLargestAccounts", [address, { commitment: "confirmed" }]),
      rpc("getTokenSupply", [address, { commitment: "confirmed" }]),
      rpc("getAccountInfo", [address, { encoding: "jsonParsed", commitment: "confirmed" }]),
    ]);

    const holders = largest?.value || [];
    const accounts = holders.map((x) => x.address).filter(Boolean);

    const accountInfo = accounts.length
      ? await rpc("getMultipleAccounts", [
          accounts,
          { encoding: "jsonParsed", commitment: "confirmed" },
        ])
      : { value: [] };

    const enriched = holders.map((account, index) => {
      const parsed = accountInfo?.value?.[index]?.data?.parsed?.info;
      return {
        tokenAccount: account.address,
        amount: account.uiAmount,
        decimals: account.decimals,
        owner: parsed?.owner || null,
        state: parsed?.state || null,
      };
    });

    const totalSupply = Number(supply?.value?.uiAmount || 0);
    const top10 = enriched.slice(0, 10).reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const top20 = enriched.reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const uniqueOwners = new Set(enriched.map((x) => x.owner).filter(Boolean));

    const ownerAmounts = new Map();
    for (const row of enriched) {
      if (!row.owner) continue;
      ownerAmounts.set(row.owner, (ownerAmounts.get(row.owner) || 0) + Number(row.amount || 0));
    }

    const ownerRank = [...ownerAmounts.entries()]
      .map(([owner, amount]) => ({
        owner,
        amount,
        shareOfTop20Sample: top20 ? amount / top20 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const mintInfo = mintAccount?.value?.data?.parsed?.info || null;

    return Response.json({
      mint: address,
      source: "Solana mainnet RPC",
      protocol: {
        likelyPumpFun: isLikelyPumpFunMint(mintInfo || {}),
        pumpFunDetection: "mint authority match",
      },
      mintAccount: {
        mintAuthority: mintInfo?.mintAuthority || null,
        freezeAuthority: mintInfo?.freezeAuthority || null,
        decimals: Number.isFinite(mintInfo?.decimals) ? mintInfo.decimals : null,
      },
      supply: supply?.value || null,
      top10ShareOfTotalSupply: totalSupply ? top10 / totalSupply : null,
      sampledTokenAccounts: enriched.length,
      uniqueOwnersInTop20: uniqueOwners.size,
      ownerRank,
      accounts: enriched,
      limitations: [
        "Only the 20 largest token accounts are sampled.",
        "Owner concentration is not proof of common control.",
        "Pump.fun identification is based on the known Pump.fun mint authority; transaction-level program verification is a future hardening step.",
        "Funding-source and transaction-history clustering require additional historical RPC/indexer data.",
      ],
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      { error: "Token analysis unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}
