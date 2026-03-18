'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message;
        const safeMessages = [
          'Too many requests. Please try again later.',
        ];
        throw new Error(msg && safeMessages.includes(msg) ? msg : 'Request failed');
      }
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-primary">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent-purple flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
            A
          </div>
          <h1 className="text-page-title text-text-primary">Forgot Password</h1>
          <p className="text-text-secondary mt-1">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="card space-y-4">
            <div className="bg-accent-green/10 border border-accent-green/20 text-accent-green px-4 py-3 rounded-md text-body">
              If an account with that email exists, a password reset link has been sent. Check your console in dev mode.
            </div>
            <Link href="/auth/login" className="btn-primary w-full block text-center">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            {error && (
              <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red px-4 py-2 rounded-md text-body">
                {error}
              </div>
            )}

            <div>
              <label className="block text-body text-text-secondary mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full"
                required
                placeholder="you@example.com"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <p className="text-center text-body text-text-secondary">
              Remember your password?{' '}
              <Link href="/auth/login" className="text-accent-blue hover:underline">
                Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
