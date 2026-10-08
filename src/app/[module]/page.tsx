import { notFound } from "next/navigation";
import { getModule, modules } from "@/lib/modules";
import { ModulePage } from "@/features/modules/module-page";
export function generateStaticParams() {
  return modules.map((item) => ({ module: item.slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const selectedModule = getModule((await params).module);
  if (!selectedModule) notFound();
  return <ModulePage module={selectedModule} />;
}
