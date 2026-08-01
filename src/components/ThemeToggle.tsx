'use client';

// Shared sleek light/dark switch — replaces the ad-hoc ☀/◑ square button
// that was duplicated (slightly differently styled) across every portal.
export default function ThemeToggle({ dark, setDark, border, compact = false }: { dark: boolean; setDark: (v: boolean | ((prev: boolean) => boolean)) => void; border: string; compact?: boolean }) {
  const w = compact ? 40 : 50, h = compact ? 22 : 28, knob = compact ? 18 : 22, icon = compact ? 10 : 12;
  return (
    <div onClick={() => setDark(v => !v)} role="switch" aria-checked={dark} style={{ width: w, height: h, borderRadius: h / 2, border: `0.5px solid ${border}`, background: dark ? 'linear-gradient(135deg,#3C3489,#534AB7)' : '#EEEDFE', display: 'flex', alignItems: 'center', padding: 2, cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.25s ease' }}>
      <div style={{ width: knob, height: knob, borderRadius: '50%', background: dark ? '#1A1730' : '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: dark ? `translateX(${w - knob - 4}px)` : 'translateX(0)', transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)', color: dark ? '#CFC9FF' : '#8A7FD8' }}>
        {dark
          ? <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          : <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
      </div>
    </div>
  );
}
