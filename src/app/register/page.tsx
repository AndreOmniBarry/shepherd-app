'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type InviteInfo = {
  full_name: string;
  email: string;
  role: string;
  unit_name: string;
};

const ROLE_LABELS: Record<string, string> = {
  cell_leader: 'Cell Leader',
  fellowship_head: 'Fellowship Head',
  department_head: 'Department Head',
  care_team: 'Follow-Up & Care Team',
  pa: 'Church Admin / Pastor\'s Assistant',
  accounts: 'Accounts',
  partnership: 'Partnership Admin',
  lead_tech: 'Lead Tech',
};

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setTokenError('No invite token found. Please use the link sent to your email.'); setLoading(false); return; }

    fetch(`/api/register/validate?token=${token}`)
      .then(r => r.json())
      .then(({ data, error }) => {
        if (error || !data?.invite) {
          setTokenError(error?.message || 'This invite link is invalid or has expired. Please contact your administrator.');
        } else {
          setInvite(data.invite);
        }
        setLoading(false);
      })
      .catch(() => { setTokenError('Unable to validate invite. Please check your connection.'); setLoading(false); });
  }, [token]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!password || password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error?.message || 'Registration failed. Please try again.');
        setSubmitting(false);
        return;
      }
      // Redirect to login with success message
      router.push('/login?registered=true');
    } catch {
      setError('Network error. Please check your connection.');
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#08051A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', padding: 16,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(83,74,183,0.15) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(29,158,117,0.1) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(83,74,183,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(83,74,183,0.04) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: 5, height: 22, background: 'linear-gradient(180deg, #A89FFF, #534AB7)', borderRadius: 3 }} />
            <div style={{ position: 'absolute', width: 16, height: 5, background: 'linear-gradient(90deg, #A89FFF, #534AB7)', borderRadius: 3 }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', letterSpacing: '2px' }}>SHEP.HERD</div>
            <div style={{ fontSize: 10, color: 'rgba(168,159,255,0.5)', letterSpacing: '0.5px' }}>Church Intelligence Platform</div>
          </div>
        </div>

        {loading ? (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(168,159,255,0.15)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'rgba(232,229,255,0.4)' }}>Validating your invite...</div>
          </div>
        ) : tokenError ? (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(216,90,48,0.3)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F87171', marginBottom: 8 }}>Invalid invite</div>
            <div style={{ fontSize: 13, color: 'rgba(232,229,255,0.4)', lineHeight: 1.6 }}>{tokenError}</div>
          </div>
        ) : invite ? (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(168,159,255,0.15)', borderRadius: 16, padding: 28 }}>
            {/* Welcome section */}
            <div style={{ background: 'rgba(83,74,183,0.12)', border: '0.5px solid rgba(168,159,255,0.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: 'rgba(168,159,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>You have been invited as</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#E8E5FF', marginBottom: 3 }}>{invite.full_name}</div>
              <div style={{ fontSize: 12, color: 'rgba(168,159,255,0.7)' }}>{ROLE_LABELS[invite.role] || invite.role}{invite.unit_name !== '—' ? ` · ${invite.unit_name}` : ''}</div>
              <div style={{ fontSize: 11, color: 'rgba(232,229,255,0.35)', marginTop: 4 }}>{invite.email}</div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: '#E8E5FF', marginBottom: 4 }}>Create your password</div>
            <div style={{ fontSize: 12, color: 'rgba(232,229,255,0.35)', marginBottom: 22 }}>Set a secure password to activate your account. Minimum 8 characters.</div>

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: focused === 'pw' ? 'rgba(168,159,255,0.9)' : 'rgba(232,229,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6, transition: 'color 0.15s' }}>
                  Password
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocused('pw')}
                    onBlur={() => setFocused(null)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    style={{ width: '100%', background: focused === 'pw' ? 'rgba(83,74,183,0.08)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${focused === 'pw' ? 'rgba(168,159,255,0.4)' : 'rgba(168,159,255,0.1)'}`, borderRadius: 10, padding: '12px 44px 12px 14px', fontSize: 13, color: '#E8E5FF', outline: 'none', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(168,159,255,0.4)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
                {password.length > 0 && password.length < 8 && (
                  <div style={{ fontSize: 10, color: '#F87171', marginTop: 4 }}>Password too short</div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 10, color: focused === 'confirm' ? 'rgba(168,159,255,0.9)' : 'rgba(232,229,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6, transition: 'color 0.15s' }}>
                  Confirm password
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onFocus={() => setFocused('confirm')}
                  onBlur={() => setFocused(null)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  style={{ width: '100%', background: focused === 'confirm' ? 'rgba(83,74,183,0.08)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmPassword && confirmPassword !== password ? 'rgba(216,90,48,0.4)' : focused === 'confirm' ? 'rgba(168,159,255,0.4)' : 'rgba(168,159,255,0.1)'}`, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#E8E5FF', outline: 'none', fontFamily: 'inherit', transition: 'all 0.15s' }}
                />
                {confirmPassword && confirmPassword !== password && (
                  <div style={{ fontSize: 10, color: '#F87171', marginTop: 4 }}>Passwords do not match</div>
                )}
                {confirmPassword && confirmPassword === password && password.length >= 8 && (
                  <div style={{ fontSize: 10, color: '#2DD4AA', marginTop: 4 }}>Passwords match</div>
                )}
              </div>

              {error && (
                <div style={{ background: 'rgba(216,90,48,0.1)', border: '0.5px solid rgba(216,90,48,0.25)', borderRadius: 9, padding: '10px 13px', fontSize: 12, color: '#F87171' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={submitting || password.length < 8 || password !== confirmPassword}
                style={{ background: submitting ? 'rgba(83,74,183,0.5)' : 'linear-gradient(135deg, #6B62D4 0%, #534AB7 100%)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', opacity: password.length < 8 || password !== confirmPassword ? 0.5 : 1, boxShadow: '0 4px 24px rgba(83,74,183,0.3)', letterSpacing: '0.3px' }}>
                {submitting ? 'Creating account...' : 'Activate my account'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>
              This invite expires 48 hours after it was sent.<br />Contact your administrator if you have issues.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#08051A' }} />}>
      <RegisterForm />
    </Suspense>
  );
}
