import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
// Los Server Components leen cookies; proxy.ts renueva sesiones y propaga cookies.
export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Falta la configuración pública de Supabase.");
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.url.startsWith("https:"),
    },
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch (error) {
          // Next.js no permite escribir cookies durante el render. El proxy ya
          // verificó/renovó la sesión; Route Handlers sí pueden escribirlas.
          if (
            !(error instanceof Error) ||
            !error.message.includes("Cookies can only be modified")
          )
            throw error;
        }
      },
    },
  });
}
