'use client';
import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/Icon';

type HistoryEntry = { expression: string; result: string; time: number };

const KEYS = [
  ['C', '±', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '⌫', '='],
];

function evaluate(rawExpr: string): string {
  // Safe arithmetic only — no eval(). Tokenizes +,-,*,/ with left-to-right
  // precedence for * and / first, then + and -. Normalize the display's
  // U+2212 minus sign to ASCII hyphen first, or the regex below (which only
  // matches ASCII) silently drops every subtraction operator.
  const expr = rawExpr.replace(/−/g, '-');
  const tokens = expr.match(/(\d+\.?\d*|[+\-×÷])/g);
  if (!tokens) return expr;
  const nums: number[] = []; const ops: string[] = [];
  let i = 0;
  nums.push(parseFloat(tokens[i++] || '0'));
  while (i < tokens.length) {
    const op = tokens[i++]; const num = parseFloat(tokens[i++] || '0');
    if (op === '×') nums[nums.length - 1] *= num;
    else if (op === '÷') nums[nums.length - 1] = num !== 0 ? nums[nums.length - 1] / num : NaN;
    else { ops.push(op); nums.push(num); }
  }
  let result = nums[0];
  for (let j = 0; j < ops.length; j++) {
    result = ops[j] === '+' ? result + nums[j + 1] : result - nums[j + 1];
  }
  if (Number.isNaN(result)) return 'Error';
  return String(Math.round(result * 1e8) / 1e8);
}

// Persistent floating calculator — mounted once at the page's top level (not
// inside a tab), so it survives switching between the page's internal tabs.
// History persists per role in localStorage — this is an internal work tool,
// not financial system-of-record data, so no backend table for it.
export default function FloatingCalculator({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [expr, setExpr] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const storageKey = `shepherd_calc_history_${role}`;
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, [storageKey]);

  function pushHistory(expression: string, result: string) {
    const next = [{ expression, result, time: Date.now() }, ...history].slice(0, 30);
    setHistory(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }

  function press(key: string) {
    if (key === 'C') { setExpr(''); return; }
    if (key === '⌫') { setExpr(prev => prev.slice(0, -1)); return; }
    if (key === '±') { setExpr(prev => prev.startsWith('-') ? prev.slice(1) : `-${prev}`); return; }
    if (key === '=') {
      if (!expr) return;
      const result = evaluate(expr);
      pushHistory(expr, result);
      setExpr(result === 'Error' ? '' : result);
      return;
    }
    if (key === '%') { setExpr(prev => prev ? String(parseFloat(prev) / 100) : prev); return; }
    setExpr(prev => prev + key);
  }

  function clearHistory() {
    setHistory([]);
    try { localStorage.removeItem(storageKey); } catch {}
  }

  function startDrag(e: React.MouseEvent) {
    dragging.current = true;
    const startX = e.clientX, startY = e.clientY;
    const origin = pos || { x: 0, y: 0 };
    function onMove(ev: MouseEvent) {
      if (!dragging.current) return;
      posRef.current = { x: origin.x + (ev.clientX - startX), y: origin.y + (ev.clientY - startY) };
      setPos(posRef.current);
    }
    function onUp() { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="Calculator"
        style={{ position: 'fixed', bottom: 20, right: 20, width: 48, height: 48, borderRadius: 24, background: '#534AB7', color: '#fff', border: 'none', boxShadow: '0 6px 20px rgba(83,74,183,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>÷</span>
      </button>
    );
  }

  const style: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 200 }
    : { position: 'fixed', bottom: 20, right: 20, zIndex: 200 };

  return (
    <div style={{ ...style, width: 260, background: '#1A1633', border: '0.5px solid rgba(168,159,255,0.2)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.4)', overflow: 'hidden', fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div onMouseDown={startDrag} style={{ background: 'rgba(83,74,183,0.25)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'grab' }}>
        <span style={{ fontSize: 11, color: '#E8E5FF', fontWeight: 600 }}>Calculator</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowHistory(v => !v)} title="History" style={{ background: 'transparent', border: 'none', color: '#A89FFF', cursor: 'pointer' }}><Icon name="ti-history" size={14} /></button>
          <button onClick={() => setMinimized(v => !v)} title="Minimize" style={{ background: 'transparent', border: 'none', color: '#A89FFF', cursor: 'pointer', fontSize: 14 }}>−</button>
          <button onClick={() => setOpen(false)} title="Close" style={{ background: 'transparent', border: 'none', color: '#A89FFF', cursor: 'pointer' }}><Icon name="ti-x" size={14} /></button>
        </div>
      </div>

      {!minimized && (
        <>
          {showHistory ? (
            <div style={{ maxHeight: 220, overflowY: 'auto', padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'rgba(232,229,255,0.5)', textTransform: 'uppercase' }}>History</span>
                <button onClick={clearHistory} style={{ background: 'transparent', border: 'none', color: '#F87171', fontSize: 10, cursor: 'pointer' }}>Clear</button>
              </div>
              {history.length === 0 ? (
                <div style={{ fontSize: 11, color: 'rgba(232,229,255,0.4)', padding: '10px 0' }}>No calculations yet.</div>
              ) : history.map((h, i) => (
                <div key={i} onClick={() => { setExpr(h.result); setShowHistory(false); }} style={{ padding: '6px 4px', borderBottom: '0.5px solid rgba(168,159,255,0.1)', cursor: 'pointer' }}>
                  <div style={{ fontSize: 10, color: 'rgba(232,229,255,0.5)' }}>{h.expression}</div>
                  <div style={{ fontSize: 13, color: '#E8E5FF', fontWeight: 600 }}>= {h.result}</div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 14px 8px', textAlign: 'right', fontSize: 22, color: '#E8E5FF', fontWeight: 600, wordBreak: 'break-all', minHeight: 30 }}>{expr || '0'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, padding: 12 }}>
                {KEYS.flat().map((k, i) => (
                  <button key={i} onClick={() => press(k)}
                    style={{
                      padding: '10px 0', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                      background: k === '=' ? '#534AB7' : ['÷', '×', '−', '+'].includes(k) ? 'rgba(83,74,183,0.3)' : k === 'C' || k === '⌫' ? 'rgba(216,90,48,0.15)' : 'rgba(255,255,255,0.06)',
                      color: k === '=' ? '#fff' : ['÷', '×', '−', '+'].includes(k) ? '#A89FFF' : k === 'C' || k === '⌫' ? '#F87171' : '#E8E5FF',
                    }}>
                    {k}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
