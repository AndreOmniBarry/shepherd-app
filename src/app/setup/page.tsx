'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { STRUCTURE_PRESETS, SUPPORTED_CURRENCIES, ALL_COUNTRIES, type StructureType } from '@/lib/church-config';

const SERVICE_DAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SetupWizard() {
  const router = useRouter();
  const [screen, setScreen] = useState<1|2|3>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  // Form state
  const [structureType, setStructureType] = useState<StructureType>('cell_church');
  const [tier1Label, setTier1Label] = useState('Fellowship');
  const [tier2Label, setTier2Label] = useState('Cell');
  const [tier3Label, setTier3Label] = useState('');
  const [tier1HeadLabel, setTier1HeadLabel] = useState('Fellowship Head');
  const [tier2HeadLabel, setTier2HeadLabel] = useState('Cell Leader');
  const [churchName, setChurchName] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [currency, setCurrency] = useState('NGN');
  const [serviceDays, setServiceDays] = useState<string[]>(['Sunday']);

  useEffect(() => { setMounted(true); }, []);

  function selectStructure(type: StructureType) {
    const preset = STRUCTURE_PRESETS[type];
    setStructureType(type);
    setTier1Label(preset.tier1_label || '');
    setTier2Label(preset.tier2_label || '');
    setTier3Label(preset.tier3_label || '');
    setTier1HeadLabel(preset.tier1_head_label);
    setTier2HeadLabel(preset.tier2_head_label);
  }

  function toggleDay(day: string) {
    setServiceDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  }

  async function save() {
    if (!churchName.trim()) { setError('Church name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/settings/church-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          church_name: churchName.trim(),
          structure_type: structureType,
          tier1_label: tier1Label || null,
          tier2_label: tier2Label || null,
          tier3_label: tier3Label || null,
          tier1_head_label: tier1HeadLabel,
          tier2_head_label: tier2HeadLabel,
          currency,
          country,
          service_days: serviceDays,
          is_configured: true,
        }),
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const d = await res.json();
        setError(d?.error?.message || 'Failed to save. Make sure you are logged in as overseer or lead tech.');
      }
    } catch { setError('Network error. Please try again.'); }
    setSaving(false);
  }

  if (!mounted) return null;

  const purple = '#534AB7';
  const purpleBg = '#EEEDFE';
  const border = 'rgba(83,74,183,0.15)';
  const text = '#1A1040';
  const muted = '#9990CC';
  const sub = '#5A5180';
  const inputBg = '#F7F6FF';
  const teal = '#1D9E75';

  const preset = STRUCTURE_PRESETS[structureType];
  const progress = (screen / 3) * 100;

  return (
    <div style={{ minHeight: '100vh', background: '#F0EFF8', fontFamily: 'var(--font-inter, Inter, sans-serif)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '40px 20px' }}>

      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: purple, letterSpacing: '-0.5px' }}>SHEP.HERD</div>
        <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>Church Setup Wizard</div>
      </div>

      {/* Progress */}
      <div style={{ width: '100%', maxWidth: 560, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          {['Choose Structure', 'Customise Labels', 'Church Details'].map((label, i) => (
            <div key={i} style={{ fontSize: 11, color: screen > i ? purple : muted, fontWeight: screen === i + 1 ? 600 : 400 }}>{label}</div>
          ))}
        </div>
        <div style={{ height: 4, background: border, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: purple, borderRadius: 4, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 560, marginTop: 24 }}>

        {/* ── SCREEN 1: STRUCTURE ── */}
        {screen === 1 && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: text }}>How is your church structured?</div>
              <div style={{ fontSize: 13, color: sub, marginTop: 6 }}>Pick the model that matches how your church is organised. You can customise the names on the next screen.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(Object.entries(STRUCTURE_PRESETS) as [StructureType, typeof STRUCTURE_PRESETS[StructureType]][]).map(([key, p]) => (
                <button key={key} onClick={() => selectStructure(key)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', borderRadius: 12, border: `${structureType === key ? '1.5px' : '0.5px'} solid ${structureType === key ? purple : border}`, background: structureType === key ? purpleBg : '#fff', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 26, flexShrink: 0, marginTop: 2 }}>{p.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: text }}>{p.label}</span>
                      {structureType === key && <span style={{ fontSize: 10, background: purple, color: '#fff', borderRadius: 10, padding: '1px 8px', fontWeight: 600 }}>Selected</span>}
                    </div>
                    <div style={{ fontSize: 12, color: sub, marginBottom: 6 }}>{p.description}</div>
                    <div style={{ fontSize: 11, color: muted, marginBottom: 8 }}>Used by: {p.usedBy}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[p.tier1_label, p.tier2_label, p.tier3_label].filter(Boolean).map((tier, i) => (
                        <span key={i} style={{ fontSize: 10, background: purpleBg, color: purple, borderRadius: 6, padding: '2px 8px', fontWeight: 500 }}>{tier}</span>
                      ))}
                      <span style={{ fontSize: 10, background: '#E1F5EE', color: '#085041', borderRadius: 6, padding: '2px 8px', fontWeight: 500 }}>Member</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setScreen(2)}
              style={{ marginTop: 20, width: '100%', background: purple, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Next — Customise Labels →
            </button>
          </div>
        )}

        {/* ── SCREEN 2: LABELS ── */}
        {screen === 2 && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: text }}>What do you call each level?</div>
              <div style={{ fontSize: 13, color: sub, marginTop: 6 }}>These labels appear everywhere — portals, reports, notifications. Match your church's language.</div>
            </div>

            <div style={{ background: '#fff', border: `0.5px solid ${border}`, borderRadius: 12, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Live preview */}
              <div style={{ background: purpleBg, borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, color: purple, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Live preview</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {[tier1Label, tier2Label, tier3Label].filter(Boolean).map((l, i, arr) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ background: purple, color: '#fff', borderRadius: 6, padding: '3px 10px', fontWeight: 500, fontSize: 12 }}>{l}</span>
                      {i < arr.length - 1 && <span style={{ color: muted, fontSize: 12 }}>→</span>}
                    </span>
                  ))}
                  {[tier1Label, tier2Label, tier3Label].filter(Boolean).length > 0 && <span style={{ color: muted, fontSize: 12 }}>→</span>}
                  <span style={{ background: teal, color: '#fff', borderRadius: 6, padding: '3px 10px', fontWeight: 500, fontSize: 12 }}>Member</span>
                </div>
              </div>

              {structureType !== 'single' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Tier 1 name</div>
                      <input value={tier1Label} onChange={e => setTier1Label(e.target.value)} placeholder="e.g. Fellowship"
                        style={{ width: '100%', border: `0.5px solid ${border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: inputBg, color: text, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Tier 1 leader title</div>
                      <input value={tier1HeadLabel} onChange={e => setTier1HeadLabel(e.target.value)} placeholder="e.g. Fellowship Head"
                        style={{ width: '100%', border: `0.5px solid ${border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: inputBg, color: text, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  {tier2Label && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Tier 2 name</div>
                        <input value={tier2Label} onChange={e => setTier2Label(e.target.value)} placeholder="e.g. Cell"
                          style={{ width: '100%', border: `0.5px solid ${border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: inputBg, color: text, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Tier 2 leader title</div>
                        <input value={tier2HeadLabel} onChange={e => setTier2HeadLabel(e.target.value)} placeholder="e.g. Cell Leader"
                          style={{ width: '100%', border: `0.5px solid ${border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: inputBg, color: text, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  )}
                  {(structureType === 'zonal' || structureType === 'campus') && (
                    <div>
                      <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Tier 3 name</div>
                      <input value={tier3Label} onChange={e => setTier3Label(e.target.value)} placeholder="e.g. Cell"
                        style={{ width: '100%', border: `0.5px solid ${border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: inputBg, color: text, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setScreen(1)} style={{ flex: 1, background: inputBg, color: sub, border: `0.5px solid ${border}`, borderRadius: 12, padding: '13px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>← Back</button>
              <button onClick={() => setScreen(3)} style={{ flex: 2, background: purple, color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Next — Church Details →</button>
            </div>
          </div>
        )}

        {/* ── SCREEN 3: CHURCH DETAILS ── */}
        {screen === 3 && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: text }}>About your church</div>
              <div style={{ fontSize: 13, color: sub, marginTop: 6 }}>Helps SHEP.HERD format currency, dates, and service schedules for your context.</div>
            </div>

            <div style={{ background: '#fff', border: `0.5px solid ${border}`, borderRadius: 12, padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Church name *</div>
                <input value={churchName} onChange={e => setChurchName(e.target.value)} placeholder="e.g. The Comforters House Global"
                  style={{ width: '100%', border: `0.5px solid ${border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, background: inputBg, color: text, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Country</div>
                  <select value={country} onChange={e => {
                    const c = e.target.value;
                    setCountry(c);
                    if (c === 'Ghana') setCurrency('GHS');
                    else if (c === 'Kenya') setCurrency('KES');
                    else if (c === 'South Africa') setCurrency('ZAR');
                    else if (['United States', 'Canada'].includes(c)) setCurrency('USD');
                    else if (c === 'United Kingdom') setCurrency('GBP');
                    else setCurrency('NGN');
                  }}
                    style={{ width: '100%', border: `0.5px solid ${border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, background: inputBg, color: text, outline: 'none' }}>
                    {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Currency</div>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    style={{ width: '100%', border: `0.5px solid ${border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, background: inputBg, color: text, outline: 'none' }}>
                    {SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} — {c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Service days</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {SERVICE_DAY_OPTIONS.map(day => (
                    <button key={day} onClick={() => toggleDay(day)}
                      style={{ padding: '7px 14px', borderRadius: 20, border: `0.5px solid ${serviceDays.includes(day) ? purple : border}`, background: serviceDays.includes(day) ? purple : inputBg, color: serviceDays.includes(day) ? '#fff' : sub, fontSize: 12, fontWeight: serviceDays.includes(day) ? 600 : 400, cursor: 'pointer' }}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div style={{ background: '#FAECE7', color: '#993C1D', borderRadius: 10, padding: '11px 14px', fontSize: 12, marginTop: 14, fontWeight: 500 }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setScreen(2)} style={{ flex: 1, background: inputBg, color: sub, border: `0.5px solid ${border}`, borderRadius: 12, padding: '13px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>← Back</button>
              <button onClick={save} disabled={saving || !churchName.trim()}
                style={{ flex: 2, background: purple, color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving || !churchName.trim() ? 0.7 : 1 }}>
                {saving ? 'Setting up…' : 'Complete Setup →'}
              </button>
            </div>

            <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: muted }}>
              You can update all settings later in Dashboard → Settings
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
