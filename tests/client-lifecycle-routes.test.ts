import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn(), select: vi.fn(), insert: vi.fn(),
  update: vi.fn(), eq: vi.fn(), order: vi.fn(), ilike: vi.fn(), range: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAccess: mocks.access }));
import { GET, PATCH as editClient } from "../src/app/api/clients/route";
import { POST as addContact, PATCH as editContact } from "../src/app/api/clients/[id]/contacts/route";
const clientId = "11111111-1111-4111-8111-111111111111";
const contactId = "22222222-2222-4222-8222-222222222222";
const organizationId = "33333333-3333-4333-8333-333333333333";
const context = { params: Promise.resolve({ id: clientId }) };
function request(body: unknown, id = contactId, origin = "https://current.vercel.app") {
  return new Request(`https://current.vercel.app/api/clients?id=${id}`, {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_URL", "current.vercel.app");
  const query = { select: mocks.select, insert: mocks.insert, update: mocks.update, eq: mocks.eq,
    order: mocks.order, ilike: mocks.ilike, range: mocks.range, maybeSingle: mocks.maybeSingle };
  for (const method of [mocks.from, mocks.select, mocks.insert, mocks.update, mocks.eq, mocks.order, mocks.ilike]) method.mockReturnValue(query);
  mocks.maybeSingle.mockResolvedValue({ data: { id: contactId }, error: null });
  mocks.range.mockResolvedValue({ data: [], error: null, count: 26 });
  mocks.access.mockResolvedValue({ status: "authorized", role: "admin", organizationId, supabase: { from: mocks.from } });
});
afterEach(() => vi.unstubAllEnvs());
describe("Consultas y edición de clientes y contactos", () => {
  it("filtra empresa y estado, escapa búsqueda y consulta solo la página solicitada", async () => {
    const response = await GET(new Request("https://current.vercel.app/api/clients?page=2&q=100%25_&status=inactive"));
    expect(response.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("organization_id", organizationId);
    expect(mocks.eq).toHaveBeenCalledWith("status", "inactive");
    expect(mocks.ilike).toHaveBeenCalledWith("legal_name", "%100\\%\\_%");
    expect(mocks.range).toHaveBeenCalledWith(25, 49);
    expect(await response.json()).toEqual({ clients: [], total: 26, page: 2, pageSize: 25 });
  });
  it("edita ficha/estado sin cambiar la organización o los autores", async () => {
    const response = await editClient(request({ legal_name: "Entidad", status: "inactive", phone: null }, clientId));
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ legal_name: "Entidad", status: "inactive", phone: null });
    expect(mocks.eq).toHaveBeenCalledWith("id", clientId);
    expect(mocks.eq).toHaveBeenCalledWith("organization_id", organizationId);
  });
  it("no divulga registros de otra organización o contactos de otro cliente", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await editClient(request({ legal_name: "Entidad" }, clientId))).status).toBe(404);
    expect((await addContact(request({ full_name: "Contacto" }), context)).status).toBe(404);
    expect(mocks.insert).not.toHaveBeenCalled();
    mocks.maybeSingle.mockResolvedValueOnce({ data: { id: clientId }, error: null });
    expect((await editContact(request({ full_name: "Contacto" }), context)).status).toBe(404);
    expect(mocks.eq).toHaveBeenCalledWith("client_id", clientId);
    expect(mocks.eq).toHaveBeenCalledWith("id", contactId);
  });
  it.each(["admin", "manager"])("permite a %s registrar contactos con padre verificado", async role => {
    const access = await mocks.access(); mocks.access.mockResolvedValue({ ...access, role });
    expect((await addContact(request({ full_name: "Contacto", email: null }), context)).status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledWith({ full_name: "Contacto", email: null, organization_id: organizationId, client_id: clientId });
    expect(mocks.from.mock.calls.map(call => call[0])).toEqual(["clients", "contacts"]);
  });
  it("rechaza CSRF y mass assignment antes de consultar el cliente", async () => {
    expect((await addContact(request({ full_name: "Contacto" }, contactId, "https://evil.example"), context)).status).toBe(403);
    expect(mocks.access).not.toHaveBeenCalled();
    for (const extra of [{ organization_id: "other" }, { client_id: "other" }, { created_by: "other" }])
      expect((await addContact(request({ full_name: "Contacto", ...extra }), context)).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each(["viewer", "accountant"])("rechaza edición y contactos para %s", async role => {
    const access = await mocks.access(); mocks.access.mockResolvedValue({ ...access, role });
    expect((await editClient(request({ legal_name: "Entidad" }, clientId))).status).toBe(403);
    for (const route of [addContact, editContact]) expect((await route(request({ full_name: "Contacto" }), context)).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rechaza sesión ausente, IDs inválidos y fallos de proveedor sin divulgar detalles", async () => {
    expect((await editContact(request({ full_name: "Contacto" }, "invalid"), context)).status).toBe(400);
    expect((await addContact(request({ full_name: "Contacto" }), { params: Promise.resolve({ id: "invalid" }) })).status).toBe(400);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "sensitive detail" } });
    const unavailable = await addContact(request({ full_name: "Contacto" }), context);
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("sensitive detail");
    mocks.access.mockResolvedValue({ status: "unauthenticated" });
    expect((await addContact(request({ full_name: "Contacto" }), context)).status).toBe(401);
  });
  it("devuelve un fallo acotado cuando no se puede guardar un contacto", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: { id: clientId }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "sensitive detail" } });
    const response = await addContact(request({ full_name: "Contacto" }), context);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("sensitive detail");
  });
});
