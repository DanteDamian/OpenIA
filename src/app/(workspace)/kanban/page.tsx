import Link from "next/link";
import {requireAccess} from "@/lib/auth/session";
import {validUuid} from "@/lib/auth/validation";
import {KanbanBoard} from "@/features/kanban/kanban-board";
import type {KanbanItem} from "@/lib/kanban/model";
export const dynamic="force-dynamic";
export default async function KanbanPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await requireAccess();
 const org=access.organizationId;
 const db=access.supabase;
 const {data:projects,error:projectError}=await db.from("projects")
  .select("id,name,status,client_id").eq("organization_id",org).order("name").limit(300);
 if(projectError)return <p role="alert" className="card p-6 text-red-700">No se pudo consultar el portafolio de proyectos.</p>;
 const options=projects||[];
 const requested=(await searchParams).proyecto;
 const selected=options.find(p=>p.id===requested)||options.find(p=>["active","planned","paused"].includes(p.status))||options[0];
 if(!selected)return <main className="space-y-6"><p className="eyebrow">PROYECTOS / GESTIÓN ÁGIL</p>
  <h1 className="text-3xl font-semibold">Tablero Kanban</h1>
  <div className="card p-7"><h2 className="text-xl font-semibold">Aún no hay proyectos registrados</h2>
   <p className="mt-3 text-slate-600">Para empezar, crea un cliente y un proyecto. Las actividades aparecerán aquí automáticamente sin duplicar registros.</p>
   <Link href="/proyectos" className="mt-4 inline-flex text-teal-800 underline">Ir a proyectos →</Link></div></main>;
 if(!validUuid(selected.id))return <p role="alert">Proyecto inválido.</p>;
 const [workResult,hoursResult,clientResult,profilesResult]=await Promise.all([
  db.from("project_work_items").select("id,project_id,title,description,kind,status,assignee_id,due_on,updated_at")
   .eq("organization_id",org).eq("project_id",selected.id).order("created_at").limit(1000),
  db.from("project_time_entries").select("work_item_id,hours")
   .eq("organization_id",org).eq("project_id",selected.id).limit(5000),
  db.from("clients").select("legal_name").eq("organization_id",org).eq("id",selected.client_id).maybeSingle(),
  db.rpc("list_project_assignees",{target_organization:org}),
 ]);
 const error=workResult.error||hoursResult.error||clientResult.error||profilesResult.error;
 const totalByItem=new Map<string,number>();
 for(const entry of hoursResult.data||[]){
  if(entry.work_item_id)totalByItem.set(entry.work_item_id,(totalByItem.get(entry.work_item_id)||0)+Number(entry.hours));
 }
 const names=new Map((profilesResult.data||[]).map((x:{user_id:string;display_name:string|null})=>[x.user_id,x.display_name ?? "Nombre pendiente"]));
 const items=((workResult.data||[]) as KanbanItem[]).map(item=>({...item,hours_logged:totalByItem.get(item.id)||0}));
 const canEdit=["admin","manager"].includes(access.role)&&!["completed","cancelled"].includes(selected.status);
 return <main className="space-y-6">
  <p className="eyebrow">PROYECTOS / GESTIÓN ÁGIL</p>
  <div className="flex flex-wrap justify-between gap-4">
   <div><h1 className="text-3xl font-semibold">Tablero Kanban</h1>
    <p className="mt-2 text-slate-600">Planifica, ejecuta y finaliza las actividades de cada proyecto. El mismo estado se refleja en el módulo de Actividades.</p></div>
   <div className="flex flex-wrap items-center gap-3">
    <Link className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800" href={"/actividades?project_id="+selected.id}>+ Gestionar actividades</Link>
    <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" href={"/seguimiento/"+selected.id}>Horas y actas ↗</Link>
   </div>
  </div>
  <div className="card flex flex-wrap items-center gap-5 p-5">
   <form method="get" className="flex flex-wrap items-center gap-3">
    <label htmlFor="kanban-project" className="text-sm font-semibold">Proyecto</label>
    <select className="min-w-64 rounded-lg border bg-white p-3 text-sm" id="kanban-project" name="proyecto" defaultValue={selected.id}>
     {options.map(p=><option value={p.id} key={p.id}>{p.name}{["completed","cancelled"].includes(p.status)?" (cerrado)":""}</option>)}
    </select>
    <button className="button-primary" type="submit">Mostrar</button>
   </form>
   <p className="text-sm text-slate-500">Cliente: {clientResult.data?.legal_name||"Sin identificar"} · Proyecto: {selected.status}</p>
  </div>
  {error?<p role="alert" className="card p-6 text-red-700">No se pudieron consultar las actividades, responsables u horas del proyecto.</p>
    :<KanbanBoard key={selected.id} projectId={selected.id} projectName={selected.name}
      items={items} names={Object.fromEntries(names)} canEdit={canEdit}/>}
 </main>;
}
