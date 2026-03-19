'use client';

import Link from 'next/link';

export default function StudioError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Something went wrong</h2>
        <p className="text-sm text-text-secondary">
          {error.message || 'Failed to load the studio'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-accent-blue text-white rounded-md text-sm hover:bg-accent-blue/90"
          >
            Try Again
          </button>
          <Link
            href="/library"
            className="px-4 py-2 bg-bg-tertiary text-text-primary rounded-md text-sm hover:bg-border"
          >
            Back to Library
          </Link>
        </div>
      </div>
    </div>
  );
}
