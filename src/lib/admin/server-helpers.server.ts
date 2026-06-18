import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function requireAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

/**
 * Resolves the caller's admin scope. Main admins ('admin' role) see everything;
 * zone admins (any user_roles row with assigned_zone_id) are scoped to that zone.
 * Throws if the caller is neither.
 */
export async function requireAdminScope(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ isMain: boolean; zoneId: string | null }> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, assigned_zone_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const isMain = rows.some((r) => r.role === "admin");
  const zoneRow = rows.find((r) => r.assigned_zone_id);
  const zoneId = (zoneRow?.assigned_zone_id as string | null) ?? null;
  if (!isMain && !zoneId) throw new Error("Forbidden: admin role required");
  return { isMain, zoneId };
}

export async function requireMainAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const scope = await requireAdminScope(supabase, userId);
  if (!scope.isMain) throw new Error("Forbidden: main admin required");
  return scope;
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