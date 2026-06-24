import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMainAdmin } from "./server-helpers.server";

/**
 * Lifecycle activity types emitted by the admin shell. Persisted to
 * `audit_logs` so the Main Admin's Employee Activity Feed sees a single
 * unified stream of sign-in/out, presence transitions, AND business
 * actions (inventory/orders) that already go through `logAudit`.
 */
const ACTIVITY_ACTIONS = [
  "auth.sign_in",
  "auth.sign_out",
  "presence.active",
  "presence.idle",
  "presence.away",
  "presence.online",
  "presence.offline",
] as const;

const logInput = z.object({
  action: z.enum(ACTIVITY_ACTIONS),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Any signed-in admin can record their own lifecycle event. Uses the
 * service-role client because `audit_logs` insert is restricted; the
 * actor_id is always set to the caller, never to a value the client
 * controls.
 */
export const logPresenceEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => logInput.parse(d))
  .handler(async ({ data, context }) => {
    // Only record events for users who hold an admin role (main or zone).
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role, assigned_zone_id")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some(
      (r) => r.role === "admin" || r.assigned_zone_id != null,
    );
    if (!isAdmin) return { ok: false as const, skipped: true };

    const zoneId =
      (roles ?? []).find((r) => r.assigned_zone_id)?.assigned_zone_id ?? null;
    const enriched = {
      ...(data.metadata ?? {}),
      ...(zoneId ? { zone_id: zoneId } : {}),
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      actor_email: (context.claims?.email as string | undefined) ?? null,
      action: data.action,
      entity: "admin_presence",
      entity_id: context.userId,
      metadata: enriched as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type ActivityFeedRow = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  zone_name: string | null;
  created_at: string;
};

const feedInput = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
  category: z.enum(["all", "lifecycle", "orders", "inventory"]).optional().default("all"),
});

/**
 * Main-admin only: returns the most recent admin activity events joined
 * with profile name + zone name for display. Mixes lifecycle events
 * (auth.*, presence.*) with business actions (order.*, inventory.*).
 */
export const listActivityFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => feedInput.parse(d))
  .handler(async ({ data, context }): Promise<ActivityFeedRow[]> => {
    await requireMainAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("audit_logs")
      .select("id, actor_id, actor_email, action, entity, entity_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.category === "lifecycle") {
      q = q.or("action.like.auth.%,action.like.presence.%");
    } else if (data.category === "orders") {
      q = q.like("action", "order.%");
    } else if (data.category === "inventory") {
      q = q.like("action", "inventory.%");
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const logs = rows ?? [];
    if (logs.length === 0) return [];

    const actorIds = Array.from(
      new Set(logs.map((r) => r.actor_id).filter((v): v is string => Boolean(v))),
    );
    const zoneIds = Array.from(
      new Set(
        logs
          .map((r) => (r.metadata as Record<string, unknown> | null)?.zone_id)
          .filter((v): v is string => typeof v === "string"),
      ),
    );

    const [profilesRes, zonesRes] = await Promise.all([
      actorIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name").in("id", actorIds)
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
      zoneIds.length
        ? supabaseAdmin.from("delivery_zones").select("id, name").in("id", zoneIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);
    const nameMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
    const zoneMap = new Map((zonesRes.data ?? []).map((z) => [z.id, z.name]));

    return logs.map((r) => {
      const md = (r.metadata ?? {}) as Record<string, unknown>;
      const zoneId = typeof md.zone_id === "string" ? md.zone_id : null;
      return {
        id: r.id,
        actor_id: r.actor_id,
        actor_email: r.actor_email,
        actor_name: r.actor_id ? nameMap.get(r.actor_id) ?? null : null,
        action: r.action,
        entity: r.entity,
        entity_id: r.entity_id,
        metadata: md,
        zone_name: zoneId ? zoneMap.get(zoneId) ?? null : null,
        created_at: r.created_at,
      };
    });
  });