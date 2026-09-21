// Single source of truth for chart colour + axis styling.
// Every Recharts surface in the app imports from here so the terminal reads as one product.
export const CHART = {
  ink: '#101a13',
  lime: '#b9ff66',
  limeSoft: '#d9ffb0',
  paper: '#f2f4ee',
  surface: '#ffffff',
  grid: '#dde3d4',
  axis: '#8b9484',
  axisLabel: '#48543f',
  primary: '#0e3b2c',
  success: '#0ea472',
  warning: '#d97706',
  danger: '#e14b4b',
  info: '#2f7fd1',
  purple: '#7c5cf0',
};

// Order used wherever a series needs an automatic colour.
export const SERIES = [CHART.primary, CHART.purple, CHART.warning, CHART.info, CHART.danger, CHART.success];

export const axisProps = {
  stroke: CHART.grid,
  tick: { fill: CHART.axis, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
  tickLine: false,
  axisLine: { stroke: CHART.grid },
};

export const gridProps = { strokeDasharray: '3 3', stroke: CHART.grid, vertical: false };

export const tickFormatNumber = (v) =>
  typeof v === 'number' ? (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)) : v;

// Convenience: format a metric pair for KPI readouts.
export const fmt = {
  num: (v, d = 2) => (v === null || v === undefined || v === '' ? '—' : Number(v).toFixed(d)),
  pct: (v, d = 2) => (v === null || v === undefined || v === '' ? '—' : `${Number(v).toFixed(d)}%`),
  signed: (v, d = 2) => {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    return `${n >= 0 ? '+' : ''}${n.toFixed(d)}`;
  },
  int: (v) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString()),
  date: (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : '—'),
  clock: (v) => {
    if (!v) return '—';
    const s = String(v);
    const t = s.includes(' ') ? s.split(' ')[1] : s;
    return t ? t.slice(0, 8) : s.slice(0, 8);
  },
};
