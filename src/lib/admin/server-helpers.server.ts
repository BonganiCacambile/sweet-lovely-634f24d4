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
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: ctx.userId,
      actor_email: (ctx.claims?.email as string | undefined) ?? null,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      metadata: metadata as never,
    });
  } catch (e) {
    console.error("[audit] log failed", e);
  }
}