import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  assertAccountUsable,
  assertWithinWorkingHours,
  recordSecurityEvent,
  evaluateSuspiciousActivity,
  type AdminClaims,
} from "./security-core.server";

export async function requireAdmin(supabase: SupabaseClient<Database>, userId: string) {
  await assertAccountUsable(userId);
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    await recordSecurityEvent({
      userId, type: "access_denied_not_admin", severity: "medium",
      message: "Non-admin attempted a main-admin operation",
    });
    void evaluateSuspiciousActivity(userId);
    throw new Error("Forbidden: admin role required");
  }
}

/**
 * Resolves the caller's admin scope. Main admins ('admin' role) see everything;
 * zone admins (any user_roles row with assigned_zone_id) are scoped to that zone.
 * Throws if the caller is neither.
 */
export async function requireAdminScope(
  supabase: SupabaseClient<Database>,
  userId: string,
  claims?: AdminClaims,
): Promise<{ isMain: boolean; zoneId: string | null }> {
  await assertAccountUsable(userId, claims);
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, assigned_zone_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const isMain = rows.some((r) => r.role === "admin");
  const zoneRow = rows.find((r) => r.assigned_zone_id);
  const zoneId = (zoneRow?.assigned_zone_id as string | null) ?? null;
  if (!isMain && !zoneId) {
    await recordSecurityEvent({
      userId, email: claims?.email, type: "access_denied_no_admin_scope", severity: "medium",
      message: "Account without admin scope attempted an admin operation",
    });
    void evaluateSuspiciousActivity(userId, claims?.email);
    throw new Error("Forbidden: admin role required");
  }
  if (!isMain) await assertWithinWorkingHours(zoneId, userId, claims);
  return { isMain, zoneId };
}

export async function requireMainAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
  claims?: AdminClaims,
) {
  const scope = await requireAdminScope(supabase, userId, claims);
  if (!scope.isMain) {
    await recordSecurityEvent({
      userId, email: claims?.email, zoneId: scope.zoneId, type: "access_denied_main_admin_only", severity: "high",
      message: "Zone admin attempted a main-admin-only operation",
    });
    void evaluateSuspiciousActivity(userId, claims?.email);
    throw new Error("Forbidden: main admin required");
  }
  return scope;
}

/**
 * Server-side zone isolation check. Any admin operation that targets a
 * specific delivery zone must pass through here; cross-zone attempts are
 * denied and recorded as security events.
 */
export async function assertZoneAccess(
  scope: { isMain: boolean; zoneId: string | null },
  targetZoneId: string | null | undefined,
  ctx: { userId: string; claims?: AdminClaims },
  entity = "record",
) {
  if (scope.isMain) return;
  if (!targetZoneId || targetZoneId !== scope.zoneId) {
    await recordSecurityEvent({
      userId: ctx.userId, email: ctx.claims?.email, zoneId: scope.zoneId,
      type: "cross_zone_access_denied", severity: "high",
      message: `Zone admin attempted to access ${entity} outside their assigned zone`,
      metadata: { entity, target_zone_id: targetZoneId ?? null },
    });
    void evaluateSuspiciousActivity(ctx.userId, ctx.claims?.email);
    throw new Error("Forbidden: this record belongs to another delivery zone");
  }
}

export interface AuditContext {
  userId: string;
  claims?: { email?: string | null } & Record<string, unknown>;
}

export async function logAudit(
  ctx: AuditContext,
  action: string,
  entity?: string | null,
  entityId?: string | null,
  metadata: Record<string, unknown> = {},
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Best-effort: tag every audit entry with the actor's assigned zone (if any)
    // so the audit log can be sliced per delivery zone.
    let zoneId: string | null = null;
    try {
      const { data } = await supabaseAdmin
        .from("user_roles")
        .select("assigned_zone_id")
        .eq("user_id", ctx.userId)
        .not("assigned_zone_id", "is", null)
        .maybeSingle();
      zoneId = (data?.assigned_zone_id as string | null) ?? null;
    } catch {
      // ignore — audit must never break the calling operation
    }
    const enriched =
      zoneId && metadata && typeof metadata === "object" && !("zone_id" in metadata)
        ? { ...metadata, zone_id: zoneId }
        : metadata;
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: ctx.userId,
      actor_email: (ctx.claims?.email as string | undefined) ?? null,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      metadata: enriched as never,
    });
  } catch (e) {
    console.error("[audit] log failed", e);
  }
}