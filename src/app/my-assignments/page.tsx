'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import MyAccountButton from '@/components/MyAccountButton';
import Icon from '@/components/Icon';
import { rolePortal } from '@/lib/role-portal';

type ServiceAssignment = { id: string; item_type: string; title: string; description: string | null; duration_minutes: number | null; is_completed: boolean; service_date: string; service_title: string; service_theme: string | null };
type WorkforceAssignment = { id: string; role_title: string; position: string | null; confirmed: boolean; service_date: string; service_type: string; department_name: string };

function formatDate(d: string) {
  const [y, mo, dy] = d.split('-').map(Number);
  return new Date(y, mo - 1, dy).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function MyAssignmentsPage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [homePath, setHomePath] = useState('/dashboard');
  const [loading, setLoading] = useState(true);
  const [serviceAssignments, setServiceAssignments] = useState<ServiceAssignment[]>([]);
  const [workforceAssignments, setWorkforceAssignments] = useState<WorkforceAssignment[]>([]);

  const t = {
    bg: dark ? '#080614' : '#F0EFF8', card: dark ? '#13102A' : '#FFFFFF',
    border: dark ? 'rgba(168,159,255,0.1)' : 'rgba(83,74,183,0.12)',
    text: dark ? '#E8E5FF' : '#1A1040', sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.35)' : '#9990CC',
    purple: dark ? '#A89FFF' : '#534AB7', purpleBg: dark ? '#1A1A2E' : '#EEEDFE',
    teal: dark ? '#2DD4AA' : '#1D9E75', tealBg: dark ? '#0D2620' : '#E1F5EE',
    navBg: dark ? '#0A0618' : '#FFFFFF', navBorder: dark ? 'rgba(168,159,255,0.08)' : 'rgba(83,74,183,0.12)',
  };

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (!data) router.push('/login'); else setHomePath(rolePortal(data.role)); }).catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => {
    fetch('/api/my-assignments', { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      setServiceAssignments(data?.service_assignments || []);
      setWorkforceAssignments(data?.workforce_assignments || []);
    }).finally(() => setLoading(false));
  }, []);

  const card: React.CSSProperties = { background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '16px 18px' };

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push(homePath)} title="Back to dashboard"
            style={{ background: t.purpleBg, border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: t.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ti-arrow-left" size={15} />
          </button>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '0.5px' }}>SHEP.HERD</div>
            <div style={{ fontSize: 10, color: t.muted }}>My Assignments</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBell dark={dark} /><MyAccountButton dark={dark} />
          <div onClick={() => setDark(v => !v)} style={{ width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.muted, fontSize: 14 }}>
            {dark ? '☀' : '◑'}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>My Assignments</div>
          <div style={{ fontSize: 12, color: t.sub, marginTop: 2 }}>Every order-of-service role and workforce roster slot you've been assigned, in one place.</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: t.muted, fontSize: 13 }}>Loading your assignments…</div>
        ) : (serviceAssignments.length === 0 && workforceAssignments.length === 0) ? (
          <div style={card}>
            <div style={{ textAlign: 'center', padding: 24, color: t.muted, fontSize: 13 }}>No upcoming assignments right now.</div>
          </div>
        ) : (
          <>
            {serviceAssignments.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Order of service</div>
                {serviceAssignments.map((a, i) => (
                  <div key={a.id} style={{ padding: '10px 0', borderBottom: i < serviceAssignments.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{a.title}</div>
                        <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{formatDate(a.service_date)} · {a.service_title}{a.service_theme ? ` — ${a.service_theme}` : ''}</div>
                      </div>
                      <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: a.is_completed ? t.tealBg : t.purpleBg, color: a.is_completed ? t.teal : t.purple, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {a.is_completed ? 'Done' : a.item_type}
                      </span>
                    </div>
                    {a.description && <div style={{ fontSize: 12, color: t.sub, marginTop: 6 }}>{a.description}</div>}
                    {a.duration_minutes && <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{a.duration_minutes} min</div>}
                  </div>
                ))}
              </div>
            )}

            {workforceAssignments.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Workforce roster</div>
                {workforceAssignments.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < workforceAssignments.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{a.role_title}{a.position ? ` — ${a.position}` : ''}</div>
                      <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{formatDate(a.service_date)} · {a.department_name}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: a.confirmed ? t.tealBg : t.purpleBg, color: a.confirmed ? t.teal : t.purple, fontWeight: 600 }}>
                      {a.confirmed ? 'Confirmed' : 'Unconfirmed'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
