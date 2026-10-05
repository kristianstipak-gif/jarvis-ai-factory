"use client";

import { useEffect, useMemo, useState } from "react";

function tier(s) { return s >= 80 ? "A" : s >= 65 ? "B" : s >= 50 ? "C" : "D"; }

export default function Home() {
  const [min, setMin] = useState(0);
  const [mode, setMode] = useState("candidates");
  const [data, setData] = useState([]);
  const [deepData, setDeepData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deepLoading, setDeepLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/market", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "API error");
      setData(j.tokens || []);
    } catch (e) { setError(e.message || "Live feed unavailable"); }
    finally { setLoading(false); }
  }

  async function deepScan() {
    setDeepLoading(true); setError("");
    try {
      const r = await fetch("/api/deep-scan", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || "Deep scan failed");
      setDeepData(j.candidates || []);
      setMode("intelligence");
    } catch (e) { setError(e.message || "Deep scan unavailable"); }
    finally { setDeepLoading(false); }
  }

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, []);

  const rows = useMemo(() => data.map((x) => {
    const velocity = Math.min(1, (x.volume24h / Math.max(x.liquidityUsd, 1)) / 3);
    const flow = x.txns24h ? Math.min(1, x.buys24h / x.txns24h) : 0;
    const activity = Math.min(1, x.txns24h / 500);
    const liq = Math.min(1, x.liquidityUsd / 100000);
    const change = Math.max(0, Math.min(1, (x.priceChange24h + 20) / 80));
    const score = Math.round(100 * (.30 * velocity + .20 * flow + .20 * activity + .15 * liq + .15 * change));
    return { ...x, score };
  }).sort((a, b) => b.score - a.score).filter((x) => x.score >= min), [data, min]);

  return <main className="shell">
    <header><div><div className="eyebrow">JARVIS AI FACTORY / MEME LAB</div><h1>Research before launch.</h1><p className="sub">Live Solana discovery, on-chain intelligence and explainable risk scoring.</p></div><div className="status">● {loading ? "SYNCING" : "LIVE DATA"}</div></header>
    <section className="hero"><div><span className="pill">LIVE MARKET FEED</span><h2>Scan first. Enrich second. Validate with history.</h2><p>JARVIS separates market discovery from deeper on-chain analysis. Scores are research signals, not profit guarantees.</p></div><div className="bigscore"><span>TOP LIVE</span><strong>{mode === "intelligence" ? (deepData[0]?.intelligence?.score ?? "—") : (rows[0]?.score ?? "—")}</strong><small>/ 100</small></div></section>
    {error && <div className="warning">System message: {error}</div>}
    <nav><button className={mode === "candidates" ? "active" : ""} onClick={() => setMode("candidates")}>Live candidates</button><button className={mode === "intelligence" ? "active" : ""} onClick={() => setMode("intelligence")}>Deep intelligence</button><button className={mode === "method" ? "active" : ""} onClick={() => setMode("method")}>Scoring</button><button onClick={deepScan} disabled={deepLoading}>{deepLoading ? "Scanning…" : "Run deep scan"}</button><button onClick={load}>Refresh</button></nav>
    {mode === "candidates" && <><section className="controls"><label>Minimum score <b>{min}</b></label><input type="range" min="0" max="90" value={min} onChange={(e) => setMin(+e.target.value)} /></section><section className="table"><div className="thead"><span>Token</span><span>Score</span><span>Liquidity</span><span>Vol 24h</span><span>Txns</span><span>Buy</span><span>24h</span></div>{rows.map((t) => <div className="row" key={t.pair}><span><b>{t.symbol}</b><small>{t.name} · {t.dex}</small></span><span className={"score s" + tier(t.score)}>{t.score}</span><span>{"$" + Math.round(t.liquidityUsd / 1000) + "k"}</span><span>{"$" + Math.round(t.volume24h / 1000) + "k"}</span><span>{t.txns24h}</span><span>{t.txns24h ? Math.round(t.buys24h / t.txns24h * 100) : 0}%</span><span>{Number(t.priceChange24h || 0).toFixed(1)}%</span></div>)}</section></>}
    {mode === "intelligence" && <section className="table"><div className="thead"><span>Token</span><span>Score</span><span>Tier</span><span>Risk</span><span>Concentration</span><span>Velocity</span><span>Verdict</span></div>{deepData.map((item) => { const i=item.intelligence||{}; const r=i.risk||{}; const e=i.explanation||{}; return <div className="row" key={item.snapshot?.mint || item.snapshot?.pair}><span><b>{item.snapshot?.mint?.slice(0,8) || "unknown"}</b><small>{item.snapshot?.pair || "—"}</small></span><span className={"score s" + tier(i.score)}>{i.score ?? "—"}</span><span>{i.tier || "—"}</span><span>{r.riskCount ?? 0}</span><span>{r.concentration == null ? "—" : Math.round(r.concentration * 100) + "%"}</span><span>{r.volumeLiquidity == null ? "—" : r.volumeLiquidity.toFixed(2) + "×"}</span><span>{e.verdict || "—"}</span></div>})}</section>}
    {mode === "method" && <section className="cards">{[["Market layer","LIVE","Volume/liquidity, buy flow, activity, liquidity and price trend."],["On-chain layer","CORE","Token-account owners, concentration and wallet signals."],["Creator layer","CORE","Mint/freeze authority and creator-wallet signals."],["Risk layer","CORE","Risk rules reduce the score when structural warning signals appear."],["Validation","BACKTEST","1h / 6h / 24h forward outcomes and chronological testing."],["Research rule","SAFE","Signals indicate risk; they do not prove manipulation or guarantee returns."]].map(([a,b,c]) => <article key={a}><span>{b}</span><h3>{a}</h3><p>{c}</p></article>)}</section>}
    <footer>JARVIS MEME LAB · LIVE MARKET RESEARCH · Not financial advice</footer>
  </main>;
}