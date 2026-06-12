'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Member = { id: string; full_name: string; membership_status: string; };
type Service = { id: string; service_date: string; service_number: number; };
type HistoryRecord = { id: string; service_date: string; service_number: number; present_count: number; absent_count: number; visitor_count: number; submitted_at: string; };

export default function CellPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'submit'|'history'>('submit');
  const [members, setMembers] = useState<Member[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [attendance, setAttendance] = useState<Record<string, 'present'|'absent'>>({});
  const [visitorCount, setVisitorCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [cellName, setCellName] = useState('');
  const [leaderName, setLeaderName] = useState('');

  useEffect(() => {
    // Get user info
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) { router.push('/login'); return; }
        setCellName(data.cell_name || 'Your Cell');
        setLeaderName(data.name || '');
      })
      .catch(() => router.push('/login'));

    // Load members
    fetch('/api/cells/members', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.members) {
          const active = data.members.filter((m: Member) => m.membership_status === 'active');
          setMembers(active);
          const init: Record<string, 'present'|'absent'> = {};
          active.forEach((m: Member) => { init[m.id] = 'present'; });
          setAttendance(init);
        }
      })
      .catch(() => {});

    // Load services
    fetch('/api/services/recent', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.services?.length) {
          setServices(data.services);
          setSelectedService(data.services[0].id);
        } else {
          // Fallback demo service
          const today = new Date().toISOString().split('T')[0];
          setServices([{ id: 'demo', service_date: today, service_number: 1 }]);
          setSelectedService('demo');
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (tab === 'history') {
      fetch('/api/attendance?weeks=12', { credentials: 'include' })
        .then(r => r.json())
        .then(({ data }) => {
          if (data?.records) {
            setHistory(data.records.map((r: Record<string, unknown>) => ({
              id: r.id,
              service_date: (r.services as Record<string,string>)?.service_date || '',
              service_number: (r.services as Record<string,number>)?.service_number || 1,
              present_count: r.present_count,
              absent_count: r.absent_count,
              visitor_count: r.visitor_count,
              submitted_at: r.submitted_at,
            })));
          }
        })
        .catch(() => {});
    }
  }, [tab]);

  function toggle(id: string) {
    setAttendance(prev => ({ ...prev, [id]: prev[id] === 'present' ? 'absent' : 'present' }));
  }

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;

  async function submit() {
    if (!selectedService) { setError('Please select a service.'); return; }
    setError(null);
    setLoading(true);
    try {
      const entries = Object.entries(attendance).map(([member_id, status]) => ({ member_id, status }));
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ service_id: selectedService, entries, visitor_count: visitorCount }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error?.message || 'Submission failed.');
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Network error. Check your connection.');
    }
    setLoading(false);
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    document.cookie = 'shepherd_token=; Max-Age=0; path=/';
    router.push('/login');
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,system-ui,sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E7EB', padding: 32, maxWidth: 360, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, background: '#E1F5EE', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Attendance Submitted</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>{presentCount} present · {absentCount} absent · {visitorCount} visitors</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 24 }}>Sent to pastor dashboard in real time</div>
          <button onClick={() => { setSubmitted(false); setVisitorCount(0); }} style={{ background: '#EEEDFE', color: '#3C3489', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            Submit Another Service
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Inter,system-ui,sans-serif' }}>
      {/* Nav */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E7EB', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#534AB7' }}>SHEP.HERD</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{cellName}{leaderName ? ` · ${leaderName}` : ''}</div>
        </div>
        <button onClick={logout} style={{ background: 'transparent', color: '#9CA3AF', border: 'none', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 10, padding: 4, marginBottom: 20 }}>
          {(['submit', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 500 : 400, background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111827' : '#6B7280', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {t === 'submit' ? 'Submit Attendance' : 'History'}
            </button>
          ))}
        </div>

        {tab === 'submit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Service selector */}
            <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E5E7EB', padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Select Service</div>
              <select value={selectedService} onChange={e => setSelectedService(e.target.value)}
                style={{ width: '100%', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', background: '#F9FAFB' }}>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.service_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} — Service {s.service_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[{ label: 'Present', value: presentCount, color: '#1D9E75' }, { label: 'Absent', value: absentCount, color: '#D85A30' }, { label: 'Visitors', value: visitorCount, color: '#BA7517' }].map(s => (
                <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E5E7EB', padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 600, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Member list */}
            {members.length > 0 ? (
              <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E5E7EB', padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Members — tap to toggle</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {members.map(m => {
                    const present = attendance[m.id] === 'present';
                    return (
                      <button key={m.id} onClick={() => toggle(m.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: present ? '#E1F5EE' : '#FAECE7', textAlign: 'left' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: present ? '#085041' : '#993C1D' }}>{m.full_name}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: present ? '#1D9E75' : '#D85A30', color: '#fff' }}>{present ? 'Present' : 'Absent'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E5E7EB', padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#6B7280' }}>No members found for this cell.</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Contact your administrator if this is incorrect.</div>
              </div>
            )}

            {/* Visitors */}
            <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E5E7EB', padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Visitors / First-timers</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={() => setVisitorCount(v => Math.max(0, v - 1))}
                  style={{ width: 36, height: 36, borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', fontSize: 18, cursor: 'pointer' }}>−</button>
                <span style={{ fontSize: 22, fontWeight: 600, color: '#374151', width: 32, textAlign: 'center' }}>{visitorCount}</span>
                <button onClick={() => setVisitorCount(v => v + 1)}
                  style={{ width: 36, height: 36, borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', fontSize: 18, cursor: 'pointer' }}>+</button>
              </div>
            </div>

            {error && (
              <div style={{ background: '#FAECE7', borderRadius: 8, border: '0.5px solid #FCCBB8', padding: '10px 14px', fontSize: 13, color: '#993C1D' }}>{error}</div>
            )}

            <button onClick={submit} disabled={loading || !selectedService}
              style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Submitting...' : `Submit — ${presentCount} Present`}
            </button>
          </div>
        )}

        {tab === 'history' && (
          <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E5E7EB', padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Last 12 Weeks</div>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF', fontSize: 13 }}>No submissions yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {history.map((r, i) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < history.length - 1 ? '0.5px solid #F3F4F6' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
                        {r.service_date ? new Date(r.service_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Unknown'} · Service {r.service_number}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{r.absent_count} absent · {r.visitor_count} visitors</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1D9E75' }}>{r.present_count} present</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {Math.round((r.present_count / Math.max(1, r.present_count + r.absent_count)) * 100)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
