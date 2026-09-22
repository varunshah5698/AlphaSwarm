// Single source of truth for navigation: grouped sections (sidebar) + page titles (topbar).
export const NAV = [
  {
    label: 'Overview',
    links: [{ to: '/dashboard', label: 'Dashboard', icon: 'grid', desc: 'Live alpha-mining overview' }],
  },
  {
    label: 'Alpha lab',
    links: [
      { to: '/pipeline', label: 'Pipeline', icon: 'flow', desc: 'Generate → critique → test → learn' },
      { to: '/strategies', label: 'Strategies', icon: 'layers', desc: 'Factor library, verdicts and status' },
      { to: '/backtest', label: 'Backtesting', icon: 'activity', desc: 'Formula engine + your own CSV' },
      { to: '/paper', label: 'Paper trading', icon: 'chart', desc: 'Forward track record vs buy-and-hold' },
      { to: '/analytics', label: 'Analytics', icon: 'gauge', desc: 'Risk, rolling Sharpe and radar' },
    ],
  },
  {
    label: 'Knowledge',
    links: [
      { to: '/research', label: 'Research', icon: 'library', desc: 'Papers and hypothesis intake' },
      { to: '/reports', label: 'Reports', icon: 'file', desc: 'Reproducible experiment history' },
    ],
  },
  {
    label: 'Operations',
    links: [
      { to: '/agents', label: 'Agents', icon: 'bot', desc: 'Writer, Judge, Backtest and more' },
      { to: '/logs', label: 'Logs', icon: 'list', desc: 'Trace of every swarm action' },
    ],
  },
  {
    label: 'Workspace',
    links: [
      { to: '/team', label: 'Team', icon: 'users', desc: 'Who builds the swarm' },
      { to: '/api-docs', label: 'API Docs', icon: 'plug', desc: 'REST reference and examples' },
      { to: '/settings', label: 'Settings', icon: 'gear', desc: 'Costs, benchmark and defaults' },
    ],
  },
];

export const ALL_LINKS = NAV.flatMap((g) => g.links);

export function findLink(pathname) {
  return (
    ALL_LINKS.find((l) => l.to === pathname) ||
    ALL_LINKS.filter((l) => pathname.startsWith(l.to)).sort((a, b) => b.to.length - a.to.length)[0] ||
    null
  );
}

// Which nav group a path belongs to — used for the topbar breadcrumb.
export function findGroup(pathname) {
  return NAV.find((g) => g.links.some((l) => pathname.startsWith(l.to))) || null;
}
