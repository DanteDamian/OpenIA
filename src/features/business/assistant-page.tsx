import { requireAccess } from "@/lib/auth/session";
import { portfolio } from "@/lib/business/portfolio";
import { AssistantChat } from "./assistant-chat";
export async function AssistantPage() {
  const access=await requireAccess();
  const data=await portfolio(access).catch(()=>null);
  if(!data) return <p role="alert" className="card p-6 text-red-700">No fue posible cargar los análisis autorizados.</p>;
    return <><p className="eyebrow">ANÁLISIS AUTORIZADO</p><h1 className="mt-2 text-3xl font-semibold">Inteligencia Artificial</h1><p className="mt-3 text-sm text-slate-500">{process.env.OPENAI_API_KEY && process.env.OPENAI_ENABLED==="true" ? "Asistencia generativa habilitada; solo datos autorizados." : "Análisis determinístico activo. OpenAI no está activado; no hay llamadas ni consumo externo."}</p>
      <section className="card mt-6 p-6"><h2 className="font-semibold">Resumen ejecutivo</h2><p className="mt-3 text-sm">Gastos {data.expenses} · Cartera estimada {data.pipeline} · {data.activeProjects} proyectos activos</p><ul className="mt-3 space-y-2 text-sm">{data.alerts.length ? data.alerts.map((alert,i)=><li key={i}>{alert}</li>) : <li>Sin alertas detectadas.</li>}</ul></section><AssistantChat /></>;

}
