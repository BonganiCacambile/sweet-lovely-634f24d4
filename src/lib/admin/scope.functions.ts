import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the caller's admin scope: whether they're a main admin, and which
 * (if any) delivery zone they're scoped to. Returns nulls for non-admins.
 */
export const getCallerScope = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role, assigned_zone_id")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const isMainAdmin = rows.some((r) => r.role === "admin");
    const zoneRow = rows.find((r) => r.assigned_zone_id);
    const assignedZoneId = (zoneRow?.assigned_zone_id as string | null) ?? null;
    const isZoneAdmin = !isMainAdmin && Boolean(assignedZoneId);
    let assignedZoneName: string | null = null;
    if (assignedZoneId) {
      const { data: z } = await context.supabase
        .from("delivery_zones")
        .select("name")
        .eq("id", assignedZoneId)
        .maybeSingle();
      assignedZoneName = (z?.name as string | null) ?? null;
    }
    return { isMainAdmin, isZoneAdmin, assignedZoneId, assignedZoneName };
  });