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

    const cell_id = user.cell_id;
    // Return top-level null (not { overview: null }) — the success path below returns
    // { cell, stats, ... } flat, and CellOverview.tsx does `setOverview(data)` directly,
    // so a nested overview key here would leave `overview` a truthy-but-empty object.
    if (!cell_id) return NextResponse.json({ data: null, error: null });

    // ── 1. Cell info ─────────────────────────────────────────
    const cellRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cells?id=eq.${cell_id}&select=id,name,member_count,fellowship_id,fellowships(name)&limit=1`,
      { headers: hdrs() }
    );
    const cellData = await cellRes.json();
    const cell = cellData?.[0];

    // ── 2. All active members in this cell ───────────────────
    const membersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/members?cell_id=eq.${cell_id}&membership_status=eq.active&select=id,full_name,date_of_birth&order=full_name.asc`,
      { headers: hdrs() }
    );
    const members = await membersRes.json();

    // ── 3. Last 12 weeks of attendance records ───────────────
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 84);
    const attRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_records?cell_id=eq.${cell_id}&submitted_at=gte.${cutoff.toISOString()}&order=submitted_at.desc&limit=12&select=id,present_count,absent_count,visitor_count,submitted_at,sla_grade,services(service_date)`,
      { headers: hdrs() }
    );
    const records = await attRes.json();

    // ── 4. Individual attendance entries ─────────────────────
    const recordIds = Array.isArray(records) ? records.map((r: Record<string, string>) => r.id) : [];
    let memberAttendance: Record<string, { present: number; absent: number; lastSeen?: string; lastAbsent?: string; consecutiveAbsences: number }> = {};

    if (recordIds.length > 0) {
      const entriesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/attendance_entries?record_id=in.(${recordIds.join(',')})&select=member_id,status,record_id,attendance_records(submitted_at)&order=attendance_records(submitted_at).desc`,
        { headers: hdrs() }
      );
      const entries = await entriesRes.json();

      if (Array.isArray(entries)) {
        // Build per-member stats
        entries.forEach((e: Record<string, unknown>) => {
          const mid = e.member_id as string;
          if (!mid) return;
          if (!memberAttendance[mid]) memberAttendance[mid] = { present: 0, absent: 0, consecutiveAbsences: 0 };
          if (e.status === 'present') {
            memberAttendance[mid].present++;
            if (!memberAttendance[mid].lastSeen) memberAttendance[mid].lastSeen = (e.attendance_records as Record<string, string>)?.submitted_at;
          } else {
            memberAttendance[mid].absent++;
            if (!memberAttendance[mid].lastAbsent) memberAttendance[mid].lastAbsent = (e.attendance_records as Record<string, string>)?.submitted_at;
          }
        });

        // Calculate consecutive absences (from most recent records)
        if (Array.isArray(members)) {
          members.forEach((member: Record<string, string>) => {
            const mid = member.id;
            let consecutive = 0;
            // Check last 4 records in order
            for (const record of records.slice(0, 4)) {
              const entry = entries.find((e: Record<string, string>) => e.member_id === mid && e.record_id === record.id);
              if (entry && entry.status === 'absent') consecutive++;
              else break;
            }
            if (memberAttendance[mid]) memberAttendance[mid].consecutiveAbsences = consecutive;
          });
        }
      }
    }

    // ── 5. Build member health profiles ──────────────────────
    const memberProfiles = Array.isArray(members) ? members.map((m: Record<string, string>) => {
      const att = memberAttendance[m.id] || { present: 0, absent: 0, consecutiveAbsences: 0 };
      const total = att.present + att.absent;
      const rate = total > 0 ? Math.round((att.present / total) * 100) : null;
      const health = att.consecutiveAbsences >= 3 ? 'critical'
        : att.consecutiveAbsences >= 2 ? 'warning'
        : att.consecutiveAbsences >= 1 ? 'watch'
        : rate !== null && rate >= 80 ? 'healthy'
        : rate !== null && rate >= 60 ? 'fair'
        : rate !== null ? 'low'
        : 'new';

      // Birthday check
      let birthdayStatus = null;
      if (m.date_of_birth) {
        const today = new Date();
        const bday = new Date(m.date_of_birth);
        const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        const daysUntil = Math.ceil((thisYearBday.getTime() - today.getTime()) / 86400000);
        if (daysUntil === 0) birthdayStatus = 'today';
        else if (daysUntil > 0 && daysUntil <= 7) birthdayStatus = `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;
        else if (daysUntil < 0 && daysUntil >= -3) birthdayStatus = 'recently';
      }

      return {
        id: m.id,
        full_name: m.full_name,
        present: att.present,
        absent: att.absent,
        total,
        rate,
        consecutiveAbsences: att.consecutiveAbsences,
        lastSeen: att.lastSeen,
        health,
        birthdayStatus,
      };
    }) : [];

    // ── 6. Attendance trend ───────────────────────────────────
    const trend = Array.isArray(records) ? records.slice(0, 8).reverse().map((r: Record<string, unknown>, i: number) => ({
      week: `W${i + 1}`,
      present: r.present_count,
      absent: r.absent_count,
      rate: Math.round(((r.present_count as number) / Math.max(1, (r.present_count as number) + (r.absent_count as number))) * 100),
      sla: r.sla_grade,
      date: (r.services as Record<string, string>)?.service_date,
    })) : [];

    // ── 7. Cell summary stats ─────────────────────────────────
    const avgRate = trend.length > 0 ? Math.round(trend.reduce((a, t) => a + t.rate, 0) / trend.length) : null;
    const bestSunday = trend.reduce((best, t) => t.rate > (best?.rate || 0) ? t : best, trend[0] || null);
    const worstSunday = trend.reduce((worst, t) => t.rate < (worst?.rate || 100) ? t : worst, trend[0] || null);
    const lastRecord = Array.isArray(records) && records[0] ? records[0] : null;
    const currentSLA = lastRecord?.sla_grade || null;

    // ── 8. Action items ───────────────────────────────────────
    const actions: { priority: 'high' | 'medium' | 'low'; message: string }[] = [];

    const criticalMembers = memberProfiles.filter(m => m.health === 'critical');
    const warningMembers = memberProfiles.filter(m => m.health === 'warning');
    const watchMembers = memberProfiles.filter(m => m.health === 'watch');
    const birthdayToday = memberProfiles.filter(m => m.birthdayStatus === 'today');
    const upcomingBirthdays = memberProfiles.filter(m => m.birthdayStatus && m.birthdayStatus !== 'today' && m.birthdayStatus !== 'recently');

    if (criticalMembers.length > 0) {
      actions.push({ priority: 'high', message: `${criticalMembers.length} member${criticalMembers.length > 1 ? 's have' : ' has'} missed 3+ consecutive Sundays — contact the care team immediately: ${criticalMembers.slice(0, 2).map(m => m.full_name.split(' ')[0]).join(', ')}${criticalMembers.length > 2 ? ` +${criticalMembers.length - 2} more` : ''}` });
    }
    if (warningMembers.length > 0) {
      actions.push({ priority: 'medium', message: `${warningMembers.length} member${warningMembers.length > 1 ? 's have' : ' has'} missed 2 consecutive Sundays — reach out this week` });
    }
    if (birthdayToday.length > 0) {
      actions.push({ priority: 'high', message: `🎂 Birthday today: ${birthdayToday.map(m => m.full_name.split(' ')[0]).join(', ')} — celebrate them!` });
    }
    if (upcomingBirthdays.length > 0) {
      actions.push({ priority: 'low', message: `Upcoming birthday${upcomingBirthdays.length > 1 ? 's' : ''}: ${upcomingBirthdays.slice(0, 2).map(m => `${m.full_name.split(' ')[0]} (${m.birthdayStatus})`).join(', ')}` });
    }

    // Check submission window
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0) actions.push({ priority: 'high', message: 'Submit your attendance today for an A+ SLA grade — window closes at midnight' });
    else if (dayOfWeek === 1 && now.getHours() < 6) actions.push({ priority: 'high', message: 'Submit now for an A SLA grade — window closes at 6am' });
    else if (dayOfWeek === 1) actions.push({ priority: 'medium', message: 'Submit today for a B SLA grade — submitting Tuesday drops you to C' });

    // ── 9. SLA history ────────────────────────────────────────
    const slaHistory = Array.isArray(records) ? records.slice(0, 8).map((r: Record<string, unknown>) => ({
      date: (r.services as Record<string, string>)?.service_date,
      grade: r.sla_grade as string,
    })) : [];

    return NextResponse.json({
      data: {
        cell: {
          id: cell?.id,
          name: cell?.name,
          fellowship: (cell?.fellowships as Record<string, string>)?.name,
          totalMembers: members.length,
        },
        stats: {
          avgRate,
          currentSLA,
          bestSunday,
          worstSunday,
          totalSubmissions: records.length,
          criticalCount: criticalMembers.length,
          warningCount: warningMembers.length,
        },
        trend,
        memberProfiles,
        slaHistory,
        actions,
        birthdayToday,
        upcomingBirthdays,
      },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/cell/overview]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load overview' } }, { status: 500 });
  }
}
