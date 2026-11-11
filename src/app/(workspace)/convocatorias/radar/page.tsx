import Link from "next/link";
import {requireAccess} from "@/lib/auth/session";
import {RadarActions} from "@/features/radar/radar-actions";
export const dynamic="force-dynamic";
type RadarItem={id:string;title:string;country:string;issuer_name:string|null;published_on:string|null;deadline_on:string|null;match_score:number|null;verification_status:string;official_url:string;priority:string|null;match_reason:string|null};
type Source={id:string;name:string;country:string;technical_status:string;last_result:string|null;enabled:boolean;last_checked_at:string|null};
type Run={id:string;status:string;started_at:string;checked_sources:number;discovered:number;verified:number;error_summary:string|null};
export default async function RadarPage(){
 const a=await requireAccess();
 const org=a.organizationId,db=a.supabase;
 const [opps,sources,runs]=await Promise.all([
  db.from("radar_opportunities").select("id,title,country,issuer_name,published_on,deadline_on,match_score,verification_status,official_url,priority,match_reason").eq("organization_id",org).order("created_at",{ascending:false}).limit(100),
  db.from("radar_sources").select("id,name,country,technical_status,last_result,enabled,last_checked_at").eq("organization_id",org).order("country").limit(100),
  db.from("radar_runs").select("id,status,started_at,checked_sources,discovered,verified,error_summary").eq("organization_id",org).order("started_at",{ascending:false}).limit(1)
 ]);
 const entries=(opps.data||[]) as RadarItem[],catalog=(sources.data||[]) as Source[],recent=(runs.data||[])[0] as Run|undefined;
 const error=opps.error||sources.error||runs.error;
 const verified=entries.filter(x=>x.verification_status==="Verificada abierta").length;
 return <main className="space-y-6">
  <p className="eyebrow">CONVOCATORIAS / INTELIGENCIA COMERCIAL</p>
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-semibold">Radar GeoIA</h1><p className="mt-2 text-slate-600">Descubrimiento de fuentes oficiales. La coincidencia temática no certifica elegibilidad ni apertura.</p></div><Link href="/convocatorias" className="text-teal-800 underline">Mis convocatorias</Link></div>
  <RadarActions canRun={["admin","manager"].includes(a.role)}/>
  {error&&<p role="alert" className="card p-4 text-red-800">El Radar requiere su migración de base de datos o un permiso válido.</p>}
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
  {([{label:"Candidatos detectados",value:entries.length},{label:"Abiertas verificadas",value:verified},{label:"Fuentes registradas",value:catalog.length},{label:"Fuentes con error",value:catalog.filter(s=>s.technical_status==="error").length}]).map(x=><div className="card p-4" key={x.label}><div className="text-sm text-slate-600">{x.label}</div><div className="mt-2 text-2xl font-semibold">{x.value}</div></div>)}
  </div>
  {recent&&<section className="card p-5"><h2 className="font-semibold">Última ejecución</h2><p className="mt-2 text-sm">{recent.started_at.slice(0,19).replace("T"," ")} UTC · {recent.status} · {recent.checked_sources} fuentes consultadas · {recent.discovered} novedades · {recent.verified} verificadas</p>{recent.error_summary&&<p role="alert" className="mt-2 text-sm text-red-700">{recent.error_summary}</p>}</section>}
  <section className="card overflow-x-auto p-5"><h2 className="mb-3 text-lg font-semibold">Oportunidades descubiertas</h2>{!entries.length?<p className="text-sm text-slate-600">Todavía no hay oportunidades verificadas ni candidatas. Inicializa el catálogo y ejecuta una búsqueda real.</p>:<table className="w-full text-left text-sm"><thead><tr>{["Convocatoria","País","Fecha de publicación","Vencimiento","Compatibilidad","Verificación","Fuente"].map(x=><th className="border-b p-2" key={x}>{x}</th>)}</tr></thead><tbody>{entries.map(x=><tr key={x.id} className="border-b"><td className="max-w-72 p-2"><span className="font-medium">{x.title}</span><p className="text-xs text-slate-500">{x.issuer_name||"Entidad no identificada"}</p></td><td className="p-2">{x.country}</td><td className="p-2">{x.published_on||"No especificada"}</td><td className="p-2">{x.deadline_on||"No especificada"}</td><td className="p-2" title={x.match_reason||""}>{x.match_score??"Pendiente"}/100</td><td className="p-2">{x.verification_status}</td><td className="p-2"><a href={x.official_url} target="_blank" rel="noopener noreferrer" className="text-teal-800 underline">Fuente oficial</a></td></tr>)}</tbody></table>}</section>
  <section className="card overflow-x-auto p-5"><h2 className="mb-3 text-lg font-semibold">Fuentes registradas</h2>{!catalog.length?<p className="text-sm text-slate-600">Catálogo pendiente de inicialización.</p>:<table className="w-full text-left text-sm"><thead><tr><th className="p-2">Fuente</th><th className="p-2">País</th><th className="p-2">Automatización</th><th className="p-2">Estado técnico</th></tr></thead><tbody>{catalog.map(x=><tr key={x.id} className="border-t"><td className="p-2">{x.name}</td><td className="p-2">{x.country}</td><td className="p-2">{x.enabled?"Habilitada":"Pendiente de adaptador"}</td><td className="p-2">{x.technical_status}</td></tr>)}</tbody></table>}</section>
 </main>;
}
