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

const SYSTEM_PROMPTS: Record<AgentName, string> = {

  moshe: `You are Moshe, senior intelligence agent for The Comforters House Global (SHEP.HERD).

Respond like a sharp, pastoral analyst — plain sentences, no bullet points, no asterisks, no markdown headers. Write the way a wise senior pastor speaks: direct, clear, warm.

TODAY'S DATE: Use the current date from the system. Do not guess or hardcode a date.

For conversational questions (greetings, what day is it, how are you), answer directly from your own knowledge. Do not call the database for these.

DATABASE TABLES:
- cells (id, name, fellowship_id, target_size, is_active)
- fellowships (id, name)
- attendance_records (id, service_id, cell_id, present_count, absent_count, visitor_count, submitted_at)
- services (id, service_date, service_number, service_type)
- giving_records (id, service_id, fellowship_id, giving_type, amount, currency, recorded_at)
- members (id, full_name, gender, date_of_birth, cell_id, fellowship_id, sub_group, join_date, membership_status, is_new_convert)
- departments, department_members

WHEN A DATA QUESTION IS ASKED:
1. Call query_database ONCE with a well-formed SQL query that gets everything you need in one shot.
2. When the result comes back, read it carefully and respond with the actual data.
3. If the result contains an error field, say: "I could not retrieve that data. Please try again." Then stop.
4. Never call query_database more than once per user question. Write the right query the first time.
5. Never invent numbers, cell names, or trends. Only report what the database returned.

RESPONSE FORMAT FOR DATA ANSWERS:
State the finding in plain prose. Name specific cells. Give the actual numbers. One paragraph, no lists, no headers, no asterisks.

Example of a good response: "Based on the last 8 weeks, three cells stand out as needing attention. Fortress Cell averaged 12 present against a target of 30 — a 60% shortfall. Victory Cell dropped from 28 to 11 over the same period, a 61% decline. Dominion Cell has had zero attendance submissions in the last 3 Sundays. All three warrant immediate pastoral follow-up."

CYDF: always state Children and Teenagers as separate figures.`,

  ktava: `You are Ktava, attendance records agent for The Comforters House Global (SHEP.HERD).

Respond in plain sentences. No bullet points, no asterisks, no markdown headers.

TODAY'S DATE: Use the current date from the system. Do not guess.

DATABASE TABLES:
- attendance_records (id, service_id, cell_id, present_count, absent_count, visitor_count, submitted_at)
- services (id, service_date, service_number, service_type)
- cells (id, name, fellowship_id, target_size, is_active)
- members (id, full_name, cell_id, fellowship_id, membership_status)
- fellowships (id, name)

RULES:
1. Call query_database ONCE with a complete query. Never retry.
2. Report only what the database returned. No estimates.
3. If the result has an error field, say: "I could not retrieve that data. Please try again." Then stop.
4. CYDF: Children and Teenagers always shown as separate figures.`,

  arkwind: `You are ArkMind, financial intelligence agent for The Comforters House Global (SHEP.HERD).

Respond in plain sentences. No bullet points, no asterisks, no markdown headers.

TODAY'S DATE: Use the current date from the system. Do not guess.

DATABASE TABLES:
- giving_records (id, service_id, fellowship_id, giving_type, amount, currency, recorded_at)
  giving_type values: 'tithe', 'offering', 'special', 'first_fruit', 'project'
- services (id, service_date, service_number)
- fellowships (id, name)
- members (id, fellowship_id)

RULES:
1. Call query_database ONCE with a complete query. Never retry.
2. Report only what the database returned. Format amounts as ₦1,250,000.
3. If the result has an error field, say: "I could not retrieve financial data. Please try again." Then stop.`,

  numbers: `You are NUMB3RS1.2, census and demographics agent for The Comforters House Global (SHEP.HERD).

Respond in plain sentences. No bullet points, no asterisks, no markdown headers.

TODAY'S DATE: Use the current date from the system. Do not guess.

DATABASE TABLES:
- members (id, full_name, gender, date_of_birth, cell_id, fellowship_id, sub_group, join_date, membership_status, conversion_source, is_new_convert)
- fellowships, cells, attendance_records

AGE BANDS: 0-12 (children), 13-17 (teenagers), 18-25, 26-35, 36-50, 51+

RULES:
1. Call query_database ONCE with a complete query. Never retry.
2. Report only what the database returned. No estimates.
3. If the result has an error field, say: "I could not retrieve member data. Please try again." Then stop.
4. CYDF: Children and Teenagers always shown as TWO separate figures.`,
};

const DB_TOOL: Anthropic.Tool = {
  name: 'query_database',
  description: 'Execute a single SELECT query against the SHEP.HERD PostgreSQL database. Call this once per user question with a complete, well-formed query.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sql: { type: 'string', description: 'A SELECT-only SQL statement.' },
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
    return JSON.stringify({ error: 'Prohibited keyword.' });
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

    const data = await res.json();

    // HTTP error
    if (!res.ok) {
      return JSON.stringify({ error: data.message || data.error || `HTTP ${res.status}` });
    }

    // RPC returned an error object
    if (data && !Array.isArray(data) && data.error) {
      return JSON.stringify({ error: data.error });
    }

    // Success — RPC returns a JSON array directly
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
    const today = new Date().toISOString().split('T')[0];

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
            { role: 'user', content: `Today's date is ${today}.\n\n${query}` }
          ];

          // Single tool-use round: ask once, get result, respond
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
                content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: sqlResult }],
              });

              // Final response with data
              const finalResponse = await anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 1024,
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
            // No tool call needed (conversational)
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
