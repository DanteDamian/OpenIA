/** El destino se obtiene de configuración del servidor, nunca de la petición. */
export function authOrigin(env: Record<string, string | undefined>) {
  let value = env.AUTH_SITE_URL || "";
  if (env.VERCEL_ENV === "preview") {
    // Vercel entrega un hostname, no una URL ni una cabecera del visitante.
    // Nunca recuperar AUTH_SITE_URL como fallback: puede pertenecer a otro build.
    const host = env.VERCEL_URL || "";
    const labels = host.split(".");
    if (
      host.length > 253 ||
      labels.length < 2 ||
      /^[\d.]+$/.test(host) ||
      !labels.every((label) =>
        /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label),
      )
    )
      return null;
    value = `https://${host}`;
  }
  try {
    const url = new URL(value);
    const local =
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      /^127\./.test(url.hostname) ||
      ["0.0.0.0", "[::1]", "[::]"].includes(url.hostname) ||
      url.hostname.startsWith("[::ffff:7f");
    const deployed = !!env.VERCEL_ENV || env.NODE_ENV === "production";
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["", "/"].includes(url.pathname) ||
      (local && deployed) ||
      (url.protocol !== "https:" &&
        !(local && !deployed && url.protocol === "http:"))
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function hasTrustedOrigin(request: Request, expected: string | null) {
  return expected !== null && request.headers.get("origin") === expected;
}
