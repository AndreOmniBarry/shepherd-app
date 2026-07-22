'use client';
import { useState, Suspense, useEffect } from 'react';
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
    case 'accounts':
      return '/accounts';
    case 'partnership':
      return '/partnership';
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
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        setError(json.error?.message || 'Invalid credentials. Please try again.');
        setLoading(false);
        return;
      }
      const role = json.data?.user?.role || 'cell_leader';
      const next = searchParams.get('next');
      const portal = rolePortal(role);
      // Honour next param as long as it's a relative path (security check)
      const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : portal;
      router.push(dest);
    } catch {
      setError('Network error. Please check your connection.');
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#08051A',
      display: 'flex',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* ── Ambient background orbs ── */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
      }}>
        {/* Large purple orb top-left */}
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(83,74,183,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />
        {/* Teal orb bottom-right */}
        <div style={{
          position: 'absolute', bottom: '-15%', right: '-5%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(29,158,117,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />
        {/* Small purple orb center-right */}
        <div style={{
          position: 'absolute', top: '40%', right: '15%',
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,159,255,0.1) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }} />

        {/* Subtle grid lines */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(83,74,183,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(83,74,183,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }} />

        {/* Top edge glow */}
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(168,159,255,0.3), transparent)',
        }} />
      </div>

      {/* ── Left panel — brand ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 80px',
        position: 'relative', zIndex: 1,
      }}
      className="login-left">
        {/* Logo mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
          <div style={{
            width: 40, height: 40, position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              position: 'absolute', width: 6, height: 28,
              background: 'linear-gradient(180deg, #A89FFF, #534AB7)',
              borderRadius: 3,
            }} />
            <div style={{
              position: 'absolute', width: 20, height: 6,
              background: 'linear-gradient(90deg, #A89FFF, #534AB7)',
              borderRadius: 3,
            }} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', letterSpacing: '2px' }}>SHEP.HERD</div>
            <div style={{ fontSize: 11, color: 'rgba(168,159,255,0.6)', letterSpacing: '0.5px', marginTop: 1 }}>Church Intelligence Platform</div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ maxWidth: 480 }}>
          <div style={{
            fontSize: 48, fontWeight: 800, lineHeight: 1.1,
            color: '#FFFFFF', marginBottom: 20, letterSpacing: '-1px',
          }}>
            Know your<br />
            <span style={{
              background: 'linear-gradient(135deg, #A89FFF 0%, #534AB7 50%, #1D9E75 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>congregation.</span>
          </div>
          <div style={{
            fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, maxWidth: 380,
          }}>
            Real-time visibility into attendance, giving, member health, and cell performance — all in one intelligent dashboard.
          </div>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 40 }}>
          {['Live attendance', 'AI-powered insights', 'SLA tracking', 'Multi-role access'].map(f => (
            <div key={f} style={{
              padding: '6px 14px', borderRadius: 20,
              background: 'rgba(83,74,183,0.12)',
              border: '0.5px solid rgba(168,159,255,0.15)',
              fontSize: 12, color: 'rgba(168,159,255,0.8)',
            }}>{f}</div>
          ))}
        </div>

        {/* Bottom quote */}
        <div style={{ marginTop: 'auto', paddingTop: 60 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', lineHeight: 1.6 }}>
            "He who tends a fig tree will eat its fruit, and he who guards his master will be honored."
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', marginTop: 6 }}>Proverbs 27:18</div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div style={{
        width: 440, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 48px', position: 'relative', zIndex: 1,
        borderLeft: '0.5px solid rgba(168,159,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(20px)',
      }}
      className="login-right">
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#E8E5FF', marginBottom: 6 }}>Welcome back</div>
            <div style={{ fontSize: 13, color: 'rgba(232,229,255,0.35)' }}>Sign in to access your portal</div>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email */}
            <div>
              <div style={{ fontSize: 11, color: focused === 'email' ? 'rgba(168,159,255,0.9)' : 'rgba(232,229,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 7, transition: 'color 0.15s' }}>
                Email address
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="firstname.lastname@church.com"
                autoComplete="email"
                style={{
                  width: '100%',
                  background: focused === 'email' ? 'rgba(83,74,183,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `0.5px solid ${focused === 'email' ? 'rgba(168,159,255,0.4)' : 'rgba(168,159,255,0.1)'}`,
                  borderRadius: 10, padding: '12px 14px',
                  fontSize: 13, color: '#E8E5FF',
                  outline: 'none', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ fontSize: 11, color: focused === 'pw' ? 'rgba(168,159,255,0.9)' : 'rgba(232,229,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 7, transition: 'color 0.15s' }}>
                Password
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('pw')}
                  onBlur={() => setFocused(null)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    background: focused === 'pw' ? 'rgba(83,74,183,0.08)' : 'rgba(255,255,255,0.04)',
                    border: `0.5px solid ${focused === 'pw' ? 'rgba(168,159,255,0.4)' : 'rgba(168,159,255,0.1)'}`,
                    borderRadius: 10, padding: '12px 44px 12px 14px',
                    fontSize: 13, color: '#E8E5FF',
                    outline: 'none', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    color: 'rgba(168,159,255,0.4)', cursor: 'pointer',
                    fontSize: 11, fontFamily: 'inherit', letterSpacing: '0.3px',
                    padding: '4px',
                  }}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(216,90,48,0.1)',
                border: '0.5px solid rgba(216,90,48,0.25)',
                borderRadius: 9, padding: '10px 13px',
                fontSize: 12, color: '#F87171', lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', marginTop: 4,
                background: loading
                  ? 'rgba(83,74,183,0.5)'
                  : 'linear-gradient(135deg, #6B62D4 0%, #534AB7 50%, #3C3489 100%)',
                color: '#fff', border: 'none',
                borderRadius: 10, padding: '13px',
                fontSize: 14, fontWeight: 700,
                cursor: loading ? 'wait' : 'pointer',
                letterSpacing: '0.3px',
                boxShadow: loading ? 'none' : '0 4px 24px rgba(83,74,183,0.35)',
                transition: 'all 0.15s',
                position: 'relative', overflow: 'hidden',
              }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: '0.5px', background: 'rgba(168,159,255,0.08)' }} />
            <div style={{ fontSize: 11, color: 'rgba(232,229,255,0.2)' }}>secured access</div>
            <div style={{ flex: 1, height: '0.5px', background: 'rgba(168,159,255,0.08)' }} />
          </div>

          {/* Security badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            {[
              { icon: '🔒', label: 'End-to-end encrypted' },
              { icon: '🛡', label: 'Role-secured' },
            ].map(b => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(232,229,255,0.2)' }}>
                <span style={{ fontSize: 12 }}>{b.icon}</span>
                {b.label}
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 32, fontSize: 10, color: 'rgba(255,255,255,0.12)', lineHeight: 1.6 }}>
            SHEP.HERD is proprietary software by Andre Courage Aganmwonyi-Barry.<br />
            Unauthorised access is prohibited.
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder { color: rgba(232,229,255,0.2); }
        * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .login-left { display: none !important; }
          .login-right {
            width: 100% !important;
            border-left: none !important;
            padding: 32px 20px !important;
            min-height: 100vh;
            overflow-y: auto;
          }
          .login-right > div {
            max-width: 100% !important;
            width: 100% !important;
          }
        }
      ` }} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#08051A' }} />}>
      <LoginForm />
    </Suspense>
  );
}
