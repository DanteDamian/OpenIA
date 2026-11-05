import { cookies } from "next/headers";
import { boundedJson,json } from "@/lib/auth/http";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { recoveryConfiguration,recoveryClient } from "@/lib/auth/recovery";
import { invitationCookie,invitationTokens,sealInvitation } from "@/lib/auth/invitation-security";
export async function POST(request:Request) {
 const config=recoveryConfiguration();
 if (!config) return json({error:"No fue posible validar la invitación."},503);
 if (!hasTrustedOrigin(request,config.origin)) return json({error:"Origen no autorizado."},403);
 const store=await cookies();store.delete(invitationCookie);
 const input=invitationTokens(await boundedJson(request));
 if (!input) return json({error:"Enlace inválido o vencido. Pide al administrador reenviar la invitación."},400);
 try {
  const client=recoveryClient(config);
  const {data,error}=await client.auth.getUser(input.accessToken);
  if (error || !data.user?.email_confirmed_at) return json({error:"Enlace inválido o vencido."},401);
  const session=await client.auth.setSession({access_token:input.accessToken,refresh_token:input.refreshToken});
  if (session.error || session.data.user?.id!==data.user.id || !session.data.session) return json({error:"Enlace inválido o vencido."},401);
  const validation=await client.rpc("validate_organization_invitation",{invitation_id:input.invitationId});
  if (validation.error || !validation.data?.[0]) return json({error:"Esta invitación no corresponde a tu cuenta, fue cancelada o venció."},403);
  const expiresAt=Math.min(Date.now()+600000,(session.data.session.expires_at || 0)*1000);
  if (expiresAt<=Date.now()) return json({error:"Enlace vencido."},401);
  const sealed=sealInvitation({...input,accessToken:session.data.session.access_token,refreshToken:session.data.session.refresh_token,userId:data.user.id,expiresAt},config.secret);
  if (sealed.length>3800) return json({error:"No fue posible validar el enlace."},503);
  store.set(invitationCookie,sealed,{httpOnly:true,secure:config.origin.startsWith("https:"),sameSite:"strict",path:"/",maxAge:Math.floor((expiresAt-Date.now())/1000)});
  return json({success:true,organization:validation.data[0].organization_name});
 } catch {return json({error:"No fue posible validar el enlace."},400);}
}
