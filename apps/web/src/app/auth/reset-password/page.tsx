'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { LoadingButton } from '@/components/ui/loading-button';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message;
        const safeMessages = [
          'Invalid or expired reset token',
          'Invalid reset token',
          'Password must be at least 8 characters',
          'Too many attempts. Please try again later.',
        ];
        throw new Error(msg && safeMessages.includes(msg) ? msg : 'Password reset failed');
      }
      setSuccess(true);
    } catch (err: unknown) {
      console.error('Password reset failed:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-accent-purple flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
          A
        </div>
        <h1 className="text-page-title text-text-primary">Reset Password</h1>
        <p className="text-text-secondary mt-1">Enter your new password below.</p>
      </div>

      {success ? (
        <div className="card space-y-4">
          <div className="bg-accent-green/10 border border-accent-green/20 text-accent-green px-4 py-3 rounded-md text-body">
            Your password has been reset successfully.
          </div>
          <Link href="/auth/login" className="btn-primary w-full block text-center">
            Sign In
          </Link>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red px-4 py-2 rounded-md text-body">
              {error}
            </div>
          )}

          {!token && (
            <div className="bg-accent-amber/10 border border-accent-amber/20 text-accent-amber px-4 py-2 rounded-md text-body">
              No reset token found. Please use the link from your reset email.
            </div>
          )}

          <div>
            <label className="block text-body text-text-secondary mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input w-full"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-body text-text-secondary mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input w-full"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <LoadingButton type="submit" loading={loading} disabled={!token} loadingText="Resetting..." className="btn-primary w-full">
            Reset Password
          </LoadingButton>

          <p className="text-center text-body text-text-secondary">
            <Link href="/auth/login" className="text-accent-blue hover:underline">
              Back to Sign In
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-primary">
      <Suspense fallback={<div className="text-text-secondary">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
