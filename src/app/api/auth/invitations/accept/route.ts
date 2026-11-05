import { cookies } from "next/headers";
import { boundedJson,json } from "@/lib/auth/http";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { recoveryConfiguration,recoveryClient } from "@/lib/auth/recovery";
import { invitationCookie,openInvitation } from "@/lib/auth/invitation-security";
import { validNewPassword } from "@/lib/auth/recovery-security";
export async function POST(request:Request) {
 const config=recoveryConfiguration();
 if (!config) return json({error:"No fue posible aceptar la invitación."},503);
 if (!hasTrustedOrigin(request,config.origin)) return json({error:"Origen no autorizado."},403);
 const store=await cookies();const grant=openInvitation(store.get(invitationCookie)?.value,config.secret);
 if (!grant) {store.delete(invitationCookie);return json({error:"Enlace inválido o vencido. Pide un reenvío."},401);}
 const raw=await boundedJson(request);
 if (!raw || typeof raw!=="object" || Array.isArray(raw)) return json({error:"Contraseña inválida."},400);
 const input=raw as Record<string,unknown>;
 if (Object.keys(input).sort().join(",")!=="confirmation,password" || !validNewPassword(input.password) || input.password!==input.confirmation) return json({error:"Usa entre 12 y 128 caracteres y confirma la misma contraseña."},400);
 try {
  const client=recoveryClient(config);
  const identity=await client.auth.getUser(grant.accessToken);
  if (identity.error || identity.data.user?.id!==grant.userId) {store.delete(invitationCookie);return json({error:"Enlace inválido o vencido."},401);}
  const session=await client.auth.setSession({access_token:grant.accessToken,refresh_token:grant.refreshToken});
  if (session.error) return json({error:"Enlace inválido o vencido."},401);
  const validation=await client.rpc("validate_organization_invitation",{invitation_id:grant.invitationId});
  if (validation.error) {store.delete(invitationCookie);return json({error:"La invitación venció, fue cancelada o ya fue aceptada."},403);}
  const password=await client.auth.updateUser({password:input.password});
  if (password.error) return json({error:"No fue posible guardar la contraseña. Revisa sus requisitos."},400);
  const accepted=await client.rpc("accept_organization_invitation",{invitation_id:grant.invitationId});
  if (accepted.error) return json({error:"La contraseña se guardó, pero no pudimos confirmar el acceso. Intenta aceptar nuevamente o contacta al administrador."},409);
  store.delete(invitationCookie);
  // Cerrar solo la sesión temporal de invitación. El usuario inicia sesión normalmente.
  try {await client.auth.signOut({scope:"local"});} catch { /* Cookie temporal ya eliminada. */ }
  return json({success:true,message:"Tu cuenta está lista. Inicia sesión con tu correo y contraseña."});
 } catch {return json({error:"No pudimos confirmar la operación. Intenta nuevamente."},503);}
}
