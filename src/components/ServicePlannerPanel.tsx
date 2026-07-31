'use client';
import { useState, useEffect } from 'react';
import Icon from '@/components/Icon';
import DateTimePicker from '@/components/DateTimePicker';

type PlanItem = { id?: string; item_type: string; title: string; description?: string; duration_minutes: number; assigned_to: string | null; assigned_to_name: string; color?: string };
type Plan = { id: string; service_date: string; service_type: string; title: string; theme: string | null; status: string; published_at: string | null };
type Leader = { id: string; full_name: string; role: string };

const ITEM_TYPES = ['item','song','prayer','sermon','announcement','offering','benediction','break'];

function nextSundayStr() {
  const d = new Date();
  const add = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().split('T')[0];
}

export default function ServicePlannerPanel({ t, branchId }: { t: Record<string, string>; branchId?: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newDate, setNewDate] = useState(nextSundayStr());
  const [newTitle, setNewTitle] = useState('Sunday Service');
  const [newTheme, setNewTheme] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showSpecial, setShowSpecial] = useState(false);
  const [specialDate, setSpecialDate] = useState('');
  const [specialLabel, setSpecialLabel] = useState('');
  const [specialSaving, setSpecialSaving] = useState(false);
  const [specialError, setSpecialError] = useState('');
  const [specialSuccess, setSpecialSuccess] = useState('');

  function loadPlans() {
    const bq = branchId ? `?branch_id=${branchId}` : '';
    fetch(`/api/service-planner${bq}`, { credentials: 'include' }).then(r => r.json()).then(({ data }) => setPlans(data?.plans || [])).finally(() => setLoading(false));
  }
  useEffect(() => {
    loadPlans();
    const bq = branchId ? `?branch_id=${branchId}` : '';
    fetch(`/api/members/leaders${bq}`, { credentials: 'include' }).then(r => r.json()).then(({ data }) => setLeaders(data?.leaders || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  function loadItems(planId: string) {
    fetch(`/api/service-planner/items?plan_id=${planId}`, { credentials: 'include' }).then(r => r.json()).then(({ data }) => setItems(data?.items || []));
  }

  function selectPlan(id: string) {
    setSelectedId(id);
    loadItems(id);
  }

  async function createPlan() {
    if (!newDate || !newTitle.trim()) { setError('Date and title are required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/service-planner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ service_date: newDate, service_type: 'sunday', title: newTitle.trim(), theme: newTheme.trim() || null, items: [] }),
      });
      const json = await res.json();
      if (res.ok && json.data?.plan) {
        setShowNew(false); setNewTheme('');
        loadPlans();
        selectPlan(json.data.plan.id);
      } else setError(json.error?.message || 'Failed to create plan');
    } catch { setError('Network error — plan was not created.'); }
    setSaving(false);
  }

  async function confirmDeletePlan() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/service-planner?id=${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        if (selectedId === deleteTarget.id) { setSelectedId(null); setItems([]); }
        loadPlans();
      }
    } finally { setDeleting(false); setDeleteTarget(null); }
  }

  function addItem() {
    setItems(prev => [...prev, { item_type: 'item', title: '', duration_minutes: 5, assigned_to: null, assigned_to_name: '' }]);
  }
  function updateItem(idx: number, patch: Partial<PlanItem>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }
  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function saveItems(publish: boolean) {
    if (!selectedId) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/service-planner', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: selectedId, items, status: publish ? 'published' : undefined }),
      });
      if (res.ok) {
        setSuccess(publish ? 'Published — assigned leaders notified.' : 'Order of service saved.');
        loadPlans(); loadItems(selectedId);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json?.error?.message || 'Failed to save.');
      }
    } catch { setError('Network error — changes were not saved.'); }
    setSaving(false);
  }

  const selectedPlan = plans.find(p => p.id === selectedId);

  async function createSpecialDay() {
    if (!specialDate || !specialLabel.trim()) { setSpecialError('Date and a label are required'); return; }
    setSpecialSaving(true); setSpecialError(''); setSpecialSuccess('');
    try {
      const res = await fetch('/api/services/recent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ service_date: specialDate, service_number: 1, service_type: 'special', notes: specialLabel.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setSpecialSuccess(`"${specialLabel.trim()}" created — cell leaders and department heads can now log attendance for it.`);
        setSpecialDate(''); setSpecialLabel('');
        setTimeout(() => setSpecialSuccess(''), 5000);
      } else setSpecialError(json.error?.message || 'Failed to create special service day');
    } catch { setSpecialError('Network error — special day was not created.'); }
    setSpecialSaving(false);
  }

  if (loading) return <div style={{ fontSize: 12, color: t.sub, padding: 20 }}>Loading service planner…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showSpecial ? 10 : 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Special Service Days</div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>For congress, convention, vigils, crusades — anything outside your regular recurring service days that still needs attendance taken.</div>
          </div>
          <button onClick={() => setShowSpecial(v => !v)} style={{ background: showSpecial ? t.purpleBg : t.purple, color: showSpecial ? t.purple : '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {showSpecial ? 'Cancel' : '+ Add special day'}
          </button>
        </div>
        {showSpecial && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 10 }}>
            <div style={{ width: 190 }}><DateTimePicker t={t} value={specialDate} onChange={setSpecialDate} placeholder="Select date" /></div>
            <input value={specialLabel} onChange={e => setSpecialLabel(e.target.value)} placeholder="e.g. Congress Day 1, New Year Vigil"
              style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', flex: 1, minWidth: 180 }} />
            <button onClick={createSpecialDay} disabled={specialSaving} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {specialSaving ? 'Creating…' : 'Create'}
            </button>
          </div>
        )}
        {specialError && <div style={{ background: t.coralBg, color: t.coral, borderRadius: 8, padding: '8px 12px', fontSize: 12, marginTop: 8 }}>{specialError}</div>}
        {specialSuccess && <div style={{ background: t.tealBg, color: t.teal, borderRadius: 8, padding: '8px 12px', fontSize: 12, marginTop: 8 }}>{specialSuccess}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14 }}>
      <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Service Plans</div>
          <button onClick={() => setShowNew(v => !v)} style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 7, padding: '4px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ New</button>
        </div>
        {showNew && (
          <div style={{ background: t.input, borderRadius: 8, padding: 10, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DateTimePicker t={t} value={newDate} onChange={setNewDate} placeholder="Service date" />
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title" style={{ border: `0.5px solid ${t.border}`, borderRadius: 7, padding: '6px 9px', fontSize: 11, background: t.card, color: t.text, outline: 'none' }} />
            <input value={newTheme} onChange={e => setNewTheme(e.target.value)} placeholder="Theme (optional)" style={{ border: `0.5px solid ${t.border}`, borderRadius: 7, padding: '6px 9px', fontSize: 11, background: t.card, color: t.text, outline: 'none' }} />
            {error && <div style={{ fontSize: 10, color: t.coral }}>{error}</div>}
            <button onClick={createPlan} disabled={saving} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Creating…' : 'Create'}</button>
          </div>
        )}
        {plans.length === 0 ? (
          <div style={{ fontSize: 11, color: t.muted }}>No service plans yet.</div>
        ) : plans.map(p => (
          <div key={p.id} onClick={() => selectPlan(p.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, background: selectedId === p.id ? t.purpleBg : 'transparent' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{p.title}</div>
              <div style={{ fontSize: 10, color: t.muted, marginTop: 1 }}>{p.service_date} · <span style={{ color: p.status === 'published' ? t.teal : t.amber, fontWeight: 600 }}>{p.status}</span></div>
            </div>
            <button onClick={e => { e.stopPropagation(); setDeleteTarget(p); }} title="Delete this service plan"
              style={{ background: 'transparent', border: 'none', color: t.coral, cursor: 'pointer', flexShrink: 0, padding: 4 }}>
              <Icon name="ti-trash" size={14} />
            </button>
          </div>
        ))}
      </div>

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => !deleting && setDeleteTarget(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: 14, border: `0.5px solid ${t.border}`, padding: 22, maxWidth: 380, width: '90%' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 8 }}>Delete &quot;{deleteTarget.title}&quot;?</div>
            <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.5, marginBottom: 18 }}>This removes the plan and its full order of service. This cannot be undone.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                style={{ background: t.input, color: t.text, border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={confirmDeletePlan} disabled={deleting}
                style={{ background: t.coral, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: deleting ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
        {!selectedPlan ? (
          <div style={{ fontSize: 12, color: t.muted, textAlign: 'center', padding: '40px 0' }}>Select a service plan, or create a new one, to build the order of service.</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{selectedPlan.title}</div>
                <div style={{ fontSize: 11, color: t.muted }}>{selectedPlan.service_date}{selectedPlan.theme ? ` · ${selectedPlan.theme}` : ''}</div>
              </div>
              <button onClick={addItem} style={{ background: 'transparent', border: `0.5px solid ${t.border}`, color: t.text, borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ Add item</button>
            </div>

            {items.length === 0 ? (
              <div style={{ fontSize: 12, color: t.muted, textAlign: 'center', padding: '20px 0' }}>No items yet — add the first one.</div>
            ) : items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 140px 84px auto', gap: 8, alignItems: 'center', padding: '7px 0', borderBottom: `0.5px solid ${t.border}` }}>
                <select value={it.item_type} onChange={e => updateItem(i, { item_type: e.target.value })}
                  style={{ border: `0.5px solid ${t.border}`, borderRadius: 6, padding: '5px 7px', fontSize: 11, background: t.input, color: t.text, outline: 'none' }}>
                  {ITEM_TYPES.map(ty => (<option key={ty} value={ty}>{ty}</option>))}
                </select>
                <input value={it.title} onChange={e => updateItem(i, { title: e.target.value })} placeholder="Item title"
                  style={{ border: `0.5px solid ${t.border}`, borderRadius: 6, padding: '5px 7px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
                <select value={it.assigned_to || ''} onChange={e => { const l = leaders.find(x => x.id === e.target.value); updateItem(i, { assigned_to: e.target.value || null, assigned_to_name: l?.full_name || it.assigned_to_name }); }}
                  style={{ border: `0.5px solid ${t.border}`, borderRadius: 6, padding: '5px 7px', fontSize: 11, background: t.input, color: t.text, outline: 'none' }}>
                  <option value="">Unassigned</option>
                  {leaders.map(l => (<option key={l.id} value={l.id}>{l.full_name}</option>))}
                </select>
                <div style={{ position: 'relative' }}>
                  <input type="number" min={0} value={it.duration_minutes} onChange={e => updateItem(i, { duration_minutes: Number(e.target.value) })}
                    style={{ width: '100%', boxSizing: 'border-box', border: `0.5px solid ${t.border}`, borderRadius: 6, padding: '5px 30px 5px 7px', fontSize: 11, background: t.input, color: t.text, outline: 'none' }} />
                  <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: t.muted, pointerEvents: 'none' }}>min</span>
                </div>
                <button onClick={() => removeItem(i)} style={{ background: 'transparent', border: 'none', color: t.coral, cursor: 'pointer' }}><Icon name="ti-x" size={14} /></button>
              </div>
            ))}

            {error && <div style={{ background: t.coralBg, color: t.coral, borderRadius: 8, padding: '8px 12px', fontSize: 12, marginTop: 12 }}>{error}</div>}
            {success && <div style={{ background: t.tealBg, color: t.teal, borderRadius: 8, padding: '8px 12px', fontSize: 12, marginTop: 12 }}>{success}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => saveItems(false)} disabled={saving} style={{ background: 'transparent', border: `0.5px solid ${t.border}`, color: t.text, borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save draft</button>
              <button onClick={() => saveItems(true)} disabled={saving || items.length === 0} style={{ background: t.teal, border: 'none', color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: items.length === 0 ? 0.5 : 1 }}>
                {saving ? 'Saving…' : 'Publish & notify'}
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
