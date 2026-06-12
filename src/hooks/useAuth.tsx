'use client';

// ============================================================
// SHEP.HERD — useAuth Hook
// Manages authentication state client-side.
// Stores JWT in memory (not localStorage — Safari 14 compat).
// ============================================================

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser, LoginRequest } from '@/types';

type AuthState = {
  user:     AuthUser | null;
  token:    string | null;
  loading:  boolean;
  error:    string | null;
};

type AuthContext = AuthState & {
  login:  (data: LoginRequest) => Promise<boolean>;
  logout: () => void;
};

const AuthCtx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user:    null,
    token:   null,
    loading: true,
    error:   null,
  });
  const router = useRouter();

  // On mount — check if user has a valid session via /api/auth/me
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const { data } = await res.json();
          if (data) {
            setState({ user: data.user, token: data.token, loading: false, error: null });
            return;
          }
        }
      } catch {
        // Network error — treat as unauthenticated
      }
      setState(s => ({ ...s, loading: false }));
    }
    checkSession();
  }, []);

  const login = useCallback(async ({ email, password }: LoginRequest): Promise<boolean> => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch('/api/auth/login', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setState(s => ({ ...s, loading: false, error: json.error?.message || 'Login failed' }));
        return false;
      }

      const { user, token } = json.data;
      setState({ user, token, loading: false, error: null });

      // Route to correct portal
      router.push(user.role === 'overseer' ? '/dashboard' : '/cell');
      return true;

    } catch {
      setState(s => ({ ...s, loading: false, error: 'Network error. Please try again.' }));
      return false;
    }
  }, [router]);

  const logout = useCallback(() => {
    // Clear server cookie
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setState({ user: null, token: null, loading: false, error: null });
    router.push('/login');
  }, [router]);

  return (
    <AuthCtx.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthContext {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
