import { getAccess } from "@/lib/auth/session";
import { sameOrigin,validUuid } from "@/lib/auth/validation";
import { json } from "@/lib/auth/http";
import { sendInvitation } from "@/features/users/invitations";
async function action(request:Request,id:string,cancel:boolean) {
 if (!sameOrigin(request)) return json({error:"Origen no autorizado."},403);
 const access=await getAccess();
 if (access.status!=="authorized") return json({error:"Sesión no autorizada."},401);
 if (access.role!=="admin") return json({error:"Solo administradores pueden gestionar invitaciones."},403);
 if (!validUuid(id)) return json({error:"Invitación no disponible."},404);
 if (cancel) {
  const {error}=await access.supabase.rpc("cancel_organization_invitation",{target_organization:access.organizationId,invitation_id:id});
  return error ? json({error:"No fue posible cancelar la invitación."},400) : json({success:true});
 }
 const {data,error}=await access.supabase.rpc("list_organization_invitations",{target_organization:access.organizationId});
 const invitation=data?.find((item:{id:string})=>item.id===id);
 if (error || !invitation) return json({error:"Invitación no disponible."},404);
 return sendInvitation(access.supabase,access.organizationId,invitation.email,invitation.role_id,id);
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {return action(request,(await params).id,false);}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}) {return action(request,(await params).id,true);}
