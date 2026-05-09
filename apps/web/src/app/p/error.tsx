'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home } from 'lucide-react';
import Link from 'next/link';

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Storefront error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-primary text-text-primary">
      <div className="text-center max-w-md">
        <div className="mx-auto w-12 h-12 rounded-full bg-accent-red/10 flex items-center justify-center mb-4">
          <AlertTriangle size={24} className="text-accent-red" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Storefront Error</h2>
        <p className="text-sm text-text-secondary mb-6">
          Something went wrong loading this store. Please try again or return home.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="btn-secondary inline-flex items-center gap-2">
            <Home size={16} />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
