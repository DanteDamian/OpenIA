import { ClientList } from "@/features/clients/client-list";
import { requireAccess } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { getModule, modules } from "@/lib/modules";
import { ModulePage } from "@/features/modules/module-page";
export function generateStaticParams() {
  return modules.map((item) => ({ module: item.slug }));
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const selectedModule = getModule((await params).module);
  if (!selectedModule) notFound();
  await requireAccess();
  if (selectedModule.slug === "clientes") return <ClientList params={await searchParams} />;
  return <ModulePage module={selectedModule} />;
}
