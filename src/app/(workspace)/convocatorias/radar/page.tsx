import Link from "next/link";
import {requireAccess} from "@/lib/auth/session";
import {RadarActions} from "@/features/radar/radar-actions";
import {directSecopUrl} from "@/lib/radar/secop-details";
export const dynamic="force-dynamic";
type RadarItem={id:string;source_id:string;title:string;description:string|null;country:string;issuer_name:string|null;published_on:string|null;deadline_on:string|null;budget:number|null;currency:string|null;duration_value:number|null;duration_unit:string|null;service_name:string|null;match_score:number|null;verification_status:string;official_url:string;priority:string|null;match_reason:string|null};
type Source={id:string;name:string;country:string;technical_status:string;last_result:string|null;enabled:boolean;last_checked_at:string|null};
type Run={id:string;status:string;started_at:string;checked_sources:number;discovered:number;verified:number;error_summary:string|null};
export default async function RadarPage(){
 const a=await requireAccess();
 const org=a.organizationId,db=a.supabase;
 const [opps,sources,runs]=await Promise.all([
  db.from("radar_opportunities").select("id,source_id,title,description,country,issuer_name,published_on,deadline_on,budget,currency,duration_value,duration_unit,service_name,match_score,verification_status,official_url,priority,match_reason").eq("organization_id",org).order("created_at",{ascending:false}).limit(100),
  db.from("radar_sources").select("id,name,country,technical_status,last_result,enabled,last_checked_at").eq("organization_id",org).order("country").limit(100),
  db.from("radar_runs").select("id,status,started_at,checked_sources,discovered,verified,error_summary").eq("organization_id",org).order("started_at",{ascending:false}).limit(1)
 ]);
 const entries=(opps.data||[]) as RadarItem[],catalog=(sources.data||[]) as Source[],recent=(runs.data||[])[0] as Run|undefined;
 const error=opps.error||sources.error||runs.error;
 const verified=entries.filter(x=>x.verification_status==="Verificada abierta").length;
 return <main className="space-y-6">
  <p className="eyebrow">CONVOCATORIAS / INTELIGENCIA COMERCIAL</p>
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-semibold">Radar GeoIA</h1><p className="mt-2 text-slate-600">Descubrimiento de fuentes oficiales. La coincidencia temática no certifica elegibilidad ni apertura.</p></div><Link href="/convocatorias" className="text-teal-800 underline">Mis convocatorias</Link></div>
  <div className="flex flex-wrap items-center gap-4"><RadarActions canRun={["admin","manager"].includes(a.role)}/><Link href="/convocatorias/radar/fuentes" className="text-teal-800 underline">Administrar fuentes ↗</Link></div>
  {error&&<p role="alert" className="card p-4 text-red-800">El Radar requiere su migración de base de datos o un permiso válido.</p>}
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
  {([{label:"Candidatos detectados",value:entries.length},{label:"Abiertas verificadas",value:verified},{label:"Fuentes registradas",value:catalog.length},{label:"Fuentes con error",value:catalog.filter(s=>s.technical_status==="error").length}]).map(x=><div className="card p-4" key={x.label}><div className="text-sm text-slate-600">{x.label}</div><div className="mt-2 text-2xl font-semibold">{x.value}</div></div>)}
  </div>
  {recent&&<section className="card p-5"><h2 className="font-semibold">Última ejecución</h2><p className="mt-2 text-sm">{recent.started_at.slice(0,19).replace("T"," ")} UTC · {recent.status} · {recent.checked_sources} fuentes consultadas · {recent.discovered} novedades · {recent.verified} verificadas</p>{recent.error_summary&&<p role="alert" className="mt-2 text-sm text-red-700">{recent.error_summary}</p>}</section>}
  <section className="card overflow-x-auto p-5"><h2 className="mb-3 text-lg font-semibold">Oportunidades descubiertas</h2>
   <p className="mb-3 text-sm text-slate-600">Objeto, presupuesto base estimado, duración reportada y posible servicio de AIGENTERRA. Estos datos no prueban elegibilidad, contratación ni apertura.</p>
   {!entries.length?<p className="text-sm text-slate-600">Todavía no hay oportunidades verificadas ni candidatas. Inicializa el catálogo y ejecuta una búsqueda real.</p>
   :<table className="w-full min-w-[1100px] text-left text-sm"><thead><tr>{["Convocatoria y objeto","País","Publicación","Vencimiento","Presupuesto base","Duración estimada","Servicio AIGENTERRA posible","Compatibilidad","Verificación","Fuente / proceso específico"].map(x=><th className="border-b p-2 align-top" key={x}>{x}</th>)}</tr></thead>
   <tbody>{entries.map(x=>{
     const link=directSecopUrl(x.official_url);
     const rowRecord=(()=>{try {const u=new URL(x.official_url);return u.hostname==="www.datos.gov.co" && u.pathname==="/resource/p6dx-8zbt.json" && !!u.searchParams.get("id_del_proceso")?u.toString():null;}catch{return null;}})();
     const budget=x.budget!==null && Number.isFinite(x.budget)?new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(x.budget):"No especificado";
     return <tr key={x.id} className="border-b">
       <td className="min-w-64 max-w-96 p-2 align-top"><span className="font-medium">{x.title}</span>
         <p className="text-xs text-slate-500">{x.issuer_name||"Entidad no identificada"}</p>
         {x.description?<details className="mt-2"><summary className="cursor-pointer text-sm text-slate-700">{x.description.length>180?x.description.slice(0,180)+"…":x.description}{x.description.length>180?" Ver objeto completo":""}</summary>
           {x.description.length>180&&<p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{x.description}</p>}</details>:<p className="mt-1 text-slate-500">Objeto no especificado</p>}
       </td>
       <td className="p-2 align-top">{x.country}</td>
       <td className="p-2 align-top">{x.published_on||"No especificada"}</td>
       <td className="p-2 align-top">{x.deadline_on||"No especificada"}</td>
       <td className="p-2 align-top">{budget}<p className="text-xs text-slate-500">No es un pago garantizado</p></td>
       <td className="p-2 align-top">{x.duration_value!==null?x.duration_value+" "+(x.duration_unit||"unidades sin confirmar"):"No especificada"}</td>
       <td className="p-2 align-top">{x.service_name||"Por evaluar"}<p className="text-xs text-slate-500">Sugerencia temática, no elegibilidad</p></td>
       <td className="p-2 align-top" title={x.match_reason||""}>{x.match_score??"Pendiente"}/100</td>
       <td className="p-2 align-top">{x.verification_status}</td>
       <td className="p-2 align-top"><p className="mb-1 text-xs text-slate-500">{catalog.find(source=>source.id===x.source_id)?.name||"Fuente oficial"}</p>{link?<a href={link} target="_blank" rel="noopener noreferrer" className="text-teal-800 underline">Ver proceso SECOP ↗</a>:
          rowRecord?<a href={rowRecord} target="_blank" rel="noopener noreferrer" className="text-teal-800 underline">Ver registro individual ↗</a>:
          <span className="text-slate-500">Sin enlace individual comprobado</span>}</td>
     </tr>;
   })}</tbody></table>}
  </section>
  <section className="card overflow-x-auto p-5"><h2 className="mb-3 text-lg font-semibold">Fuentes registradas</h2>{!catalog.length?<p className="text-sm text-slate-600">Catálogo pendiente de inicialización.</p>:<table className="w-full text-left text-sm"><thead><tr><th className="p-2">Fuente</th><th className="p-2">País</th><th className="p-2">Automatización</th><th className="p-2">Estado técnico</th></tr></thead><tbody>{catalog.map(x=><tr key={x.id} className="border-t"><td className="p-2">{x.name}</td><td className="p-2">{x.country}</td><td className="p-2">{x.enabled?"Habilitada":"Pendiente de adaptador"}</td><td className="p-2">{x.technical_status}</td></tr>)}</tbody></table>}</section>
 </main>;
}
