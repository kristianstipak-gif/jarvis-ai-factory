import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readCheck(request, path) {
  try {
    const response = await fetch(new URL(path, request.url), {
      cache: "no-store",
      signal: AbortSignal.timeout(18000),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: {}, error: error?.name === "TimeoutError" ? "timeout" : "unreachable" };
  }
}

export async function GET(request) {
  const [market, paper, assistant, trading] = await Promise.all([
    readCheck(request, "/api/market"),
    readCheck(request, "/api/paper-trader/status"),
    readCheck(request, "/api/assistant"),
    readCheck(request, "/api/trading/status"),
  ]);

  const marketCount = Array.isArray(market.data?.tokens) ? market.data.tokens.length : 0;
  const marketOk = market.ok && marketCount > 0;
  const storageOk = paper.ok && paper.data?.durableStorage === true;
  const marketFresh = paper.ok && paper.data?.marketData?.fresh === true;
  const researchPassed = paper.ok && paper.data?.research?.holdoutPassed === true;
  const aiEnabled = assistant.ok && assistant.data?.mode === "ai-enabled";
  const liveDisabled = trading.ok && trading.data?.liveExecutionEnabled === false && trading.data?.ordersAllowed === false;

  const checks = [
    {
      id: "market",
      label: "Tržní feed",
      status: marketOk ? "ok" : "error",
      detail: marketOk ? `Dostupných ${marketCount} kandidátů.` : "Tržní API nevrátilo použitelné kandidáty.",
    },
    {
      id: "storage",
      label: "Supabase úložiště",
      status: storageOk ? "ok" : paper.ok ? "warning" : "error",
      detail: storageOk ? `${paper.data.marketData?.totalStoredSnapshots ?? 0} uložených snímků.` : "Trvalé databázové úložiště není dostupné.",
    },
    {
      id: "freshness",
      label: "Aktuálnost dat",
      status: marketFresh ? "ok" : paper.ok ? "warning" : "error",
      detail: paper.ok ? (marketFresh ? "Data jsou aktuální." : paper.data.marketData?.warnings?.[0] || "Data jsou zastaralá.") : "Aktuálnost dat nelze ověřit.",
    },
    {
      id: "research",
      label: "Výzkumná strategie",
      status: researchPassed ? "ok" : paper.ok ? "warning" : "error",
      detail: paper.ok ? (paper.data.research?.verdict || "Výsledek validace není dostupný.") : "Výzkumnou validaci nelze načíst.",
    },
    {
      id: "assistant",
      label: "JARVIS AI",
      status: aiEnabled ? "ok" : assistant.ok ? "warning" : "error",
      detail: aiEnabled ? "AI model je nakonfigurován." : "Obecný AI chat čeká na OPENAI_API_KEY; systémové příkazy zůstávají dostupné.",
    },
    {
      id: "live-safety",
      label: "Bezpečnost obchodování",
      status: liveDisabled ? "ok" : "warning",
      detail: liveDisabled ? "Živé příkazy jsou bezpečně vypnuté." : "Nelze potvrdit, že živé obchodování zůstává vypnuté.",
    },
  ];

  const overall = checks.some((x) => x.status === "error")
    ? "error"
    : checks.some((x) => x.status === "warning")
      ? "warning"
      : "ok";

  return NextResponse.json({
    ok: overall !== "error",
    overall,
    checkedAt: new Date().toISOString(),
    checks,
    summary: {
      marketCandidates: marketCount,
      storedSnapshots: paper.data?.marketData?.totalStoredSnapshots ?? null,
      latestSnapshotAt: paper.data?.marketData?.latestSnapshotAt ?? null,
      dataAgeMinutes: paper.data?.marketData?.ageMinutes ?? null,
      holdoutPassed: paper.data?.research?.holdoutPassed ?? false,
      aiEnabled,
      liveTradingEnabled: trading.data?.liveExecutionEnabled ?? null,
    },
  }, { headers: { "cache-control": "no-store" } });
}
