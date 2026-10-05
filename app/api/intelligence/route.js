export const runtime = "nodejs";

const RPC = "https://api.mainnet-beta.solana.com";

async function rpc(method, params) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Solana RPC unavailable");
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || "Solana RPC error");
  return json.result;
}

export async function GET(request) {
  const mint = new URL(request.url).searchParams.get("mint");
  if (!mint) return Response.json({ error: "mint query parameter is required" }, { status: 400 });

  try {
    const [largest, supply] = await Promise.all([
      rpc("getTokenLargestAccounts", [mint, { commitment: "confirmed" }]),
      rpc("getTokenSupply", [mint, { commitment: "confirmed" }]),
    ]);

    const accounts = largest?.value || [];
    const accountInfo = accounts.length
      ? await rpc("getMultipleAccounts", [
          accounts.map((x) => x.address),
          { encoding: "jsonParsed", commitment: "confirmed" },
        ])
      : { value: [] };

    const enriched = accounts.map((account, index) => {
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
    const uniqueOwners = new Set(enriched.map((x) => x.owner).filter(Boolean));
    const ownerAmounts = new Map();

    for (const row of enriched) {
      if (!row.owner) continue;
      ownerAmounts.set(row.owner, (ownerAmounts.get(row.owner) || 0) + Number(row.amount || 0));
    }

    const ownerRank = [...ownerAmounts.entries()]
      .map(([owner, amount]) => ({ owner, amount, shareOfTop20: top10 ? amount / top10 : 0 }))
      .sort((a, b) => b.amount - a.amount);

    return Response.json({
      mint,
      source: "Solana mainnet RPC",
      supply: supply?.value || null,
      top10ShareOfTotalSupply: totalSupply ? top10 / totalSupply : null,
      sampledTokenAccounts: enriched.length,
      uniqueOwnersInTop20: uniqueOwners.size,
      ownerRank,
      accounts: enriched,
      limitations: [
        "Owner resolution covers the sampled top token accounts only.",
        "Funding-source and behavioral clustering require transaction-history analysis.",
        "Program, liquidity and treasury accounts need classification before interpreting concentration as economic ownership.",
      ],
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: "On-chain intelligence unavailable", detail: String(error) }, { status: 502 });
  }
}
