import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { sameOrigin } from "@/lib/auth/validation";
import { json } from "@/lib/auth/http";
import { cookies } from "next/headers";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: "Solicitud no autorizada." }, 403);
  if (!getSupabaseConfig())
    return json({ error: "Acceso pendiente de configuración." }, 503);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return json({ error: "No fue posible cerrar la sesión." }, 503);
  (await cookies()).delete("aigenterra-org");
  return json({ success: true });
}
