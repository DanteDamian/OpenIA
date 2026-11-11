"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
type Choice = { id: string; label: string };
export function NewProposalForm({ clients, calls }: { clients: Choice[]; calls: Choice[] }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); const data = new FormData(event.currentTarget);
    const response = await fetch("/api/proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) });
    const result = await response.json() as { proposal?: { id: string }; error?: string }; setBusy(false);
    if (!response.ok || !result.proposal) return setMessage(result.error || "No fue posible crear la propuesta.");
    router.push(`/propuestas/${result.proposal.id}`); router.refresh();
  }
  if (!open) return <button type="button" className="button-primary" onClick={() => setOpen(true)}>+ Nueva propuesta</button>;
  return <form onSubmit={submit} className="card mt-6 grid gap-4 p-5 sm:grid-cols-2">
    <div className="sm:col-span-2 flex items-center justify-between"><h2 className="font-semibold">Nueva propuesta</h2><button type="button" className="text-sm underline" onClick={() => setOpen(false)}>Cerrar</button></div>
    <label className="text-sm">Código<input name="code" required maxLength={60} placeholder="PROP-2026-001" className="mt-2 w-full rounded-lg border p-3" /></label>
    <label className="text-sm">Título<input name="title" required maxLength={200} className="mt-2 w-full rounded-lg border p-3" /></label>
    <label className="text-sm">Cliente<select name="client_id" required className="mt-2 w-full rounded-lg border bg-white p-3"><option value="">Selecciona…</option>{clients.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label>
    <label className="text-sm">Convocatoria (opcional)<select name="call_for_proposal_id" className="mt-2 w-full rounded-lg border bg-white p-3"><option value="">Sin vincular</option>{calls.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label>
    <label className="text-sm">Válida hasta (opcional)<input name="valid_until" type="date" className="mt-2 w-full rounded-lg border p-3" /></label>
    <div className="sm:col-span-2"><button disabled={busy} className="button-primary disabled:opacity-60">{busy ? "Creando…" : "Crear y editar"}</button>{message && <p role="alert" className="mt-3 text-sm text-red-700">{message}</p>}</div>
  </form>;
}

