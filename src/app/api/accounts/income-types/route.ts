
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
const S=process.env.NEXT_PUBLIC_SUPABASE_URL!,K=process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h=()=>({'apikey':K,'Authorization':\`Bearer \${K}\`,'Content-Type':'application/json'});
async function getUser(req:Request){const c=req.headers.get('cookie')||'';const m=c.match(/shepherd_token=([^;]+)/);const t=m?.[1];if(!t)return null;const p=await verifyToken(t);return p?payloadToAuthUser(p):null;}
export async function GET(){
  const res=await fetch(\`\${S}/rest/v1/income_types?is_active=eq.true&order=name.asc&select=id,name,category\`,{headers:h()});
  const data=await res.json();
  return NextResponse.json({data:{types:Array.isArray(data)?data:[]},error:null});
}
export async function POST(req:Request){
  const user=await getUser(req);if(!user)return NextResponse.json({data:null,error:{message:'Unauthorized'}},{status:401});
  const body=await req.json();const{name,category}=body;
  const res=await fetch(\`\${S}/rest/v1/income_types\`,{method:'POST',headers:{...h(),'Prefer':'return=representation'},body:JSON.stringify({name,category:category||'general'})});
  const data=await res.json();
  return NextResponse.json({data:Array.isArray(data)?data[0]:data,error:null},{status:201});
}
