"use client";
import Link from "next/link";
import { useEffect,useRef,useState } from "react";
export function InvitationForm({id}:{id:string}) {
 const tokens=useRef<{accessToken:string;refreshToken:string}|null>(null);
 const loaded=useRef(false);const submitting=useRef(false);
 const [stage,setStage]=useState<"verify"|"password"|"done">("verify");
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [organization,setOrganization]=useState("");
 useEffect(()=>{
  if (loaded.current) return;loaded.current=true;
  const params=new URLSearchParams(window.location.hash.slice(1));
  window.history.replaceState(null,"",window.location.pathname);
  const accessToken=params.get("access_token") || "";const refreshToken=params.get("refresh_token") || "";
  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(accessToken) && /^[\w-]{10,1024}$/.test(refreshToken) && accessToken.length<=4096)
   tokens.current={accessToken,refreshToken};
 },[]);
 async function submit(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault();if (submitting.current) return;
  if (stage==="verify" && !tokens.current) {setMessage("Enlace inválido o vencido. Pide al administrador reenviar la invitación.");return;}
  const values=new FormData(event.currentTarget);
  if (stage==="password" && values.get("password")!==values.get("confirmation")) {setMessage("Las contraseñas deben coincidir.");return;}
  submitting.current=true;setBusy(true);setMessage("");
  try {
   const response=await fetch(`/api/auth/invitations/${stage==="verify" ? "verify" : "accept"}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(stage==="verify" ? {...tokens.current,invitationId:id} : {password:values.get("password"),confirmation:values.get("confirmation")})});
   const result=await response.json();
   if (!response.ok) {setMessage(result.error || "No fue posible continuar.");return;}
   if (stage==="verify") {tokens.current=null;setOrganization(result.organization);setStage("password");}
   else {setMessage(result.message);setStage("done");}
  } catch {setMessage("No pudimos confirmar la operación. Intenta nuevamente.");}
  finally {submitting.current=false;setBusy(false);}
 }
 return <form method="post" onSubmit={submit} className="mt-6 space-y-5" aria-busy={busy}>
  {stage==="verify" && <p className="text-sm">Confirma que deseas aceptar la invitación. Luego podrás establecer tu contraseña.</p>}
  {stage==="password" && <><p className="text-sm">Acceso a {organization}. Tu correo ya fue verificado.</p><fieldset disabled={busy} className="space-y-4"><legend className="sr-only">Tu contraseña</legend>{["password","confirmation"].map(name=><div key={name}><label htmlFor={name} className="text-sm font-medium">{name==="password" ? "Contraseña" : "Confirmar contraseña"}</label><input className="mt-2 w-full rounded-lg border p-3" id={name} name={name} type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></div>)}</fieldset><p className="text-sm text-slate-500">Usa entre 12 y 128 caracteres. Si ya tenías cuenta, esta será tu nueva contraseña.</p></>}
  {message && <p role="status" aria-live="polite" className="text-sm">{message}</p>}
  {stage!=="done" ? <button disabled={busy} className="button-primary w-full disabled:opacity-60">{busy ? "Procesando…" : stage==="verify" ? "Validar invitación" : "Guardar contraseña y aceptar"}</button> : <Link className="button-primary block text-center" href="/login">Iniciar sesión</Link>}
 </form>;
}
