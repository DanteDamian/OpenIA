import { getAccess } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/validation";
import { boundedJson,json } from "@/lib/auth/http";
import { sendInvitation } from "@/features/users/invitations";
import { memberInput } from "@/features/users/validation";
async function write(request:Request,editing:boolean) {
  if (!sameOrigin(request)) return json({error:"Origen no autorizado."},403);
  const access=await getAccess();
  if (access.status!=="authorized") return json({error:"Sesión no autorizada."},401);
  if (access.role!=="admin") return json({error:"Solo administradores pueden gestionar usuarios."},403);
  const input=memberInput(await boundedJson(request),editing);
  if (!input) return json({error:"Datos inválidos."},400);
  if (!editing && "email" in input) return sendInvitation(access.supabase,access.organizationId,input.email!,input.role_id);
  if (!("user_id" in input)) return json({error:"Datos inválidos."},400);
  const {error}=await access.supabase.rpc("change_organization_member",{target_organization:access.organizationId,target_user:input.user_id,new_role:input.role_id,new_active:input.is_active});
  if (error) return json({error:error.code === "23514" ? "Debe permanecer al menos un administrador activo." : "No fue posible actualizar el acceso. Verifica tu sesión e intenta nuevamente."},error.code === "42501" ? 403 : 400);
  return json({success:true});
}
export async function POST(request:Request) {return write(request,false);}
export async function PATCH(request:Request) {return write(request,true);}
