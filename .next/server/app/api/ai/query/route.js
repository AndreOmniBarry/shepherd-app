"use strict";(()=>{var e={};e.id=717,e.ids=[717],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},14300:e=>{e.exports=require("buffer")},57147:e=>{e.exports=require("fs")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},72254:e=>{e.exports=require("node:buffer")},6005:e=>{e.exports=require("node:crypto")},15673:e=>{e.exports=require("node:events")},87561:e=>{e.exports=require("node:fs")},88849:e=>{e.exports=require("node:http")},22286:e=>{e.exports=require("node:https")},84492:e=>{e.exports=require("node:stream")},47261:e=>{e.exports=require("node:util")},71017:e=>{e.exports=require("path")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},71576:e=>{e.exports=require("string_decoder")},57310:e=>{e.exports=require("url")},73837:e=>{e.exports=require("util")},71267:e=>{e.exports=require("worker_threads")},59796:e=>{e.exports=require("zlib")},6618:(e,t,r)=>{r.r(t),r.d(t,{headerHooks:()=>f,originalPathname:()=>w,requestAsyncStorage:()=>h,routeModule:()=>p,serverHooks:()=>y,staticGenerationAsyncStorage:()=>g,staticGenerationBailout:()=>_});var a={};r.r(a),r.d(a,{POST:()=>POST}),r(78976);var s=r(10884),o=r(16132),n=r(95798),i=r(37999),l=r(75788);let d=new i.ZP({apiKey:process.env.ANTHROPIC_API_KEY});async function getUser(e){let t=e.headers.get("cookie")||"",r=t.match(/shepherd_token=([^;]+)/),a=e.headers.get("Authorization")?.replace("Bearer ",""),s=r?.[1]||a;if(!s)return null;let o=await (0,l.WX)(s);return o?(0,l.td)(o):null}let c=`
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
- cells (id, name, fellowship_id, target_size, is_active)
- fellowships (id, name)
- attendance_records (id, service_id, cell_id, present_count, absent_count, visitor_count, submitted_at)
- services (id, service_date, service_number, service_type)
- income_records (id, income_type_id, amount, service_date, created_at, notes)
- income_types (id, name, category) — category is 'individual', 'aggregate', or 'partnership'
- giving_records (id, fellowship_id, service_date, tithe, offering, special, project, submitted_by) — fellowship-level giving summary
- members (id, full_name, gender, date_of_birth, phone, email, cell_id, fellowship_id, sub_group, join_date, membership_status, conversion_source, is_new_convert, created_at)
- departments (id, name)
- department_members (id, department_id, member_id)

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

IMPORTANT: For total church income use income_records joined with income_types. For fellowship-level giving totals use giving_records. Always show income_types.name not 'Anonymous' as the category label.

Dates always come from services.service_date. Join through services for time-filtered attendance or giving queries.
sub_group in members only contains "children" or "teenagers" for age classification. Leader data is NOT stored in the database. If asked about a cell leader, state clearly: "Leader information is not currently stored in the database."
CYDF: Children (0-12) and Teenagers (13-17) always shown as separate figures.

## SQL TOOL
The sql field must contain only raw SQL starting with SELECT or WITH.
No markdown, no code fences, no comments before the SQL.
`,u={moshe:`You are Moshe, master intelligence agent for The Comforters House Global (SHEP.HERD).
${c}
You have access to all tables. Specialise in cross-domain analysis — attendance trends, giving patterns, member growth, cell health, department breakdowns. When asked which cells need help, query attendance over the last 8 weeks and rank by lowest performance or steepest decline.`,ktava:`You are Ktava, attendance records agent for The Comforters House Global (SHEP.HERD).
${c}
You specialise in attendance trends, service records, and cell engagement rates.`,arkwind:`You are ArkMind, financial intelligence agent for The Comforters House Global (SHEP.HERD).
${c}
You specialise in giving summaries, financial trends, per-capita analysis, and YTD reports.
Format all amounts as NGN with the naira sign. For financial queries always return amount, date, category, and reference ID where available.`,numbers:`You are NUMB3RS1.2, census and demographics agent for The Comforters House Global (SHEP.HERD).
${c}
You specialise in member counts, demographics, age distribution, and conversion tracking.
Age bands: 0-12 (children), 13-17 (teenagers), 18-25, 26-35, 36-50, 51+.
Net growth = new members minus inactive or transferred in same period.`},m={name:"query_database",description:"Execute a single SELECT query against the SHEP.HERD PostgreSQL database. Call once per user message with a complete query.",input_schema:{type:"object",properties:{sql:{type:"string",description:"Raw SQL only — starts directly with SELECT or WITH. No markdown, no code fences, no comments."}},required:["sql"]}};async function executeSQL(e){let t=e.replace(/```sql/gi,"").replace(/```/g,"").trim();console.log("[SQL]",t.slice(0,400));let r=t.toUpperCase();if(!r.startsWith("SELECT")&&!r.startsWith("WITH"))return console.log("[SQL REJECTED]",JSON.stringify(t.slice(0,60))),JSON.stringify({error:"Only SELECT queries permitted."});if(["INSERT","UPDATE","DELETE","DROP","TRUNCATE","ALTER","CREATE"].some(e=>r.includes(e)))return JSON.stringify({error:"Prohibited keyword detected."});try{let e;let r=process.env.SUPABASE_SERVICE_ROLE_KEY,a=await fetch("https://utiqloilngsjcdbsjwbc.supabase.co/rest/v1/rpc/execute_safe_query",{method:"POST",headers:{"Content-Type":"application/json",apikey:r,Authorization:`Bearer ${r}`},body:JSON.stringify({query_text:t})}),s=await a.text();console.log("[SUPABASE]",a.status,s.slice(0,500));try{e=JSON.parse(s)}catch{return JSON.stringify({error:`Invalid response: ${s.slice(0,200)}`})}if(!a.ok){let t=e;return JSON.stringify({error:t.message||t.error||`HTTP ${a.status}`})}if(e&&!Array.isArray(e)&&"object"==typeof e&&e.error)return JSON.stringify({error:e.error});let o=Array.isArray(e)?e:[];return JSON.stringify({rows:o,count:o.length})}catch(e){return JSON.stringify({error:e instanceof Error?e.message:"Network error."})}}async function POST(e){try{let t=await getUser(e);if(!t)return n.Z.json({data:null,error:{message:"Authentication required",code:"UNAUTHORIZED"}},{status:401});if("overseer"!==t.role)return n.Z.json({data:null,error:{message:"Overseer access required",code:"FORBIDDEN"}},{status:403});let r=await e.json(),{query:a,history:s=[]}=r;if(!a?.trim())return n.Z.json({data:null,error:{message:"Query is required",code:"VALIDATION_ERROR"}},{status:400});let o=r.agent||function(e){let t=e.toLowerCase();return/giving|tithe|offering|budget|financ|donate|money|ngn|naira|spending/.test(t)?"arkwind":/member|demographic|age|children|teenager|conversion|how many|census|cydf|population|gender/.test(t)?"numbers":/attendance|present|absent|sunday|service|cell.*show|show.*cell|who came|who attended/.test(t)?"ktava":"moshe"}(a),i=u[o],l=new Date,c=l.toLocaleDateString("en-NG",{weekday:"long",year:"numeric",month:"long",day:"numeric",timeZone:"Africa/Lagos"}),p=l.toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit",timeZone:"Africa/Lagos"}),h=`[SYSTEM: Today is ${c}, ${p} WAT]`,g=[];for(let e of s)g.push({role:e.role,content:e.content});g.push({role:"user",content:`${h}

${a}`});let y=new TextEncoder,f=new ReadableStream({async start(e){function emit(t){e.enqueue(y.encode(`data: ${JSON.stringify({text:t})}

`))}function emitMeta(t){e.enqueue(y.encode(`data: ${JSON.stringify({meta:t})}

`))}try{emitMeta({agent:o,status:"thinking"});let t=await d.messages.create({model:"claude-haiku-4-5",max_tokens:1024,system:[{type:"text",text:i,cache_control:{type:"ephemeral"}}],tools:[m],messages:g});if("tool_use"===t.stop_reason){let e=t.content.find(e=>"tool_use"===e.type);if(e&&"tool_use"===e.type){emitMeta({status:"querying_database"});let r=await executeSQL(e.input.sql);g.push({role:"assistant",content:t.content}),g.push({role:"user",content:[{type:"tool_result",tool_use_id:e.id,content:r}]});let a=await d.messages.create({model:"claude-sonnet-4-6",max_tokens:2048,system:[{type:"text",text:i,cache_control:{type:"ephemeral"}}],tools:[m],tool_choice:{type:"none"},messages:g});for(let e of a.content)"text"===e.type&&e.text&&emit(e.text)}}else for(let e of t.content)"text"===e.type&&e.text&&emit(e.text);emitMeta({agent:o,status:"done"}),e.enqueue(y.encode("data: [DONE]\n\n")),e.close()}catch(r){let t=r instanceof Error?r.message:"Agent error";e.enqueue(y.encode(`data: ${JSON.stringify({error:t})}

`)),e.close()}}});return new Response(f,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Agent":o}})}catch(e){return console.error("[POST /api/ai/query]",e),n.Z.json({data:null,error:{message:"Agent unavailable",code:"INTERNAL_ERROR"}},{status:500})}}let p=new s.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/ai/query/route",pathname:"/api/ai/query",filename:"route",bundlePath:"app/api/ai/query/route"},resolvedPagePath:"/Users/khourageandreomnibarry/Downloads/shepherd-app-main/src/app/api/ai/query/route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:h,staticGenerationAsyncStorage:g,serverHooks:y,headerHooks:f,staticGenerationBailout:_}=p,w="/api/ai/query/route"}};var t=require("../../../../webpack-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),r=t.X(0,[3955,5471,5155,7999,5788],()=>__webpack_exec__(6618));module.exports=r})();