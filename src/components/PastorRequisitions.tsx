'use client';
import { useState, useEffect } from 'react';

type Requisition = {
  id: string; title: string; category_name: string;
  amount_requested: number; amount_approved: number | null;
  requested_by_name: string; status: string; created_at: string; notes: string | null;
};

const STATUS_CFG: Record<string, { bg: string; text: string; label: string }> = {
  pending:  { bg: '#FAEEDA', text: '#633806', label: 'Pending' },
  approved: { bg: '#E1F5EE', text: '#085041', label: 'Approved' },
  rejected: { bg: '#FAECE7', text: '#993C1D', label: 'Rejected' },
  paid:     { bg: '#EEEDFE', text: '#3C3489', label: 'Paid' },
};

interface PastorRequisitionsProps { t?: Record<string, string>; dark: boolean; }

export default function PastorRequisitions({ t: tProp, dark }: PastorRequisitionsProps) {
  const LIGHT = { bg:'#F0EFF8',card:'#FFFFFF',text:'#1A1040',sub:'#5A5180',muted:'#9890CC',border:'rgba(83,74,183,0.12)',input:'#F7F6FF',purple:'#534AB7',purpleBg:'#EEEDFE',teal:'#1D9E75',tealBg:'#E1F5EE',coral:'#D85A30',coralBg:'#FAECE7',amber:'#BA7517',amberBg:'#FAEEDA' };
  const DARK = { bg:'#0F0A2E',card:'#1A1340',text:'#E8E5FF',sub:'#B8B0E8',muted:'#7870B0',border:'rgba(255,255,255,0.08)',input:'#1F1850',purple:'#A89FFF',purpleBg:'rgba(168,159,255,0.12)',teal:'#2DD4AA',tealBg:'rgba(45,212,170,0.12)',coral:'#F87171',coralBg:'rgba(248,113,113,0.12)',amber:'#FCD34D',amberBg:'rgba(252,211,77,0.12)' };
  const t = tProp || (dark ? DARK : LIGHT);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    fetch('/api/accounts/requisitions', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.requisitions) setRequisitions(data.requisitions); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/accounts/requisitions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ status }),
    });
    setRequisitions(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  const filtered = filter === 'pending' ? requisitions.filter(r => r.status === 'approved') : requisitions;
  const pendingApproval = requisitions.filter(r => r.status === 'approved').length;

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: t.muted, fontSize: 13 }}>Loading requisitions...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Expense requisitions</div>
        <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6 }}>
          Expense requests endorsed by the accounts admin and awaiting your approval. Approved requests are disbursed by the accounts team.
        </div>
      </div>

      {pendingApproval > 0 && (
        <div style={{ background: '#FAEEDA', borderRadius: 10, padding: '10px 14px', border: '0.5px solid rgba(186,117,23,0.2)', fontSize: 12, color: '#633806', fontWeight: 500 }}>
          {pendingApproval} request{pendingApproval > 1 ? 's' : ''} awaiting your approval
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {[{ id: 'pending', label: `Awaiting approval (${pendingApproval})` }, { id: 'all', label: `All (${requisitions.length})` }].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id as typeof filter)}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: filter === f.id ? '#534AB7' : t.input, color: filter === f.id ? '#fff' : t.sub, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: filter === f.id ? 600 : 400 }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: t.sub }}>No {filter === 'pending' ? 'pending ' : ''}requisitions.</div>
        </div>
      ) : (
        filtered.map(r => {
          const cfg = STATUS_CFG[r.status] || STATUS_CFG.pending;
          return (
            <div key={r.id} style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px', borderLeft: `3px solid ${r.status === 'approved' ? '#BA7517' : r.status === 'paid' ? '#534AB7' : r.status === 'rejected' ? '#D85A30' : '#1D9E75'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2 }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: t.muted }}>{r.category_name} · {r.requested_by_name} · {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                </div>
                <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: cfg.bg, color: cfg.text, fontWeight: 500, flexShrink: 0 }}>{cfg.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>₦{r.amount_requested.toLocaleString()}</div>
                {r.status === 'approved' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => updateStatus(r.id, 'paid')}
                      style={{ background: '#E1F5EE', color: '#085041', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                      Approve & disburse
                    </button>
                    <button onClick={() => updateStatus(r.id, 'rejected')}
                      style={{ background: '#FAECE7', color: '#993C1D', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
