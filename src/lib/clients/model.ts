export const clientColumns = "id,legal_name,email,phone,address,document_type,document_number,status";
export const contactColumns = "id,full_name,email,phone,job_title";
export type ClientRecord = {
  id: string; legal_name: string; email: string | null; phone: string | null;
  address: string | null; document_type: string | null; document_number: string | null;
  status: "active" | "inactive";
};
export type ContactRecord = {
  id: string; full_name: string; email: string | null; phone: string | null; job_title: string | null;
};
export type ListParams = Record<string, string | string[] | undefined>;
export const pageSize = 25;
export function listOptions(params: ListParams = {}) {
  const first = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const value = first("page");
  const page = /^[1-9]\d{0,4}$/.test(value) ? Number(value) : 1;
  const q = first("q").trim().slice(0, 100);
  const status = ["active", "inactive"].includes(first("status")) ? first("status") : "";
  return { page, q, status };
}
export function literalSearch(value: string) {
  // ILIKE debe buscar texto literal, sin comodines introducidos por el usuario.
  return value.replace(/[\\%_]/g, "\\$&");
}
export function listHref(base: string, options: ReturnType<typeof listOptions>, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (options.q) params.set("q", options.q);
  if (options.status) params.set("status", options.status);
  return `${base}?${params}`;
}
