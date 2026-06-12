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
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
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
                max_tokens: 1500,
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
