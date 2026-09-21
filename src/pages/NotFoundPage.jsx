import { Link } from 'react-router-dom';
import { Card, Btn } from '../components/ui';
import { Icon } from '../components/Brand';

export default function NotFoundPage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '62vh' }}>
      <Card style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span className="ui-state-icon" style={{ margin: 0, width: 56, height: 56 }}>
            <Icon.search style={{ width: 24, height: 24 }} />
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 700, letterSpacing: '-.03em', marginTop: '.9rem' }}>
          404
        </div>
        <h2 style={{ marginTop: '.2rem' }}>That route isn’t in the terminal</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', margin: '.5rem 0 1.2rem' }}>
          The page you asked for doesn’t exist here. Jump back to a view that does.
        </p>
        <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Btn to="/dashboard" variant="pv-btn-primary" icon="grid">Dashboard</Btn>
          <Btn to="/pipeline" icon="flow">Pipeline</Btn>
        </div>
        <p className="ui-note" style={{ marginTop: '1rem' }}>
          or head back to the <Link to="/" style={{ fontWeight: 700, textDecoration: 'underline' }}>public site</Link>
        </p>
      </Card>
    </div>
  );
}
