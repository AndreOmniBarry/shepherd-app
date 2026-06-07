'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Metadata } from 'next';

// ── Login Page ───────────────────────────────────────────────
// Single form. Email + password.
// On success: server sets httpOnly cookie, client redirects by role.

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res  = await fetch('/api/auth/login', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        setError(json.error?.message || 'Login failed. Check your credentials.');
        return;
      }

      const { user } = json.data;
      router.push(user.role === 'overseer' ? '/dashboard' : '/cell');

    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">

      {/* Brand mark */}
      <div className="mb-8 text-center">
        <div className="text-3xl font-semibold text-shepherd-800 tracking-tight">
          SHEP.HERD
        </div>
        <div className="text-sm text-gray-400 mt-1">
          The Comforters House Global
        </div>
      </div>

      {/* Card */}
      <div className="card w-full max-w-sm">
        <h1 className="text-lg font-semibold text-gray-900 mb-6">Sign in</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="label">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input"
              placeholder="you@comfortershouse.org"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="label">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input pr-10"
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                           hover:text-gray-600 text-xs"
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-coral-50 border border-coral-100 px-3 py-2 text-sm text-coral-600">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white
                                 border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : 'Sign in'}
          </button>
        </form>

        {/* Register link */}
        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
          <span className="text-sm text-gray-500">New cell leader? </span>
          <a
            href="/register"
            className="text-sm font-medium text-shepherd-600 hover:text-shepherd-800"
          >
            Register your account
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-300">
        SHEP.HERD v1.0 · Secure church management
      </div>
    </div>
  );
}
