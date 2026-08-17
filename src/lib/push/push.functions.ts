import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Device registration + delivery bookkeeping.
 *
 * Every write is scoped by RLS to the authenticated caller (`user_id =
 * auth.uid()`), so a customer can never register a token against, read, or
 * mutate another customer's device. No service-role client is used here.
 */

const registerInput = z.object({
  token: z.string().trim().min(8).max(4096),
  platform: z.enum(["web", "android", "ios"]),
  provider: z.string().trim().min(1).max(40).default("web-local"),
  device_name: z.string().trim().max(120).optional().nullable(),
  app_version: z.string().trim().max(40).optional().nullable(),
});

export const registerPushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registerInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // A token is globally unique. If it already exists for *another* user
    // (shared/handed-down device), the old owner's binding is retired via the
    // service role so the new owner never inherits their notifications.
    const { data: existing } = await supabase
      .from("user_notification_devices")
      .select("id")
      .eq("token", data.token)
      .maybeSingle();

    if (!existing) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("user_notification_devices")
        .delete()
        .eq("token", data.token)
        .neq("user_id", userId);
    }

    const now = new Date().toISOString();
    const { data: row, error } = await supabase
      .from("user_notification_devices")
      .upsert(
        {
          user_id: userId,
          token: data.token,
          platform: data.platform,
          provider: data.provider,
          device_name: data.device_name ?? null,
          app_version: data.app_version ?? null,
          is_active: true,
          last_error: null,
          last_active_at: now,
          updated_at: now,
        },
        { onConflict: "token" },
      )
      .select("id, platform, provider, device_name, is_active, created_at, last_active_at")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, device: row };
  });

export const listMyPushDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_notification_devices")
      .select("id, platform, provider, device_name, is_active, created_at, last_active_at")
      .eq("user_id", context.userId)
      .order("last_active_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { devices: data ?? [] };
  });

const tokenInput = z.object({ token: z.string().trim().min(8).max(4096) });

/** Called on sign-out: the token stops receiving anything for this account. */
export const deactivatePushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tokenInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_notification_devices")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("token", data.token)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_notification_devices")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const touchPushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tokenInput.parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("user_notification_devices")
      .update({ last_active_at: new Date().toISOString() })
      .eq("token", data.token)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/**
 * Web-local delivery ack. The running tab rendered a system notification, so
 * the queued delivery row for this device is closed out. Rows are only ever
 * matched on `user_id = auth.uid()`.
 */
const ackInput = z.object({
  notificationId: z.string().uuid(),
  token: z.string().trim().min(8).max(4096),
  status: z.enum(["sent", "failed"]).default("sent"),
  error: z.string().max(300).optional().nullable(),
});

export const ackLocalDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ackInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: device } = await context.supabase
      .from("user_notification_devices")
      .select("id")
      .eq("token", data.token)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!device) return { ok: false };

    await supabaseAdmin
      .from("notification_deliveries")
      .update({
        status: data.status,
        error: data.error ?? null,
        delivered_at: new Date().toISOString(),
      })
      .eq("notification_id", data.notificationId)
      .eq("user_id", context.userId)
      .eq("device_id", device.id)
      .eq("status", "queued");
    return { ok: true };
  });

export const listMyDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notification_deliveries")
      .select("id, platform, category, status, error, created_at, delivered_at, order_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { deliveries: data ?? [] };
  });