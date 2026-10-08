import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { resetPasswordForEmail: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() },
  store: { get: vi.fn(), delete: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: () => ({ url: "https://db.example", key: "public-fixture" }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: mocks.auth }) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: mocks.auth }) }));
vi.mock("next/headers", () => ({ cookies: async () => mocks.store }));

// Configuración real: no simular recoveryConfiguration ni el selector de origen.
import { POST as requestRecovery } from "../src/app/api/auth/recovery/request/route";
import { POST as verifyRecovery } from "../src/app/api/auth/recovery/verify/route";
import { POST as updateRecovery } from "../src/app/api/auth/recovery/update/route";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as logout } from "../src/app/api/auth/logout/route";

const current = "https://current-deployment.vercel.app";
const previous = "https://previous-deployment.vercel.app";
const routes = [requestRecovery, verifyRecovery, updateRecovery, login, logout];
function request(body: unknown = {}, origin: string | null = current) {
  const headers = new Headers({ "content-type": "application/json", host: "evil.example",
    "x-forwarded-host": "evil.example", "x-forwarded-proto": "https",
    forwarded: "host=evil.example;proto=https" });
  if (origin !== null) headers.set("origin", origin);
  return new Request("http://internal/api/auth", { method: "POST", headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "current-deployment.vercel.app");
  vi.stubEnv("AUTH_SITE_URL", previous);
  vi.stubEnv("AUTH_RECOVERY_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("NODE_ENV", "production");
  mocks.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.auth.signInWithPassword.mockResolvedValue({ error: null });
  mocks.auth.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("Regresión de 403 tras Redeploy en todos los endpoints Auth", () => {
  it("solicita recuperación con el origen nuevo aunque AUTH_SITE_URL siga apuntando al anterior", async () => {
    const response = await requestRecovery(request({ email: "person@example.invalid", redirectTo: previous }));
    expect(response.status).toBe(200);
    expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith("person@example.invalid", {
      redirectTo: `${current}/recuperar/confirmar`,
    });
  });

  it("login, logout, validación del enlace y actualización aceptan el mismo origen actual", async () => {
    expect((await login(request({ email: "person@example.invalid", password: "fixture-only" }))).status).toBe(200);
    expect((await logout(request())).status).toBe(200);
    expect((await verifyRecovery(request())).status).toBe(400); // Cuerpo inválido, no rechazo de Origin.
    expect((await updateRecovery(request())).status).toBe(401); // Sin autorización de recuperación.
  });

  it.each([previous, "https://evil.example", "null", null])("rechaza Origin %s aunque Host sea manipulable", async origin => {
    for (const route of routes)
      expect((await route(request({}, origin))).status).toBe(403);
    expect(mocks.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.auth.signOut).not.toHaveBeenCalled();
  });

  it("Preview falla cerrado si falta VERCEL_URL y no recupera AUTH_SITE_URL antiguo", async () => {
    vi.stubEnv("VERCEL_URL", "");
    for (const route of [requestRecovery, verifyRecovery, updateRecovery])
      expect((await route(request({}, previous))).status).toBe(503);
    for (const route of [login, logout])
      expect((await route(request({}, previous))).status).toBe(403);
  });

  it("Production requiere origen explícito y no admite el origen Preview", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("AUTH_SITE_URL", "https://finance.example");
    for (const route of routes)
      expect((await route(request())).status).toBe(403);
    expect((await logout(request({}, "https://finance.example"))).status).toBe(200);
    vi.stubEnv("AUTH_SITE_URL", "");
    expect((await requestRecovery(request())).status).toBe(503);
    expect((await login(request())).status).toBe(403);
  });
});
