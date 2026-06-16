import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin console — Sweet & Lovely" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth/admin" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, assigned_zone_id")
      .eq("user_id", data.user.id);
    const rows = (roles ?? []) as Array<{ role: string; assigned_zone_id: string | null }>;
    const isMain = rows.some((r) => r.role === "admin");
    const isZone = rows.some((r) => r.assigned_zone_id);
    if (!isMain && !isZone) throw redirect({ to: "/account" });
  },
  component: AdminShell,
});