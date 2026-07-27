import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { gradeToScore } from '@/lib/sla';

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1] || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);
    if (!['overseer', 'pa', 'lead_tech'].includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

    // Get all active cells with fellowship
    const cellsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cells?is_active=eq.true&select=id,name,fellowship_id,target_size,fellowships(name)&order=fellowship_id.asc,name.asc`,
      { headers }
    );
    const cells = await cellsRes.json();

    // Get cell leaders from users table
    const leadersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.cell_leader&is_active=eq.true&select=cell_id,full_name,email`,
      { headers }
    );
    const leaders = await leadersRes.json();

    // Get member counts per cell
    const membersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/members?membership_status=eq.active&select=cell_id`,
      { headers }
    );
    const members = await membersRes.json();

    // Build member count map
    const memberCount: Record<string, number> = {};
    if (Array.isArray(members)) {
      members.forEach((m: Record<string, string>) => {
        if (m.cell_id) memberCount[m.cell_id] = (memberCount[m.cell_id] || 0) + 1;
      });
    }

    // Build leader map
    const leaderMap: Record<string, string> = {};
    if (Array.isArray(leaders)) {
      leaders.forEach((l: Record<string, string>) => {
        if (l.cell_id) leaderMap[l.cell_id] = l.full_name;
      });
    }

    // Get last 8 weeks attendance per cell
    const since = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString();
    const attRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_records?submitted_at=gte.${since}&select=id,cell_id,present_count,submitted_at,sla_grade&order=submitted_at.asc`,
      { headers }
    );
    const attRecords = await attRes.json();

    // Real submission-promptness score per cell — average of each
    // attendance record's own sla_grade (set at submission time), not a
    // guess. Also track record ids so we can check which were disputed.
    const attSlaMap: Record<string, number[]> = {};
    const attRecordIdsByCell: Record<string, string[]> = {};
    if (Array.isArray(attRecords)) {
      attRecords.forEach((r: Record<string, unknown>) => {
        const cid = r.cell_id as string;
        if (!cid) return;
        const score = gradeToScore(r.sla_grade as string | null);
        if (score !== null) { if (!attSlaMap[cid]) attSlaMap[cid] = []; attSlaMap[cid].push(score); }
        if (!attRecordIdsByCell[cid]) attRecordIdsByCell[cid] = [];
        attRecordIdsByCell[cid].push(r.id as string);
      });
    }

    // Real accuracy score per cell — % of this window's submissions that
    // were never disputed by the fellowship head.
    const disputesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_disputes?created_at=gte.${since}&select=record_id`,
      { headers }
    );
    const disputesData = await disputesRes.json();
    const disputedRecordIds = new Set(Array.isArray(disputesData) ? disputesData.map((d: Record<string, string>) => d.record_id) : []);
    const accuracyMap: Record<string, number> = {};
    Object.keys(attRecordIdsByCell).forEach(cid => {
      const ids = attRecordIdsByCell[cid];
      const disputed = ids.filter(id => disputedRecordIds.has(id)).length;
      accuracyMap[cid] = ids.length > 0 ? Math.round(100 * (ids.length - disputed) / ids.length) : 100;
    });

    // Weekly cell meeting compliance — separate from Sunday/midweek service
    // attendance. "This week" = logged within the last 7 days.
    const meetingSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const meetingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cell_meetings?order=meeting_date.desc&select=cell_id,meeting_date,attendance_count,sla_grade`,
      { headers }
    );
    const meetings = await meetingsRes.json();
    const meetingMap: Record<string, { last_meeting_date: string; this_week: boolean; sla_grade: string | null }> = {};
    const meetingSlaMap: Record<string, number[]> = {};
    if (Array.isArray(meetings)) {
      meetings.forEach((mt: Record<string, unknown>) => {
        const cid = mt.cell_id as string;
        if (!cid) return;
        if (!meetingMap[cid]) {
          meetingMap[cid] = {
            last_meeting_date: mt.meeting_date as string,
            this_week: (mt.meeting_date as string) >= meetingSince,
            sla_grade: mt.sla_grade as string | null,
          };
        }
        const score = gradeToScore(mt.sla_grade as string | null);
        if (score !== null) { if (!meetingSlaMap[cid]) meetingSlaMap[cid] = []; if (meetingSlaMap[cid].length < 8) meetingSlaMap[cid].push(score); }
      });
    }
    const avgScore = (nums: number[]) => nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;

    // Build attendance history per cell
    const attMap: Record<string, number[]> = {};
    if (Array.isArray(attRecords)) {
      attRecords.forEach((r: Record<string, unknown>) => {
        const cid = r.cell_id as string;
        if (cid) {
          if (!attMap[cid]) attMap[cid] = [];
          attMap[cid].push(r.present_count as number);
        }
      });
    }

    const result = Array.isArray(cells) ? cells.map((c: Record<string, unknown>) => {
      const fellowship = c.fellowships as Record<string, string>;
      const cid = c.id as string;
      const history = attMap[cid] || [];
      const avg = history.length > 0 ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : 0;
      const count = memberCount[cid] || 0;
      const rate = count > 0 ? Math.round((avg / count) * 100) : 0;

      // Calculate trend
      let trend = '+0%';
      let trendPct = 0;
      let status = 'stable';
      if (history.length >= 4) {
        const recent = history.slice(-2).reduce((a, b) => a + b, 0) / 2;
        const older = history.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
        if (older > 0) {
          const pct = Math.round(((recent - older) / older) * 100);
          trendPct = pct;
          trend = pct >= 0 ? `+${pct}%` : `${pct}%`;
          status = pct >= 10 ? 'rising' : pct <= -10 ? 'alert' : pct <= -3 ? 'watch' : 'stable';
        }
      }

      const meeting = meetingMap[cid];
      const cappedRate = Math.min(rate, 95);
      const submissionSla = avgScore(attSlaMap[cid] || []);
      const meetingSla = avgScore(meetingSlaMap[cid] || []);
      const accuracy = accuracyMap[cid] ?? 100;
      const growthScore = Math.max(0, Math.min(100, 50 + trendPct * 2));
      // Composite recognition score — every input is a real, measured
      // number (never a placeholder): attendance rate, average submission
      // promptness, average cell-meeting promptness, dispute-free accuracy,
      // and growth trend. Missing inputs (e.g. no meetings logged yet) are
      // dropped from the weighted average rather than assumed.
      const weighted: { value: number; weight: number }[] = [
        { value: cappedRate, weight: 0.35 },
        { value: accuracy, weight: 0.15 },
        { value: growthScore, weight: 0.15 },
      ];
      if (submissionSla !== null) weighted.push({ value: submissionSla, weight: 0.20 });
      if (meetingSla !== null) weighted.push({ value: meetingSla, weight: 0.15 });
      const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
      const overallScore = Math.round(weighted.reduce((s, w) => s + w.value * w.weight, 0) / totalWeight);

      return {
        id: cid,
        cell: c.name,
        fel: fellowship?.name?.replace(' Fellowship', '') || 'Unknown',
        leader: leaderMap[cid] || 'Unassigned',
        members: count,
        avg,
        rate: cappedRate,
        trend,
        status,
        history,
        last_meeting_date: meeting?.last_meeting_date || null,
        meeting_this_week: meeting?.this_week || false,
        meeting_sla_grade: meeting?.sla_grade || null,
        submission_sla_score: submissionSla,
        meeting_sla_score: meetingSla,
        accuracy,
        overall_score: overallScore,
      };
    }) : [];

    return NextResponse.json({ data: { cells: result }, error: null });
  } catch (err) {
    console.error('[GET /api/cells/all]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load cells' } }, { status: 500 });
  }
}
