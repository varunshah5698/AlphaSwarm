import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Icon } from './Brand';
import { Pill, Pulse } from './ui';
import { findLink, findGroup } from '../lib/nav';
import { useMediaQuery } from '../hooks/useMediaQuery';

export default function Topbar() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const backendOk = useStore((s) => s.backendOk);
  const refresh = useStore((s) => s.refresh);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const openPalette = useStore((s) => s.openPalette);

  const [menuOpen, setMenuOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const menuRef = useRef(null);

  const link = findLink(pathname);
  const group = findGroup(pathname);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
      }
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPalette]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const sync = async () => {
    setSyncing(true);
    try { await refresh(); } finally { setSyncing(false); }
  };

  const go = (to) => () => { setMenuOpen(false); navigate(to); };
  const signOut = async () => { setMenuOpen(false); await logout(); navigate('/login'); };
  const handle = (user?.username || user?.name || 'U').slice(0, 2).toUpperCase();

  return (
    <header className="topbar">
      {isMobile && (
        <button className="ui-iconbtn topbar-toggle" onClick={toggleSidebar} aria-label="Toggle navigation">
          <Icon.menu style={{ width: 16, height: 16 }} />
        </button>
      )}

      <div className="topbar-heading">
        <div className="topbar-crumb">{group ? group.label : 'Terminal'}</div>
        <div className="topbar-title">{link ? link.label : 'Alpha Swarm'}</div>
      </div>

      <button type="button" className="topbar-search" onClick={openPalette} aria-label="Open command palette">
        <Icon.search />
        <span style={{ flex: 1, textAlign: 'left', color: 'var(--text-muted)', fontSize: '.82rem' }}>Search or jump to…</span>
        <span className="topbar-kbd">⌘K</span>
      </button>

      <div className="topbar-actions">
        <button className="pv-btn pv-btn-sm" onClick={sync} disabled={syncing} title="Re-sync every dataset from the backend">
          <Icon.refresh style={{ width: 14, height: 14 }} />
          <span className="topbar-username">{syncing ? 'Syncing…' : 'Sync'}</span>
        </button>

        <Pill tone={backendOk ? 'is-ok' : 'is-warn'}>
          <Pulse on={backendOk} />
          {backendOk ? 'Backend live' : 'Local mode'}
        </Pill>

        <div className="usermenu" ref={menuRef}>
          <button
            className="topbar-user"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="topbar-avatar">{handle}</span>
            <span className="topbar-username">{user?.username || user?.name || 'Guest'}</span>
            <Icon.chevron style={{ width: 13, height: 13, transform: menuOpen ? 'rotate(90deg)' : 'none', transition: 'transform .16s ease' }} />
          </button>

          {menuOpen && (
            <div className="usermenu-pop" role="menu">
              <div className="usermenu-head">
                <b>{user?.username || user?.name || 'Guest'}</b>
                <span>{user?.email || 'Signed in account'}</span>
              </div>
              <button className="usermenu-item" role="menuitem" onClick={go('/settings')}><Icon.gear />Run defaults</button>
              <button className="usermenu-item" role="menuitem" onClick={go('/api-docs')}><Icon.plug />API docs</button>
              <button className="usermenu-item" role="menuitem" onClick={go('/')}><Icon.globe />Public site</button>
              <div className="ui-sep" />
              <button className="usermenu-item danger" role="menuitem" onClick={signOut}><Icon.logout />Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
