'use client';

// Content-shaped shimmer placeholder — mirrors the layout that's about to
// arrive (a line, a tile, a card) instead of a spinner or bare "Loading…"
// text, so the page doesn't visually jump once data lands.
export function SkeletonBlock({ width = '100%', height = 14, radius = 8, style }: { width?: number | string; height?: number; radius?: number; style?: React.CSSProperties }) {
  return <div className="shep-skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonLine({ width = '100%' }: { width?: number | string }) {
  return <SkeletonBlock width={width} height={12} radius={6} />;
}

export function SkeletonCard({ lines = 3, style, children }: { lines?: number; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--glass-bg)', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(160%)', backdropFilter: 'blur(var(--glass-blur)) saturate(160%)', border: '0.5px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {children ?? (<>
        <SkeletonLine width="40%" />
        {Array.from({ length: lines }, (_, i) => <SkeletonLine key={i} width={`${85 - i * 12}%`} />)}
      </>)}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
      <SkeletonBlock width={32} height={32} radius={8} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SkeletonLine width="55%" />
        <SkeletonLine width="30%" />
      </div>
    </div>
  );
}
