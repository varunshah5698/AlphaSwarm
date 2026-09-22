import { create } from 'zustand';
import { api, getToken, setToken } from '../lib/api';

const fallbackStrategies = [
  { id: 1, name: 'Momentum Reversion Alpha', formula: 'rank(close / delay(close, 20) - 1) * -1', status: 'active', sharpe: 1.82, returns: 24.5, max_dd: -8.3, maxDD: -8.3, win_rate: 62.4, winRate: 62.4, trades: 1847, author: 'Writer Agent', created_at: '2026-08-15' },
  { id: 2, name: 'Volatility Breakout', formula: 'rank(std(close, 10) / std(close, 30)) * sign(close - delay(close, 1))', status: 'active', sharpe: 1.45, returns: 18.2, max_dd: -12.1, maxDD: -12.1, win_rate: 58.7, winRate: 58.7, trades: 2103, author: 'Writer Agent', created_at: '2026-08-18' },
  { id: 3, name: 'Volume Price Divergence', formula: 'correlation(volume, close, 20) * rank(close - delay(close, 5))', status: 'testing', sharpe: 1.21, returns: 15.8, max_dd: -15.4, maxDD: -15.4, win_rate: 55.2, winRate: 55.2, trades: 1654, author: 'Writer Agent', created_at: '2026-08-20' },
];

function norm(s) {
  return {
    ...s,
    maxDD: s.max_dd ?? s.maxDD ?? 0,
    winRate: s.win_rate ?? s.winRate ?? 0,
    createdAt: s.created_at ?? s.createdAt ?? '',
  };
}

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem('as_user') || 'null');
  } catch {
    return null;
  }
}

export const useStore = create((set, get) => ({
  user: storedUser(),
  isAuthenticated: !!(getToken() && storedUser()),
  authLoading: false,
  authError: null,
  authBooted: false,

  bootstrap: async () => {
    if (!getToken()) {
      set({ user: null, isAuthenticated: false, authBooted: true });
      return;
    }
    try {
      const r = await api.me();
      localStorage.setItem('as_user', JSON.stringify(r.user));
      set({ user: r.user, isAuthenticated: true, authBooted: true });
    } catch {
      setToken(null);
      localStorage.removeItem('as_user');
      set({ user: null, isAuthenticated: false, authBooted: true });
    }
  },

  login: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const r = await api.login({ email: email.trim().toLowerCase(), password });
      setToken(r.token);
      localStorage.setItem('as_user', JSON.stringify(r.user));
      set({ user: r.user, isAuthenticated: true, authLoading: false });
      return r.user;
    } catch (e) {
      set({ authLoading: false, authError: e.message });
      throw e;
    }
  },

  register: async (username, email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const r = await api.register({ username: username.trim(), email: email.trim().toLowerCase(), password });
      set({ authLoading: false });
      return r;
    } catch (e) {
      set({ authLoading: false, authError: e.message });
      throw e;
    }
  },

  logout: async () => {
    try {
      if (getToken()) await api.logout();
    } catch {}
    setToken(null);
    localStorage.removeItem('as_user');
    set({ user: null, isAuthenticated: false });
  },

  strategies: [], metrics: null, agents: [], logs: [], papers: [], experiments: [],
  loading: false, backendOk: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const [strats, metrics, agents, logs, papers, exps] = await Promise.all([
        api.strategies(), api.metrics().catch(() => null),
        api.agents().catch(() => []), api.logs().catch(() => []),
        api.papers().catch(() => []), api.experiments().catch(() => []),
      ]);
      set({
        strategies: strats.map(norm), metrics, agents, logs,
        papers, experiments: exps, backendOk: true, loading: false,
      });
    } catch {
      set({ strategies: fallbackStrategies, backendOk: false, loading: false });
    }
  },

  addStrategy: async (s) => {
    try {
      await api.createStrategy({ name: s.name, hypothesis: s.description || '', formula: s.formula, author: 'User' });
      await get().refresh();
    } catch {
      set((st) => ({ strategies: [...st.strategies, { ...s, id: Date.now() }] }));
    }
  },
  updateStrategy: async (id, data) => {
    try { await api.patchStrategy(id, data); } catch {}
    set((st) => ({ strategies: st.strategies.map(s => s.id === id ? { ...s, ...data } : s) }));
  },
  deleteStrategy: async (id) => {
    try { await api.deleteStrategy(id); } catch {}
    set((st) => ({ strategies: st.strategies.filter(s => s.id !== id) }));
  },

  runPipeline: async (hypothesis, costs_bps = 10, slippage_bps = 5, symbol = "", risk = {}) => {
    const out = await api.runPipeline({ hypothesis, costs_bps, slippage_bps, symbol, ...risk });
    await get().refresh();
    return out;
  },

  sidebarOpen: true,
  toggleSidebar: () => set((st) => ({ sidebarOpen: !st.sidebarOpen })),
  setSidebar: (open) => set({ sidebarOpen: !!open }),
  paletteOpen: false,
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  settings: (() => {
    try {
      const s = JSON.parse(localStorage.getItem('as_settings') || 'null');
      if (s && typeof s === 'object') {
        return { transactionCost: 10, slippage: 5, backtestPeriod: '2014-2024', benchmark: 'SPY', riskFreeRate: 4.5, ...s };
      }
    } catch {}
    return { transactionCost: 10, slippage: 5, backtestPeriod: '2014-2024', benchmark: 'SPY', riskFreeRate: 4.5 };
  })(),
  updateSettings: (s) => {
    set((st) => {
      const next = { ...st.settings, ...s };
      try {
        localStorage.setItem('as_settings', JSON.stringify(next));
      } catch {}
      return { settings: next };
    });
  },
  pipelineRunning: false,
  startPipeline: () => set({ pipelineRunning: true }),
  stopPipeline: () => set({ pipelineRunning: false }),
}));
