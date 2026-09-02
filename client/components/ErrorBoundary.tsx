'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * ErrorBoundary — Sprint 5 hardening.
 *
 * A React class-component error boundary that catches render-time errors and
 * any uncaught errors thrown in event handlers / async callbacks within its
 * subtree (React 18 forwards these to the nearest boundary).
 *
 * Renders a readable fallback UI instead of a blank white page or an
 * unhandled crash. Offers a "Reload page" button so the user can recover
 * without needing to know to manually refresh.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <DashboardContent />
 *   </ErrorBoundary>
 */
interface ErrorBoundaryProps {
  children?: ReactNode;
  /** Optional label shown above the generic message — e.g. "Dashboard". */
  label?: string;
  /** Optional custom fallback. Receives the caught error + a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to the console — a production app would forward this to Sentry /
    // Datadog / LogRocket.
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;

    if (!error) return this.props.children ?? null;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-800 mb-2">
          {this.props.label ? `${this.props.label} failed to load` : 'Something went wrong'}
        </h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          An unexpected error occurred while rendering this page. The error has
          been logged. Reloading usually resolves the issue.
        </p>
        <pre className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 max-w-full overflow-auto mb-4">
          {error.message || String(error)}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reload page
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;

/**
 * ApiErrorFallback — a simpler, non-boundary fallback for the common case
 * where a `fetch` failed (network error, 5xx, malformed JSON). Use this in
 * page-level catch blocks instead of bare `setError(message)` so the user
 * gets a retry button.
 */
export function ApiErrorFallback({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
      <h3 className="text-base font-semibold text-slate-800 mb-1">
        Couldn&apos;t reach the LandVision backend
      </h3>
      <p className="text-sm text-slate-500 max-w-md mb-4">
        {message || 'A network error occurred. Please check your connection and try again.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-md transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      )}
    </div>
  );
}
