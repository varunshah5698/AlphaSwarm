import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import { Page, PageHeader, Card, Btn, Pill, StatusPill, Toolbar, Segmented } from '../components/ui';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/PageState';

const STATUSES = ['unread', 'reading', 'read'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ResearchPage() {
  const papers = useStore((s) => s.papers);
  const refresh = useStore((s) => s.refresh);
  const loading = useStore((s) => s.loading);

  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try { await refresh(); } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    try {
      await api.patchPaper(id, { status });
      refresh();
      toast.success(`Marked ${status}`);
    } catch {
      toast.error('Backend offline — change not saved');
    }
  };

  const shown = papers.filter((p) => filter === 'all' || p.status === filter);

  return (
    <Page>
      <PageHeader
        eyebrow="Knowledge"
        title="Research library"
        sub="The papers behind the method — alpha mining, evolutionary search and backtest-overfitting risk."
        actions={<Pill tone="is-quiet">{papers.length} tracked</Pill>}
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <Toolbar>
        <Segmented
          options={[['all', 'All'], ...STATUSES.map((s) => [s, cap(s)])]}
          value={filter}
          onChange={setFilter}
          label="Reading status"
        />
        <span className="ui-count">{shown.length}/{papers.length}</span>
        <div className="ui-toolbar-spacer" />
        <Btn size="pv-btn-sm" icon="refresh" onClick={load}>Re-sync</Btn>
      </Toolbar>

      {loading && !papers.length ? <LoadingSkeleton rows={5} height={92} /> : !shown.length ? (
        <EmptyState
          icon="library"
          title={papers.length ? 'Nothing at this status' : 'No papers found'}
          hint={papers.length ? 'Switch the filter to see the rest of the reading list.' : 'Seed data loads automatically when the backend starts.'}
          action={<Btn size="pv-btn-sm" onClick={load}>Retry</Btn>}
        />
      ) : (
        <Card className="pad0">
          <div>
            {shown.map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap',
                  padding: '1.05rem 1.25rem',
                  borderTop: i ? '1px solid var(--border-light)' : 'none',
                }}
              >
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <h3 style={{ fontSize: '.95rem' }}>{p.title}</h3>
                  <div className="ui-card-sub">{p.authors} · {p.source} · {p.year}</div>
                  {p.notes ? <p style={{ fontSize: '.84rem', color: 'var(--text-secondary)', marginTop: '.4rem' }}>{p.notes}</p> : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <StatusPill status={p.status} />
                  <Segmented
                    quiet
                    options={STATUSES.map((s) => [s, cap(s)])}
                    value={p.status}
                    onChange={(s) => setStatus(p.id, s)}
                    label={`Reading status for ${p.title}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </Page>
  );
}
