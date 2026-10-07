import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Prevents a rendering error in one page from unmounting the whole app (which shows a blank screen).
 * Resets when the route changes (`resetKey`).
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ShareOn] UI error', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="card mx-auto max-w-lg space-y-3 p-6 text-center">
        <h1 className="text-xl font-bold">Niečo sa pokazilo</h1>
        <p className="text-sm text-ink-2">Túto stránku sa nepodarilo zobraziť. Skús ju načítať znova alebo sa vráť domov.</p>
        <div className="flex justify-center gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>Načítať znova</button>
          <a className="btn btn-primary btn-sm" href="/">Domov</a>
        </div>
      </div>
    );
  }
}
