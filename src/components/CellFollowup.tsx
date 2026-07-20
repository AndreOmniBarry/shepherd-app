'use client';
import { useState, useEffect } from 'react';

type FollowupLog = {
  id: string;
  lead_id: string;
  action: string;
  outcome: string | null;
  created_at: string;
};

type Lead = {
  id: string;
  member_id: string;
  member_name: string;
  member_phone: string | null;
  weeks_absent: number;
  status: string;
  contact_attempts: number;
  last_contact: string | null;
  notes: string | null;
  created_at: string;
  cell_leader_logs: FollowupLog[];
};

const OUTCOMES = [
  'Reached — will attend next Sunday',
  'Reached — travelling, will return soon',
  'Reached — ill, needs prayer and visit',
  'Reached — family issue, follow-up needed',
  'Reached — relocating or transferred',
  'Could not reach — no answer',
  'Could not reach — number not going through',
  'Visited in person',
  'Other — see notes',
];

const STATUS_CFG: Record<string, { bg: string; text: string; label: string }> = {
  new:         { bg: '#EEEDFE', text: '#3C3489', label: 'New' },
  in_progress: { bg: '#FAEEDA', text: '#633806', label: 'In progress' },
  reached:     { bg: '#E1F5EE', text: '#085041', label: 'Reached' },
  visited:     { bg: '#E1F5EE', text: '#085041', label: 'Visited' },
};

interface CellFollowupProps {
  dark?: boolean;
  t?: Record<string, string>;
}

export default function CellFollowup({ dark = false, t: tProp }: CellFollowupProps) {
  const LIGHT = { bg:'#F0EFF8',card:'#FFFFFF',text:'#1A1040',sub:'#5A5180',muted:'#9890CC',border:'rgba(83,74,183,0.12)',input:'#F7F6FF',purple:'#534AB7',purpleBg:'#EEEDFE',teal:'#1D9E75',tealBg:'#E1F5EE',coral:'#D85A30',coralBg:'#FAECE7',amber:'#BA7517',amberBg:'#FAEEDA' };
  const DARK = { bg:'#0F0A2E',card:'#1A1340',text:'#E8E5FF',sub:'#B8B0E8',muted:'#7870B0',border:'rgba(255,255,255,0.08)',input:'#1F1850',purple:'#A89FFF',purpleBg:'rgba(168,159,255,0.12)',teal:'#2DD4AA',tealBg:'rgba(45,212,170,0.12)',coral:'#F87171',coralBg:'rgba(248,113,113,0.12)',amber:'#FCD34D',amberBg:'rgba(252,211,77,0.12)' };
  const t = tProp || (dark ? DARK : LIGHT);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLog, setActiveLog] = useState<string | null>(null);
  const [logForm, setLogForm] = useState({ action: '', outcome: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/cell/followup', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.leads) setLeads(data.leads); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [success]);

  async function logFollowup(leadId: string) {
    if (!logForm.action.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/cell/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lead_id: leadId, action: logForm.action, outcome: logForm.outcome }),
      });
      if (res.ok) {
        setSuccess(leadId);
        setLogForm({ action: '', outcome: '' });
        setActiveLog(null);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch {}
    setSubmitting(false);
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: t.muted, fontSize: 13 }}>Loading follow-up queue...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Member follow-up</div>
        <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6 }}>
          Members from your cell who have missed services and need follow-up. Log your actions here — the care team sees your updates and coordinates with you.
        </div>
      </div>

      {leads.length === 0 ? (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 13, color: t.sub }}>No open follow-ups for your cell</div>
          <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>All members are accounted for</div>
        </div>
      ) : (
        leads.map(lead => {
          const cfg = STATUS_CFG[lead.status] || STATUS_CFG.new;
          const daysAgo = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000);
          const isActive = activeLog === lead.id;
          const isSuccess = success === lead.id;

          return (
            <div key={lead.id} style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${lead.weeks_absent >= 3 ? 'rgba(198,40,40,0.3)' : t.border}`, padding: '16px 18px', borderLeft: `3px solid ${lead.weeks_absent >= 3 ? '#C62828' : lead.weeks_absent >= 2 ? '#D85A30' : '#BA7517'}` }}>

              {/* Member info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 3 }}>{lead.member_name}</div>
                  {lead.member_phone && (
                    <div style={{ fontSize: 11, color: t.muted }}>{lead.member_phone}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: cfg.bg, color: cfg.text, fontWeight: 500 }}>{cfg.label}</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: lead.weeks_absent >= 3 ? '#FCEBEB' : '#FAEEDA', color: lead.weeks_absent >= 3 ? '#A32D2D' : '#633806', fontWeight: 600 }}>
                    {lead.weeks_absent} {lead.weeks_absent === 1 ? 'week' : 'weeks'} absent
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: t.muted }}>
                <span>Flagged {daysAgo === 0 ? 'today' : `${daysAgo} days ago`}</span>
                <span>{lead.contact_attempts} contact attempt{lead.contact_attempts !== 1 ? 's' : ''}</span>
                {lead.last_contact && <span>Last contact: {new Date(lead.last_contact).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
              </div>

              {/* Previous cell leader logs */}
              {lead.cell_leader_logs.length > 0 && (
                <div style={{ background: t.input, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Your follow-up history</div>
                  {lead.cell_leader_logs.slice(0, 3).map((log, i) => (
                    <div key={log.id} style={{ fontSize: 12, color: t.sub, marginBottom: i < lead.cell_leader_logs.length - 1 ? 6 : 0, paddingBottom: i < lead.cell_leader_logs.length - 1 ? 6 : 0, borderBottom: i < lead.cell_leader_logs.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                      <span style={{ color: t.text, fontWeight: 500 }}>{log.action}</span>
                      {log.outcome && <span style={{ color: t.muted }}> — {log.outcome}</span>}
                      <span style={{ color: t.muted, fontSize: 10, display: 'block', marginTop: 2 }}>
                        {new Date(log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Success message */}
              {isSuccess && (
                <div style={{ background: t.tealBg, borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: t.teal, fontWeight: 500 }}>
                  Follow-up logged. Care team has been notified.
                </div>
              )}

              {/* Log form */}
              {isActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>What did you do? *</div>
                    <textarea
                      value={logForm.action}
                      onChange={e => setLogForm(p => ({ ...p, action: e.target.value }))}
                      placeholder="e.g. Called Sis Ivie, she is ill. Planning to visit her with Bro Jason this Thursday..."
                      rows={3}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Outcome</div>
                    <select value={logForm.outcome} onChange={e => setLogForm(p => ({ ...p, outcome: e.target.value }))}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                      <option value="">Select outcome (optional)</option>
                      {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => logFollowup(lead.id)} disabled={submitting || !logForm.action.trim()}
                      style={{ flex: 1, background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: submitting || !logForm.action.trim() ? 0.6 : 1 }}>
                      {submitting ? 'Logging...' : 'Log follow-up'}
                    </button>
                    <button onClick={() => { setActiveLog(null); setLogForm({ action: '', outcome: '' }); }}
                      style={{ background: t.input, color: t.sub, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 14px', fontSize: 12, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setActiveLog(lead.id)}
                  style={{ background: t.purpleBg, color: t.purple, border: `0.5px solid rgba(83,74,183,0.2)`, borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Log follow-up action
                </button>
              )}
            </div>
          );
        })
      )}

      {/* Info */}
      <div style={{ background: t.purpleBg, borderRadius: 10, padding: '11px 14px', border: `0.5px solid rgba(83,74,183,0.15)`, fontSize: 11, color: t.purple, lineHeight: 1.6 }}>
        Your follow-up logs are visible to the care team and fellowship head. Both you and the care team are responsible for following up — the lead stays open until one of you marks it resolved.
      </div>
    </div>
  );
}
