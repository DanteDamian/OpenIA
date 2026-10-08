import { describe, expect, it } from "vitest";
import { clientInput, contactInput } from "../src/lib/auth/validation";
import { listOptions, literalSearch, listHref } from "../src/lib/clients/model";

describe("Ficha y filtros de clientes", () => {
  it("normaliza datos completos y permite limpiar campos opcionales", () => {
    expect(clientInput({ legal_name: " Entidad local ", document_type: "NIT", document_number: " 123-4 ",
      email: " contact@example.invalid ", phone: " 555 ", address: " Calle local ", status: "inactive" }))
      .toEqual({ legal_name: "Entidad local", document_type: "NIT", document_number: "123-4",
        email: "contact@example.invalid", phone: "555", address: "Calle local", status: "inactive" });
    expect(clientInput({ legal_name: "Entidad", document_type: "", document_number: "", phone: "", address: null }))
      .toMatchObject({ document_type: null, document_number: null, phone: null, address: null });
  });
  const invalidInputs: Record<string, unknown>[] = [
    { document_type: "NIT" }, { document_number: "123" }, { document_type: null }, { document_number: null },
    { document_type: "INVALID", document_number: "123" },
    { status: "deleted" }, { status: null }, { phone: "x".repeat(41) },
    { address: "x".repeat(1001) }, { document_number: "x".repeat(41), document_type: "NIT" },
    { email: "invalid" }, { created_by: "injected" }, { updated_by: "injected" },
    { organization_id: "other" }, { constructor: "injected" },
  ];
  for (const extra of invalidInputs) it(`rechaza ficha inválida o campos administrados por servidor: ${JSON.stringify(extra)}`, () => {
    expect(clientInput({ legal_name: "Entidad", ...extra })).toBeNull();
  });
  it("la edición conserva campos omitidos y permite borrarlos explícitamente", () => {
    expect(clientInput({ legal_name: "Entidad" }, true)).toEqual({ legal_name: "Entidad" });
    expect(contactInput({ full_name: "Contacto" }, true)).toEqual({ full_name: "Contacto" });
    expect(contactInput({ full_name: "Contacto", email: null }, true)).toEqual({ full_name: "Contacto", email: null });
  });
  it("valida contactos sin permitir cambiar padre, empresa ni autor", () => {
    expect(contactInput({ full_name: " Contacto local ", job_title: " Responsable ", email: "", phone: null }))
      .toEqual({ full_name: "Contacto local", job_title: "Responsable", email: null, phone: null });
    for (const extra of [{ client_id: "other" }, { organization_id: "other" }, { updated_by: "other" },
      { full_name: " " }, { full_name: "x".repeat(201) }, { email: "invalid" }, { job_title: "x".repeat(201) }, { phone: 12 }])
      expect(contactInput({ full_name: "Contacto", ...extra })).toBeNull();
  });
  it("limita consultas y conserva filtros al paginar sin introducir comodines", () => {
    expect(listOptions({ q: " Entidad ", status: "inactive", page: "2" })).toEqual({ q: "Entidad", status: "inactive", page: 2 });
    for (const page of ["-1", "0", "999999", "1e3", "Infinity", "2.5", "abc"])
      expect(listOptions({ page }).page).toBe(1);
    expect(listOptions({ q: ["unexpected"], page: ["2"], status: "other" })).toEqual({ q: "", status: "", page: 1 });
    expect(listOptions({ q: "x".repeat(101) }).q).toHaveLength(100);
    expect(literalSearch("100%_\\")).toBe("100\\%\\_\\\\");
    expect(listHref("/clientes", { page: 1, q: "Entidad & local", status: "active" }, 2))
      .toBe("/clientes?page=2&q=Entidad+%26+local&status=active");
  });
});
