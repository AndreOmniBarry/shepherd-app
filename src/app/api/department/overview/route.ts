export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

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
      const health = att.consecutiveAbsences >= 3 ? 'critical'
        : att.consecutiveAbsences >= 2 ? 'warning'
        : att.consecutiveAbsences >= 1 ? 'watch'
        : rate !== null && rate >= 80 ? 'healthy'
        : rate !== null && rate >= 60 ? 'fair'
        : rate !== null ? 'low' : 'new';

      // Birthday check
      let birthdayStatus = null;
      if (m.date_of_birth) {
        const today = new Date();
        const bday = new Date(m.date_of_birth);
        const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        const daysUntil = Math.ceil((thisYearBday.getTime() - today.getTime()) / 86400000);
        if (daysUntil === 0) birthdayStatus = 'today';
        else if (daysUntil > 0 && daysUntil <= 7) birthdayStatus = `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;
      }

      return { ...m, present: att.present, absent: att.absent, total, rate, consecutiveAbsences: att.consecutiveAbsences, health, birthdayStatus };
    });

    // Trend
    const trend = Array.isArray(records) ? records.slice(0, 8).reverse().map((r: Record<string, unknown>, i: number) => ({
      week: `W${i + 1}`,
      present: r.present_count,
      absent: r.absent_count,
      rate: Math.round(((r.present_count as number) / Math.max(1, (r.present_count as number) + (r.absent_count as number))) * 100),
      sla: r.sla_grade,
      date: (r.services as Record<string, string>)?.service_date,
    })) : [];

    const avgRate = trend.length > 0 ? Math.round(trend.reduce((a, t) => a + t.rate, 0) / trend.length) : null;
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
      actions.push({ priority: 'high', message: `🎂 Birthday today: ${birthdayToday.map(m => m.full_name.split(' ')[0]).join(', ')}` });
    }

    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0) actions.push({ priority: 'high', message: 'Submit department attendance today for A+ SLA grade' });
    else if (dayOfWeek === 1) actions.push({ priority: 'medium', message: 'Submit today for B SLA — no submission beyond Monday is acceptable without a stated reason' });

    // SLA history
    const slaHistory = Array.isArray(records) ? records.slice(0, 8).map((r: Record<string, unknown>) => ({
      date: (r.services as Record<string, string>)?.service_date,
      grade: r.sla_grade as string,
    })) : [];

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
