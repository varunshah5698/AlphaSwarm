import { Icon } from './Brand';

export function LoadingSkeleton({ rows = 3, height = 56 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ui-skel" style={{ height }} />
      ))}
    </div>
  );
}

export function KpiSkeleton({ count = 4 }) {
  return (
    <div className="ui-kpis" aria-busy="true" aria-label="Loading metrics">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ui-skel" style={{ height: 104, borderRadius: 12 }} />
      ))}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="ui-error" role="alert">
      <Icon.alert style={{ width: 18, height: 18, color: 'var(--danger)', flexShrink: 0 }} />
      <span className="ui-error-msg">{message || 'Something went wrong loading live data.'}</span>
      {onRetry && (
        <button className="pv-btn pv-btn-sm" onClick={onRetry}>
          <Icon.refresh style={{ width: 14, height: 14 }} />
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, action, icon = 'inbox' }) {
  const I = Icon[icon] || Icon.inbox;
  return (
    <div className="ui-state">
      <div className="ui-state-icon"><I style={{ width: 22, height: 22 }} /></div>
      <h3>{title || 'No data yet'}</h3>
      {hint && <p>{hint}</p>}
      {action && <div style={{ marginTop: '.9rem' }}>{action}</div>}
    </div>
  );
}
