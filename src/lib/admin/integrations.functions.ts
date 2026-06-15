import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("integrations")
      .select("id, provider, display_name, category, status, config, last_checked_at, updated_at")
      .order("category").order("display_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const updateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["connected", "disconnected", "error", "pending"]).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export const updateIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const payload: Record<string, unknown> = { last_checked_at: new Date().toISOString() };
    if (data.status) payload.status = data.status;
    if (data.config) payload.config = data.config;
    const { error } = await context.supabase.from("integrations").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "integration.update", "integration", data.id, { status: data.status });
    return { ok: true };
  });
