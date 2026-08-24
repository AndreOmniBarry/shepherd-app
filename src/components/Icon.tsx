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
  'ti-heart-handshake': <><path d="M12 6.5a3.5 3.5 0 0 0-6-2.4C4.7 5 4.3 6.7 5 8l1 1.5"/><path d="M2 13l3-3 3 2h4l4-3 3 2-5 5h-3l-2-1.5"/><path d="M14 8.5A3.5 3.5 0 0 1 19 6c1.3.6 1.7 2.3 1 3.6L19 11"/></>,
  'ti-receipt': <><path d="M4 3h16v18l-3-2-3 2-3-2-3 2-3-2-1 2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></>,
  'ti-checkbox': <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12l2 2 4-4"/></>,
  'ti-settings': <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  'ti-shield': <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  'ti-calendar-check': <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></>,
  'ti-history': <><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3,4 3,10 9,10"/><polyline points="12,7 12,12 16,14"/></>,
  'ti-user-check': <><circle cx="9" cy="7" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="m16 11 2 2 4-4"/></>,
  'ti-cake': <><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16c1 1 2 1 3 0s2-1 3 0 2 1 3 0 2-1 3 0 2 1 3 0"/><line x1="12" y1="7" x2="12" y2="3"/><path d="M9 7a2 2 0 1 1 3-2 2 2 0 1 1 3 2"/></>,
  'ti-trophy': <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4a1 1 0 0 0-1 1 4 4 0 0 0 4 4M17 5h3a1 1 0 0 1 1 1 4 4 0 0 1-4 4"/></>,
  'ti-calendar-event': <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="15" r="2"/></>,
  'ti-speakerphone': <><path d="M3 11v3a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M14 8a4 4 0 0 1 0 8M17 5a8 8 0 0 1 0 14"/></>,
  'ti-x': <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  'ti-alert-triangle': <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  'ti-zap': <><polygon points="13,2 3,14 11,14 11,22 21,10 13,10"/></>,
  'ti-eye': <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  'ti-gem': <><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l3 6-3 12M15 3l-3 6 3 12"/></>,
  'ti-sprout': <><path d="M7 20h10M12 20v-8"/><path d="M12 12C7 12 5 8 5 4c4 0 8 2 7 8z"/><path d="M12 12c1-4 4-6 8-6 0 4-1 7-8 6z"/></>,
  'ti-rocket': <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></>,
  'ti-crown': <><path d="M2 18h20l-2-9-5 4-3-7-3 7-5-4z"/></>,
  'ti-ticket': <><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><line x1="9" y1="7" x2="9" y2="17"/></>,
  'ti-map-pin': <><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></>,
  'ti-clock': <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>,
  'ti-check': <><path d="M20 6 9 17l-5-5"/></>,
  'ti-search': <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  'ti-arrow-left': <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="11,6 5,12 11,18"/></>,
  'ti-trash': <><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>,
  'ti-message-circle': <><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></>,
  'ti-lock': <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
  'ti-phone': <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></>,
  'ti-logout': <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  'ti-chevron-down': <polyline points="6,9 12,15 18,9"/>,
  'ti-download': <><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><polyline points="7,11 12,16 17,11"/><line x1="12" y1="4" x2="12" y2="16"/></>,
  'ti-photo': <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.75"/><path d="M21 15l-5-5-4 4-2-2-6 6"/></>,
  'ti-corner-down-right': <><polyline points="15,10 21,16 15,22"/><path d="M3 4v6a4 4 0 0 0 4 4h14"/></>,
  'ti-mood-smile': <><circle cx="12" cy="12" r="9"/><path d="M8.5 9.5h.01M15.5 9.5h.01M8.5 14a4 4 0 0 0 7 0"/></>,
  'ti-help': <><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 2.5-3 4.5"/><line x1="12" y1="17.5" x2="12" y2="17.51"/></>,
};

export default function Icon({ name, size = 15, strokeWidth = 1.8, style, className }: { name?: string; size?: number; strokeWidth?: number; style?: CSSProperties; className?: string }) {
  if (!name || !PATHS[name]) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
