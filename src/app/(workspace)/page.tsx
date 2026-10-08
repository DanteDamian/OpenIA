import { requireAccess } from "@/lib/auth/session";
import { Dashboard } from "@/features/dashboard/dashboard";
export default async function Home() {
  await requireAccess();
  return <Dashboard />;
}
