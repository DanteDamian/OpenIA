import { getAccess } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/validation";
import { topicPattern } from "@/lib/radar/sources";
import { NextResponse } from "next/server";
export const maxDuration=60;
type SecopRow = Record<string,unknown>;
const clean=(v:unknown,limit=1000)=>typeof v==="string"?v.trim().slice(0,limit):"";
function day(v:unknown):string|null {const s=clean(v,32).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;}
export async function POST(request:Request) {
 if(!sameOrigin(request)) return NextResponse.json({error:"Origen no autorizado"},{status:403});
 const a=await getAccess();
 if(a.status!=="authorized" || !["admin","manager"].includes(a.role))
   return NextResponse.json({error:"No autorizado"},{status:403});
 const org=a.organizationId, db=a.supabase;
 const {data:sources,error:sourceError}=await db.from("radar_sources").select("*").eq("organization_id",org).eq("enabled",true).eq("query_method","socrata").limit(3);
 if(sourceError) return NextResponse.json({error:"Fuentes no disponibles"},{status:503});
 if(!sources?.length) return NextResponse.json({error:"Primero inicializa o habilita una fuente compatible."},{status:409});
 const {data:run,error:runError}=await db.from("radar_runs").insert({organization_id:org,status:"running"}).select("id").single();
 if(runError || !run) return NextResponse.json({error:"No fue posible crear ejecución"},{status:503});
 let checked=0,discovered=0; const errors:string[]=[];
 const cutoff=new Date(Date.now()-30*86400_000).toISOString().slice(0,10);
 const today=new Date().toISOString().slice(0,10);
 for(const src of sources) {
   try {
     // Fixed official Socrata endpoint; no user-controlled URLs to prevent SSRF.
     const url=new URL("https://www.datos.gov.co/resource/p6dx-8zbt.json");
     url.searchParams.set("$where",`fecha_de_publicacion_del >= '${cutoff}T00:00:00'`);
     url.searchParams.set("$order","fecha_de_publicacion_del DESC");
     url.searchParams.set("$limit","100");
     const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{"Accept":"application/json"},cache:"no-store"});
     if(!response.ok) throw Error(`HTTP ${response.status}`);
     const payload:unknown=await response.json();
     if(!Array.isArray(payload)) throw Error("Formato oficial inesperado");
     const entries=(payload as SecopRow[]).filter(row=>{
       const title=clean(row.nombre_del_procedimiento,500);
       const description=clean(row.descripci_n_del_procedimiento,1500);
       return topicPattern.test(title+" "+description) && day(row.fecha_de_publicacion_del)!>=cutoff;
     }).slice(0,30);
     for(const item of entries) {
       const id=clean(item.id_del_proceso,160);
       const title=clean(item.nombre_del_procedimiento,300);
       if(!id || !title) continue;
       const link=`https://www.datos.gov.co/Estad-sticas-Nacionales/SECOP-II-Procesos-de-Contrataci-n/p6dx-8zbt?q=${encodeURIComponent(id)}`;
       const description=clean(item.descripci_n_del_procedimiento,2000);
       const deadline=day(item.fecha_de_presentacion_de_ofertas);
       const score=35+15+(deadline && deadline>today?10:0);
       const record={organization_id:org,source_id:src.id,official_id:id,title,description,country:"Colombia",
         issuer_name:clean(item.entidad,200)||null,opportunity_type:"Contratación pública",
         published_on:day(item.fecha_de_publicacion_del),deadline_on:deadline,
         official_url:link,normalized_url:link,match_score:score,priority:"low",
         match_reason:"Coincidencia temática preliminar (35/35), ubicación Colombia (15/15); elegibilidad y viabilidad no comprobadas.",
         verification_status:"Pendiente de verificación",last_checked_at:new Date().toISOString()};
       const {data:added,error:addError}=await db.from("radar_opportunities").upsert(record,{onConflict:"organization_id,normalized_url",ignoreDuplicates:true}).select("id");
       if(addError) {errors.push("No se pudo almacenar un resultado");continue;}
       if(added?.length) {
         discovered++;
         await db.from("radar_evidence").insert({organization_id:org,opportunity_id:added[0].id,
           official_url:link,excerpt:(title+" — "+description).slice(0,1200),
           result:"Detección desde fuente oficial: falta comprobar expediente, fecha límite y elegibilidad"});
       }
     }
     checked++;
     await db.from("radar_sources").update({technical_status:"ok",last_checked_at:new Date().toISOString(),last_result:`${entries.length} coincidencias examinadas`}).eq("organization_id",org).eq("id",src.id);
   } catch(e) {
     errors.push(src.name+": "+(e instanceof Error?e.message:"Error de consulta"));
     await db.from("radar_sources").update({technical_status:"error",last_checked_at:new Date().toISOString(),last_result:"Consulta fallida"}).eq("organization_id",org).eq("id",src.id);
   }
 }
 const finalStatus=errors.length?"failed":"completed";
 await db.from("radar_runs").update({status:finalStatus,finished_at:new Date().toISOString(),checked_sources:checked,discovered,verified:0,error_summary:errors.join("; ").slice(0,1200)||null}).eq("organization_id",org).eq("id",run.id);
 return NextResponse.json({run_id:run.id,status:finalStatus,checked,discovered,verified:0,errors});
}
