import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { requirePremium, getChurchPlan } from '@/lib/plan-gate';
import { recordUsage } from '@/lib/usage';
import type { AgentName, AuthUser } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const cookieMatch = cookie.match(/shepherd_token=([^;]+)/);
  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
  const token = cookieMatch?.[1] || authHeader;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

// Only general_overseer and lead_tech have unrestricted BRANCH reach —
// every other role that can reach Moshe at all is either blocked from
// financial tables entirely (pa) or hard-scoped to their own branch
// (overseer, branch_pastor). This is enforced here in code, not just
// described in the prompt, since an LLM's own judgement about what it
// should or shouldn't say is not a security boundary.
const FINANCIAL_TABLES = ['income_records', 'income_types', 'giving_records', 'expense_requisitions', 'financial_periods'];

function touchesFinancialData(sql: string): boolean {
  const lower = sql.toLowerCase();
  return FINANCIAL_TABLES.some(t => new RegExp(`\\b${t}\\b`).test(lower));
}

// CHURCH tenant boundary — no role is unrestricted here, including
// lead_tech and general_overseer. Every table Moshe knows about that
// carries its own church_id column must be filtered to the caller's own
// church whenever the generated SQL touches it, or a natural-language
// question like "list all cells" would hand back every church's member
// PII, attendance, and giving data platform-wide. Platform-wide diagnostics
// belong in the dedicated admin endpoints (admin/churches, admin/alerts),
// not this raw-SQL surface.
const CHURCH_SCOPED_TABLES = ['branches', 'cells', 'fellowships', 'services', 'income_records', 'members', 'departments', 'expense_requisitions'];

function touchesChurchScopedTable(sql: string): boolean {
  const lower = sql.toLowerCase();
  return CHURCH_SCOPED_TABLES.some(t => new RegExp(`\\b${t}\\b`).test(lower));
}

const BASE_RULES = `
## IDENTITY
You are an intelligent church data assistant for The Comforters House Global (SHEP.HERD).
Your sole source of truth is the live database. You never fabricate, estimate, or assume data.

## CONVERSATION MEMORY
You will receive the full conversation history with every message.
Use prior messages to understand context. If the user says "who is their leader" after asking about Kingdom Builders Cell, you already know they mean Kingdom Builders Cell.
Never ask for clarification if the answer is already in the conversation history.

## HOW TO RESPOND
Respond in clear, natural, flowing sentences like a knowledgeable colleague giving a briefing.
No markdown headers. No bullet points with asterisks. No bold text. No sub-headers.
No "Query Understood", "Date Resolved", "Data Retrieved From" labels.
Just speak the answer directly and confidently.
For lists of items use a simple numbered format: 1. Item — detail
End every data response with one sentence stating your confidence level and a brief reason.

## NEVER STALL
Never respond with a placeholder like "let me fetch that for you", "give me a moment", or
"I'll pull that information" as a message on its own. If the question needs data, call
query_database in that same turn — do not announce that you are about to look something up and
then stop. If the question does not need data, answer it directly and completely in the same
turn. Every reply must be either a complete direct answer or a tool call — never a stall.

## DATE AND TIME
The current date and time is injected into every message.
Resolve time references like "last month", "this year", "last Sunday" to exact dates silently before querying.
Never hardcode or guess a date. Always derive from the injected system date.
The database contains records from January 2021 through May 2026. If a user asks about a period with no data, say so plainly and mention the most recent available period.

## DATABASE RULES
1. For any data question, call query_database ONCE with a complete well-formed SQL query.
2. Never call query_database more than once per user message.
3. If the result contains an error field, say: "I was unable to retrieve that data. Please try again." Then stop.
4. Never invent numbers, names, or trends. Only report what the database returned.
5. If results are empty, say the data does not exist for that period.

## SCHEMA
- branches (id, name, is_headquarters, church_id)
- cells (id, name, fellowship_id, branch_id, target_size, is_active, church_id)
- fellowships (id, name, branch_id, church_id)
- attendance_records (id, service_id, cell_id, present_count, absent_count, visitor_count, submitted_at)
- services (id, service_date, service_number, service_type, branch_id, church_id)
- income_records (id, income_type_id, amount, service_date, created_at, notes, branch_id, church_id)
- income_types (id, name, category) — category is 'individual', 'aggregate', or 'partnership'
- giving_records (id, fellowship_id, service_date, tithe, offering, special, project, submitted_by) — fellowship-level giving summary
- members (id, full_name, gender, date_of_birth, phone, email, cell_id, fellowship_id, branch_id, sub_group, join_date, membership_status, conversion_source, is_new_convert, created_at, church_id)
- departments (id, name, branch_id, church_id)
- department_members (id, department_id, member_id)
- expense_requisitions (id, title, amount_requested, amount_approved, status, branch_id, created_at, church_id)

JOIN KEYS:
- attendance_records.service_id -> services.id
- attendance_records.cell_id -> cells.id
- income_records.income_type_id -> income_types.id
- giving_records.fellowship_id -> fellowships.id
- members.cell_id -> cells.id
- members.fellowship_id -> fellowships.id
- cells.fellowship_id -> fellowships.id
- department_members.member_id -> members.id
- department_members.department_id -> departments.id
- cells.branch_id / fellowships.branch_id / members.branch_id / departments.branch_id / income_records.branch_id / expense_requisitions.branch_id -> branches.id

## ACCESS SCOPE
Every message is prefixed with a [SCOPE] line telling you the caller's role, their exact church_id,
and, if they are branch-scoped, their exact branch_id.

Every query you write that touches a table with a church_id column (branches, cells, fellowships,
services, income_records, members, departments, expense_requisitions) MUST filter
WHERE church_id = '<that exact uuid>' — no exception for any role. This app is multi-tenant: never
write a query with no church filter at all on a church-scoped table, and never query another
church's id, even if asked to "list every church" or similar — you only ever have access to the
caller's own church's data.

If a branch_id is also given, every query touching a table with a branch_id column MUST additionally
filter WHERE branch_id = '<that exact uuid>' on top of the church_id filter.

If [SCOPE] says financial data is restricted, do not call query_database for any question about
giving, income, requisitions, or financial trends — instead say plainly that financial data access
is restricted for this role and suggest they ask their General Overseer or Branch Pastor.

IMPORTANT: For total church income use income_records joined with income_types. For fellowship-level giving totals use giving_records. Always show income_types.name not 'Anonymous' as the category label.

Dates always come from services.service_date. Join through services for time-filtered attendance or giving queries.
sub_group in members only contains "children" or "teenagers" for age classification. Leader data is NOT stored in the database. If asked about a cell leader, state clearly: "Leader information is not currently stored in the database."
CYDF: Children (0-12) and Teenagers (13-19) always shown as separate figures.

## SQL TOOL
The sql field must contain only raw SQL starting with SELECT or WITH.
No markdown, no code fences, no comments before the SQL.
`;

const MOSHE_PROMPT = `You are Moshe, the church intelligence assistant for The Comforters House Global (SHEP.HERD).
${BASE_RULES}
You have access to all tables and handle every domain yourself — attendance trends, service
records, cell engagement, giving summaries, financial trends, per-capita and YTD analysis, member
counts, demographics, and conversion tracking.
Format all amounts as NGN with the naira sign. For financial queries always return amount, date,
category, and reference ID where available.
Age bands for demographics: 0-12 (children), 13-19 (teenagers), 20-25, 26-35, 36-50, 51+.
Net growth = new members minus inactive or transferred in the same period.
When asked which cells need help, query attendance over the last 8 weeks and rank by lowest
performance or steepest decline.`;

const DB_TOOL: Anthropic.Tool = {
  name: 'query_database',
  description: 'Execute a single SELECT query against the SHEP.HERD PostgreSQL database. Call once per user message with a complete query.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sql: {
        type: 'string',
        description: 'Raw SQL only — starts directly with SELECT or WITH. No markdown, no code fences, no comments.',
      },
    },
    required: ['sql'],
  },
};

async function executeSQL(rawSql: string, user: AuthUser): Promise<string> {
  const sql = rawSql.replace(/```sql/gi, '').replace(/```/g, '').trim();
  console.log('[SQL]', sql.slice(0, 400));

  const upper = sql.toUpperCase();
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    console.log('[SQL REJECTED]', JSON.stringify(sql.slice(0, 60)));
    return JSON.stringify({ error: 'Only SELECT queries permitted.' });
  }
  const dangerous = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE'];
  if (dangerous.some(kw => upper.includes(kw))) {
    return JSON.stringify({ error: 'Prohibited keyword detected.' });
  }

  // Church tenant guardrail — applies to every role, no exceptions. This
  // is a naive string-containment check (matching the existing branch_id
  // pattern below), not a real SQL parser, but it closes off the previous
  // total absence of any tenant check on this endpoint.
  if (touchesChurchScopedTable(sql)) {
    if (!user.church_id || !sql.includes(user.church_id)) {
      console.log('[SQL BLOCKED — missing church_id filter]');
      return JSON.stringify({ error: 'This query must be scoped to your own church. Please rephrase.' });
    }
  }

  // Financial guardrail — enforced in code, not trusted to the model.
  if (touchesFinancialData(sql)) {
    if (user.role === 'pa') {
      console.log('[SQL BLOCKED — pa financial query]');
      return JSON.stringify({ error: 'Financial data access is restricted for this role. Ask your General Overseer or Branch Pastor.' });
    }
    if (['overseer', 'branch_pastor'].includes(user.role)) {
      if (!user.branch_id || !sql.includes(user.branch_id)) {
        console.log('[SQL BLOCKED — branch-scoped role missing branch filter]');
        return JSON.stringify({ error: `Financial queries for this role must be scoped to your own branch (branch_id = '${user.branch_id || ''}'). Please rephrase or ask about your own branch specifically.` });
      }
    }
    // general_overseer and lead_tech: unrestricted.
  }

  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_safe_query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query_text: sql }),
    });

    const rawText = await res.text();
    console.log('[SUPABASE]', res.status, rawText.slice(0, 500));

    let data: unknown;
    try { data = JSON.parse(rawText); } catch {
      return JSON.stringify({ error: `Invalid response: ${rawText.slice(0, 200)}` });
    }

    if (!res.ok) {
      const e = data as Record<string, string>;
      return JSON.stringify({ error: e.message || e.error || `HTTP ${res.status}` });
    }
    if (data && !Array.isArray(data) && typeof data === 'object' && (data as Record<string, unknown>).error) {
      return JSON.stringify({ error: (data as Record<string, string>).error });
    }

    const rows = Array.isArray(data) ? data : [];
    return JSON.stringify({ rows, count: rows.length });

  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : 'Network error.' });
  }
}

type ConversationMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json(
        { data: null, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    if (!['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json(
        { data: null, error: { message: 'Overseer access required', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    }
    const blocked = await requirePremium(user.church_id);
    if (blocked) return blocked;

    // Fire-and-forget — one query is one usage unit regardless of whether
    // the model ends up calling query_database. Never gates the request;
    // just tags this event as pay-as-you-go overage once the church is
    // past its plan's included monthly quota, for the command center and
    // future invoicing to pick up.
    getChurchPlan(user.church_id).then(plan => recordUsage(user.church_id, 'moshe', plan.plan_tier)).catch(() => {});

    const body = await req.json() as { query: string; agent?: AgentName; history?: ConversationMessage[] };
    const { query, history = [] } = body;

    if (!query?.trim()) {
      return NextResponse.json(
        { data: null, error: { message: 'Query is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const agentName: AgentName = 'moshe';
    const systemPrompt = MOSHE_PROMPT;

    const now = new Date();
    const systemDate = now.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Lagos' });
    const systemTime = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
    const dateContext = `[SYSTEM: Today is ${systemDate}, ${systemTime} WAT]`;

    const churchScope = `church_id=${user.church_id || 'none'}. Every query touching a table with a church_id column must filter WHERE church_id = '${user.church_id || ''}' — no exception for any role.`;
    const scopeContext = user.role === 'pa'
      ? `[SCOPE: role=pa, ${churchScope} Financial data access is restricted — do not query income_records, income_types, giving_records, expense_requisitions, or financial_periods for this user under any circumstance.]`
      : ['overseer', 'branch_pastor'].includes(user.role)
        ? `[SCOPE: role=${user.role}, ${churchScope} Also branch_id=${user.branch_id || 'none'} — every query touching a table with a branch_id column must additionally filter WHERE branch_id = '${user.branch_id || ''}'.]`
        : `[SCOPE: role=${user.role}, ${churchScope} No branch limits apply, but the church_id filter above is still mandatory.]`;

    const messages: Anthropic.MessageParam[] = [];
    for (const turn of history) {
      messages.push({ role: turn.role, content: turn.content });
    }
    messages.push({ role: 'user', content: `${dateContext}\n${scopeContext}\n\n${query}` });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function emit(data: string) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: data })}\n\n`));
        }
        function emitMeta(meta: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ meta })}\n\n`));
        }

        try {
          emitMeta({ agent: agentName, status: 'thinking' });

          // Tool-call decisions need a model that reliably invokes query_database instead of
          // replying with a "let me look that up" stall — a smaller/faster model was prone to
          // exactly that failure mode, so both passes now use the same reliable model.
          const firstResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
            tools: [DB_TOOL],
            messages,
          });

          if (firstResponse.stop_reason === 'tool_use') {
            const toolBlock = firstResponse.content.find(b => b.type === 'tool_use');
            if (toolBlock && toolBlock.type === 'tool_use') {
              emitMeta({ status: 'querying_database' });
              const sqlResult = await executeSQL((toolBlock.input as { sql: string }).sql, user);

              messages.push({ role: 'assistant', content: firstResponse.content });
              messages.push({
                role: 'user',
                content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: sqlResult }],
              });

              const finalResponse = await anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 2048,
                system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
                tools: [DB_TOOL],
                tool_choice: { type: 'none' },
                messages,
              });

              for (const block of finalResponse.content) {
                if (block.type === 'text' && block.text) emit(block.text);
              }
            }
          } else {
            for (const block of firstResponse.content) {
              if (block.type === 'text' && block.text) emit(block.text);
            }
          }

          emitMeta({ agent: agentName, status: 'done' });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Agent error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Agent': agentName,
      },
    });

  } catch (err) {
    console.error('[POST /api/ai/query]', err);
    return NextResponse.json(
      { data: null, error: { message: 'Agent unavailable', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
