import { CHART } from '../lib/chartTheme';

// Shared tooltip: ink card with mono values — replaces Recharts' default white box.
export function ChartTip({ active, payload, label, labelPrefix = '', formatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="ui-chart-tip">
      {label !== undefined && label !== '' && (
        <div className="ui-chart-tip-label">{labelPrefix}{label}</div>
      )}
      {payload.map((p, i) => (
        <div className="ui-chart-tip-row" key={`${p.dataKey ?? p.name ?? i}`}>
          <span className="ui-chart-tip-swatch" style={{ background: p.color || p.fill || CHART.lime }} />
          <span className="ui-chart-tip-name">{p.name ?? p.dataKey}</span>
          <span className="ui-chart-tip-val">
            {formatter ? formatter(p.value, p) : (typeof p.value === 'number' ? p.value.toLocaleString() : p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default ChartTip;
