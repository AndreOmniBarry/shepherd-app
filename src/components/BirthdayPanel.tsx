
'use client';
import { useState, useEffect } from 'react';

type BirthdayMember = {
  id: string;
  full_name: string;
  date_of_birth: string;
  birth_month: number;
  birth_day: number;
  days_until: number;
  age_turning: number;
  cell_name: string;
  fellowship_name: string;
  is_today: boolean;
  is_this_month: boolean;
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface BirthdayPanelProps {
  dark?: boolean;
  t: Record<string, string>;
  scope?: string;
  showFellowship?: boolean;
}

export default function BirthdayPanel({ dark = false, t, scope = 'cell', showFellowship = false }: BirthdayPanelProps) {
  const [tab, setTab] = useState<'today' | 'upcoming' | 'month'>('today');
  const [data, setData] = useState<{ today: BirthdayMember[]; upcoming: BirthdayMember[]; thisMonth: BirthdayMember[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/birthdays?scope=${scope}`, { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data) setData(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [scope]);

  if (loading) return <div style={{ textAlign: 'center', padding: 32, color: t.muted, fontSize: 12 }}>Loading birthdays...</div>;

  const todayList = data?.today || [];
  const upcomingList = data?.upcoming || [];
  const monthList = data?.thisMonth || [];

  const tabs = [
    { id: 'today' as const, label: `Today${todayList.length > 0 ? ` (${todayList.length})` : ''}` },
    { id: 'upcoming' as const, label: `Upcoming (${upcomingList.length})` },
    { id: 'month' as const, label: `This month (${monthList.length})` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Tab switcher */}
      <div style={{ display: 'flex', background: t.input, borderRadius: 10, padding: 4, border: `0.5px solid ${t.border}` }}>
        {tabs.map(tabDef => (
          <button key={tabDef.id} onClick={() => setTab(tabDef.id)}
            style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tab === tabDef.id ? 600 : 400, background: tab === tabDef.id ? t.card : 'transparent', color: tab === tabDef.id ? t.purple : t.sub, transition: 'all 0.15s' }}>
            {tabDef.label}
          </button>
        ))}
      </div>

      {/* TODAY */}
      {tab === 'today' && (
        todayList.length === 0 ? (
          <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎂</div>
            <div style={{ fontSize: 13, color: t.sub }}>No birthdays today</div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>Check upcoming tab for the next birthdays</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {todayList.map(m => (
              <div key={m.id} style={{ background: 'linear-gradient(135deg, #FAEEDA 0%, #EEEDFE 100%)', borderRadius: 12, border: '0.5px solid rgba(186,117,23,0.2)', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 32 }}>🎂</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#633806', marginBottom: 2 }}>{m.full_name}</div>
                    <div style={{ fontSize: 12, color: '#BA7517' }}>
                      Turning {m.age_turning} today · {m.cell_name}{showFellowship ? ` · ${m.fellowship_name}` : ''}
                    </div>
                  </div>
                  <div style={{ background: '#BA7517', color: '#fff', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600 }}>
                    Birthday today!
                  </div>
                </div>
                <div style={{ marginTop: 12, background: 'rgba(186,117,23,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#BA7517' }}>
                  Celebrate {m.full_name.split(' ')[0]} today — reach out with a birthday message or celebrate in your next meeting.
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* UPCOMING */}
      {tab === 'upcoming' && (
        upcomingList.length === 0 ? (
          <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: t.sub }}>No birthdays in the next 30 days</div>
          </div>
        ) : (
          <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
            {upcomingList.map((m, i) => {
              const isThisWeek = m.days_until <= 7;
              const isNextWeek = m.days_until <= 14 && m.days_until > 7;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: i < upcomingList.length - 1 ? `0.5px solid ${t.border}` : 'none', background: isThisWeek ? (dark ? 'rgba(186,117,23,0.06)' : 'rgba(250,238,218,0.4)') : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: isThisWeek ? '#FAEEDA' : t.input, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isThisWeek ? '#BA7517' : t.text, lineHeight: 1 }}>{m.birth_day}</div>
                      <div style={{ fontSize: 8, color: isThisWeek ? '#BA7517' : t.muted, textTransform: 'uppercase' }}>{MONTHS[m.birth_month]}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{m.full_name}</div>
                      <div style={{ fontSize: 11, color: t.muted, marginTop: 1 }}>
                        {m.cell_name}{showFellowship ? ` · ${m.fellowship_name}` : ''} · Turning {m.age_turning}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isThisWeek ? '#BA7517' : isNextWeek ? t.purple : t.muted }}>
                      {m.days_until === 1 ? 'Tomorrow' : `In ${m.days_until} days`}
                    </div>
                    {isThisWeek && <div style={{ fontSize: 9, color: '#BA7517', marginTop: 2 }}>This week</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* THIS MONTH */}
      {tab === 'month' && (
        monthList.length === 0 ? (
          <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: t.sub }}>No birthdays this month</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: t.muted, marginBottom: 10, textAlign: 'right' }}>
              {monthList.length} birthday{monthList.length !== 1 ? 's' : ''} in {new Date().toLocaleString('default', { month: 'long' })}
            </div>
            <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
              {monthList.map((m, i) => {
                const isPast = m.days_until < 0;
                const isToday = m.days_until === 0;
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < monthList.length - 1 ? `0.5px solid ${t.border}` : 'none', opacity: isPast ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 18 }}>{isToday ? '🎂' : isPast ? '✓' : '🎁'}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{m.full_name}</div>
                        <div style={{ fontSize: 11, color: t.muted }}>{m.cell_name} · {MONTHS[m.birth_month]} {m.birth_day}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: isToday ? '#BA7517' : isPast ? t.muted : t.purple, fontWeight: isToday ? 600 : 400 }}>
                      {isToday ? 'Today!' : isPast ? 'Passed' : `${m.days_until}d`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}
