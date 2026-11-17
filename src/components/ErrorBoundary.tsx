import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** changing this value (the route) clears a previous error */
  resetKey: string;
}

/** Keeps one broken screen from taking the whole site down. */
export default class ErrorBoundary extends Component<Props, { failed: boolean; key: string }> {
  state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: { failed: boolean; key: string }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container empty-state" role="alert">
        <h1>This Page Hit a Problem</h1>
        <p className="muted">Reload to try again. Your seat choices are kept.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload Page
        </button>
      </div>
    );
  }
}
