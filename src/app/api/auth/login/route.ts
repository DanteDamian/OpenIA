import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/auth/validation";
import { boundedJson, json } from "@/lib/auth/http";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: "Solicitud no autorizada." }, 403);
  if (!getSupabaseConfig())
    return json({ error: "Acceso pendiente de configuración." }, 503);
  const input = (await boundedJson(request)) as {
    email?: unknown;
    password?: unknown;
  } | null;
  if (
    !input ||
    typeof input.email !== "string" ||
    typeof input.password !== "string" ||
    input.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
    input.password.length < 1 ||
    input.password.length > 1024
  )
    return json({ error: "Revisa los datos de acceso." }, 400);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error)
    return json(
      { error: "No fue posible iniciar sesión con esos datos." },
      401,
    );
  return json({ success: true });
}
