import {getAccess} from "@/lib/auth/session";
import {sameOrigin} from "@/lib/auth/validation";
import {boundedJson,json} from "@/lib/auth/http";
import {kanbanTransition} from "@/lib/kanban/model";

/** Moves only the existing status field; never overwrites assignments, hour entries,
 * work item details or a newer status chosen by another colleague. */
export async function PATCH(request:Request){
 if(!sameOrigin(request))return json({error:"Origen no autorizado."},403);
 const access=await getAccess();
 if(access.status!=="authorized")return json({error:"Acceso no autorizado."},401);
 if(!["admin","manager"].includes(access.role))return json({error:"Permisos insuficientes para mover actividades."},403);
 const move=kanbanTransition(await boundedJson(request));
 if(!move)return json({error:"Cambio de estado inválido."},400);
 const {data:project,error:projectError}=await access.supabase.from("projects").select("id,status")
  .eq("organization_id",access.organizationId).eq("id",move.projectId).maybeSingle();
 if(projectError)return json({error:"No se pudo validar el proyecto."},503);
 if(!project)return json({error:"El proyecto no pertenece a la empresa."},404);
 if(["completed","cancelled"].includes(project.status))return json({error:"El proyecto está cerrado. No se pueden mover actividades."},409);
 const {data,error}=await access.supabase.from("project_work_items")
  .update({status:move.to})
  .eq("id",move.id).eq("organization_id",access.organizationId)
  .eq("project_id",move.projectId).eq("status",move.from)
  .select("id,status,updated_at").maybeSingle();
 if(error)return json({error:"No se pudo guardar el cambio de estado."},400);
 if(!data)return json({error:"La actividad cambió desde otra sesión. Actualiza el tablero."},409);
 return json({item:data});
}
