"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { modules } from "@/lib/modules";
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navigation = [{ slug: "", name: "Resumen", icon: "▦" }, ...modules];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen">
        <div className="flex items-center justify-between p-6">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="AIGENTERRA, inicio"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-800 text-xl font-bold text-white">
              A
            </span>
            <span>
              <strong className="block text-sm tracking-widest">
                AIGENTERRA
              </strong>
              <span className="text-xs text-slate-500">Finance AI</span>
            </span>
          </Link>
          <button
            type="button"
            className="rounded-lg border p-2 lg:hidden"
            aria-expanded={open}
            aria-controls="navigation"
            onClick={() => setOpen(!open)}
            aria-label="Mostrar navegación"
          >
            ☰
          </button>
        </div>
        <nav
          id="navigation"
          aria-label="Navegación principal"
          className={`${open ? "block" : "hidden"} px-4 pb-6 lg:block`}
        >
          <p className="px-3 pb-3 pt-4 text-[10px] font-semibold tracking-[.18em] text-slate-400">
            ESPACIO DE TRABAJO
          </p>
          {navigation.map((item) => (
            <Link
              key={item.slug}
              href={`/${item.slug}`}
              onClick={() => setOpen(false)}
              aria-current={pathname === `/${item.slug}` ? "page" : undefined}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${pathname === `/${item.slug}` ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <span aria-hidden="true" className="w-5 text-lg">
                {item.icon}
              </span>
              {item.name}
            </Link>
          ))}
          <div className="mt-8 border-t border-slate-100 pt-4">
            <Link
              href="/configuracion"
              onClick={() => setOpen(false)}
              aria-current={pathname === "/configuracion" ? "page" : undefined}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              <span aria-hidden="true">⚙</span>Configuración
            </Link>
          </div>
        </nav>
        <div className="m-4 hidden rounded-xl bg-slate-50 p-4 lg:block">
          <p className="text-xs font-semibold text-slate-700">
            Tu operación, conectada
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Una base para administrar y hacer crecer AIGENTERRA.
          </p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 lg:px-10">
          <span className="text-sm text-slate-500">
            Administración <span className="mx-2 text-slate-300">/</span>{" "}
            <span className="font-medium text-slate-800">Finance AI</span>
          </span>
          <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800">
            Entorno de desarrollo
          </span>
        </header>
        <main
          id="contenido"
          className="mx-auto max-w-7xl px-5 py-8 lg:px-10 lg:py-10"
        >
          {children}
        </main>
        <footer className="px-6 pb-6 text-xs text-slate-500 lg:px-10">
          AIGENTERRA Finance AI · Operación en Colombia · COP
        </footer>
      </div>
    </div>
  );
}
