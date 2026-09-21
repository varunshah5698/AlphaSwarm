import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Page, PageHeader, Card, CardHead, Kpi, KpiGrid, Btn, Pill, StatusPill, Row, Rows } from '../components/ui';
import { KpiSkeleton, LoadingSkeleton, ErrorBanner, EmptyState } from '../components/PageState';
import LiveTicker from '../components/LiveTicker';
import { CHART, axisProps, gridProps, fmt } from '../lib/chartTheme';
import { ChartTip } from '../components/ChartTip';

const DIST_COLORS = [CHART.primary, CHART.warning, CHART.danger, CHART.info, CHART.purple];
const tone = (v) => (v >= 1 ? 'tone-ok' : v >= 0.5 ? 'tone-warn' : 'tone-bad');

export default function DashboardPage() {
  const strategies = useStore((s) => s.strategies);
  const agents = useStore((s) => s.agents);
  const logs = useStore((s) => s.logs);
  const metrics = useStore((s) => s.metrics);
  const refresh = useStore((s) => s.refresh);
  const backendOk = useStore((s) => s.backendOk);
  const settings = useStore((s) => s.settings);

  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      await refresh();
      setCharts(await api.dashboardCharts(settings?.benchmark || 'SPY'));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const ranked = [...strategies].sort((a, b) => (b.sharpe || 0) - (a.sharpe || 0));
  const best = ranked[0];
  const recent = logs.slice(0, 7);
  const activeCount = strategies.filter((s) => s.status === 'active').length;
  const activeAgents = agents.filter((a) => a.status === 'active').length;
  const avgSharpe = metrics?.avg_sharpe ?? (strategies.length ? strategies.reduce((a, s) => a + (s.sharpe || 0), 0) / strategies.length : null);
  const trades = metrics?.total_trades ?? strategies.reduce((a, s) => a + (s.trades || 0), 0);

  const dist = (charts?.distribution || []).map((d, i) => ({ ...d, color: DIST_COLORS[i % DIST_COLORS.length] }));
  const equity = charts?.equity || [];
  const activity = charts?.activity || [];

  return (
    <Page>
      <PageHeader
        eyebrow={backendOk ? 'Live lab data' : 'Local mode'}
        title="Dashboard"
        sub="Computed from stored strategies, agent logs and the running backtest engine — never from fixtures."
        actions={
          <>
            <Btn to="/pipeline" variant="pv-btn-primary" icon="play">Run pipeline</Btn>
            <Btn to="/backtest" icon="activity">Backtester</Btn>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <LiveTicker />

      {loading && !strategies.length ? <KpiSkeleton count={5} /> : (
        <KpiGrid>
          <Kpi label="Active factors" value={activeCount} foot={`of ${strategies.length} mined`} icon="layers" variant="accent" />
          <Kpi label="Best Sharpe" value={fmt.num(best?.sharpe)} foot={best?.name ? best.name.slice(0, 22) : 'no runs yet'} icon="target" tone={tone(best?.sharpe || 0)} />
          <Kpi label="Avg Sharpe" value={fmt.num(avgSharpe)} foot="across all factors" icon="gauge" />
          <Kpi label="Total trades" value={fmt.int(trades)} foot="cost-adjusted fills" icon="activity" />
          <Kpi label="Agents online" value={agents.length ? `${activeAgents}/${agents.length}` : '—'} foot={`${metrics?.experiments ?? 0} cycles run`} icon="bot" />
        </KpiGrid>
      )}

      <div className="ui-grid split">
        <Card>
          <CardHead
            title={`Equity · best alpha vs ${charts?.benchmark || 'benchmark'}`}
            sub={charts?.equity_source ? `Source: ${charts.equity_source}` : 'Waiting for a validated factor'}
            icon="chart"
            actions={<Pill tone="is-ok" dot>Live</Pill>}
          />
          {loading && !equity.length ? <LoadingSkeleton rows={1} height={260} /> : equity.length ? (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={268}>
                <AreaChart data={equity} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="alphaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.lime} stopOpacity={0.85} />
                      <stop offset="100%" stopColor={CHART.lime} stopOpacity={0.12} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="t" {...axisProps} minTickGap={32} />
                  <YAxis {...axisProps} tickFormatter={(v) => Number(v).toFixed(2)} domain={['auto', 'auto']} />
                  <Tooltip content={<ChartTip formatter={(v) => Number(v).toFixed(4)} />} />
                  <Area type="monotone" dataKey="benchmark" name="Benchmark" stroke={CHART.axis} strokeWidth={1.8} strokeDasharray="5 4" fill="transparent" dot={false} />
                  <Area type="monotone" dataKey="alpha" name="Best alpha" stroke={CHART.primary} strokeWidth={2.4} fill="url(#alphaFill)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '.5rem', fontSize: '.74rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
                  <span style={{ width: 12, height: 4, background: CHART.primary, borderRadius: 3 }} />Best alpha
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
                  <span style={{ width: 12, height: 4, background: CHART.axis, borderRadius: 3 }} />Benchmark
                </span>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No equity curve yet"
              icon="chart"
              hint="Run the pipeline once — the winning factor's curve lands here."
              action={<Btn to="/pipeline" variant="pv-btn-primary" size="pv-btn-sm">Run pipeline</Btn>}
            />
          )}
        </Card>
        <Card>
          <CardHead title="Factor status mix" sub="Where every mined factor stands" icon="layers" />
          {dist.length ? (
            <>
              <ResponsiveContainer width="100%" height={196}>
                <PieChart>
                  <Pie data={dist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} stroke={CHART.ink} strokeWidth={1.5}>
                    {dist.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <Rows>
                {dist.map((d) => (
                  <Row
                    key={d.name}
                    title={d.name}
                    tail={
                      <>
                        <span className="ui-dot" style={{ background: d.color }} />
                        <span className="ui-num" style={{ fontWeight: 700 }}>{d.value}</span>
                      </>
                    }
                  />
                ))}
              </Rows>
            </>
          ) : (
            <EmptyState title="Nothing mined yet" icon="layers" hint="Factor statuses appear as soon as the swarm stores a run." />
          )}
        </Card>
      </div>

      <div className="ui-grid cols-3">
        <Card>
          <CardHead title="Log volume by hour" sub="Agent activity histogram" icon="clock" />
          {activity.length ? (
            <ResponsiveContainer width="100%" height={196}>
              <BarChart data={activity} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="hour" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<ChartTip labelPrefix="hour " />} cursor={{ fill: 'rgba(185,255,102,.22)' }} />
                <Bar dataKey="tasks" name="Actions" fill={CHART.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No log activity" icon="clock" hint="Agent runs will appear here." />}
        </Card>

        <Card>
          <CardHead title="Recent activity" sub="Latest swarm log entries" icon="list" actions={<Btn to="/logs" size="pv-btn-sm" variant="pv-btn-ghost">All</Btn>} />
          {recent.length ? (
            <div className="ui-rows ui-scrollarea" style={{ maxHeight: 196 }}>
              {recent.map((l) => (
                <div className="ui-row" key={l.id}>
                  <div className="ui-row-main">
                    <div className="ui-row-title ui-truncate">{l.message}</div>
                    <div className="ui-row-sub"><span className="ui-num">{fmt.clock(l.created_at || l.time)}</span> · {l.agent}</div>
                  </div>
                  <div className="ui-row-tail">
                    <Pill tone={l.level === 'error' ? 'is-bad' : l.level === 'warn' ? 'is-warn' : l.level === 'success' ? 'is-ok' : 'is-quiet'}>{l.level}</Pill>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No activity" icon="list" hint="Pipeline runs will log here." />}
        </Card>

        <Card>
          <CardHead title="Leaderboard" sub="Ranked by live Sharpe" icon="target" actions={<Btn to="/strategies" size="pv-btn-sm" variant="pv-btn-ghost">Library</Btn>} />
          {ranked.length ? (
            <Rows>
              {ranked.slice(0, 5).map((s, i) => (
                <Row
                  key={s.id}
                  title={`${i + 1}. ${s.name}`}
                  sub={`${fmt.num(s.sharpe)} Sharpe · ${fmt.pct(s.returns)} return`}
                  tail={<StatusPill status={s.status} />}
                />
              ))}
            </Rows>
          ) : (
            <EmptyState
              title="No factors yet"
              icon="layers"
              hint="Generate your first candidate from the pipeline."
              action={<Link to="/pipeline" className="pv-btn pv-btn-primary pv-btn-sm">Open pipeline</Link>}
            />
          )}
        </Card>
      </div>
    </Page>
  );
}
