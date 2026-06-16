import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ----------------------------- Overview ------------------------------- */

export const getAccountOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [
      { data: profile },
      { data: orders },
      { data: loyalty },
      { data: addresses },
      { count: unreadCount },
      { data: recentNotifications },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, phone, avatar_url, locale, theme, marketing_opt_in, notification_prefs, created_at",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("orders")
        .select("id, order_number, status, total_zar, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("loyalty_accounts")
        .select("points_balance, lifetime_points, tier")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_addresses")
        .select("id, label, line1, city, is_default")
        .eq("user_id", userId),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false),
      supabase
        .from("notifications")
        .select("id, title, body, category, read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const allOrders = orders ?? [];
    const totalSpent = allOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + Number(o.total_zar || 0), 0);
    const completed = allOrders.filter((o) => o.status === "delivered").length;
    const pending = allOrders.filter((o) =>
      ["pending", "preparing", "out_for_delivery"].includes(String(o.status)),
    ).length;

    // Profile completion checklist
    const checks = [
      Boolean(profile?.full_name),
      Boolean(profile?.phone),
      Boolean(profile?.avatar_url),
      (addresses?.length ?? 0) > 0,
    ];
    const completion = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    return {
      profile,
      stats: {
        totalOrders: allOrders.length,
        completed,
        pending,
        totalSpent,
      },
      loyalty: loyalty ?? { points_balance: 0, lifetime_points: 0, tier: "bronze" },
      addresses: addresses ?? [],
      unreadNotifications: unreadCount ?? 0,
      recentOrders: allOrders.slice(0, 5),
      recentNotifications: recentNotifications ?? [],
      profileCompletion: completion,
    };
  });

/* ----------------------------- Addresses ------------------------------ */

export const listAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", context.userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { addresses: data ?? [] };
  });

const addressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(40),
  recipient: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(80),
  province: z.string().trim().max(80).optional().nullable(),
  postal_code: z.string().trim().max(20).optional().nullable(),
  country: z.string().trim().min(2).max(2).default("ZA"),
  is_default: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const saveAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addressSchema.parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId };
    if (data.id) {
      const { error } = await context.supabase
        .from("user_addresses")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("user_addresses")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_addresses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDefaultAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_addresses")
      .update({ is_default: true })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- Notifications ---------------------------- */

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, title, body, category, read, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { notifications: data ?? [] };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), read: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read: data.read })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", context.userId)
      .eq("read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------- Preferences ----------------------------- */

const channelPrefs = z.object({
  orders: z.boolean(),
  security: z.boolean(),
  promotions: z.boolean(),
  account: z.boolean(),
});

const prefsSchema = z.object({
  full_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  avatar_url: z.string().trim().max(500).nullable().optional(),
  locale: z.enum(["en", "af", "zu", "xh"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  marketing_opt_in: z.boolean().optional(),
  notification_prefs: z
    .object({ email: channelPrefs, sms: channelPrefs, push: channelPrefs })
    .optional(),
});

export const updatePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => prefsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- Order detail ----------------------------- */

export const getMyOrderDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select(
        "id, order_number, status, customer_name, customer_email, customer_phone, address, notes, subtotal_zar, delivery_zar, total_zar, created_at, updated_at, paystack_reference, order_items(id, product_slug, title_snapshot, quantity, unit_price_zar, line_total_zar)",
      )
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");
    return { order };
  });

/* ------------------------- Security activity -------------------------- */

export const getMySecurityActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("id, action, entity, entity_id, metadata, created_at")
      .eq("actor_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { events: [] };
    return { events: data ?? [] };
  });