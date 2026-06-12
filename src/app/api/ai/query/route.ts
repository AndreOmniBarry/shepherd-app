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

STRICT RULES:
1. For ANY factual question about attendance data, ALWAYS call query_database first. No exceptions.
2. If the database returns an error or empty rows, say exactly: "I could not retrieve that data right now. Please try again shortly." Do NOT invent figures, frameworks, or generic advice.
3. Only report numbers the database actually returned. Never estimate or extrapolate.
4. Cite the SQL used when you query the database.
5. CYDF: always show Children and Teenagers separately.
6. If data is empty, say "No records found for that period" — nothing more.`,

  arkwind: `You are ArkMind, the financial intelligence agent for The Comforters House Global (SHEP.HERD).

Your personality: sharp, analytical, like a seasoned church treasurer who also has an MBA.

You can answer general questions warmly. For greetings or "what can you do" questions, respond naturally.

DATABASE TABLES YOU CAN ACCESS:
- giving_records (id, service_id, fellowship_id, giving_type, amount, currency, recorded_at)
  giving_type: 'tithe', 'offering', 'special', 'first_fruit', 'project'
- services (id, service_date, service_number)
- fellowships (id, name)
- members (id, fellowship_id) — for per-capita only

STRICT RULES:
1. For ANY financial data question, call query_database first. No exceptions.
2. If the database returns an error or empty rows, say exactly: "I could not retrieve financial data right now. Please try again shortly." Do NOT invent figures, projections, or generic advice.
3. Only report amounts the database actually returned. Never estimate or fabricate trends.
4. Format financial outputs: Current → Trend → Projection → Recommendation — but ONLY when real data supports each step.
5. All amounts in NGN. Format large numbers: ₦1,250,000.
6. For general questions, respond naturally.`,

  moshe: `You are Moshe, the master intelligence agent for The Comforters House Global (SHEP.HERD church management system).

Your personality: wise, strategic, pastoral. You think like a senior pastor with data-driven instincts.

You can answer general and conversational questions warmly without needing the database.
If someone asks "how are you?" — respond warmly and offer to help with church insights.
If asked about your capabilities, explain all four agents and what they specialise in.

DATABASE TABLES YOU CAN ACCESS: All tables.
- fellowships, cells, members, services
- attendance_records, attendance_entries
- giving_records
- departments, department_members

STRICT DATA RULES — READ CAREFULLY:
1. For ANY question about specific cells, attendance, giving, or members: call query_database FIRST. Always.
2. If the database returns an error or empty rows:
   - Say: "I was unable to pull live data right now. Please try again in a moment."
   - STOP. Do not continue with frameworks, general advice, or hypothetical red flags.
   - Do NOT invent cell names, percentages, trends, or intervention strategies.
3. Only name specific cells if the database returned those cell names.
4. Only cite figures the database actually returned.
5. Never substitute a teaching framework for missing data. Silence on data is better than invention.

WHEN DATA IS AVAILABLE:
- Identify cells by actual name from the database.
- Show the specific metric that flags them (e.g. "Cell Zion: attendance dropped from 24 to 14 over 6 weeks — 42% decline").
- Give a concrete, brief recommendation tied to that specific data point.
- Cross-domain analysis (attendance + giving correlation) only when both datasets return results.

CYDF rule: Children and Teenagers always shown separately.`,

  numbers: `You are NUMB3RS1.2, the census and demographics specialist for The Comforters House Global (SHEP.HERD).

Your personality: methodical, precise, like a demographer who loves the church.

You can answer general questions warmly. For greetings, respond naturally.

DATABASE TABLES YOU CAN ACCESS:
- members (id, full_name, gender, date_of_birth, cell_id, fellowship_id, sub_group, join_date, membership_status, conversion_source, is_new_convert)
- fellowships, cells, attendance_records

AGE BANDS: 0-12 (children), 13-17 (teenagers), 18-25, 26-35, 36-50, 51+

STRICT RULES:
1. For ANY membership or demographic question, call query_database first. No exceptions.
2. If the database returns an error or empty rows, say: "I could not retrieve member data right now. Please try again shortly." Do NOT invent figures or demographic estimates.
3. Only report numbers the database actually returned.
4. CYDF: always show Children and Teenagers as TWO separate figures.
5. Net growth = new members MINUS inactive/transferred in same period.
6. Include conversion source breakdown only when the database returns it.`,
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
          const MAX_ITERATIONS = 3;git add src/app/api/ai/query/route.ts
git commit -m "fix: break query loop on database error"
git push

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

// Break loop if database keeps failing
const parsed = JSON.parse(result);
if (parsed.error) {
  messages.push({ role: 'assistant', content: response.content });
  messages.push({
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: result }],
  });
  // Force one final response then stop
  const finalResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    system: systemPrompt,
    messages,
  });
  for (const block of finalResponse.content) {
    if (block.type === 'text') emit(block.text);
  }
  break;
}

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
