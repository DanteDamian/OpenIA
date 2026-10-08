import Link from "next/link";
import { listHref, pageSize, type listOptions } from "@/lib/clients/model";
export function Pagination({ base, options, total, extra = {} }: {
  base: string; options: ReturnType<typeof listOptions>; total: number; extra?: Record<string,string>;
}) {
  const href=(page:number)=>{ const path=listHref(base,options,page); const params=new URLSearchParams(extra); return params.size ? `${path}&${params}` : path; };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav aria-label="Paginación" className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm">
    <p>{total} registros · Página {options.page} de {pages}</p>
    <div className="flex gap-4">
      {options.page > 1 && <Link className="underline" href={href(Math.min(options.page - 1, pages))}>Anterior</Link>}
      {options.page < pages && <Link className="underline" href={href(options.page + 1)}>Siguiente</Link>}
      {options.page > pages && <Link className="underline" href={href(1)}>Primera página</Link>}
    </div>
  </nav>;
}
