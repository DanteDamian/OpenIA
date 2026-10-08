"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
export type Field = {
  name: string; label: string; required?: boolean; max: number;
  type?: "email" | "tel" | "textarea" | "date"; options?: { value: string; label: string }[];
  initial?: string | null; autoComplete?: string;
};
type Props = {
  title: string; triggerLabel: string; endpoint: string; method: "POST" | "PATCH";
  fields: Field[]; successMessage: string; help: string;
  validate?: (input: Record<string, string | null>) => boolean;
  validationMessage?: string;
  onFieldChange?: (name: string, value: string) => void;
};
export function RecordForm({ title, triggerLabel, endpoint, method, fields, successMessage, help, validate, validationMessage, onFieldChange }: Props) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() { setOpen(false); setError(""); trigger.current?.focus(); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const input = Object.fromEntries(fields.map(field => [field.name, String(values.get(field.name) || "").trim() || null]));
    setError("");
    if (fields.some(field => field.required && !input[field.name])) {
      setError("Completa los campos obligatorios; el nombre no puede contener solo espacios."); return;
    }
    if (validate && !validate(input)) {
      setError(validationMessage || "Revisa los datos. La identificación requiere tipo y número juntos y un correo válido si lo indicas."); return;
    }
    submitting.current = true; setBusy(true);
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) {
        setError(response.status === 401 ? "Tu sesión ha vencido. Vuelve a iniciar sesión."
          : response.status === 403 ? "No tienes autorización para guardar desde esta sesión."
          : response.status === 404 ? "El registro ya no está disponible en tu empresa."
          : "No fue posible guardar. Revisa los datos e intenta nuevamente."); return;
      }
      form.reset(); close(); setSuccess(true); router.refresh();
    } catch {
      setError("No pudimos confirmar el guardado. Revisa la lista antes de reintentar para evitar duplicados.");
    } finally { submitting.current = false; setBusy(false); }
  }
  const inputClass = "mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3";
  return <div className="mt-6">
    <button ref={trigger} type="button" className="button-primary aria-disabled:opacity-60" aria-expanded={open}
      aria-controls={`${id}-form`} aria-disabled={busy} onClick={() => {
        if (busy) return;
        if (open) close(); else { setSuccess(false); setOpen(true); }
      }}>{open ? "Cerrar formulario" : triggerLabel}</button>
    {success && <p role="status" className="mt-4 text-sm text-teal-800">{successMessage}</p>}
    {open && <form id={`${id}-form`} method="post" action={endpoint} onSubmit={submit}
      aria-labelledby={`${id}-title`} aria-busy={busy} className="card mt-4 space-y-5 p-6">
      <h2 id={`${id}-title`} className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-slate-500">{help}</p>
      <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
        <legend className="sr-only">Datos del registro</legend>
        {fields.map((field, index) => {
          const common = { id: `${id}-${field.name}`, name: field.name, required: field.required,
            defaultValue: field.initial || "", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onFieldChange?.(field.name, event.target.value), className: inputClass, autoFocus: index === 0 };
          return <div key={`${field.name}:${field.options?.map(option => option.value).join("|") || ""}`} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
            <label htmlFor={common.id} className="text-sm font-medium">{field.label}{field.required && <span aria-hidden="true"> *</span>}</label>
            {field.options ? <select {...common}>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              : field.type === "textarea" ? <textarea {...common} maxLength={field.max} rows={3} />
              : <input {...common} type={field.type || "text"} maxLength={field.max} autoComplete={field.autoComplete} />}
          </div>;
        })}
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="button-primary disabled:opacity-60">{busy ? "Guardando…" : "Guardar"}</button>
        <button type="button" disabled={busy} onClick={close} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium disabled:opacity-60">Cancelar</button>
      </div>
    </form>}
  </div>;
}
