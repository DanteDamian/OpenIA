import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
// Usar desde Route Handlers o Server Actions capaces de escribir cookies.
export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Falta la configuración pública de Supabase.");
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(items) {
        items.forEach(({ name, value, options }) =>
          store.set(name, value, options),
        );
      },
    },
  });
}
