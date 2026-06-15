import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./server-helpers.server";

export const securityOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const sb = context.supabase;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [users, admins, roles, recentLogins, failedAttempts, mfaWrites] = await Promise.all([
      sb.from("profiles").select("id", { count: "exact", head: true }),
      sb.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin"),
      sb.from("role_permissions").select("role", { count: "exact", head: true }),
      sb.from("audit_logs").select("created_at, actor_email, action, metadata").in("action", ["auth.login", "user.suspend", "user.role.grant", "user.role.revoke"]).gte("created_at", since).order("created_at", { ascending: false }).limit(20),
      sb.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "auth.login_failed").gte("created_at", since),
      sb.from("audit_logs").select("id", { count: "exact", head: true }).in("action", ["auth.mfa.enable", "auth.mfa.disable"]).gte("created_at", since),
    ]);
    return {
      users: users.count ?? 0,
      admins: admins.count ?? 0,
      permissionEntries: roles.count ?? 0,
      failedLogins7d: failedAttempts.count ?? 0,
      mfaChanges7d: mfaWrites.count ?? 0,
      recent: recentLogins.data ?? [],
    };
  });
