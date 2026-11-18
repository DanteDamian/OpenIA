import {getAccess} from "@/lib/auth/session";
import {sameOrigin} from "@/lib/auth/validation";
import {boundedJson,json} from "@/lib/auth/http";
import {budgetInput} from "@/lib/seguimiento/model";
export async function PATCH(request:Request){
 if(!sameOrigin(request))return json({error:"Origen no autorizado."},403);
 const a=await getAccess();
 if(a.status!=="authorized"||!["admin","manager"].includes(a.role))return json({error:"Sin permiso."},403);
 const input=budgetInput(await boundedJson(request));
 if(!input)return json({error:"Revisa las horas contratadas y las observaciones."},400);
 const {data:project,error:e}=await a.supabase.from("projects").select("id").eq("organization_id",a.organizationId).eq("id",input.project_id).maybeSingle();
 if(e||!project)return json({error:"Proyecto no disponible."},404);
 const {data,error}=await a.supabase.from("project_hour_settings").upsert({...input,organization_id:a.organizationId,
  updated_at:new Date().toISOString()},{onConflict:"organization_id,project_id"}).select("project_id").single();
 return error?json({error:"No se pudieron guardar las horas contratadas."},400):json({project_id:data.project_id});
}
