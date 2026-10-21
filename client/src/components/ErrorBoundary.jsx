import { Component } from 'react';
import Button from './ui/Button.jsx';

/**
 * Catches render-time crashes so a single broken screen does not leave the user
 * staring at a blank page. In development the message is shown; in production
 * it is logged to the console only.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-ink">Something broke on this screen</h1>
        <p className="mt-2 max-w-md text-sm text-ink-muted">
          Sorry about that. Reloading usually fixes it. If it keeps happening, sign out and back in.
        </p>
        {import.meta.env.DEV && (
          <pre className="mt-4 max-w-full overflow-auto rounded-xl border border-surface-border bg-surface-overlay p-4 text-left text-xs text-negative">
            {String(this.state.error && this.state.error.message)}
          </pre>
        )}
        <div className="mt-6 flex gap-3">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="secondary" to="/app">
            Go home
          </Button>
        </div>
      </div>
    );
  }
}
