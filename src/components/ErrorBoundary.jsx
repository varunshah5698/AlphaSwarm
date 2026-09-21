import { Component } from 'react';
import { Icon } from './Brand';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Alpha Swarm page crash:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="pv-card" style={{ maxWidth: 560, margin: '3rem auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span className="ui-state-icon" style={{ margin: 0 }}>
              <Icon.alert style={{ width: 22, height: 22, color: 'var(--danger)' }} />
            </span>
          </div>
          <h2 style={{ marginTop: '.9rem' }}>Something broke on this page</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem', margin: '.5rem 0 1.1rem' }}>
            The rest of the terminal is fine — this view hit an unexpected error. Your data is safe.
          </p>
          <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="pv-btn pv-btn-primary" onClick={() => this.setState({ error: null })}>Try again</button>
            <button className="pv-btn" onClick={() => window.location.assign('/dashboard')}>Go to dashboard</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
