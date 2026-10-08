import Link from "next/link";
import { listHref, pageSize, type listOptions } from "@/lib/clients/model";
export function Pagination({ base, options, total }: {
  base: string; options: ReturnType<typeof listOptions>; total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav aria-label="Paginación" className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm">
    <p>{total} registros · Página {options.page} de {pages}</p>
    <div className="flex gap-4">
      {options.page > 1 && <Link className="underline" href={listHref(base, options, Math.min(options.page - 1, pages))}>Anterior</Link>}
      {options.page < pages && <Link className="underline" href={listHref(base, options, options.page + 1)}>Siguiente</Link>}
      {options.page > pages && <Link className="underline" href={listHref(base, options, 1)}>Primera página</Link>}
    </div>
  </nav>;
}
