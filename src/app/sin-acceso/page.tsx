import Link from "next/link";
import { LogoutButton } from "@/features/auth/logout-button";
export default function NoAccess() {
  return (
    <main id="contenido" className="mx-auto max-w-xl px-6 py-20">
      <p className="eyebrow">ACCESO RESTRINGIDO</p>
      <h1 className="mt-3 text-3xl font-semibold">
        No tienes un espacio autorizado
      </h1>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        Solicita al administrador que revise tu membresía o la empresa
        seleccionada.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href="/login" className="button-primary">
          Volver al acceso
        </Link>
        <LogoutButton />
      </div>
    </main>
  );
}
