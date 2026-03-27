'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Forgot password error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-primary">
      <div className="text-center max-w-md">
        <div className="mx-auto w-12 h-12 rounded-full bg-accent-red/10 flex items-center justify-center mb-4">
          <AlertTriangle size={24} className="text-accent-red" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Page Error</h2>
        <p className="text-sm text-text-secondary mb-6">
          Something went wrong loading the password reset request page. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary inline-flex items-center gap-2">
            <RefreshCw size={16} />
            Try again
          </button>
          <Link href="/auth/login" className="btn-secondary inline-flex items-center gap-2">
            <LogIn size={16} />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
