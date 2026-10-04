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
    const [largest, signatures] = await Promise.all([
      rpc("getTokenLargestAccounts", [address, { commitment: "confirmed" }]),
      rpc("getSignaturesForAddress", [address, { commitment: "confirmed", limit: 50 }]),
    ]);

    const holders = largest?.value || [];
    const total = holders.reduce((sum, h) => sum + Number(h.uiAmount || 0), 0);
    const top10 = holders.slice(0, 10).reduce((sum, h) => sum + Number(h.uiAmount || 0), 0);
    const concentration = total > 0 ? top10 / total : null;

    return Response.json({
      address,
      source: "Solana mainnet RPC",
      holderAccountsSample: holders.length,
      top20: holders,
      top10ShareOfTop20Sample: concentration,
      recentSignatureCount: signatures?.length || 0,
      recentSignatures: (signatures || []).slice(0, 20).map((x) => ({
        signature: x.signature,
        slot: x.slot,
        blockTime: x.blockTime,
        status: x.err ? "failed" : "ok",
      })),
      note: "This is an initial on-chain risk signal. getTokenLargestAccounts returns the 20 largest token accounts, so concentration here is not the same as total-wallet concentration.",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: "Token analysis unavailable", detail: String(error) }, { status: 502 });
  }
}
