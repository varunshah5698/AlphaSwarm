import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import { Icon } from '../components/Brand';
import { Page, PageHeader, Card, CardHead, Btn, Segmented, Field, Kpi, KpiGrid, Pill } from '../components/ui';
import { EmptyState } from '../components/PageState';
import { CHART, axisProps, gridProps, fmt } from '../lib/chartTheme';
import { ChartTip } from '../components/ChartTip';

const OPS = 'rank · delay · sma · ema · std · rsi · correlation · zscore · atr · sign · beta';

export default function BacktestPage() {
  const strategies = useStore((s) => s.strategies);
  const refresh = useStore((s) => s.refresh);
  const settings = useStore((s) => s.settings);

  const [mode, setMode] = useState('synthetic');
  const [formula, setFormula] = useState('rank(close / delay(close, 20) - 1) * -1');
  const [costs, setCosts] = useState(settings.transactionCost);
  const [slip, setSlip] = useState(settings.slippage);
  const [csvFile, setCsvFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [symbol, setSymbol] = useState('AAPL');
  const [years, setYears] = useState(5);
  const [out, setOut] = useState(null);
  const [running, setRunning] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { refresh(); }, []);

  const run = async () => {
    if (!formula.trim()) { toast.error('Enter an alpha formula'); return; }
    setRunning(true);
    try {
      if (mode === 'csv') {
        if (!csvFile) { toast.error('Choose a CSV file first'); setRunning(false); return; }
        setOut(await api.backtestCsv(csvFile, { formula, costs_bps: Number(costs), slippage_bps: Number(slip) }));
      } else if (mode === 'live') {
        if (!symbol.trim()) { toast.error('Enter a ticker symbol'); setRunning(false); return; }
        setOut(await api.backtestLive({ symbol: symbol.trim().toUpperCase(), formula, costs_bps: Number(costs), slippage_bps: Number(slip), years: Number(years) || 5 }));
      } else {
        setOut(await api.backtest({ formula, costs_bps: Number(costs), slippage_bps: Number(slip) }));
      }
    } catch (e) {
      toast.error(String(e.message).slice(0, 280));
    }
    setRunning(false);
  };

  const pickFile = (f) => {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) { toast.error('Only .csv files are accepted'); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error('File too large — 5MB maximum'); return; }
    setCsvFile(f);
    setOut(null);
  };

  const beat = out && out.buy_hold_return != null ? out.returns - out.buy_hold_return : null;
  const curve = out?.equity_curve || [];
  const tiles = out ? [
    ['Return', fmt.pct(out.returns), 'tone-ok'],
    ['Sharpe', fmt.num(out.sharpe), out.sharpe >= 1 ? 'tone-ok' : 'tone-warn'],
    ['Max DD', fmt.pct(out.max_dd), 'tone-bad'],
    ['Win rate', fmt.pct(out.win_rate, 1), ''],
    ['Trades', fmt.int(out.trades), ''],
    ['Ann. vol', fmt.pct(out.ann_vol), ''],
  ] : [];

  return (
    <Page>
      <PageHeader
        eyebrow="Alpha lab"
        title="Backtesting engine"
        sub="Next-bar execution with costs and slippage — synthetic lab, real market bars, or your own OHLCV file. Every run reports train vs unseen test."
        actions={<Segmented options={[['synthetic', 'Synthetic data'], ['live', 'Live market'], ['csv', 'My CSV']]} value={mode} onChange={(m) => { setMode(m); setOut(null); }} label="Data source" />}
      />

      {mode === 'live' && (
        <Card>
          <CardHead title="Live symbol" sub="Real daily bars — keyless feed, cached 12h, 60+ bars required" icon="activity" />
          <div className="ui-fields">
            <Field label="Ticker" hint="US stocks & ETFs, e.g. AAPL, SPY, NVDA">
              <input className="pv-input" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" maxLength={12} style={{ fontFamily: 'var(--font-mono)' }} />
            </Field>
            <Field label="History (years)" hint="0.25 – 10 years of daily bars">
              <input className="pv-input" type="number" min="0.25" max="10" step="0.25" value={years} onChange={(e) => setYears(e.target.value)} />
            </Field>
            <Field label="Quick picks" hint="One click to fill the ticker">
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                {['SPY', 'AAPL', 'MSFT', 'NVDA', 'TSLA'].map((s) => (
                  <Btn key={s} size="pv-btn-sm" onClick={() => setSymbol(s)}>{s}</Btn>
                ))}
              </div>
            </Field>
          </div>
        </Card>
      )}

      <Card>
        <CardHead title="Formula" sub="Vectorised across the full price history" icon="terminal" />

        <Field label="Alpha expression" hint={`Ops: ${OPS}`}>
          <input
            className="pv-input"
            style={{ fontFamily: 'var(--font-mono)' }}
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder="rank(close / delay(close, 20) - 1) * -1"
          />
        </Field>

        {mode === 'csv' && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
            className="ui-panel"
            style={{ marginTop: '.8rem', borderStyle: 'dashed', textAlign: 'center', cursor: 'pointer', background: dragging ? 'var(--pv-lime)' : 'var(--surface-hover)' }}
          >
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            {csvFile ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem', flexWrap: 'wrap', fontSize: '.85rem' }}>
                <Icon.file style={{ width: 16, height: 16 }} />
                <b>{csvFile.name}</b>
                <span className="ui-num ui-note">{(csvFile.size / 1024).toFixed(1)} KB</span>
                <span className="ui-note">click to replace</span>
              </div>
            ) : (
              <div style={{ fontSize: '.85rem' }}>
                <Icon.upload style={{ width: 18, height: 18, marginBottom: '.3rem' }} />
                <div><b>Drop your OHLCV CSV here</b> or click to browse</div>
                <div className="ui-note" style={{ marginTop: '.25rem' }}>Columns: date, open, high, low, close, volume · 60–5000 bars · max 5MB</div>
              </div>
            )}
          </div>
        )}

        <div className="ui-fields" style={{ marginTop: '.8rem' }}>
          <Field label="Load from library" hint="Prefills the formula with a stored factor">
            <select className="pv-input" value="" onChange={(e) => { if (e.target.value) setFormula(e.target.value); }}>
              <option value="">Choose a factor…</option>
              {strategies.map((s) => <option key={s.id} value={s.formula}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Costs (bps)"><input className="pv-input" type="number" min="0" max="500" value={costs} onChange={(e) => setCosts(e.target.value)} /></Field>
          <Field label="Slippage (bps)"><input className="pv-input" type="number" min="0" max="500" value={slip} onChange={(e) => setSlip(e.target.value)} /></Field>
        </div>

        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
          <Btn variant="pv-btn-primary" icon="play" onClick={run} disabled={running}>
            {running ? 'Running…' : mode === 'csv' ? 'Run on my CSV' : mode === 'live' ? `Run on ${symbol || '…'}` : 'Run backtest'}
          </Btn>
          <span className="ui-note">Next-bar execution · no look-ahead · costs deducted per position change</span>
        </div>
      </Card>

      {!out && !running && (
        <EmptyState
          icon="activity"
          title="No backtest yet"
          hint="Enter a formula or load one from the library, then run — metrics and the equity curve are computed live by the backend."
        />
      )}

      {out && (
        <>
          <KpiGrid>
            {tiles.map(([label, value, tone]) => <Kpi key={label} label={label} value={value} tone={tone} />)}
            {out.buy_hold_return != null && (
              <Kpi
                label="Buy & hold"
                value={fmt.pct(out.buy_hold_return)}
                foot={beat == null ? 'baseline' : `${beat >= 0 ? 'beats' : 'trails'} by ${Math.abs(beat).toFixed(2)} pts`}
                tone={beat != null && beat >= 0 ? 'tone-ok' : 'tone-warn'}
              />
            )}
            {out.bars ? <Kpi label="Bars tested" value={fmt.int(out.bars)} foot="after warm-up" /> : null}
          </KpiGrid>

          {out.train && out.test && (
            <Card>
              <CardHead
                title="Train vs unseen test"
                sub={`Selected insight: the gap between train and test Sharpe is the overfit detector · test ${out.test_bars} bars`}
                icon="shield"
                actions={<Pill tone={out.test.sharpe >= 0.4 && out.train.sharpe - out.test.sharpe < 1 ? 'is-ok' : 'is-warn'} dot>{out.test.sharpe >= 0.4 && out.train.sharpe - out.test.sharpe < 1 ? 'generalizes' : 'overfit risk'}</Pill>}
              />
              <KpiGrid>
                <Kpi label="Train Sharpe" value={fmt.num(out.train.sharpe)} foot={`${out.train_bars} bars · in-sample`} />
                <Kpi label="Test Sharpe" value={fmt.num(out.test.sharpe)} foot={`${out.test_bars} bars · unseen`} tone={out.test.sharpe >= 1 ? 'tone-ok' : 'tone-warn'} />
                <Kpi label="Test return" value={fmt.pct(out.test.returns)} />
                <Kpi label="Test max DD" value={fmt.pct(out.test.max_dd)} tone="tone-bad" />
              </KpiGrid>
            </Card>
          )}

          <Card>
            <CardHead
              title="Equity curve"
              sub={out.dataset ? `Dataset: ${out.dataset}` : 'Cumulative growth of $1'}
              icon="chart"
              actions={<Pill tone={out.sharpe >= 1 ? 'is-ok' : 'is-warn'} dot>Sharpe {fmt.num(out.sharpe)}</Pill>}
            />
            {curve.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={curve} margin={{ top: 4, right: 10, left: -16, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="t" {...axisProps} minTickGap={36} />
                  <YAxis {...axisProps} domain={['auto', 'auto']} tickFormatter={(v) => Number(v).toFixed(2)} />
                  <Tooltip content={<ChartTip labelPrefix="bar " formatter={(v) => Number(v).toFixed(4)} />} cursor={{ stroke: CHART.ink, strokeDasharray: '3 3' }} />
                  <Line type="monotone" dataKey="v" name="Equity" stroke={CHART.primary} strokeWidth={2.4} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyState icon="chart" title="No curve returned" hint="The engine ran but sent no equity points — try a longer dataset." />}
            <div className="ui-card-foot">
              <span className="ui-note">
                Costs {costs} bps + slippage {slip} bps · next-bar execution · single-factor, long/short clipped to ±1.
              </span>
            </div>
          </Card>
        </>
      )}
    </Page>
  );
}
