import { redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side `beforeLoad` guard for main-admin-only admin routes.
 * Runs inside the `_authenticated` subtree (ssr: false), so it can read
 * the Supabase session from localStorage directly.
 *
 * Behaviour:
 *  - Unauthenticated  → redirect to /auth/admin (defence in depth; the
 *                       _authenticated layout already does this)
 *  - Zone admin       → toast "Access Restricted" + redirect to /admin
 *  - Plain customer   → redirect to /account
 *  - Main admin       → allow through
 */
export async function requireMainAdminGuard() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw redirect({ to: "/auth/admin" });

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role, assigned_zone_id")
    .eq("user_id", user.id);

  const rows = (roleRows ?? []) as Array<{ role: string; assigned_zone_id: string | null }>;
  const isMain = rows.some((r) => r.role === "admin");
  if (isMain) return;

  const isZone = rows.some((r) => r.assigned_zone_id);
  if (isZone) {
    if (typeof window !== "undefined") {
      toast.error("Access Restricted", {
        description: "Employee admins can only manage their assigned delivery zone.",
      });
    }
    throw redirect({ to: "/admin", replace: true });
  }
  throw redirect({ to: "/account", replace: true });
}