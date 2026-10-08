"use client";
import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
export function InvitationActions({id}:{id:string}) {
 const router=useRouter();const pending=useRef(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function action(cancel:boolean) {
  if (pending.current) return;
  if (cancel && !window.confirm("¿Cancelar esta invitación? Su enlace dejará de permitir acceso a la empresa.")) return;
  pending.current=true;setBusy(true);setMessage("");
  try {
   const response=await fetch(`/api/users/invitations/${id}`,{method:cancel ? "DELETE" : "POST"});const data=await response.json();
   setMessage(response.ok ? (cancel ? "Invitación cancelada." : "Invitación reenviada.") : data.error || "No fue posible continuar.");
   router.refresh();
  } catch {setMessage("No pudimos confirmar la operación. Actualiza la lista antes de reintentar.");}
  finally {pending.current=false;setBusy(false);}
 }
 return <div className="mt-4"><div className="flex flex-wrap gap-3"><button disabled={busy} onClick={()=>action(false)} className="button-primary disabled:opacity-60">Reenviar</button><button disabled={busy} onClick={()=>action(true)} className="rounded-lg border px-4 py-3 text-sm disabled:opacity-60">Cancelar invitación</button></div>{message && <p className="mt-3 text-sm" role="status">{message}</p>}</div>;
}
