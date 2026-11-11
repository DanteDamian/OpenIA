import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {sourceSeeds,aigenterraServices} from "@/lib/radar/sources";
import {scanRadar} from "@/lib/radar/scan";
export const maxDuration=60;
export async function GET(request:Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret || request.headers.get("authorization")!==`Bearer ${secret}`)
  return NextResponse.json({error:"Cron no autorizado"},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key) return NextResponse.json({error:"Conexión administrativa no configurada"},{status:503});
 // Secret remains server-side; no public client and no user-supplied target URL.
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:organizations,error}=await db.from("organizations").select("id").order("created_at").limit(2);
 if(error) return NextResponse.json({error:"No se pudieron consultar las organizaciones"},{status:503});
 const results=[];
 for(const org of organizations||[]) {
  const {error:seedError}=await db.from("radar_sources").upsert(
    sourceSeeds.map(s=>({...s,organization_id:org.id})),{onConflict:"organization_id,official_url",ignoreDuplicates:true});
  if(seedError){results.push({organization:org.id,status:"catalog_error"});continue;}
  await db.from("radar_services").upsert(
    aigenterraServices.map(name=>({organization_id:org.id,name,category:"Portafolio por validar"})),
    {onConflict:"organization_id,name",ignoreDuplicates:true});
  const response=await scanRadar(db,org.id);
  const result=await response.json();
  results.push({organization:org.id,status:result.status,checked:result.checked,discovered:result.discovered,verified:result.verified});
 }
 return NextResponse.json({organizations:results.length,results});
}
