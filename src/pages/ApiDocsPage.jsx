import { Page, PageHeader, Card, CardHead, Pill, TableWrap, Code, Btn, Checks } from '../components/ui';

const GROUPS = [
  {
    group: 'Auth',
    rows: [
      ['POST', '/api/auth/register', '{ username, email, password } → creates the account'],
      ['POST', '/api/auth/login', '{ email, password } → bearer token + user'],
      ['GET', '/api/auth/me', 'Current user for the session token'],
      ['POST', '/api/auth/logout', 'Invalidates the session token'],
    ],
  },
  {
    group: 'Lab',
    rows: [
      ['POST', '/api/pipeline/run', '{ hypothesis, costs_bps, slippage_bps } → Writer + Judge + backtest'],
      ['POST', '/api/backtest', '{ formula, costs_bps, slippage_bps } → metrics + equity curve'],
      ['POST', '/api/backtest/csv', 'multipart: file + formula → backtest on your own OHLCV'],
      ['GET', '/api/analytics?period=1Y', 'KPIs, period returns, scatter, rolling Sharpe, radar'],
    ],
  },
  {
    group: 'Memory',
    rows: [
      ['GET', '/api/strategies?status=&q=', 'Factor library, ranked by Sharpe'],
      ['POST', '/api/strategies', '{ name, hypothesis, formula } → backtested and stored'],
      ['PATCH', '/api/strategies/{sid}', 'Update status, name or hypothesis'],
      ['DELETE', '/api/strategies/{sid}', 'Remove a factor from memory'],
      ['GET', '/api/experiments', 'Reproducible cycle history'],
      ['GET', '/api/papers · PATCH /api/papers/{pid}', 'Research library and reading status'],
    ],
  },
  {
    group: 'Ops',
    rows: [
      ['GET', '/api/health', 'Service + database check (no auth)'],
      ['GET', '/api/public/stats', 'Lab counters used by the landing page (no auth)'],
      ['GET', '/api/dashboard/metrics', 'Counts, average Sharpe, best factor'],
      ['GET', '/api/dashboard/charts', 'Equity vs benchmark, status mix, log histogram'],
      ['GET', '/api/agents', 'Agent registry with task and success counts'],
      ['GET', '/api/logs?limit=100', 'Swarm trace, newest first'],
    ],
  },
];

const METHOD_TONE = { GET: 'is-info', POST: 'is-ok', PATCH: 'is-warn', DELETE: 'is-bad' };

const CURL = `# health — no auth needed
curl -s http://127.0.0.1:8001/api/health

# sign in and capture the bearer token
TOKEN=$(curl -s -X POST http://127.0.0.1:8001/api/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"you@university.edu","password":"your-password"}' \\
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# run a full swarm cycle
curl -s -X POST http://127.0.0.1:8001/api/pipeline/run \\
  -H "Authorization: Bearer $TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{"hypothesis":"oversold dip bounce","costs_bps":10,"slippage_bps":5}'

# backtest an arbitrary formula
curl -s -X POST http://127.0.0.1:8001/api/backtest \\
  -H "Authorization: Bearer $TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{"formula":"rank(close / delay(close, 20) - 1) * -1"}'`;

export default function ApiDocsPage() {
  return (
    <Page>
      <PageHeader
        eyebrow="Workspace"
        title="API reference"
        sub="Everything this terminal does is a documented REST call. Interactive schema lives at /docs on the backend."
        actions={<Btn to="/backtest" icon="activity">Try a backtest</Btn>}
      />

      <div className="ui-grid halves">
        <Card className="soft">
          <CardHead title="Authentication" sub="Bearer token on every data endpoint" icon="lock" />
          <Checks items={[
            'Sign in returns a token valid for 7 days, sliding on use',
            'Send it as Authorization: Bearer <token>',
            '/api/health and /api/public/stats are the only open endpoints',
            'A 401 clears the session and returns you to sign-in',
          ]} />
        </Card>

        <Card className="soft">
          <CardHead title="Guard rails" sub="Enforced server-side on every request" icon="shield" />
          <Checks items={[
            'Formula capped at 500 chars and 12 operations',
            'Hypothesis capped at 2000 chars',
            'Costs and slippage bounded to 0–500 bps',
            'CSV uploads limited to 5MB and 60–5000 bars',
          ]} />
        </Card>
      </div>

      {GROUPS.map(({ group, rows }) => (
        <Card key={group} className="pad0">
          <div style={{ padding: '1.25rem 1.25rem 0' }}>
            <CardHead title={group} sub={`${rows.length} endpoints`} icon="plug" />
          </div>
          <TableWrap bordered={false}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([method, path, desc]) => (
                  <tr key={`${method}${path}`}>
                    <td><Pill tone={METHOD_TONE[method] || 'is-quiet'}>{(method || '').split(' ')[0]}</Pill></td>
                    <td><code style={{ fontSize: '.78rem' }}>{path}</code></td>
                    <td className="ui-note" style={{ fontSize: '.82rem' }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      ))}

      <Card>
        <CardHead title="Copy-paste examples" sub="Against the local backend on port 8001" icon="terminal" />
        <Code>{CURL}</Code>
        <div className="ui-card-foot">
          <span className="ui-note">
            Interactive Swagger UI is served at <code>http://127.0.0.1:8001/docs</code> when the backend runs.
          </span>
        </div>
      </Card>
    </Page>
  );
}
