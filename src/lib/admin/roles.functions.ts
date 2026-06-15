import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

const PERMISSIONS = [
  "orders.read","orders.write","orders.refund",
  "products.read","products.write",
  "categories.read","categories.write",
  "inventory.read","inventory.write",
  "reviews.read","reviews.moderate",
  "users.read","users.write",
  "roles.read","roles.write",
  "audit.read",
  "content.read","content.write",
  "notifications.read","notifications.write",
  "reports.read","analytics.read",
  "integrations.read","integrations.write",
  "security.read","security.write",
  "settings.read","settings.write",
] as const;
const ROLES = ["admin", "user"] as const;
export const ALL_PERMISSIONS = PERMISSIONS;
export const ALL_ROLES = ROLES;

export const getRoleMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("role_permissions").select("role, permission");
    if (error) throw new Error(error.message);
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const r of ROLES) {
      matrix[r] = {};
      for (const p of PERMISSIONS) matrix[r][p] = false;
    }
    for (const row of data ?? []) {
      const role = row.role as string;
      const perm = row.permission as string;
      if (matrix[role]) matrix[role][perm] = true;
    }
    return { matrix, roles: ROLES as readonly string[], permissions: PERMISSIONS as readonly string[] };
  });

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      role: z.enum(ROLES),
      permission: z.enum(PERMISSIONS),
      enabled: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.enabled) {
      const { error } = await context.supabase
        .from("role_permissions")
        .upsert({ role: data.role, permission: data.permission }, { onConflict: "role,permission" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("role_permissions")
        .delete()
        .eq("role", data.role)
        .eq("permission", data.permission);
      if (error) throw new Error(error.message);
    }
    await logAudit(context, data.enabled ? "role.permission_grant" : "role.permission_revoke", "role", data.role, { permission: data.permission });
    return { ok: true };
  });

export const listRoleAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name as string | null]));
    // Pull emails via auth admin (single page; admins are few)
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailMap = new Map((list?.users ?? []).map((u) => [u.id, u.email ?? null]));
    return (roleRows ?? []).map((r) => ({
      user_id: r.user_id,
      role: r.role as string,
      created_at: r.created_at as string,
      full_name: nameMap.get(r.user_id) ?? null,
      email: emailMap.get(r.user_id) ?? null,
    }));
  });