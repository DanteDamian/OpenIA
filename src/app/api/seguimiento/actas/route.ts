import {getAccess} from "@/lib/auth/session";
import {sameOrigin} from "@/lib/auth/validation";
import {boundedJson,json} from "@/lib/auth/http";
import {actPeriod} from "@/lib/seguimiento/model";
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:"Origen no autorizado."},403);
 const a=await getAccess();
 if(a.status!=="authorized"||!["admin","manager"].includes(a.role))return json({error:"Sin permiso para emitir actas."},403);
 const input=actPeriod(await boundedJson(request));
 if(!input)return json({error:"Selecciona un proyecto y un periodo válido."},400);
 const {data:project,error:e}=await a.supabase.from("projects").select("id").eq("organization_id",a.organizationId).eq("id",input.project_id).maybeSingle();
 if(e||!project)return json({error:"Proyecto no encontrado."},404);
 const {data,error}=await a.supabase.rpc("issue_project_hour_act",{
  p_organization:a.organizationId,p_project:input.project_id,p_from:input.from,p_to:input.to
 });
 if(error||!data)return json({error:"No fue posible emitir el acta. Verifica que existan horas aprobadas, pendientes y dentro del periodo."},409);
 return json({act_id:data},201);
}
