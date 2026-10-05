export const runtime = "nodejs";

const RPC = "https://api.mainnet-beta.solana.com";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

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
  const url = new URL(request.url);
  const mint = url.searchParams.get("mint");
  if (!mint) return Response.json({ error: "mint query parameter is required" }, { status: 400 });

  try {
    const largest = await rpc("getTokenLargestAccounts", [mint, { commitment: "confirmed" }]);
    const accounts = largest?.value || [];

    const ownerResults = await Promise.all(
      accounts.map(async (account) => {
        try {
          const result = await rpc("getTokenAccountBalance", [account.address, { commitment: "confirmed" }]);
          return { ...account, balanceCheck: result?.value || null };
        } catch {
          return { ...account, balanceCheck: null };
        }
      })
    );

    const supply = await rpc("getTokenSupply", [mint, { commitment: "confirmed" }]);
    const supplyAmount = Number(supply?.value?.uiAmount || 0);
    const top10 = ownerResults.slice(0, 10).reduce((sum, x) => sum + Number(x.uiAmount || 0), 0);

    return Response.json({
      mint,
      source: "Solana mainnet RPC",
      sampleAccounts: ownerResults.length,
      supply: supply?.value || null,
      top10ShareOfTotalSupply: supplyAmount ? top10 / supplyAmount : null,
      accounts: ownerResults,
      limitations: [
        "This endpoint analyzes token accounts, not unique economic owners.",
        "A single owner can control multiple token accounts.",
        "Program, liquidity and treasury accounts require separate classification.",
      ],
      next: "Owner-resolution and transaction-cluster analysis should be layered on historical snapshots rather than inferred from one observation.",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: "On-chain intelligence unavailable", detail: String(error) }, { status: 502 });
  }
}
