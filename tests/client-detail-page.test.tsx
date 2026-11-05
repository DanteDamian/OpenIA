import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(),
  order: vi.fn(), range: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAccess: mocks.access }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); } }));
vi.mock("@/features/clients/new-client-form", () => ({ NewClientForm: () => <button>Editar cliente</button> }));
vi.mock("@/features/clients/contact-form", () => ({ ContactForm: () => <button>Guardar contacto</button> }));
import ClientPage from "../src/app/(workspace)/clientes/[id]/page";
const id = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.resetAllMocks();
  const query = { select: mocks.select, eq: mocks.eq, order: mocks.order, range: mocks.range, maybeSingle: mocks.maybeSingle };
  for (const method of [mocks.from, mocks.select, mocks.eq, mocks.order]) method.mockReturnValue(query);
  mocks.maybeSingle.mockResolvedValue({ data: { id, legal_name: "Entidad local", document_type: "NIT", document_number: "123-4",
    email: null, phone: "555", address: "Calle local", status: "active" }, error: null });
  mocks.range.mockResolvedValue({ data: [{ id: "local-contact", full_name: "Contacto local", job_title: "Responsable", email: null, phone: null }], count: 26, error: null });
  mocks.access.mockResolvedValue({ organizationId, role: "admin", supabase: { from: mocks.from } });
});
function page(page = "1", clientId = id) {
  return ClientPage({ params: Promise.resolve({ id: clientId }), searchParams: Promise.resolve({ page }) });
}
describe("Ficha del cliente y lectura de contactos", () => {
  it("consulta cliente y contactos dentro de la empresa y muestra datos y acciones", async () => {
    const html = renderToStaticMarkup(await page("2"));
    expect(html).toContain("Entidad local"); expect(html).toContain("NIT 123-4");
    expect(html).toContain("Contacto local"); expect(html).toContain("Editar cliente");
    expect(mocks.eq).toHaveBeenCalledWith("organization_id", organizationId);
    expect(mocks.eq).toHaveBeenCalledWith("client_id", id);
    expect(mocks.range).toHaveBeenCalledWith(25, 49);
  });
  it.each(["viewer", "accountant"])("permite lectura sin formularios de edición para %s", async role => {
    const access = await mocks.access(); mocks.access.mockResolvedValue({ ...access, role });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Contacto local");
    expect(html).not.toContain("Editar cliente"); expect(html).not.toContain("Guardar contacto");
  });
  it("devuelve not found para UUID inválido o cliente no visible", async () => {
    await expect(page("1", "invalid")).rejects.toThrow("not-found");
    expect(mocks.from).not.toHaveBeenCalled();
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(page()).rejects.toThrow("not-found");
    expect(mocks.from).toHaveBeenCalledOnce();
  });
  it("distingue fallos del proveedor y estados vacíos sin mostrar detalles privados", async () => {
    mocks.range.mockResolvedValue({ data: null, error: { message: "private detail" } });
    let html = renderToStaticMarkup(await page());
    expect(html).toContain("No fue posible consultar los contactos"); expect(html).not.toContain("private detail");
    mocks.range.mockResolvedValue({ data: [], error: null, count: 0 });
    html = renderToStaticMarkup(await page()); expect(html).toContain("Todavía no hay contactos");
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "private detail" } });
    html = renderToStaticMarkup(await page()); expect(html).toContain("No fue posible consultar la ficha");
    expect(html).not.toContain("private detail");
  });
});
