import Link from "next/link";
import {requireAccess} from "@/lib/auth/session";
import {fmtHours} from "@/lib/seguimiento/model";
export const dynamic="force-dynamic";
export default async function Seguimiento(){
 const a=await requireAccess();
 const org=a.organizationId,db=a.supabase;
 const [projects,settings,entries,acts,clients]=await Promise.all([
  db.from("projects").select("id,name,status,client_id,contract_id,starts_on,ends_on").eq("organization_id",org).order("name").limit(300),
  db.from("project_hour_settings").select("project_id,contracted_hours").eq("organization_id",org).limit(300),
  db.from("project_time_entries").select("project_id,hours,status,act_id").eq("organization_id",org).limit(5000),
  db.from("project_hour_acts").select("project_id,total_hours").eq("organization_id",org).limit(2000),
  db.from("clients").select("id,legal_name").eq("organization_id",org).limit(300)
 ]);
 const error=projects.error||settings.error||entries.error||acts.error||clients.error;
 const rows=projects.data||[];
 const clientNames=new Map((clients.data||[]).map(x=>[x.id,x.legal_name]));
 const budgets=new Map((settings.data||[]).map(x=>[x.project_id,x.contracted_hours]));
 const totals=new Map<string,{draft:number;approved:number;acts:number}>();
 for(const row of entries.data||[]){
  const stat=totals.get(row.project_id)||{draft:0,approved:0,acts:0};
  stat[row.status==="approved"?"approved":"draft"]+=Number(row.hours);totals.set(row.project_id,stat);
 }
 for(const act of acts.data||[]){
  const stat=totals.get(act.project_id)||{draft:0,approved:0,acts:0};
  stat.acts++;totals.set(act.project_id,stat);
 }
 return <main className="space-y-6">
  <p className="eyebrow">SERVICIOS PROFESIONALES / CONTROL DE EJECUCIÓN</p>
  <div className="flex flex-wrap items-start justify-between gap-4">
   <div><h1 className="text-3xl font-semibold">Seguimiento de actividades y horas</h1>
    <p className="mt-2 text-slate-600">Proyectos existentes, horas ejecutadas, validación de consumos y actas por proyecto.</p></div>
   <Link href="/proyectos" className="text-teal-800 underline">Administrar proyectos ↗</Link>
  </div>
  {error?<p role="alert" className="card p-5 text-red-700">No fue posible consultar las horas. Comprueba la migración y los permisos.</p>:
   !rows.length?<section className="card p-6"><h2 className="text-xl font-semibold">No hay proyectos creados todavía</h2>
    <p className="mt-3 text-slate-600">Crea un cliente y un proyecto en los módulos existentes; cuando aparezca aquí podrás registrar actividades, horas contratadas y actas sin duplicar información.</p>
    <Link href="/proyectos" className="mt-4 inline-block text-teal-800 underline">Crear o consultar proyectos →</Link></section>:
   <section className="card overflow-x-auto p-5"><h2 className="mb-4 text-lg font-semibold">Portafolio en seguimiento</h2>
    <table className="w-full min-w-[850px] text-left text-sm"><thead><tr>{["Proyecto","Cliente","Estado","Horas contratadas","Aprobadas","Por aprobar","Saldo","Actas","Acción"].map(x=><th scope="col" className="border-b p-3" key={x}>{x}</th>)}</tr></thead>
    <tbody>{rows.map(project=>{
      const t=totals.get(project.id)||{draft:0,approved:0,acts:0};
      const budget=budgets.get(project.id),remaining=budget==null?null:Number(budget)-t.approved;
      return <tr key={project.id} className="border-b"><td className="p-3 font-semibold">{project.name}</td>
       <td className="p-3">{clientNames.get(project.client_id)||"Sin registrar"}</td>
       <td className="p-3">{project.status}</td><td className="p-3">{budget==null?"Sin definir":fmtHours(budget)}</td>
       <td className="p-3">{fmtHours(t.approved)}</td><td className="p-3">{fmtHours(t.draft)}</td>
       <td className={"p-3 "+(remaining!==null&&remaining<0?"font-semibold text-red-700":"")}>{remaining==null?"Sin definir":fmtHours(remaining)}</td>
       <td className="p-3">{t.acts}</td>
       <td className="p-3"><Link className="text-teal-800 underline" href={"/seguimiento/"+project.id}>Ver seguimiento</Link></td>
      </tr>;
    })}</tbody></table>
   </section>}
  <section className="card p-5 text-sm text-slate-600"><strong>Control documental.</strong> Los borradores no aparecen en actas; solo pueden emitirse actas con horas aprobadas y todavía no incorporadas a otro documento. Las firmas y la aceptación del cliente son posteriores a la emisión y no se presumen.</section>
 </main>;
}
