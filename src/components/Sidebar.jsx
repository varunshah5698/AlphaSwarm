import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Logo, Icon } from './Brand';
import { NAV } from '../lib/nav';
import { useMediaQuery } from '../hooks/useMediaQuery';

export default function Sidebar() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const setSidebar = useStore((s) => s.setSidebar);
  const user = useStore((s) => s.user);
  const isMobile = useMediaQuery('(max-width: 900px)');
  const { pathname } = useLocation();

  // The drawer should not survive navigation on small screens.
  useEffect(() => {
    if (isMobile) setSidebar(false);
  }, [pathname, isMobile, setSidebar]);

  const rail = !isMobile && !sidebarOpen;
  const className = ['sidebar', isMobile ? (sidebarOpen ? 'open' : '') : rail ? 'rail' : ''].filter(Boolean).join(' ');
  const handle = (user?.username || user?.name || 'R').slice(0, 2).toUpperCase();

  return (
    <>
      <aside className={className} aria-label="Main navigation">
        <div className="sidebar-brand">
          <Logo size={34} />
          {!rail && (
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-name">ALPHA SWARM</div>
              <div className="sidebar-brand-tag">Agentic quant</div>
            </div>
          )}
        </div>

        <nav className="sidebar-scroll">
          {NAV.map((group) => (
            <div className="sidebar-group" key={group.label}>
              <span className="sidebar-group-label">{group.label}</span>
              {group.links.map((l) => {
                const I = Icon[l.icon] || Icon.grid;
                return (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    title={l.label}
                    className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                  >
                    <I />
                    {!rail && <span className="sidebar-link-label">{l.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          {!rail && user && (
            <div className="sidebar-user">
              <span className="topbar-avatar">{handle}</span>
              <div className="sidebar-user-meta">
                <div className="sidebar-user-name">{user.username || user.name}</div>
                <div className="sidebar-user-role">{user.role || 'Researcher'}</div>
              </div>
            </div>
          )}
          <button
            className="pv-btn pv-btn-sm"
            onClick={toggleSidebar}
            title={isMobile ? 'Close navigation' : sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isMobile || !sidebarOpen
              ? <Icon.chevron style={{ width: 14, height: 14 }} />
              : <Icon.chevronLeft style={{ width: 14, height: 14 }} />}
            {!rail && (isMobile ? 'Close' : 'Collapse')}
          </button>
        </div>
      </aside>
      {isMobile && sidebarOpen && (
        <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebar(false)} />
      )}
    </>
  );
}
