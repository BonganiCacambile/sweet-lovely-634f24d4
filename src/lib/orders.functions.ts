import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, subtotal_zar, delivery_zar, total_zar, created_at, address, delivery_zone_name, fulfillment_method, collection_location, estimated_minutes, order_items(id, product_slug, title_snapshot, quantity, unit_price_zar, line_total_zar, extras, extras_total_zar)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getMyOrders error:", error);
      throw new Error("Could not load your orders");
    }
    return { orders: orders ?? [] };
  });

const idSchema = z.object({ id: z.string().uuid() });

/** Customer-initiated cancellation. Allowed only for orders not already
 * terminal (delivered / cancelled / refunded). Uses the admin client to
 * bypass admin-only UPDATE policy after verifying ownership. */
export const cancelMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: readErr } = await supabase
      .from("orders")
      .select("id, status, user_id")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("Order not found");
    const terminal = ["cancelled", "refunded", "delivered", "completed"];
    if (terminal.includes(String(row.status))) {
      throw new Error("This order can no longer be cancelled.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Customer-initiated deletion of one of their own orders. Only permitted
 * for terminal-state orders so an active order can't disappear from the
 * admin pipeline. Cascades to order_items via FK. */
export const deleteMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: readErr } = await supabase
      .from("orders")
      .select("id, status, user_id")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("Order not found");
    const deletable = ["cancelled", "refunded", "delivered", "completed"];
    if (!deletable.includes(String(row.status))) {
      throw new Error("Cancel this order before deleting it.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });