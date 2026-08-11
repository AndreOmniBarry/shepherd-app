'use client';
import { useState } from 'react';
import Icon from '@/components/Icon';
import type { PollView } from '@/types/poll';

// Self-contained palette (matches church-feed/page.tsx and chat/page.tsx's
// own `t` objects exactly) rather than depending on either page's slightly
// different theme-token shape — this card is shared by both.
function pollTheme(dark: boolean) {
  return {
    text: dark ? '#E8E5FF' : '#1A1040', sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.35)' : '#9990CC', border: dark ? 'rgba(168,159,255,0.14)' : 'rgba(83,74,183,0.16)',
    purple: dark ? '#A89FFF' : '#534AB7', purpleBg: dark ? '#1A1A2E' : '#EEEDFE',
    teal: dark ? '#2DD4AA' : '#1D9E75', tealBg: dark ? '#0D2620' : '#E1F5EE',
    coral: dark ? '#F0876B' : '#D85A30', trackBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(83,74,183,0.06)',
  };
}

function closesLabel(poll: PollView): { label: string; urgent: boolean } | null {
  if (poll.is_closed) return { label: poll.closed_at ? 'Closed' : 'Closed (time expired)', urgent: false };
  if (!poll.closes_at) return null;
  const diff = new Date(poll.closes_at).getTime() - Date.now();
  if (diff <= 0) return { label: 'Closing…', urgent: true };
  const hrs = Math.floor(diff / (60 * 60 * 1000));
  if (hrs < 1) return { label: `Closes in ${Math.max(1, Math.floor(diff / 60000))}m`, urgent: true };
  if (hrs < 24) return { label: `Closes in ${hrs}h`, urgent: hrs < 3 };
  return { label: `Closes in ${Math.floor(hrs / 24)}d`, urgent: false };
}

export default function PollCard({
  poll, dark, myId, onVote, onOpenAnalytics,
}: {
  poll: PollView;
  dark: boolean;
  myId: string;
  onVote: (optionIds: string[]) => Promise<void>;
  onOpenAnalytics?: () => void;
}) {
  const t = pollTheme(dark);
  const [pending, setPending] = useState<string[]>(poll.my_vote_option_ids);
  const [voting, setVoting] = useState(false);
  const hasVoted = poll.my_vote_option_ids.length > 0;
  const locked = poll.is_closed || (hasVoted && !poll.allow_vote_change);
  const closes = closesLabel(poll);

  async function castSingle(optionId: string) {
    if (locked || voting) return;
    setVoting(true);
    try { await onVote([optionId]); } finally { setVoting(false); }
  }

  function toggleMulti(optionId: string) {
    if (locked) return;
    setPending(prev => prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId]);
  }

  async function submitMulti() {
    if (locked || voting || pending.length === 0) return;
    setVoting(true);
    try { await onVote(pending); } finally { setVoting(false); }
  }

  return (
    <div style={{ marginTop: 8, border: `0.5px solid ${t.border}`, borderRadius: 10, padding: '12px 13px', background: dark ? 'rgba(168,159,255,0.03)' : 'rgba(83,74,183,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 10 }}>
        <Icon name="ti-chart-bar" size={14} style={{ color: t.purple, marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, lineHeight: 1.4 }}>{poll.question}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {poll.options.map(o => {
          const mineHere = (poll.poll_type === 'single' ? poll.my_vote_option_ids : pending).includes(o.id);
          const pct = poll.results_visible ? (o.pct ?? 0) : 0;
          return (
            <div
              key={o.id}
              onClick={() => poll.poll_type === 'single' ? castSingle(o.id) : toggleMulti(o.id)}
              style={{
                position: 'relative', border: `0.5px solid ${mineHere ? t.purple : t.border}`, borderRadius: 8,
                padding: '8px 10px', cursor: locked ? 'default' : 'pointer', overflow: 'hidden',
                opacity: locked && !mineHere ? 0.7 : 1, transition: 'border-color var(--motion-fast) var(--ease-out-expo)',
              }}>
              {poll.results_visible && (
                <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: mineHere ? t.purpleBg : t.trackBg, transition: 'width 0.4s ease-out', zIndex: 0 }} />
              )}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <span style={{
                    width: 14, height: 14, flexShrink: 0, borderRadius: poll.poll_type === 'single' ? '50%' : 4,
                    border: `1.5px solid ${mineHere ? t.purple : t.muted}`, background: mineHere ? t.purple : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {mineHere && <Icon name="ti-check" size={9} style={{ color: '#fff' }} />}
                  </span>
                  <span style={{ fontSize: 12.5, color: t.text, wordBreak: 'break-word' }}>{o.option_text}</span>
                </div>
                {poll.results_visible && <span style={{ fontSize: 11, fontWeight: 700, color: t.sub, flexShrink: 0 }}>{o.pct ?? 0}%{o.count != null ? ` · ${o.count}` : ''}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {poll.poll_type === 'multiple' && !locked && (
        <button onClick={submitMulti} disabled={voting || pending.length === 0}
          style={{ marginTop: 8, background: t.purple, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: pending.length === 0 ? 'default' : 'pointer', opacity: pending.length === 0 ? 0.5 : 1 }}>
          {voting ? 'Voting…' : hasVoted ? 'Update vote' : 'Vote'}
        </button>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9, flexWrap: 'wrap' as const, gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10.5, color: t.muted }}>
          <span style={{ textTransform: 'capitalize' }}>{poll.poll_type} choice</span>
          {poll.total_voters != null && <span>· {poll.total_voters} vote{poll.total_voters !== 1 ? 's' : ''}</span>}
          {locked && hasVoted && !poll.is_closed && <span>· vote locked</span>}
          {closes && <span style={{ color: closes.urgent ? t.coral : t.muted, fontWeight: closes.urgent ? 700 : 400 }}>· {closes.label}</span>}
        </div>
        {poll.can_manage && onOpenAnalytics && (
          <button onClick={onOpenAnalytics}
            style={{ background: 'transparent', border: 'none', color: t.purple, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}>
            <Icon name="ti-eye" size={12} /> View analytics
          </button>
        )}
      </div>
      {!poll.results_visible && !hasVoted && (
        <div style={{ marginTop: 6, fontSize: 10.5, color: t.muted, fontStyle: 'italic' }}>Results are hidden until you vote{poll.closes_at ? ' or the poll closes' : ''}.</div>
      )}
    </div>
  );
}
