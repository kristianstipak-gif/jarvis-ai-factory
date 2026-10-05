const DEFAULT_RPCS = [
  "https://solana-rpc.publicnode.com",
  "https://solana.drpc.org",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getRpcUrls() {
  const urls = [];
  if (process.env.HELIUS_API_KEY) {
    urls.push("https://mainnet.helius-rpc.com/?api-key=" + encodeURIComponent(process.env.HELIUS_API_KEY));
  }
  if (process.env.SOLANA_RPC_URL) urls.push(process.env.SOLANA_RPC_URL);
  if (process.env.SOLANA_RPC_URL_2) urls.push(process.env.SOLANA_RPC_URL_2);
  return [...new Set([...urls, ...DEFAULT_RPCS])];
}

export function getRpcProvider(url) {
  if (url.includes("helius-rpc.com")) return "Helius";
  if (url.includes("publicnode.com")) return "PublicNode";
  if (url.includes("drpc.org")) return "dRPC";
  if (url.includes("ankr.com")) return "Ankr";
  if (url.includes("mainnet-beta.solana.com")) return "Solana";
  return "custom";
}

export async function rpc(method, params) {
  let lastError = null;
  const providers = getRpcUrls();

  for (const rpcUrl of providers) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
          cache: "no-store",
        });

        if (response.status === 429 || response.status === 503) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter)
            ? Math.min(retryAfter * 1000, 5000)
            : Math.min(500 * 2 ** attempt, 3000);
          lastError = new Error("Solana RPC HTTP " + response.status);
          await sleep(delay);
          continue;
        }

        if (!response.ok) {
          lastError = new Error("Solana RPC HTTP " + response.status);
          break;
        }

        const json = await response.json();
        if (json.error) {
          lastError = new Error(json.error.message || "Solana RPC error");
          break;
        }

        return { result: json.result, provider: getRpcProvider(rpcUrl) };
      } catch (error) {
        lastError = error;
        await sleep(Math.min(300 * 2 ** attempt, 2000));
      }
    }
  }

  throw lastError || new Error("All Solana RPC endpoints failed");
}
