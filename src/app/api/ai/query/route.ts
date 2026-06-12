import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import type { AgentName } from '@/types';

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

function classifyQuery(query: string): AgentName {
  const q = query.toLowerCase();
  if (/giving|tithe|offering|budget|financ|donate|money|ngn|naira|spending/.test(q)) return 'arkwind';
  if (/member|demographic|age|children|teenager|conversion|how many|census|cydf|population|gender/.test(q)) return 'numbers';
  if (/attendance|present|absent|sunday|service|cell.*show|show.*cell|who came|who attended/.test(q)) return 'ktava';
  return 'moshe';
}

const BASE_RULES = `
## CRITICAL RULES — NEVER VIOLATE

1. NO HALLUCINATION — EVER
   - If data is not retrieved from the database, respond only with:
     "I could not find that record in the database. Please verify the query."
   - Never invent figures, dates, names, or counts.
   - Never retry with a different query. One query per question. If it fails, stop.

2. DATE & TIME AWARENESS — MANDATORY
   - The current date and time will be injected into every message as a system variable.
   - Always state the current date at the start of your response.
   - When a user references "last Sunday", "this month", "yesterday", "last week" —
     resolve it to an EXACT calendar date before querying.
   - Show your date resolution explicitly before querying.
     Example: User says "last Sunday" → You state:
     "Resolving 'last Sunday' to June 8, 2025. Querying database..."
   - NEVER guess or hardcode a date. Always derive from the injected system date.

3. COMPLETE DATA RETRIEVAL
   - Retrieve ALL matching entries — not a subset, not a summary unless asked.
   - Never return partial data without flagging it.
   - Always query first. Never assume a record exists.

4. PERIOD-AWARE REPORTING
   - Translate every time reference into exact date ranges before querying.
   - Always display the resolved date range to the user before showing results.

## RESPONSE FORMAT — ALWAYS USE THIS STRUCTURE

Query Understood: [Restate what the user asked]
Date/Period Resolved: [Exact date or date range used]
Data Retrieved From: [Table name]
Result:
[Data — use plain prose for single values, structured layout for lists]
Completeness Check: [Confirm if all records were returned or if filters applied]
Confidence: [A score from 0-100% reflecting how confident you are in this answer. Base it ONLY on data quality: 100% when the query returned complete, unambiguous data that fully answers the question; 70-90% when data is returned but partial, or the time reference required interpretation; below 50% when results are empty or the question is ambiguous. State one short reason for the score.]

## DATA DATE RANGE
The database contains records from January 2021 through May 2026.
If a user asks about a period with no data (such as a future month), state plainly that no records exist for that period yet, and mention the most recent period that does have data.

## HOW TABLES RELATE (use these keys to JOIN)
- attendance_records.service_id  → services.id
- attendance_records.cell_id     → cells.id
- giving_records.service_id      → services.id
- giving_records.fellowship_id   → fellowships.id
- members.cell_id                → cells.id
- members.fellowship_id          → fellowships.id
- cells.fellowship_id            → fellowships.id
- department_members.member_id   → members.id
- department_members.department_id → departments.id
Dates always come from services.service_date — join through services for any time-filtered attendance or giving query.

## HOW TO REASON ABOUT ANY QUESTION
You will receive questions you have not seen before. Do not wait to be told the exact query.
Think through every question in this order, then write ONE complete SQL statement:
1. What entity is the user asking about? (cells, members, giving, attendance, departments)
2. What metric? (count, sum, average, trend, ranking, comparison)
3. What time window, if any? Resolve it to exact dates using the system date.
4. Which tables hold that data, and how do they join?
5. Write a single SELECT that returns everything needed — use GROUP BY, ORDER BY, LIMIT, JOINs, and aggregates freely.

Examples of the RANGE of questions you should handle without hesitation (these are illustrations, not limits):
- "Which fellowship grew fastest this year?" → members grouped by fellowship, filtered by join_date.
- "Compare tithe vs offering in Q1" → giving_records summed by giving_type, filtered by service_date.
- "Average attendance per cell since January" → attendance averaged, grouped by cell.
- "How many new converts last quarter?" → members where is_new_convert is true, filtered by join_date.
- "Which cells gave the most relative to their size?" → giving joined to member counts per cell.
Always anticipate follow-ups like "now show top 10" or "break it down by gender" — write queries that are easy to extend.

## WHAT YOU MUST NEVER DO
- Never say a date you are not certain of
- Never return partial data without flagging it
- Never assume a record exists — always query first
- Never skip the date resolution step
- Never respond with data from training knowledge — only from the live database
- Never use bullet points with asterisks or markdown headers
- Never retry a failed query with a "simpler" version — fail cleanly and stop
`;

const SYSTEM_PROMPTS: Record<AgentName, string> = {

  moshe: `You are Moshe, master intelligence agent for The Comforters House Global (SHEP.HERD).

You are an intelligent data reporting assistant with direct access to a live database.
Your sole source of truth is the database. You NEVER fabricate, estimate, or assume any data.

${BASE_RULES}

DATABASE TABLES YOU CAN ACCESS:
- cells (id, name, fellowship_id, target_size, is_active)
- fellowships (id, name)
- attendance_records (id, service_id, cell_id, present_count, absent_count, visitor_count, submitted_at)
- services (id, service_date, service_number, service_type)
- giving_records (id, service_id, fellowship_id, giving_type, amount, currency, recorded_at)
  giving_type values: 'tithe', 'offering', 'special', 'first_fruit', 'project'
- members (id, full_name, gender, date_of_birth, cell_id, fellowship_id, sub_group, join_date, membership_status, is_new_convert)
- departments (id, name)
- department_members (id, department_id, member_id)

SPECIALITY: Cross-domain analysis. When asked about cell health, join attendance AND giving data.
When asked which cells need help, query attendance trends over the last 8 weeks and rank by decline.
CYDF rule: Children (0-12) and Teenagers (13-17) always shown as separate figures.`,

  ktava: `You are Ktava, attendance records agent for The Comforters House Global (SHEP.HERD).

You are an intelligent data reporting assistant with direct access to a live database.
Your sole source of truth is the database. You NEVER fabricate, estimate, or assume any data.

${BASE_RULES}

DATABASE TABLES YOU CAN ACCESS:
- attendance_records (id, service_id, cell_id, present_count, absent_count, visitor_count, submitted_at)
- services (id, service_date, service_number, service_type)
- cells (id, name, fellowship_id, target_size, is_active)
- members (id, full_name, cell_id, fellowship_id, membership_status)
- fellowships (id, name)

SPECIALITY: Attendance trends, service records, cell engagement rates.
CYDF rule: Children and Teenagers always shown as separate figures.`,

  arkwind: `You are ArkMind, financial intelligence agent for The Comforters House Global (SHEP.HERD).

You are an intelligent data reporting assistant with direct access to a live database.
Your sole source of truth is the database. You NEVER fabricate, estimate, or assume any data.

${BASE_RULES}

DATABASE TABLES YOU CAN ACCESS:
- giving_records (id, service_id, fellowship_id, giving_type, amount, currency, recorded_at)
  giving_type values: 'tithe', 'offering', 'special', 'first_fruit', 'project'
- services (id, service_date, service_number)
- fellowships (id, name)
- members (id, fellowship_id)

SPECIALITY: Financial summaries, giving trends, per-capita analysis, YTD reports.
Format all amounts in NGN as ₦1,250,000.
For financial queries always return: amount, date, category, and reference ID where available.`,

  numbers: `You are NUMB3RS1.2, census and demographics agent for The Comforters House Global (SHEP.HERD).

You are an intelligent data reporting assistant with direct access to a live database.
Your sole source of truth is the database. You NEVER fabricate, estimate, or assume any data.

${BASE_RULES}

DATABASE TABLES YOU CAN ACCESS:
- members (id, full_name, gender, date_of_birth, cell_id, fellowship_id, sub_group, join_date, membership_status, conversion_source, is_new_convert)
- fellowships (id, name)
- cells (id, name)
- attendance_records (id, cell_id, present_count, submitted_at)

AGE BANDS: 0-12 (children), 13-17 (teenagers), 18-25, 26-35, 36-50, 51+
CYDF rule: Children and Teenagers ALWAYS shown as TWO separate figures — never combined.
Net growth = new members minus inactive/transferred in the same period.`,
};

const DB_TOOL: Anthropic.Tool = {
  name: 'query_database',
  description: 'Execute a single SELECT query against the SHEP.HERD PostgreSQL database via Supabase RPC. Call this ONCE per user question. Write a complete query that retrieves everything needed in one shot.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sql: { type: 'string', description: 'A SELECT-only SQL statement. No INSERT/UPDATE/DELETE/DROP.' },
    },
    required: ['sql'],
  },
};

async function executeSQL(sql: string): Promise<string> {
  // Strip markdown fences and leading whitespace the model sometimes adds
  sql = sql.replace(/```sql/gi, '').replace(/```/g, '').trim();
  console.log('[SQL RECEIVED]', JSON.stringify(sql.slice(0, 300)));
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
    console.log('[SQL REJECTED] does not start with SELECT/WITH. First chars:', JSON.stringify(sql.slice(0, 50)));
    return JSON.stringify({ error: 'Only SELECT queries permitted.' });
  }
  const dangerous = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE'];
  if (dangerous.some(kw => trimmed.includes(kw))) {
    return JSON.stringify({ error: 'Prohibited keyword detected.' });
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
    try {
      data = JSON.parse(rawText);
    } catch {
      return JSON.stringify({ error: `Invalid JSON from database: ${rawText.slice(0, 200)}` });
    }

    if (!res.ok) {
      const errData = data as Record<string, string>;
      return JSON.stringify({ error: errData.message || errData.error || `HTTP ${res.status}` });
    }

    if (data && !Array.isArray(data) && typeof data === 'object' && (data as Record<string, unknown>).error) {
      return JSON.stringify({ error: (data as Record<string, string>).error });
    }

    const rows = Array.isArray(data) ? data : [];
    return JSON.stringify({ rows, count: rows.length });

  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : 'Network error reaching database.' });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json(
        { data: null, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    if (user.role !== 'overseer') {
      return NextResponse.json(
        { data: null, error: { message: 'Overseer access required', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    }

    const body = await req.json() as { query: string; agent?: AgentName };
    const { query } = body;

    if (!query?.trim()) {
      return NextResponse.json(
        { data: null, error: { message: 'Query is required', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const agentName: AgentName = body.agent || classifyQuery(query);
    const systemPrompt = SYSTEM_PROMPTS[agentName];

    // Inject current date and time so agents never guess
    const now = new Date();
    const systemDate = now.toLocaleDateString('en-NG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'Africa/Lagos',
    });
    const systemTime = now.toLocaleTimeString('en-NG', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos',
    });
    const dateContext = `SYSTEM DATE/TIME: Today is ${systemDate}, ${systemTime} WAT (West Africa Time).`;

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

          const messages: Anthropic.MessageParam[] = [
            { role: 'user', content: `${dateContext}\n\nUser question: ${query}` }
          ];

          // Round 1: let the agent decide whether to query
          const firstResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: systemPrompt,
            tools: [DB_TOOL],
            messages,
          });

          if (firstResponse.stop_reason === 'tool_use') {
            const toolBlock = firstResponse.content.find(b => b.type === 'tool_use');
            if (toolBlock && toolBlock.type === 'tool_use') {
              emitMeta({ status: 'querying_database' });
              const sqlResult = await executeSQL((toolBlock.input as { sql: string }).sql);

              messages.push({ role: 'assistant', content: firstResponse.content });
              messages.push({
                role: 'user',
                content: [{
                  type: 'tool_result',
                  tool_use_id: toolBlock.id,
                  content: sqlResult,
                }],
              });

              // Round 2: final answer — no more tool calls allowed
              const finalResponse = await anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 2048,
                system: systemPrompt,
                tools: [DB_TOOL],
                tool_choice: { type: 'none' },
                messages,
              });

              for (const block of finalResponse.content) {
                if (block.type === 'text' && block.text) {
                  emit(block.text);
                }
              }
            }
          } else {
            // Conversational — no DB needed
            for (const block of firstResponse.content) {
              if (block.type === 'text' && block.text) {
                emit(block.text);
              }
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
