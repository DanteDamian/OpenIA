import { describe, it, expect } from "vitest";
import { readSupabaseConfig } from "../src/lib/supabase/config";
import { getModule, modules } from "../src/lib/modules";
describe("Configuración segura de Supabase", () => {
  it("permite trabajar sin credenciales", () =>
    expect(readSupabaseConfig({})).toBeNull());
  it("rechaza configuración incompleta", () =>
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toBeNull());
  it("rechaza URL inválida o sin TLS", () => {
    for (const url of ["invalid", "http://example.com"])
      expect(
        readSupabaseConfig({
          NEXT_PUBLIC_SUPABASE_URL: url,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
        }),
      ).toBeNull();
  });
  it("acepta configuración pública completa", () =>
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
      }),
    ).toEqual({ url: "https://example.supabase.co", key: "public-test-key" }));
});
describe("Rutas de módulos", () => {
  it("cada módulo tiene una ruta única resoluble", () => {
    expect(new Set(modules.map((m) => m.slug)).size).toBe(9);
    modules.forEach((m) => expect(getModule(m.slug)).toBe(m));
  });
  it("rechaza módulos desconocidos", () =>
    expect(getModule("no-existe")).toBeUndefined());
});
