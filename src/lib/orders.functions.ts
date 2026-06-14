import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, subtotal_zar, delivery_zar, total_zar, created_at, address, order_items(id, title_snapshot, quantity, unit_price_zar, line_total_zar)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getMyOrders error:", error);
      throw new Error("Could not load your orders");
    }
    return { orders: orders ?? [] };
  });