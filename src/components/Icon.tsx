'use client';
import type { CSSProperties, ReactNode } from 'react';
// Inline SVG icon set — replaces the Tabler webfont CDN dependency, which
// fails to load reliably (confirmed: net::ERR_TUNNEL_CONNECTION_FAILED) and
// silently renders every icon blank when it does. No external font, no CDN,
// no flash of missing glyphs.

const PATHS: Record<string, ReactNode> = {
  'ti-layout-dashboard': <><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/></>,
  'ti-users': <><circle cx="9" cy="7" r="3"/><path d="M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M21 21c0-2.8-1.8-5-4-5.5"/></>,
  'ti-building': <><path d="M4 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16"/><path d="M15 21V9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v12"/><line x1="2" y1="21" x2="22" y2="21"/><line x1="7" y1="8" x2="7" y2="8.01"/><line x1="7" y1="12" x2="7" y2="12.01"/><line x1="7" y1="16" x2="7" y2="16.01"/></>,
  'ti-calendar-stats': <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h1M8 17h1M12 14h1v3M16 15v2"/></>,
  'ti-coin': <><circle cx="12" cy="12" r="9"/><path d="M14.8 9a2 2 0 0 0-1.9-1.4h-1.8a2 2 0 0 0 0 4h1.8a2 2 0 0 1 0 4h-1.8a2 2 0 0 1-1.9-1.4"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></>,
  'ti-circles': <><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v4M8.5 17.5 12 11l3.5 6.5"/></>,
  'ti-chart-bar': <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  'ti-award': <><polygon points="12,2 15.1,8.3 22,9.3 17,14.1 18.2,21 12,17.8 5.8,21 7,14.1 2,9.3 8.9,8.3"/></>,
  'ti-star': <><polygon points="12,2 15.1,8.3 22,9.3 17,14.1 18.2,21 12,17.8 5.8,21 7,14.1 2,9.3 8.9,8.3"/></>,
  'ti-heart': <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></>,
  'ti-receipt': <><path d="M4 3h16v18l-3-2-3 2-3-2-3 2-3-2-1 2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></>,
  'ti-checkbox': <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12l2 2 4-4"/></>,
  'ti-settings': <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  'ti-shield': <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  'ti-calendar-check': <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></>,
  'ti-history': <><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3,4 3,10 9,10"/><polyline points="12,7 12,12 16,14"/></>,
  'ti-user-check': <><circle cx="9" cy="7" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="m16 11 2 2 4-4"/></>,
  'ti-cake': <><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16c1 1 2 1 3 0s2-1 3 0 2 1 3 0 2-1 3 0 2 1 3 0"/><line x1="12" y1="7" x2="12" y2="3"/><path d="M9 7a2 2 0 1 1 3-2 2 2 0 1 1 3 2"/></>,
};

export default function Icon({ name, size = 15, style, className }: { name?: string; size?: number; style?: CSSProperties; className?: string }) {
  if (!name || !PATHS[name]) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
