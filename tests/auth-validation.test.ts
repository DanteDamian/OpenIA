import { describe, expect, it } from "vitest";
import {
  clientInput,
  validUuid,
  canManageClients,
  sameOrigin,
} from "../src/lib/auth/validation";
import { readSupabaseConfig } from "../src/lib/supabase/config";
describe("Límites de autorización", () => {
  it("solo admin y manager pueden editar clientes", () => {
    expect(canManageClients("admin")).toBe(true);
    expect(canManageClients("manager")).toBe(true);
    for (const role of ["viewer", "accountant", "owner", ""])
      expect(canManageClients(role)).toBe(false);
  });
  it("rechaza mass assignment de empresa, autores e IDs", () => {
    for (const field of ["organization_id", "created_by", "id", "role_id"])
      expect(
        clientInput({ legal_name: "Nombre", [field]: "injected" }),
      ).toBeNull();
  });
  it("valida nombre y correo", () => {
    expect(clientInput({ legal_name: "  " })).toBeNull();
    expect(clientInput({ legal_name: "Nombre", email: "invalid" })).toBeNull();
    expect(clientInput({ legal_name: " Nombre " })).toEqual({
      legal_name: "Nombre",
      email: null,
    });
  });
  it("rechaza CSRF sin Origin o desde otro origen", () => {
    const env = { AUTH_SITE_URL: "https://app.example" };
    expect(sameOrigin(new Request("https://app.example/api"), env)).toBe(false);
    for (const origin of ["https://evil.example", "null", "https://app.example"])
      expect(sameOrigin(new Request("http://internal/api", {
        headers: { origin },
      }), env)).toBe(origin === "https://app.example");
  });
  it("ignora Host y encabezados reenviados al determinar el origen confiable", () => {
    const env = { AUTH_SITE_URL: "https://app.example" };
    expect(sameOrigin(new Request("http://internal/api", {
      headers: { host: "evil.example", origin: "https://evil.example",
        "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" },
    }), env)).toBe(false);
    expect(sameOrigin(new Request("http://internal/api", {
      headers: { host: "internal", origin: "https://app.example" },
    }), env)).toBe(true);
  });
  it("valida UUID", () => {
    expect(validUuid("invalid")).toBe(false);
    expect(validUuid("12345678-1234-1234-1234-123456789abc")).toBe(true);
  });
  it("solo permite HTTP en loopback y prohíbe credenciales en URL", () => {
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test",
      }),
    ).not.toBeNull();
    const credentialUrl = new URL("https://example.com");
    credentialUrl.username = "fixture-user";
    credentialUrl.password = "fixture-password";
    for (const url of [
      "http://remote.example",
      credentialUrl.toString(),
      "http://127.0.0.1.evil.example",
      "https://example.com/?x=1",
    ])
      expect(
        readSupabaseConfig({
          NEXT_PUBLIC_SUPABASE_URL: url,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test",
        }),
      ).toBeNull();
  });
});
