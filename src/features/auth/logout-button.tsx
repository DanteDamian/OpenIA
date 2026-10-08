"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setError("No fue posible cerrar sesión. Intenta nuevamente.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("No fue posible conectar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-60"
      >
        {busy ? "Cerrando…" : "Cerrar sesión"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
