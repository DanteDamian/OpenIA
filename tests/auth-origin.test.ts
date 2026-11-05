import { describe, expect, it } from "vitest";
import { authOrigin, hasTrustedOrigin } from "../src/lib/auth/origin";

const preview = {
  VERCEL_ENV: "preview",
  NODE_ENV: "production",
  VERCEL_URL: "current-deployment.vercel.app",
  AUTH_SITE_URL: "https://previous-deployment.vercel.app",
};

describe("Origen de autenticación configurado en servidor", () => {
  it("Preview ignora AUTH_SITE_URL anterior y usa siempre el deployment actual", () => {
    expect(authOrigin(preview)).toBe("https://current-deployment.vercel.app");
    expect(authOrigin({ ...preview, AUTH_SITE_URL: "http://localhost:3000" }))
      .toBe("https://current-deployment.vercel.app");
  });

  it.each(["", "localhost", "app.localhost", "127.0.0.1", "https://app.vercel.app",
    "app.vercel.app/path", "app.vercel.app:443", "user@app.vercel.app",
    "app.vercel.app?next=evil", "app.vercel.app#hash", " app.vercel.app",
    "app..vercel.app", "-app.vercel.app"])("rechaza VERCEL_URL inválida: %s", host => {
    expect(authOrigin({ ...preview, VERCEL_URL: host })).toBeNull();
  });

  it("Production exige AUTH_SITE_URL explícito, incluso si existe VERCEL_URL", () => {
    expect(authOrigin({ ...preview, VERCEL_ENV: "production", AUTH_SITE_URL: "" })).toBeNull();
    expect(authOrigin({ ...preview, VERCEL_ENV: "production", AUTH_SITE_URL: "https://finance.example/" }))
      .toBe("https://finance.example");
  });

  it.each(["http://finance.example", "https://localhost", "https://app.localhost",
    "https://127.0.0.1", "https://[::1]", "https://0.0.0.0",
    "https://user:password@finance.example", "https://finance.example/path",
    "https://finance.example?next=evil", "https://finance.example#hash"])("rechaza origen Production inseguro: %s", origin => {
    expect(authOrigin({ VERCEL_ENV: "production", AUTH_SITE_URL: origin })).toBeNull();
  });

  it("solo permite loopback explícito en desarrollo local sin Vercel", () => {
    expect(authOrigin({ NODE_ENV: "development", AUTH_SITE_URL: "http://localhost:3000" }))
      .toBe("http://localhost:3000");
    expect(authOrigin({ NODE_ENV: "production", AUTH_SITE_URL: "http://localhost:3000" })).toBeNull();
    expect(authOrigin({ NODE_ENV: "development" })).toBeNull();
  });

  it("exige Origin exacto sin confiar en la URL, Host o Forwarded del cliente", () => {
    const expected = authOrigin(preview);
    for (const origin of [undefined, "null", preview.AUTH_SITE_URL, "https://evil.example",
      "http://current-deployment.vercel.app", `${expected}:443`, `${expected}/`, expected!]) {
      const headers = new Headers({ host: "evil.example", "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https", forwarded: "host=evil.example;proto=https" });
      if (origin !== undefined) headers.set("origin", origin);
      expect(hasTrustedOrigin(new Request("https://evil.example/api", { headers }), expected))
        .toBe(origin === expected);
    }
    expect(hasTrustedOrigin(new Request("https://evil.example/api"), null)).toBe(false);
  });
});
