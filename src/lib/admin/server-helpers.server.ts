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

export async function logAudit(
  supabase: SupabaseClient<Database>,
  action: string,
  entity?: string | null,
  entityId?: string | null,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.rpc("log_audit_event", {
      _action: action,
      _entity: entity ?? undefined,
      _entity_id: entityId ?? undefined,
      _metadata: metadata as never,
    });
  } catch (e) {
    console.error("[audit] log failed", e);
  }
}