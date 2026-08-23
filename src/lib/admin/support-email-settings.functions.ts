import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

const zoneInput = z.object({ zoneId: z.string().uuid().nullable().default(null) });

const configInput = z.object({
  zoneId: z.string().uuid().nullable().default(null),
  enabled: z.boolean(),
  mode: z.enum(["all", "custom"]),
  userIds: z.array(z.string().uuid()).max(200).default([]),
  extraEmails: z.array(z.string().trim().email().max(200)).max(20).default([]),
});

/** Zones plus whether they have a saved override, for the settings page list. */
export const listSupportEmailZones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({}).parse(d ?? {}))
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { SUPPORT_EMAIL_GROUP, zoneKey } = await import("@/lib/support/email-recipients.server");
    const [{ data: zones, error: zErr }, { data: rows }] = await Promise.all([
      context.supabase
        .from("delivery_zones")
        .select("id, name, is_active")
        .order("sort_order", { ascending: true }),
      context.supabase.from("system_settings").select("key").eq("group_key", SUPPORT_EMAIL_GROUP),
    ]);
    if (zErr) throw new Error(zErr.message);
    const configured = new Set((rows ?? []).map((r) => r.key as string));
    return {
      zones: (zones ?? []).map((z) => ({
        id: z.id as string,
        name: z.name as string,
        isActive: z.is_active as boolean,
        hasOverride: configured.has(zoneKey(z.id as string)),
      })),
    };
  });

/** Effective config + candidate admins (and who would actually be emailed). */
export const getSupportEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => zoneInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const {
      getZoneEmailConfig,
      listCandidateAdmins,
      resolveSupportRecipients,
    } = await import("@/lib/support/email-recipients.server");
    const [config, candidates, recipients] = await Promise.all([
      getZoneEmailConfig(data.zoneId),
      listCandidateAdmins(data.zoneId),
      resolveSupportRecipients(data.zoneId),
    ]);
    return { config, candidates, recipients };
  });

export const saveSupportEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => configInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { SUPPORT_EMAIL_GROUP, zoneKey } = await import("@/lib/support/email-recipients.server");
    const value = {
      enabled: data.enabled,
      mode: data.mode,
      userIds: data.userIds,
      extraEmails: data.extraEmails,
    };
    const { error } = await context.supabase
      .from("system_settings")
      .upsert(
        [{ group_key: SUPPORT_EMAIL_GROUP, key: zoneKey(data.zoneId), value }],
        { onConflict: "group_key,key" },
      );
    if (error) throw new Error(error.message);
    await logAudit(context, "support_email.update", "system_setting", zoneKey(data.zoneId), value);
    return { ok: true as const };
  });

/** Removes a zone override so it falls back to the global default. */
export const resetSupportEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ zoneId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { SUPPORT_EMAIL_GROUP, zoneKey } = await import("@/lib/support/email-recipients.server");
    const { error } = await context.supabase
      .from("system_settings")
      .delete()
      .eq("group_key", SUPPORT_EMAIL_GROUP)
      .eq("key", zoneKey(data.zoneId));
    if (error) throw new Error(error.message);
    await logAudit(context, "support_email.reset", "system_setting", zoneKey(data.zoneId), {});
    return { ok: true as const };
  });
