import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Icon } from './Brand';
import { ALL_LINKS } from '../lib/nav';

export default function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const closePalette = useStore((s) => s.closePalette);
  const strategies = useStore((s) => s.strategies);
  const refresh = useStore((s) => s.refresh);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const logout = useStore((s) => s.logout);

  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = [];

    const pages = ALL_LINKS
      .filter((l) => !q || l.label.toLowerCase().includes(q) || l.desc.toLowerCase().includes(q))
      .map((l) => ({ id: `page:${l.to}`, icon: l.icon, label: l.label, sub: l.desc, run: () => navigate(l.to) }));
    if (pages.length) out.push({ group: 'Go to', items: pages });

    if (q) {
      const hits = strategies
        .filter((s) => (s.name || '').toLowerCase().includes(q) || (s.formula || '').toLowerCase().includes(q))
        .slice(0, 5)
        .map((s) => ({ id: `strat:${s.id}`, icon: 'layers', label: s.name, sub: s.formula, run: () => navigate(`/strategies?q=${encodeURIComponent(s.name)}`) }));
      if (hits.length) out.push({ group: 'Strategies', items: hits });
    }

    const actions = [
      { id: 'act:pipeline', icon: 'play', label: 'Run a pipeline cycle', sub: 'Generate → critique → test', run: () => navigate('/pipeline') },
      { id: 'act:backtest', icon: 'activity', label: 'Open the backtester', sub: 'Formula engine + CSV upload', run: () => navigate('/backtest') },
      { id: 'act:sync', icon: 'refresh', label: 'Sync from backend', sub: 'Re-pull every dataset', run: () => refresh() },
      { id: 'act:sidebar', icon: 'menu', label: 'Toggle sidebar', sub: 'Collapse the navigation rail', run: () => toggleSidebar() },
      { id: 'act:logout', icon: 'logout', label: 'Sign out', sub: 'End the session', run: async () => { await logout(); navigate('/login'); } },
    ].filter((a) => !q || a.label.toLowerCase().includes(q) || a.sub.toLowerCase().includes(q));
    if (actions.length) out.push({ group: 'Actions', items: actions });

    return out;
  }, [query, strategies, navigate, refresh, toggleSidebar, logout]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('.cmdk-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, flat.length - 1))); }, [flat.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flat[active];
        if (item) { closePalette(); item.run(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, flat, active, closePalette]);

  if (!open) return null;
  let idx = -1;
  return createPortal(
    <div className="cmdk-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closePalette(); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cmdk-input-row">
          <Icon.search />
          <input
            ref={inputRef}
            className="cmdk-input"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Jump to a page, an action, or a strategy…"
            aria-label="Command palette search"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={flat[active]?.id}
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
          {flat.length === 0 && (
            <div className="cmdk-empty">Nothing matches “{query}”. Try “pipeline”, “backtest”, or a strategy name.</div>
          )}
          {groups.map((g) => (
            <div key={g.group} role="group" aria-label={g.group}>
              <div className="cmdk-group">{g.group}</div>
              {g.items.map((it) => {
                idx += 1;
                const i = idx;
                const I = Icon[it.icon] || Icon.arrow;
                return (
                  <button
                    key={it.id}
                    id={it.id}
                    role="option"
                    aria-selected={i === active}
                    className={`cmdk-item${i === active ? ' active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => { closePalette(); it.run(); }}
                  >
                    <I />
                    <span>{it.label}</span>
                    {it.sub && <span className="cmdk-item-sub">{it.sub}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><span className="kbd">↑↓</span> navigate</span>
          <span><span className="kbd">↵</span> select</span>
          <span><span className="kbd">esc</span> close</span>
          <span style={{ marginLeft: 'auto' }}>α swarm terminal</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
