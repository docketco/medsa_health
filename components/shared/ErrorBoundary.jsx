import { Component } from 'react'
import C from './colours'

// Nothing in this app previously caught a render error anywhere - one bug
// in any single screen, in any of the four portals, took down the entire
// page to Next.js's blank "Application error" with no way to recover
// short of reloading, and no clue what actually broke. This catches that
// class of error, shows what actually happened, and lets the rest of the
// app keep working.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('Medsa app error:', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: C.beige }}>
        <div style={{ maxWidth: 440, width: '100%', background: '#fff', borderRadius: '16px', padding: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>{'⚠'}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: C.text }}>Something went wrong</div>
          <div style={{ fontSize: '13px', color: C.textSub, marginBottom: '16px', lineHeight: 1.5 }}>
            This screen hit an unexpected error. Try again, or reload if that doesn't help - the rest of the app should be unaffected.
          </div>
          <div style={{ fontSize: '11px', color: C.textMuted, background: C.cream, borderRadius: '8px', padding: '10px 12px', marginBottom: '18px', textAlign: 'left', fontFamily: 'monospace', wordBreak: 'break-word' }}>
            {this.state.error?.message || String(this.state.error)}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={this.handleReset} style={{ flex: 1, padding: '11px', background: C.green, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Try again</button>
            <button onClick={() => window.location.reload()} style={{ flex: 1, padding: '11px', background: C.card, color: C.text, border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Reload page</button>
          </div>
        </div>
      </div>
    )
  }
}
