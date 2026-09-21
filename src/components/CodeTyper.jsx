import { useEffect, useState } from 'react';

// Respect the OS-level reduced-motion preference — everything renders instantly.
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/* ---------- tiny highlighter for the formula DSL ---------- */
const RULES = [
  ['comment', /^#.*/],
  ['string', /^"[^"]*"?/],
  ['number', /^\d+(?:\.\d+)?/],
  ['fn', /^[A-Za-z_][A-Za-z0-9_]*(?=\()/],
  ['ident', /^[A-Za-z_][A-Za-z0-9_]*/],
  ['punct', /^[()[\],.+\-*/=<>!]+/],
  ['space', /^\s+/],
];

const TOKEN_COLOR = {
  comment: 'rgba(232,245,216,.45)',
  string: '#b9ff66',
  number: '#f0b357',
  fn: '#7ee0b8',
  ident: '#e8f5e9',
  punct: 'rgba(232,245,216,.6)',
};

function tokenize(line) {
  const out = [];
  let rest = line;
  while (rest) {
    let matched = false;
    for (const [kind, re] of RULES) {
      const m = rest.match(re);
      if (m && m[0]) {
        out.push({ kind, text: m[0] });
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push({ kind: 'ident', text: rest[0] });
      rest = rest.slice(1);
    }
  }
  return out;
}

function Rendered({ text }) {
  return (
    <>
      {tokenize(text).map((t, i) => (
        <span key={i} style={TOKEN_COLOR[t.kind] ? { color: TOKEN_COLOR[t.kind] } : undefined}>
          {t.text}
        </span>
      ))}
    </>
  );
}

function Cursor() {
  return <span className="ct-cursor" aria-hidden="true" />;
}

/* ---------- writer-agent samples the block types through ---------- */
export const WRITER_SAMPLES = [
  {
    code: [
      '# hypothesis: "oversold dip bounce"',
      'signal = rank(close / delay(close, 20)',
      '           - 1) * -1',
      'position = (signal / 3).clip(-1, 1)',
      '           .shift(1)  # next-bar, no look-ahead',
    ],
    verdict: '✓ judge 90/100 · no leakage · Sharpe +1.03 · DD −7.2%',
  },
  {
    code: [
      '# hypothesis: "volatility breakout"',
      'vol = std(close, 10) / std(close, 30)',
      'signal = rank(vol) * sign(close - delay(close, 1))',
      'position = signal.clip(-1, 1)',
      '           .shift(1)  # next-bar, no look-ahead',
    ],
    verdict: '✓ judge 81/100 · Sharpe +1.45 · DD −12.1%',
  },
  {
    code: [
      '# hypothesis: "trend follows through"',
      'signal = sign(ema(close, 12) - ema(close, 26))',
      'risk = atr(high, low, close, 14) / close',
      'position = signal * rank(risk)',
      '           .shift(1)  # next-bar, no look-ahead',
    ],
    verdict: '✓ judge 85/100 · Sharpe +1.67 · DD −9.8%',
  },
];

/* ---------- the landing-page writer-agent block, typed live ---------- */
export function CodeTyper({ samples = WRITER_SAMPLES, speed = 24, lineDelay = 300, hold = 3200 }) {
  const reduced = useReducedMotion();
  const [si, setSi] = useState(0);
  const [li, setLi] = useState(0);
  const [ci, setCi] = useState(0);
  const [verdict, setVerdict] = useState(false);
  const sample = samples[si];
  const last = sample.code.length - 1;

  useEffect(() => {
    if (reduced) return undefined;
    let t;
    if (verdict) {
      t = setTimeout(() => {
        setSi((v) => (v + 1) % samples.length);
        setLi(0);
        setCi(0);
        setVerdict(false);
      }, hold);
    } else if (ci < sample.code[li].length) {
      t = setTimeout(() => setCi((c) => c + 1), speed);
    } else if (li < last) {
      t = setTimeout(() => { setLi((l) => l + 1); setCi(0); }, lineDelay);
    } else {
      t = setTimeout(() => setVerdict(true), lineDelay);
    }
    return () => clearTimeout(t);
  }, [reduced, si, li, ci, verdict, sample, last, speed, lineDelay, hold, samples.length]);

  const visible = reduced ? sample.code.length : li + 1;
  const aria = `Writer agent generating a factor for: ${sample.code[0].replace(/^#\s*hypothesis:\s*/i, '').replace(/"/g, '')}`;

  return (
    <div
      role="img"
      aria-label={aria}
      style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '.8rem', lineHeight: 1.7, minHeight: `${(last + 1.4) * 1.7}em` }}
    >
      {sample.code.slice(0, visible).map((line, j) => {
        const text = reduced ? line : j === li ? line.slice(0, ci) : line;
        const current = !reduced && j === li && !verdict;
        return (
          <div key={`${si}-${j}`} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: '1.7em' }}>
            <Rendered text={text} />
            {current && <Cursor />}
          </div>
        );
      })}
      {(verdict || reduced) && (
        <div className="ct-verdict" style={{ color: '#b9ff66', marginTop: '.2rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {sample.verdict}
          {!reduced && <Cursor />}
        </div>
      )}
    </div>
  );
}

/* ---------- streaming terminal for the auth screens ---------- */
export const SHELL_LINES = [
  ['writer', 'rank(close/delay(close,20)−1)·−1'],
  ['judge', 'approve 90/100 · no leakage'],
  ['backtest', 'Sharpe +1.03 · DD −7.2% · costs in'],
];

export function LogStream({ lines = SHELL_LINES, lineDelay = 700, hold = 2600 }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? lines.length : 0);

  useEffect(() => {
    if (reduced) return undefined;
    let t;
    if (shown < lines.length) t = setTimeout(() => setShown((s) => s + 1), lineDelay);
    else t = setTimeout(() => setShown(0), hold);
    return () => clearTimeout(t);
  }, [reduced, shown, lines.length, lineDelay, hold]);

  const complete = reduced || shown >= lines.length;

  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '.76rem', lineHeight: 1.8, minHeight: `${(lines.length + 1) * 1.8}em` }}>
      {lines.slice(0, reduced ? lines.length : shown).map(([agent, text]) => (
        <div key={agent} className="ct-line">
          <span style={{ color: 'var(--pv-lime)' }}>✔ {agent}</span>{' '}
          <span style={{ opacity: .75 }}>{text}</span>
        </div>
      ))}
      <div style={{ opacity: .4, display: 'flex', alignItems: 'center', gap: '.3rem' }}>
        <span className="ct-cursor" aria-hidden="true" style={{ width: '.5em', height: '1em' }} />
        {complete && <span>feedback stored → next hypothesis…</span>}
      </div>
    </div>
  );
}
