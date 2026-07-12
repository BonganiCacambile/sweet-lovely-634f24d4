import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paystack webhook endpoint.
 *
 * Paystack signs every webhook body with HMAC-SHA512 using your SECRET key
 * and sends the hex digest in the `x-paystack-signature` header. We verify
 * that signature against the raw body BEFORE parsing or acting on anything.
 *
 * The primary order write path is `verifyAndCreateOrder` (called from the
 * client after the inline modal closes). This webhook is a safety net: if
 * the customer closes their browser before the client verification runs,
 * Paystack still delivers `charge.success`, we look up the order by
 * `paystack_reference`, and — if it exists and is still `pending` — we
 * promote it to `preparing`. We never create orders here; without the cart
 * context (items, zone, address) we cannot recompute totals safely.
 *
 * Idempotency: Paystack retries webhooks. All updates key off
 * `paystack_reference` and only advance the status from `pending`, so
 * repeated deliveries are no-ops.
 */
export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) {
          console.error("[paystack-webhook] PAYSTACK_SECRET_KEY not set");
          return new Response("Not configured", { status: 503 });
        }

        const signature = request.headers.get("x-paystack-signature");
        const rawBody = await request.text();

        if (!signature) {
          return new Response("Missing signature", { status: 401 });
        }

        const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
        const sigBuf = Buffer.from(signature, "utf8");
        const expectedBuf = Buffer.from(expected, "utf8");
        if (
          sigBuf.length !== expectedBuf.length ||
          !timingSafeEqual(sigBuf, expectedBuf)
        ) {
          console.warn("[paystack-webhook] invalid signature");
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: {
          event?: string;
          data?: {
            reference?: string;
            status?: string;
            amount?: number;
            currency?: string;
          };
        };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = payload.event ?? "";
        const reference = payload.data?.reference;

        // Always ack quickly; only act on charge.success with a reference.
        if (event !== "charge.success" || !reference) {
          return new Response("ok", { status: 200 });
        }
        if (payload.data?.status !== "success") {
          return new Response("ok", { status: 200 });
        }

        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          const { data: order, error: lookupErr } = await supabaseAdmin
            .from("orders")
            .select("id, status, total_zar")
            .eq("paystack_reference", reference)
            .maybeSingle();

          if (lookupErr) {
            console.error("[paystack-webhook] lookup error", lookupErr);
            // Return 500 so Paystack retries — the order may exist momentarily.
            return new Response("Lookup failed", { status: 500 });
          }

          if (!order) {
            // Client-side verifyAndCreateOrder hasn't run yet (or never will).
            // 200 tells Paystack we received it; a retry a few minutes later
            // will likely find the order once the browser finishes the flow.
            // If it truly never arrives, support can reconcile via the ref.
            console.warn(
              "[paystack-webhook] no order for reference — awaiting client verify",
              { reference },
            );
            return new Response("ok", { status: 200 });
          }

          // Optional amount cross-check (Paystack sends smallest unit).
          if (typeof payload.data?.amount === "number") {
            const expectedMinor = Math.round(Number(order.total_zar) * 100);
            if (payload.data.amount < expectedMinor) {
              console.error("[paystack-webhook] amount mismatch", {
                reference,
                expectedMinor,
                got: payload.data.amount,
              });
              // Don't advance status on mismatch; ack so Paystack stops retrying.
              return new Response("ok", { status: 200 });
            }
          }

          // Idempotent status promotion: only pending -> preparing.
          if (order.status === "pending") {
            const { error: updErr } = await supabaseAdmin
              .from("orders")
              .update({
                status: "preparing",
                notes: `Paystack webhook confirmed ref: ${reference}`,
              })
              .eq("id", order.id)
              .eq("status", "pending");
            if (updErr) {
              console.error("[paystack-webhook] update error", updErr);
              return new Response("Update failed", { status: 500 });
            }
          }

          return new Response("ok", { status: 200 });
        } catch (err) {
          console.error("[paystack-webhook] handler error", err);
          return new Response("Internal error", { status: 500 });
        }
      },
    },
  },
});
