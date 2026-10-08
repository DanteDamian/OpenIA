import Link from "next/link";
import type { modules } from "@/lib/modules";
export function ModulePage({ module }: { module: (typeof modules)[number] }) {
  const isAI = module.slug === "inteligencia-artificial";
  return (
    <>
      <p className="eyebrow">ESPACIO DE TRABAJO</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {module.name}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
        {module.description}
      </p>
      <section className="card mt-8 flex min-h-80 flex-col items-center justify-center p-8 text-center">
        <span
          aria-hidden="true"
          className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-teal-50 text-3xl text-teal-800"
        >
          {module.icon}
        </span>
        <h2 className="text-xl font-semibold">
          {isAI
            ? "Un nuevo espacio para la inteligencia"
            : `Tu módulo de ${module.name.toLowerCase()} está preparado`}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
          {isAI
            ? "Las funciones de IA estarán disponibles en una próxima etapa. No se envían datos a OpenAI."
            : "Todavía no hay registros. La gestión de información se habilitará al implementar el modelo de datos y el acceso autenticado."}
        </p>
        <Link href="/configuracion" className="button-primary mt-6">
          Ver configuración
        </Link>
      </section>
    </>
  );
}
