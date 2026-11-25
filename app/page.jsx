"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function tier(s) { return s >= 80 ? "A" : s >= 65 ? "B" : s >= 50 ? "C" : "D"; }
const starterPrompts = [
  "Zkontroluj stav systému",
  "Skenuj trh a shrň nejlepší kandidáty",
  "Vysvětli mi, jak JARVIS hodnotí riziko"
];

export default function Home() {
  const [section, setSection] = useState("overview");
  const [min, setMin] = useState(0);
  const [data, setData] = useState([]);
  const [deepData, setDeepData] = useState([]);
  const [binanceData, setBinanceData] = useState([]);
  const [binanceError, setBinanceError] = useState("");
  const [tradingStatus, setTradingStatus] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deepLoading, setDeepLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiMode, setAiMode] = useState("checking");
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "JARVIS online. Můžeš se mě ptát nebo zadat podporovaný příkaz. Pro začátek můžu zkontrolovat stav systému nebo spustit výzkumný sken trhu."
  }]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [businessLeads, setBusinessLeads] = useState([]);
  const [leadName, setLeadName] = useState("");
  const [leadType, setLeadType] = useState("Levigo Design");
  const [leadContact, setLeadContact] = useState("");
  const [leadNote, setLeadNote] = useState("");
  const [leadFilter, setLeadFilter] = useState("Vše");
  const chatEnd = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jarvis-business-leads-v1");
      if (saved) setBusinessLeads(JSON.parse(saved));
      else setBusinessLeads([
        {id:"decin-arch-1",name:"Větrovec Architekt",type:"Levigo Design",contact:"+420 724 147 247",note:"Architektonické studio v Děčíně. Možný kontakt pro doporučení dekorativních povrchů do interiérů.",status:"K prověření"},
        {id:"decin-arch-2",name:"Architektonická kancelář Ing. arch. Stránský",type:"Levigo Design",contact:"+420 412 535 043",note:"Návrhy interiérů a rekonstrukce. Ověřit vhodnost spolupráce.",status:"K prověření"},
        {id:"decin-build-1",name:"STAVBY JOŽÁK s.r.o.",type:"NOBERON",contact:"+420 603 292 373",note:"Stavební firma v regionu Děčína. Prověřit možnost subdodávek nebo doporučení.",status:"K prověření"},
        {id:"decin-prop-1",name:"Stavební Bytové Družstvo Děčín",type:"NOBERON",contact:"+420 725 076 673",note:"Správa nemovitostí. Ověřit veřejné poptávky a postup registrace dodavatele.",status:"K prověření"},
        {id:"decin-prop-2",name:"TOMMI - SEVER, s.r.o.",type:"NOBERON",contact:"+420 412 535 197",note:"Správa nemovitostí v Děčíně. Prověřit vhodné veřejné zakázky a dodavatelskou spolupráci.",status:"K prověření"}
      ]);
    } catch { setBusinessLeads([]); }
  }, []);


  function addBusinessLead(e) {
    e.preventDefault();
    if (!leadName.trim()) return;
    setBusinessLeads((prev) => { const next=[{id:"lead-"+Date.now(),name:leadName.trim(),type:leadType,contact:leadContact.trim(),note:leadNote.trim(),status:"K prověření"},...prev]; try { localStorage.setItem("jarvis-business-leads-v1",JSON.stringify(next)); } catch {} return next; });
    setLeadName(""); setLeadContact(""); setLeadNote("");
  }

  function updateLeadStatus(id,status) {
    setBusinessLeads((prev) => { const next=prev.map((lead) => lead.id === id ? {...lead,status} : lead); try { localStorage.setItem("jarvis-business-leads-v1",JSON.stringify(next)); } catch {} return next; });
  }

  function exportLeads() {
    const header = ["Firma","Služba","Kontakt","Poznámka","Stav"];
    const lines = businessLeads.map((l) => [l.name,l.type,l.contact,l.note,l.status]);
    const csv = [header,...lines].map((row) => row.map((v) => '"'+String(v||"").replaceAll('"','""')+'"').join(";")).join("\\n");
    const blob = new Blob(["\\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="jarvis-obchodni-kontakty.csv"; a.click(); URL.revokeObjectURL(url);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/collector", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || "Tržní data nejsou dostupná.");
      setData((j.candidates || []).map((candidate) => ({
        ...candidate.snapshot,
        score: candidate.scoring?.score ?? 0,
        baseScore: candidate.scoring?.baseScore ?? 0,
        riskCount: candidate.scoring?.risk?.riskCount ?? 0,
        tier: candidate.scoring?.tier || tier(candidate.scoring?.score ?? 0),
      })));
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message || "Live feed unavailable");
    } finally {
      setLoading(false);
    }
  }


  async function loadSystemHealth() {
    setHealthLoading(true);
    try {
      const response = await fetch("/api/system/health", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Diagnostika není dostupná.");
      setSystemHealth(result);
    } catch (e) {
      setSystemHealth({ overall: "error", checks: [], error: e.message || "Diagnostika není dostupná." });
    } finally {
      setHealthLoading(false);
    }
  }

  async function loadTradingStatus() {
    try {
      const [marketResponse, statusResponse] = await Promise.all([
        fetch("/api/binance/market", { cache: "no-store" }),
        fetch("/api/trading/status", { cache: "no-store" })
      ]);
      const [marketJson, statusJson] = await Promise.all([marketResponse.json(), statusResponse.json()]);
      setBinanceData(marketJson.symbols || []);
      setBinanceError(marketResponse.ok ? "" : (marketJson.detail || marketJson.error || "Binance data unavailable"));
      setTradingStatus(statusJson);
    } catch (e) {
      setBinanceError(e.message || "Tržní data nejsou dostupná");
    }
  }

  async function deepScan() {
    setDeepLoading(true);
    setError("");
    try {
      const r = await fetch("/api/deep-scan", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || "Deep scan failed");
      setDeepData(j.candidates || []);
      setSection("intelligence");
    } catch (e) {
      setError(e.message || "Deep scan unavailable");
    } finally {
      setDeepLoading(false);
    }
  }

  async function sendMessage(value = draft) {
    const text = value.trim();
    if (!text || sending) return;
    setDraft("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const j = await r.json();
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: j.reply || j.error || "JARVIS nevrátil odpověď.",
        failed: !r.ok || j.ok === false,
        source: j.source
      }]);
      if (j.action === "strategy-scan" && j.data?.candidates) setDeepData(j.data.candidates);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Nepodařilo se spojit s API JARVIS. Zkontroluj připojení a zkus to znovu.",
        failed: true
      }]);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    load();
    loadTradingStatus();
    loadSystemHealth();
    const healthId = setInterval(loadSystemHealth, 60000);
    const id = setInterval(load, 60000);
    const marketId = setInterval(loadTradingStatus, 15000);
    fetch("/api/assistant").then((r) => r.json()).then((j) => setAiMode(j.mode || "unknown")).catch(() => setAiMode("offline"));
    return () => { clearInterval(id); clearInterval(marketId); clearInterval(healthId); };
  }, []);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, sending]);

  const rows = useMemo(
    () => [...data].sort((a, b) => b.score - a.score).filter((x) => x.score >= min),
    [data, min]
  );
  const bestScore = rows[0]?.score ?? 0;
  const totalLiquidity = data.reduce((sum, token) => sum + Number(token.liquidityUsd || 0), 0);
  const totalVolume = data.reduce((sum, token) => sum + Number(token.volume24h || 0), 0);

  const navItems = [
    ["overview", "⌂", "Přehled"],
    ["assistant", "✳", "JARVIS AI"],\n    ["business", "◎", "Obchodní engine"],
    ["market", "↗", "Tržní scanner"],
    ["intelligence", "◈", "Hloubková analýza"],
    ["method", "☷", "Jak JARVIS funguje"]
  ];

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">J</div><div><strong>JARVIS</strong><small>AI CONTROL CENTER</small></div></div>
      <div className="nav-label">HLAVNÍ NAVIGACE</div>
      <nav className="side-nav">
        {navItems.map(([id, icon, label]) => <button key={id} className={section === id ? "side-link active" : "side-link"} onClick={() => setSection(id)}><span className="nav-icon">{icon}</span>{label}{id === "assistant" && <i className="nav-dot" />}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="system-mini"><span className={loading ? "pulse amber" : "pulse"} /> <div><strong>{loading ? "Synchronizuji data" : "Panel je dostupný"}</strong><small>{aiMode === "ai-enabled" ? "AI API nakonfigurováno" : "AI režim: " + (aiMode === "checking" ? "ověřuji…" : "omezený")}</small></div></div>
        <a href="https://github.com/kristianstipak-gif/jarvis-ai-factory" target="_blank" rel="noreferrer">GitHub projektu ↗</a>
      </div>
    </aside>

    <section className="main-area">
      <header className="topbar">
        <div><div className="eyebrow">OSOBNÍ AI / VÝZKUMNÁ KONZOLE</div><h1>{navItems.find((n) => n[0] === section)?.[2] || "Přehled"}</h1></div>
        <div className="top-actions"><span className="connection"><i /> {loading ? "Připojuji" : "Systém dostupný"}</span><button className="icon-button" onClick={load} aria-label="Obnovit data" title="Obnovit data">↻</button></div>
      </header>

      {error && <div className="notice"><strong>Upozornění</strong><span>{error}</span><button onClick={() => setError("")}>×</button></div>}

      {section === "overview" && <div className="page-content">
        <section className="welcome-panel">
          <div className="welcome-copy"><span className="overline"><i className="pulse" /> JARVIS CORE / ONLINE PANEL</span><h2>Všechno důležité.<br /><em>Na jednom místě.</em></h2><p>Všechny důležité nástroje na jednom místě. Začni jednoduchým krokem a JARVIS tě provede dalšími možnostmi.</p><button className="primary-button" onClick={() => setSection("assistant")}>Otevřít JARVIS AI <span>→</span></button></div>
          <div className="orb-wrap"><div className="orb-ring ring-one" /><div className="orb-ring ring-two" /><div className="orb"><span>J</span><i /></div><div className="orb-caption">PERSONAL INTELLIGENCE<br /><b>READY WHEN YOU ARE</b></div></div>
        </section>
        <section className="quick-start panel" aria-labelledby="quick-start-title">
          <div className="quick-start-head">
            <div><span className="eyebrow">PRVNÍ KROKY</span><h3 id="quick-start-title">Začni s JARVISem za minutu</h3><p>Vyber si, co chceš udělat. Každá část má jasný účel a vysvětlení.</p></div>
            <span className="quick-start-count">01 / 03</span>
          </div>
          <div className="quick-start-grid">
            <button className="quick-start-card" onClick={() => setSection("assistant")}><span className="quick-start-icon">✳</span><span><strong>Promluv si s AI</strong><small>Zeptej se nebo napiš příkaz vlastními slovy.</small></span><b>→</b></button>
            <button className="quick-start-card" onClick={() => setSection("market")}><span className="quick-start-icon">↗</span><span><strong>Prozkoumej trh</strong><small>Prohlédni si kandidáty a jejich dostupná data.</small></span><b>→</b></button>
            <button className="quick-start-card" onClick={() => setSection("method")}><span className="quick-start-icon">ⓘ</span><span><strong>Poznej možnosti</strong><small>Zjisti, co JARVIS umí a jaká má omezení.</small></span><b>→</b></button>
          </div>
        </section>
        <div className="section-heading"><div><span className="eyebrow">SYSTÉMOVÝ PŘEHLED</span><h2>Stav a data</h2></div><span className="updated">{lastUpdated ? "Aktualizováno " + lastUpdated.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }) : "Čekám na data"}</span></div>
        <div className="stats-grid">
          <article className="stat-card"><div className="stat-top"><span>Tržní kandidáti</span><span className="stat-symbol">◈</span></div><strong>{loading ? "…" : data.length}</strong><small>Načtené položky z výzkumného feedu</small></article>
          <article className="stat-card"><div className="stat-top"><span>Nejvyšší skóre</span><span className="stat-symbol">↗</span></div><strong>{loading ? "…" : bestScore}<small className="unit"> / 100</small></strong><small>Skóre kandidáta, ne příslib výnosu</small></article>
          <article className="stat-card"><div className="stat-top"><span>Souhrnná likvidita</span><span className="stat-symbol">$</span></div><strong>{loading ? "…" : "$" + compact(totalLiquidity)}</strong><small>Součet dostupných párů ve feedu</small></article>
          <article className="stat-card"><div className="stat-top"><span>Objem za 24 h</span><span className="stat-symbol">⌁</span></div><strong>{loading ? "…" : "$" + compact(totalVolume)}</strong><small>Souhrnné tržní údaje</small></article>
        </div>
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-heading">
            <div><span className="eyebrow">JARVIS DOCTOR</span><h3>Systémová diagnostika</h3></div>
            <button className="text-button" onClick={loadSystemHealth} disabled={healthLoading}>{healthLoading ? "Kontroluji…" : "↻ Zkontrolovat"}</button>
          </div>
          {systemHealth?.error && <p className="section-desc">{systemHealth.error}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
            {(systemHealth?.checks || []).map((check) => <article className="method-card" key={check.id}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <strong>{check.label}</strong>
                <span style={{ color: check.status === "ok" ? "#16a36a" : check.status === "warning" ? "#c58a22" : "#d34d4d", fontWeight: 700, fontSize: 12 }}>
                  {check.status === "ok" ? "OK" : check.status === "warning" ? "POZOR" : "CHYBA"}
                </span>
              </div>
              <p>{check.detail}</p>
            </article>)}
            {!systemHealth && <p className="section-desc">Načítám stav tržního feedu, databáze, výzkumu a AI…</p>}
          </div>
          {systemHealth?.summary && <p className="section-desc" style={{ marginTop: 12 }}>
            Poslední kontrola: {new Date(systemHealth.checkedAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })} · Data: {systemHealth.summary.dataAgeMinutes == null ? "neznámé stáří" : Math.round(systemHealth.summary.dataAgeMinutes) + " min"} · Živé obchodování: vypnuto.
          </p>}
        </section>
        <div className="content-grid">
          <section className="panel"><div className="panel-heading"><div><span className="eyebrow">LIVE FEED</span><h3>Nejvýše hodnocení</h3></div><button className="text-button" onClick={() => setSection("market")}>Všechny položky →</button></div>
            {rows.slice(0, 5).map((t) => <div className="token-line" key={t.pair}><div className="token-avatar">{(t.symbol || "?").slice(0, 1)}</div><div className="token-name"><strong>{t.symbol}</strong><small>{t.name}</small></div><div className={"token-score s" + tier(t.score)}>{t.score}<small>/100</small></div><div className="token-change">{Number(t.priceChange24h || 0) > 0 ? "+" : ""}{Number(t.priceChange24h || 0).toFixed(1)}%</div></div>)}
            {!loading && !rows.length && <div className="empty-state">Zatím nejsou k dispozici žádní kandidáti. Zkus obnovit data.</div>}
          </section>
          <section className="panel assistant-promo"><div className="panel-heading"><div><span className="eyebrow">OSOBNÍ ASISTENT</span><h3>Promluv si s JARVISem</h3></div><span className="ai-badge">AI</span></div><div className="promo-avatar">J</div><p>Zeptej se na cokoliv, požádej o vysvětlení nebo spusť podporovaný výzkumný příkaz.</p><button className="secondary-button" onClick={() => setSection("assistant")}>Otevřít konverzaci <span>→</span></button><small className="muted">{aiMode === "ai-enabled" ? "AI služba nakonfigurována" : "Pro obecné AI odpovědi je nutné nastavit AI API klíč."}</small></section>
        </div>
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-heading"><div><span className="eyebrow">BINANCE SPOT / REFRESH 15 S</span><h3>Hlavní tržní páry</h3></div><button className="text-button" onClick={loadTradingStatus}>↻ Obnovit</button></div>
          {binanceError && <p className="section-desc">Feed: {binanceError}</p>}
          <div className="table-wrap"><table><thead><tr><th>Pár</th><th>Poslední cena</th><th>Změna 24 h</th><th>Objem 24 h</th></tr></thead><tbody>
            {binanceData.map((item) => <tr key={item.symbol}><td><strong>{item.symbol}</strong></td><td>{Number(item.price).toLocaleString("en-US",{maximumFractionDigits:8})}</td><td className={Number(item.priceChangePct24h)>=0?"positive":"negative"}>{Number(item.priceChangePct24h).toFixed(2)}%</td><td>{money(item.quoteVolume24h)}</td></tr>)}
          </tbody></table>{!binanceData.length && <div className="empty-state">Čekám na veřejná tržní data Binance.</div>}</div>
          <div className="safety-note"><span>ⓘ</span><p><strong>Obchodování je vypnuté.</strong> Živé obchodování je záměrně vypnuté. Chybějící položky jsou požadavky pro případný budoucí live režim, nikoli poruchy aktuálního výzkumného scanneru: {(tradingStatus?.missing || []).join(", ") || "žádné"}. Tato tabulka ukazuje REST snímky, nikoli tickový stream.</p></div>
        </section>
        <div className="safety-note"><span>ⓘ</span><p><strong>Režim výzkumu</strong> — JARVIS aktuálně analyzuje data a testuje strategie. Živé obchody nejsou povolené. Tržní skóre není finanční doporučení.</p></div>
      </div>}

      {section === "assistant" && <div className="page-content chat-page">
        <section className="chat-intro"><div className="assistant-avatar">J<span>✳</span></div><div><span className="eyebrow">JARVIS CORE / CHAT</span><h2>Jsem připraven.</h2><p>Piš přirozeně česky. Odpovím, pomůžu s plánem nebo spustím dostupný nástroj.</p></div></section>
        <section className="chat-window"><div className="chat-window-head"><div><span className="live-dot" /> <strong>JARVIS</strong><small> Osobní asistent</small></div><span className="chat-mode">{aiMode === "ai-enabled" ? "AI PŘIPOJENO" : "OMEZENÝ REŽIM"}</span></div>
          <div className="messages">{messages.map((m, i) => <div className={"message-row " + (m.role === "user" ? "from-user" : "")} key={i}><div className="message-avatar">{m.role === "user" ? "TY" : "J"}</div><div className={"message-bubble " + (m.failed ? "message-failed" : "")}><div className="message-author">{m.role === "user" ? "Ty" : "JARVIS"}</div><p>{m.content}</p></div></div>)}{sending && <div className="message-row"><div className="message-avatar">J</div><div className="message-bubble"><div className="message-author">JARVIS</div><p className="typing">Zpracovávám požadavek <i /><i /><i /></p></div></div>}<div ref={chatEnd} /></div>
          <div className="suggestions">{starterPrompts.map((p) => <button key={p} onClick={() => sendMessage(p)} disabled={sending}>{p}</button>)}</div>
          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Napiš JARVISovi zprávu…" rows={2} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} /><button type="submit" className="send-button" disabled={sending || !draft.trim()} aria-label="Odeslat zprávu">{sending ? "…" : "↑"}</button><small>Enter odešle · Shift + Enter nový řádek</small></form>
        </section>
        <div className="safety-note"><span>ⓘ</span><p>JARVIS může ovládat pouze nástroje, které jsou v aplikaci skutečně připojené. Příkazy pro obchodování, platby nebo změny účtů vyžadují samostatné zabezpečené propojení a potvrzení.</p></div>
      </div>}

      {section === "business" && <div className="page-content">
        <div className="section-heading"><div><span className="eyebrow">JARVIS MONEY ENGINE / CRM</span><h2>Obchodní příležitosti</h2><p className="section-desc">Evidence kontaktů, nabídek a dalších kroků. JARVIS zatím nic neposílá automaticky.</p></div><button className="secondary-button" onClick={exportLeads}>↓ Export CSV</button></div>
        <div className="stats-grid">
          <article className="stat-card"><div className="stat-top"><span>V evidenci</span><span className="stat-symbol">◎</span></div><strong>{businessLeads.length}</strong><small>Uložené kontakty v tomto prohlížeči</small></article>
          <article className="stat-card"><div className="stat-top"><span>K prověření</span><span className="stat-symbol">⌕</span></div><strong>{businessLeads.filter(x=>x.status==="K prověření").length}</strong><small>Je potřeba ověřit vhodnost spolupráce</small></article>
          <article className="stat-card"><div className="stat-top"><span>Kontaktováno</span><span className="stat-symbol">↗</span></div><strong>{businessLeads.filter(x=>x.status==="Kontaktováno").length}</strong><small>Kontakt musí proběhnout ručně</small></article>
          <article className="stat-card"><div className="stat-top"><span>Vyhrané zakázky</span><span className="stat-symbol">✓</span></div><strong>{businessLeads.filter(x=>x.status==="Vyhráno").length}</strong><small>Skutečně potvrzené zakázky</small></article>
        </div>
        <section className="panel" style={{marginTop:18}}>
          <div className="panel-heading"><div><span className="eyebrow">NOVÝ ZÁZNAM</span><h3>Přidat obchodní příležitost</h3></div></div>
          <form className="lead-form" onSubmit={addBusinessLead}>
            <label>Název firmy nebo kontakt<input value={leadName} onChange={e=>setLeadName(e.target.value)} placeholder="Např. architektonické studio" required /></label>
            <label>Naše služba<select value={leadType} onChange={e=>setLeadType(e.target.value)}><option>Levigo Design</option><option>NOBERON</option><option>JARVIS automatizace</option></select></label>
            <label>Telefon / kontakt<input value={leadContact} onChange={e=>setLeadContact(e.target.value)} placeholder="Telefon nebo vlastní poznámka" /></label>
            <label>Poznámka<textarea value={leadNote} onChange={e=>setLeadNote(e.target.value)} rows={2} placeholder="Proč je kontakt zajímavý a co ověřit…" /></label>
            <button className="primary-button" type="submit">+ Přidat do CRM</button>
          </form>
        </section>
        <section className="panel" style={{marginTop:18}}>
          <div className="panel-heading"><div><span className="eyebrow">PIPELINE</span><h3>Kontakty a další kroky</h3></div><select value={leadFilter} onChange={e=>setLeadFilter(e.target.value)}><option>Vše</option><option>K prověření</option><option>Kontaktováno</option><option>Jednání</option><option>Nabídka odeslána</option><option>Vyhráno</option><option>Uzavřeno</option></select></div>
          <div className="lead-list">{businessLeads.filter(l=>leadFilter==="Vše"||l.status===leadFilter).map(lead=><article className="lead-card" key={lead.id}>
            <div className="lead-card-top"><div><strong>{lead.name}</strong><small>{lead.type} · {lead.contact||"Kontakt zatím nedoplněn"}</small></div><select aria-label={"Stav "+lead.name} value={lead.status} onChange={e=>updateLeadStatus(lead.id,e.target.value)}><option>K prověření</option><option>Kontaktováno</option><option>Jednání</option><option>Nabídka odeslána</option><option>Vyhráno</option><option>Uzavřeno</option></select></div>
            <p>{lead.note||"Bez poznámky."}</p>
          </article>)}
          {!businessLeads.length&&<div className="empty-state">Zatím tu nejsou žádné kontakty. Přidej první příležitost.</div>}
          </div>
        </section>
        <div className="safety-note"><span>ⓘ</span><p><strong>Soukromé lokální CRM.</strong> Kontakty se ukládají pouze do úložiště tohoto prohlížeče a nejsou synchronizované mezi zařízeními. Před oslovením ověř správnost údajů, oprávnění ke kontaktování a obchodní relevanci. V ČR neposílej nevyžádané marketingové e-maily bez předchozího souhlasu.</p></div>
      </div>}

      {section === "market" && <div className="page-content"><div className="section-heading"><div><span className="eyebrow">SOLANA / MARKET DATA</span><h2>Tržní scanner</h2><p className="section-desc">Aktuálně dostupné kandidáty, likviditu a pohyb cen.</p></div><button className="secondary-button" onClick={load} disabled={loading}>{loading ? "Načítám…" : "↻ Obnovit"}</button></div>
        <section className="controls"><label>Minimální skóre <b>{min}</b></label><input type="range" min="0" max="90" value={min} onChange={(e) => setMin(+e.target.value)} /></section>
        <div className="table-wrap"><table><thead><tr><th>Token</th><th>Skóre</th><th>Likvidita</th><th>Objem 24 h</th><th>Transakce</th><th>Nákupy</th><th>Změna 24 h</th></tr></thead><tbody>{rows.map((t) => <tr key={t.pair}><td><strong>{t.symbol}</strong><small>{t.name} · {t.dex}</small></td><td><span className={"table-score s" + tier(t.score)}>{t.score}</span></td><td>{money(t.liquidityUsd)}</td><td>{money(t.volume24h)}</td><td>{t.txns24h ?? "—"}</td><td>{t.txns24h ? Math.round(t.buys24h / t.txns24h * 100) + "%" : "—"}</td><td className={Number(t.priceChange24h) >= 0 ? "positive" : "negative"}>{Number(t.priceChange24h || 0).toFixed(1)}%</td></tr>)}</tbody></table>{!loading && !rows.length && <div className="empty-state">Žádné položky pro vybraný filtr.</div>}</div>
      </div>}

      {section === "intelligence" && <div className="page-content"><div className="section-heading"><div><span className="eyebrow">ON-CHAIN / RISK ANALYSIS</span><h2>Deep intelligence</h2><p className="section-desc">Prohlédni si podrobnější on-chain signály a rizikové indikátory. Výsledky jsou analytické, ne investiční doporučení.</p></div><button className="primary-button" onClick={deepScan} disabled={deepLoading}>{deepLoading ? "Analyzuji…" : "Spustit deep scan →"}</button></div>
        {deepData.length ? <div className="table-wrap"><table><thead><tr><th>Token / adresa</th><th>Skóre</th><th>Úroveň</th><th>Rizika</th><th>Koncentrace</th><th>Verdikt</th></tr></thead><tbody>{deepData.map((item) => { const i = item.intelligence || {}; const r = i.risk || {}; return <tr key={item.snapshot?.mint || item.snapshot?.pair}><td><strong>{item.snapshot?.mint?.slice(0, 10) || "Neznámý"}</strong><small>{item.snapshot?.pair || "—"}</small></td><td><span className={"table-score s" + tier(i.score || 0)}>{i.score ?? "—"}</span></td><td>{i.tier || "—"}</td><td>{r.riskCount ?? 0}</td><td>{r.concentration == null ? "—" : Math.round(r.concentration * 100) + "%"}</td><td>{i.explanation?.verdict || "—"}</td></tr>; })}</tbody></table></div> : <div className="empty-card"><div className="empty-icon">◈</div><h3>Ještě nemáme výsledky skenu</h3><p>Spusť analýzu a JARVIS načte dostupné on-chain rizikové signály.</p><button className="primary-button" onClick={deepScan} disabled={deepLoading}>{deepLoading ? "Probíhá analýza…" : "Spustit analýzu"}</button></div>}
      </div>}

      {section === "method" && <div className="page-content"><div className="section-heading"><div><span className="eyebrow">DOKUMENTACE / LIMITY</span><h2>Strategie a rizika</h2><p className="section-desc">Jednoduché vysvětlení jednotlivých částí, jejich možností a bezpečnostních omezení.</p></div></div><div className="method-grid">{[["01","Tržní data","Veřejné tržní feedy poskytují souhrnné údaje. Nejde o ticková data ani garantovanou rychlost."],["02","Skórování","Signály třídí kandidáty podle aktivity a dostupných rizikových metrik. Skóre není pravděpodobnost zisku."],["03","Deep intelligence","Podle dostupných endpointů prověřuje on-chain údaje a varovné indikátory."],["04","Paper trading","Strategie je potřeba ověřovat historicky a nanečisto včetně poplatků, skluzu a likvidity."],["05","AI asistent","Obecný chat vyžaduje konfiguraci AI API na serveru. Tajné klíče se nezadávají do chatu."],["06","Živé obchodování","V této verzi vypnuto. Není zde potvrzené bezpečné automatické podepisování a provádění obchodů."]].map(([n,t,d]) => <article className="method-card" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div></div>}

      <footer className="app-footer"><span>JARVIS CORE</span><span>Výzkumný režim · Nejde o finanční poradenství</span><span>{lastUpdated ? "Sync " + lastUpdated.toLocaleTimeString("cs-CZ", {hour:"2-digit",minute:"2-digit"}) : "Připraven"}</span></footer>
    </section>
  </main>;
}

function compact(value) {
  if (value >= 1e9) return (value / 1e9).toFixed(1) + "B";
  if (value >= 1e6) return (value / 1e6).toFixed(1) + "M";
  if (value >= 1e3) return (value / 1e3).toFixed(1) + "K";
  return Math.round(value).toLocaleString("cs-CZ");
}
function money(value) {
  const n = Number(value || 0);
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + Math.round(n).toLocaleString("en-US");
}
