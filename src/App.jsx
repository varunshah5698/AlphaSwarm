import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useStore } from './store/useStore';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ErrorBoundary from './components/ErrorBoundary';
import CommandPalette from './components/CommandPalette';
import { Logo } from './components/Brand';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';

// Heavy chart/table views are code-split so first paint stays small.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const StrategiesPage = lazy(() => import('./pages/StrategiesPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const AgentsPage = lazy(() => import('./pages/AgentsPage'));
const PipelinePage = lazy(() => import('./pages/PipelinePage'));
const BacktestPage = lazy(() => import('./pages/BacktestPage'));
const PaperPage = lazy(() => import('./pages/PaperPage'));
const ResearchPage = lazy(() => import('./pages/ResearchPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const LogsPage = lazy(() => import('./pages/LogsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage'));

function Splash({ label }) {
  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.9rem' }}>
        <Logo size={44} />
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{label}</div>
        <div className="ui-meter meter-lime" style={{ width: 160 }}><i style={{ width: '60%' }} /></div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const authBooted = useStore((s) => s.authBooted);
  if (!authBooted) return <Splash label="Restoring session…" />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function GuestOnly({ children }) {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const authBooted = useStore((s) => s.authBooted);
  if (authBooted && isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

function PageLoader() {
  return (
    <div className="ui-page" aria-busy="true" aria-label="Loading page">
      <div className="ui-skel" style={{ height: 34, width: 240, borderRadius: 10 }} />
      <div className="ui-kpis">
        {[0, 1, 2, 3].map((i) => <div key={i} className="ui-skel" style={{ height: 104, borderRadius: 12 }} />)}
      </div>
      <div className="ui-skel" style={{ height: 260, borderRadius: 12 }} />
    </div>
  );
}

function AppLayout({ children }) {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  return (
    <div className="shell">
      <Sidebar />
      <div className={`app-shell${sidebarOpen ? '' : ' collapsed'}`}>
        <Topbar />
        <main className="app-content">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

// Every navigation starts at the top of the new page.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  const bootstrap = useStore((s) => s.bootstrap);
  const setSidebar = useStore((s) => s.setSidebar);

  useEffect(() => {
    bootstrap();
    // Drawer starts closed on small screens so content is never hidden behind it.
    if (window.innerWidth < 900) setSidebar(false);
  }, []);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#101a13', color: '#fff', border: '1.5px solid #101a13',
            borderRadius: '10px', fontSize: '.84rem', fontWeight: 600,
            boxShadow: '5px 5px 0 rgba(16,26,19,.22)',
          },
          success: { iconTheme: { primary: '#b9ff66', secondary: '#101a13' } },
          error: { iconTheme: { primary: '#e14b4b', secondary: '#101a13' } },
        }}
      />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/strategies" element={<StrategiesPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/agents" element={<AgentsPage />} />
                    <Route path="/pipeline" element={<PipelinePage />} />
                    <Route path="/backtest" element={<BacktestPage />} />
                    <Route path="/paper" element={<PaperPage />} />
                    <Route path="/research" element={<ResearchPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/logs" element={<LogsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/team" element={<TeamPage />} />
                    <Route path="/api-docs" element={<ApiDocsPage />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
