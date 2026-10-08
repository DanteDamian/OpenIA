import { getSupabaseConfig } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export default function Configuration() {
  const configured = Boolean(getSupabaseConfig());
  return (
    <>
      <p className="eyebrow">TU ESPACIO</p>
      <h1 className="mt-2 text-3xl font-semibold">Configuración</h1>
      <p className="mt-3 text-sm text-slate-500">
        Estado de los servicios de tu plataforma.
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {[
          {
            name: "Supabase",
            status: configured
              ? "Variables configuradas"
              : "Pendiente de configuración",
            text: configured
              ? "La conexión y la autenticación aún no han sido verificadas."
              : "Configura la URL del proyecto y su clave pública para preparar la conexión.",
          },
          {
            name: "OpenAI",
            status: "Próxima etapa",
            text: "No hay integración activa ni envío de datos a la API.",
          },
          {
            name: "Alegra",
            status: "Próxima etapa",
            text: "La facturación electrónica aún no está conectada.",
          },
        ].map((item) => (
          <article className="card p-6" key={item.name}>
            <h2 className="text-lg font-semibold">{item.name}</h2>
            <p className="mt-4 text-xs font-semibold text-teal-800">
              {item.status}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-500">{item.text}</p>
          </article>
        ))}
      </div>
      <aside className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        Esta versión contiene únicamente la interfaz inicial. Antes de cargar
        información real, habilita autenticación, autorización y políticas de
        acceso a los datos.
      </aside>
    </>
  );
}
