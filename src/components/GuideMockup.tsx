'use client';
import type { CSSProperties } from 'react';
// Small, on-brand illustrative mockups used by the guided tour and the
// Help panel in place of instructional video — schematic representations
// of each screen (not live screenshots), styled to match the rest of the
// app. Parameterized by `kind` + a short `labels` list so one component
// covers every feature without needing a bespoke illustration per screen.

export type MockupKind = 'list' | 'form' | 'board' | 'chat' | 'calendar' | 'chart' | 'tree' | 'split';

// Deliberately Record<string,string> rather than a named interface with
// exact keys — every page in this app defines its own inline `t` theme
// object independently (same color-token names throughout, but each is
// its own inferred literal type), and a same-shaped variable is always
// assignable to Record<string,string> without needing byte-exact parity
// checked page by page. Expected keys: bg, card, border, text, sub,
// muted, input, purple, purpleBg, teal, tealBg, coral, coralBg.
export type GuideTheme = Record<string, string>;

export default function GuideMockup({ kind, labels = [], t }: { kind: MockupKind; labels?: string[]; t: GuideTheme }) {
  const box: CSSProperties = {
    background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12,
    padding: 14, height: 148, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden',
  };
  const row = (label: string, accent: string, accentBg: string, trailing?: string) => (
    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, background: accentBg, borderRadius: 8, padding: '7px 10px' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, flexShrink: 0 }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: t.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      {trailing && <div style={{ fontSize: 9, color: accent, fontWeight: 700, flexShrink: 0 }}>{trailing}</div>}
    </div>
  );

  if (kind === 'list') {
    const items = labels.length ? labels : ['Grace Chapel Cell', 'Overcomers Cell', 'New Life Cell'];
    return <div style={box}>{items.slice(0, 4).map((l, i) => row(l, i === 0 ? t.teal : t.purple, i === 0 ? t.tealBg : t.purpleBg, i === 0 ? 'A' : undefined))}</div>;
  }

  if (kind === 'form') {
    const fields = labels.length ? labels : ['Full name', 'Amount'];
    return (
      <div style={box}>
        {fields.slice(0, 3).map(f => (
          <div key={f}>
            <div style={{ fontSize: 8.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3 }}>{f}</div>
            <div style={{ background: t.input, border: `0.5px solid ${t.border}`, borderRadius: 7, height: 22 }} />
          </div>
        ))}
        <div style={{ marginTop: 'auto', background: t.purple, color: '#fff', borderRadius: 8, textAlign: 'center', padding: '7px', fontSize: 10.5, fontWeight: 700 }}>Submit</div>
      </div>
    );
  }

  if (kind === 'board') {
    const cols = labels.length ? labels : ['Needs attention', 'On track'];
    const colColors = [{ c: t.coral, bg: t.coralBg }, { c: t.teal, bg: t.tealBg }];
    return (
      <div style={{ ...box, flexDirection: 'row' }}>
        {cols.slice(0, 2).map((c, i) => (
          <div key={c} style={{ flex: 1, background: colColors[i % 2].bg, borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: colColors[i % 2].c, textTransform: 'uppercase', marginBottom: 2 }}>{c}</div>
            {[0, 1].map(n => <div key={n} style={{ background: t.card, borderRadius: 6, height: 20, border: `0.5px solid ${t.border}` }} />)}
          </div>
        ))}
      </div>
    );
  }

  if (kind === 'chat') {
    const msgs = labels.length ? labels : ['Good afternoon!', 'Can everyone confirm for Sunday?'];
    return (
      <div style={box}>
        {msgs.slice(0, 3).map((m, i) => (
          <div key={m} style={{ alignSelf: i % 2 ? 'flex-end' : 'flex-start', maxWidth: '78%', background: i % 2 ? t.purple : t.input, color: i % 2 ? '#fff' : t.text, borderRadius: 10, padding: '7px 10px', fontSize: 10.5 }}>{m}</div>
        ))}
      </div>
    );
  }

  if (kind === 'calendar') {
    return (
      <div style={box}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, flex: 1 }}>
          {Array.from({ length: 21 }).map((_, i) => (
            <div key={i} style={{
              borderRadius: 4, background: i === 10 ? t.purple : t.input,
              border: `0.5px solid ${t.border}`,
            }} />
          ))}
        </div>
        <div style={{ fontSize: 9.5, color: t.purple, fontWeight: 700 }}>{labels[0] || 'Sunday Service — 9:00 AM'}</div>
      </div>
    );
  }

  if (kind === 'chart') {
    const bars = [40, 65, 50, 80, 60, 90];
    return (
      <div style={box}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flex: 1 }}>
          {bars.map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, background: i === bars.length - 1 ? t.purple : t.purpleBg, borderRadius: '4px 4px 0 0' }} />)}
        </div>
        <div style={{ fontSize: 9.5, color: t.sub }}>{labels[0] || 'Last 6 weeks'}</div>
      </div>
    );
  }

  if (kind === 'tree') {
    const parts = labels.length ? labels : ['Fellowship', 'Cell', 'Member'];
    return (
      <div style={{ ...box, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {parts.map((p, i) => (
            <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, background: i === parts.length - 1 ? t.tealBg : t.purpleBg, color: i === parts.length - 1 ? t.teal : t.purple, borderRadius: 6, padding: '4px 10px' }}>{p}</span>
              {i < parts.length - 1 && <span style={{ color: t.muted }}>›</span>}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // split — a list on the left, detail on the right (Members-style)
  const items = labels.length ? labels : ['Adaeze N.', 'Michael O.', 'Grace T.'];
  return (
    <div style={{ ...box, flexDirection: 'row' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.slice(0, 3).map((n, i) => (
          <div key={n} style={{ background: i === 0 ? t.purpleBg : 'transparent', borderRadius: 6, padding: '5px 7px', fontSize: 9.5, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? t.purple : t.sub }}>{n}</div>
        ))}
      </div>
      <div style={{ flex: 1.3, background: t.input, borderRadius: 8, padding: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ height: 8, width: '60%', background: t.purpleBg, borderRadius: 3 }} />
        <div style={{ height: 6, width: '85%', background: t.border, borderRadius: 3 }} />
        <div style={{ height: 6, width: '70%', background: t.border, borderRadius: 3 }} />
      </div>
    </div>
  );
}
