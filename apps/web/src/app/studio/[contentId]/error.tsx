'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function StudioEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Studio editor error:', error);
  }, [error]);

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="mx-auto w-12 h-12 rounded-full bg-accent-red/10 flex items-center justify-center mb-4">
          <AlertTriangle size={24} className="text-accent-red" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Something went wrong</h2>
        <p className="text-sm text-text-secondary mb-6">
          Failed to load the studio editor. You can try again or go back to the library.
        </p>
        <div className="flex gap-3 justify-center">
          <button type="button" onClick={reset} className="btn-primary inline-flex items-center gap-2">
            <RefreshCw size={16} />
            Try Again
          </button>
          <Link
            href="/library"
            className="btn-secondary inline-flex items-center gap-2"
          >
            Back to Library
          </Link>
        </div>
      </div>
    </div>
  );
}
