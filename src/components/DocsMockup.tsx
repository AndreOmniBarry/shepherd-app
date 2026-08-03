'use client';
import { useEffect, useState } from 'react';
import type { StatTile } from '@/lib/docs-content';

const ACCENTS: Record<string, { c: string; bg: string }> = {
  purple: { c: '#534AB7', bg: '#EEEDFE' },
  teal: { c: '#1D9E75', bg: '#E1F5EE' },
  amber: { c: '#BA7517', bg: '#FAEEDA' },
  coral: { c: '#D85A30', bg: '#FAECE7' },
};

type Device = 'desktop' | 'mobile' | 'ios';

type Props = {
  appName: string;
  nav: string[];
  activeIndex: number;
  heading: string;
  tiles: StatTile[];
  chartLabel: string;
  chartValues: number[];
  accent: 'purple' | 'teal' | 'amber' | 'coral';
};

// Renders one abstract feature "screen" — same live data across three real
// device frames (Desktop / Mobile / iOS), so a prospect can see how a
// feature actually looks wherever their team works, not just on a laptop.
export default function DocsMockup({ appName, nav, activeIndex, heading, tiles, chartLabel, chartValues, accent }: Props) {
  const [device, setDevice] = useState<Device>('desktop');
  const [tick, setTick] = useState(0);
  const a = ACCENTS[accent];

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2200);
    return () => clearInterval(id);
  }, []);

  // Only wobble values that are a single number (plain or currency-prefixed)
  // — "22 / 26" or "46 / 48" contain two numeric runs, and naively parsing
  // "digits only" would merge them into one bogus figure.
  const liveValue = (v: string, i: number) => {
    if (i !== 0) return v;
    const matches = v.match(/[0-9][0-9,.]*/g);
    if (!matches || matches.length !== 1) return v;
    const num = parseFloat(matches[0].replace(/,/g, ''));
    if (isNaN(num)) return v;
    const wobble = Math.round(num * (1 + Math.sin(tick) * 0.015));
    return v.replace(matches[0], wobble.toLocaleString());
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, justifyContent: 'center' }}>
        {(['desktop', 'mobile', 'ios'] as Device[]).map(d => (
          <button
            key={d}
            onClick={() => setDevice(d)}
            style={{
              background: device === d ? a.c : '#fff',
              color: device === d ? '#fff' : '#4A4272',
              border: `1px solid ${device === d ? a.c : 'rgba(83,74,183,0.15)'}`,
              borderRadius: 20, padding: '6px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {d === 'desktop' ? 'Desktop' : d === 'mobile' ? 'Mobile' : 'iOS'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {device === 'desktop' && <DesktopFrame appName={appName} nav={nav} activeIndex={activeIndex} heading={heading} tiles={tiles} chartLabel={chartLabel} chartValues={chartValues} accent={a} liveValue={liveValue} />}
        {device === 'mobile' && <PhoneFrame variant="mobile" nav={nav} activeIndex={activeIndex} heading={heading} tiles={tiles} chartLabel={chartLabel} chartValues={chartValues} accent={a} liveValue={liveValue} />}
        {device === 'ios' && <PhoneFrame variant="ios" nav={nav} activeIndex={activeIndex} heading={heading} tiles={tiles} chartLabel={chartLabel} chartValues={chartValues} accent={a} liveValue={liveValue} />}
      </div>
    </div>
  );
}

type FrameProps = {
  nav: string[]; activeIndex: number; heading: string; tiles: StatTile[];
  chartLabel: string; chartValues: number[]; accent: { c: string; bg: string };
  liveValue: (v: string, i: number) => string;
};

function DesktopFrame({ appName, nav, activeIndex, heading, tiles, chartLabel, chartValues, accent, liveValue }: FrameProps & { appName: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(36,31,82,0.22)', border: '0.5px solid rgba(83,74,183,0.12)', width: '100%', maxWidth: 640 }}>
      <div style={{ background: '#241F52', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {['#FF5F57', '#FFBD2E', '#28C840'].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />)}
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 8, fontFamily: 'monospace' }}>{appName}</div>
      </div>
      <div style={{ display: 'flex', minHeight: 320 }}>
        <div style={{ width: 140, background: '#241F52', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          {nav.map((item, i) => (
            <div key={i} style={{ padding: '8px 14px', margin: '0 8px', borderRadius: 7, background: i === activeIndex ? 'rgba(255,255,255,0.12)' : 'transparent', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 11, height: 11, borderRadius: 3, background: i === activeIndex ? accent.c : 'rgba(255,255,255,0.15)' }} />
              <div style={{ fontSize: 11, color: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.45)', fontWeight: i === activeIndex ? 600 : 400 }}>{item}</div>
            </div>
          ))}
        </div>
        <ScreenContent heading={heading} tiles={tiles} chartLabel={chartLabel} chartValues={chartValues} accent={accent} liveValue={liveValue} cols={2} />
      </div>
    </div>
  );
}

function PhoneFrame({ variant, nav, activeIndex, heading, tiles, chartLabel, chartValues, accent, liveValue }: FrameProps & { variant: 'mobile' | 'ios' }) {
  const isIOS = variant === 'ios';
  return (
    <div style={{ width: 280, background: '#0A0618', borderRadius: 34, padding: 10, boxShadow: '0 20px 60px rgba(36,31,82,0.28)' }}>
      <div style={{ background: '#F4F3FB', borderRadius: 24, overflow: 'hidden', position: 'relative' }}>
        {isIOS ? (
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 76, height: 20, background: '#0A0618', borderRadius: 12, zIndex: 2 }} />
        ) : (
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, background: '#0A0618', borderRadius: '50%', zIndex: 2 }} />
        )}
        <div style={{ height: 34 }} />
        <div style={{ padding: '4px 14px 10px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F0A2E' }}>{heading}</div>
        </div>
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tiles.slice(0, 2).map((t, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: isIOS ? 14 : 10, padding: '10px 12px', border: '0.5px solid rgba(83,74,183,0.12)' }}>
              <div style={{ fontSize: 8, color: '#9890C4', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3 }}>{t.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0F0A2E' }}>{liveValue(t.value, i)}</div>
              {t.sub && <div style={{ fontSize: 9, color: accent.c, marginTop: 1 }}>{t.sub}</div>}
            </div>
          ))}
          <div style={{ background: '#fff', borderRadius: isIOS ? 14 : 10, padding: 10, border: '0.5px solid rgba(83,74,183,0.12)' }}>
            <div style={{ fontSize: 8, color: '#9890C4', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 7 }}>{chartLabel}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 46 }}>
              {chartValues.map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: i === chartValues.length - 1 ? accent.c : accent.bg, borderRadius: 3, transition: 'height 0.6s ease' }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: isIOS ? '10px 8px 16px' : '10px 8px', borderTop: '0.5px solid rgba(83,74,183,0.1)', background: '#fff' }}>
          {nav.slice(0, 4).map((item, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: isIOS ? 20 : 16, height: isIOS ? 20 : 16, borderRadius: isIOS ? 6 : '50%', background: i === activeIndex ? accent.c : 'rgba(83,74,183,0.15)' }} />
              <div style={{ fontSize: 7.5, color: i === activeIndex ? accent.c : '#9890C4', fontWeight: i === activeIndex ? 700 : 500, maxWidth: 48, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenContent({ heading, tiles, chartLabel, chartValues, accent, liveValue, cols }: Omit<FrameProps, 'nav' | 'activeIndex'> & { cols: number }) {
  return (
    <div style={{ flex: 1, padding: 16, background: '#F4F3FB' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F0A2E', marginBottom: 12 }}>{heading}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, marginBottom: 12 }}>
        {tiles.map((t, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 9, padding: '10px 12px', border: '0.5px solid rgba(83,74,183,0.12)' }}>
            <div style={{ fontSize: 8, color: '#9890C4', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3 }}>{t.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F0A2E' }}>{liveValue(t.value, i)}</div>
            {t.sub && <div style={{ fontSize: 9, color: accent.c, marginTop: 1 }}>{t.sub}</div>}
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: 9, padding: 12, border: '0.5px solid rgba(83,74,183,0.12)' }}>
        <div style={{ fontSize: 8, color: '#9890C4', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>{chartLabel}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
          {chartValues.map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: i === chartValues.length - 1 ? accent.c : accent.bg, borderRadius: 3, transition: 'height 0.6s ease' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
