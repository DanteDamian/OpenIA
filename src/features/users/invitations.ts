import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recoveryClient,recoveryConfiguration } from "@/lib/auth/recovery";
import { json } from "@/lib/auth/http";
export async function sendInvitation(client:SupabaseClient,organizationId:string,email:string,role:string,id?:string) {
  const admin=createSupabaseAdminClient();
  const config=recoveryConfiguration();
  if (!admin || !config) return json({error:"El envío de invitaciones no está habilitado. Falta configurar la conexión de administración de Auth en el servidor."},503);
  const {data,error}=await client.rpc("prepare_organization_invitation",{target_organization:organizationId,target_email:email,new_role:role,invitation_id:id || null});
  if (error || !data?.[0]) return json({error:error?.code==="P0001" ? "Espera un minuto antes de reenviar o intenta más tarde si alcanzaste el límite." : error?.code==="23505" ? "Esta cuenta ya tiene acceso a la empresa. Edita su acceso en la lista de usuarios." : "No fue posible preparar la invitación."},error?.code==="42501" ? 403 : error?.code==="P0001" ? 429 : 400);
  const invitation=data[0] as {id:string;email:string};
  let succeeded=false;
  try {
    const redirectTo=`${config.origin}/invitacion/${invitation.id}`;
    const result=await admin.auth.admin.inviteUserByEmail(invitation.email,{redirectTo});
    if (!result.error) succeeded=true;
    else if (["email_exists","user_already_exists"].includes(result.error.code || "")) {
      // Cuentas existentes: verificar posesión del correo, sin abrir registro público.
      const {error}=await recoveryClient(config).auth.signInWithOtp({email:invitation.email,options:{shouldCreateUser:false,emailRedirectTo:redirectTo}});
      succeeded=!error;
    }
  } catch { /* No registrar destinatarios, claves ni errores del proveedor. */ }
  const delivery=await client.rpc("record_organization_invitation_delivery",{target_organization:organizationId,invitation_id:invitation.id,succeeded});
  if (!succeeded) return json({error:"No se pudo enviar el correo. La invitación queda pendiente de reenvío en la lista."},502);
  if (delivery.error) return json({error:"El correo se procesó, pero no pudimos confirmar su estado. Revisa la lista antes de reenviar."},503);
  return json({success:true,message:"Invitación enviada. La persona debe abrir el correo y establecer su contraseña."});
}
