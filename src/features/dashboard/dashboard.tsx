import Link from "next/link";
import { modules } from "@/lib/modules";
export function Dashboard() {
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">VISIÓN GENERAL</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Tu operación, en perspectiva
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Un espacio para tomar decisiones con información de tu empresa.
          </p>
        </div>
        <Link href="/configuracion" className="button-primary">
          Configurar espacio <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <section
        className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicadores financieros"
      >
        {[
          "Ingresos registrados",
          "Gastos registrados",
          "Cuentas por cobrar",
          "Proyectos activos",
        ].map((label, index) => (
          <article key={label} className="card p-5">
            <div className="flex justify-between">
              <h2 className="text-sm font-medium text-slate-500">{label}</h2>
              <span aria-hidden="true" className="text-teal-700">
                {["↗", "↙", "◷", "▧"][index]}
              </span>
            </div>
            <p
              className="my-5 text-3xl font-semibold text-slate-800"
              aria-label="Sin datos"
            >
              —
            </p>
            <p className="text-xs text-slate-500">
              {index === 3
                ? "Sin proyectos registrados"
                : "Sin datos financieros conectados"}
            </p>
          </article>
        ))}
      </section>
      <section className="mb-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <article className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <h2 className="font-semibold">Actividad financiera</h2>
            <span className="text-xs text-slate-500">COP</span>
          </div>
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
            <span
              aria-hidden="true"
              className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-50 text-2xl text-teal-700"
            >
              ▥
            </span>
            <h3 className="font-medium">Cada decisión empieza con datos</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Cuando conectes una fuente de datos, podrás consultar aquí la
              actividad real de tu operación.
            </p>
            <Link
              href="/configuracion"
              className="mt-5 text-sm font-semibold text-teal-800 hover:underline"
            >
              Ver configuración →
            </Link>
          </div>
        </article>
        <article className="rounded-2xl bg-teal-900 p-6 text-white">
          <p className="text-xs font-medium tracking-widest text-teal-200">
            PRIMEROS PASOS
          </p>
          <h2 className="mt-3 text-xl font-semibold">
            Construye tu centro de control
          </h2>
          <p className="mt-3 text-sm leading-6 text-teal-100">
            La estructura está lista. Conecta tu información para comenzar a
            gestionar tu empresa.
          </p>
          <ol className="mt-6 space-y-4 text-sm">
            {[
              "Configura Supabase",
              "Habilita acceso seguro",
              "Registra tu información",
            ].map((text, index) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-full border border-teal-600 text-xs">
                  {index + 1}
                </span>
                {text}
              </li>
            ))}
          </ol>
          <p className="mt-6 border-t border-teal-700 pt-4 text-xs leading-5 text-teal-200">
            OpenAI y Alegra están previstos para etapas posteriores.
          </p>
        </article>
      </section>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-lg font-semibold">Explora tu espacio de trabajo</h2>
        <span className="text-xs text-slate-500">7 módulos</span>
      </div>
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Módulos administrativos"
      >
        {modules.map((item) => (
          <Link
            href={`/${item.slug}`}
            key={item.slug}
            className="card group p-5 transition hover:border-teal-300 hover:shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-xl text-teal-800"
              >
                {item.icon}
              </span>
              <span
                aria-hidden="true"
                className="text-slate-400 group-hover:text-teal-800"
              >
                ↗
              </span>
            </div>
            <h3 className="font-semibold">{item.name}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {item.description}
            </p>
          </Link>
        ))}
      </section>
    </>
  );
}
