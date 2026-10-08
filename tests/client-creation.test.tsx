import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({
  access: vi.fn(), from: vi.fn(), insert: vi.fn(), select: vi.fn(), single: vi.fn(),
  eq: vi.fn(), order: vi.fn(), limit: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getAccess: mocks.access, requireAccess: mocks.access }));
vi.mock("@/features/clients/new-client-form", () => ({ NewClientForm: () => <button>Nuevo cliente</button> }));
import { POST } from "../src/app/api/clients/route";
import { ClientList } from "../src/features/clients/client-list";
const organizationId = "11111111-1111-4111-8111-111111111111";
function request(body: unknown, origin = "https://current.vercel.app") {
  return new Request("https://current.vercel.app/api/clients", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "current.vercel.app");
  const query = { insert: mocks.insert, select: mocks.select, single: mocks.single,
    eq: mocks.eq, order: mocks.order, limit: mocks.limit };
  for (const method of [mocks.from, mocks.insert, mocks.select, mocks.eq, mocks.order]) method.mockReturnValue(query);
  mocks.single.mockResolvedValue({ data: { id: "local-client" }, error: null });
  mocks.limit.mockResolvedValue({ data: [], error: null });
  mocks.access.mockResolvedValue({ status: "authorized", role: "admin", organizationId,
    supabase: { from: mocks.from } });
});
afterEach(() => vi.unstubAllEnvs());

describe("Registro protegido de clientes", () => {
  it.each(["admin", "manager"])("permite %s y asigna la empresa exclusivamente desde servidor", async role => {
    const access = await mocks.access();
    mocks.access.mockResolvedValue({ ...access, role });
    const response = await POST(request({ legal_name: "Entidad local", email: null }));
    expect(response.status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledWith({ legal_name: "Entidad local", email: null, organization_id: organizationId });
  });
  it.each(["viewer", "accountant"])("oculta el formulario y rechaza escrituras de %s", async role => {
    const access = await mocks.access();
    mocks.access.mockResolvedValue({ ...access, role });
    expect(renderToStaticMarkup(await ClientList())).not.toContain("Nuevo cliente");
    expect((await POST(request({ legal_name: "Entidad local" }))).status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("muestra el formulario al administrador incluso con lista vacía", async () => {
    const html = renderToStaticMarkup(await ClientList());
    expect(html).toContain("Nuevo cliente");
    expect(html).toContain("Todavía no hay clientes");
  });
  it("rechaza CSRF, sesiones ausentes y organizaciones inyectadas antes de insertar", async () => {
    expect((await POST(request({ legal_name: "Entidad local" }, "https://evil.example"))).status).toBe(403);
    expect(mocks.access).not.toHaveBeenCalled();
    expect((await POST(request({ legal_name: "Entidad local", organization_id: "other" }))).status).toBe(400);
    mocks.access.mockResolvedValue({ status: "unauthenticated" });
    expect((await POST(request({ legal_name: "Entidad local" }))).status).toBe(401);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("no devuelve éxito ni detalles de base de datos cuando Supabase rechaza el alta", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: "private database detail" } });
    const response = await POST(request({ legal_name: "Entidad local" }));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private database detail");
  });
});
