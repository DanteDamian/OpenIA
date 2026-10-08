import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { RecoveryForm } from "@/features/auth/recovery-form";
import { recoveryConfiguration } from "@/lib/auth/recovery";
import { recoveryCookie, openRecovery } from "@/lib/auth/recovery-security";
export const dynamic = "force-dynamic";
export default async function RecoveryPage({
  params,
}: {
  params: Promise<{ step?: string[] }>;
}) {
  const { step } = await params;
  const path = step?.join("/") || "";
  if (!["", "confirmar", "nueva"].includes(path)) notFound();
  const mode =
    path === "confirmar" ? "verify" : path === "nueva" ? "update" : "request";
  const config = recoveryConfiguration();
  const permitted =
    mode !== "update" ||
    (config &&
      openRecovery(
        (await cookies()).get(recoveryCookie)?.value,
        config.secret,
      ));
  return (
    <main
      id="contenido"
      className="flex min-h-screen items-center justify-center px-5 py-12"
    >
      <section className="card w-full max-w-md p-8">
        <p className="eyebrow">AIGENTERRA FINANCE AI</p>
        <h1 className="mt-3 text-2xl font-semibold">
          {mode === "request"
            ? "Recupera tu acceso"
            : mode === "verify"
              ? "Valida tu enlace"
              : "Establece una contraseña nueva"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {mode === "request"
            ? "Te enviaremos las instrucciones si tu cuenta puede recuperar su acceso."
            : mode === "verify"
              ? "Confirma que deseas continuar. El enlace tiene vigencia limitada y no concede acceso administrativo."
              : "Al terminar, inicia sesión de nuevo con tu contraseña nueva."}
        </p>
        {!config ? (
          <p role="status" className="mt-6">
            La recuperación está pendiente de configuración. Contacta al
            administrador.
          </p>
        ) : !permitted ? (
          <p role="status" className="mt-6">
            Enlace inválido o vencido.{" "}
            <Link href="/recuperar" className="underline">
              Solicita uno nuevo.
            </Link>
          </p>
        ) : (
          <RecoveryForm mode={mode} />
        )}
        <Link href="/login" className="mt-6 block text-sm underline">
          Volver a iniciar sesión
        </Link>
        {mode !== "request" && (
          <Link href="/recuperar" className="mt-3 block text-sm underline">
            Solicitar otro enlace
          </Link>
        )}
      </section>
    </main>
  );
}
