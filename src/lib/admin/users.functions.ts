import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

const listInput = z.object({
  search: z.string().optional().default(""),
  role: z.string().optional().default(""),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(200).optional().default(25),
});

export type AdminUserRow = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  email_confirmed_at: string | null;
  roles: string[];
};

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { search, role, page, pageSize } = data;

    // Auth admin listUsers paginates server-side; we fetch a single page wide
    // enough to filter when needed.
    const perPage = Math.max(pageSize, 100);
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = list.users ?? [];
    const ids = users.map((u) => u.id);

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, phone, avatar_url").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rolesMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const list = rolesMap.get(r.user_id) ?? [];
      list.push(r.role as string);
      rolesMap.set(r.user_id, list);
    }

    let rows: AdminUserRow[] = users.map((u) => {
      const p = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        phone: (u.phone as string | null) ?? p?.phone ?? null,
        full_name: p?.full_name ?? (u.user_metadata?.full_name as string | undefined) ?? null,
        avatar_url: p?.avatar_url ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        banned_until: (u as { banned_until?: string | null }).banned_until ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        roles: rolesMap.get(u.id) ?? [],
      };
    });

    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((r) =>
        (r.email ?? "").toLowerCase().includes(s) ||
        (r.full_name ?? "").toLowerCase().includes(s) ||
        (r.phone ?? "").toLowerCase().includes(s),
      );
    }
    if (role) rows = rows.filter((r) => r.roles.includes(role));

    const total = list.total ?? rows.length;
    return { rows, total, page, pageSize };
  });

export const getUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(data.id);
    if (error) throw new Error(error.message);
    const [{ data: profile }, { data: roles }, { data: orders }, { data: activity }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.id),
      supabaseAdmin.from("orders").select("id, order_number, status, total_zar, created_at").eq("user_id", data.id).order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("audit_logs").select("id, action, entity, entity_id, created_at, metadata").eq("actor_id", data.id).order("created_at", { ascending: false }).limit(20),
    ]);
    return {
      user: user.user,
      profile: profile ?? null,
      roles: (roles ?? []).map((r) => r.role as string),
      orders: orders ?? [],
      activity: activity ?? [],
    };
  });

export const setUserBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), suspend: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("You cannot suspend your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Supabase v2 admin accepts `ban_duration` as e.g. "876000h" or "none"
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      ban_duration: data.suspend ? "876000h" : "none",
    } as never);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, data.suspend ? "user.suspend" : "user.activate", "user", data.id);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "user.delete", "user", data.id);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "user"]), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role === "admin" && !data.enabled) {
      throw new Error("You cannot remove your own admin role");
    }
    if (data.enabled) {
      const { error } = await context.supabase
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    await logAudit(context.supabase, data.enabled ? "user.role_grant" : "user.role_revoke", "user", data.userId, { role: data.role });
    return { ok: true };
  });

export const userStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    const total = list?.total ?? 0;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: newCount } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    const { count: adminCount } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    return { total, newLast7d: newCount ?? 0, admins: adminCount ?? 0 };
  });