import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo, Icon, IconBadge } from '../components/Brand';
import { CodeTyper } from '../components/CodeTyper';
import { api } from '../lib/api';

const VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_192508_4eecde4c-f835-4f4b-b255-eafd1156da99.mp4';

const STEPS = [
  ['Research', 'Hypothesis + dataset ingestion', 'book'],
  ['Writer', 'Hypothesis → factor, rule, code', 'terminal'],
  ['Judge', 'Leakage, logic & complexity review', 'shield'],
  ['Backtest', '2520 bars · costs + slippage', 'chart'],
  ['Evaluate', 'Sharpe · drawdown · win-rate', 'bolt'],
  ['Learn', 'Stored to feedback memory', 'flask'],
];

const FEATURES = [
  ['flask', 'Interpretable factors', 'Formulaic alphas built from rank / delay / rsi / ema operators. Every signal reads as math — no black boxes.'],
  ['shield', 'Judge + safeguards', 'Look-ahead, leakage and complexity checks on every candidate, plus transaction costs, slippage and out-of-sample splits.'],
  ['chart', 'Reproducible lab', 'Each run stores hypothesis, generated code, metrics and equity curve in SQLite. Ablate the Judge or the loop any time.'],
];

const GUARDS = ['No look-ahead bias — next-bar execution', 'Costs + slippage on every backtest', 'Dev / unseen evaluation splits', 'Complexity cap (≤12 ops) blocks overfit'];

function LiveStats() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.publicStats().then(setS).catch(() => {});
  }, []);
  const items = s
    ? [[s.strategies, 'factors mined'], [s.experiments, 'cycles run'], [`${s.best_sharpe >= 0 ? '+' : ''}${s.best_sharpe}`, 'best Sharpe'], [s.active, 'active now']]
    : [['—', 'factors mined'], ['—', 'cycles run'], ['—', 'best Sharpe'], ['—', 'active now']];
  return (
    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '2rem' }}>
      {items.map(([v, l]) => (
        <div key={l}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.6rem' }}>
            {v}
            {s && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', marginLeft: '.5rem' }} title="live from the lab" />}
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{l}{s ? ' · live' : ''}</div>
        </div>
      ))}
    </div>
  );
}

function DashboardPreview() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.publicStats().then(setS).catch(() => {});
  }, []);
  const bars = [42, 58, 47, 66, 61, 78, 72, 88, 83, 96, 91, 104];
  const best = s?.best_sharpe ?? '—';
  return (
    <div className="pv-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.9rem 1.2rem', borderBottom: '1.5px solid var(--pv-ink)', background: 'var(--surface-hover)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <Logo size={28} />
          <b style={{ fontFamily: 'var(--font-display)', fontSize: '.9rem' }}>Terminal preview</b>
        </div>
        <span className="pv-badge" style={{ background: 'var(--pv-lime)' }}>LIVE LAB DATA</span>
      </div>
      <div style={{ padding: '1.2rem', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '.8rem' }} className="preview-kpis">
        {[[`Sharpe ${best}`, 'best validated factor'], [`${s?.strategies ?? '—'}`, 'factors in memory'], [`${s?.active ?? '—'}`, 'passing all checks']].map(([v, l]) => (
          <div key={l} style={{ background: 'var(--bg)', border: '1.5px solid var(--pv-ink)', borderRadius: 10, padding: '.8rem', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>{v}</div>
            <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)' }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 1.2rem 1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110, background: 'var(--bg)', border: '1.5px solid var(--pv-ink)', borderRadius: 10, padding: '0.8rem' }} aria-hidden>
          {bars.map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0', background: i === bars.length - 1 ? 'var(--pv-lime)' : 'var(--pv-ink)', border: '1px solid var(--pv-ink)', opacity: i === bars.length - 1 ? 1 : 0.85 }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.7rem', color: 'var(--text-muted)', marginTop: '.4rem' }}>
          <span>Equity · best alpha vs benchmark</span><Link to="/register" style={{ fontWeight: 700, color: 'var(--primary)' }}>Open terminal →</Link>
        </div>
      </div>
    </div>
  );
}

const PERSONAS = [
  ['book', 'Quant researchers', 'Prototype factor ideas in minutes with leakage checks and cost-adjusted backtests attached to every result.'],
  ['flask', 'Students & quant clubs', 'Learn how real alpha research works — hypothesis, review, test, measure — on a reproducible pipeline.'],
  ['terminal', 'Developers', 'Authenticated REST API, experiment records in SQLite, CSV upload for your own market data.'],
];

const SECURITY = [
  ['shield', 'Validated, not cherry-picked', 'A strong backtest alone never passes — Judge review, costs, slippage and unseen splits are mandatory.'],
  ['check', 'Your data stays yours', 'Authenticated API, hashed passwords, expiring sessions. Uploaded CSVs are used for your run only.'],
  ['bolt', 'Reproducible by design', 'Hypothesis, code, metrics and equity curve stored per run. Re-run anything, ablate everything.'],
];

export default function LandingPage() {
  // Animated loop: steps cycle 1→6 on a timer; footer numbers are real lab stats.
  const [liveStep, setLiveStep] = useState(0);
  const [lab, setLab] = useState(null);
  useEffect(() => {
    const id = setInterval(() => setLiveStep((s) => (s + 1) % STEPS.length), 1300);
    api.publicStats().then(setLab).catch(() => {});
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', width: '100%', flex: 1, alignSelf: 'stretch' }}>
      {/* ---------- nav ---------- */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.9rem 2rem', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)', borderBottom: '1.5px solid var(--pv-ink)', width: '100%' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <Logo />
          <b style={{ fontFamily: 'var(--font-display)', letterSpacing: '.5px' }}>ALPHA SWARM</b>
          <span className="pv-badge nav-badge" style={{ background: 'var(--pv-lime)' }}>AGENTIC QUANT</span>
        </Link>
        <div className="nav-links" style={{ display: 'flex', gap: '1.4rem', fontSize: '.85rem', fontWeight: 600 }}>
          <a href="#how">How it works</a>
          <a href="#safeguards">Safeguards</a>
          <a href="#team">Team</a>
        </div>
        <div style={{ display: 'flex', gap: '.6rem' }}>
          <Link to="/login" className="pv-btn">Sign in</Link>
          <Link to="/register" className="pv-btn pv-btn-primary">Get started →</Link>
        </div>
      </nav>

      <div className="landing-body" style={{ maxWidth: 1180, margin: '0 auto', padding: '4rem 2rem 3rem', width: '100%' }}>
        {/* ---------- hero ---------- */}
        <div className="landing-hero" style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: '3rem', alignItems: 'center' }}>
          <div>
            <span className="pv-badge" style={{ background: '#fff' }}>✦ AI & ML · QUANTITATIVE FINANCE</span>
            <h1 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.3rem)', lineHeight: 1.18, margin: '1.1rem 0 1rem', letterSpacing: '-.025em', overflow: 'visible', paddingBottom: '.06em' }}>
              Mine trading alphas<br />with a <span style={{ display: 'inline-block', lineHeight: 1.15, background: 'var(--pv-lime)', border: '1.5px solid var(--pv-ink)', borderRadius: 12, padding: '.02em .5em .09em', boxShadow: '3px 3px 0 #101a13', whiteSpace: 'nowrap' }}>swarm</span>, not<br />spreadsheets.
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.08rem', maxWidth: 540, lineHeight: 1.6 }}>
              Writer and Judge agents turn a one-line hypothesis into an interpretable,
              cost-adjusted, backtested factor — then file it in memory and mine the next one.
            </p>
            <div style={{ display: 'flex', gap: '.7rem', marginTop: '1.6rem', flexWrap: 'wrap' }}>
              <Link to="/register" className="pv-btn pv-btn-primary" style={{ padding: '.8rem 1.5rem', fontSize: '.95rem' }}>Launch terminal →</Link>
              <Link to="/login" className="pv-btn" style={{ padding: '.8rem 1.5rem', fontSize: '.95rem' }}>View demo</Link>
            </div>
            <LiveStats />
          </div>

          {/* pipeline visual */}
          <div className="pv-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <b style={{ fontFamily: 'var(--font-display)' }}>The loop</b>
              <span className="pv-badge" style={{ background: 'var(--success-light)' }}><span className="pv-pulse" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', marginRight: '.35rem' }} />RUNNING</span>
            </div>
            <div style={{ position: 'relative', paddingLeft: '1.9rem' }}>
              <div style={{ position: 'absolute', left: 11, top: 8, bottom: 8, width: 2, background: 'var(--border)', borderRadius: 2 }} />
              <div style={{ position: 'absolute', left: 11, top: 8, width: 2, borderRadius: 2, background: 'var(--success)', transition: 'height .5s ease', height: `calc(${((liveStep + 1) / STEPS.length) * 100}% - 16px)` }} />
              {STEPS.map(([t, d, icon], i) => {
                const I = Icon[icon];
                const active = i === liveStep;
                const done = i < liveStep;
                return (
                  <div key={t} style={{ position: 'relative', display: 'flex', gap: '.8rem', padding: '.5rem 0', alignItems: 'flex-start', opacity: done || active ? 1 : 0.45, transition: 'opacity .4s ease' }}>
                    <div style={{ position: 'absolute', left: '-1.9rem', width: 24, height: 24, borderRadius: '50%', background: active ? 'var(--pv-lime)' : done ? 'var(--success-light)' : '#fff', border: '1.5px solid var(--pv-ink)', boxShadow: active ? '0 0 0 4px rgba(185,255,102,.45), 2px 2px 0 #101a13' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pv-ink)', transition: 'all .4s ease' }}>
                      <I style={{ width: 13, height: 13 }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '.86rem' }}><span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '.4rem' }}>{i + 1}</span>{t}{active && <span style={{ marginLeft: '.5rem', fontSize: '.68rem', fontWeight: 800, color: 'var(--success)' }}>● WORKING</span>}</div>
                      <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{d}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '.9rem', paddingTop: '.8rem', borderTop: '1.5px solid var(--border)', fontSize: '.76rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.4rem' }}>
              <span>{lab ? `${lab.experiments} cycles completed` : 'connecting to lab…'}</span>
              <span>{lab && lab.best_sharpe != null ? `best Sharpe ${lab.best_sharpe >= 0 ? '+' : ''}${lab.best_sharpe}` : ''}</span>
            </div>
          </div>
        </div>

        {/* ---------- 3D showcase ---------- */}
        <div className="landing-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem', marginTop: '2.5rem', alignItems: 'center' }}>
          <div>
            <span className="pv-badge" style={{ background: 'var(--pv-lime)' }}>3D · WATCH THE SWARM</span>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', margin: '.8rem 0 .6rem', letterSpacing: '-.02em' }}>Six agents. One loop.<br />Zero spreadsheets.</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 440 }}>
              Research flows into the Writer, the Judge inspects every factor, the backtester
              prices it with costs — and memory carries the lesson into the next cycle.
            </p>
            <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.1rem', flexWrap: 'wrap' }}>
              <Link to="/pipeline" className="pv-btn pv-btn-primary">Try the loop →</Link>
            </div>
          </div>
          <div className="pv-card" style={{ padding: '.8rem' }}>
            <video
              src={VIDEO_URL}
              autoPlay muted loop playsInline
              preload="metadata"
              style={{ width: '100%', borderRadius: 10, border: '1.5px solid var(--pv-ink)', display: 'block', background: '#000' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.6rem', fontSize: '.75rem', color: 'var(--text-muted)' }}>
              <span>Alpha Swarm · agentic mining loop</span>
              <span className="pv-badge" style={{ background: '#fff' }}>10s · HD</span>
            </div>
          </div>
        </div>

        {/* ---------- code sample ---------- */}
        <div id="how" className="landing-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '3rem', scrollMarginTop: 90 }}>
          <div style={{ background: 'var(--pv-ink)', color: '#e8f5e9', borderRadius: 12, border: '1.5px solid var(--pv-ink)', boxShadow: 'var(--pv-hard)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '.4rem', padding: '.7rem 1rem', borderBottom: '1px solid rgba(255,255,255,.12)', alignItems: 'center' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e14b4b' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#d97706' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#0ea472' }} />
              <span style={{ fontSize: '.72rem', opacity: .6, marginLeft: '.5rem', fontFamily: 'JetBrains Mono' }}>writer_agent.py</span>
            </div>
            <div style={{ padding: '1.1rem 1.2rem', overflowX: 'auto' }}>
              <CodeTyper />
            </div>
          </div>
          <div className="pv-card" style={{ background: 'var(--primary-light)' }}>
            <span className="pv-badge" style={{ background: 'var(--pv-lime)' }}>JUDGE VERDICT · APPROVE 90/100</span>
            <div style={{ marginTop: '.9rem', display: 'flex', flexDirection: 'column', gap: '.55rem', fontSize: '.85rem' }}>
              {[['No look-ahead bias', 'uses lagged operators'], ['No data-leakage keywords', 'clean scan'], ['Interpretable', '2 ops — overfit-safe'], ['Backtest', 'Sharpe +1.03 · DD −7.2% · costs in']].map(([t, d]) => (
                <div key={t} style={{ display: 'flex', gap: '.6rem', alignItems: 'flex-start', background: '#fff', border: '1.5px solid var(--pv-ink)', borderRadius: 8, padding: '.55rem .7rem' }}>
                  <span style={{ color: 'var(--success)', flexShrink: 0, marginTop: '.1rem' }}><Icon.check style={{ width: 16, height: 16 }} /></span>
                  <span><b>{t}</b> <span style={{ color: 'var(--text-secondary)' }}>— {d}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- features ---------- */}
        <div className="landing-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginTop: '1rem' }}>
          {FEATURES.map(([icon, t, d]) => (
            <div key={t} className="pv-card">
              <IconBadge icon={icon} />
              <h3 style={{ margin: '.9rem 0 .4rem' }}>{t}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem', lineHeight: 1.6 }}>{d}</p>
            </div>
          ))}
        </div>

        {/* ---------- dashboard preview (fintech trust pattern) ---------- */}
        <div className="landing-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
          <div>
            <span className="pv-badge" style={{ background: '#fff' }}>INSIDE THE TERMINAL</span>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', margin: '.8rem 0 .6rem', letterSpacing: '-.02em' }}>Proof before promises.</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 460 }}>
              No screenshots of rented Lamborghinis. The terminal shows every factor's Sharpe,
              drawdown and equity curve next to its costs — winners and rejects alike.
              What you see below is live data from the running lab.
            </p>
            <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.1rem', flexWrap: 'wrap' }}>
              <Link to="/register" className="pv-btn pv-btn-primary">Start mining →</Link>
              <a href="#safeguards" className="pv-btn">How we keep it honest</a>
            </div>
          </div>
          <DashboardPreview />
        </div>

        {/* ---------- security band ---------- */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginTop: '1rem' }} className="landing-cards">
          {SECURITY.map(([icon, t, d]) => (
            <div key={t} className="pv-card" style={{ background: 'var(--surface-hover)' }}>
              <IconBadge icon={icon} bg="#fff" />
              <h3 style={{ margin: '.9rem 0 .4rem', fontSize: '1.02rem' }}>{t}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', lineHeight: 1.6 }}>{d}</p>
            </div>
          ))}
        </div>

        {/* ---------- who it's for ---------- */}
        <div style={{ marginTop: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
            <span className="pv-badge" style={{ background: '#fff' }}>WHO IT'S FOR</span>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', marginTop: '.7rem', letterSpacing: '-.02em' }}>Built for people who backtest.</h2>
          </div>
          <div className="landing-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
            {PERSONAS.map(([icon, t, d]) => (
              <div key={t} className="pv-card" style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><IconBadge icon={icon} /></div>
                <h3 style={{ margin: '.9rem 0 .4rem' }}>{t}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', lineHeight: 1.6 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- safeguards ---------- */}
        <div id="safeguards" className="pv-card" style={{ marginTop: '1rem', scrollMarginTop: 90 }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <h3>Built to distrust itself</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', marginTop: '.3rem' }}>A strong backtest alone never passes. Every candidate survives the same gauntlet before it touches memory.</p>
            </div>
            <div style={{ flex: '2 1 320px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
              {GUARDS.map((g) => (
                <div key={g} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', fontSize: '.83rem', fontWeight: 600 }}>
                  <span style={{ color: 'var(--success)' }}><Icon.check style={{ width: 17, height: 17 }} /></span>{g}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- final CTA ---------- */}
        <div className="pv-card" style={{ marginTop: '2.5rem', background: 'var(--pv-lime)', textAlign: 'center', padding: '2.5rem 2rem' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.1rem)', letterSpacing: '-.02em' }}>Turn your next idea into a tested factor.</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '.5rem' }}>Free for research. One hypothesis is all it takes to start the swarm.</p>
          <div style={{ display: 'flex', gap: '.7rem', justifyContent: 'center', marginTop: '1.2rem', flexWrap: 'wrap' }}>
            <Link to="/register" className="pv-btn pv-btn-dark" style={{ padding: '.8rem 1.6rem' }}>Create account →</Link>
            <Link to="/login" className="pv-btn" style={{ padding: '.8rem 1.6rem', background: '#fff' }}>Sign in</Link>
          </div>
        </div>

        {/* ---------- team + footer ---------- */}
        <div id="team" style={{ marginTop: '1rem', scrollMarginTop: 90, background: 'var(--pv-ink)', color: '#fff', borderRadius: 16, border: '1.5px solid var(--pv-ink)', boxShadow: 'var(--pv-hard)', padding: '2rem', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1.5rem' }} className="landing-footer">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
              <Logo />
              <b style={{ fontFamily: 'var(--font-display)' }}>ALPHA SWARM</b>
            </div>
            <p style={{ opacity: .65, fontSize: '.83rem', marginTop: '.8rem', maxWidth: 300 }}>An agentic research assistant for quant finance — automating repetitive research while keeping testing and interpretability at the center.</p>
          </div>
          <div>
            <div style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.08em', opacity: .5, marginBottom: '.6rem' }}>Team</div>
            {['Sswayam Shheth', 'Tarak Shah', 'Varun Shah', 'Vivaan Bhimani'].map((n) => (
              <div key={n} style={{ fontSize: '.86rem', padding: '.2rem 0' }}>{n}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.08em', opacity: .5, marginBottom: '.6rem' }}>Terminal</div>
            {[['/register', 'Get started'], ['/login', 'Sign in'], ['/api-docs', 'API docs (in app)']].map(([to, l]) => (
              <div key={to} style={{ padding: '.2rem 0' }}><Link to={to} style={{ fontSize: '.86rem', color: 'var(--pv-lime)' }}>{l} →</Link></div>
            ))}
            <div style={{ fontSize: '.72rem', opacity: .45, marginTop: '.8rem' }}>Research automation, not investment advice.</div>
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '1.2rem' }}>Python FastAPI · React · SQLite · Pandas/NumPy</p>
      </div>
    </div>
  );
}
