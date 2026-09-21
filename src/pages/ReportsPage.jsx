import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Page, PageHeader, Card, CardHead, Btn, Pill, TableWrap, Kpi, KpiGrid, Checks } from '../components/ui';
import { KpiSkeleton, LoadingSkeleton, ErrorBanner, EmptyState } from '../components/PageState';
import { fmt } from '../lib/chartTheme';

const parse = (raw) => {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
};

export default function ReportsPage() {
  const experiments = useStore((s) => s.experiments);
  const refresh = useStore((s) => s.refresh);
  const loading = useStore((s) => s.loading);

  const [error, setError] = useState(null);
  const load = async () => {
    setError(null);
    try { await refresh(); } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  const rows = experiments.map((e) => ({ ...e, m: parse(e.metrics) }));
  const sharpes = rows.map((r) => Number(r.m.sharpe)).filter((n) => Number.isFinite(n));
  const best = sharpes.length ? Math.max(...sharpes) : null;
  const avgCost = rows.length ? rows.reduce((n, r) => n + (r.costs_bps || 0) + (r.slippage_bps || 0), 0) / rows.length : 0;

  return (
    <Page>
      <PageHeader
        eyebrow="Knowledge"
        title="Reports & experiments"
        sub="Every pipeline cycle is stored with its hypothesis, Writer output, Judge verdict, metrics and cost assumptions."
        actions={<Btn to="/pipeline" variant="pv-btn-primary" icon="play">Run a cycle</Btn>}
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading && !experiments.length ? <KpiSkeleton count={3} /> : (
        <KpiGrid>
          <Kpi label="Cycles recorded" value={fmt.int(experiments.length)} foot="full loop executions" icon="file" variant="accent" />
          <Kpi label="Best Sharpe" value={fmt.num(best)} foot="across all cycles" icon="target" tone={best != null && best >= 1 ? 'tone-ok' : 'tone-warn'} />
          <Kpi label="Avg cost load" value={`${avgCost.toFixed(1)} bps`} foot="costs + slippage" icon="activity" />
        </KpiGrid>
      )}

      {loading && !experiments.length ? <LoadingSkeleton rows={5} /> : !experiments.length ? (
        <EmptyState
          icon="file"
          title="No experiments yet"
          hint="Run the pipeline once — each cycle is recorded here with everything needed to reproduce it."
          action={<Btn to="/pipeline" variant="pv-btn-primary" size="pv-btn-sm">Open pipeline</Btn>}
        />
      ) : (
        <Card className="pad0">
          <TableWrap bordered={false}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Hypothesis</th>
                  <th className="right">Sharpe</th>
                  <th className="right">Return</th>
                  <th className="right">Max DD</th>
                  <th>Costs</th>
                  <th>Dataset</th>
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="ui-num tight">#{e.id}</td>
                    <td>
                      <div className="ui-truncate" style={{ maxWidth: 300, fontWeight: 600 }}>{e.hypothesis || '—'}</div>
                    </td>
                    <td className="right ui-num" style={{ fontWeight: 700 }}>{fmt.num(e.m.sharpe)}</td>
                    <td className="right ui-num">{e.m.returns != null ? fmt.pct(e.m.returns) : '—'}</td>
                    <td className="right ui-num" style={{ color: 'var(--danger)' }}>{e.m.max_dd != null ? fmt.pct(e.m.max_dd) : '—'}</td>
                    <td><Pill tone="is-quiet">{e.costs_bps ?? 0}+{e.slippage_bps ?? 0}</Pill></td>
                    <td className="ui-note">{e.dataset || '—'}</td>
                    <td className="ui-num ui-note tight">{fmt.date(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      <Card className="soft">
        <CardHead title="Evaluation discipline" sub="What makes a stored cycle trustworthy" icon="shield" />
        <Checks items={[
          'Compared against a benchmark, not one lucky backtest',
          'Separate development and unseen evaluation splits',
          'Costs and slippage always on, never optional',
          'Judge and feedback loop can be ablated to test their value',
          'Complexity capped so an overfit formula cannot slip through',
        ]} />
      </Card>
    </Page>
  );
}
