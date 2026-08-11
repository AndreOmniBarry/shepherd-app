'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '@/components/Icon';
import type { PollResults } from '@/types/poll';

function pollTheme(dark: boolean) {
  return {
    card: dark ? '#13102A' : '#FFFFFF', text: dark ? '#E8E5FF' : '#1A1040', sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.35)' : '#9990CC', border: dark ? 'rgba(168,159,255,0.14)' : 'rgba(83,74,183,0.16)',
    purple: dark ? '#A89FFF' : '#534AB7', purpleBg: dark ? '#1A1A2E' : '#EEEDFE',
    teal: dark ? '#2DD4AA' : '#1D9E75', tealBg: dark ? '#0D2620' : '#E1F5EE',
    coral: dark ? '#F0876B' : '#D85A30', coralBg: dark ? '#2E1610' : '#FAECE7',
    input: dark ? '#0F0C20' : '#F7F6FF', trackBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(83,74,183,0.06)',
  };
}

function fmtBucket(iso: string, byDay: boolean): string {
  const d = new Date(iso);
  return byDay ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : d.toLocaleTimeString(undefined, { hour: 'numeric' });
}

// The "command data center" panel — response rate, structural breakdown,
// engagement timeline, non-responder list + nudge, and full per-voter
// attribution. Only ever reachable from PollCard's "View analytics" link,
// which only renders when poll.can_manage is true (creator/leadership) —
// this component doesn't re-check that itself, it just renders whatever
// GET /results returns (that route enforces the same gate server-side, so
// there's no path where an unauthorized caller sees this UI with data).
export default function PollAnalyticsPanel({
  pollId, kind, dark, onClose,
}: {
  pollId: string;
  kind: 'feed' | 'chat';
  dark: boolean;
  onClose: () => void;
}) {
  const t = pollTheme(dark);
  const base = `/api/${kind}/polls/${pollId}`;
  const [results, setResults] = useState<PollResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [nudgeMsg, setNudgeMsg] = useState('');
  const [expandedOption, setExpandedOption] = useState<string | null>(null);

  function load() {
    setLoading(true); setError('');
    fetch(`${base}/results`, { credentials: 'include' }).then(r => r.json().then(json => ({ ok: r.ok, json }))).then(({ ok, json }) => {
      if (!ok) { setError(json?.error?.message || 'Could not load poll analytics.'); return; }
      setResults(json.data);
    }).catch(() => setError('Network error loading poll analytics.')).finally(() => setLoading(false));
  }
  useEffect(load, [pollId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function closePoll() {
    if (!confirm('Close this poll? No more votes will be accepted.')) return;
    setClosing(true);
    try {
      const res = await fetch(`${base}/close`, { method: 'POST', credentials: 'include' });
      if (res.ok) load();
    } finally { setClosing(false); }
  }

  async function nudge() {
    setNudging(true); setNudgeMsg('');
    try {
      const res = await fetch(`${base}/nudge`, { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (res.ok) setNudgeMsg(`Reminded ${json.data?.nudged ?? 0} non-responder${json.data?.nudged === 1 ? '' : 's'}.`);
      else setNudgeMsg(json.error?.message || 'Failed to nudge.');
    } finally { setNudging(false); }
  }

  const timelineByDay = results ? (() => {
    const times = results.engagement_timeline.map(b => new Date(b.bucket).getTime());
    if (times.length < 2) return false;
    return (Math.max(...times) - Math.min(...times)) > 72 * 60 * 60 * 1000;
  })() : false;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="shep-pop-enter"
        style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 14, padding: 0, width: 480, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.purple, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Poll Analytics</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, marginTop: 2 }}>{results?.poll.question || '…'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', flexShrink: 0, display: 'flex' }}>
            <Icon name="ti-x" size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: t.muted, fontSize: 12, padding: 20 }}>Loading…</div>
          ) : error ? (
            <div style={{ color: t.coral, fontSize: 12 }}>{error}</div>
          ) : results && (
            <>
              {/* Response rate */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.sub, marginBottom: 6 }}>RESPONSE RATE</div>
                <div style={{ fontSize: 13, color: t.text, marginBottom: 6 }}>
                  {results.response_rate.responded} of {results.response_rate.audience_size} eligible {results.response_rate.pct != null ? `(${results.response_rate.pct}%) ` : ''}responded
                </div>
                <div style={{ height: 8, borderRadius: 4, background: t.trackBg, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(results.response_rate.pct ?? 0, 100)}%`, background: t.teal, transition: 'width 0.4s ease-out' }} />
                </div>
              </div>

              {/* Live tally */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.sub, marginBottom: 6 }}>LIVE TALLY</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {results.tally.map(o => (
                    <div key={o.option_id} style={{ position: 'relative', border: `0.5px solid ${t.border}`, borderRadius: 6, padding: '5px 8px', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${o.pct}%`, background: t.purpleBg, zIndex: 0 }} />
                      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: t.text }}>
                        <span>{o.option_text}</span><span style={{ fontWeight: 700, color: t.sub }}>{o.count} · {o.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Structural breakdown */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.sub, marginBottom: 6 }}>
                  BREAKDOWN{results.structural_breakdown.dimension_label ? ` BY ${results.structural_breakdown.dimension_label.toUpperCase()}` : ''}
                </div>
                {results.structural_breakdown.note ? (
                  <div style={{ fontSize: 11.5, color: t.muted, fontStyle: 'italic' }}>{results.structural_breakdown.note}</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ color: t.muted, textAlign: 'left' }}>
                          <th style={{ padding: '3px 6px', fontWeight: 600 }}>{results.structural_breakdown.dimension_label}</th>
                          <th style={{ padding: '3px 6px', fontWeight: 600 }}>Voters</th>
                          {results.tally.map(o => <th key={o.option_id} style={{ padding: '3px 6px', fontWeight: 600 }}>{o.option_text}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {results.structural_breakdown.units.map(u => (
                          <tr key={u.unit_id} style={{ borderTop: `0.5px solid ${t.border}` }}>
                            <td style={{ padding: '4px 6px', color: t.text, fontWeight: 600 }}>{u.unit_name}</td>
                            <td style={{ padding: '4px 6px', color: t.sub }}>{u.total_voters}</td>
                            {u.options.map(o => <td key={o.option_id} style={{ padding: '4px 6px', color: t.sub }}>{o.count} ({o.pct}%)</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Engagement timeline */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.sub, marginBottom: 6 }}>ENGAGEMENT OVER TIME</div>
                {results.engagement_timeline.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: t.muted, fontStyle: 'italic' }}>No votes yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={results.engagement_timeline.map(b => ({ label: fmtBucket(b.bucket, timelineByDay), count: b.count }))} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: t.muted }} />
                      <YAxis tick={{ fontSize: 9, fill: t.muted }} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: t.card, color: t.text, border: `0.5px solid ${t.border}` }} />
                      <Bar dataKey="count" name="Votes" fill={t.purple} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Per-option voters — full attribution, always visible here */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.sub, marginBottom: 6 }}>WHO VOTED FOR WHAT</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {results.per_option_voters.map(ov => (
                    <div key={ov.option_id}>
                      <div onClick={() => setExpandedOption(expandedOption === ov.option_id ? null : ov.option_id)}
                        style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontSize: 11.5, color: t.text, padding: '4px 2px' }}>
                        <span>{ov.option_text}</span>
                        <span style={{ color: t.purple, fontWeight: 600 }}>{ov.voters.length} {expandedOption === ov.option_id ? '▲' : '▼'}</span>
                      </div>
                      {expandedOption === ov.option_id && (
                        <div style={{ paddingLeft: 8, display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginBottom: 4 }}>
                          {ov.voters.length === 0 ? <span style={{ fontSize: 10.5, color: t.muted }}>No votes yet.</span> : ov.voters.map(v => (
                            <span key={v.user_id} style={{ fontSize: 10.5, background: t.purpleBg, color: t.purple, borderRadius: 10, padding: '2px 8px' }}>{v.full_name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Non-responders */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.sub }}>NON-RESPONDERS ({results.non_responders.length})</div>
                  {results.non_responders.length > 0 && !results.poll.is_closed && (
                    <button onClick={nudge} disabled={nudging}
                      style={{ background: t.tealBg, color: t.teal, border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 10.5, fontWeight: 700, cursor: nudging ? 'wait' : 'pointer' }}>
                      {nudging ? 'Nudging…' : 'Nudge all'}
                    </button>
                  )}
                </div>
                {nudgeMsg && <div style={{ fontSize: 10.5, color: t.teal, marginBottom: 6 }}>{nudgeMsg}</div>}
                {results.non_responders.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: t.muted, fontStyle: 'italic' }}>Everyone eligible has responded.</div>
                ) : (
                  <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {results.non_responders.map(nr => (
                      <div key={nr.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 6px', borderRadius: 6, background: t.trackBg }}>
                        <span style={{ color: t.text }}>{nr.full_name}</span>
                        <span style={{ color: t.muted, textTransform: 'capitalize' }}>{nr.role.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {results && !results.poll.is_closed && (
          <div style={{ padding: '10px 18px', borderTop: `0.5px solid ${t.border}` }}>
            <button onClick={closePoll} disabled={closing}
              style={{ width: '100%', background: t.coralBg, color: t.coral, border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 700, cursor: closing ? 'wait' : 'pointer' }}>
              {closing ? 'Closing…' : 'Close poll'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
