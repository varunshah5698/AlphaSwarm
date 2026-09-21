import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { Icon } from '../components/Brand';
import { Page, PageHeader, Card, CardHead, Btn, Pill, StatusPill, Kpi, KpiGrid, Field, Formula, Meter, Code } from '../components/ui';
import { LoadingSkeleton, EmptyState } from '../components/PageState';
import { fmt } from '../lib/chartTheme';

const LOOP = [
  ['Research / data ingestion', 'book'],
  ['Writer agent · hypothesis → formula + code', 'terminal'],
  ['Judge agent · leakage + logic review', 'shield'],
  ['Backtest engine · 2520 bars with costs', 'chart'],
  ['Evaluation · Sharpe / drawdown / win-rate', 'bolt'],
  ['Feedback memory · store + learn', 'flask'],
];

const PRESETS = [
  'Stocks that drop sharply bounce back next day',
  'Breakouts on expanding volatility persist',
  'Volume and price divergence predicts drift',
  'Trend following works when volatility is low',
];

export default function PipelinePage() {
  const runPipeline = useStore((s) => s.runPipeline);
  const settings = useStore((s) => s.settings);

  const [hyp, setHyp] = useState(PRESETS[0]);
  const [costs, setCosts] = useState(settings.transactionCost);
  const [slip, setSlip] = useState(settings.slippage);
  const [symbol, setSymbol] = useState('');
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(-1);
  const [result, setResult] = useState(null);

  const run = async () => {
    if (!hyp.trim()) { toast.error('Enter a hypothesis first'); return; }
    setRunning(true);
    setResult(null);
    setPhase(0);
    for (let i = 0; i < LOOP.length; i++) {
      setPhase(i);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 420));
    }
    try {
      const out = await runPipeline(hyp, Number(costs), Number(slip), symbol.trim().toUpperCase());
      setResult(out);
      setPhase(LOOP.length);
      toast.success(`Cycle complete → ${out.status}`);
    } catch (e) {
      toast.error(`Pipeline failed: ${String(e.message || e).slice(0, 180)}`);
      setPhase(-1);
    }
    setRunning(false);
  };

  const m = result?.metrics;

  return (
    <Page>
      <PageHeader
        eyebrow="Alpha lab"
        title="Agentic pipeline"
        sub="Generate → critique → test → measure → learn. One hypothesis goes in, a judged and cost-adjusted factor comes out."
        actions={<Btn to="/reports" icon="file">Experiment record</Btn>}
      />

      <div className="ui-grid split-rev">
        <Card>
          <CardHead title="1 · Hypothesis" sub="Plain English in, formulaic alpha out" icon="sparkle" />

          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.8rem' }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`ui-pill ${hyp === p ? 'is-ok' : 'is-quiet'}`}
                style={{ textTransform: 'none', letterSpacing: 0, fontSize: '.7rem', cursor: 'pointer' }}
                onClick={() => setHyp(p)}
              >
                {p.length > 34 ? `${p.slice(0, 34)}…` : p}
              </button>
            ))}
          </div>

          <Field label="What should the swarm test?">
            <textarea className="pv-input" rows={4} value={hyp} onChange={(e) => setHyp(e.target.value)} placeholder="Stocks that drop sharply bounce back next day" />
          </Field>

          <div className="ui-fields" style={{ marginTop: '.8rem' }}>
            <Field label="Costs (bps)" hint="Charged on every position change">
              <input className="pv-input" type="number" min="0" max="500" value={costs} onChange={(e) => setCosts(e.target.value)} />
            </Field>
            <Field label="Slippage (bps)" hint="Added on top of costs">
              <input className="pv-input" type="number" min="0" max="500" value={slip} onChange={(e) => setSlip(e.target.value)} />
            </Field>
            <Field label="Live symbol (optional)" hint="Blank = synthetic lab · e.g. AAPL tests on real bars">
              <input className="pv-input" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="Blank = synthetic" maxLength={12} style={{ fontFamily: 'var(--font-mono)' }} />
            </Field>
          </div>

          <button className="pv-btn pv-btn-primary pv-btn-block" style={{ marginTop: '1rem' }} onClick={run} disabled={running}>
            {running ? <Icon.refresh style={{ width: 15, height: 15 }} /> : <Icon.play style={{ width: 14, height: 14 }} />}
            {running ? 'Running the swarm…' : 'Run full cycle'}
          </button>

          <div className="ui-timeline" style={{ marginTop: '1rem' }}>
            {LOOP.map(([label, icon], i) => {
              const I = Icon[icon] || Icon.bolt;
              const done = phase > i;
              const active = phase === i;
              return (
                <div key={label} className={`ui-step${done ? ' is-done' : active ? ' is-active' : ''}`}>
                  <span className="ui-step-idx">{done ? '✓' : i + 1}</span>
                  <I style={{ width: 15, height: 15, flexShrink: 0 }} />
                  <span className="ui-truncate">{label}</span>
                  {active && running && <Icon.refresh style={{ width: 14, height: 14, marginLeft: 'auto', flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHead
            title="2 · Result"
            sub="Writer output, Judge verdict and backtest metrics for this cycle"
            icon="terminal"
            actions={result ? <StatusPill status={result.status} /> : null}
          />

          {running && !result && <LoadingSkeleton rows={4} height={64} />}

          {!result && !running && (
            <EmptyState
              icon="terminal"
              title="No cycle run yet"
              hint="Enter a hypothesis and run the loop — the Writer's formula, the Judge's verdict and the backtest metrics land here."
            />
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <div className="ui-eyebrow" style={{ marginBottom: '.45rem' }}>Writer · {result.writer.name}</div>
                <Formula>{result.writer.formula}</Formula>
                {result.writer.code ? <div style={{ marginTop: '.6rem' }}><Code>{result.writer.code}</Code></div> : null}
              </div>

              <div>
                <div className="ui-eyebrow" style={{ marginBottom: '.45rem' }}>Judge verdict</div>
                <div className="ui-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
                    <Pill tone={result.judge.score >= 70 ? 'is-ok' : result.judge.score >= 50 ? 'is-warn' : 'is-bad'} dot>
                      {result.judge.verdict}
                    </Pill>
                    <span className="ui-num" style={{ fontWeight: 700 }}>{result.judge.score}/100</span>
                  </div>
                  <div style={{ margin: '.55rem 0 .6rem' }}>
                    <Meter
                      value={result.judge.score}
                      tone={result.judge.score >= 70 ? 'meter-ok' : result.judge.score >= 50 ? 'meter-warn' : 'meter-bad'}
                    />
                  </div>
                  {result.judge.notes ? <p style={{ fontSize: '.84rem', color: 'var(--text-secondary)' }}>{result.judge.notes}</p> : null}
                </div>
              </div>

              <div>
                <div className="ui-eyebrow" style={{ marginBottom: '.45rem' }}>Backtest · costs {costs} + slippage {slip} bps</div>
                <KpiGrid>
                  <Kpi label="Sharpe" value={fmt.num(m?.sharpe)} tone={m?.sharpe >= 1 ? 'tone-ok' : 'tone-warn'} />
                  <Kpi label="Return" value={fmt.pct(m?.returns)} tone="tone-ok" />
                  <Kpi label="Max DD" value={fmt.pct(m?.max_dd)} tone="tone-bad" />
                  <Kpi label="Win rate" value={fmt.pct(m?.win_rate, 1)} />
                  <Kpi label="Trades" value={fmt.int(m?.trades)} />
                </KpiGrid>
              </div>

              <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                <Btn to="/strategies" variant="pv-btn-primary" icon="layers">Open in library</Btn>
                <Btn to="/backtest" icon="activity">Re-run in backtester</Btn>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
