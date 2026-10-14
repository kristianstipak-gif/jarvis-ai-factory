import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `Jsi JARVIS, osobní digitální asistent v češtině. Odpovídej přímo, jasně a pravdivě. Rozlišuj ověřená data, odhady a neznámé informace. Umíš vysvětlit a shrnout stav tohoto webového panelu a dostupná tržní data. Nemáš automaticky přístup k telefonu, účtům, souborům, Telegramu ani libovolným externím systémům. Nikdy netvrď, že jsi něco provedl, pokud to nástroj skutečně nepotvrdil. Neprováděj ani neslibuj živé kryptoměnové obchody; současný projekt je výzkumný a paper-trading. Nikdy nežádej uživatele, aby poslal tajné klíče do chatu.`;

async function readJson(request, path) {
  const url = new URL(path, request.url);
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || "Zdroj dat není dostupný");
  return data;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    assistant: "JARVIS",
    mode: process.env.OPENAI_API_KEY ? "ai-enabled" : "local-fallback",
    capabilities: ["chat", "market-summary", "strategy-scan", "system-status"],
    liveTrading: false,
    note: process.env.OPENAI_API_KEY ? "AI klíč je nastaven." : "Pro obecné AI odpovědi je třeba bezpečně nastavit OPENAI_API_KEY ve Vercel Environment Variables."
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const message = String(body?.message || "").trim().slice(0, 6000);
    if (!message) return NextResponse.json({ error: "Napiš zprávu." }, { status: 400 });

    const normalized = message.toLocaleLowerCase("cs");
    if (/(stav systému|stav jarvis|system status|co funguje|diagnostik)/i.test(normalized)) {
      const [market, collector] = await Promise.allSettled([
        readJson(request, "/api/market"),
        readJson(request, "/api/collector")
      ]);
      const marketData = market.status === "fulfilled" ? market.value : null;
      const collectorData = collector.status === "fulfilled" ? collector.value : null;
      const candidates = collectorData?.candidates?.length ?? marketData?.tokens?.length ?? 0;
      return NextResponse.json({
        ok: true,
        source: "local-system-check",
        reply: [
          "JARVIS – rychlá kontrola systému",
          "Webové rozhraní: dostupné.",
          "Tržní API: " + (marketData ? "odpovídá" : "nedostupné"),
          "Počet aktuálně načtených tržních položek: " + candidates + ".",
          "AI chat: " + (process.env.OPENAI_API_KEY ? "API klíč je nakonfigurován" : "není nakonfigurován OPENAI_API_KEY, obecné AI odpovědi jsou vypnuté") + ".",
          "Živé obchodování: vypnuté; tato aplikace slouží k výzkumu a paper tradingu."
        ].join("\n")
      });
    }

    if (/(skenuj|sken trhu|strategy scan|strategie|paper trading|signály|signály trhu)/i.test(normalized)) {
      try {
        const scan = await readJson(request, "/api/strategy-lab");
        const shortlist = (scan.candidates || []).slice(0, 8).map((x) =>
          `${x.symbol || x.name || "Token"} — ${x.signal || "bez signálu"}; skóre ${x.score ?? "—"}; likvidita $${Math.round(Number(x.liquidityUsd || 0)).toLocaleString("en-US")}`
        );
        return NextResponse.json({
          ok: true,
          source: "strategy-lab",
          reply: [
            "JARVIS – výzkumný sken dokončen.",
            `Zkontrolováno: ${scan.counts?.scanned ?? (scan.candidates || []).length} tokenů.`,
            `Kandidáti k dalšímu paper testu: ${scan.counts?.watchForPaperTrade ?? "—"}; bez obchodu: ${scan.counts?.noTrade ?? "—"}.`,
            ...shortlist,
            "Jde o výzkumné signály ze souhrnných dat, ne o pokyn k nákupu ani záruku zisku."
          ].join("\n"),
          action: "strategy-scan",
          data: scan
        });
      } catch (error) {
        return NextResponse.json({ ok: false, reply: "Sken se nepodařilo dokončit: " + error.message });
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        ok: false,
        code: "AI_KEY_MISSING",
        reply: "Rozumím. Web a některé systémové příkazy fungují, ale obecný AI chat zatím nemá připojený jazykový model. Ve Vercel projektu jarvis-ai-factory nastav v Settings → Environment Variables proměnnou OPENAI_API_KEY (tajný klíč nikdy neposílej do chatu), potom znovu nasaď aplikaci. Do té doby mohu provést příkaz „stav systému“ nebo „skenuj trh“."
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.JARVIS_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: message }
        ]
      }),
      signal: AbortSignal.timeout(25000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        reply: response.status === 401
          ? "AI služba odmítla klíč. Zkontroluj OPENAI_API_KEY ve Vercel Environment Variables."
          : "AI služba vrátila chybu (" + response.status + "). Zkontroluj nastavení AI klíče a dostupnost účtu."
      }, { status: 502 });
    }
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) return NextResponse.json({ ok: false, reply: "AI nevrátila odpověď. Zkus to znovu." }, { status: 502 });
    return NextResponse.json({ ok: true, reply, source: "openai" });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      reply: "JARVIS narazil na chybu při zpracování požadavku. " + (error?.name === "TimeoutError" ? "Požadavek vypršel, zkus to znovu." : "Zkus to prosím znovu.")
    }, { status: 500 });
  }
}
