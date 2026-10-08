import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validUuid } from "./validation";
export const getAccess = cache(async () => {
  if (!getSupabaseConfig()) return { status: "unconfigured" as const };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { status: "unauthenticated" as const };
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id,role_id")
    .eq("user_id", user.id)
    .order("organization_id");
  if (membershipError) return { status: "unavailable" as const };
  const selected = (await cookies()).get("aigenterra-org")?.value;
  const membership = selected
    ? memberships?.find(
        (item) => validUuid(selected) && item.organization_id === selected,
      )
    : memberships?.[0];
  if (!membership) return { status: "forbidden" as const };
  return {
    status: "authorized" as const,
    supabase,
    userId: user.id,
    organizationId: membership.organization_id as string,
    role: membership.role_id as string,
  };
});
export async function requireAccess() {
  const access = await getAccess();
  if (access.status === "unauthenticated" || access.status === "unconfigured")
    redirect("/login");
  if (access.status !== "authorized") redirect("/sin-acceso");
  return access;
}
