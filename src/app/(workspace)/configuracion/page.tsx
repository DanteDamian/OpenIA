import { requireAccess } from "@/lib/auth/session";
import { CompanyForm } from "@/features/business/company-form";
export default async function Configuration() {
  const access=await requireAccess();
  const {data,error}=await access.supabase.from("organizations").select("name,tax_id,email,phone,address,currency").eq("id",access.organizationId).maybeSingle();
  return <><p className="eyebrow">TU EMPRESA</p><h1 className="mt-2 text-3xl font-semibold">Configuración empresarial</h1>
    {error || !data ? <p role="alert" className="card mt-6 p-6 text-red-700">No fue posible consultar la empresa.</p>
      : <><section className="card mt-6 p-6"><dl className="grid gap-5 sm:grid-cols-2">{Object.entries(data).map(([key,value])=><div key={key}><dt className="text-sm text-slate-500">{{name:"Nombre",tax_id:"Identificación",email:"Correo",phone:"Teléfono",address:"Dirección",currency:"Moneda"}[key as "name"] || key}</dt><dd className="mt-2 break-words">{String(value || "Sin registrar")}</dd></div>)}</dl></section>{access.role==="admin" && <CompanyForm company={data} />}</>}
    <section className="card mt-6 p-6"><h2 className="font-semibold">Acceso e integraciones</h2><p className="mt-3 text-sm">Rol actual: {access.role}. La identidad y membresía se verifican en cada petición. No se administran usuarios ni roles desde esta página.</p><p className="mt-3 text-sm">Facturación y Alegra excluidos. OpenAI requiere clave y activación explícita; los análisis determinísticos están disponibles.</p></section>
  </>;
}
