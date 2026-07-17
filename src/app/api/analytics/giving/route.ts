import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const p = await verifyToken(token);
  return p ? payloadToAuthUser(p) : null;
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer','pa','lead_tech','accounts'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const yearStart = `${now.getFullYear()}-01-01`;
    const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); 
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const prevYearStart = `${now.getFullYear()-1}-01-01`;
    const prevYearEnd = `${now.getFullYear()-1}-12-31`;

    // Fetch all income records for this year + last year in parallel
    const [thisYearRes, lastYearRes, typesRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/income_records?created_at=gte.${yearStart}T00:00:00&order=service_date.desc&limit=2000&select=id,amount,service_date,income_type_id,member_name,notes,created_at,income_types(name,category)`, { headers: h() }),
      fetch(`${SUPABASE_URL}/rest/v1/income_records?created_at=gte.${prevYearStart}T00:00:00&created_at=lte.${prevYearEnd}T23:59:59&select=amount,service_date,income_type_id,income_types(name,category)`, { headers: h() }),
      fetch(`${SUPABASE_URL}/rest/v1/income_types?is_active=eq.true&order=name.asc&select=id,name,category`, { headers: h() }),
    ]);

    const [thisYear, lastYear, types] = await Promise.all([thisYearRes.json(), lastYearRes.json(), typesRes.json()]);

    const records = Array.isArray(thisYear) ? thisYear : [];
    const lastYearRecords = Array.isArray(lastYear) ? lastYear : [];
    const incomeTypes = Array.isArray(types) ? types : [];

    // ── KPI calculations ──────────────────────────────────────
    const ytdTotal = records.reduce((s: number, r: Record<string,number>) => s + Number(r.amount||0), 0);
    const lastYearTotal = lastYearRecords.reduce((s: number, r: Record<string,number>) => s + Number(r.amount||0), 0);
    const mtdTotal = records.filter((r: Record<string,string>) => r.service_date >= monthStart).reduce((s: number, r: Record<string,number>) => s + Number(r.amount||0), 0);
    const wtdTotal = records.filter((r: Record<string,string>) => r.service_date >= weekStartStr).reduce((s: number, r: Record<string,number>) => s + Number(r.amount||0), 0);
    const todayTotal = records.filter((r: Record<string,string>) => r.service_date === todayStr).reduce((s: number, r: Record<string,number>) => s + Number(r.amount||0), 0);
    const yoyGrowth = lastYearTotal > 0 ? Math.round(((ytdTotal - lastYearTotal) / lastYearTotal) * 100) : null;

    // ── Monthly breakdown for current year ───────────────────
    const monthlyMap: Record<string, Record<string, number>> = {};
    const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    
    for (let m = 0; m < 12; m++) {
      const key = `${now.getFullYear()}-${String(m+1).padStart(2,'0')}`;
      monthlyMap[key] = { total: 0 };
      incomeTypes.forEach((t: Record<string,string>) => { monthlyMap[key][t.id] = 0; });
    }

    records.forEach((r: Record<string,unknown>) => {
      const date = (r.service_date as string || '').substring(0,7);
      if (monthlyMap[date]) {
        monthlyMap[date].total += Number(r.amount||0);
        if (r.income_type_id) {
          monthlyMap[date][r.income_type_id as string] = (monthlyMap[date][r.income_type_id as string] || 0) + Number(r.amount||0);
        }
      }
    });

    const monthlyTrend = Object.entries(monthlyMap).map(([key, vals]) => {
      const monthIdx = parseInt(key.split('-')[1]) - 1;
      return { month: key, label: MONTH_LABELS[monthIdx], total: vals.total, ...vals };
    });

    // ── Weekly breakdown (last 8 weeks) ──────────────────────
    const weeklyMap: Record<string, number> = {};
    for (let w = 7; w >= 0; w--) {
      const wStart = new Date(now); wStart.setDate(now.getDate() - now.getDay() - w*7);
      const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate() + 6);
      const key = wStart.toISOString().split('T')[0];
      weeklyMap[key] = 0;
    }
    records.forEach((r: Record<string,unknown>) => {
      const d = new Date(r.service_date as string);
      const wStart = new Date(d); wStart.setDate(d.getDate() - d.getDay());
      const key = wStart.toISOString().split('T')[0];
      if (weeklyMap[key] !== undefined) weeklyMap[key] += Number(r.amount||0);
    });
    const weeklyTrend = Object.entries(weeklyMap).map(([key, total], i) => ({ week: `W${i+1}`, date: key, total }));

    // ── By type breakdown ─────────────────────────────────────
    const byType = incomeTypes.map((t: Record<string,string>) => {
      const total = records.filter((r: Record<string,string>) => r.income_type_id === t.id).reduce((s: number, r: Record<string,number>) => s + Number(r.amount||0), 0);
      const pct = ytdTotal > 0 ? Math.round((total/ytdTotal)*100) : 0;
      return { id: t.id, name: t.name, category: t.category, total, pct };
    }).filter((t: Record<string,number>) => t.total > 0).sort((a: Record<string,number>, b: Record<string,number>) => b.total - a.total);

    // ── Recent entries ────────────────────────────────────────
    const recentEntries = records.slice(0, 20).map((r: Record<string,unknown>) => ({
      id: r.id,
      amount: Number(r.amount||0),
      service_date: r.service_date,
      member_name: r.member_name || 'Anonymous',
      income_type: (r.income_types as Record<string,string>|null)?.name || '—',
      notes: r.notes,
      created_at: r.created_at,
    }));

    return NextResponse.json({
      data: {
        kpi: { ytd: ytdTotal, mtd: mtdTotal, wtd: wtdTotal, today: todayTotal, yoy_growth: yoyGrowth, last_year: lastYearTotal },
        monthly_trend: monthlyTrend,
        weekly_trend: weeklyTrend,
        by_type: byType,
        income_types: incomeTypes,
        recent_entries: recentEntries,
        total_entries: records.length,
      },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/analytics/giving]', err);
    return NextResponse.json({ data: null, error: { message: String(err) } }, { status: 500 });
  }
}
