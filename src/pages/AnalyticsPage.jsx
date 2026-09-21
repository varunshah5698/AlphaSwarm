import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import { Page, PageHeader, Card, CardHead, Kpi, KpiGrid, Segmented, Pill, Btn, Checks } from '../components/ui';
import { KpiSkeleton, LoadingSkeleton, ErrorBanner, EmptyState } from '../components/PageState';
import { CHART, axisProps, gridProps, fmt } from '../lib/chartTheme';
import { ChartTip } from '../components/ChartTip';

const PERIODS = ['1M', '3M', '6M', '1Y', 'ALL'];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('1Y');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async (p = period) => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.analytics(p));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };
  useEffect(() => { load('1Y'); }, []);
  const changePeriod = (p) => { setPeriod(p); load(p); };

  const k = data?.kpis;
  const monthly = data?.monthly || [];
  const scatter = data?.scatter || [];
  const rolling = data?.rolling || [];
  const radar = data?.radar || [];

  return (
    <Page>
      <PageHeader
        eyebrow="Alpha lab"
        title="Analytics"
        sub="Risk and return metrics recomputed from stored backtests every time you change the window."
        actions={<Segmented options={PERIODS} value={period} onChange={changePeriod} label="Time window" />}
      />

      {error && <ErrorBanner message={error} onRetry={() => load()} />}

      {loading && !k ? <KpiSkeleton count={5} /> : !k ? (
        <EmptyState
          icon="gauge"
          title="No analytics yet"
          hint="Analytics are derived from stored factors — run the pipeline to generate the first backtest."
          action={<Btn to="/pipeline" variant="pv-btn-primary" size="pv-btn-sm">Open pipeline</Btn>}
        />
      ) : (
        <>
          <KpiGrid>
            <Kpi label="Avg return" value={fmt.pct(k.total_return)} foot={`window ${period}`} icon="activity" tone="tone-ok" />
            <Kpi label="Avg Sharpe" value={fmt.num(k.sharpe)} foot="risk-adjusted" icon="target" tone={k.sharpe >= 1 ? 'tone-ok' : 'tone-warn'} />
            <Kpi label="Worst drawdown" value={fmt.pct(k.max_dd)} foot="peak to trough" icon="arrowDown" tone="tone-bad" />
            <Kpi label="Avg win rate" value={fmt.pct(k.win_rate, 1)} foot="cost-adjusted" icon="check" />
            <Kpi label="Active factors" value={`${k.active_count}/${k.total_count}`} foot="passing all checks" icon="layers" variant="accent" />
          </KpiGrid>

          <div className="ui-grid halves">
            <Card>
              <CardHead title={`Period returns · ${period}`} sub="Best factor, sliced into equal windows" icon="chart" actions={<Pill tone="is-quiet">{monthly.length} slices</Pill>} />
              {loading ? <LoadingSkeleton rows={1} height={250} /> : monthly.length ? (
                <ResponsiveContainer width="100%" height={252}>
                  <BarChart data={monthly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="month" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip content={<ChartTip formatter={(v) => `${Number(v).toFixed(2)}%`} />} cursor={{ fill: 'rgba(185,255,102,.22)' }} />
                    <Bar dataKey="returns" name="Return %" fill={CHART.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState icon="chart" title="No return slices" hint="Not enough equity points in this window — try a longer period." />}
            </Card>

            <Card>
              <CardHead title="Risk vs return" sub="x = drawdown magnitude % · y = total return %" icon="target" actions={<Pill tone="is-quiet">{scatter.length} factors</Pill>} />
              {loading ? <LoadingSkeleton rows={1} height={250} /> : scatter.length ? (
                <ResponsiveContainer width="100%" height={252}>
                  <ScatterChart margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="x" name="Drawdown %" {...axisProps} />
                    <YAxis dataKey="y" name="Return %" {...axisProps} />
                    <ZAxis type="number" range={[90, 90]} />
                    <Tooltip content={<ChartTip formatter={(v) => `${Number(v).toFixed(2)}`} />} cursor={{ strokeDasharray: '3 3', stroke: CHART.lime }} />
                    <Scatter data={scatter} fill={CHART.primary} stroke={CHART.ink} strokeWidth={1.5} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : <EmptyState icon="target" title="No factors to plot" hint="Scatter appears once strategies are stored." />}
            </Card>
          </div>

          <div className="ui-grid halves">
            <Card>
              <CardHead title={`Rolling Sharpe · ${period}`} sub="Stability of the best factor over the window" icon="activity" />
              {loading ? <LoadingSkeleton rows={1} height={220} /> : rolling.length ? (
                <ResponsiveContainer width="100%" height={224}>
                  <LineChart data={rolling} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="day" {...axisProps} minTickGap={28} />
                    <YAxis {...axisProps} />
                    <Tooltip content={<ChartTip labelPrefix="bar " formatter={(v) => Number(v).toFixed(3)} />} cursor={{ stroke: CHART.ink, strokeDasharray: '3 3' }} />
                    <Line type="monotone" dataKey="sharpe" name="Rolling Sharpe" stroke={CHART.success} strokeWidth={2.4} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyState icon="activity" title="Not enough points" hint="Pick a longer window to build a rolling series." />}
            </Card>

            <Card>
              <CardHead title="Portfolio quality" sub="Composite score, 0–100 per axis" icon="gauge" />
              {loading ? <LoadingSkeleton rows={1} height={220} /> : radar.length ? (
                <ResponsiveContainer width="100%" height={224}>
                  <RadarChart data={radar} outerRadius="72%">
                    <PolarGrid stroke={CHART.grid} />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: CHART.axisLabel, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
                    <Tooltip content={<ChartTip formatter={(v) => `${v}/100`} />} />
                    <Radar name="Score" dataKey="value" stroke={CHART.primary} strokeWidth={2} fill={CHART.lime} fillOpacity={0.55} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : <EmptyState icon="gauge" title="No radar yet" hint="Needs at least one stored factor." />}
            </Card>
          </div>

          <Card className="soft">
            <CardHead title="How to read this" sub="The same discipline the Judge agent enforces" icon="shield" />
            <Checks items={[
              'Drawdown is a magnitude — a bigger bar means more pain, not more profit',
              'Win rate alone never validates a factor; costs and slippage are already deducted',
              'Rolling Sharpe should hold its sign across the window, not spike once',
              'Only judge-approved factors are eligible for the active portfolio',
            ]} />
          </Card>
        </>
      )}
    </Page>
  );
}
