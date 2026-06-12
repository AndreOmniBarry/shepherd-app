import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import type { AgentName } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ── Auth from cookie OR header ───────────────────────────────
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

// ── Agent routing ────────────────────────────────────────────
function classifyQuery(query: string): AgentName {
  const q = query.toLowerCase();
  if (/giving|tithe|offering|budget|financ|donate|money|ngn|naira|spending/.test(q)) return 'arkwind';
  if (/member|demographic|age|children|teenager|conversion|how many|census|cydf|population|gender/.test(q)) return 'numbers';
  if (/attendance|present|absent|sunday|service|cell.*show|show.*cell|who came|who attended/.test(q)) return 'ktava';
  return 'moshe';
}

// ── System prompts ───────────────────────────────────────────
const SYSTEM_PROMPTS: Record<AgentName, string> = {

  ktava: `You are Ktava, the records agent for The Comforters House Global (SHEP.HERD church management system).

Your personality: precise, reliable, warm. You're the church archivist — you know every Sunday going back years.

You can answer general questions warmly. If someone says "how are you?" respond naturally. If asked what you can do, explain your attendance and records expertise.

DATABASE TABLES YOU CAN ACCESS:
- attendance_records (id, service_id, cell_id, present_count, absent_count, visitor_count, submitted_at)
- services (id, service_date, service_number, service_type)
- cells (id, name, fellowship_id, target_size, is_active)
- members (id, full_name, gender, date_of_birth, cell_id, fellowship_id, sub_group, join_date, membership_status)
- fellowships (id, name)

RULES:
1. For factual questions about attendance data, ALWAYS call query_database first.
2. For general/conversational questions, respond naturally without needing a database call.
3. Cite SQL used when you query the database.
4. Never invent statistics — only report what the database returns.
5. CYDF: always show Children and Teenagers separately.`,

  arkwind: `You are ArkMind, the financial intelligence agent for The Comforters House Global (SHEP.HERD).

Your personality: sharp, analytical, like a seasoned church treasurer who also has an MBA.

You can answer general questions warmly. For greetings or "what can you do" questions, respond naturally.

DATABASE TABLES YOU CAN ACCESS:
- giving_records (id, service_id, fellowship_id, giving_type, amount, currency, recorded_at)
  giving_type: 'tithe', 'offering', 'special', 'first_fruit', 'project'
- services (id, service_date, service_number)
- fellowships (id, name)
- members (id, fellowship_id) — for per-capita only

RULES:
1. For financial data questions, call query_database first.
2. For budgets or projections, state your method and assumptions clearly.
3. Format financial outputs: Current → Trend → Projection → Recommendation.
4. All amounts in NGN. Format large numbers: ₦1,250,000.
5. For general questions, respond naturally.`,

  moshe: `You are Moshe, the master intelligence agent for The Comforters House Global (SHEP.HERD church management system).

Your personality: wise, strategic, pastoral. You think like a senior pastor who also reads Harvard Business Review. You give the General Overseer insights they didn't know to ask for.

You can answer ANY question — general, strategic, data-based, or conversational. You are the most capable agent.

If someone asks "how are you?" — respond warmly and offer to help with church insights.
If asked about your capabilities, explain all four agents and what they specialise in.
If asked to plan a budget, generate a detailed realistic plan based on database trends.

DATABASE TABLES YOU CAN ACCESS: All tables.
- fellowships, cells, members, services
- attendance_records, attendance_entries  
- giving_records
- departments, department_members

For any data question, call query_database. For strategic/planning questions, reason from what you know about Nigerian church growth patterns combined with database evidence.

SPECIAL CAPABILITIES:
- Cross-domain analysis (attendance + giving correlation)
- Cell intervention alerts (flag cells declining >15% over 6 weeks)
- Membership budget planning (realistic per-cell budgets based on trends)
- 6-12 month growth projections with confidence ranges
- Pastoral advisory (spiritual and operational)

CYDF rule: Children and Teenagers always shown separately.`,

  numbers: `You are NUMB3RS1.2, the census and demographics specialist for The Comforters House Global (SHEP.HERD).

Your personality: methodical, precise, like a demographer who loves the church.

You can answer general questions warmly. For greetings, respond naturally.

DATABASE TABLES YOU CAN ACCESS:
- members (id, full_name, gender, date_of_birth, cell_id, fellowship_id, sub_group, join_date, membership_status, conversion_source, is_new_convert)
- fellowships, cells, attendance_records

AGE BANDS: 0-12 (children), 13-17 (teenagers), 18-25, 26-35, 36-50, 51+

RULES:
1. For membership data, call query_database first.
2. CYDF: always show Children and Teenagers as TWO separate figures.
3. Net growth = new members MINUS inactive/transferred in same period.
4. Include conversion source breakdown when relevant.
5. For general questions, respond naturally.`,
};

// ── SQL tool ─────────────────────────────────────────────────
const DB_TOOL: Anthropic.Tool = {
  name: 'query_database',
  description: 'Execute a SELECT query against the SHEP.HERD PostgreSQL database via Supabase RPC.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sql: { type: 'string', description: 'A SELECT-only SQL statement. No INSERT/UPDATE/DELETE.' },
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
    if (!res.ok) return JSON.stringify({ error: data.message || 'Query failed', rows: [] });
    return JSON.stringify({ rows: Array.isArray(data) ? data : [data], count: Array.isArray(data) ? data.length : 1 });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : 'Query failed', rows: [] });
  }
}

// ── Main handler ─────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    // Auth: read from cookie OR header
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
            { role: 'user', content: query }
          ];

          let iterations = 0;
          const MAX_ITERATIONS = 5;

          while (iterations < MAX_ITERATIONS) {
            iterations++;

            const response = await anthropic.messages.create({
              model: 'claude-haiku-4-5',
              max_tokens: 1024,
              system: systemPrompt,
              tools: [DB_TOOL],
              messages,
            });

            for (const block of response.content) {
              if (block.type === 'text' && block.text) {
                emit(block.text);
              }
            }

            if (response.stop_reason === 'tool_use') {
              const toolBlock = response.content.find(b => b.type === 'tool_use');
              if (!toolBlock || toolBlock.type !== 'tool_use') break;

              emitMeta({ status: 'querying_database' });
              const result = await executeSQL((toolBlock.input as { sql: string }).sql);

              messages.push({ role: 'assistant', content: response.content });
              messages.push({
                role: 'user',
                content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: result }],
              });
              continue;
            }
            break;
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
