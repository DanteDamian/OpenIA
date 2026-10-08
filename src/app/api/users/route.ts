import { getAccess } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/validation";
import { boundedJson,json } from "@/lib/auth/http";
import { memberInput } from "@/features/users/validation";
async function write(request:Request,editing:boolean) {
  if (!sameOrigin(request)) return json({error:"Origen no autorizado."},403);
  const access=await getAccess();
  if (access.status!=="authorized") return json({error:"Sesión no autorizada."},401);
  if (access.role!=="admin") return json({error:"Solo administradores pueden gestionar usuarios."},403);
  const input=memberInput(await boundedJson(request),editing);
  if (!input) return json({error:"Datos inválidos."},400);
  const {error}=editing && "user_id" in input
    ? await access.supabase.rpc("change_organization_member",{target_organization:access.organizationId,target_user:input.user_id,new_role:input.role_id,new_active:input.is_active})
    : await access.supabase.rpc("add_organization_member",{target_organization:access.organizationId,target_email:input.email,new_role:input.role_id});
  if (error) return json({error:error.code === "23514" ? "Debe permanecer al menos un administrador activo." : "No fue posible guardar. Verifica que la cuenta esté confirmada y no esté vinculada ya."},error.code === "42501" ? 403 : 400);
  return json({success:true});
}
export async function POST(request:Request) {return write(request,false);}
export async function PATCH(request:Request) {return write(request,true);}
