import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (
    request.nextUrl.pathname.startsWith("/invitacion/") ||
    request.nextUrl.pathname.startsWith("/api/auth/invitations/") ||
    request.nextUrl.pathname === "/recuperar" ||
    request.nextUrl.pathname.startsWith("/recuperar/") ||
    request.nextUrl.pathname.startsWith("/api/auth/recovery/")
  ) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'none'; form-action 'self'; base-uri 'self'",
    );
    return response;
  }
  const configuration = getSupabaseConfig();
  const publicRoute =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/sin-acceso" ||
    request.nextUrl.pathname.startsWith("/api/");
  if (!configuration)
    return publicRoute
      ? response
      : NextResponse.redirect(new URL("/login", request.url));
  const supabase = createServerClient(configuration.url, configuration.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: configuration.url.startsWith("https:"),
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items, headers) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        if (headers)
          Object.entries(headers).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
      },
    },
  });
  // Validación contra Auth; nunca usar getSession() como prueba de identidad.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && !publicRoute) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response = redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
