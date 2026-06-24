import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMainAdmin } from "./server-helpers.server";

const statusEnum = z.enum(["online", "active", "idle", "away", "offline"]);

const pingInput = z.object({
  status: statusEnum,
  userAgent: z.string().max(500).optional(),
  isLogin: z.boolean().optional(),
});

/**
 * Upserts the caller's own presence row. Called every ~20s by the admin shell
 * while the user is signed in, plus on login (with isLogin=true) and on
 * status transitions (idle/away/active/offline).
 */
export const pingPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pingInput.parse(d))
  .handler(async ({ data, context }) => {
    // Look up the user's assigned zone (if any) so the Main Admin can see
    // which zone the employee is currently managing.
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("assigned_zone_id")
      .eq("user_id", context.userId)
      .not("assigned_zone_id", "is", null)
      .maybeSingle();

    const now = new Date().toISOString();
    const isActive = data.status === "active" || data.status === "online";
    const { error } = await context.supabase
      .from("admin_presence")
      .upsert(
        {
          user_id: context.userId,
          status: data.status,
          assigned_zone_id: roleRow?.assigned_zone_id ?? null,
          user_agent: data.userAgent ?? null,
          last_heartbeat_at: now,
          ...(isActive ? { last_active_at: now } : {}),
          ...(data.isLogin ? { login_at: now } : {}),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Marks the caller as offline. Used on sign-out and (best-effort) on
 * beforeunload via a keepalive request.
 */
export const endPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("admin_presence")
      .upsert(
        {
          user_id: context.userId,
          status: "offline",
          last_heartbeat_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type AdminPresenceRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  assigned_zone_id: string | null;
  assigned_zone_name: string | null;
  status: "online" | "active" | "idle" | "away" | "offline";
  user_agent: string | null;
  login_at: string | null;
  last_active_at: string;
  last_heartbeat_at: string;
};

/**
 * Main-admin only: lists every admin user (main + zone admins) joined with
 * their latest presence row, profile, and assigned zone name. Anyone without
 * a presence row yet is returned as "offline" so the dashboard always shows
 * the full roster.
 */
export const listAdminPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPresenceRow[]> => {
    await requireMainAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, assigned_zone_id");
    if (rolesErr) throw new Error(rolesErr.message);

    const adminRows = (roles ?? []).filter(
      (r) => r.role === "admin" || r.assigned_zone_id != null,
    );
    const ids = Array.from(new Set(adminRows.map((r) => r.user_id)));
    if (ids.length === 0) return [];

    const [{ data: presence }, { data: profiles }, { data: zones }, authList] =
      await Promise.all([
        supabaseAdmin.from("admin_presence").select("*").in("user_id", ids),
        supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
        supabaseAdmin.from("delivery_zones").select("id, name"),
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      ]);

    const presenceMap = new Map((presence ?? []).map((p) => [p.user_id, p]));
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const zoneMap = new Map((zones ?? []).map((z) => [z.id, z.name]));
    const emailMap = new Map(
      (authList.data?.users ?? []).map((u) => [u.id, u.email ?? null]),
    );

    // Collapse multiple role rows per user into one (prefer main admin).
    const byUser = new Map<string, { role: string; zone: string | null }>();
    for (const r of adminRows) {
      const existing = byUser.get(r.user_id);
      if (!existing || r.role === "admin") {
        byUser.set(r.user_id, {
          role: r.role === "admin" ? "Main Admin" : "Zone Admin",
          zone: (r.assigned_zone_id as string | null) ?? existing?.zone ?? null,
        });
      } else if (!existing.zone && r.assigned_zone_id) {
        existing.zone = r.assigned_zone_id as string;
      }
    }

    const now = Date.now();
    return ids.map((id) => {
      const meta = byUser.get(id)!;
      const p = presenceMap.get(id);
      const profile = profileMap.get(id);
      // Treat stale heartbeats (>60s old) as offline regardless of stored value.
      let status: AdminPresenceRow["status"] = (p?.status as AdminPresenceRow["status"]) ?? "offline";
      if (p?.last_heartbeat_at) {
        const age = now - new Date(p.last_heartbeat_at).getTime();
        if (age > 60_000 && status !== "offline") status = "offline";
      }
      return {
        user_id: id,
        email: emailMap.get(id) ?? null,
        full_name: profile?.full_name ?? null,
        role: meta.role,
        assigned_zone_id: meta.zone,
        assigned_zone_name: meta.zone ? zoneMap.get(meta.zone) ?? null : null,
        status,
        user_agent: p?.user_agent ?? null,
        login_at: p?.login_at ?? null,
        last_active_at: p?.last_active_at ?? p?.last_heartbeat_at ?? new Date(0).toISOString(),
        last_heartbeat_at: p?.last_heartbeat_at ?? new Date(0).toISOString(),
      };
    });
  });