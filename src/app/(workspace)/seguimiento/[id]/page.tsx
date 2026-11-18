import Link from "next/link";
import {notFound} from "next/navigation";
import {requireAccess} from "@/lib/auth/session";
import {validUuid} from "@/lib/auth/validation";
import {ProjectHours} from "@/features/seguimiento/project-hours";
export const dynamic="force-dynamic";
export default async function ProjectHoursPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!validUuid(id))notFound();
 const a=await requireAccess(),db=a.supabase,org=a.organizationId;
 const {data:project,error}=await db.from("projects").select("id,name,status,client_id,contract_id,starts_on,ends_on")
  .eq("organization_id",org).eq("id",id).maybeSingle();
 if(error||!project)notFound();
 const [activities,entries,acts,settings,client,contract]=await Promise.all([
  db.from("project_work_items").select("id,title,kind,status").eq("organization_id",org).eq("project_id",id).order("created_at").limit(500),
  db.from("project_time_entries").select("id,project_id,work_item_id,activity_date,consultant_name,description,hours,status,act_id").eq("organization_id",org).eq("project_id",id).order("activity_date",{ascending:false}).order("created_at",{ascending:false}).limit(2000),
  db.from("project_hour_acts").select("id,number,period_from,period_to,total_hours,created_at").eq("organization_id",org).eq("project_id",id).order("number",{ascending:false}).limit(200),
  db.from("project_hour_settings").select("contracted_hours,notes").eq("organization_id",org).eq("project_id",id).maybeSingle(),
  db.from("clients").select("legal_name").eq("organization_id",org).eq("id",project.client_id).maybeSingle(),
  project.contract_id?db.from("contracts").select("number,title").eq("organization_id",org).eq("id",project.contract_id).maybeSingle():Promise.resolve({data:null,error:null})
 ]);
 const failed=activities.error||entries.error||acts.error||settings.error||client.error||contract.error;
 return <main className="space-y-6"><Link href="/seguimiento" className="text-sm text-teal-800 underline">← Volver a seguimiento</Link>
  <div><p className="eyebrow">SEGUIMIENTO / PROYECTO</p><h1 className="mt-2 text-3xl font-semibold">{project.name}</h1>
   <p className="mt-2 text-sm text-slate-600">Cliente: {client.data?.legal_name||"Sin registrar"} · Estado: {project.status}
    {contract.data?" · Contrato: "+contract.data.number:" · Sin contrato asociado"}</p></div>
  {failed?<p role="alert" className="card p-6 text-red-700">No fue posible consultar actividades, horas o actas del proyecto.</p>:
   <ProjectHours project={{id:project.id,name:project.name,status:project.status}}
     activities={activities.data||[]} entries={entries.data||[]}
     acts={acts.data||[]} settings={settings.data}
     canEdit={["admin","manager"].includes(a.role)} />}
 </main>;
}
