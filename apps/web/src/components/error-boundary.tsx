'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Error Boundary component for graceful error handling in React components.
 * Provides a user-friendly fallback UI when errors occur.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    console.error('ErrorBoundary caught error:', error, errorInfo);
    
    this.setState({ error, errorInfo });
    
    // Call optional onReset callback
    if (this.props.onReset) {
      this.props.onReset();
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  override render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" aria-hidden="true" />
            </div>
            
            <h2 className="text-xl font-semibold text-white mb-2">
              Something went wrong
            </h2>
            
            <p className="text-gray-400 mb-6">
              We apologize for the inconvenience. An error occurred while rendering this page.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-gray-900 rounded-lg text-left overflow-auto max-h-48">
                <p className="text-red-400 font-mono text-sm mb-2">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-gray-500 font-mono text-xs">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white rounded-lg transition-colors"
                type="button"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Try Again
              </button>
              
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Studio-specific error boundary with additional context
 */
export function StudioErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Page-level error boundary for critical routes
 */
export function PageErrorBoundary({ 
  children, 
  pageName 
}: { 
  children: ReactNode; 
  pageName: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" aria-hidden="true" />
            </div>
            
            <h2 className="text-xl font-semibold text-white mb-2">
              {pageName} is unavailable
            </h2>
            
            <p className="text-gray-400 mb-6">
              We&apos;re having trouble loading this page. Please try again or contact support if the problem persists.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
