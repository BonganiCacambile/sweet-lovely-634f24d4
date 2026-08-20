import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";
import {
  AUDIT_RETENTION_GROUP,
  purgeReplyAudit,
  settingsFromRows,
} from "./audit-retention.server";
export type { AuditRetentionSettings } from "./audit-retention.server";

export const getAuditRetentionSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({}).parse(d ?? {}))
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("system_settings")
      .select("key, value")
      .eq("group_key", AUDIT_RETENTION_GROUP);
    if (error) throw new Error(error.message);
    return settingsFromRows(data ?? []);
  });

export const saveAuditRetentionSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        retentionDays: z.number().int().min(7).max(3650),
        keepCustomerReplies: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const rows = [
      { group_key: AUDIT_RETENTION_GROUP, key: "enabled", value: data.enabled },
      { group_key: AUDIT_RETENTION_GROUP, key: "retention_days", value: data.retentionDays },
      {
        group_key: AUDIT_RETENTION_GROUP,
        key: "keep_customer_replies",
        value: data.keepCustomerReplies,
      },
    ];
    const { error } = await context.supabase
      .from("system_settings")
      .upsert(rows, { onConflict: "group_key,key" });
    if (error) throw new Error(error.message);
    await logAudit(context, "audit_retention.update", "system_setting", AUDIT_RETENTION_GROUP, data);
    return { ok: true };
  });

export const previewAuditRetentionCleanup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        retentionDays: z.number().int().min(7).max(3650),
        keepCustomerReplies: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    return purgeReplyAudit({ ...data, source: "preview", dryRun: true });
  });

export const runAuditRetentionCleanup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        retentionDays: z.number().int().min(7).max(3650),
        keepCustomerReplies: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const result = await purgeReplyAudit({ ...data, source: "manual" });
    await logAudit(context, "audit_retention.cleanup", "audit_logs", null, {
      deleted: result.deleted,
      cutoff: result.cutoff,
      retention_days: data.retentionDays,
    });
    return result;
  });
