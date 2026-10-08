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
    expect(sameOrigin(new Request("https://app.example/api"))).toBe(false);
    expect(
      sameOrigin(
        new Request("https://app.example/api", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
    expect(
      sameOrigin(
        new Request("https://app.example/api", {
          headers: { origin: "https://app.example" },
        }),
      ),
    ).toBe(true);
  });
  it("usa Host canónico de Next.js e ignora X-Forwarded-Host", () => {
    expect(sameOrigin(new Request("http://localhost:3000/api", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } }))).toBe(true);
    expect(sameOrigin(new Request("https://app.example/api", { headers: { host: "app.example", origin: "https://evil.example", "x-forwarded-host": "evil.example" } }))).toBe(false);
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
