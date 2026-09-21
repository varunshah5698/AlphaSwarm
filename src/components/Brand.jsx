// Shared brand mark + stroke icons (no emoji — crisp at every size).
export function Logo({ size = 36, lime = true }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size * 0.28,
        background: lime ? 'var(--pv-lime)' : 'var(--pv-ink)',
        color: lime ? 'var(--pv-ink)' : 'var(--pv-lime)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: size * 0.5, fontFamily: 'var(--font-display)',
        border: '1.5px solid var(--pv-ink)', boxShadow: '3px 3px 0 #101a13',
        flexShrink: 0,
      }}
    >
      α
    </div>
  );
}

const base = (p) => ({
  width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true, focusable: 'false',
  ...p,
});

export const Icon = {
  flask: (p) => (
    <svg {...base(p)}><path d="M9 3h6" /><path d="M10 3v5.5L4.8 17a2 2 0 0 0 1.8 2.9h10.8a2 2 0 0 0 1.8-2.9L14 8.5V3" /><path d="M7.5 13h9" /></svg>
  ),
  shield: (p) => (
    <svg {...base(p)}><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" /><path d="M9.5 12l2 2 3.5-4" /></svg>
  ),
  chart: (p) => (
    <svg {...base(p)}><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 14l4-4 3 3 5-6" /></svg>
  ),
  terminal: (p) => (
    <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3" /><path d="M12 15h5" /></svg>
  ),
  check: (p) => (
    <svg {...base(p)}><path d="M4 12.5l5 5L20 6.5" /></svg>
  ),
  arrow: (p) => (
    <svg {...base(p)}><path d="M4 12h15" /><path d="M13 6l6 6-6 6" /></svg>
  ),
  bolt: (p) => (
    <svg {...base(p)}><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></svg>
  ),
  book: (p) => (
    <svg {...base(p)}><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2" /><path d="M4 19a2 2 0 0 0 2 2h13" /></svg>
  ),
  layers: (p) => (
    <svg {...base(p)}><path d="M12 3l8.5 4.5L12 12 3.5 7.5z" /><path d="M3.5 12.5L12 17l8.5-4.5" /><path d="M3.5 16.8L12 21.3l8.5-4.5" /></svg>
  ),
  flow: (p) => (
    <svg {...base(p)}><rect x="3" y="3" width="6.5" height="6.5" rx="1.8" /><rect x="14.5" y="14.5" width="6.5" height="6.5" rx="1.8" /><path d="M9.5 6.2h4.3a3.5 3.5 0 0 1 3.5 3.5v4.8" /></svg>
  ),
  activity: (p) => (
    <svg {...base(p)}><path d="M3 12h4l3 7.5L14 4.5 17 12h4" /></svg>
  ),
  gauge: (p) => (
    <svg {...base(p)}><path d="M4 19a9 9 0 1 1 16 0" /><path d="M12 13.5l4.5-3.5" /><circle cx="12" cy="15" r="1.6" /></svg>
  ),
  bot: (p) => (
    <svg {...base(p)}><rect x="3.5" y="8" width="17" height="12" rx="3.2" /><path d="M12 8V5" /><circle cx="12" cy="3.6" r="1.4" /><circle cx="9" cy="13.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="13.5" r="1.1" fill="currentColor" stroke="none" /><path d="M9.5 17.2h5" /></svg>
  ),
  library: (p) => (
    <svg {...base(p)}><path d="M3.5 4.5h3.6v15H3.5z" /><path d="M9.2 4.5h3.6v15H9.2z" /><path d="M15.6 5.2l3.6 1v13.6l-3.6-1z" /></svg>
  ),
  file: (p) => (
    <svg {...base(p)}><path d="M14 3H7.5A2 2 0 0 0 5.5 5v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13.5h6" /><path d="M9 17h4" /></svg>
  ),
  list: (p) => (
    <svg {...base(p)}><path d="M8.5 6h12" /><path d="M8.5 12h12" /><path d="M8.5 18h12" /><circle cx="3.8" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.8" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.8" cy="18" r="1.2" fill="currentColor" stroke="none" /></svg>
  ),
  users: (p) => (
    <svg {...base(p)}><circle cx="9.2" cy="8" r="3.3" /><path d="M3 20a6.2 6.2 0 0 1 12.4 0" /><path d="M16.2 5.2a3.3 3.3 0 0 1 0 5.9" /><path d="M18.4 20a6.2 6.2 0 0 0-2-4.6" /></svg>
  ),
  plug: (p) => (
    <svg {...base(p)}><path d="M9 3v6" /><path d="M15 3v6" /><path d="M6 9h12v2.8a6 6 0 0 1-12 0z" /><path d="M12 17.8V21" /></svg>
  ),
  gear: (p) => (
    <svg {...base(p)}><circle cx="12" cy="12" r="3.1" /><path d="M12 2.6v2.8M12 18.6v2.8M4.1 7.3l2.4 1.4M17.5 15.3l2.4 1.4M4.1 16.7l2.4-1.4M17.5 8.7l2.4-1.4" /></svg>
  ),
  database: (p) => (
    <svg {...base(p)}><ellipse cx="12" cy="6" rx="8" ry="3.1" /><path d="M4 6v12c0 1.7 3.6 3.1 8 3.1s8-1.4 8-3.1V6" /><path d="M4 12c0 1.7 3.6 3.1 8 3.1s8-1.4 8-3.1" /></svg>
  ),
  cpu: (p) => (
    <svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="2.4" /><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3" /></svg>
  ),
  grid: (p) => (
    <svg {...base(p)}><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" /></svg>
  ),
  search: (p) => (
    <svg {...base(p)}><circle cx="11" cy="11" r="6.6" /><path d="M15.8 15.8L20.5 20.5" /></svg>
  ),
  refresh: (p) => (
    <svg {...base(p)}><path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3l2.2 2.1" /><path d="M19.5 4.4v4.6h-4.6" /><path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3l-2.2-2.1" /><path d="M4.5 19.6v-4.6h4.6" /></svg>
  ),
  globe: (p) => (
    <svg {...base(p)}><circle cx="12" cy="12" r="8.8" /><path d="M3.2 12h17.6" /><path d="M12 3.2a13.5 13.5 0 0 1 0 17.6" /><path d="M12 3.2a13.5 13.5 0 0 0 0 17.6" /></svg>
  ),
  logout: (p) => (
    <svg {...base(p)}><path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5" /><path d="M9.5 15.5L6 12l3.5-3.5" /><path d="M6 12h8.5" /></svg>
  ),
  chevron: (p) => (
    <svg {...base(p)}><path d="M9.5 5l7 7-7 7" /></svg>
  ),
  chevronLeft: (p) => (
    <svg {...base(p)}><path d="M14.5 5l-7 7 7 7" /></svg>
  ),
  close: (p) => (
    <svg {...base(p)}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
  ),
  menu: (p) => (
    <svg {...base(p)}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>
  ),
  plus: (p) => (
    <svg {...base(p)}><path d="M12 5.2v13.6" /><path d="M5.2 12h13.6" /></svg>
  ),
  trash: (p) => (
    <svg {...base(p)}><path d="M4 7h16" /><path d="M9.5 7V4.8h5V7" /><path d="M6.5 7l.9 13h9.2l.9-13" /><path d="M10.5 11v5.5" /><path d="M13.5 11v5.5" /></svg>
  ),
  play: (p) => (
    <svg {...base(p)}><path d="M7 4.6l12.5 7.4L7 19.4z" /></svg>
  ),
  upload: (p) => (
    <svg {...base(p)}><path d="M12 16.5V5" /><path d="M7 10l5-5 5 5" /><path d="M5 20h14" /></svg>
  ),
  download: (p) => (
    <svg {...base(p)}><path d="M12 4.5V16" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></svg>
  ),
  target: (p) => (
    <svg {...base(p)}><circle cx="12" cy="12" r="8.6" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
  ),
  clock: (p) => (
    <svg {...base(p)}><circle cx="12" cy="12" r="8.6" /><path d="M12 7.2V12l3.2 2.1" /></svg>
  ),
  sparkle: (p) => (
    <svg {...base(p)}><path d="M12 3.2l1.9 5.4 5.4 1.9-5.4 1.9L12 17.8l-1.9-5.4L4.7 10.5l5.4-1.9z" /></svg>
  ),
  lock: (p) => (
    <svg {...base(p)}><rect x="4.6" y="10.4" width="14.8" height="10.2" rx="2.6" /><path d="M8.2 10.4V8a3.8 3.8 0 0 1 7.6 0v2.4" /></svg>
  ),
  alert: (p) => (
    <svg {...base(p)}><path d="M12 4.2l9 16.3H3z" /><path d="M12 10v4.2" /><circle cx="12" cy="17.6" r="1" fill="currentColor" stroke="none" /></svg>
  ),
  inbox: (p) => (
    <svg {...base(p)}><path d="M4 13.2l2.6-8.4h10.8L20 13.2v6.2H4z" /><path d="M4 13.2h4.6l1 2.2h4.8l1-2.2H20" /></svg>
  ),
  arrowUp: (p) => (
    <svg {...base(p)}><path d="M12 19.5V5" /><path d="M6.5 10.5L12 5l5.5 5.5" /></svg>
  ),
  arrowDown: (p) => (
    <svg {...base(p)}><path d="M12 4.5V19" /><path d="M6.5 13.5L12 19l5.5-5.5" /></svg>
  ),
};


export function IconBadge({ icon, bg = 'var(--pv-lime)', size = 44, iconSize = 22 }) {
  const I = Icon[icon] || Icon.flask;
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: bg, border: '1.5px solid var(--pv-ink)', boxShadow: '3px 3px 0 #101a13', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pv-ink)', flexShrink: 0 }}>
      <I style={{ width: iconSize, height: iconSize }} />
    </div>
  );
}
