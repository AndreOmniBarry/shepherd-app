'use client';
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

const STORAGE_KEY = 'shepherd-theme';

type DarkSetter = (v: boolean | ((prev: boolean) => boolean)) => void;
type ThemeContextType = { dark: boolean; setDark: DarkSetter; toggle: () => void };

const ThemeContext = createContext<ThemeContextType | null>(null);

// One dark/light preference for the whole app, persisted so it survives
// navigating between portals, Calendar, Chat, Church Feed/Center — every
// route reads the same stored value instead of defaulting back to light.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === 'dark') setDarkState(true);
  }, []);

  const setDark = useCallback<DarkSetter>((v) => {
    setDarkState(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      try { window.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light'); } catch { /* storage unavailable — theme just won't persist */ }
      return next;
    });
  }, []);

  const toggle = useCallback(() => setDark(v => !v), [setDark]);

  return <ThemeContext.Provider value={{ dark, setDark, toggle }}>{children}</ThemeContext.Provider>;
}

// Falls back to local, unpersisted state if no provider is mounted (should
// not happen once the root layout wraps the app, but keeps any page that
// forgets the provider from crashing outright).
export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  const [fallbackDark, setFallbackDark] = useState(false);
  if (ctx) return ctx;
  return { dark: fallbackDark, setDark: setFallbackDark, toggle: () => setFallbackDark(v => !v) };
}
