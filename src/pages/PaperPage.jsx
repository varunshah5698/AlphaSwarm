import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { Page, PageHeader, Card, CardHead, Btn, Kpi, KpiGrid, Pill, TableWrap } from '../components/ui';
import { KpiSkeleton, ErrorBanner, EmptyState } from '../components/PageState';
import { CHART, axisProps, gridProps, fmt } from '../lib/chartTheme';
import { ChartTip } from '../components/ChartTip';

export default function PaperPage() {
  const [symbol, setSymbol] = useState('AAPL');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [retrain, setRetrain] = useState(null);

  const load = async (sym = symbol) => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.paper(sym));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };
  useEffect(() => { load('AAPL'); }, []);

  const pickSymbol = (sym) => { setSymbol(sym); setRetrain(null); load(sym); };

  const runUpdate = async () => {
    setBusy('run');
    try {
      const out = await api.paperRun(symbol);
      setData(out);
      toast.success(out.filled ? `Ledger updated · ${out.filled} new fills` : 'Already up to date');
    } catch (e) {
      toast.error(String(e.message).slice(0, 200));
    }
    setBusy(null);
  };

  const runRetrain = async () => {
    setBusy('retrain');
    try {
      const out = await api.paperRetrain(symbol);
      setRetrain(out);
      toast.success(out.promoted ? `Promoted: ${out.challenger.name}` : 'Incumbent kept — margin too thin');
      load();
    } catch (e) {
      toast.error(String(e.message).slice(0, 200));
    }
    setBusy(null);
  };

  const acc = data?.account;
  const stats = data?.stats;
  const daily = data?.daily || [];
  const recent = data?.recent || [];
  const pos = acc?.position ?? 0;
  const universe = data?.universe?.length ? data.universe : ['SPY', 'AAPL', 'MSFT', 'NVDA', 'TSLA'];
  const ledgers = data?.accounts || [];

  return (
    <Page>
      <PageHeader
        eyebrow="Forward proof"
        title="Paper trading"
        sub="The live factor trades one honest day at a time — no money moves, but the scoreboard is real. Run the update daily."
        actions={
          <>
            <Btn onClick={runUpdate} disabled={busy} icon="refresh">{busy === 'run' ? 'Updating…' : 'Update now'}</Btn>
            <Btn onClick={runRetrain} disabled={busy} variant="pv-btn-primary" icon="flask">{busy === 'retrain' ? 'Retraining…' : 'Retrain'}</Btn>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={() => load()} />}

      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {universe.map((s) => (
          <button key={s} type="button" className={`ui-pill ${symbol === s ? 'is-ok' : 'is-quiet'}`}
            style={{ fontSize: '.72rem', cursor: 'pointer' }} onClick={() => pickSymbol(s)}>
            {s}{ledgers.some((l) => l.symbol === s) ? ' ●' : ''}
          </button>
        ))}
        <span className="ui-note" style={{ alignSelf: 'center' }}>● = ledger open · risk: cap {acc?.max_pos ?? 1} · stop {acc?.stop_pct ?? 10}% · regime filter {acc?.regime_off ? 'ON' : 'OFF'}</span>
      </div>

      {loading && !acc ? <KpiSkeleton count={5} /> : !acc ? (
        <EmptyState
          icon="chart"
          title="No paper account yet"
          hint="Start paper trading to open a ledger on your best live-learned factor — run the pipeline first if the library is empty."
          action={<Btn onClick={runUpdate} variant="pv-btn-primary" size="pv-btn-sm">Start paper trading</Btn>}
        />
      ) : (
        <>
          <KpiGrid>
            <Kpi label="Paper return" value={fmt.pct(stats?.return)} foot={`${stats?.days} days live · vs BH ${fmt.pct(stats?.bench_return)}`} icon="activity" tone={stats?.return >= 0 ? 'tone-ok' : 'tone-bad'} />
            <Kpi label="Excess vs buy & hold" value={`${stats?.excess >= 0 ? '+' : ''}${fmt.num(stats?.excess)} pts`} foot={`trading ${acc.strategy?.name?.slice(0, 20) || ''}`} icon="target" tone={stats?.excess >= 0 ? 'tone-ok' : 'tone-warn'} />
            <Kpi label="Paper Sharpe" value={fmt.num(stats?.sharpe)} foot="annualized, forward only" icon="gauge" tone={stats?.sharpe >= 1 ? 'tone-ok' : 'tone-warn'} />
            <Kpi label="Max DD" value={fmt.pct(stats?.max_dd)} foot="peak to trough, forward" icon="arrowDown" tone="tone-bad" />
            <Kpi label="Position now" value={`${pos > 0 ? '+' : ''}${Number(pos).toFixed(2)}`} foot={pos > 0 ? 'net long' : pos < 0 ? 'net short' : 'flat'} icon="layers" variant="accent" />
          </KpiGrid>

          <Card>
            <CardHead
              title={`Paper equity vs buy & hold · ${acc.symbol}`}
              sub={`Factor: ${acc.strategy?.name || '—'} · last fill ${acc.last_date || '—'}`}
              icon="chart"
              actions={<Pill tone={stats?.excess >= 0 ? 'is-ok' : 'is-warn'} dot>{stats?.excess >= 0 ? 'beating BH' : 'trailing BH'}</Pill>}
            />
            {daily.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={daily} margin={{ top: 4, right: 10, left: -16, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} minTickGap={48} />
                  <YAxis {...axisProps} domain={['auto', 'auto']} tickFormatter={(v) => Number(v).toFixed(2)} />
                  <Tooltip content={<ChartTip formatter={(v) => Number(v).toFixed(4)} />} cursor={{ stroke: CHART.ink, strokeDasharray: '3 3' }} />
                  <Legend wrapperStyle={{ fontSize: '.72rem', fontFamily: "'JetBrains Mono', monospace" }} />
                  <Line type="monotone" dataKey="equity" name="Paper" stroke={CHART.primary} strokeWidth={2.4} dot={false} />
                  <Line type="monotone" dataKey="benchmark" name="Buy & hold" stroke={CHART.axis} strokeWidth={1.8} strokeDasharray="5 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyState icon="chart" title="No fills yet" hint="Press Update now to backfill the ledger to the latest bar." />}
          </Card>

          {retrain && (
            <Card>
              <CardHead
                title="Retrain verdict"
                sub={`Challenger searched ${retrain.challenger.candidates} candidates on extended history`}
                icon="flask"
                actions={<Pill tone={retrain.promoted ? 'is-ok' : 'is-quiet'} dot>{retrain.promoted ? 'promoted' : 'incumbent kept'}</Pill>}
              />
              <KpiGrid>
                <Kpi label="Incumbent test" value={fmt.num(retrain.incumbent.test_sharpe)} foot={retrain.incumbent.name?.slice(0, 24)} />
                <Kpi label="Challenger test" value={fmt.num(retrain.challenger.test_sharpe)} foot={retrain.challenger.name?.slice(0, 24)} tone={retrain.challenger.test_sharpe >= 1 ? 'tone-ok' : 'tone-warn'} />
                <Kpi label="WF mean" value={fmt.num(retrain.challenger.walk_forward?.mean_test_sharpe)} foot={`${retrain.challenger.walk_forward?.positive_folds}/${retrain.challenger.walk_forward?.n_folds} folds positive`} />
              </KpiGrid>
            </Card>
          )}

          <Card>
            <CardHead title="Recent fills" sub="Newest first · costs deducted per position change" icon="list" actions={<Pill tone="is-quiet">{stats?.days} days</Pill>} />
            {recent.length ? (
              <TableWrap bordered={false}>
                <table className="data-table">
                  <thead><tr><th>Date</th><th className="right">Price</th><th className="right">Pos</th><th className="right">Day %</th><th className="right">Equity</th><th className="right">BH</th></tr></thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.date}>
                        <td className="ui-num">{r.date}</td>
                        <td className="right ui-num">{Number(r.price).toFixed(2)}</td>
                        <td className="right ui-num">{Number(r.position).toFixed(2)}</td>
                        <td className="right ui-num" style={{ color: r.ret >= 0 ? 'var(--success)' : 'var(--danger)' }}>{Number(r.ret).toFixed(2)}%</td>
                        <td className="right ui-num">{Number(r.equity).toFixed(4)}</td>
                        <td className="right ui-num">{Number(r.benchmark).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ) : <EmptyState icon="list" title="No fills" hint="Update the ledger to record the first fills." />}
          </Card>
        </>
      )}
    </Page>
  );
}
