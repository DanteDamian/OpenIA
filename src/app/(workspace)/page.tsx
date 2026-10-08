import { requireAccess } from "@/lib/auth/session";
import { portfolio } from "@/lib/business/portfolio";
import { Dashboard } from "@/features/dashboard/dashboard";
export default async function Home() {
  const access=await requireAccess();
  const summary=await portfolio(access).catch(()=>null);
  if(!summary) return <p role="alert" className="card p-6 text-red-700">No fue posible calcular el resumen con los datos de tu organización. Intenta nuevamente.</p>;
  return <Dashboard summary={summary} />;
}
