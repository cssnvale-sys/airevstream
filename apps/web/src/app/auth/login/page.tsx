'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { setToken } from '@/lib/auth';
import { LoadingButton } from '@/components/ui/loading-button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message;
        const safeMessages = [
          'Invalid email or password',
          'Too many login attempts. Please try again later.',
          'Failed to log in',
        ];
        throw new Error(msg && safeMessages.includes(msg) ? msg : 'Login failed');
      }
      setToken(data.data.token);
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect') || '/dashboard';
      // Only allow relative redirects to prevent open redirect attacks
      const safeRedirect = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard';
      router.push(safeRedirect);
    } catch (err) {
      console.error('Login failed:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
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
          <h1 className="text-page-title text-text-primary">AiRevStream</h1>
          <p className="text-text-secondary mt-1">Sign in to your account</p>
        </div>

        <form noValidate onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red px-4 py-2 rounded-md text-body">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-body text-text-secondary mb-1">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-body text-text-secondary mb-1">Password</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full pr-10"
                required
                minLength={8}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              className="rounded border-border"
            />
            <label htmlFor="remember-me" className="ml-2 text-sm text-text-secondary">Remember me</label>
          </div>

          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Signing in..."
            className="btn-primary w-full"
            onClick={() => { /* Explicit click guard — form submit fires natively */ }}
          >
            Sign In
          </LoadingButton>

          <div className="flex items-center justify-between text-body text-text-secondary">
            <Link href="/auth/forgot-password" className="text-accent-blue hover:underline">
              Forgot password?
            </Link>
            <span>
              No account?{' '}
              <Link href="/auth/register" className="text-accent-blue hover:underline">
                Register
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
