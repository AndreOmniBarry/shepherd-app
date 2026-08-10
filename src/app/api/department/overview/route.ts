import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { computeHealth, computeBirthdayStatus, buildTrend, buildSlaHistory, computeAvgRate } from '@/lib/structure-overview';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);

    // Get department_id from users table
    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: hdrs() });
    const userData = await userRes.json();
    const department_id = userData?.[0]?.department_id;
    if (!department_id) return NextResponse.json({ data: { overview: null }, error: null });

    // Get department info
    const deptRes = await fetch(`${SUPABASE_URL}/rest/v1/departments?id=eq.${department_id}&select=id,name&limit=1`, { headers: hdrs() });
    const deptData = await deptRes.json();
    const dept = deptData?.[0];

    // Get department members
    const deptMembersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/department_members?department_id=eq.${department_id}&select=member_id,role,members(id,full_name,phone,date_of_birth)`,
      { headers: hdrs() }
    );
    const deptMembers = await deptMembersRes.json();
    const members = Array.isArray(deptMembers) ? deptMembers.map((d: Record<string, unknown>) => ({
      id: (d.members as Record<string, string>)?.id,
      full_name: (d.members as Record<string, string>)?.full_name,
      phone: (d.members as Record<string, string>)?.phone,
      date_of_birth: (d.members as Record<string, string>)?.date_of_birth,
      role: d.role as string,
    })).filter(m => m.id) : [];

    // Get last 12 weeks attendance records for this department
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 84);
    const attRes = await fetch(
      `${SUPABASE_URL}/rest/v1/department_attendance?department_id=eq.${department_id}&submitted_at=gte.${cutoff.toISOString()}&order=submitted_at.desc&limit=12&select=id,present_count,absent_count,submitted_at,sla_grade,services(service_date)`,
      { headers: hdrs() }
    );
    const records = await attRes.json();

    // Get individual attendance entries
    const recordIds = Array.isArray(records) ? records.map((r: Record<string, string>) => r.id) : [];
    let memberAttendance: Record<string, { present: number; absent: number; consecutiveAbsences: number; lastSeen?: string }> = {};

    if (recordIds.length > 0) {
      const entriesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/department_attendance_entries?record_id=in.(${recordIds.join(',')})&select=member_id,status,record_id`,
        { headers: hdrs() }
      );
      const entries = await entriesRes.json();
      if (Array.isArray(entries)) {
        entries.forEach((e: Record<string, string>) => {
          const mid = e.member_id;
          if (!mid) return;
          if (!memberAttendance[mid]) memberAttendance[mid] = { present: 0, absent: 0, consecutiveAbsences: 0 };
          if (e.status === 'present') {
            memberAttendance[mid].present++;
          } else {
            memberAttendance[mid].absent++;
          }
        });

        // Consecutive absences
        members.forEach(member => {
          let consecutive = 0;
          for (const record of records.slice(0, 4)) {
            const entry = entries.find((e: Record<string, string>) => e.member_id === member.id && e.record_id === record.id);
            if (entry && entry.status === 'absent') consecutive++;
            else break;
          }
          if (memberAttendance[member.id]) memberAttendance[member.id].consecutiveAbsences = consecutive;
        });
      }
    }

    // Build member health profiles
    const memberProfiles = members.map(m => {
      const att = memberAttendance[m.id] || { present: 0, absent: 0, consecutiveAbsences: 0 };
      const total = att.present + att.absent;
      const rate = total > 0 ? Math.round((att.present / total) * 100) : null;
      const health = computeHealth(att.consecutiveAbsences, rate);
      // Department's endpoint doesn't report the "recently" (within the
      // last 3 days) birthday status that cell's does — includeRecently
      // stays false here to match.
      const birthdayStatus = computeBirthdayStatus(m.date_of_birth);

      return { ...m, present: att.present, absent: att.absent, total, rate, consecutiveAbsences: att.consecutiveAbsences, health, birthdayStatus };
    });

    // Trend
    const trend = buildTrend(Array.isArray(records) ? records : []);

    const avgRate = computeAvgRate(trend);
    const lastRecord = Array.isArray(records) && records[0] ? records[0] : null;
    const criticalCount = memberProfiles.filter(m => ['critical', 'warning'].includes(m.health)).length;

    // Action items
    const actions: { priority: 'high' | 'medium' | 'low'; message: string }[] = [];
    const criticalMembers = memberProfiles.filter(m => m.health === 'critical');
    const birthdayToday = memberProfiles.filter(m => m.birthdayStatus === 'today');

    if (criticalMembers.length > 0) {
      actions.push({ priority: 'high', message: `${criticalMembers.length} department member${criticalMembers.length > 1 ? 's have' : ' has'} missed 3+ consecutive Sundays: ${criticalMembers.slice(0, 2).map(m => m.full_name.split(' ')[0]).join(', ')}` });
    }
    if (birthdayToday.length > 0) {
      actions.push({ priority: 'high', message: `Birthday today: ${birthdayToday.map(m => m.full_name.split(' ')[0]).join(', ')}` });
    }

    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0) actions.push({ priority: 'high', message: 'Submit department attendance today for A+ SLA grade' });
    else if (dayOfWeek === 1) actions.push({ priority: 'medium', message: 'Submit today for B SLA — no submission beyond Monday is acceptable without a stated reason' });

    // SLA history
    const slaHistory = buildSlaHistory(Array.isArray(records) ? records : []);

    return NextResponse.json({
      data: {
        dept: { id: dept?.id, name: dept?.name, totalMembers: members.length },
        stats: { avgRate, currentSLA: lastRecord?.sla_grade || null, totalSubmissions: records.length, criticalCount },
        trend,
        memberProfiles,
        slaHistory,
        actions,
        birthdayToday,
      },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/department/overview]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load overview' } }, { status: 500 });
  }
}
