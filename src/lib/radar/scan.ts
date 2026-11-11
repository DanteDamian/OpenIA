import {topicPattern} from "@/lib/radar/sources";
import {directSecopUrl,secopBudget,secopDuration,suggestedService} from "@/lib/radar/secop-details";
import {NextResponse} from "next/server";
import type {SupabaseClient} from "@supabase/supabase-js";
type SecopRow=Record<string,unknown>;
const clean=(v:unknown,limit=1000)=>typeof v==="string"?v.trim().slice(0,limit):"";
function day(v:unknown):string|null {const s=clean(v,32).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;}
export async function scanRadar(db:SupabaseClient,org:string) {
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
       const description=clean(item.descripci_n_del_procedimiento,2000);
       // SECOP publishes a direct public notice URL in the URLProceso field.
       // Never fabricate a noticeUID or treat the dataset URL as a process link.
       const directUrl=directSecopUrl(item.urlproceso);
       const budget=secopBudget(item);
       const duration=secopDuration(item);
       const service=suggestedService(title,description);
       const deadline=day(item.fecha_de_recepcion_de_respuestas)||day(item.fecha_de_presentacion_de_ofertas);
       const score=35+15+(deadline && deadline>today?10:0);
       const {data:existing,error:existingError}=await db.from("radar_opportunities")
         .select("id,official_url,normalized_url")
         .eq("organization_id",org).eq("source_id",src.id).eq("official_id",id).maybeSingle();
       if(existingError) {errors.push("No se pudo consultar una oportunidad existente");continue;}
       // No overwrite of human decisions: verification, priority, responsible,
       // comments, eligibility and associated CRM record remain untouched.
       const officialLink=directUrl||null;
       const details={
         description, issuer_name:clean(item.entidad,200)||null,
         ...(officialLink?{official_url:officialLink}:{}),
         ...(budget!==null?{budget,currency:"COP"}:{}),
         ...(duration.value!==null?{duration_value:duration.value,duration_unit:duration.unit}:{}),
         ...(service?{service_name:service}:{}),
         last_checked_at:new Date().toISOString()
       };
       if(existing) {
         const {error:updateError}=await db.from("radar_opportunities").update(details)
           .eq("organization_id",org).eq("id",existing.id);
         if(updateError)errors.push("No se pudo enriquecer un proceso existente");
         continue;
       }
       // Official_id is a deterministic key for each record. If the source does
       // not provide a direct URL, use a specific row in the official open dataset,
       // NOT the dataset's aggregated home or search page.
       const fallbackUrl=new URL("https://www.datos.gov.co/resource/p6dx-8zbt.json");
       fallbackUrl.searchParams.set("id_del_proceso",id);
       const exactUrl=fallbackUrl.toString();
       const record={organization_id:org,source_id:src.id,official_id:id,title,description,country:"Colombia",
         issuer_name:clean(item.entidad,200)||null,opportunity_type:"Contratación pública",
         published_on:day(item.fecha_de_publicacion_del),deadline_on:deadline,
         official_url:officialLink||exactUrl,normalized_url:officialLink||exactUrl,
         budget,currency:budget!==null?"COP":null,
         duration_value:duration.value,duration_unit:duration.unit,service_name:service,
         match_score:score,priority:"low",
         match_reason:"Coincidencia temática preliminar: requiere validar objeto, elegibilidad y capacidad de ejecución.",
         verification_status:"Pendiente de verificación",last_checked_at:new Date().toISOString()};
       const {data:added,error:addError}=await db.from("radar_opportunities")
         .upsert(record,{onConflict:"organization_id,normalized_url",ignoreDuplicates:true}).select("id");
       if(addError) {errors.push("No se pudo almacenar un resultado");continue;}
       if(added?.length) {
         discovered++;
         await db.from("radar_evidence").insert({organization_id:org,opportunity_id:added[0].id,
           official_url:officialLink||exactUrl,excerpt:(title+" — "+description).slice(0,1200),
           result:officialLink?"Enlace directo SECOP II presente; no se ha verificado apertura ni elegibilidad":
             "La fuente no suministró un enlace directo al aviso. Enlace individual al registro de datos abiertos."});
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
