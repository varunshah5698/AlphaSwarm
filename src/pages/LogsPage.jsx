import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Page, PageHeader, Card, CardHead, Btn, Pill, Toolbar, Segmented } from '../components/ui';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/PageState';
import { fmt } from '../lib/chartTheme';

const LEVELS = [['all', 'All'], ['info', 'Info'], ['success', 'Success'], ['warn', 'Warn'], ['error', 'Error']];
const LEVEL_COLOR = {
  info: 'rgba(232,245,216,.72)',
  success: '#b9ff66',
  warn: '#f0b357',
  error: '#ff8f8f',
};

export default function LogsPage() {
  const logs = useStore((s) => s.logs);
  const refresh = useStore((s) => s.refresh);
  const loading = useStore((s) => s.loading);

  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try { await refresh(); } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  const rows = logs.filter((l) => filter === 'all' || l.level === filter);
  const count = (lvl) => logs.filter((l) => l.level === lvl).length;

  return (
    <Page>
      <PageHeader
        eyebrow="Operations"
        title="Swarm logs"
        sub="A trace of every action the agents took — newest first, straight from SQLite."
        actions={<Btn icon="refresh" onClick={load}>Re-sync</Btn>}
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <Toolbar>
        <Segmented options={LEVELS} value={filter} onChange={setFilter} label="Log level" />
        <span className="ui-count">{rows.length}/{logs.length}</span>
        <div className="ui-toolbar-spacer" />
        <Pill tone="is-ok" dot>success {count('success')}</Pill>
        <Pill tone="is-quiet">info {count('info')}</Pill>
        {count('warn') > 0 && <Pill tone="is-warn">warn {count('warn')}</Pill>}
        {count('error') > 0 && <Pill tone="is-bad">error {count('error')}</Pill>}
      </Toolbar>

      <Card className="pad0">
        <CardHead
          title="Trace console"
          sub="mono · newest first"
          icon="terminal"
          actions={<Pill tone="is-ink">live</Pill>}
        />
        <div style={{ padding: '0 1.25rem 1.25rem' }}>
          {loading && !logs.length ? <LoadingSkeleton rows={6} /> : !rows.length ? (
            <EmptyState
              icon="list"
              title={logs.length ? 'No logs at this level' : 'No logs yet'}
              hint={logs.length ? 'Try a different level filter.' : 'Pipeline runs will log here.'}
            />
          ) : (
            <div
              className="ui-panel dark"
              style={{ padding: '1rem 1.1rem', maxHeight: 560, overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', gap: '.35rem', marginBottom: '.8rem' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#e14b4b' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#d97706' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#0ea472' }} />
                <span style={{ fontSize: '.66rem', opacity: .5, marginLeft: '.4rem', fontFamily: 'var(--font-mono)' }}>
                  swarm · live loop
                </span>
              </div>
              {rows.map((l) => (
                <div
                  key={l.id}
                  style={{
                    display: 'flex', gap: '.7rem', alignItems: 'flex-start', flexWrap: 'wrap',
                    fontFamily: 'var(--font-mono)', fontSize: '.75rem', lineHeight: 1.7,
                    padding: '.28rem 0', borderBottom: '1px solid rgba(255,255,255,.06)',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,.42)', flexShrink: 0 }}>{fmt.clock(l.created_at || l.time)}</span>
                  <span style={{ color: LEVEL_COLOR[l.level] || 'rgba(232,245,216,.72)', flexShrink: 0, minWidth: 58 }}>
                    {String(l.level || 'info').toUpperCase()}
                  </span>
                  <span style={{ color: 'var(--pv-lime)', flexShrink: 0, minWidth: 118 }}>{l.agent}</span>
                  <span style={{ color: '#e8f5d8', flex: '1 1 240px', minWidth: 0 }}>{l.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </Page>
  );
}
