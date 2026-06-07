'use client';

import { useState, useEffect } from 'react';
import type { Fellowship, Cell } from '@/types';

type Step = 'form' | 'pending';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('form');

  // Form state
  const [fullName,     setFullName]     = useState('');
  const [email,        setEmail]        = useState('');
  const [phone,        setPhone]        = useState('');
  const [password,     setPassword]     = useState('');
  const [confirmPass,  setConfirmPass]  = useState('');
  const [fellowshipId, setFellowshipId] = useState('');
  const [cellId,       setCellId]       = useState('');

  // Data
  const [fellowships, setFellowships] = useState<Fellowship[]>([]);
  const [cells,       setCells]       = useState<Cell[]>([]);
  const [cellName,    setCellName]    = useState('');

  // UI state
  const [loading,     setLoading]     = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // Load fellowships on mount
  useEffect(() => {
    fetch('/api/cells?include=fellowships')
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.fellowships) setFellowships(data.fellowships.filter(
          (f: Fellowship) => f.name !== 'CYDF' // CYDF has no cells
        ));
      })
      .catch(() => setError('Could not load fellowship list. Check your connection.'))
      .finally(() => setLoadingData(false));
  }, []);

  // Load cells when fellowship changes
  useEffect(() => {
    if (!fellowshipId) { setCells([]); setCellId(''); return; }
    fetch(`/api/cells?fellowship_id=${fellowshipId}`)
      .then(r => r.json())
      .then(({ data }) => { if (data?.cells) setCells(data.cells); })
      .catch(() => {});
    setCellId('');
  }, [fellowshipId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPass) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!cellId) {
      setError('Please select your cell.');
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password, full_name: fullName.trim(), phone: phone.trim() || undefined, cell_id: cellId }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        setError(json.error?.message || 'Registration failed.');
        return;
      }

      setCellName(json.data.cell_name);
      setStep('pending');

    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Pending approval screen ──────────────────────────────
  if (step === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="card w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Registration submitted</h1>
          <p className="text-sm text-gray-500 mb-1">
            Your account for <span className="font-medium text-gray-700">{cellName}</span> is pending approval.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Your cell coordinator will activate your account. You will then be able to sign in.
          </p>
          <a href="/login" className="btn-primary w-full">
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  // ── Registration form ────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="mb-6 text-center">
        <div className="text-2xl font-semibold text-shepherd-800">SHEP.HERD</div>
        <div className="text-xs text-gray-400 mt-0.5">Cell Leader Registration</div>
      </div>

      <div className="card w-full max-w-sm">
        <h1 className="text-lg font-semibold text-gray-900 mb-5">Create your account</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
              className="input" placeholder="Your full name" disabled={loading} />
          </div>

          <div>
            <label className="label">Email address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="input" placeholder="you@email.com" autoCapitalize="none" disabled={loading} />
          </div>

          <div>
            <label className="label">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              className="input" placeholder="+234-xxx-xxx-xxxx" disabled={loading} />
          </div>

          <div>
            <label className="label">Fellowship</label>
            <select value={fellowshipId} onChange={e => setFellowshipId(e.target.value)}
              className="input" required disabled={loading || loadingData}>
              <option value="">
                {loadingData ? 'Loading...' : 'Select your fellowship'}
              </option>
              {fellowships.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Cell</label>
            <select value={cellId} onChange={e => setCellId(e.target.value)}
              className="input" required disabled={loading || !fellowshipId}>
              <option value="">
                {!fellowshipId ? 'Select a fellowship first' : 'Select your cell'}
              </option>
              {cells.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Password</label>
            <input type="password" required minLength={8} value={password}
              onChange={e => setPassword(e.target.value)}
              className="input" placeholder="Min 8 characters" disabled={loading} />
          </div>

          <div>
            <label className="label">Confirm password</label>
            <input type="password" required value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              className="input" placeholder="Repeat password" disabled={loading} />
          </div>

          {error && (
            <div className="rounded-lg bg-coral-50 border border-coral-100 px-3 py-2 text-sm text-coral-600">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registering...</>
            ) : 'Register'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
          <span className="text-sm text-gray-500">Already have an account? </span>
          <a href="/login" className="text-sm font-medium text-shepherd-600 hover:text-shepherd-800">Sign in</a>
        </div>
      </div>
    </div>
  );
}
