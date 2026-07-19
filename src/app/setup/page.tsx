'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STRUCTURE_PRESETS, SUPPORTED_CURRENCIES, ALL_COUNTRIES, type StructureType } from '@/lib/church-config';

const SERVICE_DAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const t = {
  bg: '#F0EFF8', card: '#FFFFFF', border: 'rgba(83,74,183,0.12)',
  text: '#1A1040', sub: '#5A5180', muted: '#9990CC',
  input: '#F7F6FF', purple: '#534AB7', purpleBg: '#EEEDFE',
  teal: '#1D9E75', tealBg: '#E1F5EE',
};

export default function SetupWizard() {
  const router = useRouter();
  const [screen, setScreen] = useState<1|2|3|4>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
  const [timezone, setTimezone] = useState('Africa/Lagos');
  const [serviceDays, setServiceDays] = useState<string[]>(['Sunday']);

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
          timezone,
          service_days: serviceDays,
          is_configured: true,
        }),
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const d = await res.json();
        setError(d?.error?.message || 'Failed to save');
      }
    } catch { setError('Network error. Please try again.'); }
    setSaving(false);
  }

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 16, ...extra,
  });

  const preset = STRUCTURE_PRESETS[structureType];

  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: t.purple, letterSpacing: '-0.5px', marginBottom: 4 }}>SHEP.HERD</div>
        <div style={{ fontSize: 13, color: t.muted }}>Church Setup — Step {screen} of 3</div>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 580, height: 4, background: t.border, borderRadius: 4, marginBottom: 32, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(screen / 3) * 100}%`, background: t.purple, borderRadius: 4, transition: 'width 0.3s ease' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 580 }}>

        {/* ── SCREEN 1: STRUCTURE ── */}
        {screen === 1 && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>How is your church structured?</div>
              <div style={{ fontSize: 13, color: t.sub }}>Pick the model that matches how your church is organised. You can customise the names on the next screen.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(Object.entries(STRUCTURE_PRESETS) as [StructureType, typeof STRUCTURE_PRESETS[StructureType]][]).map(([key, preset]) => (
                <button key={key} onClick={() => selectStructure(key)}
                  style={{ ...card({ padding: '16px 18px' }), display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer', border: `${structureType === key ? '1.5px' : '0.5px'} solid ${structureType === key ? t.purple : t.border}`, background: structureType === key ? t.purpleBg : t.card, textAlign: 'left', width: '100%', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 28, flexShrink: 0 }}>{preset.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{preset.label}</span>
                      {structureType === key && <span style={{ fontSize: 10, background: t.purple, color: '#fff', borderRadius: 10, padding: '1px 8px', fontWeight: 600 }}>Selected</span>}
                    </div>
                    <div style={{ fontSize: 12, color: t.sub, marginBottom: 6 }}>{preset.description}</div>
                    <div style={{ fontSize: 11, color: t.muted }}>Used by: {preset.usedBy}</div>
                    {preset.tier1_label && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' as const }}>
                        {[preset.tier1_label, preset.tier2_label, preset.tier3_label].filter(Boolean).map((tier, i) => (
                          <span key={i} style={{ fontSize: 10, background: t.purpleBg, color: t.purple, borderRadius: 6, padding: '2px 8px', fontWeight: 500 }}>{tier}</span>
                        ))}
                        <span style={{ fontSize: 10, background: '#E1F5EE', color: '#085041', borderRadius: 6, padding: '2px 8px', fontWeight: 500 }}>Member</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setScreen(2)}
              style={{ marginTop: 24, width: '100%', background: t.purple, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Next — Customise Labels →
            </button>
          </div>
        )}

        {/* ── SCREEN 2: CUSTOMISE LABELS ── */}
        {screen === 2 && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>What do you call each level?</div>
              <div style={{ fontSize: 13, color: t.sub }}>These labels appear everywhere in SHEP.HERD — portals, reports, notifications. Change them to match your church's language.</div>
            </div>
            <div style={{ ...card({ padding: '20px' }), display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Live preview */}
              <div style={{ background: t.purpleBg, borderRadius: 10, padding: '12px 16px', marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: t.purple, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 8 }}>Live preview</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                  {[tier1Label, tier2Label, tier3Label].filter(Boolean).map((l, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ background: t.purple, color: '#fff', borderRadius: 6, padding: '2px 10px', fontWeight: 500 }}>{l}</span>
                      <span style={{ color: t.muted }}>→</span>
                    </span>
                  ))}
                  <span style={{ background: '#1D9E75', color: '#fff', borderRadius: 6, padding: '2px 10px', fontWeight: 500, fontSize: 12 }}>Member</span>
                </div>
              </div>

              {tier1Label !== null && structureType !== 'single' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 6 }}>Tier 1 name</div>
                    <input value={tier1Label} onChange={e => setTier1Label(e.target.value)}
                      placeholder="e.g. Fellowship, Zone, Campus"
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 6 }}>Tier 1 leader title</div>
                    <input value={tier1HeadLabel} onChange={e => setTier1HeadLabel(e.target.value)}
                      placeholder="e.g. Fellowship Head, Zonal Pastor"
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none' }} />
                  </div>
                </div>
              )}

              {tier2Label && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 6 }}>Tier 2 name</div>
                    <input value={tier2Label} onChange={e => setTier2Label(e.target.value)}
                      placeholder="e.g. Cell, District, Home Group"
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 6 }}>Tier 2 leader title</div>
                    <input value={tier2HeadLabel} onChange={e => setTier2HeadLabel(e.target.value)}
                      placeholder="e.g. Cell Leader, District Pastor"
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none' }} />
                  </div>
                </div>
              )}

              {preset.tier3_label && (
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 6 }}>Tier 3 name (optional)</div>
                  <input value={tier3Label} onChange={e => setTier3Label(e.target.value)}
                    placeholder="e.g. Cell"
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none' }} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setScreen(1)}
                style={{ flex: 1, background: t.input, color: t.sub, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '13px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                ← Back
              </button>
              <button onClick={() => setScreen(3)}
                style={{ flex: 2, background: t.purple, color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Next — Church Details →
              </button>
            </div>
          </div>
        )}

        {/* ── SCREEN 3: CHURCH DETAILS ── */}
        {screen === 3 && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>About your church</div>
              <div style={{ fontSize: 13, color: t.sub }}>This helps SHEP.HERD format dates, currency, and service schedules correctly for your context.</div>
            </div>
            <div style={{ ...card({ padding: '20px' }), display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 6 }}>Church name *</div>
                <input value={churchName} onChange={e => setChurchName(e.target.value)}
                  placeholder="e.g. The Comforters House Global"
                  style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, background: t.input, color: t.text, outline: 'none' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 6 }}>Country</div>
                  <select value={country} onChange={e => {
                    setCountry(e.target.value);
                    if (e.target.value === 'Ghana') setCurrency('GHS');
                    else if (e.target.value === 'Kenya') setCurrency('KES');
                    else if (e.target.value === 'South Africa') setCurrency('ZAR');
                    else if (['United States', 'Canada'].includes(e.target.value)) setCurrency('USD');
                    else if (['United Kingdom'].includes(e.target.value)) setCurrency('GBP');
                    else setCurrency('NGN');
                  }}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, background: t.input, color: t.text, outline: 'none' }}>
                    {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 6 }}>Currency</div>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, background: t.input, color: t.text, outline: 'none' }}>
                    {SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} — {c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 8 }}>Service days</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                  {SERVICE_DAY_OPTIONS.map(day => (
                    <button key={day} onClick={() => toggleDay(day)}
                      style={{ padding: '6px 14px', borderRadius: 20, border: `0.5px solid ${serviceDays.includes(day) ? t.purple : t.border}`, background: serviceDays.includes(day) ? t.purple : t.input, color: serviceDays.includes(day) ? '#fff' : t.sub, fontSize: 12, fontWeight: serviceDays.includes(day) ? 600 : 400, cursor: 'pointer' }}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && <div style={{ background: '#FAECE7', color: '#993C1D', borderRadius: 10, padding: '11px 14px', fontSize: 12, marginTop: 14 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setScreen(2)}
                style={{ flex: 1, background: t.input, color: t.sub, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '13px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                ← Back
              </button>
              <button onClick={save} disabled={saving || !churchName.trim()}
                style={{ flex: 2, background: t.purple, color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving || !churchName.trim() ? 0.7 : 1 }}>
                {saving ? 'Setting up your church…' : 'Complete Setup →'}
              </button>
            </div>

            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: t.muted }}>
              You can change all of this later in Settings → Church Structure
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
