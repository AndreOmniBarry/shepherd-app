'use client';
import { useTheme } from '@/hooks/useTheme';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import MyAccountButton from '@/components/MyAccountButton';
import Icon from '@/components/Icon';
import { SkeletonRow } from '@/components/Skeleton';
import LoadingScreen from '@/components/LoadingScreen';
import { rolePortal } from '@/lib/role-portal';
import ThemeToggle from '@/components/ThemeToggle';

type Item = { id: string; title: string; date: string; end_date: string | null; type: string; source: 'event' | 'service' | 'plan'; location: string | null; slug: string | null; plan_id?: string };
type PlanItem = { id: string; item_type: string; title: string; description: string | null; duration_minutes: number | null; assigned_to_name: string | null };

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  programme: { bg: '#EEEDFE', text: '#3C3489' },
  conference: { bg: '#FAEEDA', text: '#633806' },
  vigil: { bg: '#0F0C20', text: '#A89FFF' },
  concert: { bg: '#FCEBEB', text: '#A32D2D' },
  outreach: { bg: '#E1F5EE', text: '#085041' },
  training: { bg: '#EEEDFE', text: '#3C3489' },
  thanksgiving: { bg: '#FAEEDA', text: '#633806' },
  dedication: { bg: '#E1F5EE', text: '#085041' },
  special: { bg: '#FAECE7', text: '#993C1D' },
  order_of_service: { bg: '#E1F5EE', text: '#085041' },
  other: { bg: '#F3F4F6', text: '#374151' },
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function ymd(d: Date) { return d.toISOString().split('T')[0]; }

export default function CalendarPage() {
  const router = useRouter();
  const {dark, setDark} = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [homePath, setHomePath] = useState('/dashboard');
  const [pageReady, setPageReady] = useState(false);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [planItemsLoading, setPlanItemsLoading] = useState(false);

  function togglePlan(planId: string) {
    if (openPlanId === planId) { setOpenPlanId(null); return; }
    setOpenPlanId(planId);
    setPlanItemsLoading(true);
    fetch(`/api/service-planner/items?plan_id=${planId}`, { credentials: 'include' })
      .then(r => r.json()).then(({ data }) => setPlanItems(data?.items || []))
      .catch(() => setPlanItems([]))
      .finally(() => setPlanItemsLoading(false));
  }

  const t = {
    bg: dark ? '#080614' : '#F0EFF8', card: dark ? '#13102A' : '#FFFFFF',
    border: dark ? 'rgba(168,159,255,0.1)' : 'rgba(83,74,183,0.12)',
    text: dark ? '#E8E5FF' : '#1A1040', sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.35)' : '#9990CC', input: dark ? '#0F0C20' : '#F7F6FF',
    purple: dark ? '#A89FFF' : '#534AB7', purpleBg: dark ? '#1A1A2E' : '#EEEDFE',
    teal: dark ? '#2DD4AA' : '#1D9E75', tealBg: dark ? '#0D2620' : '#E1F5EE',
    navBg: dark ? '#0A0618' : '#FFFFFF', navBorder: dark ? 'rgba(168,159,255,0.08)' : 'rgba(83,74,183,0.12)',
  };

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (!data) router.push('/login'); else { setHomePath(rolePortal(data.role)); setPageReady(true); } }).catch(() => router.push('/login'));
  }, []);

  useEffect(() => {
    setLoading(true);
    const from = new Date(cursor); from.setDate(from.getDate() - 35);
    const to = new Date(cursor); to.setMonth(to.getMonth() + 2);
    fetch(`/api/calendar?from=${ymd(from)}&to=${ymd(to)}`, { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => setItems(data?.items || []))
      .finally(() => setLoading(false));
  }, [cursor]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, Item[]> = {};
    items.forEach(it => {
      const start = new Date(it.date + 'T00:00:00');
      const end = it.end_date ? new Date(it.end_date + 'T00:00:00') : start;
      const cur = new Date(start);
      while (cur <= end) { const k = ymd(cur); (map[k] = map[k] || []).push(it); cur.setDate(cur.getDate() + 1); }
    });
    return map;
  }, [items]);

  const upcoming = useMemo(() => {
    const today = ymd(new Date());
    return items.filter(it => (it.end_date || it.date) >= today).slice(0, 8);
  }, [items]);

  // Build the 6-week grid for the current month
  const gridStart = useMemo(() => {
    const d = new Date(cursor); d.setDate(d.getDate() - d.getDay());
    return d;
  }, [cursor]);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) { const day = new Date(gridStart); day.setDate(gridStart.getDate() + w * 7 + d); row.push(day); }
    weeks.push(row);
  }

  const todayStr = ymd(new Date());
  const glass: React.CSSProperties = { background: 'var(--glass-bg)', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(160%)', backdropFilter: 'blur(var(--glass-blur)) saturate(160%)', border: '0.5px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)', borderRadius: 'var(--radius-md)', transition: 'transform var(--motion-medium) var(--ease-out-expo), box-shadow var(--motion-medium) var(--ease-out-expo)' };

  if (!pageReady) return <LoadingScreen dark={dark} label="Loading calendar…" />;

  return (
    <div data-theme={dark ? 'dark' : 'light'} className="shep-page-enter" style={{ minHeight: '100vh', background: dark ? `radial-gradient(circle at 15% 0%, rgba(83,74,183,0.12), transparent 45%), ${t.bg}` : `radial-gradient(circle at 15% 0%, rgba(83,74,183,0.06), transparent 45%), ${t.bg}`, fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ background: t.navBg, WebkitBackdropFilter: 'blur(18px) saturate(160%)', backdropFilter: 'blur(18px) saturate(160%)', borderBottom: `0.5px solid ${t.navBorder}`, boxShadow: dark ? '0 2px 8px rgba(0,0,0,0.25)' : '0 2px 8px rgba(31,25,71,0.06)', padding: isMobile ? 'calc(10px + env(safe-area-inset-top)) 14px 10px' : '0 20px', height: isMobile ? undefined : 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, minWidth: 0 }}>
          <button onClick={() => router.push(homePath)} title="Back to dashboard"
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            style={{ background: t.purpleBg, border: 'none', borderRadius: 'var(--radius-sm)', width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, flexShrink: 0, cursor: 'pointer', color: t.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform var(--motion-fast) var(--ease-spring)' }}>
            <Icon name="ti-arrow-left" size={isMobile ? 13 : 15} />
          </button>
          {!isMobile && (
            <>
              <div style={{ width: 24, height: 24, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', width: 3, height: 17, background: '#A89FFF', borderRadius: 2 }} />
                <div style={{ position: 'absolute', width: 12, height: 3, background: '#A89FFF', borderRadius: 2 }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '0.5px' }}>SHEP.HERD</div>
                <div style={{ fontSize: 10, color: t.muted }}>Church Calendar</div>
              </div>
            </>
          )}
          {isMobile && <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Calendar</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 8, flexShrink: 0 }}>
          <NotificationBell dark={dark} compact={isMobile} /><MyAccountButton dark={dark} compact={isMobile} />
          <ThemeToggle dark={dark} setDark={setDark} border={t.border} compact={isMobile} />
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '14px 10px' : '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: t.text }}>{MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setCursor(c => { const d = new Date(c); d.setMonth(d.getMonth() - 1); return d; })}
              onMouseEnter={e => { e.currentTarget.style.background = t.purple; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = t.card; e.currentTarget.style.color = t.text; }}
              style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 'var(--radius-sm)', width: 30, height: 30, cursor: 'pointer', color: t.text, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--motion-fast) var(--ease-out-expo)' }}>‹</button>
            <button onClick={() => setCursor(() => { const d = new Date(); d.setDate(1); return d; })}
              onMouseEnter={e => { e.currentTarget.style.background = t.purpleBg; }}
              onMouseLeave={e => { e.currentTarget.style.background = t.card; }}
              style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 'var(--radius-sm)', padding: '0 12px', cursor: 'pointer', color: t.text, fontSize: 12, fontWeight: 600, transition: 'all var(--motion-fast) var(--ease-out-expo)' }}>Today</button>
            <button onClick={() => setCursor(c => { const d = new Date(c); d.setMonth(d.getMonth() + 1); return d; })}
              onMouseEnter={e => { e.currentTarget.style.background = t.purple; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = t.card; e.currentTarget.style.color = t.text; }}
              style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 'var(--radius-sm)', width: 30, height: 30, cursor: 'pointer', color: t.text, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--motion-fast) var(--ease-out-expo)' }}>›</button>
          </div>
        </div>

        <div style={{ ...glass, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ padding: '8px 6px', fontSize: 10, color: t.muted, fontWeight: 600, textTransform: 'uppercase', textAlign: 'center', borderBottom: `0.5px solid ${t.border}` }}>{d}</div>
            ))}
          </div>
          {weeks.map((row, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {row.map(day => {
                const key = ymd(day);
                const inMonth = day.getMonth() === cursor.getMonth();
                const dayItems = itemsByDay[key] || [];
                return (
                  <div key={key} onClick={() => setSelectedDay(key)}
                    onMouseEnter={e => { if (key !== selectedDay) e.currentTarget.style.background = dark ? 'rgba(168,159,255,0.06)' : 'rgba(83,74,183,0.04)'; }}
                    onMouseLeave={e => { if (key !== selectedDay) e.currentTarget.style.background = 'transparent'; }}
                    style={{ minWidth: 0, minHeight: 76, padding: '6px 6px', borderRight: `0.5px solid ${t.border}`, borderBottom: `0.5px solid ${t.border}`, cursor: 'pointer', background: key === selectedDay ? t.purpleBg : 'transparent', opacity: inMonth ? 1 : 0.35, overflow: 'hidden', boxSizing: 'border-box', transition: 'background var(--motion-fast) var(--ease-out-expo)' }}>
                    <div style={{ fontSize: 11, fontWeight: key === todayStr ? 700 : 400, color: key === todayStr ? '#fff' : t.text, background: key === todayStr ? t.purple : 'transparent', width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 3, boxShadow: key === todayStr ? '0 0 0 3px rgba(83,74,183,0.18)' : 'none' }}>
                      {day.getDate()}
                    </div>
                    {dayItems.slice(0, 2).map(it => {
                      const c = TYPE_COLORS[it.type] || TYPE_COLORS.other;
                      return <div key={it.id} style={{ fontSize: 9, background: c.bg, color: c.text, borderRadius: 4, padding: '1px 4px', marginBottom: 2, width: '100%', boxSizing: 'border-box', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>{it.title}</div>;
                    })}
                    {dayItems.length > 2 && <div style={{ fontSize: 9, color: t.muted }}>+{dayItems.length - 2} more</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {selectedDay && (itemsByDay[selectedDay]?.length || 0) > 0 && (
          <div key={selectedDay} className="shep-pop-enter" style={{ ...glass, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>{selectedDay}</div>
            {itemsByDay[selectedDay].map(it => {
              const c = TYPE_COLORS[it.type] || TYPE_COLORS.other;
              const isPlan = it.source === 'plan' && it.plan_id;
              return (
                <div key={it.id}>
                  <div onClick={() => isPlan && togglePlan(it.plan_id!)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `0.5px solid ${t.border}`, cursor: isPlan ? 'pointer' : 'default' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{it.title}</div>
                      {it.location && <div style={{ fontSize: 11, color: t.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="ti-map-pin" size={11} /> {it.location}</div>}
                      {isPlan && <div style={{ fontSize: 10, color: t.purple, marginTop: 2 }}>{openPlanId === it.plan_id ? 'Hide order of service ▲' : 'View order of service ▼'}</div>}
                    </div>
                    <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: c.bg, color: c.text, fontWeight: 600, textTransform: 'capitalize' }}>{it.type.replace(/_/g, ' ')}</span>
                  </div>
                  {isPlan && openPlanId === it.plan_id && (
                    <div style={{ padding: '4px 0 10px 10px', borderLeft: `2px solid ${t.purpleBg}`, marginLeft: 4 }}>
                      {planItemsLoading ? (
                        <div style={{ fontSize: 11, color: t.muted, padding: '6px 0' }}>Loading…</div>
                      ) : planItems.length === 0 ? (
                        <div style={{ fontSize: 11, color: t.muted, padding: '6px 0' }}>No segments added yet.</div>
                      ) : planItems.map(pi => (
                        <div key={pi.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 11 }}>
                          <div>
                            <span style={{ color: t.text, fontWeight: 500 }}>{pi.title}</span>
                            {pi.assigned_to_name && <span style={{ color: t.muted }}> — {pi.assigned_to_name}</span>}
                          </div>
                          {pi.duration_minutes ? <span style={{ color: t.muted }}>{pi.duration_minutes} min</span> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ ...glass, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Upcoming</div>
          {loading ? (
            <>{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</>
          ) : upcoming.length === 0 ? (
            <div style={{ fontSize: 12, color: t.muted }}>Nothing scheduled yet.</div>
          ) : upcoming.map(it => {
            const c = TYPE_COLORS[it.type] || TYPE_COLORS.other;
            return (
              <div key={it.id}
                onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(168,159,255,0.05)' : 'rgba(83,74,183,0.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', margin: '0 -10px', borderRadius: 'var(--radius-sm)', borderBottom: `0.5px solid ${t.border}`, transition: 'background var(--motion-fast) var(--ease-out-expo)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{it.title}</div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{it.date}{it.end_date && it.end_date !== it.date ? ` – ${it.end_date}` : ''}{it.location ? ` · ${it.location}` : ''}</div>
                </div>
                <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: c.bg, color: c.text, fontWeight: 600, textTransform: 'capitalize' }}>{it.type}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
