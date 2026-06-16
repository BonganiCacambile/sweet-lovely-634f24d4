import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

const ORDER_STATUSES = [
  "pending",
  "preparing",
  "processing",
  "out_for_delivery",
  "completed",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const listInput = z.object({
  search: z.string().optional().default(""),
  status: z.string().optional().default(""),
  zoneId: z.string().optional().default(""),
  fromDate: z.string().optional().default(""),
  toDate: z.string().optional().default(""),
  sortBy: z.enum(["created_at", "total_zar", "order_number"]).optional().default("created_at"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(200).optional().default(25),
});

export const listOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { search, status, zoneId, fromDate, toDate, sortBy, sortDir, page, pageSize } = data;
    let q = context.supabase
      .from("orders")
      .select(
        "id, order_number, status, customer_name, customer_email, total_zar, subtotal_zar, delivery_zar, created_at, user_id, paystack_reference, delivery_zone_id, delivery_zone_name",
        { count: "exact" },
      );
    if (status) q = q.eq("status", status as never);
    if (zoneId) q = q.eq("delivery_zone_id", zoneId);
    if (fromDate) q = q.gte("created_at", fromDate);
    if (toDate) q = q.lte("created_at", toDate);
    if (search) {
      const s = `%${search}%`;
      q = q.or(`order_number.ilike.${s},customer_name.ilike.${s},customer_email.ilike.${s}`);
    }
    const from = (page - 1) * pageSize;
    q = q.order(sortBy, { ascending: sortDir === "asc" }).range(from, from + pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page, pageSize };
  });

export const getOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: order, error } = await context.supabase
      .from("orders")
      .select(
        "*, order_items(id, product_slug, title_snapshot, quantity, unit_price_zar, line_total_zar)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");
    return order;
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(ORDER_STATUSES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: prev } = await context.supabase
      .from("orders")
      .select("user_id, order_number, status")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "order.status_change", "order", data.id, { status: data.status });

    // Notify the customer when their order is ready for pickup.
    if (
      prev?.user_id &&
      prev.status !== data.status &&
      (data.status === "completed" || data.status === "delivered")
    ) {
      const isPickup = data.status === "completed";
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("notifications").insert({
        user_id: prev.user_id,
        title: isPickup ? "Your order is ready for pickup" : "Your order has been delivered",
        body: `Order ${prev.order_number} ${isPickup ? "is ready for pickup. See you soon!" : "has been delivered. Enjoy!"}`,
        category: "order",
        read: false,
      });
    }
    return { ok: true };
  });

export const orderStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("orders")
      .select("status, total_zar, created_at");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const byStatus: Record<string, number> = {};
    let revenue = 0;
    let todayCount = 0;
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.status !== "cancelled" && r.status !== "refunded") revenue += Number(r.total_zar ?? 0);
      if (new Date(r.created_at) >= today) todayCount += 1;
    }
    return { total: rows.length, byStatus, revenue, todayCount };
  });