import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { Card, CardHead, Btn, Field, StatusPill, TableWrap } from './ui';
import { LoadingSkeleton } from './PageState';
import { fmt } from '../lib/chartTheme';

// Runs EVERY stored strategy on live Finnhub bars for one symbol, ranked best-first.
export default function TestAllPanel() {
  const [symbol, setSymbol] = useState('SPY');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    if (!symbol.trim()) { toast.error('Enter a ticker symbol'); return; }
    setRunning(true);
    setResult(null);
    try {
      const out = await api.testAll({ symbol: symbol.trim().toUpperCase() });
      setResult(out);
      const passed = (out.results || []).filter((r) => r.verdict === 'active').length;
      toast.success(`${out.symbol}: ${passed}/${out.results.length} factors validate`);
    } catch (e) {
      toast.error(String(e.message).slice(0, 280));
    }
    setRunning(false);
  };

  return (
    <Card>
      <CardHead
        title="Live fire test"
        sub="Every stored factor, one real symbol — ranked by live Sharpe"
        icon="bolt"
        actions={result ? <span className="ui-count">{result.symbol} · {result.bars} bars</span> : null}
      />
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 180 }}>
          <Field label="Ticker">
            <input className="pv-input" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="SPY" maxLength={12} style={{ fontFamily: 'var(--font-mono)' }} />
          </Field>
        </div>
        <Btn variant="pv-btn-primary" icon="play" onClick={run} disabled={running}>
          {running ? 'Testing all factors…' : 'Test all on live data'}
        </Btn>
        <span className="ui-note">Real daily bars · costs + slippage · max 25 factors</span>
      </div>
      {running && <div style={{ marginTop: '.8rem' }}><LoadingSkeleton rows={4} /></div>}
      {result && !running && (
        <div style={{ marginTop: '.8rem' }}>
          {!result.results?.length ? (
            <p className="ui-note">No factors to test yet.</p>
          ) : (
            <TableWrap bordered={false}>
              <table className="data-table">
                <thead>
                  <tr><th>Factor</th><th className="right">Live Sharpe</th><th className="right">Return</th><th className="right">Max DD</th><th>Verdict</th></tr>
                </thead>
                <tbody>
                  {result.results.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{r.name}</div>
                        <div className="ui-note ui-truncate" style={{ maxWidth: 300, fontFamily: 'var(--font-mono)', fontSize: '.72rem' }}>{r.error || r.formula}</div>
                      </td>
                      <td className="right ui-num" style={{ fontWeight: 700 }}>{r.sharpe != null ? fmt.num(r.sharpe) : '—'}</td>
                      <td className="right ui-num">{r.returns != null ? fmt.pct(r.returns) : '—'}</td>
                      <td className="right ui-num" style={{ color: 'var(--danger)' }}>{r.max_dd != null ? fmt.pct(r.max_dd) : '—'}</td>
                      <td>{r.error ? <span className="ui-count">error</span> : <StatusPill status={r.verdict} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      )}
    </Card>
  );
}
