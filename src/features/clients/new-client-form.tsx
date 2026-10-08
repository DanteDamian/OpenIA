"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function NewClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    setError("");
    trigger.current?.focus();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const legalName = String(values.get("legal_name") || "").trim();
    const email = String(values.get("email") || "").trim();
    setError("");
    if (!legalName) {
      setError("Introduce el nombre o razón social del cliente.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legal_name: legalName, email: email || null }),
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "Tu sesión ha vencido. Vuelve a iniciar sesión."
            : response.status === 403
              ? "No tienes autorización para registrar clientes desde esta sesión."
              : "No fue posible registrar el cliente. Revisa los datos e intenta nuevamente.",
        );
        return;
      }
      form.reset();
      close();
      setSuccess(true);
      router.refresh();
    } catch {
      setError("No pudimos confirmar el registro. Revisa la lista antes de reintentar para evitar duplicados.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        ref={trigger}
        type="button"
        className="button-primary disabled:opacity-60"
        aria-expanded={open}
        aria-controls="new-client-form"
        aria-disabled={busy}
        onClick={() => {
          if (busy) return;
          if (open) close();
          else {
            setSuccess(false);
            setOpen(true);
          }
        }}
      >
        {open ? "Cerrar formulario" : "+ Nuevo cliente"}
      </button>
      {success && (
        <p role="status" className="mt-4 text-sm text-teal-800">
          Cliente registrado correctamente.
        </p>
      )}
      {open && (
        <form
          id="new-client-form"
          method="post"
          action="/api/clients"
          onSubmit={submit}
          aria-labelledby="new-client-title"
          aria-busy={busy}
          className="card mt-4 space-y-5 p-6"
        >
          <h2 id="new-client-title" className="text-lg font-semibold">Nuevo cliente</h2>
          <p className="text-sm text-slate-500">Registra los datos reales del cliente. Se guardará como activo en tu empresa.</p>
          <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
            <legend className="sr-only">Datos del cliente</legend>
            <div>
              <label htmlFor="client-name" className="text-sm font-medium">Nombre o razón social <span aria-hidden="true">*</span></label>
              <input id="client-name" name="legal_name" type="text" autoComplete="organization" required maxLength={200}
                autoFocus className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3" />
            </div>
            <div>
              <label htmlFor="client-email" className="text-sm font-medium">Correo electrónico (opcional)</label>
              <input id="client-email" name="email" type="email" autoComplete="email" maxLength={254}
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3" />
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="button-primary disabled:opacity-60">
              {busy ? "Guardando…" : "Guardar cliente"}
            </button>
            <button type="button" disabled={busy} onClick={close}
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium disabled:opacity-60">Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
