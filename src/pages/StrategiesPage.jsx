import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { Page, PageHeader, Card, Btn, StatusPill, Toolbar, Segmented, TableWrap, Modal, Field, KpiGrid, Kpi, Formula, Meter, Quote } from '../components/ui';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/PageState';
import TestAllPanel from '../components/TestAllPanel';
import { fmt } from '../lib/chartTheme';

const FILTERS = [['all', 'All'], ['active', 'Active'], ['testing', 'Testing'], ['rejected', 'Rejected']];

export default function StrategiesPage() {
  const strategies = useStore((s) => s.strategies);
  const addStrategy = useStore((s) => s.addStrategy);
  const updateStrategy = useStore((s) => s.updateStrategy);
  const deleteStrategy = useStore((s) => s.deleteStrategy);
  const refresh = useStore((s) => s.refresh);
  const loading = useStore((s) => s.loading);
  const backendOk = useStore((s) => s.backendOk);

  const [params] = useSearchParams();
  const qParam = params.get('q') || '';
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState(qParam);
  const [detail, setDetail] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', formula: '', hypothesis: '' });
  const [loadError, setLoadError] = useState(null);

  const load = async () => {
    setLoadError(null);
    try { await refresh(); } catch (e) { setLoadError(e.message); }
  };
  useEffect(() => { load(); }, []);

  // The topbar search hands off through ?q=
  useEffect(() => { setSearch(qParam); }, [qParam]);

  const q = search.trim().toLowerCase();
  const filtered = strategies.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (!q) return true;
    return (s.name || '').toLowerCase().includes(q) || (s.formula || '').toLowerCase().includes(q);
  });

  const handleAdd = () => {
    if (!draft.name.trim() || !draft.formula.trim()) { toast.error('Name and formula are required'); return; }
    addStrategy({ ...draft, status: 'testing', sharpe: 0, returns: 0, maxDD: 0, winRate: 0, trades: 0, author: 'User', createdAt: new Date().toISOString().slice(0, 10) });
    setDraft({ name: '', formula: '', hypothesis: '' });
    setAddOpen(false);
    toast.success('Strategy stored — the backend backtests it on create');
  };

  const setStatus = (s, status) => {
    updateStrategy(s.id, { status });
    setDetail({ ...s, status });
    toast.success(`Marked ${status}`);
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Alpha lab"
        title="Strategies"
        sub="Every formulaic factor the swarm produced — verdict, cost-adjusted metrics and status."
        actions={<Btn variant="pv-btn-primary" icon="plus" onClick={() => setAddOpen(true)}>New strategy</Btn>}
      />

      {loadError && <ErrorBanner message={loadError} onRetry={load} />}

      <Toolbar>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <input className="pv-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name or formula…" aria-label="Filter strategies" />
        </div>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} label="Status filter" />
        <span className="ui-count">{filtered.length}/{strategies.length}</span>
      </Toolbar>

      <TestAllPanel />

      <Card className="pad0">
        {loading && !strategies.length ? (
          <div style={{ padding: '1.25rem' }}><LoadingSkeleton rows={5} /></div>
        ) : !filtered.length ? (
          <div style={{ padding: '1.25rem' }}>
            <EmptyState
              icon="layers"
              title={strategies.length ? 'No matches' : 'No strategies yet'}
              hint={strategies.length ? 'Try another status filter or clear the search.' : 'Run the pipeline to mine your first factor.'}
              action={strategies.length
                ? <Btn size="pv-btn-sm" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</Btn>
                : <Btn to="/pipeline" variant="pv-btn-primary" size="pv-btn-sm">Open pipeline</Btn>}
            />
          </div>
        ) : (
          <TableWrap bordered={false}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Factor</th>
                  <th className="right">Sharpe</th>
                  <th className="right">Return</th>
                  <th className="right">Max DD</th>
                  <th className="right">Win</th>
                  <th className="right">Trades</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => setDetail(s)}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{s.name}</div>
                      <div className="ui-note ui-truncate" style={{ maxWidth: 320, fontFamily: 'var(--font-mono)', fontSize: '.72rem' }}>{s.formula}</div>
                    </td>
                    <td className="right ui-num" style={{ fontWeight: 700 }}>{fmt.num(s.sharpe)}</td>
                    <td className="right ui-num">{fmt.pct(s.returns)}</td>
                    <td className="right ui-num" style={{ color: 'var(--danger)' }}>{fmt.pct(s.maxDD)}</td>
                    <td className="right ui-num">{fmt.pct(s.winRate, 1)}</td>
                    <td className="right ui-num">{fmt.int(s.trades)}</td>
                    <td><StatusPill status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {!backendOk && !loading && (
        <p className="ui-note">Backend offline — showing the last known factor set. Edits stay local until it reconnects.</p>
      )}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name}
        sub={detail ? `${detail.author || 'Writer Agent'} · ${fmt.date(detail.createdAt)}` : ''}
        footer={detail && (
          <>
            {detail.status !== 'active' && <Btn variant="pv-btn-primary" onClick={() => setStatus(detail, 'active')}>Activate</Btn>}
            {detail.status === 'active' && <Btn onClick={() => setStatus(detail, 'rejected')}>Reject</Btn>}
            <Btn variant="pv-btn-danger" onClick={() => { deleteStrategy(detail.id); setDetail(null); toast.success('Strategy deleted'); }}>Delete</Btn>
          </>
        )}
      >
        {detail && (
          <>
            <div className="ui-eyebrow" style={{ marginBottom: '.4rem' }}>Formula</div>
            <Formula>{detail.formula}</Formula>

            <div className="ui-sep" style={{ margin: '1.1rem 0' }} />

            <KpiGrid>
              <Kpi label="Sharpe" value={fmt.num(detail.sharpe)} tone={detail.sharpe >= 1 ? 'tone-ok' : 'tone-warn'} />
              <Kpi label="Return" value={fmt.pct(detail.returns)} tone="tone-ok" />
              <Kpi label="Max DD" value={fmt.pct(detail.maxDD)} tone="tone-bad" />
              <Kpi label="Win rate" value={fmt.pct(detail.winRate, 1)} />
              <Kpi label="Trades" value={fmt.int(detail.trades)} />
              <Kpi label="Ann. vol" value={fmt.pct(detail.ann_vol)} />
            </KpiGrid>

            {detail.judge_score ? (
              <>
                <div className="ui-sep" style={{ margin: '1.1rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.4rem' }}>
                  <span className="ui-field-label">Judge score</span>
                  <span className="ui-num" style={{ fontWeight: 700 }}>{detail.judge_score}/100</span>
                </div>
                <Meter value={detail.judge_score} tone={detail.judge_score >= 70 ? 'meter-ok' : detail.judge_score >= 50 ? 'meter-warn' : 'meter-bad'} />
              </>
            ) : null}

            {detail.judge_notes && (
              <div style={{ marginTop: '1.1rem' }}>
                <div className="ui-field-label" style={{ marginBottom: '.4rem' }}>Judge notes</div>
                <Quote>{detail.judge_notes}</Quote>
              </div>
            )}

            {detail.hypothesis && (
              <div style={{ marginTop: '1.1rem' }}>
                <div className="ui-field-label" style={{ marginBottom: '.4rem' }}>Hypothesis</div>
                <p style={{ fontSize: '.86rem', color: 'var(--text-secondary)' }}>{detail.hypothesis}</p>
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="New strategy"
        sub="Stored in SQLite and backtested by the engine on create."
        footer={
          <>
            <Btn onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn variant="pv-btn-primary" onClick={handleAdd}>Create</Btn>
          </>
        }
      >
        <div className="ui-fields" style={{ gridTemplateColumns: '1fr' }}>
          <Field label="Name" hint="Short label shown in the library">
            <input className="pv-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Oversold dip bounce" />
          </Field>
          <Field label="Alpha formula" hint="Ops: rank delay sma ema std rsi correlation zscore atr sign beta · fields: open high low close volume spy">
            <input className="pv-input" style={{ fontFamily: 'var(--font-mono)' }} value={draft.formula} onChange={(e) => setDraft({ ...draft, formula: e.target.value })} placeholder="rank(close / delay(close, 20) - 1) * -1" />
          </Field>
          <Field label="Hypothesis" hint="What market behaviour is this trying to capture?">
            <textarea className="pv-input" rows={3} value={draft.hypothesis} onChange={(e) => setDraft({ ...draft, hypothesis: e.target.value })} placeholder="Stocks that drop sharply tend to bounce the next day" />
          </Field>
        </div>
      </Modal>
    </Page>
  );
}
