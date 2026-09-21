/* Alpha Swarm — shared UI primitives for the terminal.
   Every page composes these so spacing, borders and type stay identical everywhere. */
import { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Icon } from './Brand';
import { useCountUp } from '../hooks/useCountUp';
import { GLOSSARY } from '../lib/glossary';

/* ---------- page frame ---------- */
export function Page({ children, className = '' }) {
  return <div className={`ui-page ${className}`.trim()}>{children}</div>;
}

export function PageHeader({ eyebrow, title, sub, actions }) {
  return (
    <header className="ui-head">
      <div className="ui-head-text">
        {eyebrow && <span className="ui-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="ui-head-actions">{actions}</div>}
    </header>
  );
}

/* ---------- cards ---------- */
export function Card({ children, className = '', ...rest }) {
  return (
    <section className={`pv-card ${className}`.trim()} {...rest}>
      {children}
    </section>
  );
}

export function CardHead({ title, sub, actions, icon }) {
  const I = icon ? Icon[icon] : null;
  return (
    <div className="ui-card-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', minWidth: 0 }}>
        {I && (
          <span className="ui-kpi-icon" style={{ width: 30, height: 30 }}>
            <I style={{ width: 15, height: 15 }} />
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <h3 className="ui-truncate">{title}</h3>
          {sub && <div className="ui-card-sub">{sub}</div>}
        </div>
      </div>
      {actions && <div className="ui-card-head-actions">{actions}</div>}
    </div>
  );
}

/* ---------- KPI tile ---------- */
export function Kpi({ label, value, foot, icon, tone = '', variant = '' }) {
  const I = icon ? Icon[icon] : null;
  return (
    <div className={`ui-kpi ${tone} ${variant}`.trim()}>
      <div className="ui-kpi-top">
        <span className="ui-kpi-label">{label}</span>
        {I && <span className="ui-kpi-icon"><I style={{ width: 16, height: 16 }} /></span>}
      </div>
      <span className="ui-kpi-value">{value}</span>
      {foot && <span className="ui-kpi-foot">{foot}</span>}
    </div>
  );
}

export function KpiGrid({ children }) {
  return <div className="ui-kpis">{children}</div>;
}

/* ---------- status pill ---------- */
const PILL_TONE = {
  active: 'is-ok', approved: 'is-ok', read: 'is-ok', success: 'is-ok', ok: 'is-ok', running: 'is-ok',
  testing: 'is-info', reading: 'is-info', info: 'is-info', idle: 'is-quiet', unread: 'is-quiet', all: 'is-quiet',
  warn: 'is-warn', warning: 'is-warn', partial: 'is-warn',
  rejected: 'is-bad', error: 'is-bad', failed: 'is-bad', fail: 'is-bad',
};

export function Pill({ tone = 'is-quiet', dot = false, children, className = '' }) {
  return (
    <span className={`ui-pill ${tone} ${className}`.trim()}>
      {dot && <span className="ui-dot" />}
      {children}
    </span>
  );
}

export function StatusPill({ status, dot = true }) {
  const raw = String(status || 'unknown');
  return (
    <Pill tone={PILL_TONE[raw.toLowerCase()] || 'is-quiet'} dot={dot}>
      {raw}
    </Pill>
  );
}

/* ---------- toolbar + segmented control ---------- */
export function Toolbar({ children }) {
  return <div className="ui-toolbar">{children}</div>;
}

export function Segmented({ options, value, onChange, quiet = false, label }) {
  return (
    <div className={`ui-seg${quiet ? ' quiet' : ''}`} role="group" aria-label={label}>
      {options.map((o) => {
        const val = Array.isArray(o) ? o[0] : o;
        const text = Array.isArray(o) ? o[1] : o;
        return (
          <button key={val} type="button" aria-pressed={value === val} onClick={() => onChange(val)}>
            {text}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- buttons ---------- */
export function Btn({ variant = '', size = '', icon, children, className = '', ...rest }) {
  const I = icon ? Icon[icon] : null;
  const cls = ['pv-btn', variant, size, className].filter(Boolean).join(' ');
  if (rest.to) {
    const { to, ...linkRest } = rest;
    return (
      <Link to={to} className={cls} {...linkRest}>
        {I && <I style={{ width: 15, height: 15 }} />}
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {I && <I style={{ width: 15, height: 15 }} />}
      {children}
    </button>
  );
}

export function IconBtn({ icon, title, ...rest }) {
  const I = Icon[icon] || Icon.close;
  return (
    <button type="button" className="ui-iconbtn" title={title} aria-label={title} {...rest}>
      <I style={{ width: 15, height: 15 }} />
    </button>
  );
}

/* ---------- form field ---------- */
export function Field({ label, hint, error, children }) {
  return (
    <label className="ui-field">
      <span className="ui-field-label">{label}</span>
      {children}
      {hint && !error && <span className="ui-field-hint">{hint}</span>}
      {error && <span className="ui-field-error">{error}</span>}
    </label>
  );
}

/* ---------- meter ---------- */
export function Meter({ value, max = 100, tone = 'meter-lime' }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div className={`ui-meter ${tone}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- rows ---------- */
export function Row({ title, sub, tail, hard = false, onClick }) {
  const inner = (
    <>
      <div className="ui-row-main">
        <div className="ui-row-title ui-truncate">{title}</div>
        {sub && <div className="ui-row-sub ui-truncate">{sub}</div>}
      </div>
      {tail && <div className="ui-row-tail">{tail}</div>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`ui-row${hard ? ' hard' : ''}`} onClick={onClick} style={{ textAlign: 'left', font: 'inherit', width: '100%', cursor: 'pointer' }}>
        {inner}
      </button>
    );
  }
  return <div className={`ui-row${hard ? ' hard' : ''}`}>{inner}</div>;
}

export function Rows({ children }) {
  return <div className="ui-rows">{children}</div>;
}

/* ---------- modal ----------
   Portalled to <body> so an animated ancestor can never become the containing
   block for position:fixed, and so the overlay always covers the viewport. */
export function Modal({ open, onClose, title, sub, children, footer }) {
  // Keep the latest handler without re-binding listeners on every parent render.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current?.(); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="ui-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="ui-modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Dialog'}>
        <div className="ui-modal-head">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '1.15rem' }}>{title}</h2>
            {sub && <div className="ui-card-sub">{sub}</div>}
          </div>
          <IconBtn icon="close" title="Close" onClick={onClose} />
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* ---------- code ---------- */
export function Code({ children, light = false }) {
  return <pre className={`ui-code${light ? ' light' : ''}`}>{children}</pre>;
}

export function Formula({ children }) {
  return <div className="ui-formula">{children}</div>;
}

/* ---------- table ---------- */
export function TableWrap({ children, bordered = true }) {
  return <div className={`ui-tablewrap${bordered ? ' bordered' : ''}`}>{children}</div>;
}

/* ---------- callout ---------- */
export function Quote({ children }) {
  return <div className="ui-quote"><p>{children}</p></div>;
}

export function Bullets({ items }) {
  return (
    <ul className="ui-bullets">
      {items.map((t) => <li key={t}>{t}</li>)}
    </ul>
  );
}

export function Checks({ items }) {
  return (
    <ul className="ui-checks">
      {items.map((t) => (
        <li key={t}>
          <Icon.check style={{ width: 16, height: 16 }} />
          {t}
        </li>
      ))}
    </ul>
  );
}

/* ---------- count-up number ---------- */
export function CountUp({ value, format = (v) => String(Math.round(v)), className = '' }) {
  const n = useCountUp(value);
  return <span className={className}>{format(Number(n))}</span>;
}

/* ---------- sparkline (pure SVG, no chart lib overhead) ---------- */
export function Sparkline({ data, width = 132, height = 34, stroke = 'var(--pv-ink)', strokeWidth = 2, area = false }) {
  const gid = useId();
  const pts = useMemo(() => {
    const vals = (data || []).map((d) => (typeof d === 'number' ? d : d?.v)).filter((v) => Number.isFinite(v));
    if (vals.length < 2) return null;
    const min = Math.min(...vals);
    const span = (Math.max(...vals) - min) || 1;
    const stepX = width / (vals.length - 1);
    return vals.map((v, i) => [+(i * stepX).toFixed(2), +(height - 3 - ((v - min) / span) * (height - 6)).toFixed(2)]);
  }, [data, width, height]);

  if (!pts) return null;
  const line = pts.map((p) => p.join(',')).join(' ');
  const areaPath = `M0,${height} L${line.split(' ').join(' L')} L${width},${height} Z`;
  return (
    <div className="spark" aria-hidden="true">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {area && (
          <>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity=".32" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${gid})`} />
          </>
        )}
        <polyline points={line} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ---------- pulsing live dot ---------- */
export function Pulse({ on = true }) {
  return <span className={`pulse-dot${on ? '' : ' off'}`} aria-hidden="true" />;
}

/* ---------- glossary term with hover definition ---------- */
export function Term({ t, children }) {
  const key = (t || String(children || '')).toLowerCase();
  const tip = GLOSSARY[key];
  if (!tip) return <>{children}</>;
  return (
    <span className="term" data-tip={tip} tabIndex={0}>{children}</span>
  );
}

