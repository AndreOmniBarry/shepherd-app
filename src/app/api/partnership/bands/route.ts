
import { NextResponse } from 'next/server';
const S=process.env.NEXT_PUBLIC_SUPABASE_URL!,K=process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h=()=>({'apikey':K,'Authorization':\`Bearer \${K}\`});
export async function GET(){
  const res=await fetch(\`\${S}/rest/v1/partnership_bands?order=sort_order.asc&select=id,name,amount,color\`,{headers:h()});
  const data=await res.json();
  return NextResponse.json({data:{bands:Array.isArray(data)?data:[]},error:null});
}
