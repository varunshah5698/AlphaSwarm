import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { Page, PageHeader, Card, CardHead, Btn, Field, Pill, Checks, Kpi, KpiGrid } from '../components/ui';

const FIELDS = [
  ['transactionCost', 'Transaction cost', 'bps', 'Charged on every position change in backtests and pipeline runs'],
  ['slippage', 'Slippage', 'bps', 'Added on top of the transaction cost'],
  ['backtestPeriod', 'Backtest window', '', 'Reference label for reports — the engine always runs 2520 bars'],
  ['benchmark', 'Benchmark', '', 'Series used for the dashboard equity comparison'],
  ['riskFreeRate', 'Risk-free rate', '%', 'Reference for future Sharpe-excess work'],
];

const DEFAULTS = { transactionCost: 10, slippage: 5, backtestPeriod: '2014-2024', benchmark: 'SPY', riskFreeRate: 4.5 };

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const user = useStore((s) => s.user);
  const backendOk = useStore((s) => s.backendOk);
  const strategies = useStore((s) => s.strategies);
  const experiments = useStore((s) => s.experiments);
  const [dirty, setDirty] = useState(false);

  const set = (k, v) => {
    updateSettings({ [k]: v });
    setDirty(true);
  };

  const save = () => {
    try {
      localStorage.setItem('as_settings', JSON.stringify(useStore.getState().settings));
    } catch {
      toast.error('Could not write to local storage');
      return;
    }
    setDirty(false);
    toast.success('Defaults saved — Pipeline and Backtest will use them');
  };

  const reset = () => {
    updateSettings(DEFAULTS);
    setDirty(true);
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        sub="Run defaults applied to the Pipeline and Backtest engines. Stored in this browser only — never sent to the backend."
        actions={dirty ? <Pill tone="is-warn" dot>Unsaved changes</Pill> : <Pill tone="is-ok" dot>Saved</Pill>}
      />

      <Card>
        <CardHead title="Execution defaults" sub="Applied whenever you run a cycle or a backtest" icon="gear" />
        <div className="ui-fields">
          {FIELDS.map(([key, label, unit, hint]) => (
            <Field key={key} label={unit ? `${label} (${unit})` : label} hint={hint}>
              <input
                className="pv-input"
                value={settings[key]}
                onChange={(e) => set(key, e.target.value)}
                inputMode={key === 'backtestPeriod' || key === 'benchmark' ? 'text' : 'decimal'}
              />
            </Field>
          ))}
        </div>
        <div className="ui-card-foot" style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn variant="pv-btn-primary" icon="check" onClick={save}>Save defaults</Btn>
          <Btn icon="refresh" onClick={reset}>Reset to defaults</Btn>
        </div>
      </Card>

      <div className="ui-grid halves">
        <Card>
          <CardHead title="Where these apply" sub="No hidden state — every number is used explicitly" icon="activity" />
          <Checks items={[
            'Costs and slippage are deducted on every position change',
            'Backtest window is a label — the engine runs the full 2520-bar history',
            'Benchmark drives the dashboard alpha-vs-benchmark overlay',
            'Values persist in localStorage and survive reloads',
          ]} />
        </Card>

        <Card>
          <CardHead title="Session & data" sub="What this browser is currently holding" icon="lock" />
          <KpiGrid>
            <Kpi label="Signed in as" value={<span style={{ fontSize: '1.05rem' }}>{user?.username || user?.name || '—'}</span>} foot={user?.email || 'no email on file'} icon="users" />
            <Kpi label="Backend" value={<span style={{ fontSize: '1.15rem' }}>{backendOk ? 'Live' : 'Offline'}</span>} foot={backendOk ? 'API responding' : 'using cached data'} tone={backendOk ? 'tone-ok' : 'tone-warn'} icon="plug" />
            <Kpi label="Factors stored" value={strategies.length} foot="in SQLite memory" icon="layers" />
            <Kpi label="Cycles recorded" value={experiments.length} foot="reproducible runs" icon="file" />
          </KpiGrid>
        </Card>
      </div>
    </Page>
  );
}
