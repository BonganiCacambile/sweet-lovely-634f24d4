import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";
import type { Database } from "@/integrations/supabase/types";
type SettingUpdate = Database["public"]["Tables"]["system_settings"]["Update"];

export const listSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("system_settings")
      .select("group_key, key, value, description, updated_at")
      .order("group_key").order("key");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const updateInput = z.object({
  group_key: z.string().min(1).max(50),
  key: z.string().min(1).max(100),
  value: z.unknown(),
});
export const updateSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const payload: SettingUpdate = { value: data.value as SettingUpdate["value"], updated_by: context.userId };
    const { error } = await context.supabase
      .from("system_settings")
      .update(payload)
      .eq("group_key", data.group_key)
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    await logAudit(context, "settings.update", "system_setting", `${data.group_key}.${data.key}`, { value: data.value });
    return { ok: true };
  });
