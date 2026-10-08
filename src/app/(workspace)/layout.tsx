import { AppShell } from "@/components/layout/app-shell";
import { requireAccess } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireAccess();
  return <AppShell role={access.role}>{children}</AppShell>;
}
