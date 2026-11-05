import Link from "next/link";
import { modules } from "@/lib/modules";
import type { analyze } from "@/lib/business/analytics";
export function Dashboard({ summary }: { summary: ReturnType<typeof analyze> }) {
  return <>
    <p className="eyebrow">VISIÓN GENERAL</p><h1 className="mt-2 text-3xl font-semibold">Tu operación, en perspectiva</h1>
    <p className="mt-3 text-sm text-slate-500">Indicadores calculados con registros de tu organización.</p>
    <section aria-label="Indicadores financieros" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[["Ingresos efectivos",summary.income],["Gastos registrados",summary.expenses],["Flujo neto registrado",summary.cashNet],["Proyectos activos",String(summary.activeProjects)]].map(([label,value])=><article key={label} className="card p-5"><h2 className="text-sm text-slate-500">{label}</h2><p className="mt-5 break-words text-2xl font-semibold">{value}</p></article>)}
    </section>
    <p className="mt-4 text-xs leading-6 text-slate-500">{summary.note}</p>
    <section className="card mt-6 p-6"><h2 className="font-semibold">Alertas operativas</h2>{summary.alerts.length ? <ul className="mt-3 space-y-2 text-sm">{summary.alerts.map((alert,i)=><li key={i}>{alert}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No hay alertas detectadas en los registros disponibles.</p>}<p className="mt-4 text-sm">Cartera de oportunidades abiertas: {summary.pipeline} · {summary.opportunityCount} oportunidades registradas.</p></section>
    <h2 className="mt-8 text-lg font-semibold">Tu espacio de trabajo</h2>
    <section aria-label="Módulos administrativos" className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{modules.map(item=><Link key={item.slug} href={`/${item.slug}`} className="card p-5 hover:border-teal-400"><h3 className="font-semibold">{item.name}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{item.description}</p></Link>)}</section>
  </>;
}
