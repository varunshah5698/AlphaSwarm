const BASE = "";
const TOKEN_KEY = "as_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

function parseError(res, txt) {
  try {
    const j = JSON.parse(txt);
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) return j.detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
    if (j.message) return j.message;
  } catch {}
  return txt || `Request failed (${res.status})`;
}

async function req(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(BASE + path, { ...opts, headers });
  if (res.status === 204) return { ok: true };
  const txt = await res.text();
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    // session dead everywhere else -> force re-login once
    setToken(null);
    localStorage.removeItem("as_user");
    if (!window.location.pathname.startsWith("/login")) {
      window.location.assign("/login?session=expired");
    }
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) throw new Error(parseError(res, txt));
  try {
    return txt ? JSON.parse(txt) : { ok: true };
  } catch {
    return { ok: true };
  }
}

export const api = {
  health: () => req("/api/health"),
  publicStats: () => req("/api/public/stats"),
  // auth
  register: (body) => req("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => req("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => req("/api/auth/me"),
  logout: () => req("/api/auth/logout", { method: "POST" }),
  // app
  metrics: () => req("/api/dashboard/metrics"),
  strategies: (status = "all", q = "") =>
    req(`/api/strategies?status=${status}&q=${encodeURIComponent(q)}`),
  strategy: (id) => req(`/api/strategies/${id}`),
  createStrategy: (body) => req("/api/strategies", { method: "POST", body: JSON.stringify(body) }),
  patchStrategy: (id, body) => req(`/api/strategies/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteStrategy: (id) => req(`/api/strategies/${id}`, { method: "DELETE" }),
  runPipeline: (body) => req("/api/pipeline/run", { method: "POST", body: JSON.stringify(body) }),
  backtest: (body) => req("/api/backtest", { method: "POST", body: JSON.stringify(body) }),
  backtestCsv: async (file, { formula, costs_bps, slippage_bps }) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("formula", formula);
    fd.append("costs_bps", String(costs_bps));
    fd.append("slippage_bps", String(slippage_bps));
    const headers = {};
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch("/api/backtest/csv", { method: "POST", headers, body: fd });
    const txt = await res.text();
    if (res.status === 401) {
      setToken(null);
      localStorage.removeItem("as_user");
      window.location.assign("/login?session=expired");
      throw new Error("Session expired. Please sign in again.");
    }
    if (!res.ok) throw new Error(parseError(res, txt));
    return JSON.parse(txt);
  },
  experiments: () => req("/api/experiments"),
  agents: () => req("/api/agents"),
  logs: () => req("/api/logs?limit=100"),
  papers: () => req("/api/papers"),
  patchPaper: (id, body) => req(`/api/papers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  marketEquity: () => req("/api/market/equity"),
  marketLive: (symbols = "SPY,AAPL,MSFT,TSLA,NVDA") => req(`/api/market/live?symbols=${encodeURIComponent(symbols)}`),
  marketCandles: (symbol = "SPY", years = 2) => req(`/api/market/candles?symbol=${encodeURIComponent(symbol)}&years=${years}`),
  backtestLive: (body) => req("/api/backtest/live", { method: "POST", body: JSON.stringify(body) }),
  testAll: (body) => req("/api/strategies/test-all", { method: "POST", body: JSON.stringify(body) }),
  dashboardCharts: () => req("/api/dashboard/charts"),
  analytics: (period = "1Y") => req(`/api/analytics?period=${period}`),
};
