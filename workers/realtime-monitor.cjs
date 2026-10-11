const http = require("node:http");

const BASE_URL = (process.env.JARVIS_BASE_URL || "https://jarvis-ai-factory.vercel.app").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
const POLL_MS = Math.max(5000, Number(process.env.POLL_INTERVAL_MS || 5000));
const MIN_ACTION_GAP_MS = Math.max(10000, Number(process.env.MIN_ACTION_GAP_MS || 30000));
const CHANGE_THRESHOLD_PCT = Math.max(0.01, Number(process.env.CHANGE_THRESHOLD_PCT || 0.15));
const PORT = Number(process.env.PORT || 10000);

const state = {
  startedAt: new Date().toISOString(),
  lastPollAt: null,
  lastActionAt: null,
  lastError: null,
  polls: 0,
  triggeredCycles: 0,
  lastTokenCount: 0,
  lastChangedCount: 0,
  pendingSignals: 0,
  mode: "polling-paper-only"
};
let previous = new Map();
let pending = new Map();
let running = false;
let pendingSignal = false;

function getKey(token) { return String(token.pair || token.address || token.mint || ""); }
function meaningfulChanges(tokens, oldMap, thresholdPct = CHANGE_THRESHOLD_PCT) {
  const changed = [];
  for (const token of tokens || []) {
    const key = getKey(token);
    const price = Number(token.priceUsd);
    if (!key || !(price > 0)) continue;
    const old = oldMap.get(key);
    if (!old) {
      changed.push({ key, reason: "new-pair", symbol: token.symbol || "?" });
      continue;
    }
    const pct = Math.abs(price / old.price - 1) * 100;
    if (pct >= thresholdPct) changed.push({ key, reason: "price-move", changePct: Number(pct.toFixed(4)), symbol: token.symbol || "?" });
  }
  return changed;
}
function remember(tokens) {
  const next = new Map();
  for (const token of tokens || []) {
    const key = getKey(token), price = Number(token.priceUsd);
    if (key && price > 0) next.set(key, { price, seenAt: Date.now() });
  }
  previous = next;
}
async function requestJson(path, options = {}) {
  const response = await fetch(BASE_URL + path, {
    ...options,
    headers: { accept: "application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(20000),
    cache: "no-store"
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(path + " returned non-JSON (HTTP " + response.status + ")"); }
  if (!response.ok || body.ok === false) throw new Error(path + " failed (HTTP " + response.status + "): " + (body.error || "unknown error"));
  return body;
}
async function cycle() {
  if (running) return;
  running = true;
  state.lastPollAt = new Date().toISOString();
  state.polls += 1;
  try {
    const market = await requestJson("/api/market");
    const tokens = Array.isArray(market.tokens) ? market.tokens : [];
    state.lastTokenCount = tokens.length;
    const changes = meaningfulChanges(tokens, previous);
    state.lastChangedCount = changes.length;
    const hadBaseline = previous.size > 0;
    remember(tokens);
    state.lastError = null;
    // Establish a baseline on startup; do not treat every initial token as a signal.
    if (hadBaseline && changes.length > 0) pendingSignal = true;
    const now = Date.now();
    if (pendingSignal &&
        (!state.lastActionAt || now - Date.parse(state.lastActionAt) >= MIN_ACTION_GAP_MS)) {
      // The paper-trader endpoint already collects and persists snapshots; avoid a duplicate collector call.
      const paper = await requestJson("/api/cron/paper-trader", {
        headers: { authorization: "Bearer " + SECRET }
      });
      state.lastActionAt = new Date().toISOString();
      state.triggeredCycles += 1;
      pendingSignal = false;
      console.log(JSON.stringify({
        event: "market-change-cycle", at: state.lastActionAt,
        changedCount: changes.length, examples: changes.slice(0, 5),
        paperMode: paper.mode || "paper-only",
        newPositions: paper.ledger?.openedThisRun || 0
      }));
    }
  } catch (error) {
    state.lastError = String(error && error.message || error);
    console.error(JSON.stringify({ event: "worker-error", at: new Date().toISOString(), error: state.lastError }));
  } finally {
    running = false;
  }
}

function startServer() {
  if (!SECRET) {
    console.error("Missing CRON_SECRET. Refusing to start without authenticated paper-trader access.");
    process.exit(1);
  }
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({
        ok: true, ...state, pollIntervalMs: POLL_MS,
        minActionGapMs: MIN_ACTION_GAP_MS, changeThresholdPct: CHANGE_THRESHOLD_PCT,
        previousPairsTracked: previous.size, strategyExecution: "paper-only"
      }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(JSON.stringify({ event: "worker-started", port: PORT, pollIntervalMs: POLL_MS, mode: state.mode }));
    void cycle();
    setInterval(() => void cycle(), POLL_MS);
  });
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));
}

module.exports = { meaningfulChanges, startServer };
if (require.main === module) startServer();
