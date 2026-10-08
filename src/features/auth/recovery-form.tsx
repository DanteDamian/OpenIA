"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
export function RecoveryForm({
  mode,
}: {
  mode: "request" | "verify" | "update";
}) {
  const router = useRouter();
  const token = useRef("");
  const loaded = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    if (mode !== "verify" || loaded.current) return;
    loaded.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    // Retirar todo dato de enlace antes de enviar peticiones. No aceptar next/code/JWT.
    window.history.replaceState(null, "", window.location.pathname);
    const value = params.get("token_hash") || "";
    if (
      Array.from(params.keys()).length === 1 &&
      /^[a-zA-Z0-9_-]{20,512}$/.test(value)
    ) {
      token.current = value;
    }
  }, [mode]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "verify" && !token.current) {
      setMessage("Enlace inválido o vencido. Solicita uno nuevo.");
      return;
    }
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const body =
      mode === "request"
        ? { email: values.get("email") }
        : mode === "verify"
          ? { tokenHash: token.current }
          : {
              password: values.get("password"),
              confirmation: values.get("confirmation"),
            };
    try {
      const response = await fetch(`/api/auth/recovery/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "No fue posible continuar.");
        return;
      }
      if (mode === "verify") {
        token.current = "";
        router.replace("/recuperar/nueva");
        return;
      }
      form.reset();
      setComplete(true);
      setMessage(result.message);
    } catch {
      setMessage("No fue posible conectar. Intenta nuevamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      {mode === "request" && !complete && (
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3"
          />
        </div>
      )}
      {mode === "update" && !complete && (
        <>
          {["password", "confirmation"].map((name) => (
            <div key={name}>
              <label htmlFor={name} className="text-sm font-medium">
                {name === "password"
                  ? "Contraseña nueva"
                  : "Confirmar contraseña"}
              </label>
              <input
                id={name}
                name={name}
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3"
              />
            </div>
          ))}
          <p className="text-sm text-slate-500">
            Usa entre 12 y 128 caracteres. No reutilices una contraseña
            anterior.
          </p>
        </>
      )}
      {message && (
        <p role="status" aria-live="polite" className="text-sm leading-6">
          {message}
        </p>
      )}
      {!complete && (
        <button
          disabled={busy}
          className="button-primary w-full disabled:opacity-60"
        >
          {busy
            ? "Procesando…"
            : mode === "request"
              ? "Enviar enlace"
              : mode === "verify"
                ? "Validar enlace"
                : "Guardar contraseña"}
        </button>
      )}
    </form>
  );
}
