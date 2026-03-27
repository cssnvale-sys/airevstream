'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Studio error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto w-12 h-12 rounded-full bg-accent-red/10 flex items-center justify-center mb-4">
          <AlertTriangle size={24} className="text-accent-red" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Something went wrong</h2>
        <p className="text-sm text-text-secondary mb-6">
          The studio encountered an error. You can try again or go back to the library.
        </p>
        <button type="button" onClick={reset} className="btn-primary inline-flex items-center gap-2">
          <RefreshCw size={16} />
          Try again
        </button>
      </div>
    </div>
  );
}
