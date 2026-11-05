"use client";
import { useRef,useState } from "react";
export function AssistantChat() {
  const [messages,setMessages]=useState<{question:string;answer:string}[]>([]); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const sending=useRef(false);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(sending.current)return;
    const form=event.currentTarget;const message=String(new FormData(form).get("message")||"").trim();if(!message)return;
    sending.current=true;setBusy(true);setError("");
    try { const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message})});
      const body=await response.json(); if(!response.ok) {setError(body.error||"No fue posible consultar.");return;}
      setMessages(previous=>[...previous,{question:message,answer:body.answer}]);form.reset();
    } catch{setError("No fue posible conectar.");}finally{sending.current=false;setBusy(false);}
  }
  return <section className="card mt-6 p-6"><h2 className="font-semibold">Consulta tu operación</h2><p className="mt-2 text-sm text-slate-500">Pregunta por proyectos, gastos, oportunidades, alertas o resumen. Máximo 30 consultas diarias por persona y organización. Solo consulta; nunca modifica registros.</p>
    <div aria-live="polite" className="mt-5 space-y-4">{messages.map((message,i)=><article key={i} className="rounded-lg bg-slate-50 p-4"><p className="font-medium">{message.question}</p><p className="mt-3 whitespace-pre-wrap text-sm">{message.answer}</p></article>)}</div>
    <form method="post" onSubmit={submit} className="mt-5 space-y-3"><label htmlFor="assistant-message" className="text-sm font-medium">Tu consulta</label><textarea id="assistant-message" name="message" required maxLength={1000} disabled={busy} className="block w-full rounded-lg border p-3" rows={3} /><button disabled={busy} className="button-primary" type="submit">{busy ? "Consultando…" : "Consultar"}</button></form>
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}
