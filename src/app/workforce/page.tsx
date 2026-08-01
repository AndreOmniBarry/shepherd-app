'use client';
import { useTheme } from '@/hooks/useTheme';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import MyAccountButton from '@/components/MyAccountButton';
import ChatNavButton from '@/components/ChatNavButton';
import LoadingScreen from '@/components/LoadingScreen';
import ThemeToggle from '@/components/ThemeToggle';

type Entry = {
  id: string;
  role_title: string;
  position: string | null;
  confirmed: boolean;
  service_date: string;
  service_type: string;
  department_name: string;
};

export default function WorkforcePage() {
  const router = useRouter();
  const {dark, setDark} = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [name, setName] = useState('');
  const [upcoming, setUpcoming] = useState<Entry[]>([]);
  const [past, setPast] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const t = {
    bg: dark ? '#080614' : '#F0EFF8', card: dark ? '#13102A' : '#FFFFFF',
    border: dark ? 'rgba(168,159,255,0.1)' : 'rgba(83,74,183,0.12)',
    text: dark ? '#E8E5FF' : '#1A1040', sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.35)' : '#9990CC', input: dark ? '#0F0C20' : '#F7F6FF',
    purple: dark ? '#A89FFF' : '#534AB7', purpleBg: dark ? '#1A1A2E' : '#EEEDFE',
    teal: dark ? '#2DD4AA' : '#1D9E75', tealBg: dark ? '#0D2620' : '#E1F5EE',
    coral: dark ? '#F87171' : '#D85A30', coralBg: dark ? '#1F0A0A' : '#FAECE7',
    amber: dark ? '#FCD34D' : '#BA7517', amberBg: dark ? '#1F1A00' : '#FAEEDA',
    navBg: dark ? '#0A0618' : '#FFFFFF', navBorder: dark ? 'rgba(168,159,255,0.08)' : 'rgba(83,74,183,0.12)',
  };

  const card = (e?: React.CSSProperties): React.CSSProperties => ({
    background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '16px 18px', ...e,
  });

  function load() {
    fetch('/api/workforce/my-schedule', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { setUpcoming(data?.upcoming || []); setPast(data?.past || []); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) { router.push('/login'); return; }
        setName(data.name || '');
      })
      .catch(() => router.push('/login'));
    load();
  }, []);

  async function respond(id: string, confirmed: boolean) {
    setUpdating(u => ({ ...u, [id]: true }));
    try {
      const res = await fetch('/api/workforce/my-schedule', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ entry_id: id, confirmed }),
      });
      if (res.ok) load();
    } catch {}
    setUpdating(u => ({ ...u, [id]: false }));
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    router.push('/login');
  }

  if (loading) return <LoadingScreen dark={dark} label="Loading your workforce schedule…" />;

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: 3, height: 17, background: '#A89FFF', borderRadius: 2 }} />
            <div style={{ position: 'absolute', width: 12, height: 3, background: '#A89FFF', borderRadius: 2 }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '0.5px' }}>SHEP.HERD</div>
            <div style={{ fontSize: 10, color: t.muted }}>My Serving Schedule</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.push("/church-center")} style={{ background: "transparent", border: "none", color: t.muted, fontSize: 12, cursor: "pointer", marginRight: 4 }}>Church Center</button>
          <button onClick={() => router.push("/church-feed")} style={{ background: "transparent", border: "none", color: t.muted, fontSize: 12, cursor: "pointer", marginRight: 4 }}>Church Feed</button><ChatNavButton t={t} />
          <button onClick={() => router.push("/calendar")} style={{ background: "transparent", border: "none", color: t.muted, fontSize: 12, cursor: "pointer", marginRight: 4 }}>Calendar</button><NotificationBell dark={dark} /><MyAccountButton dark={dark} />
          <ThemeToggle dark={dark} setDark={setDark} border={t.border} />
          <button onClick={logout} style={{ background: 'transparent', color: t.muted, border: 'none', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}{name ? `, ${name.split(' ')[0]}` : ''}</div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Here&apos;s what you&apos;re serving — confirm each assignment so your department head knows you&apos;re coming.</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: t.muted, fontSize: 13 }}>Loading your schedule…</div>
        ) : (
          <>
            <div style={card()}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Upcoming</div>
              {upcoming.length === 0 ? (
                <div style={{ fontSize: 12, color: t.muted, textAlign: 'center', padding: '20px 0' }}>Nothing assigned yet — check back after your department head publishes the next roster.</div>
              ) : upcoming.map(e => (
                <div key={e.id} style={{ padding: '10px 0', borderBottom: `0.5px solid ${t.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{e.service_date} · {e.department_name}</div>
                      <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{e.role_title}{e.position ? ` · ${e.position}` : ''}</div>
                    </div>
                    {e.confirmed ? (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: t.tealBg, color: t.teal, fontWeight: 600 }}>Confirmed</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => respond(e.id, true)} disabled={updating[e.id]}
                          style={{ background: t.teal, color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Confirm</button>
                        <button onClick={() => respond(e.id, false)} disabled={updating[e.id]}
                          style={{ background: 'transparent', color: t.coral, border: `0.5px solid ${t.coral}`, borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Can&apos;t make it</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={card()}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Past assignments</div>
              {past.length === 0 ? (
                <div style={{ fontSize: 12, color: t.muted }}>No history yet.</div>
              ) : past.slice(0, 20).map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `0.5px solid ${t.border}` }}>
                  <div>
                    <div style={{ fontSize: 12, color: t.text }}>{e.service_date} · {e.department_name}</div>
                    <div style={{ fontSize: 10, color: t.muted }}>{e.role_title}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: e.confirmed ? t.tealBg : t.coralBg, color: e.confirmed ? t.teal : t.coral, fontWeight: 500 }}>
                    {e.confirmed ? 'Served' : 'Declined'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
