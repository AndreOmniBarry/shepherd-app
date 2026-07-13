import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

// GET — fetch open care leads for members in this cell leader's cell
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const cell_id = user.cell_id;
    if (!cell_id) return NextResponse.json({ data: { leads: [] }, error: null });

    // Get members in this cell
    const membersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/members?cell_id=eq.${cell_id}&membership_status=eq.active&select=id,full_name,phone`,
      { headers: hdrs() }
    );
    const members = await membersRes.json();
    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ data: { leads: [] }, error: null });
    }

    const memberIds = members.map((m: Record<string, string>) => m.id);

    // Get open care leads for these members
    const leadsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/care_leads?member_id=in.(${memberIds.join(',')})&status=in.(new,in_progress,reached,visited)&order=created_at.desc&select=id,member_id,weeks_absent,status,contact_attempts,last_contact,notes,created_at`,
      { headers: hdrs() }
    );
    const leads = await leadsRes.json();

    // Get cell leader follow-up logs for these leads
    const leadIds = Array.isArray(leads) ? leads.map((l: Record<string, string>) => l.id) : [];
    let followupLogs: Record<string, unknown>[] = [];
    if (leadIds.length > 0) {
      const logsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/cell_leader_followups?lead_id=in.(${leadIds.join(',')})&order=created_at.desc&select=id,lead_id,action,outcome,created_at`,
        { headers: hdrs() }
      );
      const logsData = await logsRes.json();
      followupLogs = Array.isArray(logsData) ? logsData : [];
    }

    // Merge member info into leads
    const enriched = Array.isArray(leads) ? leads.map((lead: Record<string, unknown>) => {
      const member = members.find((m: Record<string, string>) => m.id === lead.member_id);
      const logs = followupLogs.filter(l => l.lead_id === lead.id);
      return {
        ...lead,
        member_name: member?.full_name || 'Unknown',
        member_phone: member?.phone || null,
        cell_leader_logs: logs,
      };
    }) : [];

    return NextResponse.json({ data: { leads: enriched }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load follow-ups' } }, { status: 500 });
  }
}

// POST — cell leader logs a follow-up action
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const body = await req.json();
    const { lead_id, action, outcome } = body;

    if (!lead_id || !action) {
      return NextResponse.json({ data: null, error: { message: 'lead_id and action are required' } }, { status: 400 });
    }

    // Log the follow-up
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cell_leader_followups`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        lead_id,
        cell_leader_id: user.id,
        action: action.trim(),
        outcome: outcome || null,
        created_at: new Date().toISOString(),
      }),
    });
    const data = await res.json();

    // Update the care lead contact attempts and last contact
    await fetch(`${SUPABASE_URL}/rest/v1/care_leads?id=eq.${lead_id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        contact_attempts: 1,
        last_contact: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    // Notify care team that cell leader has logged a follow-up
    const careRes = await fetch(
      `${SUPABASE_URL}/rest/v1/care_leads?id=eq.${lead_id}&select=assigned_to&limit=1`,
      { headers: hdrs() }
    );
    const careData = await careRes.json();
    const assignedTo = careData?.[0]?.assigned_to;

    if (assignedTo) {
      await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify([{
          user_id: assignedTo,
          type: 'pipeline',
          title: 'Cell leader logged a follow-up',
          body: `Action logged: ${action.slice(0, 100)}${action.length > 100 ? '...' : ''}`,
          read: false,
        }]),
      });
    }

    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to log follow-up' } }, { status: 500 });
  }
}
