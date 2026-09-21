import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const DEFAULTS = 'SPY,AAPL,MSFT,TSLA,NVDA';

// Live price strip. Shows "feed offline" state when no key is configured (503)
// or the backend is unreachable — never blocks the rest of the dashboard.
export default function LiveTicker({ symbols = DEFAULTS }) {
  const [quotes, setQuotes] = useState(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const d = await api.marketLive(symbols);
        if (!stop) {
          setQuotes(d.quotes || []);
          setLive(true);
        }
      } catch {
        if (!stop) setLive(false);
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => { stop = true; clearInterval(id); };
  }, [symbols]);

  if (!live || !quotes) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', background: 'var(--surface-hover)', border: '1.5px dashed var(--border)', borderRadius: 10, padding: '.6rem 1rem', marginBottom: '1rem', fontSize: '.8rem', color: 'var(--text-muted)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)' }} />
        Live feed offline — set FINNHUB_API_KEY on the server for real-time prices. Synthetic lab still fully works.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '.6rem', overflowX: 'auto', paddingBottom: '.4rem', marginBottom: '1rem' }}>
      {quotes.map((q) => (
        <div key={q.symbol} style={{ minWidth: 150, background: '#fff', border: '1.5px solid var(--pv-ink)', borderRadius: 10, padding: '.55rem .8rem', boxShadow: '2px 2px 0 #101a13' }}>
          {q.error ? (
            <><div style={{ fontWeight: 800, fontSize: '.8rem' }}>{q.symbol}</div><div style={{ fontSize: '.7rem', color: 'var(--danger)' }}>unavailable</div></>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: '.8rem' }}>{q.symbol}</b>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: q.cached ? 'var(--warning)' : 'var(--success)' }} title={q.cached ? 'cached' : 'live'} />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>${q.price?.toLocaleString()}</div>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: (q.change_pct || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {(q.change_pct || 0) >= 0 ? '▲' : '▼'} {Math.abs(q.change_pct || 0).toFixed(2)}%
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
