import { Page, PageHeader, Card, CardHead, Btn, Pill, Checks } from '../components/ui';
import { Icon } from '../components/Brand';

const TEAM = [
  ['Sswayam Shheth', 'Research + Writer agent', 'SS', 'Hypothesis intake and factor formulation'],
  ['Tarak Shah', 'Judge + validation', 'TS', 'Leakage, logic and complexity review'],
  ['Varun Shah', 'Backtest + full-stack', 'VS', 'Engine, API and the terminal UI'],
  ['Vivaan Bhimani', 'Evaluation + reports', 'VB', 'Metrics, splits and experiment records'],
];

const OWNERS = [
  ['1', 'Research', 'Sswayam'],
  ['2', 'Write', 'Sswayam'],
  ['3', 'Judge', 'Tarak'],
  ['4', 'Backtest', 'Varun'],
  ['5', 'Measure', 'Vivaan'],
  ['6', 'Learn', 'Vivaan'],
];

const STACK = [
  ['api', 'FastAPI', 'REST surface, auth, rate limits'],
  ['database', 'SQLite', 'Strategies, experiments, logs, papers'],
  ['cpu', 'Pandas + NumPy', 'Vectorised factors and backtest maths'],
  ['terminal', 'React + Vite', 'This terminal, code-split per route'],
];

export default function TeamPage() {
  return (
    <Page>
      <PageHeader
        eyebrow="Workspace"
        title="Team"
        sub="AI & ML in Quantitative Finance — four people, one research loop."
        actions={<Pill tone="is-quiet">4 members</Pill>}
      />

      <div className="ui-grid cols-4">
        {TEAM.map(([name, role, initials, focus]) => (
          <Card key={name} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 58, height: 58, borderRadius: '50%', background: 'var(--pv-lime)',
                border: '1.5px solid var(--pv-ink)', boxShadow: '3px 3px 0 var(--pv-ink)',
                display: 'grid', placeItems: 'center', fontWeight: 800, margin: '0 auto .7rem',
                fontFamily: 'var(--font-display)', fontSize: '1.05rem',
              }}
            >
              {initials}
            </div>
            <h3 style={{ fontSize: '.95rem' }}>{name}</h3>
            <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginTop: '.2rem' }}>{role}</p>
            <div className="ui-card-foot">
              <span className="ui-note">{focus}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="ui-grid halves">
        <Card>
          <CardHead title="Who owns which step" sub="Each stage of the loop has a named owner" icon="flow" />
          <div className="ui-rows">
            {OWNERS.map(([step, label, owner]) => (
              <div className="ui-row" key={step}>
                <span className="ui-step-idx">{step}</span>
                <div className="ui-row-main">
                  <div className="ui-row-title">{label}</div>
                  <div className="ui-row-sub">{owner}</div>
                </div>
                <div className="ui-row-tail">
                  <Icon.check style={{ width: 16, height: 16, color: 'var(--success)' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Stack" sub="What the terminal is actually built from" icon="cpu" />
          <div className="ui-rows">
            {STACK.map(([icon, name, desc]) => {
              const I = Icon[icon] || Icon.cpu;
              return (
                <div className="ui-row" key={name}>
                  <span className="ui-kpi-icon"><I style={{ width: 16, height: 16 }} /></span>
                  <div className="ui-row-main">
                    <div className="ui-row-title">{name}</div>
                    <div className="ui-row-sub">{desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="ui-card-foot">
            <Checks items={['Research tool — not investment advice']} />
          </div>
        </Card>
      </div>

      <Card className="soft">
        <CardHead title="Want the API?" sub="Everything this terminal does is a documented REST call" icon="plug" />
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <Btn to="/api-docs" variant="pv-btn-primary" icon="plug">Read the API docs</Btn>
          <Btn to="/pipeline" icon="play">Run a cycle</Btn>
        </div>
      </Card>
    </Page>
  );
}
