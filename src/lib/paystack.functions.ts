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
});

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

    // 1) Verify payment with Paystack
    let paystack: {
      status: boolean;
      data?: { status: string; amount: number; currency: string; reference: string };
    };
    try {
      const res = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
        { headers: { Authorization: `Bearer ${secret}` } },
      );
      paystack = await res.json();
      if (!res.ok || !paystack.status || !paystack.data) {
        return { success: false as const, error: "Verification failed" };
      }
    } catch (err) {
      console.error("Paystack verify error:", err);
      return { success: false as const, error: "Network error during verification" };
    }

    if (paystack.data!.status !== "success") {
      return { success: false as const, error: `Payment not successful (${paystack.data!.status})` };
    }

    // 2) Sanity-check amount (Paystack returns smallest unit)
    const expectedAmount = Math.round(data.total * 100);
    if (paystack.data!.amount !== expectedAmount) {
      console.error("Amount mismatch:", { expected: expectedAmount, got: paystack.data!.amount });
      return { success: false as const, error: "Payment amount mismatch" };
    }

    // 3) Persist order + items (service role; works for guest checkout)
    const { customer } = data;
    const fullAddress = `${customer.address}, ${customer.city}, ${customer.state}, ${customer.country} ${customer.postal}`;

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: data.userId ?? null,
        status: "paid",
        customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
        customer_email: customer.email,
        customer_phone: customer.phone,
        address: fullAddress,
        notes: `Paystack ref: ${data.reference}`,
        subtotal_zar: data.subtotal,
        delivery_zar: data.shipping,
        total_zar: data.total,
      })
      .select("id, order_number")
      .single();

    if (orderErr || !order) {
      console.error("Order insert error:", orderErr);
      return { success: false as const, error: "Could not save order after payment" };
    }

    const itemRows = data.items.map((it) => ({
      order_id: order.id,
      product_slug: it.id,
      title_snapshot: it.title,
      quantity: it.quantity,
      unit_price_zar: it.price,
      line_total_zar: Number((it.price * it.quantity).toFixed(2)),
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

    return {
      success: true as const,
      orderNumber: order.order_number,
      reference: data.reference,
    };
  });