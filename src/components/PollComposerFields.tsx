'use client';
import Icon from '@/components/Icon';
import type { PollDraft } from '@/types/poll';

function pollTheme(dark: boolean) {
  return {
    text: dark ? '#E8E5FF' : '#1A1040', sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.35)' : '#9990CC', border: dark ? 'rgba(168,159,255,0.14)' : 'rgba(83,74,183,0.16)',
    purple: dark ? '#A89FFF' : '#534AB7', purpleBg: dark ? '#1A1A2E' : '#EEEDFE',
    input: dark ? '#0F0C20' : '#F7F6FF', coral: dark ? '#F0876B' : '#D85A30',
  };
}

// The poll-mode fields inside a composer — question, dynamically add/
// remove option rows, single/multiple choice, allow-vote-change,
// closes-at. Shared by the Church Feed composer and the group-chat
// composer so the "create a poll" experience is identical on both.
export default function PollComposerFields({ draft, onChange, dark }: { draft: PollDraft; onChange: (next: PollDraft) => void; dark: boolean }) {
  const t = pollTheme(dark);

  function setOption(i: number, value: string) {
    const options = [...draft.options];
    options[i] = value;
    onChange({ ...draft, options });
  }
  function addOption() {
    if (draft.options.length >= 20) return;
    onChange({ ...draft, options: [...draft.options, ''] });
  }
  function removeOption(i: number) {
    if (draft.options.length <= 2) return;
    onChange({ ...draft, options: draft.options.filter((_, idx) => idx !== i) });
  }

  return (
    <div style={{ marginTop: 8, border: `0.5px dashed ${t.purple}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input value={draft.question} onChange={e => onChange({ ...draft, question: e.target.value })} placeholder="Ask a question…"
        style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontWeight: 600, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {draft.options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={opt} onChange={e => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`}
              style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' }} />
            {draft.options.length > 2 && (
              <button onClick={() => removeOption(i)} title="Remove option"
                style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', display: 'flex', padding: 4, flexShrink: 0 }}>
                <Icon name="ti-x" size={13} />
              </button>
            )}
          </div>
        ))}
        {draft.options.length < 20 && (
          <button onClick={addOption}
            style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: t.purple, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
            + Add option
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' as const, alignItems: 'center', marginTop: 2 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: t.sub, cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.poll_type === 'multiple'} onChange={e => onChange({ ...draft, poll_type: e.target.checked ? 'multiple' : 'single' })} />
          Allow multiple answers
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: t.sub, cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.allow_vote_change} onChange={e => onChange({ ...draft, allow_vote_change: e.target.checked })} />
          Allow changing vote
        </label>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: t.sub }}>
        Closes:
        <input type="datetime-local" value={draft.closes_at} onChange={e => onChange({ ...draft, closes_at: e.target.value })}
          style={{ border: `0.5px solid ${t.border}`, borderRadius: 6, padding: '4px 7px', fontSize: 11, background: t.input, color: t.text, outline: 'none' }} />
        <span style={{ color: t.muted }}>(optional)</span>
      </label>
    </div>
  );
}
