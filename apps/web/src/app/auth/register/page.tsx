'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { setToken } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
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
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message;
        // Only allow known safe messages through
        const safeMessages = [
          'A user with this email already exists',
          'Password must be at least 8 characters',
          'Registration is currently closed',
          'Too many registration attempts. Please try again later.',
        ];
        throw new Error(msg && safeMessages.includes(msg) ? msg : 'Registration failed');
      }
      setToken(data.data.token);
      router.push('/dashboard');
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
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
          <p className="text-text-secondary mt-1">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red px-4 py-2 rounded-md text-body">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="register-name" className="block text-body text-text-secondary mb-1">Name</label>
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="register-email" className="block text-body text-text-secondary mb-1">Email</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="register-password" className="block text-body text-text-secondary mb-1">Password</label>
            <div className="relative">
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full pr-10"
                minLength={8}
                required
                aria-describedby="password-requirements"
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
            {password.length > 0 && (
              <ul id="password-requirements" className="mt-2 space-y-1 text-xs" aria-label="Password requirements">
                <li className={`flex items-center gap-1.5 ${password.length >= 8 ? 'text-accent-green' : 'text-text-secondary'}`}>
                  {password.length >= 8 ? <Check size={12} /> : <X size={12} />}
                  At least 8 characters
                </li>
              </ul>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-body text-text-secondary">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-accent-blue hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
