import { Link } from 'react-router-dom';
import { Logo, Icon } from './Brand';
import { LogStream } from './CodeTyper';

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const USER_RE = /^[A-Za-z0-9_.-]{3,24}$/;

export function passwordStrength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 5);
}

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-shell" style={{ minHeight: '100vh', width: '100%', display: 'grid', gridTemplateColumns: '1.05fr 1fr', background: 'var(--bg)' }}>
      {/* brand panel */}
      <div className="auth-brand" style={{ background: 'var(--pv-ink)', color: '#fff', padding: '2.5rem 3rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', gap: '2rem' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(185,255,102,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(185,255,102,.05) 1px, transparent 1px)', backgroundSize: '36px 36px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: -110, top: -110, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(185,255,102,.22), transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '.6rem', color: '#fff' }}>
            <Logo />
            <b style={{ fontFamily: 'var(--font-display)', letterSpacing: '.5px' }}>ALPHA SWARM</b>
          </Link>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', marginTop: '2.5rem', lineHeight: 1.12, color: '#fff', letterSpacing: '-.02em' }}>
            Agentic quant research,<br />with <span style={{ background: 'var(--pv-lime)', color: 'var(--pv-ink)', borderRadius: 8, padding: '0 .5rem' }}>evidence</span>.
          </h2>
          <p style={{ opacity: .7, marginTop: '.9rem', maxWidth: 400, lineHeight: 1.6 }}>Writer → Judge → Backtest → Measure → Learn. Every run logged, cost-adjusted, reproducible.</p>
        </div>
        {/* terminal illustration */}
        <div style={{ position: 'relative', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, overflow: 'hidden', maxWidth: 440 }}>
          <div style={{ display: 'flex', gap: '.35rem', padding: '.6rem .9rem', borderBottom: '1px solid rgba(255,255,255,.1)', alignItems: 'center' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#e14b4b' }} />
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#d97706' }} />
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#0ea472' }} />
            <span style={{ fontSize: '.68rem', opacity: .5, marginLeft: '.4rem', fontFamily: 'JetBrains Mono' }}>swarm · live loop</span>
          </div>
          <div style={{ padding: '.9rem 1rem' }}>
            <LogStream />
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          {['Writer + Judge agents', 'Vector backtest', 'SQLite memory', 'OOS discipline'].map((t) => (
            <span key={t} style={{ fontSize: '.72rem', border: '1px solid rgba(255,255,255,.2)', borderRadius: 20, padding: '.3rem .7rem', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
              <span style={{ color: 'var(--pv-lime)', display: 'inline-flex' }}><Icon.check style={{ width: 13, height: 13 }} /></span>{t}
            </span>
          ))}
        </div>
        <div style={{ position: 'relative', fontSize: '.75rem', opacity: .5 }}>Sswayam · Tarak · Varun · Vivaan — AI & ML in Quantitative Finance. Research tool, not investment advice.</div>
      </div>
      {/* form panel */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 2rem' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <h1 style={{ fontSize: '1.9rem', letterSpacing: '-.02em' }}>{title}</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '.3rem 0 1.4rem' }}>{subtitle}</p>
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}

export function Field({ label, error, children, hint }) {
  return (
    <label style={{ display: 'block', fontSize: '.8rem', fontWeight: 700 }}>
      {label}
      <div style={{ marginTop: '.35rem' }}>{children}</div>
      {hint && !error && <div style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '.75rem', marginTop: '.25rem' }}>{hint}</div>}
      {error && <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontWeight: 600, color: 'var(--danger)', fontSize: '.75rem', marginTop: '.25rem' }}><span aria-hidden>⚠</span>{error}</div>}
    </label>
  );
}
