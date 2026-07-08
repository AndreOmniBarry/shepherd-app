'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function rolePortal(role: string): string {
  switch (role) {
    case 'overseer':
    case 'pa':
    case 'lead_tech':
      return '/dashboard';
    case 'fellowship_head':
      return '/fellowship';
    case 'department_head':
      return '/department';
    case 'cell_leader':
      return '/cell';
    case 'care_team':
      return '/care';
    default:
      return '/cell';
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setError('Email and password are required.'); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error?.message || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }
      const role = json.data?.user?.role || 'cell_leader';
      const next = searchParams.get('next');
      // Redirect to the 'next' param only if it matches the role's allowed portal
      const portal = rolePortal(role);
      const dest = next && next.startsWith(portal) ? next : portal;
      router.push(dest);
    } catch {
      setError('Network error. Please check your connection.');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1A1040 0%, #2D1B6E 50%, #1A1040 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,system-ui,sans-serif', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', width: 5, height: 24, background: '#A89FFF', borderRadius: 3 }} />
              <div style={{ position: 'absolute', width: 18, height: 5, background: '#A89FFF', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', letterSpacing: '1.5px' }}>SHEP.HERD</div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.3px' }}>Church Intelligence Platform</div>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(168,159,255,0.2)', borderRadius: 16, padding: 28, backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#E8E5FF', marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 12, color: 'rgba(232,229,255,0.45)', marginBottom: 22 }}>Access your church portal</div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'rgba(232,229,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Email address</div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(168,159,255,0.2)', borderRadius: 9, padding: '10px 13px', fontSize: 13, color: '#E8E5FF', outline: 'none', fontFamily: 'inherit' }}
                onFocus={e => e.target.style.borderColor = '#A89FFF'}
                onBlur={e => e.target.style.borderColor = 'rgba(168,159,255,0.2)'}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: 'rgba(232,229,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Password</div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(168,159,255,0.2)', borderRadius: 9, padding: '10px 40px 10px 13px', fontSize: 13, color: '#E8E5FF', outline: 'none', fontFamily: 'inherit' }}
                  onFocus={e => e.target.style.borderColor = '#A89FFF'}
                  onBlur={e => e.target.style.borderColor = 'rgba(168,159,255,0.2)'}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(232,229,255,0.4)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(216,90,48,0.15)', border: '0.5px solid rgba(216,90,48,0.3)', borderRadius: 8, padding: '10px 13px', fontSize: 12, color: '#F87171', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', background: loading ? 'rgba(83,74,183,0.6)' : '#534AB7', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', transition: 'background 0.15s', letterSpacing: '0.3px' }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          SHEP.HERD · Secure church management
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#1A1040' }} />}>
      <LoginForm />
    </Suspense>
  );
}
