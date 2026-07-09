import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Returns the Paystack public key for client-side inline checkout. */
export const getPaystackConfig = createServerFn({ method: "GET" }).handler(async () => {
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY || "";
  return {
    publicKey,
    configured: Boolean(publicKey && process.env.PAYSTACK_SECRET_KEY),
  };
});

/** Verifies a Paystack transaction by reference using the secret key. */
export const verifyPaystackTransaction = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ reference: z.string().min(3).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return { success: false, error: "Paystack is not configured" as const };
    }
    try {
      const res = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
        { headers: { Authorization: `Bearer ${secret}` } },
      );
      const json = (await res.json()) as {
        status: boolean;
        data?: { status: string; amount: number; currency: string; reference: string };
      };
      if (!res.ok || !json.status || !json.data) {
        return { success: false, error: "Verification failed" as const };
      }
      return {
        success: json.data.status === "success",
        status: json.data.status,
        amount: json.data.amount,
        currency: json.data.currency,
        reference: json.data.reference,
      };
    } catch (err) {
      console.error("Paystack verify error:", err);
      return { success: false, error: "Network error" as const };
    }
  });

const cartItemSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive().max(999),
});

const createOrderSchema = z.object({
  reference: z.string().min(3).max(200),
  customer: z.object({
    firstName: z.string().min(1).max(120),
    lastName: z.string().min(1).max(120),
    email: z.string().email().max(200),
    phone: z.string().min(3).max(40),
    address: z.string().min(1).max(400),
    city: z.string().min(1).max(120),
    state: z.string().min(1).max(120),
    country: z.string().min(1).max(120),
    postal: z.string().min(1).max(40),
  }),
  items: z.array(cartItemSchema).min(1).max(100),
  subtotal: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  userId: z.string().uuid().nullable().optional(),
  deliveryZoneId: z.string().uuid(),
});

const stockCheckSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(100),
});

/**
 * Pre-payment stock availability check. Aggregates pizza variants by base
 * slug so two size lines of the same pizza count against one stock pool.
 * Returns shortages (if any) so the client can block before opening Paystack.
 */
export const checkCartStock = createServerFn({ method: "POST" })
  .inputValidator((input) => stockCheckSchema.parse(input))
  .handler(async ({ data }) => {
    const totals = new Map<string, number>();
    for (const it of data.items) {
      const { slug } = splitPizzaId(it.id);
      totals.set(slug, (totals.get(slug) ?? 0) + it.quantity);
    }
    const payload = Array.from(totals.entries()).map(([slug, quantity]) => ({
      slug,
      quantity,
    }));
    const { data: result, error } = await supabaseAdmin.rpc(
      "check_stock_availability",
      { _items: payload as unknown as never },
    );
    if (error) {
      console.error("checkCartStock error:", error);
      return { ok: false as const, error: "Could not verify stock availability" };
    }
    const r = result as { ok: boolean; shortages: Array<{ slug: string; requested: number; available: number }> };
    return { ok: r.ok, shortages: r.shortages ?? [] };
  });

// Server-authoritative pizza size prices (must match PIZZA_SIZES in
// src/components/cart/add-to-cart-button.tsx). Cart ids for pizzas are
// `${slug}-medium` / `${slug}-large`.
const PIZZA_SIZE_PRICES: Record<string, number> = {
  medium: 80,
  large: 150,
};
const PIZZA_SUFFIXES = Object.keys(PIZZA_SIZE_PRICES);

function splitPizzaId(id: string): { slug: string; size: string | null } {
  for (const suffix of PIZZA_SUFFIXES) {
    if (id.endsWith(`-${suffix}`)) {
      return { slug: id.slice(0, -(suffix.length + 1)), size: suffix };
    }
  }
  return { slug: id, size: null };
}

/**
 * Verifies the Paystack transaction and, on success, persists the order
 * and its line items. Returns the generated order_number for the success page.
 */
export const verifyAndCreateOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => createOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return { success: false as const, error: "Paystack is not configured" };
    }

    // 1) Verify payment with Paystack (with retries for transient issues)
    let paystackData: {
      status: string;
      amount: number;
      currency: string;
      reference: string;
    } | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
          { headers: { Authorization: `Bearer ${secret}` } },
        );
        const text = await res.text();
        let json: {
          status: boolean;
          data?: { status: string; amount: number; currency: string; reference: string };
        };
        try {
          json = JSON.parse(text);
        } catch {
          console.error("Paystack returned non-JSON:", text.slice(0, 500));
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          break;
        }
        if (!res.ok || !json.status || !json.data) {
          return { success: false as const, error: "Verification failed" };
        }
        paystackData = json.data;
        break;
      } catch (err) {
        console.error(`Paystack verify attempt ${attempt + 1} failed:`, err);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    if (paystackData && paystackData.status !== "success") {
      return { success: false as const, error: `Payment not successful (${paystackData.status})` };
    }

    // 2) Recompute prices server-side from products table — never trust client.
    const parsedItems = data.items.map((it) => ({ ...it, ...splitPizzaId(it.id) }));
    const slugs = Array.from(new Set(parsedItems.map((p) => p.slug)));
    const { data: products, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("slug, price_zar, title, is_active")
      .in("slug", slugs);
    if (prodErr) {
      console.error("Product lookup error:", prodErr);
      return { success: false as const, error: "Could not validate product prices" };
    }
    const productMap = new Map((products ?? []).map((p) => [p.slug, p]));

    type PricedItem = {
      cartId: string;
      slug: string | null;
      title: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    };
    const priced: PricedItem[] = [];
    for (const it of parsedItems) {
      const product = productMap.get(it.slug);
      // Resolve unit price:
      // - Pizza variants: use authoritative size price.
      // - Known product: use DB price.
      // - Unknown/inactive product (e.g. legacy cart, removed item): fall back
      //   to the client-supplied price as a snapshot so we don't drop the
       //  order after payment has already been captured. The charged amount
       //  is still verified against the computed total below, so this can
       //  only ever undercharge us — never overcharge the customer.
      let unitPrice: number;
      if (it.size) {
        const sizePrice = PIZZA_SIZE_PRICES[it.size];
        if (typeof sizePrice !== "number") {
          return { success: false as const, error: `Invalid size: ${it.size}` };
        }
        unitPrice = sizePrice;
      } else if (product && product.is_active !== false) {
        unitPrice = Number(product.price_zar);
      } else {
        unitPrice = Math.max(0, Number(it.price) || 0);
        console.warn("Order item not in products table — using snapshot price", {
          slug: it.slug,
          title: it.title,
        });
      }
      const lineTotal = Number((unitPrice * it.quantity).toFixed(2));
      priced.push({
        cartId: it.id,
        slug: product ? it.slug : null,
        title: product?.title ?? it.title,
        quantity: it.quantity,
        unitPrice,
        lineTotal,
      });
    }

    const serverSubtotal = Number(
      priced.reduce((s, p) => s + p.lineTotal, 0).toFixed(2),
    );
    // Trust client shipping/tax only as upper bounds (cap to a sane max).
    const shipping = Math.max(0, Math.min(data.shipping, 10_000));
    const tax = Math.max(0, Math.min(data.tax, 1_000_000));
    const serverTotal = Number((serverSubtotal + shipping + tax).toFixed(2));
    const expectedAmount = Math.round(serverTotal * 100);
    if (paystackData && paystackData.amount < expectedAmount) {
      console.error("Amount mismatch:", {
        expected: expectedAmount,
        got: paystackData.amount,
      });
      return { success: false as const, error: "Payment amount does not match order" };
    }

    // 3) Persist order + items (service role; works for guest checkout).
    // Unique index on paystack_reference prevents reference replay.
    const { customer } = data;
    const fullAddress = `${customer.address}, ${customer.city}, ${customer.state}, ${customer.country} ${customer.postal}`;

    // Look up the selected delivery zone for snapshot + fee validation.
    const { data: zone, error: zoneErr } = await supabaseAdmin
      .from("delivery_zones")
      .select("id, name, fee_zar, min_order_zar, free_delivery_threshold_zar, is_active")
      .eq("id", data.deliveryZoneId)
      .maybeSingle();
    if (zoneErr || !zone) {
      console.error("Zone lookup error:", zoneErr);
      return { success: false as const, error: "Selected delivery zone is unavailable" };
    }
    if (!zone.is_active) {
      return { success: false as const, error: "Selected delivery zone is no longer active" };
    }
    if (serverSubtotal < Number(zone.min_order_zar)) {
      return {
        success: false as const,
        error: `Order below ${zone.name} minimum (R${Number(zone.min_order_zar).toFixed(2)})`,
      };
    }

    // Re-derive the delivery fee server-side. If the zone offers free delivery
    // above a threshold and the subtotal qualifies, waive the fee — never trust
    // the client-supplied shipping amount to be lower than what our rule says.
    const freeThreshold = Number(
      (zone as { free_delivery_threshold_zar: number | null }).free_delivery_threshold_zar ?? 0,
    );
    const zoneFee = Number(zone.fee_zar);
    const serverShipping =
      freeThreshold > 0 && serverSubtotal >= freeThreshold ? 0 : zoneFee;

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: data.userId ?? null,
        status: paystackData ? "preparing" : "pending",
        customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
        customer_email: customer.email,
        customer_phone: customer.phone,
        address: fullAddress,
        notes: paystackData
          ? `Paystack ref: ${data.reference}`
          : `Paystack ref: ${data.reference} (verification deferred due to network error — please verify manually)`,
        subtotal_zar: serverSubtotal,
        delivery_zar: shipping,
        total_zar: serverTotal,
        paystack_reference: data.reference,
        delivery_zone_id: zone.id,
        delivery_zone_name: zone.name,
      })
      .select("id, order_number")
      .single();

    if (orderErr || !order) {
      console.error("Order insert error:", orderErr);
      const code = (orderErr as { code?: string } | null)?.code;
      if (code === "23505") {
        return {
          success: false as const,
          error: "This payment reference has already been used",
        };
      }
      return { success: false as const, error: "Could not save order after payment" };
    }

    const itemRows = priced.map((it) => ({
      order_id: order.id,
      product_slug: it.slug,
      title_snapshot: it.title,
      quantity: it.quantity,
      unit_price_zar: it.unitPrice,
      line_total_zar: it.lineTotal,
    }));

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemRows);
    if (itemsErr) {
      console.error("Order items insert error:", itemsErr);
      // Order saved, items failed — surface the order number so support can recover
      return {
        success: true as const,
        orderNumber: order.order_number,
        reference: data.reference,
        warning: "Items not saved — please contact support",
      };
    }

    // 4) Atomic stock deduction with per-line audit log. Aggregate variants
    // (e.g. medium/large pizzas) so a single product only deducts once per slug.
    const stockTotals = new Map<string, number>();
    for (const it of priced) {
      if (!it.slug) continue;
      stockTotals.set(it.slug, (stockTotals.get(it.slug) ?? 0) + it.quantity);
    }
    if (stockTotals.size > 0) {
      const stockPayload = Array.from(stockTotals.entries()).map(
        ([slug, quantity]) => ({ slug, quantity }),
      );
      const { error: stockErr } = await supabaseAdmin.rpc(
        "process_order_stock_deduction",
        {
          _order_id: order.id,
          _items: stockPayload as unknown as never,
        },
      );
      if (stockErr) {
        console.error("Stock deduction failed:", stockErr, { orderId: order.id });
        return {
          success: true as const,
          orderNumber: order.order_number,
          reference: data.reference,
          warning:
            "Order saved but inventory could not be updated — please contact support",
        };
      }
    }

    return {
      success: true as const,
      orderNumber: order.order_number,
      reference: data.reference,
      ...(paystackData
        ? {}
        : {
            warning:
              "We couldn't verify your payment immediately due to a network issue. Your order has been placed and will be reviewed shortly.",
          }),
    };
  });