export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const same = (a, b) => {
  if (!a || !b || typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && require("node:crypto").timingSafeEqual(x, y);
};

async function send(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 3900), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10000)
  });
  if (!r.ok) throw new Error("Telegram reply failed");
}

async function endpoint(path) {
  let base = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!base) throw new Error("Set NEXT_PUBLIC_APP_URL in Vercel");
  if (!base.startsWith("http")) base = "https://" + base;
  const r = await fetch(new URL(path, base), { cache: "no-store", signal: AbortSignal.timeout(15000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "App API returned HTTP " + r.status);
  return d;
}
const usd = v => Number.isFinite(Number(v)) ? "$" + Number(v).toFixed(2) : "n/a";

async function handle(cmd) {
  if (["/start", "/help"].includes(cmd)) return [
    "JARVIS CORE — Telegram",
    "/status — paper-trading status",
    "/market — top current market tokens",
    "/scan — research candidate scan",
    "/paper — simulated ledger",
    "/help — commands",
    "",
    "Real-money trading is disabled. Never send seed phrases or private keys."
  ].join("\n");

  if (cmd === "/market") {
    const d = await endpoint("/api/market");
    const list = (d.tokens || []).slice(0, 5);
    return ["JARVIS MARKET", "Updated: " + (d.updatedAt || "unknown"), ...list.map((t,i) =>
      `${i+1}. ${t.symbol}: ${usd(t.priceUsd)} | 24h vol ${usd(t.volume24h)} | liquidity ${usd(t.liquidityUsd)} | change ${Number(t.priceChange24h||0).toFixed(2)}%\n${t.url||""}`
    )].join("\n\n") || "No market tokens returned.";
  }

  if (cmd === "/scan") {
    const d = await endpoint("/api/auto-trader");
    if (!d.ok) return "Scan failed: " + (d.error || "unknown error");
    return [
      "JARVIS CANDIDATE SCAN (SIMULATION ONLY)",
      `Scanned: ${d.counts?.scanned ?? 0}`,
      `Paper candidates: ${d.counts?.paperBuyCandidates ?? 0}`,
      `No trade: ${d.counts?.noTrade ?? 0}`,
      "",
      ...(d.candidates || []).slice(0,5).map((t,i)=>`${i+1}. ${t.symbol||"?"} — ${t.decision||"unknown"}\n${t.url||""}`),
      "",
      "No real orders are placed."
    ].join("\n");
  }

  if (cmd === "/status" || cmd === "/paper") {
    const d = await endpoint("/api/paper-trader/status");
    if (!d.ok) return "Paper status unavailable: " + (d.error || "configuration missing");
    const l=d.ledger||{}, r=d.research||{}, m=d.marketData||{};
    return [
      "JARVIS PAPER STATUS",
      "Durable storage: " + (d.durableStorage ? "yes" : "no"),
      "Stored snapshots: " + (m.totalStoredSnapshots ?? "n/a"),
      "Open simulated positions: " + (l.openPositions ?? 0),
      "Closed simulated trades: " + (l.closedTrades ?? 0),
      "Realized simulated P/L: " + usd(l.realizedPnlUsd),
      "Win rate: " + (l.winRatePct == null ? "n/a" : l.winRatePct + "%"),
      "Research: " + (r.verdict || "unknown"),
      "New simulated entries allowed: " + (r.allowNewEntries ? "yes" : "no"),
      "Real trading: DISABLED"
    ].join("\n");
  }
  return "Unknown command. Send /help.";
}

export async function POST(request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const allowed = process.env.TELEGRAM_ALLOWED_USER_ID;
  if (!secret || !allowed || !process.env.TELEGRAM_BOT_TOKEN)
    return Response.json({ ok:false, error:"Telegram environment variables are missing" }, { status:503 });
  if (!same(request.headers.get("x-telegram-bot-api-secret-token") || "", secret))
    return Response.json({ ok:false }, { status:401 });

  let update;
  try { update = await request.json(); } catch { return Response.json({ ok:false }, { status:400 }); }
  const m = update?.message;
  if (!m?.text || String(m.from?.id) !== allowed || String(m.chat?.id) !== allowed)
    return Response.json({ ok:true });

  const cmd = m.text.trim().split(/\s+/)[0].split("@")[0].toLowerCase();
  try { await send(m.chat.id, await handle(cmd)); }
  catch (e) { try { await send(m.chat.id, "JARVIS error: " + String(e?.message || e).slice(0,250)); } catch {} }
  return Response.json({ ok:true });
}
