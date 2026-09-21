import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Icon } from '../components/Brand';
import { Page, PageHeader, Card, CardHead, Kpi, KpiGrid, Meter, Pill, Toolbar, Segmented, Btn, Row, Rows } from '../components/ui';
import { KpiSkeleton, LoadingSkeleton, ErrorBanner, EmptyState } from '../components/PageState';
import { fmt } from '../lib/chartTheme';

const ICONS = { writer: 'terminal', judge: 'shield', backtest: 'chart', feedback: 'database', data: 'cpu', research: 'library' };

export default function AgentsPage() {
  const agents = useStore((s) => s.agents);
  const logs = useStore((s) => s.logs);
  const refresh = useStore((s) => s.refresh);
  const loading = useStore((s) => s.loading);
  const backendOk = useStore((s) => s.backendOk);

  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      await refresh();
      if (!useStore.getState().backendOk) setError('Backend unreachable — showing the last known registry.');
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const shown = agents.filter((a) => filter === 'all' || a.status === filter);
  const active = agents.filter((a) => a.status === 'active').length;
  const tasks = agents.reduce((n, a) => n + (a.tasks || 0), 0);
  const successRate = tasks ? Math.round((agents.reduce((n, a) => n + (a.success || 0), 0) / tasks) * 100) : 0;

  // Per-agent activity derived from the live log stream.
  const logCount = (name) => logs.filter((l) => (l.agent || '').toLowerCase().includes(name.split(' ')[0].toLowerCase())).length;

  return (
    <Page>
      <PageHeader
        eyebrow="Operations"
        title="Agent registry"
        sub="The roles that make up the loop — who writes, who judges, who measures, and what remembers."
        actions={<Btn icon="refresh" onClick={load}>Re-sync registry</Btn>}
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading && !agents.length ? <KpiSkeleton count={4} /> : (
        <KpiGrid>
          <Kpi label="Agents online" value={`${active}/${agents.length}`} foot="registered in the loop" icon="bot" variant="accent" />
          <Kpi label="Total tasks" value={fmt.int(tasks)} foot="lifetime, all roles" icon="activity" />
          <Kpi label="Success rate" value={`${successRate}%`} foot="completed / attempted" icon="check" tone={successRate >= 90 ? 'tone-ok' : 'tone-warn'} />
          <Kpi label="Log entries" value={fmt.int(logs.length)} foot="streamed by agents" icon="list" />
        </KpiGrid>
      )}

      <Toolbar>
        <Segmented options={[['all', 'All'], ['active', 'Active'], ['idle', 'Idle']]} value={filter} onChange={setFilter} label="Agent status" />
        <span className="ui-count">{shown.length}/{agents.length}</span>
        <div className="ui-toolbar-spacer" />
        <span className="ui-note">Served by the backend at <code>/api/agents</code></span>
      </Toolbar>

      {loading && !agents.length ? <LoadingSkeleton rows={4} height={120} /> : !shown.length ? (
        <EmptyState
          icon="bot"
          title="No agents in this state"
          hint="Switch the filter or start the backend to populate the registry."
          action={<Btn size="pv-btn-sm" onClick={load}>Retry</Btn>}
        />
      ) : (
        <div className="ui-grid autofill">
          {shown.map((a) => {
            const I = Icon[ICONS[a.id]] || Icon.bot;
            const done = a.tasks ? Math.round(((a.success || 0) / a.tasks) * 100) : 0;
            return (
              <Card key={a.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.7rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', minWidth: 0 }}>
                    <span className="ui-kpi-icon"><I style={{ width: 16, height: 16 }} /></span>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: '.95rem' }} className="ui-truncate">{a.name}</h3>
                      <div className="ui-card-sub">{a.model}</div>
                    </div>
                  </div>
                  <Pill tone={a.status === 'active' ? 'is-ok' : 'is-quiet'} dot>{a.status}</Pill>
                </div>

                <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', margin: '.7rem 0 .9rem' }}>{a.desc}</p>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', marginBottom: '.35rem' }}>
                  <span className="ui-note">Task success</span>
                  <span className="ui-num" style={{ fontWeight: 700 }}>{done}%</span>
                </div>
                <Meter value={done} tone={done >= 95 ? 'meter-ok' : done >= 80 ? 'meter-lime' : 'meter-warn'} />

                <div className="ui-card-foot" style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                  <Pill tone="is-quiet">Tasks {fmt.int(a.tasks)}</Pill>
                  <Pill tone="is-quiet">OK {fmt.int(a.success)}</Pill>
                  <Pill tone="is-quiet">{logCount(a.name)} log refs</Pill>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {!!logs.length && (
        <Card className="soft">
          <CardHead
            title="Latest agent activity"
            sub="Newest log lines, straight from the swarm"
            icon="list"
            actions={<Btn to="/logs" size="pv-btn-sm" variant="pv-btn-ghost">Full trace</Btn>}
          />
          <Rows>
            {logs.slice(0, 5).map((l) => (
              <Row
                key={l.id}
                title={l.message}
                sub={`${l.agent} · ${fmt.date(l.created_at || l.time)}`}
                tail={<Pill tone={l.level === 'error' ? 'is-bad' : l.level === 'warn' ? 'is-warn' : l.level === 'success' ? 'is-ok' : 'is-quiet'}>{l.level}</Pill>}
              />
            ))}
          </Rows>
        </Card>
      )}

      {!backendOk && !!agents.length && (
        <p className="ui-note">Showing cached registry — backend offline.</p>
      )}
    </Page>
  );
}
