import { LoginForm } from "@/features/auth/login-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export default function Login() {
  return (
    <main
      id="contenido"
      className="flex min-h-screen items-center justify-center px-5 py-12"
    >
      <section className="card w-full max-w-md p-8">
        <p className="eyebrow">AIGENTERRA FINANCE AI</p>
        <h1 className="mt-3 text-2xl font-semibold">Accede a tu espacio</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Inicia sesión con tu cuenta autorizada. La pertenencia y los permisos
          se verifican en el servidor.
        </p>
        {getSupabaseConfig() ? (
          <LoginForm />
        ) : (
          <p
            role="status"
            className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"
          >
            El acceso aún no está configurado. Contacta al administrador.
          </p>
        )}
        <p className="mt-6 text-xs leading-5 text-slate-500">
          Solicita tu cuenta autorizada al administrador de tu empresa.
        </p>
      </section>
    </main>
  );
}
