'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['S','M','T','W','T','F','S'];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function formatDisplay(s: string): string {
  if (!s) return '';
  const d = fromYMD(s);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

type Props = {
  value: string; // 'YYYY-MM-DD'
  onChange: (v: string) => void;
  t: Record<string, string>;
  min?: string;
  max?: string;
  placeholder?: string;
  time?: string;               // 'HH:MM', only rendered when onTimeChange is passed
  onTimeChange?: (v: string) => void;
};

// Replaces the browser's native <input type="date"> — no OS calendar
// icon, no platform-inconsistent picker chrome. A single trigger opens a
// glass popover with month navigation and a day grid; an optional time
// row (hour/minute selects styled to match) sits underneath when
// onTimeChange is supplied, so one component covers both cases.
export default function DateTimePicker({ value, onChange, t, min, max, placeholder, time, onTimeChange }: Props) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => (value ? fromYMD(value) : new Date()));
  const [isNarrow, setIsNarrow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // The mobile popover is portaled straight to <body> (see below) so it
  // needs its own ref for the outside-click check — otherwise every click
  // inside it (which lives outside `ref`'s DOM subtree once portaled)
  // would look like a click "outside" and close the calendar instantly.
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) && !(popRef.current && popRef.current.contains(target))) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { if (value) setViewMonth(fromYMD(value)); }, [value]);

  const minDate = min ? fromYMD(min) : null;
  const maxDate = max ? fromYMD(max) : null;

  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ];

  function isDisabled(d: Date) {
    if (minDate && d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && d > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  }

  const selected = value ? fromYMD(value) : null;
  const today = new Date();

  const calendarBody = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.sub, padding: 4, display: 'flex' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}</div>
        <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.sub, padding: 4, display: 'flex' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {DAY_LABELS.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9, color: t.muted, fontWeight: 600, padding: '2px 0' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const disabled = isDisabled(d);
          const isSelected = selected && toYMD(d) === toYMD(selected);
          const isToday = toYMD(d) === toYMD(today);
          return (
            <button key={i} type="button" disabled={disabled} onClick={() => { onChange(toYMD(d)); setOpen(false); }}
              style={{
                aspectRatio: '1', border: 'none', borderRadius: '50%', cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: isSelected ? 700 : 400,
                background: isSelected ? '#534AB7' : isToday ? 'rgba(83,74,183,0.12)' : 'transparent',
                color: disabled ? t.muted : isSelected ? '#fff' : t.text, opacity: disabled ? 0.35 : 1,
                transition: 'background var(--motion-fast) var(--ease-out-expo)',
              }}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      {onTimeChange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${t.border}` }}>
          <span style={{ fontSize: 11, color: t.muted }}>Time</span>
          <input type="time" value={time || ''} onChange={e => onTimeChange(e.target.value)}
            style={{ flex: 1, border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, background: t.input, color: t.text, fontFamily: 'inherit' }} />
        </div>
      )}
    </>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: `1px solid ${t.border}`, borderRadius: 'var(--radius-sm)', padding: '9px 12px', fontSize: 13, background: t.input, color: value ? t.text : t.muted, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color var(--motion-fast) var(--ease-out-expo)' }}>
        <span>{value ? formatDisplay(value) + (time ? ` · ${time}` : '') : (placeholder || 'Select a date')}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--motion-fast) var(--ease-out-expo)' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && !isNarrow && (
        <div className="glass-surface shep-pop-enter" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100, borderRadius: 'var(--radius-md)', padding: 14, width: 280 }}>
          {calendarBody}
        </div>
      )}

      {/* Portaled straight to <body> — an ancestor anywhere in the tree
          (any of the app's "glass" cards use backdrop-filter) creates a new
          containing block for position:fixed descendants, which silently
          re-anchors "centered on the viewport" to "centered on that
          ancestor's box" instead. A portal sidesteps the problem entirely
          regardless of where this component gets mounted.

          Centering here is done with flexbox on the OUTER fixed wrapper,
          not transform:translate(-50%,-50%) — .shep-pop-enter's entrance
          animation also animates `transform` (scale), and a CSS animation
          on transform overrides any inline transform for its whole active
          + fill-mode duration. That silently discarded the translate that
          was supposed to do the centering, leaving the popover anchored by
          its top-left corner at the exact center of the screen instead of
          actually centered — confirmed via screenshot. Splitting the fixed
          positioning (outer, flexbox, no transform) from the scale-in
          animation (inner) means neither one can clobber the other. */}
      {open && isNarrow && typeof document !== 'undefined' && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, pointerEvents: 'none' }}>
            <div ref={popRef} className="glass-surface shep-pop-enter" style={{ pointerEvents: 'auto', borderRadius: 'var(--radius-md)', padding: 14, width: 'calc(100vw - 48px)', maxWidth: 320, maxHeight: '80vh', overflowY: 'auto' }}>
              {calendarBody}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
