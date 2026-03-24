'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Analytics error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto w-12 h-12 rounded-full bg-accent-red/10 flex items-center justify-center mb-4">
          <AlertTriangle size={24} className="text-accent-red" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Page Error</h2>
        <p className="text-sm text-text-secondary mb-6">
          This page encountered an error. You can try again or go back to the dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary inline-flex items-center gap-2">
            <RefreshCw size={16} />
            Try again
          </button>
          <Link href="/dashboard" className="btn-secondary inline-flex items-center gap-2">
            <Home size={16} />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
