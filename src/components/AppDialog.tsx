'use client';
import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';

// Drop-in, promise-based replacements for window.alert/confirm/prompt —
// those look and read like an OS security prompt (nothing about them
// matches the rest of the app), sit outside any of our styling/theming,
// and years of "just click OK" muscle memory from cookie banners and
// permission prompts means most people don't actually read one before
// dismissing it. Church Feed and Chat each already hand-rolled their own
// local version of this exact fix for their delete confirmations; this is
// the same pattern lifted into one shared, app-wide provider so every
// other alert()/confirm()/window.prompt() call site in the app can be
// swapped for a real modal instead of re-inventing it per page.

type AlertOpts = { title?: string; confirmLabel?: string };
type ConfirmOpts = { title?: string; confirmLabel?: string; cancelLabel?: string; tone?: 'default' | 'danger' };
type PromptOpts = { title?: string; placeholder?: string; required?: boolean; confirmLabel?: string; cancelLabel?: string; defaultValue?: string };

type DialogState =
  | { kind: 'alert'; message: string; opts?: AlertOpts }
  | { kind: 'confirm'; message: string; opts?: ConfirmOpts }
  | { kind: 'prompt'; message: string; opts?: PromptOpts }
  | null;

type AppDialogContextType = {
  alertUser: (message: string, opts?: AlertOpts) => Promise<void>;
  confirmUser: (message: string, opts?: ConfirmOpts) => Promise<boolean>;
  promptUser: (message: string, opts?: PromptOpts) => Promise<string | null>;
};

const AppDialogContext = createContext<AppDialogContextType | null>(null);

export function useAppDialog(): AppDialogContextType {
  const ctx = useContext(AppDialogContext);
  if (!ctx) throw new Error('useAppDialog must be used within AppDialogProvider (mounted in root layout)');
  return ctx;
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const { dark } = useTheme();
  const [state, setState] = useState<DialogState>(null);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolverRef = useRef<((v: any) => void) | null>(null);

  const t = {
    card: dark ? '#151030' : '#FFFFFF',
    text: dark ? '#E8E5FF' : '#1A1040',
    sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.45)' : '#9990CC',
    border: dark ? 'rgba(168,159,255,0.16)' : 'rgba(83,74,183,0.16)',
    input: dark ? '#0F0C20' : '#F7F6FF',
    purple: dark ? '#A89FFF' : '#534AB7',
    coral: dark ? '#F0876B' : '#D85A30',
  };

  const close = useCallback((result: unknown) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
    setInputValue('');
    setInputError('');
  }, []);

  const alertUser = useCallback((message: string, opts?: AlertOpts) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setState({ kind: 'alert', message, opts });
    });
  }, []);

  const confirmUser = useCallback((message: string, opts?: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ kind: 'confirm', message, opts });
    });
  }, []);

  const promptUser = useCallback((message: string, opts?: PromptOpts) => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
      setInputValue(opts?.defaultValue || '');
      setInputError('');
      setState({ kind: 'prompt', message, opts });
    });
  }, []);

  function submitPrompt() {
    if (!state || state.kind !== 'prompt') return;
    const required = state.opts?.required !== false; // required by default — every existing window.prompt() call site treated empty input as invalid
    if (required && !inputValue.trim()) { setInputError('This field is required.'); return; }
    close(inputValue.trim());
  }

  function dismiss() {
    if (!state) return;
    if (state.kind === 'alert') close(undefined);
    else if (state.kind === 'confirm') close(false);
    else close(null);
  }

  return (
    <AppDialogContext.Provider value={{ alertUser, confirmUser, promptUser }}>
      {children}
      {state && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={dismiss}
        >
          <div
            style={{ background: t.card, borderRadius: 16, padding: 24, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', fontFamily: 'inherit' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>
              {state.opts?.title || (state.kind === 'alert' ? 'Notice' : state.kind === 'confirm' ? 'Are you sure?' : 'One more thing')}
            </div>
            <div style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.5, marginBottom: state.kind === 'prompt' ? 12 : 18 }}>
              {state.message}
            </div>

            {state.kind === 'prompt' && (
              <>
                <input
                  autoFocus
                  value={inputValue}
                  onChange={(e) => { setInputValue(e.target.value); if (inputError) setInputError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitPrompt(); }}
                  placeholder={state.opts?.placeholder || ''}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: t.input, color: t.text,
                    border: `0.5px solid ${inputError ? t.coral : t.border}`,
                    borderRadius: 9, padding: '10px 12px', fontSize: 13,
                    marginBottom: inputError ? 6 : 18, fontFamily: 'inherit', outline: 'none',
                  }}
                />
                {inputError && <div style={{ fontSize: 11.5, color: t.coral, marginTop: -4, marginBottom: 12 }}>{inputError}</div>}
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {state.kind !== 'alert' && (
                <button
                  onClick={() => close(state.kind === 'confirm' ? false : null)}
                  style={{ flex: 1, background: 'transparent', color: t.muted, border: `0.5px solid ${t.border}`, borderRadius: 9, padding: '10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {state.opts?.cancelLabel || 'Cancel'}
                </button>
              )}
              <button
                onClick={() => state.kind === 'alert' ? close(undefined) : state.kind === 'confirm' ? close(true) : submitPrompt()}
                style={{
                  flex: 1, border: 'none', borderRadius: 9, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  background: state.kind === 'confirm' && state.opts?.tone === 'danger' ? t.coral : t.purple,
                  color: '#fff',
                }}
              >
                {state.opts?.confirmLabel || (state.kind === 'alert' ? 'OK' : state.kind === 'confirm' ? 'Confirm' : 'Submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppDialogContext.Provider>
  );
}
