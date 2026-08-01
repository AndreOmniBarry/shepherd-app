'use client';

// Next.js remounts this wrapper on every route change (unlike layout.tsx,
// which persists) — so the enter animation replays on every navigation,
// giving real page-to-page motion instead of an abrupt hard cut. This is
// the enter half only; a true crossfade with the outgoing page held on
// screen during the transition needs a client-side animation library
// (e.g. framer-motion's AnimatePresence) since the App Router itself
// doesn't keep the old page mounted during navigation.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="shep-route-enter">{children}</div>;
}
