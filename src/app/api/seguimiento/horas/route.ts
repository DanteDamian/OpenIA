import {getAccess} from "@/lib/auth/session";
import {sameOrigin,validUuid} from "@/lib/auth/validation";
import {boundedJson,json} from "@/lib/auth/http";
import {hourInput} from "@/lib/seguimiento/model";
async function authorized(request:Request){
 if(!sameOrigin(request))return null;
 const a=await getAccess();
 return a.status==="authorized"&&["admin","manager"].includes(a.role)?a:null;
}
async function checkProject(a:NonNullable<Awaited<ReturnType<typeof authorized>>>,project:string){
 const {data,error}=await a.supabase.from("projects").select("id,status").eq("organization_id",a.organizationId).eq("id",project).maybeSingle();
 return !error&&data&&!["completed","cancelled"].includes(data.status);
}
async function checkActivity(a:NonNullable<Awaited<ReturnType<typeof authorized>>>,project:string,activity:string|null){
 if(!activity)return true;
 const {data,error}=await a.supabase.from("project_work_items").select("id").eq("organization_id",a.organizationId).eq("project_id",project).eq("id",activity).maybeSingle();
 return !error&&!!data;
}
export async function POST(request:Request){
 const a=await authorized(request);
 if(!a)return json({error:"Sin permiso."},403);
 const input=hourInput(await boundedJson(request));
 if(!input)return json({error:"Revisa proyecto, actividad, fecha y horas (máximo 24 por registro)."},400);
 if(!await checkProject(a,input.project_id))return json({error:"Proyecto no disponible o cerrado."},400);
 if(!await checkActivity(a,input.project_id,input.work_item_id))return json({error:"La actividad no corresponde al proyecto."},400);
 const {data,error}=await a.supabase.from("project_time_entries").insert({...input,organization_id:a.organizationId,
  created_by:a.userId,status:"draft"}).select("id").single();
 return error?json({error:"No fue posible registrar las horas."},400):json({id:data.id},201);
}
export async function PATCH(request:Request){
 const a=await authorized(request);
 if(!a)return json({error:"Sin permiso."},403);
 const id=new URL(request.url).searchParams.get("id");
 if(!validUuid(id))return json({error:"Registro inválido."},400);
 const raw=await boundedJson(request);
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return json({error:"Datos inválidos."},400);
 const row=raw as Record<string,unknown>;
 const {data:old,error:lookupError}=await a.supabase.from("project_time_entries").select("id,project_id,act_id,status")
  .eq("organization_id",a.organizationId).eq("id",id).maybeSingle();
 if(lookupError||!old)return json({error:"Registro no disponible."},404);
 if(old.act_id)return json({error:"El registro pertenece a un acta emitida y no se puede modificar."},409);
 if(row.action==="approve"||row.action==="reopen"){
  if(Object.keys(row).length!==1)return json({error:"Acción no válida."},400);
  const approve=row.action==="approve";
  const {data,error}=await a.supabase.from("project_time_entries").update({
   status:approve?"approved":"draft",approved_by:approve?a.userId:null,approved_at:approve?new Date().toISOString():null,updated_at:new Date().toISOString()
  }).eq("organization_id",a.organizationId).eq("id",id).is("act_id",null).select("id").maybeSingle();
  return error||!data?json({error:"No fue posible cambiar la aprobación."},409):json({id:data.id});
 }
 if(row.action!=="edit"||old.status!=="draft")return json({error:"Solo se pueden editar borradores."},409);
 const {action:_,...payload}=row;
 const input=hourInput(payload);
 if(!input||input.project_id!==old.project_id)return json({error:"Datos o proyecto inválidos."},400);
 if(!await checkProject(a,old.project_id)||!await checkActivity(a,old.project_id,input.work_item_id))
  return json({error:"Proyecto cerrado o actividad inválida."},400);
 const {data,error}=await a.supabase.from("project_time_entries").update({...input,updated_at:new Date().toISOString()})
  .eq("organization_id",a.organizationId).eq("id",id).eq("status","draft").is("act_id",null).select("id").maybeSingle();
 return error||!data?json({error:"No se pudo editar."},400):json({id:data.id});
}
